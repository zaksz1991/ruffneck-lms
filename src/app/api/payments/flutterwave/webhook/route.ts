import { NextResponse } from "next/server";
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

type FlutterwaveVerification = {
  id: number;
  txRef: string;
  amount: number;
  currency: string;
  status: string;
  flwRef: string | null;
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(body, { status });
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

function getString(
  value: unknown,
) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function getNumber(
  value: unknown,
) {
  const number = Number(value);
  return Number.isFinite(number)
    ? number
    : 0;
}

async function getPaymentByReference(
  admin: ReturnType<typeof createAdminClient>,
  txRef: string,
) {
  const {
    data,
    error,
  } = await admin
    .from("course_payments")
    .select(
      "id, student_id, course_id, course_slug, tx_ref, flutterwave_transaction_id, amount, currency, status",
    )
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
) {
  const {
    data: existingData,
    error: existingError,
  } = await admin
    .from("enrollments")
    .select(
      "id, enrollment_status, payment_status, progress_percent, enrolled_at",
    )
    .eq("student_id", payment.student_id)
    .eq("course_id", payment.course_id)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  const existingEnrollment =
    existingData as unknown as EnrollmentRecord | null;

  if (existingEnrollment) {
    if (
      existingEnrollment.enrollment_status ===
        "active" &&
      existingEnrollment.payment_status ===
        "paid"
    ) {
      return existingEnrollment;
    }

    const {
      data: updatedData,
      error: updateError,
    } = await admin
      .from("enrollments")
      .update({
        enrollment_status: "active",
        payment_status: "paid",
      })
      .eq("id", existingEnrollment.id)
      .select(
        "id, enrollment_status, payment_status, progress_percent, enrolled_at",
      )
      .single();

    if (updateError) {
      throw new Error(updateError.message);
    }

    return updatedData as unknown as EnrollmentRecord;
  }

  const {
    data: createdData,
    error: createError,
  } = await admin
    .from("enrollments")
    .insert({
      student_id: payment.student_id,
      course_id: payment.course_id,
      enrollment_status: "active",
      payment_status: "paid",
      progress_percent: 0,
    })
    .select(
      "id, enrollment_status, payment_status, progress_percent, enrolled_at",
    )
    .single();

  if (createError) {
    if (
      createError.code === "23505"
    ) {
      const {
        data: retryData,
        error: retryError,
      } = await admin
        .from("enrollments")
        .select(
          "id, enrollment_status, payment_status, progress_percent, enrolled_at",
        )
        .eq("student_id", payment.student_id)
        .eq("course_id", payment.course_id)
        .maybeSingle();

      if (retryError) {
        throw new Error(
          retryError.message,
        );
      }

      if (!retryData) {
        throw new Error(
          "Enrollment already exists but could not be retrieved.",
        );
      }

      return retryData as unknown as EnrollmentRecord;
    }

    throw new Error(createError.message);
  }

  return createdData as unknown as EnrollmentRecord;
}

async function markPaymentSuccessful(
  admin: ReturnType<typeof createAdminClient>,
  payment: PaymentRecord,
  verification: FlutterwaveVerification,
) {
  const transactionId =
    Number(verification.id) > 0
      ? Number(verification.id)
      : payment.flutterwave_transaction_id;

  const now =
    new Date().toISOString();

  const {
    data: updatedData,
    error: updateError,
  } = await admin
    .from("course_payments")
    .update({
      status: "successful",
      flutterwave_transaction_id:
        transactionId,
      updated_at: now,
      verified_at: now,
    })
    .eq("id", payment.id)
    .select(
      "id, student_id, course_id, course_slug, tx_ref, flutterwave_transaction_id, amount, currency, status",
    )
    .single();

  if (updateError) {
    throw new Error(
      updateError.message,
    );
  }

  return updatedData as unknown as PaymentRecord;
}

export async function POST(
  request: Request,
) {
  const webhookSecret =
    getWebhookSecret();

  if (!webhookSecret) {
    console.error(
      "Flutterwave webhook secret is not configured.",
    );

    return jsonResponse(
      {
        error:
          "Webhook configuration error.",
      },
      500,
    );
  }

  const providedHash =
    getWebhookHash(request);

  if (
    !providedHash ||
    providedHash !== webhookSecret
  ) {
    return jsonResponse(
      {
        error: "Invalid webhook signature.",
      },
      401,
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      {
        error: "Invalid webhook payload.",
      },
      400,
    );
  }

  try {
    const payload =
      typeof body === "object" &&
      body !== null
        ? (body as Record<
            string,
            unknown
          >)
        : {};

    const data =
      typeof payload.data === "object" &&
      payload.data !== null
        ? (payload.data as Record<
            string,
            unknown
          >)
        : payload;

    const txRef =
      getString(
        data.tx_ref,
      ) ||
      getString(
        data.txRef,
      );

    const transactionId =
      getNumber(
        data.id,
      ) ||
      getNumber(
        data.transaction_id,
      );

    const reportedStatus =
      getString(
        data.status,
      ).toLowerCase();

    if (!txRef) {
      return jsonResponse({
        success: true,
        ignored: true,
        message:
          "Webhook received without a transaction reference.",
      });
    }

    const admin =
      createAdminClient();

    const payment =
      await getPaymentByReference(
        admin,
        txRef,
      );

    if (!payment) {
      return jsonResponse({
        success: true,
        ignored: true,
        message:
          "Payment record not found.",
      });
    }

    /*
     * Idempotency:
     * Flutterwave may deliver the same webhook more
     * than once. Once our database has a successful
     * payment, do not perform another payment update
     * or attempt another enrollment creation.
     */
    if (
      payment.status ===
      "successful"
    ) {
      const enrollment =
        await createOrActivateEnrollment(
          admin,
          payment,
        );

      return jsonResponse({
        success: true,
        already_processed: true,
        payment_id: payment.id,
        enrollment_id:
          enrollment.id,
      });
    }

    /*
     * A webhook reporting a failed/cancelled
     * transaction must never grant course access.
     */
    if (
      reportedStatus ===
        "failed" ||
      reportedStatus ===
        "cancelled"
    ) {
      await admin
        .from("course_payments")
        .update({
          status:
            reportedStatus ===
            "cancelled"
              ? "cancelled"
              : "failed",
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", payment.id)
        .neq(
          "status",
          "successful",
        );

      return jsonResponse({
        success: true,
        processed: true,
        payment_id: payment.id,
        status:
          reportedStatus,
      });
    }

    let verification:
      | FlutterwaveVerification
      | null = null;

    try {
      if (
        transactionId > 0
      ) {
        verification =
          (await verifyFlutterwaveTransaction(
            String(
              transactionId,
            ),
          )) as FlutterwaveVerification;
      } else {
        verification =
          (await verifyFlutterwaveByReference(
            payment.tx_ref,
          )) as FlutterwaveVerification;
      }
    } catch (error) {
      console.error(
        "Flutterwave webhook verification failed:",
        error,
      );

      await admin
        .from("course_payments")
        .update({
          status: "pending",
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", payment.id)
        .neq(
          "status",
          "successful",
        );

      /*
       * Return 200 so Flutterwave does not repeatedly
       * deliver the same event while the payment remains
       * pending and can be reconciled from Admin.
       */
      return jsonResponse({
        success: true,
        processed: false,
        pending: true,
        payment_id: payment.id,
        message:
          "Payment received but could not yet be verified.",
      });
    }

    const verifiedStatus =
      getString(
        verification.status,
      ).toLowerCase();

    const verifiedTxRef =
      getString(
        verification.txRef,
      );

    const verifiedCurrency =
      getString(
        verification.currency,
      ).toUpperCase();

    const verifiedAmount =
      getNumber(
        verification.amount,
      );

    if (
      verifiedStatus !==
      "successful"
    ) {
      await admin
        .from("course_payments")
        .update({
          status:
            verifiedStatus ===
            "cancelled"
              ? "cancelled"
              : "pending",
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", payment.id)
        .neq(
          "status",
          "successful",
        );

      return jsonResponse({
        success: true,
        processed: false,
        payment_id: payment.id,
        status:
          verifiedStatus ||
          "unknown",
      });
    }

    if (
      verifiedTxRef !==
      payment.tx_ref
    ) {
      console.error(
        "Flutterwave webhook tx_ref mismatch.",
        {
          expected:
            payment.tx_ref,
          received:
            verifiedTxRef,
        },
      );

      return jsonResponse(
        {
          error:
            "Transaction reference mismatch.",
        },
        409,
      );
    }

    if (
      verifiedCurrency !==
      payment.currency
        .trim()
        .toUpperCase()
    ) {
      console.error(
        "Flutterwave webhook currency mismatch.",
        {
          expected:
            payment.currency,
          received:
            verifiedCurrency,
        },
      );

      return jsonResponse(
        {
          error:
            "Transaction currency mismatch.",
        },
        409,
      );
    }

    if (
      verifiedAmount <
      Number(payment.amount)
    ) {
      console.error(
        "Flutterwave webhook amount mismatch.",
        {
          expected:
            payment.amount,
          received:
            verifiedAmount,
        },
      );

      return jsonResponse(
        {
          error:
            "Transaction amount is below the required course amount.",
        },
        409,
      );
    }

    /*
     * Re-read the payment immediately before granting
     * access. This protects against a second webhook
     * being processed concurrently.
     */
    const latestPayment =
      await getPaymentByReference(
        admin,
        payment.tx_ref,
      );

    if (!latestPayment) {
      return jsonResponse(
        {
          error:
            "Payment record disappeared during processing.",
        },
        500,
      );
    }

    if (
      latestPayment.status ===
      "successful"
    ) {
      const enrollment =
        await createOrActivateEnrollment(
          admin,
          latestPayment,
        );

      return jsonResponse({
        success: true,
        already_processed: true,
        payment_id:
          latestPayment.id,
        enrollment_id:
          enrollment.id,
      });
    }

    const enrollment =
      await createOrActivateEnrollment(
        admin,
        latestPayment,
      );

    const updatedPayment =
      await markPaymentSuccessful(
        admin,
        latestPayment,
        verification,
      );

    return jsonResponse({
      success: true,
      processed: true,
      verified: true,
      payment_id:
        updatedPayment.id,
      enrollment_id:
        enrollment.id,
      transaction_id:
        updatedPayment.flutterwave_transaction_id,
    });
  } catch (error) {
    console.error(
      "Flutterwave webhook processing error:",
      error,
    );

    /*
     * Do not expose internal database or payment details
     * to the webhook sender.
     */
    return jsonResponse(
      {
        error:
          "Webhook processing failed.",
      },
      500,
    );
  }
}