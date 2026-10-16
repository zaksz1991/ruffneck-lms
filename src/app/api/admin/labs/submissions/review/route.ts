import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_FEEDBACK_LENGTH = 10_000;

type ReviewRequest = {
  submissionId?: unknown;
  score?: unknown;
  feedback?: unknown;
  status?: unknown;
};

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: message },
    { status },
  );
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse("Sign in to review lab submissions.", 401);
    }

    // Verify the reviewer's role using the database profile.
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Lab review role lookup failed:", profileError);
      return errorResponse("Unable to verify reviewer permissions.", 500);
    }

    if (
      !profile ||
      !["admin", "instructor"].includes(profile.role ?? "")
    ) {
      return errorResponse(
        "Only administrators and instructors can review lab submissions.",
        403,
      );
    }

    const body = (await request.json().catch(() => null)) as
      | ReviewRequest
      | null;

    if (!body || typeof body !== "object") {
      return errorResponse("A valid review request is required.", 400);
    }

    const submissionId =
      typeof body.submissionId === "string"
        ? body.submissionId.trim()
        : "";

    // Validate UUID format before calling the database.
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(submissionId)) {
      return errorResponse("A valid submission ID is required.", 400);
    }

    if (
      typeof body.score !== "number" ||
      !Number.isInteger(body.score) ||
      body.score < 0 ||
      body.score > 100
    ) {
      return errorResponse(
        "The score must be a whole number from 0 to 100.",
        400,
      );
    }

    if (
      body.status !== "approved" &&
      body.status !== "revision_required"
    ) {
      return errorResponse("Choose a valid review status.", 400);
    }

    if (
      body.status === "approved" &&
      body.score === undefined
    ) {
      return errorResponse(
        "An approved submission requires a score.",
        400,
      );
    }

    const feedback =
      typeof body.feedback === "string"
        ? body.feedback.trim()
        : "";

    if (body.feedback !== undefined && typeof body.feedback !== "string") {
      return errorResponse("Feedback must be text.", 400);
    }

    if (feedback.length > MAX_FEEDBACK_LENGTH) {
      return errorResponse(
        "Feedback cannot exceed 10,000 characters.",
        413,
      );
    }

    // The database function independently checks reviewer authorization,
    // course ownership, self-review, submission status and score limits.
    const { error: reviewError } = await supabase.rpc(
      "review_lab_submission",
      {
        p_submission_id: submissionId,
        p_score: body.score,
        p_feedback: feedback || null,
        p_status: body.status,
      },
    );

    if (reviewError) {
      console.error("Practical Lab review RPC failed:", {
        code: reviewError.code,
        message: reviewError.message,
      });

      const message = reviewError.message ?? "";

      if (
        message.includes("Not authorized") ||
        message.includes("cannot review your own submission") ||
        message.includes("Authentication required")
      ) {
        return errorResponse(
          "You are not authorized to review this submission.",
          403,
        );
      }

      if (
        message.includes("Submission not found") ||
        message.includes("not available for review")
      ) {
        return errorResponse(
          "This submission was not found or is no longer available for review.",
          409,
        );
      }

      if (
        message.includes("Invalid review status") ||
        message.includes("Score must be") ||
        message.includes("Approved submissions require") ||
        message.includes("Feedback exceeds")
      ) {
        return errorResponse("The review details are invalid.", 400);
      }

      return errorResponse(
        "The review could not be saved. Please try again.",
        500,
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Lab submission reviewed successfully.",
    });
  } catch (error) {
    console.error("Practical Lab review route failed:", error);

    return errorResponse(
      "Unexpected error while reviewing the submission.",
      500,
    );
  }
}