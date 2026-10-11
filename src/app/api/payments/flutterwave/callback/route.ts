import { NextResponse } from "next/server";
import {
  verifyFlutterwaveByReference,
  verifyFlutterwaveTransaction,
} from "@/lib/flutterwave";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type PaymentRecord = {
  id: string;
  student_id: string;
  course_id: string;
  course_slug: string;
  tx_ref: string;
  flutterwave_transaction_id: number | null;
  amount: number;
  currency: string;
  status: string;
  original_amount: number | null;
  discount_code_id: string | null;
  discount_amount: number;
};

type EnrollmentRecord = {
  id: string;
  student_id: string;
  course_id: string;
  payment_status: string;
  enrollment_status: string;
  progress_percent: number | null;
  enrolled_at: string | null;
};

type FlutterwaveVerification = {
  id: number;
  txRef: string;
  amount: number;
  currency: string;
  status: string;
  flwRef: string | null;
};

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
  "id, student_id, course_id, payment_status, enrollment_status, progress_percent, enrolled_at";

function redirectToCourse(
  request: Request,
  slug: string,
  result: "success" | "failed",
) {
  const url = new URL(
    `/courses/${encodeURIComponent(slug)}`,
    request.url,
  );

  url.searchParams.set("payment", result);

  return NextResponse.redirect(url);
}

async function getPaymentByReference(
  txRef: string,
): Promise<PaymentRecord | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("course_payments")
    .select(PAYMENT_COLUMNS)
    .eq("tx_ref", txRef)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as PaymentRecord | null;
}

async function activateEnrollment(
  payment: PaymentRecord,
): Promise<EnrollmentRecord> {
  const admin = createAdminClient();

  const { data: existing, error: lookupError } = await admin
    .from("enrollments")
    .select(ENROLLMENT_COLUMNS)
    .eq("student_id", payment.student_id)
    .eq("course_id", payment.course_id)
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  if (existing) {
    const enrollment = existing as EnrollmentRecord;

    if (
      enrollment.payment_status === "paid" &&
      ["active", "completed"].includes(
        enrollment.enrollment_status,
      )
    ) {
      return enrollment;
    }

    const { data, error } = await admin
      .from("enrollments")
      .update({
        payment_status: "paid",
        enrollment_status:
          enrollment.enrollment_status === "completed"
            ? "completed"
            : "active",
      })
      .eq("id", enrollment.id)
      .select(ENROLLMENT_COLUMNS)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data as EnrollmentRecord;
  }

  const { data: created, error: insertError } = await admin
    .from("enrollments")
    .insert({
      student_id: payment.student_id,
      course_id: payment.course_id,
      payment_status: "paid",
      enrollment_status: "active",
      progress_percent: 0,
    })
    .select(ENROLLMENT_COLUMNS)
    .single();

  if (!insertError && created) {
    return created as EnrollmentRecord;
  }

  if (insertError?.code !== "23505") {
    throw new Error(
      insertError?.message ??
        "Enrollment could not be created.",
    );
  }

  // Another callback may have inserted the enrollment concurrently.
  const { data: concurrent, error: concurrentError } =
    await admin
      .from("enrollments")
      .select(ENROLLMENT_COLUMNS)
      .eq("student_id", payment.student_id)
      .eq("course_id", payment.course_id)
      .maybeSingle();

  if (concurrentError || !concurrent) {
    throw new Error(
      concurrentError?.message ??
        "Enrollment could not be recovered.",
    );
  }

  const enrollment = concurrent as EnrollmentRecord;

  if (
    enrollment.payment_status === "paid" &&
    ["active", "completed"].includes(
      enrollment.enrollment_status,
    )
  ) {
    return enrollment;
  }

  const { data: updated, error: updateError } = await admin
    .from("enrollments")
    .update({
      payment_status: "paid",
      enrollment_status:
        enrollment.enrollment_status === "completed"
          ? "completed"
          : "active",
    })
    .eq("id", enrollment.id)
    .select(ENROLLMENT_COLUMNS)
    .single();

  if (updateError) {
    throw new Error(updateError.message);
  }

  return updated as EnrollmentRecord;
}

async function markPaymentSuccessful(
  payment: PaymentRecord,
  verification: FlutterwaveVerification,
): Promise<PaymentRecord> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("course_payments")
    .update({
      status: "successful",
      flutterwave_transaction_id:
        verification.id > 0
          ? verification.id
          : payment.flutterwave_transaction_id,
      verified_at: now,
      updated_at: now,
    })
    .eq("id", payment.id)
    .neq("status", "successful")
    .select(PAYMENT_COLUMNS)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (data) {
    return data as PaymentRecord;
  }

  const latest = await getPaymentByReference(payment.tx_ref);

  if (!latest || latest.status !== "successful") {
    throw new Error(
      "The successful payment status could not be confirmed.",
    );
  }

  return latest;
}

async function recordDiscountRedemption(
  payment: PaymentRecord,
): Promise<void> {
  if (
    !payment.discount_code_id ||
    payment.discount_amount <= 0
  ) {
    return;
  }

  const admin = createAdminClient();

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
      `Discount redemption processing failed: ${error.message}`,
    );
  }
}

async function verifyPayment(
  payment: PaymentRecord,
  transactionId: string | null,
): Promise<FlutterwaveVerification> {
  const verification = transactionId
    ? await verifyFlutterwaveTransaction(transactionId)
    : await verifyFlutterwaveByReference(payment.tx_ref);

  if (
    verification.status.trim().toLowerCase() !== "successful"
  ) {
    throw new Error(
      "Flutterwave has not confirmed a successful payment.",
    );
  }

  if (verification.txRef !== payment.tx_ref) {
    throw new Error(
      "Flutterwave transaction reference mismatch.",
    );
  }

  if (
    verification.currency.trim().toUpperCase() !==
    payment.currency.trim().toUpperCase()
  ) {
    throw new Error(
      "Flutterwave transaction currency mismatch.",
    );
  }

  const expected = Number(payment.amount);
  const received = Number(verification.amount);

  // Require the exact expected amount, not an overpayment.
  if (
    !Number.isFinite(expected) ||
    expected <= 0 ||
    !Number.isFinite(received) ||
    received !== expected
  ) {
    throw new Error(
      "Flutterwave transaction amount mismatch.",
    );
  }

  return verification;
}

async function fulfilPayment(
  payment: PaymentRecord,
  transactionId: string | null,
): Promise<void> {
  const verification = await verifyPayment(
    payment,
    transactionId,
  );

  const updatedPayment = await markPaymentSuccessful(
    payment,
    verification,
  );

  await activateEnrollment(updatedPayment);
  await recordDiscountRedemption(updatedPayment);
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  const txRef = url.searchParams.get("tx_ref")?.trim() ?? "";

  const transactionId =
    url.searchParams.get("transaction_id")?.trim() ?? "";

  if (!txRef) {
    return NextResponse.redirect(
      new URL("/courses?payment=failed", request.url),
    );
  }

  let payment: PaymentRecord | null;

  try {
    payment = await getPaymentByReference(txRef);
  } catch (error) {
    console.error("Payment lookup failed:", error);

    return NextResponse.redirect(
      new URL("/courses?payment=failed", request.url),
    );
  }

  if (!payment) {
    return NextResponse.redirect(
      new URL("/courses?payment=failed", request.url),
    );
  }

  /*
   * Recover enrollment and discount processing for payments
   * already confirmed as successful in the database.
   */
  if (payment.status === "successful") {
    try {
      await activateEnrollment(payment);
      await recordDiscountRedemption(payment);

      return redirectToCourse(
        request,
        payment.course_slug,
        "success",
      );
    } catch (error) {
      console.error(
        "Successful payment recovery failed:",
        error,
      );

      return redirectToCourse(
        request,
        payment.course_slug,
        "failed",
      );
    }
  }

  try {
    await fulfilPayment(payment, transactionId || null);

    return redirectToCourse(
      request,
      payment.course_slug,
      "success",
    );
  } catch (error) {
    console.error(
      "Flutterwave callback processing failed:",
      error,
    );

    /*
     * Preserve successful status if a concurrent callback finished
     * while this request was processing.
     */
    const latest = await getPaymentByReference(txRef).catch(
      () => null,
    );

    if (latest?.status === "successful") {
      try {
        await activateEnrollment(latest);
        await recordDiscountRedemption(latest);

        return redirectToCourse(
          request,
          latest.course_slug,
          "success",
        );
      } catch (recoveryError) {
        console.error(
          "Payment fulfilment recovery failed:",
          recoveryError,
        );
      }
    }

    /*
     * Do not mark the payment failed based solely on a callback.
     * Verification or network errors may be temporary.
     */
    return redirectToCourse(
      request,
      payment.course_slug,
      "failed",
    );
  }
}