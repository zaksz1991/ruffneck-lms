import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  verifyFlutterwaveByReference,
  verifyFlutterwaveTransaction,
} from "@/lib/flutterwave";

type PaymentRecord = {
  id: string;
  student_id: string;
  course_id: string;
  course_slug: string;
  tx_ref: string;
  flutterwave_transaction_id: number | null;
  amount: number;
  currency: string;
  status:
    | "initiated"
    | "pending"
    | "successful"
    | "failed"
    | "cancelled";
};

async function activateEnrollment(
  admin: ReturnType<typeof createAdminClient>,
  payment: PaymentRecord
) {
  const { data: existing, error: existingError } = await admin
    .from("enrollments")
    .select(
      "id, enrollment_status, payment_status, progress_percent, enrolled_at"
    )
    .eq("student_id", payment.student_id)
    .eq("course_id", payment.course_id)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    const { data, error } = await admin
      .from("enrollments")
      .update({
        payment_status: "paid",
        enrollment_status:
          existing.enrollment_status === "completed"
            ? "completed"
            : "active",
      })
      .eq("id", existing.id)
      .select(
        "id, enrollment_status, payment_status, progress_percent, enrolled_at"
      )
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  const { data, error } = await admin
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

  if (error) {
    if (error.code === "23505") {
      const { data: concurrent, error: concurrentError } = await admin
        .from("enrollments")
        .select(
          "id, enrollment_status, payment_status, progress_percent, enrolled_at"
        )
        .eq("student_id", payment.student_id)
        .eq("course_id", payment.course_id)
        .maybeSingle();

      if (concurrentError || !concurrent) {
        throw new Error(
          concurrentError?.message ||
            "The enrollment could not be confirmed."
        );
      }

      const { data: activated, error: activateError } = await admin
        .from("enrollments")
        .update({
          payment_status: "paid",
          enrollment_status:
            concurrent.enrollment_status === "completed"
              ? "completed"
              : "active",
        })
        .eq("id", concurrent.id)
        .select(
          "id, enrollment_status, payment_status, progress_percent, enrolled_at"
        )
        .single();

      if (activateError) {
        throw new Error(activateError.message);
      }

      return activated;
    }

    throw new Error(error.message);
  }

  return data;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profile not found." },
        { status: 403 }
      );
    }

    const role = profile.role as string;

    if (role !== "admin" && role !== "instructor") {
      return NextResponse.json(
        { error: "You are not authorized to reconcile payments." },
        { status: 403 }
      );
    }

    const body = (await request.json()) as {
      payment_id?: unknown;
    };

    const paymentId =
      typeof body.payment_id === "string"
        ? body.payment_id.trim()
        : "";

    if (!paymentId) {
      return NextResponse.json(
        { error: "Payment ID is required." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: payment, error: paymentError } = await admin
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
      .eq("id", paymentId)
      .maybeSingle<PaymentRecord>();

    if (paymentError) {
      return NextResponse.json(
        { error: paymentError.message },
        { status: 500 }
      );
    }

    if (!payment) {
      return NextResponse.json(
        { error: "Payment not found." },
        { status: 404 }
      );
    }

    if (role === "instructor") {
      const { data: course, error: courseError } = await admin
        .from("courses")
        .select("id, instructor_id")
        .eq("id", payment.course_id)
        .maybeSingle();

      if (courseError) {
        return NextResponse.json(
          { error: courseError.message },
          { status: 500 }
        );
      }

      if (!course || course.instructor_id !== user.id) {
        return NextResponse.json(
          {
            error:
              "You are not authorized to reconcile payments for this course.",
          },
          { status: 403 }
        );
      }
    }

    if (payment.status === "successful") {
      return NextResponse.json({
        success: true,
        already_reconciled: true,
        message: "This payment has already been reconciled successfully.",
      });
    }

    if (
      payment.status === "failed" ||
      payment.status === "cancelled"
    ) {
      return NextResponse.json(
        {
          error:
            "Failed or cancelled payments cannot be reconciled. A new payment must be initiated.",
        },
        { status: 409 }
      );
    }

    const transaction =
      payment.flutterwave_transaction_id !== null
        ? await verifyFlutterwaveTransaction(
            String(payment.flutterwave_transaction_id)
          )
        : await verifyFlutterwaveByReference(payment.tx_ref);

    if (transaction.txRef !== payment.tx_ref) {
      return NextResponse.json(
        {
          error:
            "Flutterwave transaction reference does not match the stored payment.",
        },
        { status: 409 }
      );
    }

    if (transaction.status !== "successful") {
      await admin
        .from("course_payments")
        .update({
          status:
            transaction.status === "failed"
              ? "failed"
              : "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id);

      return NextResponse.json({
        success: true,
        reconciled: false,
        status:
          transaction.status === "failed"
            ? "failed"
            : "pending",
        message:
          "Flutterwave has not verified this transaction as successful. Course access was not granted.",
      });
    }

    if (
      transaction.currency.toUpperCase() !==
      payment.currency.toUpperCase()
    ) {
      return NextResponse.json(
        {
          error:
            "Flutterwave transaction currency does not match the stored payment.",
        },
        { status: 409 }
      );
    }

    if (transaction.amount !== payment.amount) {
      return NextResponse.json(
        {
          error:
            "Flutterwave transaction amount does not match the stored course price.",
        },
        { status: 409 }
      );
    }

    const enrollment = await activateEnrollment(admin, payment);

    const { error: updateError } = await admin
      .from("course_payments")
      .update({
        status: "successful",
        flutterwave_transaction_id: transaction.id,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return NextResponse.json({
      success: true,
      reconciled: true,
      status: "successful",
      enrollment_id: enrollment?.id ?? null,
      message:
        "Payment verified successfully and course enrollment has been activated.",
    });
  } catch (error) {
    console.error(
      "Admin payment reconciliation error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Payment reconciliation failed.",
      },
      { status: 500 }
    );
  }
}