import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createFlutterwavePayment,
  createTransactionReference,
} from "@/lib/flutterwave";

type Profile = {
  role:
    | "admin"
    | "instructor"
    | "student";

  full_name: string | null;
  email: string | null;
  phone: string | null;
};

export async function POST(
  request: Request
) {
  try {
    const supabase =
      await createClient();

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          error:
            "Authentication required.",
        },
        { status: 401 }
      );
    }

    const {
      data: profile,
      error: profileError,
    } =
      await supabase
        .from("profiles")
        .select(
          "role, full_name, email, phone"
        )
        .eq(
          "id",
          user.id
        )
        .maybeSingle<Profile>();

    if (
      profileError ||
      !profile
    ) {
      return NextResponse.json(
        {
          error:
            "Unable to verify your account.",
        },
        { status: 403 }
      );
    }

    if (
      profile.role !==
      "student"
    ) {
      return NextResponse.json(
        {
          error:
            "Only student accounts can enroll in courses.",
        },
        { status: 403 }
      );
    }

    let body: {
      course_id?: unknown;
    };

    try {
      body =
        (await request.json()) as {
          course_id?: unknown;
        };
    } catch {
      return NextResponse.json(
        {
          error:
            "Invalid request body.",
        },
        { status: 400 }
      );
    }

    const courseId =
      typeof body.course_id ===
      "string"
        ? body.course_id.trim()
        : "";

    if (!courseId) {
      return NextResponse.json(
        {
          error:
            "Course ID is required.",
        },
        { status: 400 }
      );
    }

    const {
      data: course,
      error: courseError,
    } =
      await supabase
        .from("courses")
        .select(
          "id, title, slug, is_free, price_ngn, currency, status"
        )
        .eq(
          "id",
          courseId
        )
        .maybeSingle();

    if (courseError) {
      console.error(
        "Enrollment course lookup failed:",
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

    if (!course) {
      return NextResponse.json(
        {
          error:
            "Course not found.",
        },
        { status: 404 }
      );
    }

    if (
      course.status !==
      "published"
    ) {
      return NextResponse.json(
        {
          error:
            "This course is not currently available for enrollment.",
        },
        { status: 409 }
      );
    }

    const {
      data: existingEnrollment,
      error: enrollmentLookupError,
    } =
      await supabase
        .from("enrollments")
        .select(
          "id, enrollment_status, payment_status, progress_percent, enrolled_at"
        )
        .eq(
          "student_id",
          user.id
        )
        .eq(
          "course_id",
          course.id
        )
        .maybeSingle();

    if (enrollmentLookupError) {
      console.error(
        "Enrollment lookup failed:",
        enrollmentLookupError
      );

      return NextResponse.json(
        {
          error:
            "Unable to check your existing enrollment.",
        },
        { status: 500 }
      );
    }

    if (
      existingEnrollment &&
      (
        existingEnrollment.enrollment_status ===
          "active" ||
        existingEnrollment.enrollment_status ===
          "completed"
      )
    ) {
      return NextResponse.json({
        success: true,
        already_enrolled: true,
        course: {
          id: course.id,
          title: course.title,
          slug: course.slug,
        },
        enrollment:
          existingEnrollment,
        message:
          "You are already enrolled in this course.",
      });
    }

    /*
     * Free courses are enrolled immediately.
     */
    if (course.is_free) {
      if (
        existingEnrollment
      ) {
        const {
          data:
            reactivatedEnrollment,
          error:
            reactivateError,
        } =
          await supabase
            .from("enrollments")
            .update({
              enrollment_status:
                "active",
              payment_status:
                "free",
            })
            .eq(
              "id",
              existingEnrollment.id
            )
            .select(
              "id, student_id, course_id, payment_status, enrollment_status, progress_percent, enrolled_at"
            )
            .single();

        if (reactivateError) {
          console.error(
            "Free enrollment reactivation failed:",
            reactivateError
          );

          return NextResponse.json(
            {
              error:
                "Unable to activate your enrollment.",
            },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          already_enrolled: false,
          course: {
            id: course.id,
            title: course.title,
            slug: course.slug,
          },
          enrollment:
            reactivatedEnrollment,
          message:
            "Enrollment activated successfully.",
        });
      }

      const {
        data: enrollment,
        error: enrollmentError,
      } =
        await supabase
          .from("enrollments")
          .insert({
            student_id:
              user.id,
            course_id:
              course.id,
            payment_status:
              "free",
            enrollment_status:
              "active",
            progress_percent:
              0,
          })
          .select(
            "id, student_id, course_id, payment_status, enrollment_status, progress_percent, enrolled_at"
          )
          .single();

      if (enrollmentError) {
        if (
          enrollmentError.code ===
          "23505"
        ) {
          const {
            data:
              concurrentEnrollment,
          } =
            await supabase
              .from("enrollments")
              .select(
                "id, student_id, course_id, payment_status, enrollment_status, progress_percent, enrolled_at"
              )
              .eq(
                "student_id",
                user.id
              )
              .eq(
                "course_id",
                course.id
              )
              .maybeSingle();

          if (
            concurrentEnrollment
          ) {
            return NextResponse.json({
              success: true,
              already_enrolled:
                true,
              course: {
                id: course.id,
                title:
                  course.title,
                slug: course.slug,
              },
              enrollment:
                concurrentEnrollment,
              message:
                "You are already enrolled in this course.",
            });
          }
        }

        console.error(
          "Free course enrollment failed:",
          enrollmentError
        );

        return NextResponse.json(
          {
            error:
              enrollmentError.message ||
              "Unable to enroll in this course.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          already_enrolled:
            false,
          payment_required:
            false,
          course: {
            id: course.id,
            title:
              course.title,
            slug: course.slug,
          },
          enrollment,
          message:
            "Enrollment successful.",
        },
        { status: 201 }
      );
    }

    /*
     * Paid course.
     */
    const amount =
      Number(course.price_ngn);

    if (
      !Number.isInteger(
        amount
      ) ||
      amount <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "This paid course does not have a valid NGN price.",
        },
        { status: 409 }
      );
    }

    const currency =
      typeof course.currency ===
      "string" &&
      course.currency.trim()
        ? course.currency
            .trim()
            .toUpperCase()
        : "NGN";

    const txRef =
      createTransactionReference();

    const origin =
      new URL(
        request.url
      ).origin;

    const redirectUrl =
      `${origin}/api/payments/flutterwave/callback`;

    const {
      error: paymentInsertError,
    } =
      await supabase
        .from("course_payments")
        .insert({
          student_id:
            user.id,
          course_id:
            course.id,
          course_slug:
            course.slug,
          tx_ref:
            txRef,
          amount,
          currency,
          status:
            "initiated",
        });

    if (paymentInsertError) {
      console.error(
        "Course payment record creation failed:",
        paymentInsertError
      );

      return NextResponse.json(
        {
          error:
            "Unable to start the course payment.",
        },
        { status: 500 }
      );
    }

    try {
      const payment =
        await createFlutterwavePayment(
          {
            amount,
            currency,
            txRef,
            redirectUrl,
            customer: {
              email:
                profile.email ||
                user.email ||
                "",
              name:
                profile.full_name ||
                undefined,
              phone_number:
                profile.phone ||
                undefined,
            },
            courseId:
              course.id,
            courseTitle:
              course.title,
            studentId:
              user.id,
          }
        );

      const {
        error:
          paymentUpdateError,
      } =
        await supabase
          .from("course_payments")
          .update({
            checkout_url:
              payment.link,
            status:
              "pending",
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "tx_ref",
            txRef
          );

      if (paymentUpdateError) {
        console.error(
          "Course payment record update failed:",
          paymentUpdateError
        );
      }

      return NextResponse.json({
        success: true,
        already_enrolled:
          false,
        payment_required:
          true,
        payment_url:
          payment.link,
        tx_ref:
          txRef,
        amount,
        currency,
        course: {
          id: course.id,
          title:
            course.title,
          slug: course.slug,
        },
        message:
          "Continue to Flutterwave to complete payment.",
      });
    } catch (paymentError) {
      console.error(
        "Flutterwave initialization failed:",
        paymentError
      );

      await supabase
        .from("course_payments")
        .update({
          status:
            "failed",
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "tx_ref",
          txRef
        );

      return NextResponse.json(
        {
          error:
            paymentError instanceof
            Error
              ? paymentError.message
              : "Unable to initialize Flutterwave payment.",
        },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error(
      "Student enrollment route error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof
          Error
            ? error.message
            : "An unexpected error occurred while enrolling in the course.",
      },
      { status: 500 }
    );
  }
}