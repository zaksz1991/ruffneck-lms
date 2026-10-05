import { NextResponse } from "next/server";
import {
  verifyFlutterwaveByReference,
  verifyFlutterwaveTransaction,
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

function redirectToCourse(
  request: Request,
  slug: string,
  result: "success" | "failed"
) {
  const url =
    new URL(
      `/courses/${slug}`,
      request.url
    );

  url.searchParams.set(
    "payment",
    result
  );

  return NextResponse.redirect(
    url
  );
}

async function fulfilPayment(
  payment: PaymentRecord,
  transactionId: string | null
) {
  const admin =
    createAdminClient();

  const verification =
    transactionId
      ? await verifyFlutterwaveTransaction(
          transactionId
        )
      : await verifyFlutterwaveByReference(
          payment.tx_ref
        );

  if (
    verification.status !==
    "successful"
  ) {
    throw new Error(
      "Flutterwave has not marked this transaction as successful."
    );
  }

  if (
    verification.txRef !==
    payment.tx_ref
  ) {
    throw new Error(
      "Flutterwave transaction reference does not match the payment record."
    );
  }

  if (
    verification.currency.toUpperCase() !==
    payment.currency.toUpperCase()
  ) {
    throw new Error(
      "Flutterwave payment currency does not match the course price."
    );
  }

  if (
    verification.amount <
    payment.amount
  ) {
    throw new Error(
      "The Flutterwave payment amount is less than the required course price."
    );
  }

  const {
    data: existingEnrollment,
    error: existingError,
  } =
    await admin
      .from("enrollments")
      .select(
        "id, enrollment_status, payment_status, progress_percent, enrolled_at"
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

  let enrollment;

  if (existingEnrollment) {
    const nextStatus =
      existingEnrollment.enrollment_status ===
      "completed"
        ? "completed"
        : "active";

    const {
      data,
      error,
    } =
      await admin
        .from("enrollments")
        .update({
          payment_status:
            "paid",
          enrollment_status:
            nextStatus,
        })
        .eq(
          "id",
          existingEnrollment.id
        )
        .select(
          "id, student_id, course_id, payment_status, enrollment_status, progress_percent, enrolled_at"
        )
        .single();

    if (error) {
      throw new Error(
        error.message
      );
    }

    enrollment = data;
  } else {
    const {
      data,
      error,
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
          "id, student_id, course_id, payment_status, enrollment_status, progress_percent, enrolled_at"
        )
        .single();

    if (error) {
      if (
        error.code ===
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
              "id, student_id, course_id, payment_status, enrollment_status, progress_percent, enrolled_at"
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
              "Payment succeeded but the enrollment could not be created."
          );
        }

        enrollment =
          concurrentEnrollment;
      } else {
        throw new Error(
          error.message
        );
      }
    } else {
      enrollment = data;
    }
  }

  const {
    error: paymentUpdateError,
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

  return enrollment;
}

export async function GET(
  request: Request
) {
  const url =
    new URL(
      request.url
    );

  const status =
    url.searchParams
      .get("status")
      ?.trim()
      .toLowerCase();

  const txRef =
    url.searchParams
      .get("tx_ref")
      ?.trim() || "";

  const transactionId =
    url.searchParams
      .get("transaction_id")
      ?.trim() || "";

  if (!txRef) {
    return NextResponse.redirect(
      new URL(
        "/courses?payment=failed",
        request.url
      )
    );
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
      "Flutterwave callback payment lookup failed:",
      paymentError
    );

    return NextResponse.redirect(
      new URL(
        "/courses?payment=failed",
        request.url
      )
    );
  }

  if (
    payment.status ===
    "successful"
  ) {
    return redirectToCourse(
      request,
      payment.course_slug,
      "success"
    );
  }

  if (
    status !==
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

    return redirectToCourse(
      request,
      payment.course_slug,
      "failed"
    );
  }

  try {
    await fulfilPayment(
      payment,
      transactionId ||
        null
    );

    return redirectToCourse(
      request,
      payment.course_slug,
      "success"
    );
  } catch (error) {
    console.error(
      "Flutterwave callback verification failed:",
      error
    );

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

    return redirectToCourse(
      request,
      payment.course_slug,
      "failed"
    );
  }
}