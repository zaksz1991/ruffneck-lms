import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Profile = {
  role: "admin" | "instructor" | "student";
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
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

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

    const role =
      profile.role as Profile["role"];

    if (role !== "student") {
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
          "id, title, slug, is_free, price_ngn, status"
        )
        .eq("id", courseId)
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

    /*
     * Paid enrollment is intentionally blocked until
     * payment verification is connected.
     */
    if (!course.is_free) {
      return NextResponse.json(
        {
          error:
            "This is a paid course. Payment must be completed before enrollment.",
          payment_required: true,
          price_ngn:
            course.price_ngn,
        },
        { status: 402 }
      );
    }

    const {
      data: existingEnrollment,
      error: existingError,
    } =
      await supabase
        .from("enrollments")
        .select(
          "id, enrollment_status, payment_status, progress_percent"
        )
        .eq("student_id", user.id)
        .eq("course_id", course.id)
        .maybeSingle();

    if (existingError) {
      console.error(
        "Enrollment lookup failed:",
        existingError
      );

      return NextResponse.json(
        {
          error:
            "Unable to check your existing enrollment.",
        },
        { status: 500 }
      );
    }

    if (existingEnrollment) {
      if (
        existingEnrollment.enrollment_status ===
          "active" ||
        existingEnrollment.enrollment_status ===
          "completed"
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

      const {
        data: reactivatedEnrollment,
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
          "Enrollment reactivation failed:",
          reactivateError
        );

        return NextResponse.json(
          {
            error:
              "Unable to reactivate your enrollment.",
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
          data: concurrentEnrollment,
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
              title: course.title,
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
        "Course enrollment failed:",
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
        course: {
          id: course.id,
          title: course.title,
          slug: course.slug,
        },
        enrollment,
        message:
          "Enrollment successful.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Student enrollment route error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while enrolling in the course.",
      },
      { status: 500 }
    );
  }
}