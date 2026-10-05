import {
  verifyFlutterwaveTransaction,
  verifyFlutterwaveByReference,
} from "@/lib/flutterwave";
import { createAdminClient } from "@/lib/supabase/admin";

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
  status: string;
};

type WebhookPayload = {
  event?: string;
  data?: {
    id?: unknown;
    tx_ref?: unknown;
    status?: unknown;
  };
};

const json200 = (
  body: Record<string, unknown>
) =>
  new Response(
    JSON.stringify(body),
    {
      status: 200,
      headers: {
        "Content-Type":
          "application/json",
      },
    }
  );

export async function POST(
  request: Request
) {
  const configuredHash =
    process.env.FLW_WEBHOOK_HASH ??
    process.env.FLUTTERWAVE_WEBHOOK_HASH;

  const receivedHash =
    request.headers.get(
      "verif-hash"
    );

  if (
    !configuredHash ||
    !receivedHash ||
    receivedHash !==
      configuredHash
  ) {
    return new Response(
      "Unauthorized",
      {
        status: 401,
      }
    );
  }

  let payload: WebhookPayload;

  try {
    payload =
      (await request.json()) as WebhookPayload;
  } catch {
    return json200({
      received: true,
      ignored: true,
    });
  }

  const txRef =
    typeof payload.data?.tx_ref ===
    "string"
      ? payload.data.tx_ref.trim()
      : "";

  const rawId =
    payload.data?.id;

  const transactionId =
    typeof rawId ===
      "number"
      ? String(rawId)
      : typeof rawId ===
        "string"
      ? rawId.trim()
      : "";

  if (!txRef) {
    return json200({
      received: true,
      ignored: true,
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
     * Acknowledge the webhook so Flutterwave does
     * not repeatedly retry a reference that belongs
     * to another product or an unknown transaction.
     */
    return json200({
      received: true,
      ignored: true,
    });
  }

  if (
    payment.status ===
      "successful"
  ) {
    return json200({
      received: true,
      already_processed:
        true,
    });
  }

  const reportedStatus =
    typeof payload.data?.status ===
    "string"
      ? payload.data.status
          .trim()
          .toLowerCase()
      : "";

  if (
    reportedStatus &&
    reportedStatus !==
      "successful"
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
    });
  }

  try {
    const verification =
      transactionId
        ? await verifyFlutterwaveTransaction(
            transactionId
          )
        : await verifyFlutterwaveByReference(
            txRef
          );

    if (
      verification.txRef !==
      payment.tx_ref ||
      verification.status !==
      "successful" ||
      verification.currency.toUpperCase() !==
        payment.currency.toUpperCase() ||
      verification.amount <
        payment.amount
    ) {
      throw new Error(
        "Verified Flutterwave transaction does not match the expected payment."
      );
    }

    const {
      data: existingEnrollment,
      error: existingError,
    } =
      await admin
        .from("enrollments")
        .select(
          "id, enrollment_status"
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

    if (existingError) {
      throw new Error(
        existingError.message
      );
    }

    if (existingEnrollment) {
      const {
        error:
          enrollmentUpdateError,
      } =
        await admin
          .from("enrollments")
          .update({
            payment_status:
              "paid",
            enrollment_status:
              existingEnrollment.enrollment_status ===
              "completed"
                ? "completed"
                : "active",
          })
          .eq(
            "id",
            existingEnrollment.id
          );

      if (
        enrollmentUpdateError
      ) {
        throw new Error(
          enrollmentUpdateError.message
        );
      }
    } else {
      const {
        error:
          enrollmentInsertError,
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
          });

      if (
        enrollmentInsertError &&
        enrollmentInsertError.code !==
          "23505"
      ) {
        throw new Error(
          enrollmentInsertError.message
        );
      }
    }

    const {
      error:
        paymentUpdateError,
    } =
      await admin
        .from("course_payments")
        .update({
          status:
            "successful",
          flutterwave_transaction_id:
            verification.id,
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

    return json200({
      received: true,
      processed: true,
      successful: true,
    });
  } catch (error) {
    console.error(
      "Flutterwave webhook processing failed:",
      error
    );

    /*
     * Acknowledge the webhook but do not grant access
     * when verification fails.
     */
    return json200({
      received: true,
      processed: false,
      successful: false,
    });
  }
}