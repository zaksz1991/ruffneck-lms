import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type QuestionRow = {
  id: string;
  course_id: string;
  skill_id: string | null;
  question: string | null;
  question_text: string | null;
  options: unknown;
  correct_answer: string;
  explanation: string | null;
  difficulty: string | null;
  points: number;
  question_type: string | null;
  sort_order: number | null;
};

type Skill = {
  id: string;
  name: string;
};

type AnswerMap = Record<string, unknown>;

type AssessmentOption = string;

function normalizeAnswer(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
}

function getDisplayQuestion(question: QuestionRow): string {
  return (
    question.question?.trim() ||
    question.question_text?.trim() ||
    ""
  );
}

function parseOptions(value: unknown): AssessmentOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (option): option is string =>
      typeof option === "string" &&
      option.trim().length > 0
  );
}

function getSkillLevel(score: number): string {
  if (score >= 80) {
    return "advanced";
  }

  if (score >= 50) {
    return "intermediate";
  }

  return "beginner";
}

async function getAuthenticatedUser() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    supabase,
    user,
  };
}

async function verifyCourseAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  courseId: string
) {
  const {
    data: course,
    error: courseError,
  } = await supabase
    .from("courses")
    .select("id")
    .eq("id", courseId)
    .eq("status", "published")
    .maybeSingle();

  if (courseError) {
    return {
      error: courseError.message,
      status: 500,
    };
  }

  if (!course) {
    return {
      error:
        "Course not found or is not currently published.",
      status: 404,
    };
  }

  const {
    data: enrollment,
    error: enrollmentError,
  } = await supabase
    .from("enrollments")
    .select(
      "id, enrollment_status, payment_status"
    )
    .eq("student_id", userId)
    .eq("course_id", courseId)
    .in("enrollment_status", [
      "active",
      "completed",
    ])
    .maybeSingle();

  if (enrollmentError) {
    return {
      error: enrollmentError.message,
      status: 500,
    };
  }

  if (!enrollment) {
    return {
      error:
        "You must be enrolled in this course before accessing its assessment.",
      status: 403,
    };
  }

  return {
    course,
    enrollment,
  };
}

/*
 * GET
 *
 * Returns only assessment fields that are safe for the
 * student-facing assessment interface.
 *
 * IMPORTANT:
 * correct_answer and explanation are deliberately
 * excluded so they are never exposed before submission.
 */
export async function GET(request: Request) {
  try {
    const {
      supabase,
      user,
    } = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Authentication required.",
        },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const courseId =
      url.searchParams.get("courseId")?.trim() || "";

    if (!courseId) {
      return NextResponse.json(
        {
          error: "Course ID is required.",
        },
        { status: 400 }
      );
    }

    const access = await verifyCourseAccess(
      supabase,
      user.id,
      courseId
    );

    if ("error" in access) {
      return NextResponse.json(
        {
          error: access.error,
        },
        { status: access.status }
      );
    }

    const {
      data: questionData,
      error: questionError,
    } = await supabase
      .from("assessment_questions")
      .select(
        [
          "id",
          "course_id",
          "skill_id",
          "question",
          "question_text",
          "options",
          "difficulty",
          "points",
          "question_type",
          "sort_order",
        ].join(", ")
      )
      .eq("course_id", courseId)
      .order("sort_order", {
        ascending: true,
      });

    if (questionError) {
      return NextResponse.json(
        {
          error: questionError.message,
        },
        { status: 500 }
      );
    }

    const questions =
      (questionData as unknown as QuestionRow[]) ||
      [];

    if (questions.length === 0) {
      return NextResponse.json(
        {
          error:
            "No assessment questions exist for this course.",
        },
        { status: 404 }
      );
    }

    const skillIds = Array.from(
      new Set(
        questions
          .map((question) => question.skill_id)
          .filter(
            (skillId): skillId is string =>
              Boolean(skillId)
          )
      )
    );

    let skills: Skill[] = [];

    if (skillIds.length > 0) {
      const {
        data: skillData,
        error: skillError,
      } = await supabase
        .from("learning_skills")
        .select("id, name")
        .in("id", skillIds);

      if (skillError) {
        return NextResponse.json(
          {
            error: skillError.message,
          },
          { status: 500 }
        );
      }

      skills =
        (skillData as unknown as Skill[]) || [];
    }

    const skillMap = new Map(
      skills.map((skill) => [
        skill.id,
        skill.name,
      ])
    );

    const publicQuestions = [];

    for (const question of questions) {
      const options = parseOptions(
        question.options
      );

      if (options.length < 2) {
        return NextResponse.json(
          {
            error:
              "One or more assessment questions have invalid options.",
          },
          { status: 500 }
        );
      }

      const questionText =
        getDisplayQuestion(question);

      if (!questionText) {
        return NextResponse.json(
          {
            error:
              "One or more assessment questions have no question text.",
          },
          { status: 500 }
        );
      }

      publicQuestions.push({
        id: question.id,
        skillId: question.skill_id,
        skillName: question.skill_id
          ? skillMap.get(
              question.skill_id
            ) || null
          : null,
        question: questionText,
        options,
        difficulty:
          question.difficulty || "beginner",
        points:
          Number.isFinite(question.points) &&
          question.points > 0
            ? question.points
            : 1,
        questionType:
          question.question_type ||
          "multiple_choice",
        sortOrder:
          question.sort_order ?? 0,
      });
    }

    publicQuestions.sort(
      (a, b) =>
        a.sortOrder - b.sortOrder
    );

    return NextResponse.json({
      courseId,
      totalQuestions:
        publicQuestions.length,
      questions: publicQuestions,
    });
  } catch (error) {
    console.error(
      "Assessment questions error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "An unexpected error occurred while loading the assessment.",
      },
      { status: 500 }
    );
  }
}

/*
 * POST
 *
 * Submits and permanently records an assessment attempt.
 *
 * Scoring is performed exclusively from the server-side
 * assessment_questions table. The client cannot submit
 * its own score or mark an answer as correct.
 */
export async function POST(request: Request) {
  try {
    const {
      supabase,
      user,
    } = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Authentication required.",
        },
        { status: 401 }
      );
    }

    let body: {
      courseId?: unknown;
      answers?: unknown;
      timeSpentSeconds?: unknown;
    };

    try {
      body =
        (await request.json()) as {
          courseId?: unknown;
          answers?: unknown;
          timeSpentSeconds?: unknown;
        };
    } catch {
      return NextResponse.json(
        {
          error: "Invalid request body.",
        },
        { status: 400 }
      );
    }

    const courseId =
      typeof body.courseId === "string"
        ? body.courseId.trim()
        : "";

    const answers =
      body.answers &&
      typeof body.answers === "object" &&
      !Array.isArray(body.answers)
        ? (body.answers as AnswerMap)
        : null;

    const timeSpentSeconds =
      typeof body.timeSpentSeconds === "number" &&
      Number.isInteger(
        body.timeSpentSeconds
      ) &&
      body.timeSpentSeconds >= 0
        ? body.timeSpentSeconds
        : 0;

    if (!courseId || !answers) {
      return NextResponse.json(
        {
          error:
            "Course and answers are required.",
        },
        { status: 400 }
      );
    }

    const access = await verifyCourseAccess(
      supabase,
      user.id,
      courseId
    );

    if ("error" in access) {
      return NextResponse.json(
        {
          error: access.error,
        },
        { status: access.status }
      );
    }

    const {
      data: questionData,
      error: questionError,
    } = await supabase
      .from("assessment_questions")
      .select(
        [
          "id",
          "course_id",
          "skill_id",
          "question",
          "question_text",
          "options",
          "correct_answer",
          "explanation",
          "difficulty",
          "points",
          "question_type",
          "sort_order",
        ].join(", ")
      )
      .eq("course_id", courseId)
      .order("sort_order", {
        ascending: true,
      });

    if (questionError) {
      return NextResponse.json(
        {
          error: questionError.message,
        },
        { status: 500 }
      );
    }

    const questions =
      (questionData as unknown as QuestionRow[]) ||
      [];

    if (questions.length === 0) {
      return NextResponse.json(
        {
          error:
            "No assessment questions exist for this course.",
        },
        { status: 404 }
      );
    }

    const answerKeys =
      Object.keys(answers);

    if (
      answerKeys.length !==
      questions.length
    ) {
      return NextResponse.json(
        {
          error:
            "All assessment questions must be answered.",
        },
        { status: 400 }
      );
    }

    const validQuestionIds =
      new Set(
        questions.map(
          (question) => question.id
        )
      );

    for (const questionId of answerKeys) {
      if (
        !validQuestionIds.has(
          questionId
        )
      ) {
        return NextResponse.json(
          {
            error:
              "The submitted assessment contains an invalid question.",
          },
          { status: 400 }
        );
      }
    }

    const skillIds = Array.from(
      new Set(
        questions
          .map((question) => question.skill_id)
          .filter(
            (skillId): skillId is string =>
              Boolean(skillId)
          )
      )
    );

    let skills: Skill[] = [];

    if (skillIds.length > 0) {
      const {
        data: skillData,
        error: skillError,
      } = await supabase
        .from("learning_skills")
        .select("id, name")
        .in("id", skillIds);

      if (skillError) {
        return NextResponse.json(
          {
            error: skillError.message,
          },
          { status: 500 }
        );
      }

      skills =
        (skillData as unknown as Skill[]) || [];
    }

    const skillMap = new Map(
      skills.map((skill) => [
        skill.id,
        skill,
      ])
    );

    const skillStats =
      new Map<
        string,
        {
          correct: number;
          total: number;
          earnedPoints: number;
          totalPoints: number;
        }
      >();

    let totalCorrect = 0;
    let earnedPoints = 0;
    let totalPoints = 0;

    const answerRows = [];

    for (const question of questions) {
      const options = parseOptions(
        question.options
      );

      if (options.length < 2) {
        return NextResponse.json(
          {
            error:
              "One or more assessment questions have invalid options.",
          },
          { status: 500 }
        );
      }

      const submittedRaw =
        answers[question.id];

      const submitted =
        typeof submittedRaw === "string"
          ? submittedRaw.trim()
          : "";

      if (!submitted) {
        return NextResponse.json(
          {
            error:
              "All assessment questions must contain a valid answer.",
          },
          { status: 400 }
        );
      }

      /*
       * The submitted answer must actually be one of the
       * choices supplied by the server.
       */
      const canonicalOption =
        options.find(
          (option) =>
            normalizeAnswer(option) ===
            normalizeAnswer(
              submitted
            )
        );

      if (!canonicalOption) {
        return NextResponse.json(
          {
            error:
              "One or more submitted answers are not valid assessment options.",
          },
          { status: 400 }
        );
      }

      const isCorrect =
        normalizeAnswer(
          canonicalOption
        ) ===
        normalizeAnswer(
          question.correct_answer
        );

      const questionPoints =
        Number.isFinite(
          question.points
        ) &&
        question.points > 0
          ? question.points
          : 1;

      if (isCorrect) {
        totalCorrect += 1;
        earnedPoints +=
          questionPoints;
      }

      totalPoints +=
        questionPoints;

      if (question.skill_id) {
        const existing =
          skillStats.get(
            question.skill_id
          ) || {
            correct: 0,
            total: 0,
            earnedPoints: 0,
            totalPoints: 0,
          };

        existing.total += 1;
        existing.totalPoints +=
          questionPoints;

        if (isCorrect) {
          existing.correct += 1;
          existing.earnedPoints +=
            questionPoints;
        }

        skillStats.set(
          question.skill_id,
          existing
        );
      }

      answerRows.push({
        question_id:
          question.id,
        answer:
          canonicalOption,
        is_correct:
          isCorrect,
        points_earned:
          isCorrect
            ? questionPoints
            : 0,
      });
    }

    const score =
      totalPoints > 0
        ? Math.round(
            (earnedPoints /
              totalPoints) *
              100
          )
        : 0;

    const timestamp =
      new Date().toISOString();

    /*
     * Create the attempt first because assessment_answers
     * requires its attempt_id.
     */
    const {
      data: attemptData,
      error: attemptError,
    } = await supabase
      .from("assessment_attempts")
      .insert({
        student_id: user.id,
        course_id: courseId,
        lesson_id: null,
        score,
        total_points:
          totalPoints,
        earned_points:
          earnedPoints,
        total_questions:
          questions.length,
        time_spent_seconds:
          timeSpentSeconds,
        completed_at:
          timestamp,
      })
      .select("id")
      .single();

    if (
      attemptError ||
      !attemptData
    ) {
      return NextResponse.json(
        {
          error:
            attemptError?.message ||
            "Unable to save assessment attempt.",
        },
        { status: 500 }
      );
    }

    const assessmentAnswerRows =
      answerRows.map(
        (answer) => ({
          attempt_id:
            attemptData.id,
          question_id:
            answer.question_id,
          answer:
            answer.answer,
          is_correct:
            answer.is_correct,
          points_earned:
            answer.points_earned,
          answered_at:
            timestamp,
        })
      );

    const {
      error: answersError,
    } = await supabase
      .from("assessment_answers")
      .insert(
        assessmentAnswerRows
      );

    /*
     * Prevent an orphaned assessment attempt from being
     * treated as a valid completed attempt when answer
     * persistence fails.
     */
    if (answersError) {
      const {
        error: rollbackError,
      } = await supabase
        .from("assessment_attempts")
        .delete()
        .eq(
          "id",
          attemptData.id
        )
        .eq(
          "student_id",
          user.id
        );

      if (rollbackError) {
        console.error(
          "Assessment attempt rollback failed:",
          rollbackError
        );
      }

      return NextResponse.json(
        {
          error:
            answersError.message ||
            "Unable to save assessment answers.",
        },
        { status: 500 }
      );
    }

    /*
     * Update learner skill profiles after the assessment
     * and all individual answers have been persisted.
     */
    const skillResults: Array<{
      id: string;
      name: string;
      score: number;
      correct: number;
      total: number;
      level: string;
    }> = [];

    for (const [
      skillId,
      stats,
    ] of skillStats.entries()) {
      const skillScore =
        stats.totalPoints > 0
          ? Math.round(
              (stats.earnedPoints /
                stats.totalPoints) *
                100
            )
          : 0;

      const level =
        getSkillLevel(
          skillScore
        );

      const skill =
        skillMap.get(
          skillId
        );

      if (!skill) {
        continue;
      }

      const {
        error: profileError,
      } = await supabase
        .from(
          "learner_skill_profiles"
        )
        .upsert(
          {
            student_id:
              user.id,
            skill_id:
              skillId,
            score:
              skillScore,
            confidence:
              skillScore,
            evidence_count:
              stats.total,
            confidence_score:
              skillScore,
            skill_level:
              level,
            last_assessed_at:
              timestamp,
            updated_at:
              timestamp,
          },
          {
            onConflict:
              "student_id,skill_id",
          }
        );

      if (profileError) {
        /*
         * Skill analytics are supplementary. The actual
         * assessment has already been persisted successfully.
         */
        console.error(
          "Skill profile update failed:",
          profileError
        );
      }

      skillResults.push({
        id: skill.id,
        name: skill.name,
        score:
          skillScore,
        correct:
          stats.correct,
        total:
          stats.total,
        level,
      });
    }

    /*
     * Activity logging is supplementary analytics.
     * It must not invalidate an otherwise successful
     * assessment submission.
     */
    const {
      error: activityError,
    } = await supabase
      .from("learning_activity")
      .insert({
        student_id:
          user.id,
        course_id:
          courseId,
        activity_type:
          "assessment_completed",
        metadata: {
          score,
          earned_points:
            earnedPoints,
          total_points:
            totalPoints,
          total_questions:
            questions.length,
          correct_answers:
            totalCorrect,
          time_spent_seconds:
            timeSpentSeconds,
          attempt_id:
            attemptData.id,
        },
      });

    if (activityError) {
      console.error(
        "Assessment activity logging failed:",
        activityError
      );
    }

    skillResults.sort(
      (a, b) =>
        b.score - a.score
    );

    return NextResponse.json({
      attemptId:
        attemptData.id,
      score,
      earnedPoints,
      totalPoints,
      correctAnswers:
        totalCorrect,
      totalQuestions:
        questions.length,
      timeSpentSeconds,
      skills:
        skillResults,
    });
  } catch (error) {
    console.error(
      "Assessment submission error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "An unexpected error occurred while submitting the assessment.",
      },
      { status: 500 }
    );
  }
}