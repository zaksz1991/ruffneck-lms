import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type SubmissionPayload = {
  task_id?: string;
  submission_text?: string;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
    },
    { status },
  );
}

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError("Authentication required.", 401);
  }

  const { data: enrollments, error: enrollmentError } =
    await supabase
      .from("enrollments")
      .select("course_id")
      .eq("student_id", user.id)
      .in("enrollment_status", ["active", "completed"]);

  if (enrollmentError) {
    console.error(
      "Failed to load practical-work enrollments:",
      enrollmentError,
    );

    return jsonError(
      "Unable to load your enrolled courses.",
      500,
    );
  }

  const courseIds = [
    ...new Set(
      (enrollments || []).map(
        (row) => row.course_id,
      ),
    ),
  ];

  if (courseIds.length === 0) {
    return NextResponse.json({
      ok: true,
      tasks: [],
    });
  }

  const { data: tasks, error: tasksError } =
    await supabase
      .from("course_practical_tasks")
      .select(
        [
          "id",
          "course_id",
          "title",
          "scenario",
          "instructions",
          "expected_outcome",
          "submission_type",
          "max_score",
          "sort_order",
        ].join(", "),
      )
      .in("course_id", courseIds)
      .eq("is_published", true)
      .order("course_id", {
        ascending: true,
      })
      .order("sort_order", {
        ascending: true,
      });

  if (tasksError) {
    console.error(
      "Failed to load practical tasks:",
      tasksError,
    );

    return jsonError(
      "Unable to load practical tasks.",
      500,
    );
  }

  const taskIds = (tasks || []).map(
    (task) => task.id,
  );

  let submissions: Array<{
    id: string;
    task_id: string;
    submission_text: string | null;
    status: string;
    score: number | null;
    reviewer_feedback: string | null;
    submitted_at: string | null;
    reviewed_at: string | null;
  }> = [];

  if (taskIds.length > 0) {
    const {
      data: submissionRows,
      error: submissionsError,
    } = await supabase
      .from(
        "student_practical_task_submissions",
      )
      .select(
        [
          "id",
          "task_id",
          "submission_text",
          "status",
          "score",
          "reviewer_feedback",
          "submitted_at",
          "reviewed_at",
        ].join(", "),
      )
      .eq("student_id", user.id)
      .in("task_id", taskIds);

    if (submissionsError) {
      console.error(
        "Failed to load practical submissions:",
        submissionsError,
      );

      return jsonError(
        "Unable to load your practical submissions.",
        500,
      );
    }

    submissions =
      (submissionRows || []) as typeof submissions;
  }

  const submissionMap = new Map(
    submissions.map((submission) => [
      submission.task_id,
      submission,
    ]),
  );

  const enrichedTasks = (tasks || []).map(
    (task) => ({
      ...task,
      submission:
        submissionMap.get(task.id) || null,
    }),
  );

  return NextResponse.json({
    ok: true,
    tasks: enrichedTasks,
  });
}

export async function POST(
  request: Request,
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError("Authentication required.", 401);
  }

  let body: SubmissionPayload;

  try {
    body =
      (await request.json()) as SubmissionPayload;
  } catch {
    return jsonError("Invalid request body.");
  }

  const taskId = String(
    body.task_id || "",
  ).trim();

  const submissionText = String(
    body.submission_text || "",
  ).trim();

  if (!taskId) {
    return jsonError(
      "Practical task is required.",
    );
  }

  if (!submissionText) {
    return jsonError(
      "Your practical work cannot be empty.",
    );
  }

  if (submissionText.length > 50000) {
    return jsonError(
      "Your submission is too long.",
    );
  }

  const { data: task, error: taskError } =
    await supabase
      .from("course_practical_tasks")
      .select(
        [
          "id",
          "course_id",
          "title",
          "is_published",
        ].join(", "),
      )
      .eq("id", taskId)
      .eq("is_published", true)
      .maybeSingle();

  if (taskError) {
    console.error(
      "Failed to load practical task:",
      taskError,
    );

    return jsonError(
      "Unable to load the practical task.",
      500,
    );
  }

  if (!task) {
    return jsonError(
      "Practical task not found.",
      404,
    );
  }

  const { data: enrollment } =
    await supabase
      .from("enrollments")
      .select(
        "id, enrollment_status",
      )
      .eq("student_id", user.id)
      .eq("course_id", task.course_id)
      .in("enrollment_status", [
        "active",
        "completed",
      ])
      .maybeSingle();

  if (!enrollment) {
    return jsonError(
      "You are not enrolled in this course.",
      403,
    );
  }

  const now = new Date().toISOString();

  const { data: existingSubmission } =
    await supabase
      .from(
        "student_practical_task_submissions",
      )
      .select(
        [
          "id",
          "status",
          "score",
          "reviewer_feedback",
        ].join(", "),
      )
      .eq("task_id", taskId)
      .eq("student_id", user.id)
      .maybeSingle();

  if (
    existingSubmission &&
    (
      existingSubmission.status ===
        "approved" ||
      existingSubmission.status ===
        "under_review"
    )
  ) {
    return jsonError(
      "This submission is already under review or has been approved.",
      409,
    );
  }

  const submissionPayload = {
    task_id: taskId,
    student_id: user.id,
    submission_text: submissionText,
    status: "submitted",
    score: null,
    reviewer_feedback: null,
    submitted_at: now,
    reviewed_at: null,
    updated_at: now,
  };

  const { data: submission, error } =
    await supabase
      .from(
        "student_practical_task_submissions",
      )
      .upsert(
        submissionPayload,
        {
          onConflict:
            "task_id,student_id",
        },
      )
      .select(
        [
          "id",
          "task_id",
          "submission_text",
          "status",
          "score",
          "reviewer_feedback",
          "submitted_at",
          "reviewed_at",
        ].join(", "),
      )
      .single();

  if (error) {
    console.error(
      "Failed to save practical submission:",
      error,
    );

    return jsonError(
      "Unable to submit your practical work.",
      500,
    );
  }

  return NextResponse.json({
    ok: true,
    submission,
  });
}