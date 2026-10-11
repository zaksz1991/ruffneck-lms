import { NextResponse } from "next/server";
import {
  verifyFlutterwaveByReference,
  verifyFlutterwaveTransaction,
} from "@/lib/flutterwave";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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

type ProfileRecord = {
  id: string;
  role: string;
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

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function getAuthorizedUser() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { user: null, profile: null };
  }

  const { data: profileData, error: profileError } =
    await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  const profile =
    profileData as unknown as ProfileRecord | null;

  if (
    !profile ||
    !["admin", "instructor"].includes(profile.role)
  ) {
    return { user, profile: null };
  }

  return { user, profile };
}

async function verifyPayment(
  payment: PaymentRecord,
): Promise<FlutterwaveVerification> {
  const verification = payment.flutterwave_transaction_id
    ? await verifyFlutterwaveTransaction(
        String(payment.flutterwave_transaction_id),
      )
    : await verifyFlutterwaveByReference(payment.tx_ref);

  return verification as FlutterwaveVerification;
}

async function createOrActivateEnrollment(
  admin: ReturnType<typeof createAdminClient>,
  payment: PaymentRecord,
): Promise<EnrollmentRecord> {
  const { data: existingData, error: existingError } =
    await admin
      .from("enrollments")
      .select(ENROLLMENT_COLUMNS)
      .eq("student_id", payment.student_id)
      .eq("course_id", payment.course_id)
      .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  const existing =
    existingData as unknown as EnrollmentRecord | null;

  if (existing) {
    // Preserve completed enrollments.
    if (
      existing.payment_status === "paid" &&
      ["active", "completed"].includes(
        existing.enrollment_status,
      )
    ) {
      return existing;
    }

    const { data, error } = await admin
      .from("enrollments")
      .update({
        enrollment_status:
          existing.enrollment_status === "completed"
            ? "completed"
            : "active",
        payment_status: "paid",
      })
      .eq("id", existing.id)
      .select(ENROLLMENT_COLUMNS)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data as unknown as EnrollmentRecord;
  }

  const { data: createdData, error: createError } =
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

  if (!createError && createdData) {
    return createdData as unknown as EnrollmentRecord;
  }

  // Recover if another request created the enrollment concurrently.
  if (createError?.code === "23505") {
    const { data: concurrentData, error: concurrentError } =
      await admin
        .from("enrollments")
        .select(ENROLLMENT_COLUMNS)
        .eq("student_id", payment.student_id)
        .eq("course_id", payment.course_id)
        .maybeSingle();

    if (concurrentError) {
      throw new Error(concurrentError.message);
    }

    const concurrent =
      concurrentData as unknown as EnrollmentRecord | null;

    if (concurrent) {
      if (
        concurrent.payment_status === "paid" &&
        ["active", "completed"].includes(
          concurrent.enrollment_status,
        )
      ) {
        return concurrent;
      }

      const { data: recoveredData, error: recoverError } =
        await admin
          .from("enrollments")
          .update({
            enrollment_status:
              concurrent.enrollment_status === "completed"
                ? "completed"
                : "active",
            payment_status: "paid",
          })
          .eq("id", concurrent.id)
          .select(ENROLLMENT_COLUMNS)
          .single();

      if (recoverError) {
        throw new Error(recoverError.message);
      }

      return recoveredData as unknown as EnrollmentRecord;
    }
  }

  throw new Error(
    createError?.message ??
      "Enrollment could not be created.",
  );
}

async function recordDiscountRedemption(
  admin: ReturnType<typeof createAdminClient>,
  payment: PaymentRecord,
): Promise<void> {
  if (
    !payment.discount_code_id ||
    Number(payment.discount_amount) <= 0
  ) {
    return;
  }

  const originalAmount =
    payment.original_amount ??
    Number(payment.amount) + Number(payment.discount_amount);

  const { error } = await admin.rpc(
    "record_discount_redemption",
    {
      p_discount_code_id: payment.discount_code_id,
      p_student_id: payment.student_id,
      p_course_id: payment.course_id,
      p_payment_id: payment.id,
      p_amount_before_discount: Math.round(originalAmount),
      p_discount_amount: Math.round(
        Number(payment.discount_amount),
      ),
      p_amount_paid: Math.round(Number(payment.amount)),
    },
  );

  if (error) {
    throw new Error(
      `Discount redemption processing failed: ${error.message}`,
    );
  }
}

async function fulfilSuccessfulPayment(
  admin: ReturnType<typeof createAdminClient>,
  payment: PaymentRecord,
  verification?: FlutterwaveVerification,
) {
  let confirmedPayment = payment;

  if (payment.status !== "successful") {
    if (!verification) {
      throw new Error(
        "Payment verification is required before fulfilment.",
      );
    }

    const now = new Date().toISOString();

    const transactionId = Number(
      verification.id ??
        payment.flutterwave_transaction_id ??
        0,
    );

    const { data: updatedData, error: updateError } =
      await admin
        .from("course_payments")
        .update({
          status: "successful",
          flutterwave_transaction_id:
            Number.isFinite(transactionId) && transactionId > 0
              ? transactionId
              : payment.flutterwave_transaction_id,
          verified_at: now,
          updated_at: now,
        })
        .eq("id", payment.id)
        .neq("status", "successful")
        .select(PAYMENT_COLUMNS)
        .maybeSingle();

    if (updateError) {
      throw new Error(updateError.message);
    }

    if (updatedData) {
      confirmedPayment =
        updatedData as unknown as PaymentRecord;
    } else {
      // Another request may have completed the payment.
      const { data: latestData, error: latestError } =
        await admin
          .from("course_payments")
          .select(PAYMENT_COLUMNS)
          .eq("id", payment.id)
          .maybeSingle();

      if (latestError) {
        throw new Error(latestError.message);
      }

      const latest =
        latestData as unknown as PaymentRecord | null;

      if (!latest || latest.status !== "successful") {
        throw new Error(
          "Successful payment status could not be confirmed.",
        );
      }

      confirmedPayment = latest;
    }
  }

  const enrollment = await createOrActivateEnrollment(
    admin,
    confirmedPayment,
  );

  await recordDiscountRedemption(admin, confirmedPayment);

  return { payment: confirmedPayment, enrollment };
}

export async function POST(request: Request) {
  try {
    const { user, profile } = await getAuthorizedUser();

    if (!user) {
      return jsonError("Authentication required.", 401);
    }

    if (!profile) {
      return jsonError(
        "Admin or instructor access required.",
        403,
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON request.");
    }

    const paymentId =
      typeof body === "object" &&
      body !== null &&
      "payment_id" in body &&
      typeof (body as { payment_id?: unknown }).payment_id ===
        "string"
        ? (body as { payment_id: string }).payment_id.trim()
        : "";

    if (!paymentId) {
      return jsonError("payment_id is required.");
    }

    const admin = createAdminClient();

    const { data: paymentData, error: paymentError } =
      await admin
        .from("course_payments")
        .select(PAYMENT_COLUMNS)
        .eq("id", paymentId)
        .maybeSingle();

    if (paymentError) {
      return jsonError(paymentError.message, 500);
    }

    const payment =
      paymentData as unknown as PaymentRecord | null;

    if (!payment) {
      return jsonError("Payment record not found.", 404);
    }

    if (profile.role === "instructor") {
      const { data: courseData, error: courseError } =
        await admin
          .from("courses")
          .select("id, instructor_id")
          .eq("id", payment.course_id)
          .maybeSingle();

      if (courseError) {
        return jsonError(courseError.message, 500);
      }

      const course = courseData as
        | { id: string; instructor_id: string | null }
        | null;

      if (!course || course.instructor_id !== user.id) {
        return jsonError(
          "You are not authorized to reconcile this payment.",
          403,
        );
      }
    }

    // Recover enrollment or discount work for an already successful payment.
    if (payment.status === "successful") {
      const result = await fulfilSuccessfulPayment(
        admin,
        payment,
      );

      return NextResponse.json({
        success: true,
        already_verified: true,
        payment: result.payment,
        enrollment: result.enrollment,
      });
    }

    if (
      payment.status === "failed" ||
      payment.status === "cancelled"
    ) {
      return jsonError(
        `Payment cannot be reconciled because its status is ${payment.status}.`,
      );
    }

    let verification: FlutterwaveVerification;

    try {
      verification = await verifyPayment(payment);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Flutterwave verification failed.";

      await admin
        .from("course_payments")
        .update({
          status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id)
        .neq("status", "successful");

      return jsonError(message, 502);
    }

    const verifiedStatus = String(
      verification.status ?? "",
    )
      .trim()
      .toLowerCase();

    const verifiedTxRef = String(
      verification.txRef ?? "",
    ).trim();

    const verifiedCurrency = String(
      verification.currency ?? "",
    )
      .trim()
      .toUpperCase();

    const verifiedAmount = Number(verification.amount);
    const expectedAmount = Number(payment.amount);

    if (verifiedStatus !== "successful") {
      await admin
        .from("course_payments")
        .update({
          status:
            verifiedStatus === "cancelled"
              ? "cancelled"
              : "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id)
        .neq("status", "successful");

      return NextResponse.json({
        success: false,
        verified: false,
        status: verifiedStatus || "unknown",
        message:
          "Flutterwave has not confirmed a successful payment.",
      });
    }

    if (verifiedTxRef !== payment.tx_ref) {
      return jsonError(
        "Flutterwave transaction reference does not match the payment record.",
        409,
      );
    }

    if (
      verifiedCurrency !==
      payment.currency.trim().toUpperCase()
    ) {
      return jsonError(
        "Flutterwave currency does not match the payment record.",
        409,
      );
    }

    if (
      !Number.isFinite(expectedAmount) ||
      expectedAmount <= 0 ||
      !Number.isFinite(verifiedAmount) ||
      verifiedAmount < expectedAmount
    ) {
      return jsonError(
        "Flutterwave payment amount does not meet the required course amount.",
        409,
      );
    }

    const result = await fulfilSuccessfulPayment(
      admin,
      payment,
      verification,
    );

    return NextResponse.json({
      success: true,
      verified: true,
      payment: result.payment,
      enrollment: result.enrollment,
    });
  } catch (error) {
    console.error(
      "Admin payment reconciliation error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Payment reconciliation failed.",
      },
      { status: 500 },
    );
  }
}