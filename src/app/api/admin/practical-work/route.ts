import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ReviewStatus =
  | "under_review"
  | "approved"
  | "revision_required";

function jsonError(
  message: string,
  status = 400,
) {
  return NextResponse.json(
    { error: message },
    { status },
  );
}

async function getReviewer() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      supabase,
      user: null,
      role: null,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return {
    supabase,
    user,
    role: profile?.role ?? null,
  };
}

async function canReviewCourse(
  supabase: any,
  userId: string,
  role: string,
  courseId: string,
) {
  if (role === "admin") {
    return true;
  }

  if (role !== "instructor") {
    return false;
  }

  const { data: course } = await supabase
    .from("courses")
    .select("id,instructor_id")
    .eq("id", courseId)
    .maybeSingle();

  return course?.instructor_id === userId;
}

export async function GET() {
  const {
    supabase,
    user,
    role,
  } = await getReviewer();

  if (!user) {
    return jsonError(
      "Authentication required.",
      401,
    );
  }

  if (
    role !== "admin" &&
    role !== "instructor"
  ) {
    return jsonError(
      "You are not authorized to review practical work.",
      403,
    );
  }

  const {
    data: submissions,
    error,
  } = await supabase
    .from(
      "student_practical_task_submissions",
    )
    .select(
      `
        id,
        task_id,
        student_id,
        submission_text,
        status,
        score,
        reviewer_feedback,
        submitted_at,
        reviewed_at,
        created_at,
        updated_at,
        course_practical_tasks!inner (
          id,
          course_id,
          title,
          scenario,
          expected_outcome,
          submission_type,
          max_score,
          sort_order,
          courses!inner (
            id,
            title,
            slug,
            instructor_id
          )
        )
      `,
    )
    .order("submitted_at", {
      ascending: false,
    });

  if (error) {
    return jsonError(
      error.message,
      500,
    );
  }

  const filtered =
    role === "admin"
      ? submissions ?? []
      : (submissions ?? []).filter(
          (submission: any) =>
            submission
              .course_practical_tasks
              ?.courses
              ?.instructor_id === user.id,
        );

  const studentIds = [
    ...new Set(
      filtered.map(
        (submission: any) =>
          submission.student_id,
      ),
    ),
  ];

  let students: Record<
    string,
    {
      id: string;
      display_name: string | null;
      email: string | null;
    }
  > = {};

  if (studentIds.length > 0) {
    const { data: profiles } =
      await supabase
        .from("profiles")
        .select(
          "id,display_name,email",
        )
        .in("id", studentIds);

    for (const profile of profiles ?? []) {
      students[profile.id] = profile;
    }
  }

  const enriched = filtered.map(
    (submission: any) => ({
      ...submission,
      student:
        students[submission.student_id] ??
        null,
    }),
  );

  return NextResponse.json({
    ok: true,
    submissions: enriched,
  });
}

export async function PATCH(
  request: Request,
) {
  const {
    supabase,
    user,
    role,
  } = await getReviewer();

  if (!user) {
    return jsonError(
      "Authentication required.",
      401,
    );
  }

  if (
    role !== "admin" &&
    role !== "instructor"
  ) {
    return jsonError(
      "You are not authorized to review practical work.",
      403,
    );
  }

  let body: any;

  try {
    body = await request.json();
  } catch {
    return jsonError(
      "Invalid request body.",
    );
  }

  const submissionId =
    typeof body?.id === "string"
      ? body.id.trim()
      : "";

  if (!submissionId) {
    return jsonError(
      "Submission ID is required.",
    );
  }

  const status =
    body?.status as ReviewStatus;

  if (
    status !== "under_review" &&
    status !== "approved" &&
    status !== "revision_required"
  ) {
    return jsonError(
      "Invalid review status.",
    );
  }

  const score =
    body?.score === null ||
    body?.score === undefined ||
    body?.score === ""
      ? null
      : Number(body.score);

  const feedback =
    typeof body?.reviewer_feedback ===
    "string"
      ? body.reviewer_feedback.trim()
      : "";

  const {
    data: submission,
    error: submissionError,
  } = await supabase
    .from(
      "student_practical_task_submissions",
    )
    .select(
      `
        id,
        task_id,
        student_id,
        status,
        course_practical_tasks!inner (
          id,
          course_id,
          max_score,
          courses!inner (
            id,
            instructor_id
          )
        )
      `,
    )
    .eq("id", submissionId)
    .maybeSingle();

  if (submissionError) {
    return jsonError(
      submissionError.message,
      500,
    );
  }

  if (!submission) {
    return jsonError(
      "Practical submission not found.",
      404,
    );
  }

  const task =
    submission
      .course_practical_tasks;

  const courseId =
    task?.course_id;

  if (!courseId) {
    return jsonError(
      "The submission is not linked to a valid course.",
      500,
    );
  }

  const allowed =
    await canReviewCourse(
      supabase,
      user.id,
      role,
      courseId,
    );

  if (!allowed) {
    return jsonError(
      "You are not authorized to review this submission.",
      403,
    );
  }

  if (
    score !== null &&
    (!Number.isFinite(score) ||
      score < 0 ||
      score > Number(task.max_score))
  ) {
    return jsonError(
      `Score must be between 0 and ${task.max_score}.`,
    );
  }

  if (
    status === "approved" &&
    score === null
  ) {
    return jsonError(
      "An approved submission must have a score.",
    );
  }

  if (
    status === "revision_required" &&
    !feedback
  ) {
    return jsonError(
      "Feedback is required when requesting a revision.",
    );
  }

  const { data: updated, error } =
    await supabase
      .from(
        "student_practical_task_submissions",
      )
      .update({
        status,
        score,
        reviewer_feedback:
          feedback || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", submissionId)
      .select(
        "id,status,score,reviewer_feedback,reviewed_at",
      )
      .single();

  if (error) {
    return jsonError(
      error.message,
      500,
    );
  }

  return NextResponse.json({
    ok: true,
    submission: updated,
  });
}