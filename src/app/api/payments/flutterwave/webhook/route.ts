import { NextResponse } from "next/server";
import {
  verifyFlutterwaveByReference,
  verifyFlutterwaveTransaction,
} from "@/lib/flutterwave";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type PaymentStatus =
  | "initiated"
  | "pending"
  | "successful"
  | "failed"
  | "cancelled";

type PaymentRecord = {
  id: string;
  student_id: string;
  course_id: string;
  course_slug: string;
  tx_ref: string;
  flutterwave_transaction_id: number | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  original_amount: number | null;
  discount_code_id: string | null;
  discount_amount: number;
};

type EnrollmentRecord = {
  id: string;
  enrollment_status: string;
  payment_status: string;
  progress_percent: number;
  enrolled_at: string;
};

type FlutterwaveVerification = {
  id: number;
  txRef: string;
  amount: number;
  currency: string;
  status: string;
  flwRef: string | null;
};

const MAX_WEBHOOK_BODY_SIZE = 64 * 1024;

const PAYMENT_COLUMNS = [
  "id",
  "student_id",
  "course_id",
  "course_slug",
  "tx_ref",
  "flutterwave_transaction_id",
  "amount",
  "currency",
  "status",
  "original_amount",
  "discount_code_id",
  "discount_amount",
].join(", ");

const ENROLLMENT_COLUMNS =
  "id, enrollment_status, payment_status, progress_percent, enrolled_at";

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function getWebhookHash(request: Request) {
  return (
    request.headers.get("verif-hash") ||
    request.headers.get("verif_hash") ||
    ""
  ).trim();
}

function getWebhookSecret() {
  return (
    process.env.FLW_WEBHOOK_HASH ||
    process.env.FLUTTERWAVE_WEBHOOK_HASH ||
    ""
  ).trim();
}

function constantTimeEqual(a: string, b: string) {
  if (!a || !b) return false;

  const length = Math.max(a.length, b.length);
  let difference = a.length ^ b.length;

  for (let i = 0; i < length; i += 1) {
    difference |=
      (a.charCodeAt(i) || 0) ^
      (b.charCodeAt(i) || 0);
  }

  return difference === 0;
}

function getString(value: unknown) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function getNumber(value: unknown) {
  const number =
    typeof value === "number" ||
    typeof value === "string"
      ? Number(value)
      : Number.NaN;

  return Number.isFinite(number)
    ? number
    : 0;
}

async function getPaymentByReference(
  admin: ReturnType<typeof createAdminClient>,
  txRef: string,
): Promise<PaymentRecord | null> {
  const { data, error } = await admin
    .from("course_payments")
    .select(PAYMENT_COLUMNS)
    .eq("tx_ref", txRef)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as unknown as PaymentRecord | null;
}

async function createOrActivateEnrollment(
  admin: ReturnType<typeof createAdminClient>,
  payment: PaymentRecord,
): Promise<EnrollmentRecord> {
  const { data, error } = await admin
    .from("enrollments")
    .select(ENROLLMENT_COLUMNS)
    .eq("student_id", payment.student_id)
    .eq("course_id", payment.course_id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const existing =
    data as unknown as EnrollmentRecord | null;

  if (existing) {
    if (
      existing.enrollment_status === "active" &&
      existing.payment_status === "paid"
    ) {
      return existing;
    }

    const { data: updated, error: updateError } =
      await admin
        .from("enrollments")
        .update({
          enrollment_status: "active",
          payment_status: "paid",
        })
        .eq("id", existing.id)
        .select(ENROLLMENT_COLUMNS)
        .single();

    if (updateError) {
      throw new Error(updateError.message);
    }

    return updated as unknown as EnrollmentRecord;
  }

  const { data: created, error: createError } =
    await admin
      .from("enrollments")
      .insert({
        student_id: payment.student_id,
        course_id: payment.course_id,
        enrollment_status: "active",
        payment_status: "paid",
        progress_percent: 0,
      })
      .select(ENROLLMENT_COLUMNS)
      .single();

  if (!createError) {
    return created as unknown as EnrollmentRecord;
  }

  if (createError.code !== "23505") {
    throw new Error(createError.message);
  }

  /*
   * A concurrent webhook may have created the enrollment.
   * Read it again, then ensure it is active and paid.
   */
  const { data: retry, error: retryError } =
    await admin
      .from("enrollments")
      .select(ENROLLMENT_COLUMNS)
      .eq("student_id", payment.student_id)
      .eq("course_id", payment.course_id)
      .maybeSingle();

  if (retryError || !retry) {
    throw new Error(
      retryError?.message ||
        "Enrollment could not be recovered after a concurrent insert.",
    );
  }

  const enrollment =
    retry as unknown as EnrollmentRecord;

  if (
    enrollment.enrollment_status === "active" &&
    enrollment.payment_status === "paid"
  ) {
    return enrollment;
  }

  const { data: activated, error: activateError } =
    await admin
      .from("enrollments")
      .update({
        enrollment_status: "active",
        payment_status: "paid",
      })
      .eq("id", enrollment.id)
      .select(ENROLLMENT_COLUMNS)
      .single();

  if (activateError) {
    throw new Error(activateError.message);
  }

  return activated as unknown as EnrollmentRecord;
}

async function markPaymentSuccessful(
  admin: ReturnType<typeof createAdminClient>,
  payment: PaymentRecord,
  verification: FlutterwaveVerification,
): Promise<PaymentRecord> {
  const now = new Date().toISOString();

  /*
   * Do not overwrite a transaction ID with an invalid value.
   */
  const transactionId =
    verification.id > 0
      ? verification.id
      : payment.flutterwave_transaction_id;

  const { data, error } = await admin
    .from("course_payments")
    .update({
      status: "successful",
      flutterwave_transaction_id: transactionId,
      updated_at: now,
      verified_at: now,
    })
    .eq("id", payment.id)
    .neq("status", "successful")
    .select(PAYMENT_COLUMNS)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (data) {
    return data as unknown as PaymentRecord;
  }

  /*
   * Another request may have completed the payment first.
   * Re-read instead of blindly repeating the update.
   */
  const latest = await getPaymentByReference(
    admin,
    payment.tx_ref,
  );

  if (!latest || latest.status !== "successful") {
    throw new Error(
      "The payment status could not be confirmed after verification.",
    );
  }

  return latest;
}

/**
 * Records a discount redemption once.
 *
 * The unique database constraint on
 * (discount_code_id, student_id) is the final duplicate
 * protection. Usage counts must be incremented atomically
 * in the database to prevent lost updates.
 */
async function recordDiscountRedemption(
  admin: ReturnType<typeof createAdminClient>,
  payment: PaymentRecord,
) {
  if (
    !payment.discount_code_id ||
    payment.discount_amount <= 0
  ) {
    return;
  }

  const { data: existing, error: existingError } =
    await admin
      .from("course_discount_redemptions")
      .select("id")
      .eq("discount_code_id", payment.discount_code_id)
      .eq("student_id", payment.student_id)
      .maybeSingle();

  if (existingError) {
    throw new Error(
      `Unable to check discount redemption: ${existingError.message}`,
    );
  }

  if (existing) {
    return;
  }

  const originalAmount =
    payment.original_amount ??
    payment.amount + payment.discount_amount;

  const { error: insertError } = await admin
    .from("course_discount_redemptions")
    .insert({
      discount_code_id: payment.discount_code_id,
      student_id: payment.student_id,
      course_id: payment.course_id,
      payment_id: payment.id,
      amount_before_discount: originalAmount,
      discount_amount: payment.discount_amount,
      amount_paid: payment.amount,
    });

  if (insertError) {
    if (insertError.code === "23505") {
      /*
       * Another request already inserted this redemption.
       * Do not increment the counter again.
       */
      return;
    }

    throw new Error(
      `Unable to record discount redemption: ${insertError.message}`,
    );
  }

  /*
   * Important: do not increment usage_count using a
   * read-then-write operation here. Concurrent updates
   * can overwrite each other. Use a database RPC that
   * atomically increments usage_count and handles the
   * redemption in one transaction.
   *
   * The redemption is persisted above, so the RPC should
   * be designed to reconcile recorded redemptions safely.
   */
  const { error: rpcError } = await admin.rpc(
    "increment_discount_usage",
    {
      p_discount_code_id: payment.discount_code_id,
    },
  );

  if (rpcError) {
    throw new Error(
      `Redemption was recorded but discount usage could not be updated: ${rpcError.message}`,
    );
  }
}

async function fulfillSuccessfulPayment(
  admin: ReturnType<typeof createAdminClient>,
  payment: PaymentRecord,
) {
  const enrollment = await createOrActivateEnrollment(
    admin,
    payment,
  );

  await recordDiscountRedemption(admin, payment);

  return enrollment;
}

export async function POST(request: Request) {
  const secret = getWebhookSecret();

  if (!secret) {
    console.error(
      "Flutterwave webhook hash is not configured.",
    );

    return jsonResponse(
      { error: "Webhook configuration error." },
      500,
    );
  }

  const providedHash = getWebhookHash(request);

  if (!constantTimeEqual(providedHash, secret)) {
    return jsonResponse(
      { error: "Invalid webhook signature." },
      401,
    );
  }

  const contentLength =
    request.headers.get("content-length");

  if (
    contentLength &&
    (!/^\d+$/.test(contentLength) ||
      Number(contentLength) > MAX_WEBHOOK_BODY_SIZE)
  ) {
    return jsonResponse(
      { error: "Webhook payload is too large." },
      413,
    );
  }

  let rawBody: string;

  try {
    rawBody = await request.text();
  } catch {
    return jsonResponse(
      { error: "Unable to read webhook payload." },
      400,
    );
  }

  if (
    new TextEncoder().encode(rawBody).byteLength >
    MAX_WEBHOOK_BODY_SIZE
  ) {
    return jsonResponse(
      { error: "Webhook payload is too large." },
      413,
    );
  }

  let body: unknown;

  try {
    body = JSON.parse(rawBody);
  } catch {
    return jsonResponse(
      { error: "Invalid webhook payload." },
      400,
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body)
  ) {
    return jsonResponse(
      { error: "Invalid webhook payload." },
      400,
    );
  }

  try {
    const payload =
      body as Record<string, unknown>;

    const data =
      typeof payload.data === "object" &&
      payload.data !== null &&
      !Array.isArray(payload.data)
        ? payload.data as Record<string, unknown>
        : payload;

    const txRef =
      getString(data.tx_ref) ||
      getString(data.txRef);

    const transactionId =
      getNumber(data.id) ||
      getNumber(data.transaction_id);

    const reportedStatus =
      getString(data.status).toLowerCase();

    if (!txRef) {
      return jsonResponse({
        success: true,
        ignored: true,
        message: "Webhook has no transaction reference.",
      });
    }

    const admin = createAdminClient();
    const payment = await getPaymentByReference(
      admin,
      txRef,
    );

    if (!payment) {
      /*
       * A webhook for an unknown reference must not grant
       * access. Acknowledge it to avoid endless retries.
       */
      return jsonResponse({
        success: true,
        ignored: true,
        message: "Payment record not found.",
      });
    }

    /*
     * A previously successful payment can still need
     * enrollment recovery after a partial failure.
     */
    if (payment.status === "successful") {
      const enrollment = await fulfillSuccessfulPayment(
        admin,
        payment,
      );

      return jsonResponse({
        success: true,
        already_processed: true,
        payment_id: payment.id,
        enrollment_id: enrollment.id,
      });
    }

    /*
     * Never trust the webhook's reported status alone.
     * Verify successful payments directly with Flutterwave.
     * Non-success statuses do not grant course access.
     */
    if (
      reportedStatus === "failed" ||
      reportedStatus === "cancelled"
    ) {
      const nextStatus =
        reportedStatus === "cancelled"
          ? "cancelled"
          : "failed";

      const { error: statusError } = await admin
        .from("course_payments")
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id)
        .neq("status", "successful");

      if (statusError) {
        throw new Error(statusError.message);
      }

      return jsonResponse({
        success: true,
        processed: true,
        payment_id: payment.id,
        status: nextStatus,
      });
    }

    let verification: FlutterwaveVerification;

    try {
      verification = transactionId > 0
        ? await verifyFlutterwaveTransaction(
            String(transactionId),
          )
        : await verifyFlutterwaveByReference(
            payment.tx_ref,
          );
    } catch (error) {
      console.error(
        "Flutterwave transaction verification failed:",
        error,
      );

      /*
       * Keep the payment retryable. Do not grant access.
       */
      const { error: pendingError } = await admin
        .from("course_payments")
        .update({
          status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id)
        .neq("status", "successful");

      if (pendingError) {
        console.error(
          "Could not retain pending payment status:",
          pendingError.message,
        );
      }

      return jsonResponse({
        success: true,
        processed: false,
        pending: true,
        payment_id: payment.id,
        message:
          "Payment verification is temporarily unavailable.",
      });
    }

    const verifiedStatus =
      getString(verification.status).toLowerCase();

    const verifiedTxRef =
      getString(verification.txRef);

    const verifiedCurrency =
      getString(verification.currency).toUpperCase();

    const verifiedAmount =
      getNumber(verification.amount);

    if (verifiedStatus !== "successful") {
      const nextStatus: PaymentStatus =
        verifiedStatus === "cancelled"
          ? "cancelled"
          : verifiedStatus === "failed"
            ? "failed"
            : "pending";

      const { error: statusError } = await admin
        .from("course_payments")
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id)
        .neq("status", "successful");

      if (statusError) {
        throw new Error(statusError.message);
      }

      return jsonResponse({
        success: true,
        processed: false,
        payment_id: payment.id,
        status: nextStatus,
      });
    }

    if (verifiedTxRef !== payment.tx_ref) {
      console.error(
        "Flutterwave transaction reference mismatch.",
        { paymentId: payment.id },
      );

      return jsonResponse(
        { error: "Transaction reference mismatch." },
        409,
      );
    }

    if (
      verifiedCurrency !==
      payment.currency.trim().toUpperCase()
    ) {
      console.error(
        "Flutterwave transaction currency mismatch.",
        { paymentId: payment.id },
      );

      return jsonResponse(
        { error: "Transaction currency mismatch." },
        409,
      );
    }

    /*
     * Compare in currency minor units to avoid floating-point
     * equality problems. This assumes the stored amount and
     * Flutterwave's verified amount use the same currency unit.
     */
    const expectedMinor = Math.round(
      Number(payment.amount) * 100,
    );
    const receivedMinor = Math.round(
      verifiedAmount * 100,
    );

    if (
      !Number.isFinite(expectedMinor) ||
      expectedMinor <= 0 ||
      !Number.isFinite(receivedMinor) ||
      receivedMinor < expectedMinor
    ) {
      console.error(
        "Flutterwave transaction amount mismatch.",
        {
          paymentId: payment.id,
          expected: payment.amount,
          received: verifiedAmount,
        },
      );

      return jsonResponse(
        {
          error:
            "Verified transaction amount does not meet the required course amount.",
        },
        409,
      );
    }

    /*
     * Re-read the payment to avoid overwriting a completed
     * payment during concurrent webhook processing.
     */
    const latestPayment = await getPaymentByReference(
      admin,
      payment.tx_ref,
    );

    if (!latestPayment) {
      throw new Error(
        "Payment record disappeared during processing.",
      );
    }

    if (latestPayment.status === "successful") {
      const enrollment = await fulfillSuccessfulPayment(
        admin,
        latestPayment,
      );

      return jsonResponse({
        success: true,
        already_processed: true,
        payment_id: latestPayment.id,
        enrollment_id: enrollment.id,
      });
    }

    const updatedPayment = await markPaymentSuccessful(
      admin,
      latestPayment,
      verification,
    );

    /*
     * If enrollment or discount processing fails, return 500.
     * Flutterwave may retry; repeat processing repairs the
     * incomplete fulfilment.
     */
    const enrollment = await fulfillSuccessfulPayment(
      admin,
      updatedPayment,
    );

    return jsonResponse({
      success: true,
      processed: true,
      verified: true,
      payment_id: updatedPayment.id,
      enrollment_id: enrollment.id,
      transaction_id:
        updatedPayment.flutterwave_transaction_id,
    });
  } catch (error) {
    console.error(
      "Flutterwave webhook processing error:",
      error,
    );

    return jsonResponse(
      { error: "Webhook processing failed." },
      500,
    );
  }
}