import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Project = {
  id: string;
  course_id: string;
};

type SubmissionStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_required";

type Submission = {
  id: string;
  status: SubmissionStatus;
};

type RequestBody = {
  submissionText?: unknown;
  submissionUrl?: unknown;
  status?: unknown;
};

const MAX_SUBMISSION_TEXT_LENGTH = 50_000;
const MAX_SUBMISSION_URL_LENGTH = 2_048;

function isValidSubmissionUrl(
  value: string
) {
  try {
    const url = new URL(value);

    return (
      (url.protocol === "http:" ||
        url.protocol === "https:") &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      projectId: string;
    }>;
  }
) {
  try {
    const { projectId } = await context.params;

    if (!projectId) {
      return NextResponse.json(
        {
          error: "Project ID is required.",
        },
        { status: 400 }
      );
    }

    const supabase =
      await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

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

    if (
      body.status !== "draft" &&
      body.status !== "submitted"
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid submission status.",
        },
        { status: 400 }
      );
    }

    const status =
      body.status;

    const submissionText =
      typeof body.submissionText ===
      "string"
        ? body.submissionText.trim()
        : "";

    const submissionUrl =
      typeof body.submissionUrl ===
      "string"
        ? body.submissionUrl.trim()
        : "";

    if (
      submissionText.length >
      MAX_SUBMISSION_TEXT_LENGTH
    ) {
      return NextResponse.json(
        {
          error:
            "The written submission is too long.",
        },
        { status: 400 }
      );
    }

    if (
      submissionUrl.length >
      MAX_SUBMISSION_URL_LENGTH
    ) {
      return NextResponse.json(
        {
          error:
            "The supporting project link is too long.",
        },
        { status: 400 }
      );
    }

    if (
      status === "submitted" &&
      !submissionText &&
      !submissionUrl
    ) {
      return NextResponse.json(
        {
          error:
            "Provide written work or a supporting project link before submitting.",
        },
        { status: 400 }
      );
    }

    if (
      submissionUrl &&
      !isValidSubmissionUrl(
        submissionUrl
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Enter a valid supporting project URL using http:// or https://.",
        },
        { status: 400 }
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
        .eq("id", projectId)
        .eq("is_published", true)
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
            "Project not found.",
        },
        { status: 404 }
      );
    }

    /*
     * A learner may submit project work while
     * actively enrolled or after the course has
     * been marked completed.
     *
     * Project submission does not itself complete
     * the course. Course completion and certificate
     * eligibility are verified separately.
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
          project.course_id
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
        "Enrollment lookup failed:",
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

    if (!enrollment) {
      return NextResponse.json(
        {
          error:
            "You must be enrolled in this course.",
        },
        { status: 403 }
      );
    }

    const {
      data: existingData,
      error: existingError,
    } =
      await supabase
        .from("project_submissions")
        .select(
          "id, status"
        )
        .eq(
          "project_id",
          projectId
        )
        .eq(
          "student_id",
          user.id
        )
        .maybeSingle();

    if (existingError) {
      console.error(
        "Existing submission lookup failed:",
        existingError
      );

      return NextResponse.json(
        {
          error:
            "Unable to check the existing submission.",
        },
        { status: 500 }
      );
    }

    const existing =
      existingData as unknown as
        | Submission
        | null;

    /*
     * Only drafts and explicitly returned
     * revision_required submissions may be edited.
     */
    if (
      existing &&
      ![
        "draft",
        "revision_required",
      ].includes(
        existing.status
      )
    ) {
      return NextResponse.json(
        {
          error:
            "This submission is locked while it is being reviewed or after approval.",
        },
        { status: 409 }
      );
    }

    /*
     * A revision_required submission becomes a
     * normal editable draft when the learner saves
     * without submitting.
     *
     * Once submitted, it enters the review workflow.
     */
    const timestamp =
      new Date().toISOString();

    const payload = {
      project_id: projectId,
      student_id: user.id,

      submission_text:
        submissionText || null,

      submission_url:
        submissionUrl || null,

      status,

      /*
       * A new submission must be reviewed again.
       * Previous review results must not survive
       * a resubmission.
       */
      score: null,
      feedback: null,
      reviewed_at: null,
      reviewed_by: null,

      submitted_at:
        status === "submitted"
          ? timestamp
          : null,

      updated_at: timestamp,
    };

    const {
      error: submissionError,
    } = await supabase
      .from("project_submissions")
      .upsert(
        payload,
        {
          onConflict:
            "project_id,student_id",
        }
      );

    if (submissionError) {
      console.error(
        "Project submission save failed:",
        submissionError
      );

      return NextResponse.json(
        {
          error:
            "Unable to save the project submission.",
        },
        { status: 500 }
      );
    }

    /*
     * Activity logging is supplementary analytics.
     * Failure here must not invalidate the
     * successful project save.
     */
    const {
      error: activityError,
    } = await supabase
      .from("learning_activity")
      .insert({
        student_id: user.id,
        course_id:
          project.course_id,
        activity_type:
          status === "submitted"
            ? "project_submitted"
            : "project_draft_saved",
        metadata: {
          project_id: projectId,
          status,
        },
      });

    if (activityError) {
      console.error(
        "Project activity logging failed:",
        activityError
      );
    }

    return NextResponse.json({
      message:
        status === "submitted"
          ? "Project submitted for review."
          : "Draft saved.",
    });
  } catch (error) {
    console.error(
      "Project submission API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "An unexpected error occurred while saving the project submission.",
      },
      { status: 500 }
    );
  }
}