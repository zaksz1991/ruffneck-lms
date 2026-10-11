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

  return Number.isFinite(number) ? number : 0;
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

  if (error) throw new Error(error.message);

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

  if (error) throw new Error(error.message);

  const existing = data as EnrollmentRecord | null;

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

    if (updateError) throw new Error(updateError.message);

    return updated as EnrollmentRecord;
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

  if (!createError) return created as EnrollmentRecord;

  if (createError.code !== "23505") {
    throw new Error(createError.message);
  }

  // Recover an enrollment created by a concurrent request.
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

  const enrollment = retry as EnrollmentRecord;

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

  if (activateError) throw new Error(activateError.message);

  return activated as EnrollmentRecord;
}

async function markPaymentSuccessful(
  admin: ReturnType<typeof createAdminClient>,
  payment: PaymentRecord,
  verification: FlutterwaveVerification,
): Promise<PaymentRecord> {
  const now = new Date().toISOString();

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

  if (error) throw new Error(error.message);

  if (data) return data as unknown as PaymentRecord;

  const latest = await getPaymentByReference(admin, payment.tx_ref);

  if (!latest || latest.status !== "successful") {
    throw new Error(
      "The payment status could not be confirmed after verification.",
    );
  }

  return latest;
}

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

  const originalAmount =
    payment.original_amount ??
    payment.amount + payment.discount_amount;

  const { error } = await admin.rpc(
    "record_discount_redemption",
    {
      p_discount_code_id: payment.discount_code_id,
      p_student_id: payment.student_id,
      p_course_id: payment.course_id,
      p_payment_id: payment.id,
      p_amount_before_discount: Math.round(originalAmount),
      p_discount_amount: Math.round(payment.discount_amount),
      p_amount_paid: Math.round(payment.amount),
    },
  );

  if (error) {
    throw new Error(
      `Unable to record discount redemption: ${error.message}`,
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
    console.error("Flutterwave webhook hash is not configured.");

    return jsonResponse(
      { error: "Webhook configuration error." },
      500,
    );
  }

  if (!constantTimeEqual(getWebhookHash(request), secret)) {
    return jsonResponse(
      { error: "Invalid webhook signature." },
      401,
    );
  }

  const contentLength = request.headers.get("content-length");

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
    const payload = body as Record<string, unknown>;

    const data =
      typeof payload.data === "object" &&
      payload.data !== null &&
      !Array.isArray(payload.data)
        ? (payload.data as Record<string, unknown>)
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
    const payment = await getPaymentByReference(admin, txRef);

    if (!payment) {
      return jsonResponse({
        success: true,
        ignored: true,
        message: "Payment record not found.",
      });
    }

    /*
     * Successful payments can be retried to repair incomplete
     * enrollment or discount-redemption processing.
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
     * Verify the transaction directly with Flutterwave.
     */
    let verification: FlutterwaveVerification;

    try {
      verification =
        transactionId > 0
          ? await verifyFlutterwaveTransaction(
              String(transactionId),
            )
          : await verifyFlutterwaveByReference(payment.tx_ref);
    } catch (error) {
      console.error("Flutterwave verification failed:", error);

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

      if (statusError) throw new Error(statusError.message);

      return jsonResponse({
        success: true,
        processed: false,
        payment_id: payment.id,
        status: nextStatus,
      });
    }

    if (getString(verification.txRef) !== payment.tx_ref) {
      console.error("Flutterwave transaction reference mismatch.", {
        paymentId: payment.id,
      });

      return jsonResponse(
        { error: "Transaction reference mismatch." },
        409,
      );
    }

    if (
      getString(verification.currency).toUpperCase() !==
      payment.currency.trim().toUpperCase()
    ) {
      console.error("Flutterwave transaction currency mismatch.", {
        paymentId: payment.id,
      });

      return jsonResponse(
        { error: "Transaction currency mismatch." },
        409,
      );
    }

    /*
     * Require the verified amount to match the recorded payment
     * amount exactly, including any applied discount.
     */
    const expectedAmount = Number(payment.amount);
    const receivedAmount = Number(verification.amount);

    if (
      !Number.isFinite(expectedAmount) ||
      expectedAmount <= 0 ||
      !Number.isFinite(receivedAmount) ||
      receivedAmount !== expectedAmount
    ) {
      console.error("Flutterwave transaction amount mismatch.", {
        paymentId: payment.id,
        expected: payment.amount,
        received: verification.amount,
      });

      return jsonResponse(
        { error: "Verified transaction amount mismatch." },
        409,
      );
    }

    const latestPayment = await getPaymentByReference(
      admin,
      payment.tx_ref,
    );

    if (!latestPayment) {
      throw new Error("Payment record disappeared during processing.");
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
      transaction_id: updatedPayment.flutterwave_transaction_id,
    });
  } catch (error) {
    console.error("Flutterwave webhook processing error:", error);

    return jsonResponse(
      { error: "Webhook processing failed." },
      500,
    );
  }
}