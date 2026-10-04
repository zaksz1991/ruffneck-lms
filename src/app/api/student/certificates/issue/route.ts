import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Course = {
  id: string;
  title: string;
  slug: string;
};

type AssessmentAttempt = {
  id: string;
  score: number | null;
  total_points: number | null;
  earned_points: number | null;
};

type Project = {
  id: string;
  project_type: string | null;
};

type ApprovedSubmission = {
  score: number | null;
};

type CurriculumLesson = {
  lesson_id: string;
};

type ExistingCertificate = {
  id: string;
  certificate_number: string;
};

type RequestBody = {
  courseId?: unknown;
};

const PASS_PERCENTAGE = 70;

function calculateAssessmentPercentage(
  attempt: AssessmentAttempt
) {
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
    Number.isFinite(attempt.score)
  ) {
    return attempt.score;
  }

  return null;
}

export async function POST(
  request: Request
) {
  try {
    const supabase =
      await createClient();

    const {
      data: { user },
    } =
      await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error:
            "Authentication required.",
        },
        { status: 401 }
      );
    }

    let body: RequestBody;

    try {
      body =
        (await request.json()) as RequestBody;
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
      typeof body.courseId ===
      "string"
        ? body.courseId.trim()
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

    /*
     * --------------------------------------------------------------
     * COURSE
     * --------------------------------------------------------------
     */

    const {
      data: courseData,
      error: courseError,
    } =
      await supabase
        .from("courses")
        .select(
          "id, title, slug"
        )
        .eq(
          "id",
          courseId
        )
        .eq(
          "status",
          "published"
        )
        .maybeSingle();

    if (courseError) {
      console.error(
        "Certificate course lookup failed:",
        courseError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify the course.",
        },
        { status: 500 }
      );
    }

    const course =
      courseData as unknown as
        | Course
        | null;

    if (!course) {
      return NextResponse.json(
        {
          error:
            "Course not found.",
        },
        { status: 404 }
      );
    }

    /*
     * --------------------------------------------------------------
     * ENROLLMENT
     * --------------------------------------------------------------
     *
     * Enrollment is required, but the enrollment status itself
     * is not treated as the source of truth for eligibility.
     * Completion is verified from the published curriculum,
     * assessment and approved capstone below.
     */

    const {
      data: enrollment,
      error: enrollmentError,
    } =
      await supabase
        .from("enrollments")
        .select(
          "id, enrollment_status"
        )
        .eq(
          "student_id",
          user.id
        )
        .eq(
          "course_id",
          courseId
        )
        .in(
          "enrollment_status",
          [
            "active",
            "completed",
          ]
        )
        .maybeSingle();

    if (enrollmentError) {
      console.error(
        "Certificate enrollment lookup failed:",
        enrollmentError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify your enrollment.",
        },
        { status: 500 }
      );
    }

    if (!enrollment) {
      return NextResponse.json(
        {
          error:
            "You must be enrolled in this course before requesting a certificate.",
        },
        { status: 403 }
      );
    }

    /*
     * --------------------------------------------------------------
     * PUBLISHED CURRICULUM
     * --------------------------------------------------------------
     */

    const {
      data: curriculumData,
      error: curriculumError,
    } =
      await supabase
        .from("course_curriculum")
        .select(
          "lesson_id"
        )
        .eq(
          "course_id",
          courseId
        )
        .eq(
          "is_published",
          true
        );

    if (curriculumError) {
      console.error(
        "Certificate curriculum lookup failed:",
        curriculumError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify course curriculum.",
        },
        { status: 500 }
      );
    }

    const curriculum =
      (curriculumData ??
        []) as unknown as
        CurriculumLesson[];

    const publishedLessonIds =
      new Set(
        curriculum.map(
          (lesson) =>
            lesson.lesson_id
        )
      );

    const totalPublishedLessons =
      publishedLessonIds.size;

    if (
      totalPublishedLessons ===
      0
    ) {
      return NextResponse.json(
        {
          error:
            "This course does not have any published curriculum lessons.",
        },
        { status: 403 }
      );
    }

    /*
     * --------------------------------------------------------------
     * COMPLETED LESSONS
     * --------------------------------------------------------------
     */

    const {
      data: completedProgressData,
      error:
        completedProgressError,
    } =
      await supabase
        .from("lesson_progress")
        .select(
          "lesson_id"
        )
        .eq(
          "student_id",
          user.id
        )
        .eq(
          "course_id",
          courseId
        )
        .eq(
          "completed",
          true
        );

    if (completedProgressError) {
      console.error(
        "Certificate lesson progress lookup failed:",
        completedProgressError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify lesson completion.",
        },
        { status: 500 }
      );
    }

    const completedCurriculumLessonIds =
      new Set(
        (
          completedProgressData ??
          []
        )
          .map(
            (row) =>
              row.lesson_id as string
          )
          .filter(
            (lessonId) =>
              publishedLessonIds.has(
                lessonId
              )
          )
      );

    const completedLessons =
      completedCurriculumLessonIds.size;

    if (
      completedLessons <
      totalPublishedLessons
    ) {
      return NextResponse.json(
        {
          error:
            "Complete all published lessons before requesting a certificate.",
          completedLessons,
          totalLessons:
            totalPublishedLessons,
          progressPercent:
            Math.round(
              (completedLessons /
                totalPublishedLessons) *
                100
            ),
        },
        { status: 403 }
      );
    }

    /*
     * --------------------------------------------------------------
     * ASSESSMENT
     * --------------------------------------------------------------
     *
     * Retakes are allowed. The latest assessment attempt must
     * meet the same 70% passing threshold used by the admin
     * project approval workflow.
     */

    const {
      data: assessmentData,
      error: assessmentError,
    } =
      await supabase
        .from(
          "assessment_attempts"
        )
        .select(
          "id, score, total_points, earned_points"
        )
        .eq(
          "student_id",
          user.id
        )
        .eq(
          "course_id",
          courseId
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        )
        .limit(1);

    if (assessmentError) {
      console.error(
        "Certificate assessment lookup failed:",
        assessmentError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify your course assessment.",
        },
        { status: 500 }
      );
    }

    const assessmentAttempts =
      (assessmentData ??
        []) as unknown as
        AssessmentAttempt[];

    if (
      assessmentAttempts.length ===
      0
    ) {
      return NextResponse.json(
        {
          error:
            "Complete the course assessment before requesting a certificate.",
        },
        { status: 403 }
      );
    }

    const latestAssessment =
      assessmentAttempts[0];

    const assessmentPercentage =
      calculateAssessmentPercentage(
        latestAssessment
      );

    if (
      assessmentPercentage ===
        null ||
      assessmentPercentage <
        PASS_PERCENTAGE
    ) {
      return NextResponse.json(
        {
          error:
            `Your latest assessment result must be at least ${PASS_PERCENTAGE}% before a certificate can be issued.`,
          score:
            assessmentPercentage,
          passingScore:
            PASS_PERCENTAGE,
        },
        { status: 403 }
      );
    }

    /*
     * --------------------------------------------------------------
     * PUBLISHED CAPSTONE
     * --------------------------------------------------------------
     */

    const {
      data: projectsData,
      error: projectsError,
    } =
      await supabase
        .from(
          "course_projects"
        )
        .select(
          "id, project_type"
        )
        .eq(
          "course_id",
          courseId
        )
        .eq(
          "is_published",
          true
        );

    if (projectsError) {
      console.error(
        "Certificate project lookup failed:",
        projectsError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify the course capstone.",
        },
        { status: 500 }
      );
    }

    const projects =
      (projectsData ??
        []) as unknown as
        Project[];

    const capstoneProjects =
      projects.filter(
        (project) =>
          project.project_type ===
          "capstone"
      );

    const capstoneIds =
      capstoneProjects.map(
        (project) =>
          project.id
      );

    if (
      capstoneIds.length ===
      0
    ) {
      return NextResponse.json(
        {
          error:
            "This course does not have a published capstone.",
        },
        { status: 403 }
      );
    }

    /*
     * --------------------------------------------------------------
     * APPROVED CAPSTONE
     * --------------------------------------------------------------
     *
     * Only an approved submission for a published capstone
     * qualifies for certificate issuance.
     */

    const {
      data: approvedData,
      error: approvedError,
    } =
      await supabase
        .from(
          "project_submissions"
        )
        .select(
          "score"
        )
        .in(
          "project_id",
          capstoneIds
        )
        .eq(
          "student_id",
          user.id
        )
        .eq(
          "status",
          "approved"
        )
        .order(
          "reviewed_at",
          {
            ascending: false,
          }
        )
        .limit(1);

    if (approvedError) {
      console.error(
        "Certificate capstone lookup failed:",
        approvedError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify your capstone.",
        },
        { status: 500 }
      );
    }

    const approvedSubmissions =
      (approvedData ??
        []) as unknown as
        ApprovedSubmission[];

    if (
      approvedSubmissions.length ===
      0
    ) {
      return NextResponse.json(
        {
          error:
            "Your capstone must be approved before a certificate can be issued.",
        },
        { status: 403 }
      );
    }

    const approved =
      approvedSubmissions[0];

    /*
     * --------------------------------------------------------------
     * LEARNER PROFILE
     * --------------------------------------------------------------
     */

    const {
      data: profile,
      error: profileError,
    } =
      await supabase
        .from("profiles")
        .select(
          "full_name, email"
        )
        .eq(
          "id",
          user.id
        )
        .maybeSingle();

    if (profileError) {
      console.error(
        "Certificate profile lookup failed:",
        profileError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load your learner profile.",
        },
        { status: 500 }
      );
    }

    const holderName =
      profile?.full_name ||
      profile?.email ||
      "Learner";

    /*
     * --------------------------------------------------------------
     * EXISTING CERTIFICATE
     * --------------------------------------------------------------
     *
     * Issuance is idempotent.
     */

    const {
      data: existingData,
      error: existingError,
    } =
      await supabase
        .from(
          "course_certificates"
        )
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

    if (existingError) {
      console.error(
        "Certificate lookup failed:",
        existingError
      );

      return NextResponse.json(
        {
          error:
            "Unable to check existing certificate.",
        },
        { status: 500 }
      );
    }

    const existing =
      existingData as unknown as
        | ExistingCertificate
        | null;

    if (existing) {
      return NextResponse.json({
        certificateId:
          existing.id,
        certificateNumber:
          existing.certificate_number,
      });
    }

    /*
     * --------------------------------------------------------------
     * ISSUE CERTIFICATE
     * --------------------------------------------------------------
     */

    const {
      data: certificate,
      error: certificateError,
    } =
      await supabase
        .from(
          "course_certificates"
        )
        .insert({
          student_id: user.id,
          course_id: courseId,
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
            approved.score,
          is_revoked: false,
        })
        .select(
          "id, certificate_number"
        )
        .single();

    if (
      certificateError ||
      !certificate
    ) {
      console.error(
        "Certificate issuance failed:",
        certificateError
      );

      return NextResponse.json(
        {
          error:
            certificateError?.message ||
            "Unable to issue certificate.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      certificateId:
        certificate.id,
      certificateNumber:
        certificate.certificate_number,
    });
  } catch (error) {
    console.error(
      "Certificate issuance error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to issue certificate.",
      },
      { status: 500 }
    );
  }
}