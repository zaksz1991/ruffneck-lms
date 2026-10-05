import crypto from "crypto";
import { verifyFlutterwaveByReference, verifyFlutterwaveTransaction } from "@/lib/flutterwave";
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
  flutterwave_transaction_id: number | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
};

type EnrollmentRecord = {
  id: string;
  enrollment_status: string;
  payment_status: string;
  progress_percent: number;
  enrolled_at: string;
};

type WebhookPayload = {
  event?: unknown;
  data?: {
    id?: unknown;
    tx_ref?: unknown;
    status?: unknown;
  };
};

function json200(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function json500(message: string) {
  return new Response(
    JSON.stringify({
      error: message,
    }),
    {
      status: 500,
      headers: {
        "Content-Type": "application/json",
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

  const received = Buffer.from(receivedHash.trim());
  const configured = Buffer.from(configuredHash.trim());

  if (received.length !== configured.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    received,
    configured
  );
}

function normalizeStatus(value: unknown): string {
  return typeof value === "string"
    ? value.trim().toLowerCase()
    : "";
}

function parseTransactionId(value: unknown): string {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return String(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    return /^\d+$/.test(trimmed)
      ? trimmed
      : "";
  }

  return "";
}

async function createOrActivateEnrollment(
  admin: ReturnType<typeof createAdminClient>,
  payment: PaymentRecord
): Promise<EnrollmentRecord> {
  const {
    data: existingEnrollmentData,
    error: enrollmentLookupError,
  } = await admin
    .from("enrollments")
    .select(
      "id, enrollment_status, payment_status, progress_percent, enrolled_at"
    )
    .eq("student_id", payment.student_id)
    .eq("course_id", payment.course_id)
    .maybeSingle();

  if (enrollmentLookupError) {
    throw new Error(
      enrollmentLookupError.message
    );
  }

  const existingEnrollment =
    existingEnrollmentData as unknown as EnrollmentRecord | null;

  if (existingEnrollment) {
    const enrollmentStatus =
      existingEnrollment.enrollment_status ===
      "completed"
        ? "completed"
        : "active";

    const {
      data: updatedEnrollmentData,
      error: updateError,
    } = await admin
      .from("enrollments")
      .update({
        payment_status: "paid",
        enrollment_status: enrollmentStatus,
      })
      .eq("id", existingEnrollment.id)
      .select(
        "id, enrollment_status, payment_status, progress_percent, enrolled_at"
      )
      .single();

    if (updateError) {
      throw new Error(updateError.message);
    }

    return updatedEnrollmentData as unknown as EnrollmentRecord;
  }

  const {
    data: createdEnrollmentData,
    error: createError,
  } = await admin
    .from("enrollments")
    .insert({
      student_id: payment.student_id,
      course_id: payment.course_id,
      payment_status: "paid",
      enrollment_status: "active",
      progress_percent: 0,
    })
    .select(
      "id, enrollment_status, payment_status, progress_percent, enrolled_at"
    )
    .single();

  if (createError) {
    if (createError.code === "23505") {
      const {
        data: concurrentEnrollmentData,
        error: concurrentLookupError,
      } = await admin
        .from("enrollments")
        .select(
          "id, enrollment_status, payment_status, progress_percent, enrolled_at"
        )
        .eq("student_id", payment.student_id)
        .eq("course_id", payment.course_id)
        .maybeSingle();

      if (
        concurrentLookupError ||
        !concurrentEnrollmentData
      ) {
        throw new Error(
          concurrentLookupError?.message ||
            "The payment succeeded but the enrollment could not be confirmed."
        );
      }

      const concurrentEnrollment =
        concurrentEnrollmentData as unknown as EnrollmentRecord;

      const {
        data: activatedEnrollmentData,
        error: activateError,
      } = await admin
        .from("enrollments")
        .update({
          payment_status: "paid",
          enrollment_status:
            concurrentEnrollment.enrollment_status ===
            "completed"
              ? "completed"
              : "active",
        })
        .eq("id", concurrentEnrollment.id)
        .select(
          "id, enrollment_status, payment_status, progress_percent, enrolled_at"
        )
        .single();

      if (activateError) {
        throw new Error(
          activateError.message
        );
      }

      return activatedEnrollmentData as unknown as EnrollmentRecord;
    }

    throw new Error(createError.message);
  }

  return createdEnrollmentData as unknown as EnrollmentRecord;
}

async function markPaymentSuccessful(
  admin: ReturnType<typeof createAdminClient>,
  payment: PaymentRecord,
  transactionId: string
) {
  const transaction = transactionId
    ? await verifyFlutterwaveTransaction(
        transactionId
      )
    : await verifyFlutterwaveByReference(
        payment.tx_ref
      );

  if (transaction.txRef !== payment.tx_ref) {
    throw new Error(
      "Verified transaction reference does not match the stored payment."
    );
  }

  if (transaction.status !== "successful") {
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

  if (transaction.amount !== payment.amount) {
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
  } = await admin
    .from("course_payments")
    .update({
      status: "successful",
      flutterwave_transaction_id:
        transaction.id,
      verified_at:
        new Date().toISOString(),
      updated_at:
        new Date().toISOString(),
    })
    .eq("id", payment.id);

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
    request.headers.get("verif-hash");

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

  let payload: WebhookPayload | null = null;

  try {
    payload =
      (await request.json()) as WebhookPayload;
  } catch {
    return json200({
      received: true,
      ignored: true,
      reason: "Invalid JSON payload.",
    });
  }

  const txRef =
    typeof payload.data?.tx_ref ===
    "string"
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
    data: paymentData,
    error: paymentError,
  } = await admin
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
    .eq("tx_ref", txRef)
    .maybeSingle();

  if (paymentError) {
    console.error(
      "Flutterwave webhook payment lookup failed:",
      paymentError
    );

    return json200({
      received: true,
      ignored: true,
      reason:
        "Payment lookup failed.",
    });
  }

  const payment =
    paymentData as unknown as PaymentRecord | null;

  if (!payment) {
    return json200({
      received: true,
      ignored: true,
      reason:
        "Payment reference is not a RuffNeck Learn transaction.",
    });
  }

  if (payment.status === "successful") {
    return json200({
      received: true,
      already_processed: true,
      course_id: payment.course_id,
    });
  }

  if (
    reportedStatus === "cancelled" ||
    reportedStatus === "canceled"
  ) {
    await admin
      .from("course_payments")
      .update({
        status: "cancelled",
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", payment.id);

    return json200({
      received: true,
      processed: true,
      successful: false,
      status: "cancelled",
    });
  }

  if (reportedStatus === "failed") {
    await admin
      .from("course_payments")
      .update({
        status: "failed",
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", payment.id);

    return json200({
      received: true,
      processed: true,
      successful: false,
      status: "failed",
    });
  }

  if (
    reportedStatus === "pending" ||
    reportedStatus === "processing"
  ) {
    await admin
      .from("course_payments")
      .update({
        status: "pending",
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", payment.id);

    return json200({
      received: true,
      processed: true,
      successful: false,
      status: "pending",
    });
  }

  if (reportedStatus !== "successful") {
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
        enrollment?.id ?? null,
    });
  } catch (error) {
    console.error(
      "Flutterwave payment reconciliation failed:",
      error
    );

    await admin
      .from("course_payments")
      .update({
        status: "pending",
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", payment.id);

    return json200({
      received: true,
      processed: false,
      successful: false,
      status: "pending",
    });
  }
}