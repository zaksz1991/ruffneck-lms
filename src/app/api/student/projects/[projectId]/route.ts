import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Project = {
  id: string;
  course_id: string;
};

type Course = {
  id: string;
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

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status },
  );
}

function isValidSubmissionUrl(value: string) {
  try {
    const url = new URL(value);

    return (
      (url.protocol === "http:" ||
        url.protocol === "https:") &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function normalizeString(value: unknown): string | null {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value !== "string") {
    return null;
  }

  return value.trim();
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      projectId: string;
    }>;
  },
) {
  try {
    const { projectId } = await context.params;

    if (!projectId || !projectId.trim()) {
      return jsonError("Project ID is required.", 400);
    }

    /*
     * Reject oversized requests before parsing the JSON.
     * This is a basic request-size guard; hosting platforms may
     * also impose their own request-size limits.
     */
    const contentLength = Number(
      request.headers.get("content-length") || 0,
    );

    const maximumRequestBytes =
      MAX_SUBMISSION_TEXT_LENGTH +
      MAX_SUBMISSION_URL_LENGTH +
      10_000;

    if (
      Number.isFinite(contentLength) &&
      contentLength > maximumRequestBytes
    ) {
      return jsonError(
        "The submission is too large. Reduce the written work and try again.",
        413,
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonError("Authentication required.", 401);
    }

    let body: RequestBody;

    try {
      body = (await request.json()) as RequestBody;
    } catch {
      return jsonError("Invalid request body.", 400);
    }

    if (
      body.status !== "draft" &&
      body.status !== "submitted"
    ) {
      return jsonError("Invalid submission status.", 400);
    }

    const requestedStatus = body.status;

    const submissionText = normalizeString(
      body.submissionText,
    );

    const submissionUrl = normalizeString(
      body.submissionUrl,
    );

    if (submissionText === null) {
      return jsonError(
        "Written submission must be text.",
        400,
      );
    }

    if (submissionUrl === null) {
      return jsonError(
        "The supporting project URL must be text.",
        400,
      );
    }

    if (
      submissionText.length >
      MAX_SUBMISSION_TEXT_LENGTH
    ) {
      return jsonError(
        `The written submission exceeds the ${MAX_SUBMISSION_TEXT_LENGTH.toLocaleString()}-character limit.`,
        400,
      );
    }

    if (
      submissionUrl.length >
      MAX_SUBMISSION_URL_LENGTH
    ) {
      return jsonError(
        "The supporting project link is too long.",
        400,
      );
    }

    if (
      requestedStatus === "submitted" &&
      !submissionText &&
      !submissionUrl
    ) {
      return jsonError(
        "Provide written work or a supporting project link before submitting.",
        400,
      );
    }

    if (
      submissionUrl &&
      !isValidSubmissionUrl(submissionUrl)
    ) {
      return jsonError(
        "Enter a valid project URL using http:// or https://. Links containing embedded usernames or passwords are not accepted.",
        400,
      );
    }

    /*
     * Only published projects can receive submissions.
     */
    const {
      data: projectData,
      error: projectError,
    } = await supabase
      .from("course_projects")
      .select("id, course_id")
      .eq("id", projectId)
      .eq("is_published", true)
      .maybeSingle();

    if (projectError) {
      console.error(
        "Project lookup failed:",
        projectError.message,
      );

      return jsonError(
        "Unable to load the project. Please try again.",
        500,
      );
    }

    const project = projectData as Project | null;

    if (!project) {
      return jsonError(
        "Project not found or no longer available.",
        404,
      );
    }

    /*
     * Keep submissions limited to courses that remain published.
     */
    const {
      data: courseData,
      error: courseError,
    } = await supabase
      .from("courses")
      .select("id")
      .eq("id", project.course_id)
      .eq("status", "published")
      .maybeSingle();

    if (courseError) {
      console.error(
        "Project course lookup failed:",
        courseError.message,
      );

      return jsonError(
        "Unable to verify the course.",
        500,
      );
    }

    const course = courseData as Course | null;

    if (!course) {
      return jsonError(
        "This course is no longer available.",
        404,
      );
    }

    /*
     * Active and completed enrollments may submit project work.
     * A project submission does not itself complete the course.
     */
    const {
      data: enrollment,
      error: enrollmentError,
    } = await supabase
      .from("enrollments")
      .select("id, enrollment_status")
      .eq("student_id", user.id)
      .eq("course_id", project.course_id)
      .in("enrollment_status", ["active", "completed"])
      .maybeSingle();

    if (enrollmentError) {
      console.error(
        "Enrollment lookup failed:",
        enrollmentError.message,
      );

      return jsonError(
        "Unable to verify course enrollment.",
        500,
      );
    }

    if (!enrollment) {
      return jsonError(
        "You must be enrolled in this course to submit project work.",
        403,
      );
    }

    /*
     * Read the learner's existing submission before deciding
     * whether an update is permitted.
     */
    const {
      data: existingData,
      error: existingError,
    } = await supabase
      .from("project_submissions")
      .select("id, status")
      .eq("project_id", projectId)
      .eq("student_id", user.id)
      .maybeSingle();

    if (existingError) {
      console.error(
        "Existing submission lookup failed:",
        existingError.message,
      );

      return jsonError(
        "Unable to check the existing submission.",
        500,
      );
    }

    const existing = existingData as Submission | null;

    /*
     * Submitted, under-review and approved work is locked.
     * Only a draft or a submission returned for revision is editable.
     */
    if (
      existing &&
      !["draft", "revision_required"].includes(
        existing.status,
      )
    ) {
      return jsonError(
        "This submission is locked while it is being reviewed or after approval.",
        409,
      );
    }

    const timestamp = new Date().toISOString();

    const isResubmission =
      requestedStatus === "submitted";

    /*
     * Critical revision behavior:
     *
     * 1. Saving changes while revision is required preserves the
     *    revision_required status and existing assessor feedback.
     *
     * 2. The learner can keep editing and saving a draft without
     *    losing the review context.
     *
     * 3. Actual resubmission clears the previous score and review
     *    fields so the new work can be evaluated independently.
     */
    const effectiveStatus: SubmissionStatus =
      existing?.status === "revision_required" &&
      requestedStatus === "draft"
        ? "revision_required"
        : requestedStatus;

    const editableFields = {
      submission_text: submissionText || null,
      submission_url: submissionUrl || null,
      status: effectiveStatus,
      updated_at: timestamp,
    };

    let submissionError: {
      code?: string;
      message: string;
    } | null = null;

    if (existing) {
      const updatePayload = isResubmission
        ? {
            ...editableFields,
            status: "submitted" as const,
            score: null,
            feedback: null,
            reviewed_at: null,
            reviewed_by: null,
            submitted_at: timestamp,
          }
        : editableFields;

      const { error } = await supabase
        .from("project_submissions")
        .update(updatePayload)
        .eq("id", existing.id)
        .eq("student_id", user.id);

      submissionError = error;
    } else {
      const insertPayload = {
        project_id: projectId,
        student_id: user.id,
        ...editableFields,

        score: null,
        feedback: null,
        reviewed_at: null,
        reviewed_by: null,

        submitted_at: isResubmission
          ? timestamp
          : null,
      };

      const { error } = await supabase
        .from("project_submissions")
        .insert(insertPayload);

      submissionError = error;
    }

    if (submissionError) {
      console.error(
        "Project submission save failed:",
        submissionError.message,
      );

      if (submissionError.code === "23505") {
        return jsonError(
          "A submission was created at the same time. Refresh the page to load the latest version.",
          409,
        );
      }

      return jsonError(
        "Unable to save the project submission. Please try again.",
        500,
      );
    }

    /*
     * Activity tracking is supplementary. Failure must not invalidate
     * a successfully saved submission.
     */
    const { error: activityError } = await supabase
      .from("learning_activity")
      .insert({
        student_id: user.id,
        course_id: project.course_id,
        activity_type: isResubmission
          ? "project_submitted"
          : "project_draft_saved",
        metadata: {
          project_id: projectId,
          requested_status: requestedStatus,
          saved_status: effectiveStatus,
          is_resubmission: isResubmission,
        },
      });

    if (activityError) {
      console.error(
        "Project activity logging failed:",
        activityError.message,
      );
    }

    return NextResponse.json({
      message: isResubmission
        ? "Project submitted for review."
        : existing?.status === "revision_required"
          ? "Your draft was saved. The assessor feedback remains available until you resubmit."
          : "Draft saved successfully.",
      status: effectiveStatus,
    });
  } catch (error) {
    console.error(
      "Project submission API error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "An unexpected error occurred while saving the project submission.",
      },
      { status: 500 },
    );
  }
}