import crypto from "crypto";
import {
  verifyFlutterwaveByReference,
  verifyFlutterwaveTransaction,
} from "@/lib/flutterwave";
import { createAdminClient } from "@/lib/supabase/admin";

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
  flutterwave_transaction_id:
    number | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
};

type WebhookPayload = {
  event?: unknown;
  data?: {
    id?: unknown;
    tx_ref?: unknown;
    status?: unknown;
  };
};

function json200(
  body: Record<string, unknown>
) {
  return new Response(
    JSON.stringify(body),
    {
      status: 200,
      headers: {
        "Content-Type":
          "application/json",
      },
    }
  );
}

function json500(
  message: string
) {
  return new Response(
    JSON.stringify({
      error: message,
    }),
    {
      status: 500,
      headers: {
        "Content-Type":
          "application/json",
      },
    }
  );
}

function verifyWebhookHash(
  receivedHash: string | null,
  configuredHash: string
): boolean {
  if (!receivedHash) {
    return false;
  }

  const received =
    Buffer.from(
      receivedHash.trim()
    );

  const configured =
    Buffer.from(
      configuredHash.trim()
    );

  if (
    received.length !==
    configured.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    received,
    configured
  );
}

function normalizeStatus(
  value: unknown
): string {
  return typeof value === "string"
    ? value
        .trim()
        .toLowerCase()
    : "";
}

function normalizeCurrency(
  value: unknown
): string {
  return typeof value === "string"
    ? value
        .trim()
        .toUpperCase()
    : "";
}

function parseTransactionId(
  value: unknown
): string {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return String(value);
  }

  if (typeof value === "string") {
    const trimmed =
      value.trim();

    return /^\d+$/.test(
      trimmed
    )
      ? trimmed
      : "";
  }

  return "";
}

async function createOrActivateEnrollment(
  admin: ReturnType<
    typeof createAdminClient
  >,
  payment: PaymentRecord
) {
  const {
    data: existingEnrollment,
    error: enrollmentLookupError,
  } =
    await admin
      .from("enrollments")
      .select(
        [
          "id",
          "enrollment_status",
          "payment_status",
          "progress_percent",
          "enrolled_at",
        ].join(", ")
      )
      .eq(
        "student_id",
        payment.student_id
      )
      .eq(
        "course_id",
        payment.course_id
      )
      .maybeSingle();

  if (enrollmentLookupError) {
    throw new Error(
      enrollmentLookupError.message
    );
  }

  if (existingEnrollment) {
    const enrollmentStatus =
      existingEnrollment.enrollment_status ===
      "completed"
        ? "completed"
        : "active";

    const {
      data: updatedEnrollment,
      error: updateError,
    } =
      await admin
        .from("enrollments")
        .update({
          payment_status:
            "paid",
          enrollment_status:
            enrollmentStatus,
        })
        .eq(
          "id",
          existingEnrollment.id
        )
        .select(
          [
            "id",
            "student_id",
            "course_id",
            "payment_status",
            "enrollment_status",
            "progress_percent",
            "enrolled_at",
          ].join(", ")
        )
        .single();

    if (updateError) {
      throw new Error(
        updateError.message
      );
    }

    return updatedEnrollment;
  }

  const {
    data: createdEnrollment,
    error: createError,
  } =
    await admin
      .from("enrollments")
      .insert({
        student_id:
          payment.student_id,
        course_id:
          payment.course_id,
        payment_status:
          "paid",
        enrollment_status:
          "active",
        progress_percent:
          0,
      })
      .select(
        [
          "id",
          "student_id",
          "course_id",
          "payment_status",
          "enrollment_status",
          "progress_percent",
          "enrolled_at",
        ].join(", ")
      )
      .single();

  if (createError) {
    if (
      createError.code ===
      "23505"
    ) {
      const {
        data:
          concurrentEnrollment,
        error:
          concurrentLookupError,
      } =
        await admin
          .from("enrollments")
          .select(
            [
              "id",
              "student_id",
              "course_id",
              "payment_status",
              "enrollment_status",
              "progress_percent",
              "enrolled_at",
            ].join(", ")
          )
          .eq(
            "student_id",
            payment.student_id
          )
          .eq(
            "course_id",
            payment.course_id
          )
          .maybeSingle();

      if (
        concurrentLookupError ||
        !concurrentEnrollment
      ) {
        throw new Error(
          concurrentLookupError?.message ||
            "The payment succeeded but the enrollment could not be confirmed."
        );
      }

      const {
        data:
          activatedConcurrentEnrollment,
        error:
          activateError,
      } =
        await admin
          .from("enrollments")
          .update({
            payment_status:
              "paid",
            enrollment_status:
              concurrentEnrollment.enrollment_status ===
              "completed"
                ? "completed"
                : "active",
          })
          .eq(
            "id",
            concurrentEnrollment.id
          )
          .select(
            [
              "id",
              "student_id",
              "course_id",
              "payment_status",
              "enrollment_status",
              "progress_percent",
              "enrolled_at",
            ].join(", ")
          )
          .single();

      if (activateError) {
        throw new Error(
          activateError.message
        );
      }

      return activatedConcurrentEnrollment;
    }

    throw new Error(
      createError.message
    );
  }

  return createdEnrollment;
}

async function markPaymentSuccessful(
  admin: ReturnType<
    typeof createAdminClient
  >,
  payment: PaymentRecord,
  transactionId: string
) {
  const transaction =
    transactionId
      ? await verifyFlutterwaveTransaction(
          transactionId
        )
      : await verifyFlutterwaveByReference(
          payment.tx_ref
        );

  if (
    transaction.txRef !==
    payment.tx_ref
  ) {
    throw new Error(
      "Verified transaction reference does not match the stored payment."
    );
  }

  if (
    transaction.status !==
    "successful"
  ) {
    throw new Error(
      "Flutterwave has not verified this transaction as successful."
    );
  }

  if (
    transaction.currency.toUpperCase() !==
    payment.currency.toUpperCase()
  ) {
    throw new Error(
      "Verified transaction currency does not match the stored payment."
    );
  }

  if (
    transaction.amount !==
    payment.amount
  ) {
    throw new Error(
      "Verified transaction amount does not exactly match the stored course price."
    );
  }

  const enrollment =
    await createOrActivateEnrollment(
      admin,
      payment
    );

  const {
    error: paymentUpdateError,
  } =
    await admin
      .from("course_payments")
      .update({
        status:
          "successful",
        flutterwave_transaction_id:
          transaction.id,
        verified_at:
          new Date().toISOString(),
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        payment.id
      );

  if (paymentUpdateError) {
    throw new Error(
      paymentUpdateError.message
    );
  }

  return enrollment;
}

export async function POST(
  request: Request
) {
  const configuredHash =
    process.env.FLW_WEBHOOK_HASH ??
    process.env.FLUTTERWAVE_WEBHOOK_HASH ??
    "";

  if (!configuredHash) {
    console.error(
      "Flutterwave webhook hash is not configured."
    );

    return json500(
      "Flutterwave webhook is not configured."
    );
  }

  const receivedHash =
    request.headers.get(
      "verif-hash"
    );

  if (
    !verifyWebhookHash(
      receivedHash,
      configuredHash
    )
  ) {
    return new Response(
      "Unauthorized",
      {
        status: 401,
      }
    );
  }

  let payload:
    | WebhookPayload
    | null = null;

  try {
    payload =
      (await request.json()) as WebhookPayload;
  } catch {
    return json200({
      received: true,
      ignored: true,
      reason:
        "Invalid JSON payload.",
    });
  }

  const txRef =
    typeof payload.data
      ?.tx_ref === "string"
      ? payload.data.tx_ref.trim()
      : "";

  const transactionId =
    parseTransactionId(
      payload.data?.id
    );

  const reportedStatus =
    normalizeStatus(
      payload.data?.status
    );

  if (!txRef) {
    return json200({
      received: true,
      ignored: true,
      reason:
        "No transaction reference.",
    });
  }

  const admin =
    createAdminClient();

  const {
    data: payment,
    error: paymentError,
  } =
    await admin
      .from("course_payments")
      .select(
        [
          "id",
          "student_id",
          "course_id",
          "course_slug",
          "tx_ref",
          "flutterwave_transaction_id",
          "amount",
          "currency",
          "status",
        ].join(", ")
      )
      .eq(
        "tx_ref",
        txRef
      )
      .maybeSingle<PaymentRecord>();

  if (
    paymentError ||
    !payment
  ) {
    console.error(
      "Flutterwave webhook payment lookup failed:",
      paymentError
    );

    /*
     * Acknowledge unknown references so unrelated
     * Flutterwave transactions do not cause retries.
     */
    return json200({
      received: true,
      ignored: true,
      reason:
        "Payment reference is not a RuffNeck Learn transaction.",
    });
  }

  /*
   * Idempotency:
   * Flutterwave may send the webhook more than once.
   * Once successful, do not create/update the
   * enrollment unnecessarily again.
   */
  if (
    payment.status ===
    "successful"
  ) {
    return json200({
      received: true,
      already_processed:
        true,
      course_id:
        payment.course_id,
    });
  }

  /*
   * Explicit non-success events update the payment
   * record but never grant access.
   */
  if (
    reportedStatus ===
      "cancelled" ||
    reportedStatus ===
      "canceled"
  ) {
    await admin
      .from("course_payments")
      .update({
        status:
          "cancelled",
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        payment.id
      );

    return json200({
      received: true,
      processed: true,
      successful: false,
      status:
        "cancelled",
    });
  }

  if (
    reportedStatus ===
      "failed"
  ) {
    await admin
      .from("course_payments")
      .update({
        status:
          "failed",
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        payment.id
      );

    return json200({
      received: true,
      processed: true,
      successful: false,
      status:
        "failed",
    });
  }

  /*
   * Pending transactions remain pending.
   * Do not create enrollment yet.
   */
  if (
    reportedStatus ===
      "pending" ||
    reportedStatus ===
      "processing"
  ) {
    await admin
      .from("course_payments")
      .update({
        status:
          "pending",
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        payment.id
      );

    return json200({
      received: true,
      processed: true,
      successful: false,
      status:
        "pending",
    });
  }

  /*
   * Only a successful webhook proceeds to verification.
   * We independently verify the transaction against
   * Flutterwave instead of trusting webhook payload data.
   */
  if (
    reportedStatus !==
    "successful"
  ) {
    return json200({
      received: true,
      ignored: true,
      reason:
        "Unrecognized transaction status.",
    });
  }

  try {
    const enrollment =
      await markPaymentSuccessful(
        admin,
        payment,
        transactionId
      );

    return json200({
      received: true,
      processed: true,
      successful: true,
      course_id:
        payment.course_id,
      enrollment_id:
        enrollment?.id ??
        null,
    });
  } catch (error) {
    console.error(
      "Flutterwave payment reconciliation failed:",
      error
    );

    /*
     * Do not mark a payment failed merely because
     * verification temporarily failed. Leaving it pending
     * allows the callback/webhook to be reconciled again.
     */
    await admin
      .from("course_payments")
      .update({
        status:
          "pending",
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        payment.id
      );

    return json200({
      received: true,
      processed: false,
      successful: false,
      status:
        "pending",
    });
  }
}