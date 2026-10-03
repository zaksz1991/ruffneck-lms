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

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      projectId: string;
    }>;
  }
) {
  const { projectId } =
    await context.params;

  const supabase = await createClient();

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

  let body: {
    submissionText?: string;
    submissionUrl?: string;
    status?: "draft" | "submitted";
  };

  try {
    body =
      (await request.json()) as {
        submissionText?: string;
        submissionUrl?: string;
        status?: "draft" | "submitted";
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

  const status =
    body.status === "submitted"
      ? "submitted"
      : "draft";

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
    !/^https?:\/\/.+/i.test(
      submissionUrl
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Supporting link must begin with http:// or https://.",
      },
      { status: 400 }
    );
  }

  const { data: projectData } =
    await supabase
      .from("course_projects")
      .select("id, course_id")
      .eq("id", projectId)
      .eq("is_published", true)
      .maybeSingle();

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

  const { data: enrollment } =
    await supabase
      .from("enrollments")
      .select(
        "id, enrollment_status"
      )
      .eq("student_id", user.id)
      .eq("course_id", project.course_id)
      .in("enrollment_status", [
        "active",
        "completed",
      ])
      .maybeSingle();

  if (!enrollment) {
    return NextResponse.json(
      {
        error:
          "You must be enrolled in this course.",
      },
      { status: 403 }
    );
  }

  const { data: existingData } =
    await supabase
      .from("project_submissions")
      .select("id, status")
      .eq("project_id", projectId)
      .eq("student_id", user.id)
      .maybeSingle();

  const existing =
    existingData as unknown as Submission | null;

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
    score:
      status === "submitted"
        ? null
        : undefined,
    reviewed_at:
      status === "submitted"
        ? null
        : undefined,
    reviewed_by:
      status === "submitted"
        ? null
        : undefined,
    submitted_at:
      status === "submitted"
        ? timestamp
        : null,
    updated_at: timestamp,
  };

  const { error } =
    await supabase
      .from("project_submissions")
      .upsert(payload, {
        onConflict:
          "project_id,student_id",
      });

  if (error) {
    return NextResponse.json(
      {
        error: error.message,
      },
      { status: 500 }
    );
  }

  const { error: activityError } =
    await supabase
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
}