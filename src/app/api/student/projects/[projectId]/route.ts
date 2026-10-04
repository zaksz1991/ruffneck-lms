import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Project = {
  id: string;
  course_id: string;
};

type Submission = {
  id: string;
  status:
    | "draft"
    | "submitted"
    | "under_review"
    | "approved"
    | "revision_required";
};

type RequestBody = {
  submissionText?: unknown;
  submissionUrl?: unknown;
  status?: unknown;
};

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

    const status =
      body.status === "submitted"
        ? "submitted"
        : "draft";

    const submissionText =
      typeof body.submissionText === "string"
        ? body.submissionText.trim()
        : "";

    const submissionUrl =
      typeof body.submissionUrl === "string"
        ? body.submissionUrl.trim()
        : "";

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
      !/^https?:\/\/.+/i.test(submissionUrl)
    ) {
      return NextResponse.json(
        {
          error:
            "Supporting link must begin with http:// or https://.",
        },
        { status: 400 }
      );
    }

    const { data: projectData, error: projectError } =
      await supabase
        .from("course_projects")
        .select("id, course_id")
        .eq("id", projectId)
        .eq("is_published", true)
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

    /*
     * Project work may be submitted while the learner is
     * actively enrolled or while the enrollment record has
     * already been marked completed.
     *
     * Course completion itself is NOT determined here.
     * The certificate route independently verifies:
     * - completed published lessons
     * - assessment completion
     * - approved capstone submission
     */
    const { data: enrollment, error: enrollmentError } =
      await supabase
        .from("enrollments")
        .select("id, enrollment_status")
        .eq("student_id", user.id)
        .eq("course_id", project.course_id)
        .in("enrollment_status", [
          "active",
          "completed",
        ])
        .maybeSingle();

    if (enrollmentError) {
      return NextResponse.json(
        {
          error: enrollmentError.message,
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

    const { data: existingData, error: existingError } =
      await supabase
        .from("project_submissions")
        .select("id, status")
        .eq("project_id", projectId)
        .eq("student_id", user.id)
        .maybeSingle();

    if (existingError) {
      return NextResponse.json(
        {
          error: existingError.message,
        },
        { status: 500 }
      );
    }

    const existing =
      existingData as unknown as Submission | null;

    /*
     * Submitted, under_review and approved records are
     * intentionally locked. Only a draft or a submission
     * explicitly returned for revision can be changed.
     */
    if (
      existing &&
      ![
        "draft",
        "revision_required",
      ].includes(existing.status)
    ) {
      return NextResponse.json(
        {
          error:
            "This submission is currently locked while it is being reviewed.",
        },
        { status: 409 }
      );
    }

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
       * Any new submission invalidates the previous review
       * state. The project must be reviewed again before it
       * can qualify as an approved capstone.
       */
      score: null,
      reviewed_at: null,
      reviewed_by: null,

      submitted_at:
        status === "submitted"
          ? timestamp
          : null,

      updated_at: timestamp,
    };

    const { error: submissionError } =
      await supabase
        .from("project_submissions")
        .upsert(payload, {
          onConflict:
            "project_id,student_id",
        });

    if (submissionError) {
      return NextResponse.json(
        {
          error: submissionError.message,
        },
        { status: 500 }
      );
    }

    /*
     * Activity logging is supplementary analytics.
     * Failure here must not invalidate a successful
     * project save/submission.
     */
    const { error: activityError } =
      await supabase
        .from("learning_activity")
        .insert({
          student_id: user.id,
          course_id: project.course_id,
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
      "Project submission error:",
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