import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ReviewStatus =
  | "under_review"
  | "approved"
  | "revision_required";

type SubmissionRow = {
  id: string;
  task_id: string;
  student_id: string;
  submission_text: string;
  status: string;
  score: number | null;
  reviewer_feedback: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  evidence_recorded_at: string | null;
  created_at: string;
  updated_at: string;
  course_practical_tasks:
    | {
        id: string;
        course_id: string;
        title: string;
        scenario: string;
        expected_outcome: string;
        submission_type: string;
        max_score: number;
        sort_order: number;
        skill_id: string | null;
        courses:
          | {
              id: string;
              title: string;
              slug: string;
              instructor_id: string | null;
            }
          | null;
      }
    | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type SkillRow = {
  id: string;
  name: string;
};

function jsonError(
  message: string,
  status = 400
) {
  return NextResponse.json(
    {
      error: message,
    },
    {
      status,
    }
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

async function recordPracticalEvidence(
  admin: ReturnType<typeof createAdminClient>,
  submission: SubmissionRow,
  score: number
) {
  if (
    submission.evidence_recorded_at
  ) {
    return;
  }

  const task =
    submission.course_practical_tasks;

  if (!task?.skill_id) {
    return;
  }

  const {
    data: skill,
    error: skillError,
  } = await admin
    .from("learning_skills")
    .select("id, name")
    .eq("id", task.skill_id)
    .maybeSingle();

  if (skillError) {
    throw skillError;
  }

  if (!skill) {
    return;
  }

  const {
    data: existingProfile,
    error: profileLookupError,
  } = await admin
    .from("learner_skill_profiles")
    .select(
      `
        id,
        student_id,
        skill_id,
        score,
        confidence,
        confidence_score,
        skill_level,
        evidence,
        strengths,
        gaps,
        evidence_count
      `
    )
    .eq("student_id", submission.student_id)
    .eq("skill_id", task.skill_id)
    .maybeSingle();

  if (profileLookupError) {
    throw profileLookupError;
  }

  const previousConfidence = Math.max(
    0,
    Math.min(
      100,
      Number(
        existingProfile?.confidence_score ??
          existingProfile?.confidence ??
          existingProfile?.score ??
          0
      )
    )
  );

  const previousEvidenceCount =
    Math.max(
      0,
      Number(
        existingProfile?.evidence_count ?? 0
      )
    );

  /*
   * Practical evidence is deliberately given
   * meaningful weight without completely replacing
   * an existing assessment-based profile.
   *
   * First practical demonstration:
   *   60% existing profile
   *   40% practical performance
   *
   * Later demonstrations gradually strengthen
   * the profile without allowing one submission
   * to dominate it.
   */
  const practicalWeight =
    previousEvidenceCount > 0
      ? 0.25
      : 0.4;

  const newConfidence = Math.round(
    previousConfidence *
      (1 - practicalWeight) +
      score * practicalWeight
  );

  const normalizedConfidence =
    Math.max(
      0,
      Math.min(100, newConfidence)
    );

  let skillLevel = "beginner";

  if (normalizedConfidence >= 80) {
    skillLevel = "advanced";
  } else if (normalizedConfidence >= 60) {
    skillLevel = "intermediate";
  }

  const previousEvidence =
    existingProfile?.evidence?.trim() || "";

  const evidenceLine =
    `${new Date().toISOString().slice(0, 10)}: ` +
    `Verified practical demonstration — ` +
    `${task.title} — ${score}/${task.max_score} ` +
    `(${skill.name}).`;

  const evidence =
    previousEvidence
      ? `${previousEvidence}\n${evidenceLine}`
      : evidenceLine;

  const {
    error: profileError,
  } = await admin
    .from("learner_skill_profiles")
    .upsert(
      {
        student_id:
          submission.student_id,
        skill_id:
          task.skill_id,
        score:
          normalizedConfidence,
        confidence:
          normalizedConfidence,
        confidence_score:
          normalizedConfidence,
        skill_level:
          skillLevel,
        evidence,
        evidence_count:
          previousEvidenceCount + 1,
        updated_at:
          new Date().toISOString(),
      },
      {
        onConflict:
          "student_id,skill_id",
      }
    );

  if (profileError) {
    throw profileError;
  }

  const {
    error: activityError,
  } = await admin
    .from("learning_activity")
    .insert({
      student_id:
        submission.student_id,
      course_id:
        task.course_id,
      activity_type:
        "practical_task_approved",
      metadata: {
        submission_id:
          submission.id,
        task_id:
          task.id,
        task_title:
          task.title,
        skill_id:
          task.skill_id,
        skill_name:
          skill.name,
        score,
        max_score:
          task.max_score,
        verified:
          true,
      },
    });

  if (activityError) {
    console.error(
      "Practical evidence activity logging failed:",
      activityError
    );
  }

  const {
    error: evidenceMarkerError,
  } = await admin
    .from(
      "student_practical_task_submissions"
    )
    .update({
      evidence_recorded_at:
        new Date().toISOString(),
    })
    .eq("id", submission.id)
    .is(
      "evidence_recorded_at",
      null
    );

  if (evidenceMarkerError) {
    throw evidenceMarkerError;
  }
}

export async function GET() {
  try {
    const {
      user,
      role,
    } = await getReviewer();

    if (!user) {
      return jsonError(
        "Authentication required.",
        401
      );
    }

    if (
      role !== "admin" &&
      role !== "instructor"
    ) {
      return jsonError(
        "You are not authorized to review practical work.",
        403
      );
    }

    const admin =
      createAdminClient();

    const {
      data,
      error,
    } = await admin
      .from(
        "student_practical_task_submissions"
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
        `
      )
      .order(
        "submitted_at",
        {
          ascending: false,
          nullsFirst: false,
        }
      );

    if (error) {
      console.error(
        "Practical work query failed:",
        error
      );

      return jsonError(
        "Unable to load practical work.",
        500
      );
    }

    const rows =
      (data || []) as unknown as SubmissionRow[];

    const visibleRows =
      role === "admin"
        ? rows
        : rows.filter(
            (row) =>
              row
                .course_practical_tasks
                ?.courses
                ?.instructor_id ===
              user.id
          );

    const studentIds = [
      ...new Set(
        visibleRows.map(
          (row) =>
            row.student_id
        )
      ),
    ];

    let profiles: ProfileRow[] = [];

    if (studentIds.length > 0) {
      const {
        data: profileData,
        error: profileError,
      } = await admin
        .from("profiles")
        .select(
          "id, full_name, email"
        )
        .in(
          "id",
          studentIds
        );

      if (profileError) {
        return jsonError(
          "Unable to load learner information.",
          500
        );
      }

      profiles =
        (profileData ||
          []) as ProfileRow[];
    }

    const profileMap =
      new Map<
        string,
        ProfileRow
      >();

    profiles.forEach(
      (profile) => {
        profileMap.set(
          profile.id,
          profile
        );
      }
    );

    const submissions =
      visibleRows.map(
        (row) => {
          const task =
            row.course_practical_tasks;

          const course =
            task?.courses;

          const profile =
            profileMap.get(
              row.student_id
            );

          return {
            id: row.id,
            task_id:
              row.task_id,
            student_id:
              row.student_id,
            submission_text:
              row.submission_text,
            status:
              row.status,
            score:
              row.score,
            reviewer_feedback:
              row.reviewer_feedback,
            submitted_at:
              row.submitted_at,
            reviewed_at:
              row.reviewed_at,
            evidence_recorded_at:
              row.evidence_recorded_at,
            created_at:
              row.created_at,
            updated_at:
              row.updated_at,

            student: {
              id:
                profile?.id ??
                row.student_id,
              full_name:
                profile?.full_name ??
                null,
              email:
                profile?.email ??
                null,
            },

            task: {
              id:
                task?.id ??
                row.task_id,
              course_id:
                task?.course_id ??
                null,
              title:
                task?.title ??
                "Practical task",
              scenario:
                task?.scenario ??
                "",
              expected_outcome:
                task?.expected_outcome ??
                "",
              submission_type:
                task?.submission_type ??
                "text",
              max_score:
                Number(
                  task?.max_score ??
                    100
                ),
              sort_order:
                Number(
                  task?.sort_order ??
                    0
                ),
              skill_id:
                task?.skill_id ??
                null,
            },

            course: {
              id:
                course?.id ??
                null,
              title:
                course?.title ??
                "Course",
              slug:
                course?.slug ??
                "",
              instructor_id:
                course?.instructor_id ??
                null,
            },
          };
        }
      );

    return NextResponse.json({
      submissions,
    });
  } catch (error) {
    console.error(
      "Practical work GET error:",
      error
    );

    return jsonError(
      "An unexpected error occurred while loading practical work.",
      500
    );
  }
}

export async function PATCH(
  request: Request
) {
  try {
    const {
      user,
      role,
    } = await getReviewer();

    if (!user) {
      return jsonError(
        "Authentication required.",
        401
      );
    }

    if (
      role !== "admin" &&
      role !== "instructor"
    ) {
      return jsonError(
        "You are not authorized to review practical work.",
        403
      );
    }

    let body: {
      id?: unknown;
      status?: unknown;
      score?: unknown;
      reviewer_feedback?: unknown;
    };

    try {
      body =
        (await request.json()) as {
          id?: unknown;
          status?: unknown;
          score?: unknown;
          reviewer_feedback?: unknown;
        };
    } catch {
      return jsonError(
        "Invalid request body."
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
      typeof body.reviewer_feedback ===
      "string"
        ? body.reviewer_feedback.trim()
        : "";

    if (!id) {
      return jsonError(
        "Submission ID is required."
      );
    }

    if (
      status !== "under_review" &&
      status !== "approved" &&
      status !== "revision_required"
    ) {
      return jsonError(
        "Invalid review status."
      );
    }

    const admin =
      createAdminClient();

    const {
      data: submission,
      error:
        submissionError,
    } = await admin
      .from(
        "student_practical_task_submissions"
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
        `
      )
      .eq("id", id)
      .maybeSingle();

    if (submissionError) {
      return jsonError(
        "Unable to load the practical submission.",
        500
      );
    }

    if (!submission) {
      return jsonError(
        "Practical submission not found.",
        404
      );
    }

    const row =
      submission as unknown as SubmissionRow;

    const course =
      row
        .course_practical_tasks
        ?.courses;

    if (!course) {
      return jsonError(
        "The submission is not attached to a valid course.",
        400
      );
    }

    if (
      role === "instructor" &&
      course.instructor_id !==
        user.id
    ) {
      return jsonError(
        "You are not authorized to review this submission.",
        403
      );
    }

    let score: number | null =
      null;

    if (
      body.score !== undefined &&
      body.score !== null &&
      body.score !== ""
    ) {
      const numericScore =
        Number(body.score);

      if (
        !Number.isFinite(
          numericScore
        )
      ) {
        return jsonError(
          "Score must be a valid number."
        );
      }

      const maxScore =
        Number(
          row
            .course_practical_tasks
            ?.max_score ??
            100
        );

      if (
        numericScore < 0 ||
        numericScore > maxScore
      ) {
        return jsonError(
          `Score must be between 0 and ${maxScore}.`
        );
      }

      score =
        Math.round(
          numericScore * 100
        ) / 100;
    }

    if (
      status === "approved" &&
      score === null
    ) {
      return jsonError(
        "An approved submission must have a score."
      );
    }

    if (
      status === "revision_required" &&
      !feedback
    ) {
      return jsonError(
        "Revision-required submissions must include reviewer feedback."
      );
    }

    const previousStatus =
      row.status;

    const {
      data: updatedSubmission,
      error: updateError,
    } = await admin
      .from(
        "student_practical_task_submissions"
      )
      .update({
        status,
        score,
        reviewer_feedback:
          feedback || null,
        reviewed_at:
          new Date().toISOString(),
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", id)
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
        `
      )
      .single();

    if (updateError) {
      console.error(
        "Practical submission update failed:",
        updateError
      );

      return jsonError(
        "Unable to save the review.",
        500
      );
    }

    const updatedRow =
      updatedSubmission as unknown as SubmissionRow;

    /*
     * Record verified evidence only after
     * an approval. The evidence marker makes
     * this operation idempotent.
     */
    if (
      status === "approved" &&
      score !== null &&
      !updatedRow.evidence_recorded_at
    ) {
      try {
        await recordPracticalEvidence(
          admin,
          updatedRow,
          score
        );
      } catch (e) {
        console.error(
          "Practical evidence recording failed:",
          e
        );

        /*
         * Do not undo the human review.
         * The review remains approved and the
         * evidence can be repaired separately.
         */
      }
    }

    return NextResponse.json({
      success: true,
      previousStatus,
      submission: {
        id:
          updatedRow.id,
        status:
          updatedRow.status,
        score:
          updatedRow.score,
        reviewer_feedback:
          updatedRow.reviewer_feedback,
        reviewed_at:
          updatedRow.reviewed_at,
        evidence_recorded_at:
          updatedRow.evidence_recorded_at,
      },
    });
  } catch (error) {
    console.error(
      "Practical work PATCH error:",
      error
    );

    return jsonError(
      "An unexpected error occurred while saving the review.",
      500
    );
  }
}