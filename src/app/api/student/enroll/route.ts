import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createFlutterwavePayment } from "@/lib/flutterwave";

type Course = {
  id: string;
  title: string;
  slug: string;
  price_ngn: number;
  currency: string;
  is_free: boolean;
  status: string;
};

type Profile = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

type Enrollment = {
  id: string;
  enrollment_status: string;
  payment_status: string | null;
};

type ExistingPayment = {
  id: string;
  tx_ref: string;
  status: string;
  checkout_url: string | null;
};

export async function POST(
  request: Request
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Authentication required.",
        },
        { status: 401 }
      );
    }

    const { data: profileData } =
      await supabase
        .from("profiles")
        .select(
          "full_name, email, phone, role"
        )
        .eq("id", user.id)
        .maybeSingle();

    const profile =
      profileData as
        | (Profile & {
            role?: string;
          })
        | null;

    if (
      profile?.role &&
      profile.role !== "student"
    ) {
      return NextResponse.json(
        {
          error:
            "Only student accounts can enroll.",
        },
        { status: 403 }
      );
    }

    const body = (await request.json()) as {
      course_id?: string;
      course_slug?: string;
    };

    const courseId =
      typeof body.course_id === "string"
        ? body.course_id.trim()
        : "";

    const courseSlug =
      typeof body.course_slug === "string"
        ? body.course_slug.trim()
        : "";

    if (!courseId && !courseSlug) {
      return NextResponse.json(
        {
          error:
            "A course ID or course slug is required.",
        },
        { status: 400 }
      );
    }

    let courseQuery = supabase
      .from("courses")
      .select(
        "id, title, slug, price_ngn, currency, is_free, status"
      )
      .eq("status", "published");

    if (courseId) {
      courseQuery = courseQuery.eq(
        "id",
        courseId
      );
    } else {
      courseQuery = courseQuery.eq(
        "slug",
        courseSlug
      );
    }

    const { data: courseData, error: courseError } =
      await courseQuery.maybeSingle();

    if (courseError) {
      console.error(
        "Course lookup failed:",
        courseError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load the course.",
        },
        { status: 500 }
      );
    }

    if (!courseData) {
      return NextResponse.json(
        {
          error:
            "Course not found or not available.",
        },
        { status: 404 }
      );
    }

    const course =
      courseData as Course;

    /*
     * First protection:
     * Never create another payment if the
     * student already has course access.
     */
    const { data: enrollmentData, error: enrollmentError } =
      await supabase
        .from("enrollments")
        .select(
          "id, enrollment_status, payment_status"
        )
        .eq("student_id", user.id)
        .eq("course_id", course.id)
        .in("enrollment_status", [
          "active",
          "completed",
        ])
        .maybeSingle();

    if (enrollmentError) {
      console.error(
        "Enrollment lookup failed:",
        enrollmentError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify existing enrollment.",
        },
        { status: 500 }
      );
    }

    const existingEnrollment =
      enrollmentData as Enrollment | null;

    if (existingEnrollment) {
      return NextResponse.json({
        success: true,
        already_enrolled: true,
        payment_required: false,
        enrollment_id:
          existingEnrollment.id,
        course_id: course.id,
        course_slug: course.slug,
        message:
          "You are already enrolled in this course.",
      });
    }

    /*
     * Free courses are enrolled immediately.
     */
    if (
      course.is_free ||
      Number(course.price_ngn) <= 0
    ) {
      const { data: enrollment, error } =
        await supabase
          .from("enrollments")
          .insert({
            student_id: user.id,
            course_id: course.id,
            enrollment_status: "active",
            payment_status: "free",
          })
          .select(
            "id, enrollment_status, payment_status"
          )
          .single();

      if (error) {
        /*
         * A concurrent request may have created
         * the enrollment after our initial lookup.
         */
        if (error.code === "23505") {
          const { data: existing } =
            await supabase
              .from("enrollments")
              .select(
                "id, enrollment_status, payment_status"
              )
              .eq("student_id", user.id)
              .eq("course_id", course.id)
              .maybeSingle();

          return NextResponse.json({
            success: true,
            already_enrolled: true,
            payment_required: false,
            enrollment_id:
              existing?.id ?? null,
            course_id: course.id,
            course_slug: course.slug,
            message:
              "You are already enrolled in this course.",
          });
        }

        console.error(
          "Free enrollment failed:",
          error
        );

        return NextResponse.json(
          {
            error:
              "Unable to create your enrollment.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        already_enrolled: false,
        payment_required: false,
        enrollment_id: enrollment.id,
        course_id: course.id,
        course_slug: course.slug,
        message:
          "Enrollment completed successfully.",
      });
    }

    /*
     * Second protection:
     * Reuse an existing unfinished payment instead
     * of creating another Flutterwave transaction.
     */
    const { data: existingPaymentData } =
      await supabase
        .from("course_payments")
        .select(
          "id, tx_ref, status, checkout_url"
        )
        .eq("student_id", user.id)
        .eq("course_id", course.id)
        .in("status", [
          "initiated",
          "pending",
        ])
        .order("created_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

    const existingPayment =
      existingPaymentData as ExistingPayment | null;

    if (
      existingPayment?.checkout_url
    ) {
      return NextResponse.json({
        success: true,
        already_enrolled: false,
        payment_required: true,
        payment_id: existingPayment.id,
        tx_ref: existingPayment.tx_ref,
        payment_url:
          existingPayment.checkout_url,
        amount: Number(course.price_ngn),
        currency: course.currency || "NGN",
        message:
          "An existing payment is awaiting completion.",
      });
    }

    const amount =
      Number(course.price_ngn);

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        {
          error:
            "This course has an invalid payment amount.",
        },
        { status: 400 }
      );
    }

    const customerEmail =
      user.email ||
      profile?.email ||
      "";

    if (!customerEmail) {
      return NextResponse.json(
        {
          error:
            "A valid email address is required for payment.",
        },
        { status: 400 }
      );
    }

    const payment =
      await createFlutterwavePayment({
        amount,
        currency:
          course.currency || "NGN",
        customer: {
          email: customerEmail,
          name:
            profile?.full_name ||
            user.user_metadata?.full_name ||
            "RuffNeck Learn Student",
          phone_number:
            profile?.phone ||
            user.user_metadata?.phone ||
            undefined,
        },
        txRefPrefix: "RNL",
        meta: {
          student_id: user.id,
          course_id: course.id,
          course_slug: course.slug,
        },
      });

    const { data: paymentRecord, error: paymentError } =
      await supabase
        .from("course_payments")
        .insert({
          student_id: user.id,
          course_id: course.id,
          course_slug: course.slug,
          tx_ref: payment.tx_ref,
          flutterwave_transaction_id:
            payment.transaction_id ?? null,
          amount,
          currency:
            course.currency || "NGN",
          status: "initiated",
          checkout_url:
            payment.payment_url,
        })
        .select(
          "id, tx_ref, status, checkout_url"
        )
        .single();

    if (paymentError) {
      /*
       * If another request won the race and created
       * the payment first, return that payment rather
       * than creating another transaction.
       */
      if (paymentError.code === "23505") {
        const { data: existing } =
          await supabase
            .from("course_payments")
            .select(
              "id, tx_ref, status, checkout_url"
            )
            .eq("student_id", user.id)
            .eq("course_id", course.id)
            .in("status", [
              "initiated",
              "pending",
            ])
            .order("created_at", {
              ascending: false,
            })
            .limit(1)
            .maybeSingle();

        if (existing?.checkout_url) {
          return NextResponse.json({
            success: true,
            already_enrolled: false,
            payment_required: true,
            payment_id: existing.id,
            tx_ref: existing.tx_ref,
            payment_url:
              existing.checkout_url,
            amount,
            currency:
              course.currency || "NGN",
            message:
              "An existing payment is awaiting completion.",
          });
        }
      }

      console.error(
        "Payment record creation failed:",
        paymentError
      );

      return NextResponse.json(
        {
          error:
            "Unable to create the payment record.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      already_enrolled: false,
      payment_required: true,
      payment_id: paymentRecord.id,
      tx_ref: paymentRecord.tx_ref,
      payment_url:
        paymentRecord.checkout_url,
      amount,
      currency:
        course.currency || "NGN",
      message:
        "Payment initialized successfully.",
    });
  } catch (error) {
    console.error(
      "Student enrollment/payment error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to process enrollment.",
      },
      { status: 500 }
    );
  }
}