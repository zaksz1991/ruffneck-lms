import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_FEEDBACK_LENGTH = 10_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RubricCriterion = {
  criterion: string;
  points: number;
  description?: string;
};

type IncomingRubricScore = {
  criterion: string;
  earnedPoints: number;
};

function errorResponse(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function normalizeRubric(value: unknown): RubricCriterion[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) return [];
  const criteria: RubricCriterion[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.criterion !== "string" || !row.criterion.trim()) return [];
    const points = Number(row.points);
    if (!Number.isInteger(points) || points < 0 || points > 100) return [];
    const description = typeof row.description === "string" ? row.description : undefined;
    criteria.push({ criterion: row.criterion.trim(), points, ...(description ? { description } : {}) });
  }
  if (new Set(criteria.map((item) => item.criterion)).size !== criteria.length) return [];
  if (criteria.reduce((sum, item) => sum + item.points, 0) !== 100) return [];
  return criteria;
}

async function getReviewer() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: errorResponse("Sign in to review lab submissions.", 401) } as const;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Rubric review role lookup failed:", profileError);
    return { error: errorResponse("Unable to verify reviewer permissions.", 500) } as const;
  }

  if (!profile || !["admin", "instructor"].includes(profile.role)) {
    return { error: errorResponse("Only administrators and assigned instructors can review lab submissions.", 403) } as const;
  }

  return { supabase, user, role: profile.role } as const;
}

export async function GET(request: Request) {
  try {
    const reviewer = await getReviewer();
    if ("error" in reviewer) return reviewer.error;

    const submissionId = new URL(request.url).searchParams.get("submissionId")?.trim() ?? "";
    if (!UUID_PATTERN.test(submissionId)) {
      return errorResponse("A valid submission ID is required.", 400);
    }

    const { data: submission, error: submissionError } = await reviewer.supabase
      .from("lab_submissions")
      .select("id, lab_id, student_id, status")
      .eq("id", submissionId)
      .maybeSingle();

    if (submissionError) {
      console.error("Rubric review submission lookup failed:", submissionError);
      return errorResponse("Unable to load the submission for review.", 500);
    }
    if (!submission) {
      return errorResponse("Submission was not found or you are not authorized to review it.", 404);
    }
    if (submission.student_id === reviewer.user.id) {
      return errorResponse("You cannot review your own submission.", 403);
    }

    const { data: lab, error: labError } = await reviewer.supabase
      .from("practical_labs")
      .select("assessment_rubric")
      .eq("id", submission.lab_id)
      .maybeSingle();

    if (labError) {
      console.error("Rubric review lab lookup failed:", labError);
      return errorResponse("Unable to load the assessment rubric.", 500);
    }

    const rubric = normalizeRubric(lab?.assessment_rubric);
    if (rubric.length === 0) {
      return NextResponse.json({
        ok: true,
        hasRubric: false,
        rubric: [],
        saved: null,
        warning: "This lab has no valid 100-point rubric. The standard overall-score form remains available.",
      });
    }

    const { data: saved, error: savedError } = await reviewer.supabase.rpc(
      "get_lab_submission_rubric_review",
      { p_submission_id: submissionId },
    );

    if (savedError) {
      console.error("Saved rubric review lookup failed:", {
        code: savedError.code,
        message: savedError.message,
      });
      return NextResponse.json({
        ok: true,
        hasRubric: false,
        rubric: [],
        saved: null,
        warning: "Rubric scoring is not available until its database migration is applied. The standard overall-score form remains available.",
      });
    }

    return NextResponse.json({ ok: true, hasRubric: true, rubric, saved: saved ?? null });
  } catch (error) {
    console.error("Rubric review GET failed:", error);
    return errorResponse("Unexpected error while loading the assessment rubric.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const reviewer = await getReviewer();
    if ("error" in reviewer) return reviewer.error;

    const body = (await request.json().catch(() => null)) as {
      submissionId?: unknown;
      rubricScores?: unknown;
      feedback?: unknown;
      status?: unknown;
    } | null;

    if (!body || typeof body !== "object") {
      return errorResponse("A valid rubric review request is required.", 400);
    }

    const submissionId = typeof body.submissionId === "string" ? body.submissionId.trim() : "";
    if (!UUID_PATTERN.test(submissionId)) {
      return errorResponse("A valid submission ID is required.", 400);
    }
    if (body.status !== "approved" && body.status !== "revision_required") {
      return errorResponse("Choose a valid review status.", 400);
    }
    if (body.feedback !== undefined && body.feedback !== null && typeof body.feedback !== "string") {
      return errorResponse("Feedback must be text.", 400);
    }

    const feedback = typeof body.feedback === "string" ? body.feedback.trim() : "";
    if (feedback.length > MAX_FEEDBACK_LENGTH) {
      return errorResponse("Feedback cannot exceed 10,000 characters.", 413);
    }
    if (body.status === "revision_required" && feedback.length === 0) {
      return errorResponse("Provide feedback explaining what the student must improve.", 400);
    }

    if (!Array.isArray(body.rubricScores) || body.rubricScores.length < 1 || body.rubricScores.length > 20) {
      return errorResponse("Provide a score for every rubric criterion.", 400);
    }

    const rubricScores: IncomingRubricScore[] = [];
    for (const item of body.rubricScores) {
      if (!item || typeof item !== "object") {
        return errorResponse("Rubric score entries are invalid.", 400);
      }
      const row = item as Record<string, unknown>;
      if (typeof row.criterion !== "string" || !row.criterion.trim() ||
          typeof row.earnedPoints !== "number" || !Number.isInteger(row.earnedPoints) ||
          row.earnedPoints < 0 || row.earnedPoints > 100) {
        return errorResponse("Each rubric criterion requires a valid whole-number score.", 400);
      }
      rubricScores.push({ criterion: row.criterion.trim(), earnedPoints: row.earnedPoints });
    }
    if (new Set(rubricScores.map((item) => item.criterion)).size !== rubricScores.length) {
      return errorResponse("Each rubric criterion must appear exactly once.", 400);
    }

    const { data: totalScore, error: reviewError } = await reviewer.supabase.rpc(
      "review_lab_submission_with_rubric",
      {
        p_submission_id: submissionId,
        p_rubric_scores: rubricScores,
        p_feedback: feedback || null,
        p_status: body.status,
      },
    );

    if (reviewError) {
      console.error("Rubric review RPC failed:", {
        code: reviewError.code,
        message: reviewError.message,
      });
      const message = reviewError.message ?? "";
      if (message.includes("Not authorized") || message.includes("cannot review your own submission") || message.includes("Authentication required")) {
        return errorResponse("You are not authorized to review this submission.", 403);
      }
      if (message.includes("Submission not found") || message.includes("not available for review")) {
        return errorResponse("This submission was not found or is no longer available for review.", 409);
      }
      if (message.toLowerCase().includes("rubric") || message.toLowerCase().includes("criterion") || message.includes("score") || message.includes("feedback")) {
        return errorResponse("The rubric or review details are invalid. Reload the page and check every criterion.", 400);
      }
      return errorResponse("The rubric review could not be saved. Confirm the rubric migration is applied and try again.", 500);
    }

    return NextResponse.json({
      ok: true,
      message: "Lab rubric review saved successfully.",
      totalScore: Number(totalScore),
    });
  } catch (error) {
    console.error("Rubric review POST failed:", error);
    return errorResponse("Unexpected error while saving the rubric review.", 500);
  }
}
