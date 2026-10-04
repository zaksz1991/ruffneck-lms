import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Profile = {
  id: string;
  role: "student" | "instructor" | "admin";
};

type Submission = {
  id: string;
  project_id: string;
  student_id: string;
  status:
    | "draft"
    | "submitted"
    | "under_review"
    | "approved"
    | "revision_required";
};

type Project = {
  id: string;
  course_id: string;
};

type Course = {
  id: string;
  title: string;
  slug: string;
};

type CurriculumRow = {
  lesson_id: string;
};

type RequestBody = {
  status?: unknown;
  score?: unknown;
  feedback?: unknown;
};

const REVIEW_STATUSES = [
  "submitted",
  "under_review",
  "approved",
  "revision_required",
] as const;

type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      submissionId: string;
    }>;
  }
) {
  try {
    const { submissionId } = await context.params;

    if (!submissionId) {
      return NextResponse.json(
        {
          error: "Submission ID is required.",
        },
        { status: 400 }
      );
    }

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

    const { data: profileData, error: profileError } =
      await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        {
          error: profileError.message,
        },
        { status: 500 }
      );
    }

    const profile =
      profileData as unknown as Profile | null;

    if (
      !profile ||
      !["admin", "instructor"].includes(
        profile.role
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You are not authorised to review projects.",
        },
        { status: 403 }
      );
    }

    let body: RequestBody;

    try {
      body = (await request.json()) as RequestBody;
    } catch {
      return NextResponse.json(
        {
          error: "Invalid request body.",
        },
        { status: 400 }
      );
    }

    const requestedStatus =
      typeof body.status === "string"
        ? body.status
        : "";

    if (
      !REVIEW_STATUSES.includes(
        requestedStatus as ReviewStatus
      )
    ) {
      return NextResponse.json(
        {
          error: "Invalid review status.",
        },
        { status: 400 }
      );
    }

    const status =
      requestedStatus as ReviewStatus;

    /*
     * Scores are optional, but when supplied they must
     * be integer values from 0 to 100.
     */
    let score: number | null = null;

    if (
      body.score !== null &&
      body.score !== undefined &&
      body.score !== ""
    ) {
      const numericScore =
        typeof body.score === "number"
          ? body.score
          : Number(body.score);

      if (
        !Number.isInteger(numericScore) ||
        numericScore < 0 ||
        numericScore > 100
      ) {
        return NextResponse.json(
          {
            error:
              "Score must be between 0 and 100.",
          },
          { status: 400 }
        );
      }

      score = numericScore;
    }

    const feedback =
      typeof body.feedback === "string"
        ? body.feedback.trim()
        : "";

    const { data: submissionData, error: submissionError } =
      await supabase
        .from("project_submissions")
        .select(
          "id, project_id, student_id, status"
        )
        .eq("id", submissionId)
        .maybeSingle();

    if (submissionError) {
      return NextResponse.json(
        {
          error: submissionError.message,
        },
        { status: 500 }
      );
    }

    const submission =
      submissionData as unknown as Submission | null;

    if (!submission) {
      return NextResponse.json(
        {
          error: "Submission not found.",
        },
        { status: 404 }
      );
    }

    const { data: projectData, error: projectError } =
      await supabase
        .from("course_projects")
        .select("id, course_id")
        .eq("id", submission.project_id)
        .maybeSingle();

    if (projectError) {
      return NextResponse.json(
        {
          error: projectError.message,
        },
        { status: 500 }
      );
    }

    const project =
      projectData as unknown as Project | null;

    if (!project) {
      return NextResponse.json(
        {
          error: "Project not found.",
        },
        { status: 404 }
      );
    }

    const { data: courseData, error: courseError } =
      await supabase
        .from("courses")
        .select("id, title, slug")
        .eq("id", project.course_id)
        .maybeSingle();

    if (courseError) {
      return NextResponse.json(
        {
          error: courseError.message,
        },
        { status: 500 }
      );
    }

    const course =
      courseData as unknown as Course | null;

    if (!course) {
      return NextResponse.json(
        {
          error: "Course not found.",
        },
        { status: 404 }
      );
    }

    /*
     * Instructors may only review submissions belonging
     * to courses they manage.
     */
    if (profile.role !== "admin") {
      const { data: ownedCourse, error: ownershipError } =
        await supabase
          .from("courses")
          .select("id")
          .eq("id", project.course_id)
          .eq("instructor_id", user.id)
          .maybeSingle();

      if (ownershipError) {
        return NextResponse.json(
          {
            error: ownershipError.message,
          },
          { status: 500 }
        );
      }

      if (!ownedCourse) {
        return NextResponse.json(
          {
            error:
              "You do not manage this course.",
          },
          { status: 403 }
        );
      }
    }

    /*
     * A new review may only operate on an existing
     * submission. Drafts should not be directly approved.
     */
    if (
      status === "approved" &&
      ![
        "submitted",
        "under_review",
        "revision_required",
      ].includes(submission.status)
    ) {
      return NextResponse.json(
        {
          error:
            "Only a submitted project can be approved.",
        },
        { status: 409 }
      );
    }

    const timestamp =
      new Date().toISOString();

    /*
     * Save the review decision first.
     */
    const { error: reviewError } =
      await supabase
        .from("project_submissions")
        .update({
          status,
          score,
          feedback: feedback || null,
          reviewed_at: timestamp,
          reviewed_by: user.id,
          updated_at: timestamp,
        })
        .eq("id", submission.id);

    if (reviewError) {
      return NextResponse.json(
        {
          error: reviewError.message,
        },
        { status: 500 }
      );
    }

    /*
     * Revision required:
     *
     * The learner must remain active so they can edit
     * and resubmit the project.
     */
    if (status === "revision_required") {
      const { error: enrollmentError } =
        await supabase
          .from("enrollments")
          .update({
            enrollment_status: "active",
            completed_at: null,
          })
          .eq(
            "student_id",
            submission.student_id
          )
          .eq(
            "course_id",
            project.course_id
          );

      if (enrollmentError) {
        return NextResponse.json(
          {
            error:
              enrollmentError.message,
          },
          { status: 500 }
        );
      }
    }

    /*
     * Approval does NOT directly create a certificate.
     *
     * First verify the complete learning state using the
     * same canonical curriculum source used by the learner
     * and certificate systems.
     */
    if (status === "approved") {
      const {
        data: curriculumData,
        error: curriculumError,
      } = await supabase
        .from("course_curriculum")
        .select("lesson_id")
        .eq(
          "course_id",
          project.course_id
        )
        .eq("is_published", true);

      if (curriculumError) {
        return NextResponse.json(
          {
            error:
              curriculumError.message,
          },
          { status: 500 }
        );
      }

      const curriculum =
        (curriculumData ??
          []) as unknown as CurriculumRow[];

      const publishedLessonIds =
        new Set(
          curriculum.map(
            (row) => row.lesson_id
          )
        );

      const totalPublishedLessons =
        publishedLessonIds.size;

      const {
        data: progressData,
        error: progressError,
      } = await supabase
        .from("lesson_progress")
        .select("lesson_id")
        .eq(
          "student_id",
          submission.student_id
        )
        .eq(
          "course_id",
          project.course_id
        )
        .eq("completed", true);

      if (progressError) {
        return NextResponse.json(
          {
            error:
              progressError.message,
          },
          { status: 500 }
        );
      }

      const completedPublishedLessons =
        new Set(
          (progressData ?? [])
            .map(
              (row) => row.lesson_id
            )
            .filter((lessonId) =>
              publishedLessonIds.has(
                lessonId
              )
            )
        );

      const lessonsComplete =
        totalPublishedLessons > 0 &&
        completedPublishedLessons.size >=
          totalPublishedLessons;

      /*
       * Assessment completion remains an independent
       * requirement. This matches the certificate route.
       */
      const {
        count: assessmentAttempts,
        error: assessmentError,
      } = await supabase
        .from("assessment_attempts")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq(
          "student_id",
          submission.student_id
        )
        .eq(
          "course_id",
          project.course_id
        );

      if (assessmentError) {
        return NextResponse.json(
          {
            error:
              assessmentError.message,
          },
          { status: 500 }
        );
      }

      const assessmentComplete =
        (assessmentAttempts ?? 0) > 0;

      const courseComplete =
        lessonsComplete &&
        assessmentComplete;

      /*
       * Enrollment completion is only updated after all
       * canonical learning requirements have been verified.
       *
       * Certificate creation remains owned by the dedicated
       * certificate issuance endpoint.
       */
      if (courseComplete) {
        const {
          error: enrollmentError,
        } = await supabase
          .from("enrollments")
          .update({
            enrollment_status: "completed",
            completed_at: timestamp,
            progress_percent: 100,
          })
          .eq(
            "student_id",
            submission.student_id
          )
          .eq(
            "course_id",
            project.course_id
          );

        if (enrollmentError) {
          return NextResponse.json(
            {
              error:
                enrollmentError.message,
            },
            { status: 500 }
          );
        }
      }
    }

    /*
     * Activity logging is supplementary analytics.
     * Failure here must not invalidate a successfully
     * saved review decision.
     */
    const { error: activityError } =
      await supabase
        .from("learning_activity")
        .insert({
          student_id:
            submission.student_id,
          course_id:
            project.course_id,
          activity_type:
            status === "approved"
              ? "project_approved"
              : "project_reviewed",
          metadata: {
            project_id: project.id,
            submission_id:
              submission.id,
            status,
            score,
          },
        });

    if (activityError) {
      console.error(
        "Project review activity logging failed:",
        activityError
      );
    }

    return NextResponse.json({
      message:
        status === "approved"
          ? "Project approved and review saved."
          : "Project review saved.",
    });
  } catch (error) {
    console.error(
      "Project review error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "An unexpected error occurred while processing the project review.",
      },
      { status: 500 }
    );
  }
}