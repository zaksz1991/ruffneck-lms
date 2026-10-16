import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ labId: string }>;
};

type SubmissionAction = "draft" | "submitted";

type RequestBody = {
  answerText?: unknown;
  action?: unknown;
};

type ExistingSubmission = {
  id: string;
  status: string;
};

const MAX_ANSWER_LENGTH = 20_000;

const EDITABLE_STATUSES = new Set([
  "draft",
  "revision_required",
]);

function jsonError(message: string, status: number) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
    },
    { status },
  );
}

export async function POST(
  request: Request,
  context: RouteContext,
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonError(
        "Sign in to save or submit lab work.",
        401,
      );
    }

    const { labId } = await context.params;

    if (
      typeof labId !== "string" ||
      !labId.trim() ||
      labId.length > 100
    ) {
      return jsonError("A valid lab ID is required.", 400);
    }

    const body = (await request
      .json()
      .catch(() => null)) as RequestBody | null;

    if (!body || typeof body !== "object") {
      return jsonError("A valid JSON request body is required.", 400);
    }

    const answerText =
      typeof body.answerText === "string"
        ? body.answerText.trim()
        : "";

    const action: SubmissionAction | null =
      body.action === "draft"
        ? "draft"
        : body.action === "submitted"
          ? "submitted"
          : null;

    if (!action) {
      return jsonError(
        "Choose whether to save a draft or submit your work.",
        400,
      );
    }

    if (!answerText) {
      return jsonError(
        "Your response cannot be empty.",
        400,
      );
    }

    if (answerText.length > MAX_ANSWER_LENGTH) {
      return jsonError(
        "Your response is too long. Keep it under 20,000 characters.",
        413,
      );
    }

    // Confirm that the task exists and is published.
    const { data: lab, error: labError } = await supabase
      .from("practical_labs")
      .select("id, course_id, is_published")
      .eq("id", labId)
      .eq("is_published", true)
      .maybeSingle();

    if (labError) {
      console.error(
        "Practical Lab submission lab lookup failed:",
        labError,
      );

      return jsonError(
        "The lab is not ready. Confirm the Practical Lab database migration has been applied.",
        503,
      );
    }

    if (!lab) {
      return jsonError(
        "This practical task is unavailable.",
        404,
      );
    }

    // Verify the student's enrollment in the lab's course.
    const { data: enrollment, error: enrollmentError } =
      await supabase
        .from("enrollments")
        .select("id, enrollment_status, payment_status")
        .eq("student_id", user.id)
        .eq("course_id", lab.course_id)
        .maybeSingle();

    if (enrollmentError) {
      console.error(
        "Practical Lab enrollment validation failed:",
        enrollmentError,
      );

      return jsonError(
        "Unable to verify your course enrollment.",
        500,
      );
    }

    const enrollmentEligible =
      !!enrollment &&
      ["active", "completed"].includes(
        enrollment.enrollment_status ?? "",
      ) &&
      ["free", "paid"].includes(
        enrollment.payment_status ?? "",
      );

    if (!enrollmentEligible) {
      return jsonError(
        "You need an active, eligible enrollment in this course to submit this lab.",
        403,
      );
    }

    // Load the student's existing submission, if one exists.
    const {
      data: existing,
      error: existingError,
    } = await supabase
      .from("lab_submissions")
      .select("id, status")
      .eq("lab_id", lab.id)
      .eq("student_id", user.id)
      .maybeSingle();

    if (existingError) {
      console.error(
        "Practical Lab existing submission lookup failed:",
        existingError,
      );

      return jsonError(
        "Unable to load your existing lab submission.",
        500,
      );
    }

    const existingSubmission =
      existing as ExistingSubmission | null;

    // Approved submissions must never be overwritten.
    if (existingSubmission?.status === "approved") {
      return jsonError(
        "This task has already been approved. Approved submissions cannot be changed.",
        409,
      );
    }

    // Only drafts and submissions returned for revision can be
    // edited. A submission awaiting review cannot be overwritten.
    if (
      existingSubmission &&
      !EDITABLE_STATUSES.has(existingSubmission.status)
    ) {
      return jsonError(
        existingSubmission.status === "submitted"
          ? "Your work is awaiting review. You cannot change it until the reviewer responds."
          : "This submission cannot be edited in its current state.",
        409,
      );
    }

    const now = new Date().toISOString();
    const nextStatus = action === "draft" ? "draft" : "submitted";

    const submissionPayload = {
      lab_id: lab.id,
      student_id: user.id,
      answer_text: answerText,
      status: nextStatus,
      submitted_at: action === "submitted" ? now : null,
      updated_at: now,
    };

    const result = existingSubmission
      ? await supabase
          .from("lab_submissions")
          .update({
            answer_text: submissionPayload.answer_text,
            status: submissionPayload.status,
            submitted_at: submissionPayload.submitted_at,
            updated_at: submissionPayload.updated_at,
          })
          .eq("id", existingSubmission.id)
          .eq("student_id", user.id)
          .select("id, lab_id, status, updated_at")
          .single()
      : await supabase
          .from("lab_submissions")
          .insert(submissionPayload)
          .select("id, lab_id, status, updated_at")
          .single();

    if (result.error) {
      console.error(
        "Practical Lab submission save failed:",
        result.error,
      );

      return jsonError(
        "Your work could not be saved. Check the lab submission permissions and try again.",
        500,
      );
    }

    return NextResponse.json({
      ok: true,
      message:
        nextStatus === "draft"
          ? "Your draft has been saved."
          : existingSubmission?.status === "revision_required"
            ? "Your revised work has been resubmitted for review."
            : "Your work has been submitted for review.",
      submission: result.data,
    });
  } catch (error: unknown) {
    console.error(
      "Practical Lab submission route failed:",
      error,
    );

    return jsonError(
      "Unexpected error while saving your lab work.",
      500,
    );
  }
}