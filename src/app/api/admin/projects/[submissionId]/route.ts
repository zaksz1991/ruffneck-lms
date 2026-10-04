import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Profile = {
  id: string;
  role: "student" | "instructor" | "admin";
};

type SubmissionStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_required";

type Submission = {
  id: string;
  project_id: string;
  student_id: string;
  status: SubmissionStatus;
};

type Project = {
  id: string;
  course_id: string;
};

type CurriculumRow = {
  lesson_id: string;
};

type AssessmentAttempt = {
  id: string;
  score: number | null;
  total_points: number | null;
  earned_points: number | null;
};

type RequestBody = {
  status?: unknown;
  score?: unknown;
  feedback?: unknown;
};

const REVIEW_STATUSES = [
  "under_review",
  "approved",
  "revision_required",
] as const;

type ReviewStatus =
  (typeof REVIEW_STATUSES)[number];

const PASS_PERCENTAGE = 70;
const MAX_FEEDBACK_LENGTH = 10_000;

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

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      submissionId: string;
    }>;
  }
) {
  try {
    const { submissionId } =
      await context.params;

    if (!submissionId) {
      return NextResponse.json(
        {
          error:
            "Submission ID is required.",
        },
        { status: 400 }
      );
    }

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

    const {
      data: profileData,
      error: profileError,
    } =
      await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {
      console.error(
        "Profile lookup failed:",
        profileError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify reviewer permissions.",
        },
        { status: 500 }
      );
    }

    const profile =
      profileData as unknown as
        | Profile
        | null;

    if (
      !profile ||
      ![
        "admin",
        "instructor",
      ].includes(profile.role)
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

    const requestedStatus =
      typeof body.status ===
      "string"
        ? body.status
        : "";

    if (
      !REVIEW_STATUSES.includes(
        requestedStatus as ReviewStatus
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid review status.",
        },
        { status: 400 }
      );
    }

    const status =
      requestedStatus as ReviewStatus;

    let score: number | null = null;

    if (
      body.score !== null &&
      body.score !== undefined &&
      body.score !== ""
    ) {
      const numericScore =
        typeof body.score ===
        "number"
          ? body.score
          : Number(body.score);

      if (
        !Number.isInteger(
          numericScore
        ) ||
        numericScore < 0 ||
        numericScore > 100
      ) {
        return NextResponse.json(
          {
            error:
              "Score must be an integer between 0 and 100.",
          },
          { status: 400 }
        );
      }

      score = numericScore;
    }

    const feedback =
      typeof body.feedback ===
      "string"
        ? body.feedback.trim()
        : "";

    if (
      feedback.length >
      MAX_FEEDBACK_LENGTH
    ) {
      return NextResponse.json(
        {
          error:
            "Review feedback is too long.",
        },
        { status: 400 }
      );
    }

    const {
      data: submissionData,
      error: submissionError,
    } =
      await supabase
        .from("project_submissions")
        .select(
          "id, project_id, student_id, status"
        )
        .eq(
          "id",
          submissionId
        )
        .maybeSingle();

    if (submissionError) {
      console.error(
        "Submission lookup failed:",
        submissionError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load the submission.",
        },
        { status: 500 }
      );
    }

    const submission =
      submissionData as unknown as
        | Submission
        | null;

    if (!submission) {
      return NextResponse.json(
        {
          error:
            "Submission not found.",
        },
        { status: 404 }
      );
    }

    const {
      data: projectData,
      error: projectError,
    } =
      await supabase
        .from("course_projects")
        .select(
          "id, course_id"
        )
        .eq(
          "id",
          submission.project_id
        )
        .eq(
          "is_published",
          true
        )
        .maybeSingle();

    if (projectError) {
      console.error(
        "Project lookup failed:",
        projectError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load the project.",
        },
        { status: 500 }
      );
    }

    const project =
      projectData as unknown as
        | Project
        | null;

    if (!project) {
      return NextResponse.json(
        {
          error:
            "Project not found or is no longer published.",
        },
        { status: 404 }
      );
    }

    /*
     * Instructors may only review projects
     * belonging to courses they manage.
     */
    if (
      profile.role !==
      "admin"
    ) {
      const {
        data: ownedCourse,
        error: ownershipError,
      } =
        await supabase
          .from("courses")
          .select("id")
          .eq(
            "id",
            project.course_id
          )
          .eq(
            "instructor_id",
            user.id
          )
          .maybeSingle();

      if (ownershipError) {
        console.error(
          "Course ownership check failed:",
          ownershipError
        );

        return NextResponse.json(
          {
            error:
              "Unable to verify course ownership.",
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
     * A review can only be performed on a
     * submitted or previously returned submission.
     *
     * Drafts cannot be reviewed directly.
     */
    if (
      ![
        "submitted",
        "under_review",
        "revision_required",
      ].includes(
        submission.status
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Only submitted project work can be reviewed.",
        },
        { status: 409 }
      );
    }

    /*
     * Approval requires an explicit score.
     */
    if (
      status === "approved" &&
      score === null
    ) {
      return NextResponse.json(
        {
          error:
            "A score is required before approving a project.",
        },
        { status: 400 }
      );
    }

    /*
     * Approval requires the learner to have
     * completed every published lesson.
     */
    let lessonsComplete = false;
    let assessmentComplete = false;

    if (
      status === "approved"
    ) {
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
            project.course_id
          )
          .eq(
            "is_published",
            true
          );

      if (curriculumError) {
        console.error(
          "Curriculum lookup failed:",
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
        (curriculumData ??
          []) as unknown as
          CurriculumRow[];

      const publishedLessonIds =
        new Set(
          curriculum.map(
            (row) =>
              row.lesson_id
          )
        );

      if (
        publishedLessonIds.size ===
        0
      ) {
        return NextResponse.json(
          {
            error:
              "This course does not currently have a published curriculum.",
          },
          { status: 409 }
        );
      }

      const {
        data: progressData,
        error: progressError,
      } =
        await supabase
          .from("lesson_progress")
          .select(
            "lesson_id"
          )
          .eq(
            "student_id",
            submission.student_id
          )
          .eq(
            "course_id",
            project.course_id
          )
          .eq(
            "completed",
            true
          );

      if (progressError) {
        console.error(
          "Lesson progress lookup failed:",
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

      const completedPublishedLessons =
        new Set(
          (progressData ??
            [])
            .map(
              (row) =>
                row.lesson_id
            )
            .filter(
              (lessonId) =>
                publishedLessonIds.has(
                  lessonId
                )
            )
        );

      lessonsComplete =
        completedPublishedLessons.size >=
        publishedLessonIds.size;

      if (!lessonsComplete) {
        return NextResponse.json(
          {
            error:
              "The learner must complete all published lessons before the project can be approved.",
          },
          { status: 409 }
        );
      }

      /*
       * Assessment completion requires a
       * passing assessment attempt.
       *
       * The latest attempt is used because
       * retakes are allowed.
       */
      const {
        data: assessmentData,
        error: assessmentError,
      } =
        await supabase
          .from("assessment_attempts")
          .select(
            "id, score, total_points, earned_points"
          )
          .eq(
            "student_id",
            submission.student_id
          )
          .eq(
            "course_id",
            project.course_id
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
          "Assessment lookup failed:",
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

      const attempts =
        (assessmentData ??
          []) as unknown as
          AssessmentAttempt[];

      if (
        attempts.length ===
        0
      ) {
        return NextResponse.json(
          {
            error:
              "The learner must complete and pass the course assessment before the project can be approved.",
          },
          { status: 409 }
        );
      }

      const latestAttempt =
        attempts[0];

      const assessmentPercentage =
        calculateAssessmentPercentage(
          latestAttempt
        );

      assessmentComplete =
        assessmentPercentage !==
          null &&
        assessmentPercentage >=
          PASS_PERCENTAGE;

      if (
        !assessmentComplete
      ) {
        return NextResponse.json(
          {
            error:
              `The learner's latest assessment result is below the ${PASS_PERCENTAGE}% passing threshold.`,
          },
          { status: 409 }
        );
      }
    }

    const timestamp =
      new Date().toISOString();

    /*
     * Save the review decision.
     */
    const {
      error: reviewError,
    } = await supabase
      .from(
        "project_submissions"
      )
      .update({
        status,
        score,
        feedback:
          feedback || null,
        reviewed_at:
          timestamp,
        reviewed_by:
          user.id,
        updated_at:
          timestamp,
      })
      .eq(
        "id",
        submission.id
      );

    if (reviewError) {
      console.error(
        "Project review update failed:",
        reviewError
      );

      return NextResponse.json(
        {
          error:
            "Unable to save the project review.",
        },
        { status: 500 }
      );
    }

    /*
     * Revision required:
     *
     * Keep the learner active so the
     * project can be edited and resubmitted.
     */
    if (
      status ===
      "revision_required"
    ) {
      const {
        error: enrollmentError,
      } =
        await supabase
          .from("enrollments")
          .update({
            enrollment_status:
              "active",
            completed_at:
              null,
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
        console.error(
          "Enrollment revision update failed:",
          enrollmentError
        );

        return NextResponse.json(
          {
            error:
              "Review was saved, but learner enrollment could not be updated.",
          },
          { status: 500 }
        );
      }
    }

    /*
     * Approval only completes the course when
     * every required learning condition has
     * already been verified.
     *
     * Certificate issuance remains separate.
     */
    if (
      status === "approved" &&
      lessonsComplete &&
      assessmentComplete
    ) {
      const {
        error: enrollmentError,
      } =
        await supabase
          .from("enrollments")
          .update({
            enrollment_status:
              "completed",
            completed_at:
              timestamp,
            progress_percent:
              100,
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
        console.error(
          "Course completion update failed:",
          enrollmentError
        );

        return NextResponse.json(
          {
            error:
              "Project was approved, but course completion could not be recorded.",
          },
          { status: 500 }
        );
      }
    }

    /*
     * Activity logging is supplementary.
     * Failure here must not invalidate
     * the saved review decision.
     */
    const {
      error: activityError,
    } =
      await supabase
        .from(
          "learning_activity"
        )
        .insert({
          student_id:
            submission.student_id,
          course_id:
            project.course_id,
          activity_type:
            status ===
            "approved"
              ? "project_approved"
              : "project_reviewed",
          metadata: {
            project_id:
              project.id,
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
        status ===
        "approved"
          ? "Project approved and review saved."
          : status ===
              "revision_required"
          ? "Revision requested and review saved."
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