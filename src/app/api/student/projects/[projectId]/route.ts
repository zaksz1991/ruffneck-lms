import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Project = {
  id: string;
  course_id: string;
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

type Profile = {
  id: string;
  role:
    | "student"
    | "instructor"
    | "admin";
};

async function getCurrentUser() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    supabase,
    user,
  };
}

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

  const {
    supabase,
    user,
  } = await getCurrentUser();

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
        error:
          "Project not found.",
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
      .select(
        "id, project_id, student_id, status"
      )
      .eq("project_id", projectId)
      .eq("student_id", user.id)
      .maybeSingle();

  const existing =
    existingData as unknown as Submission | null;

  if (
    existing &&
    existing.status !== "draft"
  ) {
    return NextResponse.json(
      {
        error:
          "This submission has already been sent for review and is locked.",
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
}


export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      projectId: string;
    }>;
  }
) {
  const { projectId } =
    await context.params;

  const {
    supabase,
    user,
  } = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      {
        error:
          "Authentication required.",
      },
      { status: 401 }
    );
  }

  const { data: profileData } =
    await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

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

  let body: {
    status?: string;
    score?: number | null;
    feedback?: string;
  };

  try {
    body =
      (await request.json()) as {
        status?: string;
        score?: number | null;
        feedback?: string;
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

  const allowedStatuses = [
    "submitted",
    "under_review",
    "approved",
    "revision_required",
  ];

  if (
    !body.status ||
    !allowedStatuses.includes(
      body.status
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

  const score =
    body.score === null ||
    body.score === undefined
      ? null
      : Number(body.score);

  if (
    score !== null &&
    (!Number.isInteger(score) ||
      score < 0 ||
      score > 100)
  ) {
    return NextResponse.json(
      {
        error:
          "Score must be between 0 and 100.",
      },
      { status: 400 }
    );
  }

  const { data: submissionData } =
    await supabase
      .from("project_submissions")
      .select(
        [
          "id",
          "project_id",
          "student_id",
          "status",
        ].join(", ")
      )
      .eq("id", projectId)
      .maybeSingle();

  const submission =
    submissionData as unknown as Submission | null;

  if (!submission) {
    return NextResponse.json(
      {
        error:
          "Submission not found.",
      },
      { status: 404 }
    );
  }

  const { data: projectData } =
    await supabase
      .from("course_projects")
      .select(
        "id, course_id"
      )
      .eq(
        "id",
        submission.project_id
      )
      .maybeSingle();

  const project =
    projectData as unknown as Project | null;

  if (!project) {
    return NextResponse.json(
      {
        error:
          "Project not found.",
      },
      { status: 404 }
    );
  }

  if (
    profile.role !== "admin"
  ) {
    const { data: ownedCourse } =
      await supabase
        .from("courses")
        .select("id")
        .eq("id", project.course_id)
        .eq(
          "instructor_id",
          user.id
        )
        .maybeSingle();

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

  const timestamp =
    new Date().toISOString();

  const { error } =
    await supabase
      .from("project_submissions")
      .update({
        status: body.status,
        score,
        feedback:
          typeof body.feedback === "string"
            ? body.feedback.trim() || null
            : null,
        reviewed_at: timestamp,
        reviewed_by: user.id,
        updated_at: timestamp,
      })
      .eq(
        "id",
        submission.id
      );

  if (error) {
    return NextResponse.json(
      {
        error: error.message,
      },
      { status: 500 }
    );
  }

  if (body.status === "approved") {
    const { error: activityError } =
      await supabase
        .from("learning_activity")
        .insert({
          student_id:
            submission.student_id,
          course_id:
            project.course_id,
          activity_type:
            "project_approved",
          metadata: {
            project_id:
              project.id,
            score,
          },
        });

    if (activityError) {
      console.error(
        "Project approval activity logging failed:",
        activityError
      );
    }

    /*
     * A capstone approval only completes the course
     * when every published lesson has also been
     * completed.
     */
    const { count: publishedLessons } =
      await supabase
        .from("lessons")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq(
          "course_id",
          project.course_id
        )
        .eq("is_published", true);

    const { count: completedLessons } =
      await supabase
        .from("lesson_progress")
        .select("lesson_id", {
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
        )
        .eq("completed", true);

    if (
      (publishedLessons || 0) > 0 &&
      (completedLessons || 0) >=
        (publishedLessons || 0)
    ) {
      await supabase
        .from("enrollments")
        .update({
          enrollment_status:
            "completed",
          completed_at: timestamp,
        })
        .eq(
          "student_id",
          submission.student_id
        )
        .eq(
          "course_id",
          project.course_id
        )
        .neq(
          "enrollment_status",
          "completed"
        );
    }
  }

  return NextResponse.json({
    message:
      "Project review saved.",
  });
}