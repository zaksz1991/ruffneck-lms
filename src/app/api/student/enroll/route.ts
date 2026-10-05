import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createFlutterwavePayment } from "@/lib/flutterwave";

function makeTxRef() {
  return `RNL-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "You must be logged in to enroll.",
        },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email, phone, role")
      .eq("id", user.id)
      .maybeSingle();

    if (
      profile?.role &&
      profile.role !== "student" &&
      profile.role !== "admin" &&
      profile.role !== "instructor"
    ) {
      return NextResponse.json(
        {
          error: "Your account is not permitted to enroll.",
        },
        { status: 403 }
      );
    }

    const body = (await request.json()) as {
      courseId?: string;
      courseSlug?: string;
    };

    const courseId = body.courseId?.trim();
    const courseSlug = body.courseSlug?.trim();

    if (!courseId && !courseSlug) {
      return NextResponse.json(
        {
          error: "Course ID or course slug is required.",
        },
        { status: 400 }
      );
    }

    let courseQuery = supabase
      .from("courses")
      .select(
        `
          id,
          title,
          slug,
          price_ngn,
          currency,
          is_free,
          status
        `
      );

    const { data: course, error: courseError } =
      courseId
        ? await courseQuery
            .eq("id", courseId)
            .maybeSingle()
        : await courseQuery
            .eq("slug", courseSlug as string)
            .maybeSingle();

    if (courseError) {
      console.error(
        "Course lookup error:",
        courseError
      );

      return NextResponse.json(
        {
          error: "Unable to load the course.",
        },
        { status: 500 }
      );
    }

    if (!course) {
      return NextResponse.json(
        {
          error: "Course not found.",
        },
        { status: 404 }
      );
    }

    if (course.status !== "published") {
      return NextResponse.json(
        {
          error:
            "This course is not currently available for enrollment.",
        },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: existingEnrollment } =
      await admin
        .from("enrollments")
        .select(
          `
            id,
            enrollment_status,
            payment_status
          `
        )
        .eq("student_id", user.id)
        .eq("course_id", course.id)
        .maybeSingle();

    if (existingEnrollment) {
      const enrollmentStatus =
        existingEnrollment.enrollment_status;

      if (
        enrollmentStatus === "active" ||
        enrollmentStatus === "completed"
      ) {
        return NextResponse.json({
          success: true,
          alreadyEnrolled: true,
          paymentRequired: false,
          enrollmentId:
            existingEnrollment.id,
          courseSlug: course.slug,
        });
      }
    }

    const isFree =
      Boolean(course.is_free) ||
      Number(course.price_ngn ?? 0) <= 0;

    if (isFree) {
      if (existingEnrollment) {
        const { error: updateError } =
          await admin
            .from("enrollments")
            .update({
              enrollment_status: "active",
              payment_status: "free",
            })
            .eq("id", existingEnrollment.id);

        if (updateError) {
          console.error(
            "Free enrollment update error:",
            updateError
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
          alreadyEnrolled: false,
          paymentRequired: false,
          enrollmentId:
            existingEnrollment.id,
          courseSlug: course.slug,
        });
      }

      const {
        data: enrollment,
        error,
      } = await admin
        .from("enrollments")
        .insert({
          student_id: user.id,
          course_id: course.id,
          enrollment_status: "active",
          payment_status: "free",
          enrolled_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error) {
        console.error(
          "Free enrollment insert error:",
          error
        );

        if (error.code === "23505") {
          const { data: duplicate } =
            await admin
              .from("enrollments")
              .select(
                "id, enrollment_status"
              )
              .eq("student_id", user.id)
              .eq("course_id", course.id)
              .maybeSingle();

          if (
            duplicate?.enrollment_status ===
              "active" ||
            duplicate?.enrollment_status ===
              "completed"
          ) {
            return NextResponse.json({
              success: true,
              alreadyEnrolled: true,
              paymentRequired: false,
              enrollmentId:
                duplicate.id,
              courseSlug: course.slug,
            });
          }
        }

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
        alreadyEnrolled: false,
        paymentRequired: false,
        enrollmentId: enrollment.id,
        courseSlug: course.slug,
      });
    }

    const amount = Number(
      course.price_ngn ?? 0
    );

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        {
          error:
            "This paid course has an invalid price.",
        },
        { status: 400 }
      );
    }

    const currency =
      course.currency || "NGN";

    const { data: existingPayment } =
      await admin
        .from("course_payments")
        .select(
          `
            id,
            tx_ref,
            checkout_url,
            status,
            amount,
            currency
          `
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

    if (
      existingPayment?.checkout_url &&
      Number(existingPayment.amount) === amount &&
      existingPayment.currency === currency
    ) {
      return NextResponse.json({
        success: true,
        alreadyEnrolled: false,
        paymentRequired: true,
        payment_url:
          existingPayment.checkout_url,
        tx_ref:
          existingPayment.tx_ref,
        courseSlug: course.slug,
      });
    }

    const txRef = makeTxRef();

    const customerName =
      profile?.full_name ||
      user.user_metadata?.full_name ||
      user.email ||
      "RuffNeck Learn Student";

    const customerEmail =
      profile?.email ||
      user.email;

    if (!customerEmail) {
      return NextResponse.json(
        {
          error:
            "A valid email address is required before payment.",
        },
        { status: 400 }
      );
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://ruffneck-lms.vercel.app";

    const redirectUrl =
      `${siteUrl}/api/payments/flutterwave/callback`;

    const flutterwavePayment =
      await createFlutterwavePayment({
        amount,
        currency,
        txRef,
        redirectUrl,
        customer: {
          email: customerEmail,
          name: customerName,
          phone_number:
            profile?.phone ||
            user.user_metadata?.phone ||
            undefined,
        },
        courseId: course.id,
        courseTitle: course.title,
        studentId: user.id,
      });

    if (
      !flutterwavePayment.payment_url
    ) {
      console.error(
        "Flutterwave response did not contain payment_url:",
        flutterwavePayment
      );

      return NextResponse.json(
        {
          error:
            "Flutterwave did not return a checkout URL.",
        },
        { status: 502 }
      );
    }

    const {
      data: payment,
      error: paymentError,
    } = await admin
      .from("course_payments")
      .insert({
        student_id: user.id,
        course_id: course.id,
        course_slug: course.slug,
        tx_ref:
          flutterwavePayment.tx_ref ||
          txRef,
        flutterwave_transaction_id:
          flutterwavePayment.transaction_id ??
          null,
        amount,
        currency,
        status: "initiated",
        checkout_url:
          flutterwavePayment.payment_url,
      })
      .select(
        `
          id,
          tx_ref,
          checkout_url,
          status
        `
      )
      .single();

    if (paymentError) {
      console.error(
        "Course payment insert error:",
        paymentError
      );

      if (paymentError.code === "23505") {
        const {
          data: duplicatePayment,
        } = await admin
          .from("course_payments")
          .select(
            `
              id,
              tx_ref,
              checkout_url,
              status
            `
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

        if (
          duplicatePayment?.checkout_url
        ) {
          return NextResponse.json({
            success: true,
            alreadyEnrolled: false,
            paymentRequired: true,
            payment_url:
              duplicatePayment.checkout_url,
            tx_ref:
              duplicatePayment.tx_ref,
            courseSlug: course.slug,
          });
        }
      }

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
      alreadyEnrolled: false,
      paymentRequired: true,
      payment_url:
        payment.checkout_url,
      tx_ref: payment.tx_ref,
      paymentId: payment.id,
      courseSlug: course.slug,
    });
  } catch (error) {
    console.error(
      "Student enrollment error:",
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