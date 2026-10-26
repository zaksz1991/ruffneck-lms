import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const STORAGE_BUCKET = "practical-work-evidence";
const MAX_FEEDBACK_LENGTH = 10_000;

type ReviewStatus =
  | "under_review"
  | "approved"
  | "revision_required";

type ReviewerRole =
  | "student"
  | "instructor"
  | "admin";

type Reviewer = {
  id: string;
  role: ReviewerRole;
};

type CourseRow = {
  id: string;
  title: string;
  slug: string;
  instructor_id: string | null;
};

type TaskRow = {
  id: string;
  course_id: string;
  title: string;
  scenario: string;
  expected_outcome: string;
  submission_type: string;
  max_score: number;
  sort_order: number;
  skill_id: string | null;
  courses: CourseRow | null;
};

type SubmissionRow = {
  id: string;
  task_id: string;
  student_id: string;
  submission_text: string | null;
  status: string;
  score: number | null;
  reviewer_feedback: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  evidence_file_path: string | null;
  evidence_file_name: string | null;
  evidence_file_type: string | null;
  evidence_file_size: number | null;
  evidence_recorded_at: string | null;
  created_at: string;
  updated_at: string;
  course_practical_tasks: TaskRow | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type SkillProfileRow = {
  id: string;
  confidence_score: number | null;
  skill_level: string | null;
  evidence: string | null;
};

type RequestBody = {
  id?: unknown;
  status?: unknown;
  score?: unknown;
  reviewer_feedback?: unknown;
};

type AdminClient = ReturnType<typeof createAdminClient>;

function jsonError(
  message: string,
  status = 400,
) {
  return NextResponse.json(
    { error: message },
    { status },
  );
}

function clamp(
  value: number,
  minimum: number,
  maximum: number,
) {
  return Math.max(
    minimum,
    Math.min(maximum, value),
  );
}

function getMaximumScore(task: TaskRow): number {
  const maximum = Number(task.max_score);

  return Number.isFinite(maximum) && maximum > 0
    ? maximum
    : 100;
}

function calculatePercentage(
  score: number,
  maxScore: number,
): number {
  return Math.round(
    clamp((score / maxScore) * 100, 0, 100),
  );
}

async function getReviewer() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error(
      "Practical work authentication failed:",
      authError.message,
    );

    return {
      user: null,
      role: null,
      error: true,
    };
  }

  if (!user) {
    return {
      user: null,
      role: null,
      error: false,
    };
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error(
      "Practical work reviewer lookup failed:",
      profileError.message,
    );

    return {
      user,
      role: null,
      error: true,
    };
  }

  return {
    user,
    role: (profile?.role ?? null) as ReviewerRole | null,
    error: false,
  };
}

async function createEvidenceSignedUrl(
  admin: AdminClient,
  filePath: string | null,
): Promise<string | null> {
  if (!filePath) {
    return null;
  }

  const { data, error } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(filePath, 60 * 60);

  if (error) {
    console.error(
      "Practical evidence signed URL failed:",
      error.message,
    );

    return null;
  }

  return data?.signedUrl ?? null;
}

/**
 * Records approved practical work against a linked skill.
 *
 * Important safeguards:
 * - Uses the established student_id/confidence_score/skill_level/evidence
 *   profile fields rather than querying optional score/confidence columns.
 * - Converts task scores into percentages before updating confidence.
 * - Adds the submission ID to the evidence text so a retry does not append
 *   the same evidence or increase confidence twice.
 * - Records evidence_recorded_at for approved practical submissions,
 *   including tasks that do not have a linked skill.
 * - Throws database errors instead of silently claiming evidence succeeded.
 */
async function recordPracticalEvidence(
  admin: AdminClient,
  submission: SubmissionRow,
  approvedScore: number,
): Promise<string> {
  if (submission.evidence_recorded_at) {
    return submission.evidence_recorded_at;
  }

  const task = submission.course_practical_tasks;

  if (!task) {
    throw new Error(
      "The approved submission has no linked practical task.",
    );
  }

  const now = new Date().toISOString();
  const maxScore = getMaximumScore(task);
  const scorePercentage = calculatePercentage(
    approvedScore,
    maxScore,
  );

  let evidenceWasNewlyAdded = false;

  if (task.skill_id) {
    const {
      data: skill,
      error: skillError,
    } = await admin
      .from("learning_skills")
      .select("id, name")
      .eq("id", task.skill_id)
      .maybeSingle();

    if (skillError) {
      throw new Error(
        `Unable to load the linked skill: ${skillError.message}`,
      );
    }

    if (skill) {
      /*
       * Only query fields already used by the learner's skill-profile
       * pages and the established evidence workflow.
       */
      const {
        data: existingProfileData,
        error: profileLookupError,
      } = await admin
        .from("learner_skill_profiles")
        .select(
          "id, confidence_score, skill_level, evidence",
        )
        .eq("student_id", submission.student_id)
        .eq("skill_id", task.skill_id)
        .maybeSingle();

      if (profileLookupError) {
        throw new Error(
          `Unable to load the learner's skill profile: ${profileLookupError.message}`,
        );
      }

      const existingProfile =
        existingProfileData as SkillProfileRow | null;

      const previousEvidence =
        typeof existingProfile?.evidence === "string"
          ? existingProfile.evidence
          : "";

      /*
       * This marker makes retries idempotent when the profile update
       * succeeded but recording evidence_recorded_at failed afterward.
       */
      const submissionMarker =
        `[submission:${submission.id}]`;

      const alreadyInProfile =
        previousEvidence.includes(submissionMarker);

      if (!alreadyInProfile) {
        const previousConfidence = clamp(
          Number(existingProfile?.confidence_score ?? 0),
          0,
          100,
        );

        const practicalWeight =
          previousEvidence.trim().length > 0
            ? 0.25
            : 0.4;

        const updatedConfidence = Math.round(
          previousConfidence * (1 - practicalWeight) +
            scorePercentage * practicalWeight,
        );

        let skillLevel = "beginner";

        if (updatedConfidence >= 80) {
          skillLevel = "advanced";
        } else if (updatedConfidence >= 60) {
          skillLevel = "intermediate";
        }

        const evidenceLine =
          `${submissionMarker} ` +
          `${now.slice(0, 10)}: ` +
          `Approved practical demonstration — ` +
          `${task.title} — ` +
          `${approvedScore}/${maxScore} ` +
          `(${skill.name}; ${scorePercentage}%).`;

        const updatedEvidence = previousEvidence.trim()
          ? `${previousEvidence}\n${evidenceLine}`
          : evidenceLine;

        const { error: profileUpdateError } = await admin
          .from("learner_skill_profiles")
          .upsert(
            {
              student_id: submission.student_id,
              skill_id: task.skill_id,
              confidence_score: updatedConfidence,
              skill_level: skillLevel,
              evidence: updatedEvidence,
              updated_at: now,
            },
            {
              onConflict: "student_id,skill_id",
            },
          );

        if (profileUpdateError) {
          throw new Error(
            `Unable to update the learner's skill evidence: ${profileUpdateError.message}`,
          );
        }

        evidenceWasNewlyAdded = true;
      }
    } else {
      /*
       * The approved submission still represents practical work.
       * It can appear in the public practical-evidence section, but
       * it cannot contribute to a named skill until that skill exists.
       */
      console.warn(
        "Approved practical submission references a missing learning skill:",
        {
          submissionId: submission.id,
          skillId: task.skill_id,
        },
      );
    }
  }

  /*
   * Mark the evidence only after any applicable skill-profile update
   * has succeeded. A failed marker update will be visible as an API error,
   * and the submission can be retried without duplicating its evidence line.
   */
  const {
    data: markerData,
    error: markerError,
  } = await admin
    .from("student_practical_task_submissions")
    .update({
      evidence_recorded_at: now,
      updated_at: now,
    })
    .eq("id", submission.id)
    .select("evidence_recorded_at")
    .single();

  if (markerError) {
    throw new Error(
      `Unable to mark practical evidence as recorded: ${markerError.message}`,
    );
  }

  const recordedAt =
    markerData?.evidence_recorded_at ?? now;

  if (evidenceWasNewlyAdded) {
    const { error: activityError } = await admin
      .from("learning_activity")
      .insert({
        student_id: submission.student_id,
        course_id: task.course_id,
        activity_type: "practical_task_approved",
        metadata: {
          submission_id: submission.id,
          task_id: task.id,
          task_title: task.title,
          skill_id: task.skill_id,
          score: approvedScore,
          max_score: maxScore,
          score_percentage: scorePercentage,
          verified: true,
        },
      });

    /*
     * Activity logging is supplementary. Its failure should not undo
     * successful evidence recording.
     */
    if (activityError) {
      console.error(
        "Practical evidence activity logging failed:",
        activityError.message,
      );
    }
  }

  return recordedAt;
}

async function buildSubmissionResponse(
  admin: AdminClient,
  row: SubmissionRow,
  profile: ProfileRow | undefined,
) {
  const task = row.course_practical_tasks;
  const course = task?.courses ?? null;

  const evidenceFileUrl = await createEvidenceSignedUrl(
    admin,
    row.evidence_file_path,
  );

  return {
    id: row.id,
    task_id: row.task_id,
    student_id: row.student_id,
    submission_text: row.submission_text,
    status: row.status,
    score: row.score,
    reviewer_feedback: row.reviewer_feedback,
    submitted_at: row.submitted_at,
    reviewed_at: row.reviewed_at,
    evidence_file_path: row.evidence_file_path,
    evidence_file_name: row.evidence_file_name,
    evidence_file_type: row.evidence_file_type,
    evidence_file_size: row.evidence_file_size,
    evidence_file_url: evidenceFileUrl,
    evidence_recorded_at: row.evidence_recorded_at,
    created_at: row.created_at,
    updated_at: row.updated_at,

    student: {
      id: profile?.id ?? row.student_id,
      display_name: profile?.full_name ?? null,
      email: profile?.email ?? null,
    },

    course_practical_tasks: task
      ? {
          id: task.id,
          course_id: task.course_id,
          title: task.title,
          scenario: task.scenario,
          expected_outcome: task.expected_outcome,
          submission_type: task.submission_type,
          max_score: getMaximumScore(task),
          sort_order: Number(task.sort_order ?? 0),
          skill_id: task.skill_id,
          courses: course
            ? {
                id: course.id,
                title: course.title,
                slug: course.slug,
                instructor_id: course.instructor_id,
              }
            : null,
        }
      : null,
  };
}

export async function GET() {
  try {
    const reviewer = await getReviewer();

    if (reviewer.error) {
      return jsonError(
        "Unable to verify reviewer permissions.",
        500,
      );
    }

    if (!reviewer.user) {
      return jsonError(
        "Authentication required.",
        401,
      );
    }

    if (
      reviewer.role !== "admin" &&
      reviewer.role !== "instructor"
    ) {
      return jsonError(
        "You are not authorized to review practical work.",
        403,
      );
    }

    const admin = createAdminClient();

    const { data, error } = await admin
      .from("student_practical_task_submissions")
      .select(`
        id,
        task_id,
        student_id,
        submission_text,
        status,
        score,
        reviewer_feedback,
        submitted_at,
        reviewed_at,
        evidence_file_path,
        evidence_file_name,
        evidence_file_type,
        evidence_file_size,
        evidence_recorded_at,
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
          skill_id,
          courses!inner (
            id,
            title,
            slug,
            instructor_id
          )
        )
      `)
      .order("submitted_at", {
        ascending: false,
        nullsFirst: false,
      });

    if (error) {
      console.error(
        "Practical work query failed:",
        error.message,
      );

      return jsonError(
        "Unable to load practical work.",
        500,
      );
    }

    const rows = (data ?? []) as unknown as SubmissionRow[];

    const visibleRows =
      reviewer.role === "admin"
        ? rows
        : rows.filter(
            (row) =>
              row.course_practical_tasks?.courses
                ?.instructor_id === reviewer.user?.id,
          );

    const studentIds = Array.from(
      new Set(
        visibleRows.map((row) => row.student_id),
      ),
    );

    let profiles: ProfileRow[] = [];

    if (studentIds.length > 0) {
      const {
        data: profileData,
        error: profileError,
      } = await admin
        .from("profiles")
        .select("id, full_name, email")
        .in("id", studentIds);

      if (profileError) {
        console.error(
          "Practical learner profile query failed:",
          profileError.message,
        );

        return jsonError(
          "Unable to load learner information.",
          500,
        );
      }

      profiles = (profileData ?? []) as ProfileRow[];
    }

    const profileMap = new Map(
      profiles.map((profile) => [
        profile.id,
        profile,
      ]),
    );

    const submissions = await Promise.all(
      visibleRows.map((row) =>
        buildSubmissionResponse(
          admin,
          row,
          profileMap.get(row.student_id),
        ),
      ),
    );

    return NextResponse.json({
      submissions,
    });
  } catch (error) {
    console.error(
      "Practical work GET error:",
      error,
    );

    return jsonError(
      "An unexpected error occurred while loading practical work.",
      500,
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const reviewer = await getReviewer();

    if (reviewer.error) {
      return jsonError(
        "Unable to verify reviewer permissions.",
        500,
      );
    }

    if (!reviewer.user) {
      return jsonError(
        "Authentication required.",
        401,
      );
    }

    if (
      reviewer.role !== "admin" &&
      reviewer.role !== "instructor"
    ) {
      return jsonError(
        "You are not authorized to review practical work.",
        403,
      );
    }

    let body: RequestBody;

    try {
      body = (await request.json()) as RequestBody;
    } catch {
      return jsonError(
        "Invalid request body.",
      );
    }

    const id =
      typeof body.id === "string"
        ? body.id.trim()
        : "";

    const status =
      typeof body.status === "string"
        ? body.status
        : "";

    const feedback =
      typeof body.reviewer_feedback === "string"
        ? body.reviewer_feedback.trim()
        : "";

    if (!id) {
      return jsonError(
        "Submission ID is required.",
      );
    }

    if (
      status !== "under_review" &&
      status !== "approved" &&
      status !== "revision_required"
    ) {
      return jsonError(
        "Invalid review status.",
      );
    }

    if (feedback.length > MAX_FEEDBACK_LENGTH) {
      return jsonError(
        `Reviewer feedback cannot exceed ${MAX_FEEDBACK_LENGTH.toLocaleString()} characters.`,
      );
    }

    const admin = createAdminClient();

    const {
      data: submissionData,
      error: submissionError,
    } = await admin
      .from("student_practical_task_submissions")
      .select(`
        id,
        task_id,
        student_id,
        submission_text,
        status,
        score,
        reviewer_feedback,
        submitted_at,
        reviewed_at,
        evidence_file_path,
        evidence_file_name,
        evidence_file_type,
        evidence_file_size,
        evidence_recorded_at,
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
          skill_id,
          courses!inner (
            id,
            title,
            slug,
            instructor_id
          )
        )
      `)
      .eq("id", id)
      .maybeSingle();

    if (submissionError) {
      console.error(
        "Practical submission lookup failed:",
        submissionError.message,
      );

      return jsonError(
        "Unable to load the practical submission.",
        500,
      );
    }

    if (!submissionData) {
      return jsonError(
        "Practical submission not found.",
        404,
      );
    }

    const row =
      submissionData as unknown as SubmissionRow;

    const task = row.course_practical_tasks;
    const course = task?.courses;

    if (!task || !course) {
      return jsonError(
        "The submission is not attached to a valid practical task and course.",
        400,
      );
    }

    if (
      reviewer.role === "instructor" &&
      course.instructor_id !== reviewer.user.id
    ) {
      return jsonError(
        "You are not authorized to review this submission.",
        403,
      );
    }

    /*
     * A saved draft should be submitted by the learner before review.
     * An already-approved record is allowed through only so a failed
     * evidence-recording operation can be retried.
     */
    if (
      row.status === "draft" ||
      (
        row.status === "approved" &&
        status !== "approved"
      )
    ) {
      return jsonError(
        row.status === "draft"
          ? "A draft submission cannot be reviewed."
          : "An approved submission cannot be changed to another review status.",
        409,
      );
    }

    let score: number | null = null;

    if (
      body.score !== undefined &&
      body.score !== null &&
      body.score !== ""
    ) {
      const parsedScore = Number(body.score);
      const maxScore = getMaximumScore(task);

      if (
        !Number.isFinite(parsedScore) ||
        parsedScore < 0 ||
        parsedScore > maxScore
      ) {
        return jsonError(
          `Score must be a number between 0 and ${maxScore}.`,
        );
      }

      score = Math.round(parsedScore * 100) / 100;
    } else if (
      status === "approved" &&
      row.status === "approved" &&
      row.score !== null
    ) {
      /*
       * A retry must not discard the score already saved with approval.
       */
      score = row.score;
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
        "Revision-required submissions must include reviewer feedback.",
      );
    }

    /*
     * Save the review decision first. If evidence recording subsequently
     * fails, the response explains that approval was saved but evidence
     * needs a retry. This avoids silently reporting a complete success.
     */
    const now = new Date().toISOString();

    const {
      data: updatedSubmissionData,
      error: updateError,
    } = await admin
      .from("student_practical_task_submissions")
      .update({
        status,
        score,
        reviewer_feedback: feedback || null,
        reviewed_at: now,
        updated_at: now,
      })
      .eq("id", id)
      .select(`
        id,
        task_id,
        student_id,
        submission_text,
        status,
        score,
        reviewer_feedback,
        submitted_at,
        reviewed_at,
        evidence_file_path,
        evidence_file_name,
        evidence_file_type,
        evidence_file_size,
        evidence_recorded_at,
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
          skill_id,
          courses!inner (
            id,
            title,
            slug,
            instructor_id
          )
        )
      `)
      .single();

    if (updateError) {
      console.error(
        "Practical submission update failed:",
        updateError.message,
      );

      return jsonError(
        "Unable to save the review.",
        500,
      );
    }

    let updatedRow =
      updatedSubmissionData as unknown as SubmissionRow;

    let evidenceRecordedAt =
      updatedRow.evidence_recorded_at;

    if (
      status === "approved" &&
      score !== null &&
      !evidenceRecordedAt
    ) {
      try {
        evidenceRecordedAt =
          await recordPracticalEvidence(
            admin,
            updatedRow,
            score,
          );

        updatedRow = {
          ...updatedRow,
          evidence_recorded_at: evidenceRecordedAt,
        };
      } catch (evidenceError) {
        console.error(
          "Practical evidence recording failed after approval:",
          evidenceError,
        );

        return NextResponse.json(
          {
            success: false,
            approval_saved: true,
            evidence_recorded: false,
            error:
              "The submission was approved, but skill evidence could not be recorded. Retry the approval after resolving the recorded server error.",
          },
          { status: 500 },
        );
      }
    }

    /*
     * Activity logging is supplementary. The submission review and evidence
     * status are already saved, so activity failure does not invalidate them.
     */
    const { error: activityError } = await admin
      .from("learning_activity")
      .insert({
        student_id: updatedRow.student_id,
        course_id: task.course_id,
        activity_type:
          status === "approved"
            ? "practical_task_approved"
            : "practical_task_reviewed",
        metadata: {
          submission_id: updatedRow.id,
          task_id: task.id,
          task_title: task.title,
          status,
          score,
          evidence_recorded_at: evidenceRecordedAt,
        },
      });

    if (activityError) {
      console.error(
        "Practical review activity logging failed:",
        activityError.message,
      );
    }

    const evidenceFileUrl = await createEvidenceSignedUrl(
      admin,
      updatedRow.evidence_file_path,
    );

    return NextResponse.json({
      success: true,
      previousStatus: row.status,
      evidence_recorded: Boolean(evidenceRecordedAt),
      submission: {
        id: updatedRow.id,
        status: updatedRow.status,
        score: updatedRow.score,
        reviewer_feedback:
          updatedRow.reviewer_feedback,
        reviewed_at: updatedRow.reviewed_at,
        evidence_file_name:
          updatedRow.evidence_file_name,
        evidence_file_type:
          updatedRow.evidence_file_type,
        evidence_file_size:
          updatedRow.evidence_file_size,
        evidence_file_url: evidenceFileUrl,
        evidence_recorded_at: evidenceRecordedAt,
      },
    });
  } catch (error) {
    console.error(
      "Practical work PATCH error:",
      error,
    );

    return jsonError(
      "An unexpected error occurred while saving the practical work review.",
      500,
    );
  }
}