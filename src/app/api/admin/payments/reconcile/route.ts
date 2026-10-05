import { NextResponse } from "next/server";
import {
  verifyFlutterwaveByReference,
  verifyFlutterwaveTransaction,
} from "@/lib/flutterwave";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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
    return {
      user: null,
      profile: null,
    };
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  const profile =
    profileData as unknown as ProfileRecord | null;

  if (
    !profile ||
    (profile.role !== "admin" &&
      profile.role !== "instructor")
  ) {
    return {
      user,
      profile: null,
    };
  }

  return {
    user,
    profile,
  };
}

async function verifyPayment(payment: PaymentRecord) {
  if (payment.flutterwave_transaction_id) {
    return verifyFlutterwaveTransaction(
      payment.flutterwave_transaction_id,
    );
  }

  return verifyFlutterwaveByReference(payment.tx_ref);
}

async function createOrActivateEnrollment(
  admin: ReturnType<typeof createAdminClient>,
  payment: PaymentRecord,
) {
  const { data: existingData, error: existingError } =
    await admin
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
    throw new Error(createError.message);
  }

  return createdData as unknown as EnrollmentRecord;
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

    const {
      data: paymentData,
      error: paymentError,
    } = await admin
      .from("course_payments")
      .select(
        "id, student_id, course_id, course_slug, tx_ref, flutterwave_transaction_id, amount, currency, status",
      )
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
      const {
        data: courseData,
        error: courseError,
      } = await admin
        .from("courses")
        .select("id, instructor_id")
        .eq("id", payment.course_id)
        .maybeSingle();

      if (courseError) {
        return jsonError(courseError.message, 500);
      }

      const course =
        courseData as unknown as {
          id: string;
          instructor_id: string | null;
        } | null;

      if (!course || course.instructor_id !== user.id) {
        return jsonError(
          "You are not authorized to reconcile this payment.",
          403,
        );
      }
    }

    if (payment.status === "successful") {
      const enrollment =
        await createOrActivateEnrollment(
          admin,
          payment,
        );

      return NextResponse.json({
        success: true,
        already_verified: true,
        payment,
        enrollment,
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

    let verification;

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
        .eq("id", payment.id);

      return jsonError(message, 502);
    }

    const verifiedStatus =
      String(verification.status ?? "").toLowerCase();

    const verifiedTxRef =
      String(verification.tx_ref ?? "").trim();

    const verifiedCurrency =
      String(verification.currency ?? "")
        .trim()
        .toUpperCase();

    const verifiedAmount = Number(
      verification.amount ?? 0,
    );

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
        .eq("id", payment.id);

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

    if (verifiedAmount < Number(payment.amount)) {
      return jsonError(
        "Flutterwave payment amount is lower than the required course amount.",
        409,
      );
    }

    const enrollment =
      await createOrActivateEnrollment(
        admin,
        payment,
      );

    const transactionId = Number(
      verification.id ??
        payment.flutterwave_transaction_id ??
        0,
    );

    const {
      data: updatedPaymentData,
      error: updateError,
    } = await admin
      .from("course_payments")
      .update({
        status: "successful",
        flutterwave_transaction_id:
          Number.isFinite(transactionId) &&
          transactionId > 0
            ? transactionId
            : payment.flutterwave_transaction_id,
        updated_at: new Date().toISOString(),
        verified_at: new Date().toISOString(),
      })
      .eq("id", payment.id)
      .select(
        "id, student_id, course_id, course_slug, tx_ref, flutterwave_transaction_id, amount, currency, status",
      )
      .single();

    if (updateError) {
      return jsonError(updateError.message, 500);
    }

    const updatedPayment =
      updatedPaymentData as unknown as PaymentRecord;

    return NextResponse.json({
      success: true,
      verified: true,
      payment: updatedPayment,
      enrollment,
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