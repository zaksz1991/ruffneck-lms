import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Course = {
  id: string;
  title: string;
  slug: string;
  is_free: boolean;
};

type Enrollment = {
  id: string;
  enrollment_status: string;
  payment_status: string;
};

type CurriculumLesson = {
  lesson_id: string;
};

type AssessmentAttempt = {
  id: string;
  score: number | null;
  total_points: number | null;
  earned_points: number | null;
  total_questions: number | null;
  completed_at: string | null;
  created_at: string;
};

type CourseProject = {
  id: string;
  project_type: string;
};

type ProjectSubmission = {
  id: string;
  score: number | null;
  status: string;
  reviewed_at: string | null;
};

type Profile = {
  full_name: string | null;
  email: string | null;
};

type Certificate = {
  id: string;
  certificate_number: string;
};

function getAssessmentPercentage(
  attempt: AssessmentAttempt
): number {
  if (
    attempt.total_points !== null &&
    attempt.total_points > 0 &&
    attempt.earned_points !== null
  ) {
    return (
      (attempt.earned_points /
        attempt.total_points) *
      100
    );
  }

  if (
    attempt.score !== null &&
    attempt.total_questions !== null &&
    attempt.total_questions > 0
  ) {
    return (
      (attempt.score /
        attempt.total_questions) *
      100
    );
  }

  if (attempt.score !== null) {
    return attempt.score;
  }

  return 0;
}

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

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: "Invalid request body.",
        },
        { status: 400 }
      );
    }

    const courseId =
      typeof (body as { courseId?: unknown })?.courseId ===
      "string"
        ? (
            (body as { courseId: string })
              .courseId
          ).trim()
        : "";

    if (!courseId) {
      return NextResponse.json(
        {
          error: "Course ID is required.",
        },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const {
      data: courseData,
      error: courseError,
    } = await admin
      .from("courses")
      .select(
        "id, title, slug, is_free"
      )
      .eq("id", courseId)
      .eq("status", "published")
      .maybeSingle();

    if (courseError) {
      console.error(
        "Certificate course lookup failed:",
        courseError
      );

      return NextResponse.json(
        {
          error: "Unable to verify course.",
        },
        { status: 500 }
      );
    }

    const course =
      courseData as Course | null;

    if (!course) {
      return NextResponse.json(
        {
          error:
            "The requested course was not found.",
        },
        { status: 404 }
      );
    }

    /*
     * Certificate issuance requires a completed
     * enrollment.
     */
    const {
      data: enrollmentData,
      error: enrollmentError,
    } = await admin
      .from("enrollments")
      .select(
        "id, enrollment_status, payment_status"
      )
      .eq("student_id", user.id)
      .eq("course_id", courseId)
      .eq("enrollment_status", "completed")
      .maybeSingle();

    if (enrollmentError) {
      console.error(
        "Certificate enrollment lookup failed:",
        enrollmentError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify course enrollment.",
        },
        { status: 500 }
      );
    }

    const enrollment =
      enrollmentData as Enrollment | null;

    if (!enrollment) {
      return NextResponse.json(
        {
          error:
            "You must complete the course before claiming a certificate.",
        },
        { status: 403 }
      );
    }

    /*
     * Verify the canonical payment state.
     *
     * Free courses require "free".
     * Paid courses require "paid".
     */
    if (course.is_free) {
      if (enrollment.payment_status !== "free") {
        return NextResponse.json(
          {
            error:
              "The enrollment payment state for this free course is invalid.",
          },
          { status: 403 }
        );
      }
    } else if (
      enrollment.payment_status !== "paid"
    ) {
      return NextResponse.json(
        {
          error:
            "Payment is required before claiming a certificate for this course.",
        },
        { status: 403 }
      );
    }

    /*
     * Verify published curriculum.
     */
    const {
      data: curriculumData,
      error: curriculumError,
    } = await admin
      .from("course_curriculum")
      .select("lesson_id")
      .eq("course_id", courseId)
      .eq("is_published", true);

    if (curriculumError) {
      console.error(
        "Certificate curriculum lookup failed:",
        curriculumError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify course completion.",
        },
        { status: 500 }
      );
    }

    const curriculum =
      (curriculumData ?? []) as CurriculumLesson[];

    if (curriculum.length === 0) {
      return NextResponse.json(
        {
          error:
            "This course does not currently have published lessons.",
        },
        { status: 400 }
      );
    }

    const lessonIds = curriculum.map(
      (lesson) => lesson.lesson_id
    );

    /*
     * Every published lesson must be completed.
     */
    const {
      data: progressData,
      error: progressError,
    } = await admin
      .from("lesson_progress")
      .select(
        "lesson_id, completed"
      )
      .eq("student_id", user.id)
      .eq("course_id", courseId)
      .eq("completed", true)
      .in("lesson_id", lessonIds);

    if (progressError) {
      console.error(
        "Certificate lesson progress lookup failed:",
        progressError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify lesson completion.",
        },
        { status: 500 }
      );
    }

    const completedLessonIds =
      new Set(
        (progressData ?? []).map(
          (row) => row.lesson_id
        )
      );

    if (
      completedLessonIds.size <
      lessonIds.length
    ) {
      return NextResponse.json(
        {
          error:
            "Complete all published course lessons before claiming your certificate.",
          completedLessons:
            completedLessonIds.size,
          totalLessons:
            lessonIds.length,
        },
        { status: 400 }
      );
    }

    /*
     * Find the student's most recent completed
     * assessment attempt.
     */
    const {
      data: assessmentData,
      error: assessmentError,
    } = await admin
      .from("assessment_attempts")
      .select(
        [
          "id",
          "score",
          "total_points",
          "earned_points",
          "total_questions",
          "completed_at",
          "created_at",
        ].join(", ")
      )
      .eq("student_id", user.id)
      .eq("course_id", courseId)
      .not("completed_at", "is", null)
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (assessmentError) {
      console.error(
        "Certificate assessment lookup failed:",
        assessmentError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify assessment completion.",
        },
        { status: 500 }
      );
    }

    const assessment =
      assessmentData as AssessmentAttempt | null;

    if (!assessment) {
      return NextResponse.json(
        {
          error:
            "Complete the course assessment before claiming your certificate.",
        },
        { status: 400 }
      );
    }

    const assessmentPercentage =
      getAssessmentPercentage(
        assessment
      );

    if (assessmentPercentage < 70) {
      return NextResponse.json(
        {
          error:
            "A minimum assessment score of 70% is required to claim this certificate.",
          score: Math.round(
            assessmentPercentage
          ),
        },
        { status: 400 }
      );
    }

    /*
     * Verify the published capstone.
     */
    const {
      data: projectData,
      error: projectError,
    } = await admin
      .from("course_projects")
      .select(
        "id, project_type"
      )
      .eq("course_id", courseId)
      .eq(
        "project_type",
        "capstone"
      )
      .eq("is_published", true)
      .order("sort_order", {
        ascending: true,
      })
      .limit(1)
      .maybeSingle();

    if (projectError) {
      console.error(
        "Certificate capstone lookup failed:",
        projectError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify capstone requirements.",
        },
        { status: 500 }
      );
    }

    const project =
      projectData as CourseProject | null;

    if (!project) {
      return NextResponse.json(
        {
          error:
            "This course does not currently have a published capstone project.",
        },
        { status: 400 }
      );
    }

    /*
     * The student's capstone submission must be approved.
     */
    const {
      data: submissionData,
      error: submissionError,
    } = await admin
      .from("project_submissions")
      .select(
        "id, score, status, reviewed_at"
      )
      .eq(
        "project_id",
        project.id
      )
      .eq(
        "student_id",
        user.id
      )
      .eq(
        "status",
        "approved"
      )
      .order("reviewed_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (submissionError) {
      console.error(
        "Certificate capstone submission lookup failed:",
        submissionError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify capstone approval.",
        },
        { status: 500 }
      );
    }

    const submission =
      submissionData as ProjectSubmission | null;

    if (!submission) {
      return NextResponse.json(
        {
          error:
            "Your capstone must be approved before claiming this certificate.",
        },
        { status: 400 }
      );
    }

    const capstoneScore =
      submission.score ?? 0;

    /*
     * Load certificate holder information.
     */
    const {
      data: profileData,
      error: profileError,
    } = await admin
      .from("profiles")
      .select(
        "full_name, email"
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error(
        "Certificate profile lookup failed:",
        profileError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load certificate holder information.",
        },
        { status: 500 }
      );
    }

    const profile =
      profileData as Profile | null;

    const holderName =
      profile?.full_name?.trim() ||
      user.user_metadata?.full_name?.trim() ||
      user.email?.split("@")[0] ||
      "RuffNeck Learn Student";

    /*
     * Prevent duplicate certificates.
     */
    const {
      data: existingCertificateData,
      error: existingCertificateError,
    } = await admin
      .from("course_certificates")
      .select(
        "id, certificate_number"
      )
      .eq(
        "student_id",
        user.id
      )
      .eq(
        "course_id",
        courseId
      )
      .maybeSingle();

    if (existingCertificateError) {
      console.error(
        "Existing certificate lookup failed:",
        existingCertificateError
      );

      return NextResponse.json(
        {
          error:
            "Unable to check existing certificate records.",
        },
        { status: 500 }
      );
    }

    const existingCertificate =
      existingCertificateData as Certificate | null;

    if (existingCertificate) {
      return NextResponse.json({
        certificateId:
          existingCertificate.id,
        certificateNumber:
          existingCertificate.certificate_number,
        alreadyIssued: true,
      });
    }

    /*
     * All certificate requirements passed.
     */
    const {
      data: certificateData,
      error: certificateError,
    } = await admin
      .from("course_certificates")
      .insert({
        student_id:
          user.id,
        course_id:
          courseId,
        holder_name:
          holderName,
        course_title:
          course.title,
        course_slug:
          course.slug,
        assessment_score:
          Math.round(
            assessmentPercentage
          ),
        capstone_score:
          capstoneScore,
        is_revoked:
          false,
      })
      .select(
        "id, certificate_number"
      )
      .single();

    if (certificateError) {
      /*
       * Handle a concurrent issuance request.
       */
      if (
        certificateError.code ===
        "23505"
      ) {
        const {
          data: racedCertificate,
          error:
            racedCertificateError,
        } = await admin
          .from("course_certificates")
          .select(
            "id, certificate_number"
          )
          .eq(
            "student_id",
            user.id
          )
          .eq(
            "course_id",
            courseId
          )
          .maybeSingle();

        if (
          !racedCertificateError &&
          racedCertificate
        ) {
          return NextResponse.json({
            certificateId:
              racedCertificate.id,
            certificateNumber:
              racedCertificate.certificate_number,
            alreadyIssued: true,
          });
        }
      }

      console.error(
        "Certificate issuance failed:",
        certificateError
      );

      return NextResponse.json(
        {
          error:
            "Unable to issue certificate.",
        },
        { status: 500 }
      );
    }

    const certificate =
      certificateData as Certificate | null;

    if (!certificate) {
      return NextResponse.json(
        {
          error:
            "Certificate was created but could not be retrieved.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      certificateId:
        certificate.id,
      certificateNumber:
        certificate.certificate_number,
      alreadyIssued: false,
    });
  } catch (error) {
    console.error(
      "Certificate issuance request failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "An unexpected error occurred while issuing the certificate.",
      },
      { status: 500 }
    );
  }
}