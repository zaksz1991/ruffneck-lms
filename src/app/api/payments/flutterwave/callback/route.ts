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

function redirectToCourse(
  request: Request,
  slug: string,
  result: "success" | "failed"
) {
  const url = new URL(`/courses/${slug}`, request.url);

  url.searchParams.set("payment", result);

  return NextResponse.redirect(url);
}

async function activateEnrollment(
  payment: PaymentRecord
): Promise<EnrollmentRecord> {
  const admin = createAdminClient();

  const {
    data: existingEnrollment,
    error: existingError,
  } = await admin
    .from("enrollments")
    .select(
      "id, student_id, course_id, payment_status, enrollment_status, progress_percent, enrolled_at"
    )
    .eq("student_id", payment.student_id)
    .eq("course_id", payment.course_id)
    .maybeSingle<EnrollmentRecord>();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existingEnrollment) {
    const nextStatus =
      existingEnrollment.enrollment_status === "completed"
        ? "completed"
        : "active";

    const {
      data,
      error,
    } = await admin
      .from("enrollments")
      .update({
        payment_status: "paid",
        enrollment_status: nextStatus,
      })
      .eq("id", existingEnrollment.id)
      .select(
        "id, student_id, course_id, payment_status, enrollment_status, progress_percent, enrolled_at"
      )
      .single<EnrollmentRecord>();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  const {
    data,
    error,
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
      "id, student_id, course_id, payment_status, enrollment_status, progress_percent, enrolled_at"
    )
    .single<EnrollmentRecord>();

  if (!error && data) {
    return data;
  }

  if (error?.code === "23505") {
    const {
      data: concurrentEnrollment,
      error: concurrentLookupError,
    } = await admin
      .from("enrollments")
      .select(
        "id, student_id, course_id, payment_status, enrollment_status, progress_percent, enrolled_at"
      )
      .eq("student_id", payment.student_id)
      .eq("course_id", payment.course_id)
      .maybeSingle<EnrollmentRecord>();

    if (concurrentLookupError || !concurrentEnrollment) {
      throw new Error(
        concurrentLookupError?.message ||
          "Payment succeeded but the enrollment could not be created."
      );
    }

    if (
      concurrentEnrollment.payment_status !== "paid" ||
      concurrentEnrollment.enrollment_status === "pending"
    ) {
      const nextStatus =
        concurrentEnrollment.enrollment_status === "completed"
          ? "completed"
          : "active";

      const {
        data: updatedConcurrentEnrollment,
        error: updateConcurrentError,
      } = await admin
        .from("enrollments")
        .update({
          payment_status: "paid",
          enrollment_status: nextStatus,
        })
        .eq("id", concurrentEnrollment.id)
        .select(
          "id, student_id, course_id, payment_status, enrollment_status, progress_percent, enrolled_at"
        )
        .single<EnrollmentRecord>();

      if (updateConcurrentError) {
        throw new Error(updateConcurrentError.message);
      }

      return updatedConcurrentEnrollment;
    }

    return concurrentEnrollment;
  }

  throw new Error(
    error?.message ||
      "Payment succeeded but the enrollment could not be created."
  );
}

async function markPaymentSuccessful(
  payment: PaymentRecord,
  verificationId: number
) {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const {
    error,
  } = await admin
    .from("course_payments")
    .update({
      status: "successful",
      flutterwave_transaction_id: verificationId,
      verified_at: now,
      updated_at: now,
    })
    .eq("id", payment.id);

  if (error) {
    throw new Error(
      `Payment verification succeeded, but the payment record could not be updated: ${error.message}`
    );
  }
}

/**
 * Records a successful coupon redemption exactly once.
 *
 * The unique index on:
 *   (discount_code_id, student_id)
 *
 * prevents repeated Flutterwave callbacks from creating duplicate
 * redemption records or incrementing usage more than once.
 */
async function recordDiscountRedemption(
  payment: PaymentRecord
) {
  if (
    !payment.discount_code_id ||
    payment.discount_amount <= 0
  ) {
    return;
  }

  const admin = createAdminClient();

  const {
    data: existingRedemption,
    error: existingRedemptionError,
  } = await admin
    .from("course_discount_redemptions")
    .select("id")
    .eq(
      "discount_code_id",
      payment.discount_code_id
    )
    .eq("student_id", payment.student_id)
    .maybeSingle<{ id: string }>();

  if (existingRedemptionError) {
    throw new Error(
      `Unable to check discount redemption: ${existingRedemptionError.message}`
    );
  }

  if (existingRedemption) {
    return;
  }

  const originalAmount =
    payment.original_amount ??
    payment.amount + payment.discount_amount;

  const {
    data: redemption,
    error: redemptionError,
  } = await admin
    .from("course_discount_redemptions")
    .insert({
      discount_code_id:
        payment.discount_code_id,
      student_id: payment.student_id,
      course_id: payment.course_id,
      payment_id: payment.id,
      amount_before_discount: originalAmount,
      discount_amount: payment.discount_amount,
      amount_paid: payment.amount,
    })
    .select("id")
    .single<{ id: string }>();

  if (!redemptionError && redemption) {
    const {
      data: discount,
      error: discountLookupError,
    } = await admin
      .from("course_discount_codes")
      .select("usage_count, usage_limit")
      .eq(
        "id",
        payment.discount_code_id
      )
      .single<{
        usage_count: number;
        usage_limit: number | null;
      }>();

    if (discountLookupError || !discount) {
      throw new Error(
        discountLookupError?.message ||
          "Discount redemption was recorded but the discount code could not be updated."
      );
    }

    const nextUsageCount =
      discount.usage_count + 1;

    const {
      error: usageUpdateError,
    } = await admin
      .from("course_discount_codes")
      .update({
        usage_count: nextUsageCount,
        updated_at: new Date().toISOString(),
      })
      .eq(
        "id",
        payment.discount_code_id
      );

    if (usageUpdateError) {
      throw new Error(
        `Discount redemption was recorded but usage count could not be updated: ${usageUpdateError.message}`
      );
    }

    return;
  }

  /*
   * Another callback may have inserted the redemption
   * between our existence check and insert.
   *
   * The unique constraint makes that safe.
   */
  if (redemptionError?.code === "23505") {
    return;
  }

  throw new Error(
    redemptionError?.message ||
      "The discount redemption could not be recorded."
  );
}

async function fulfilPayment(
  payment: PaymentRecord,
  transactionId: string | null
) {
  const verification = transactionId
    ? await verifyFlutterwaveTransaction(
        transactionId
      )
    : await verifyFlutterwaveByReference(
        payment.tx_ref
      );

  if (verification.status !== "successful") {
    throw new Error(
      "Flutterwave has not marked this transaction as successful."
    );
  }

  if (verification.txRef !== payment.tx_ref) {
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

  if (verification.amount < payment.amount) {
    throw new Error(
      "The Flutterwave payment amount is less than the required course price."
    );
  }

  /*
   * Mark the verified payment first.
   */
  await markPaymentSuccessful(
    payment,
    verification.id
  );

  /*
   * Grant course access.
   */
  const enrollment =
    await activateEnrollment(payment);

  /*
   * Record coupon redemption only after
   * the payment and enrollment are successful.
   */
  await recordDiscountRedemption(payment);

  return enrollment;
}

export async function GET(request: Request) {
  const url = new URL(request.url);

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

  const admin = createAdminClient();

  const {
    data: payment,
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
        "original_amount",
        "discount_code_id",
        "discount_amount",
      ].join(", ")
    )
    .eq("tx_ref", txRef)
    .maybeSingle<PaymentRecord>();

  if (paymentError || !payment) {
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

  /*
   * An already-successful payment must still have:
   * 1. paid enrollment
   * 2. discount redemption, where applicable
   */
  if (payment.status === "successful") {
    try {
      await activateEnrollment(payment);
      await recordDiscountRedemption(payment);

      return redirectToCourse(
        request,
        payment.course_slug,
        "success"
      );
    } catch (error) {
      console.error(
        "Successful Flutterwave payment could not complete fulfilment:",
        error
      );

      return redirectToCourse(
        request,
        payment.course_slug,
        "failed"
      );
    }
  }

  if (status !== "successful") {
    await admin
      .from("course_payments")
      .update({
        status: "failed",
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", payment.id);

    return redirectToCourse(
      request,
      payment.course_slug,
      "failed"
    );
  }

  try {
    await fulfilPayment(
      payment,
      transactionId || null
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
        status: "failed",
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", payment.id);

    return redirectToCourse(
      request,
      payment.course_slug,
      "failed"
    );
  }
}