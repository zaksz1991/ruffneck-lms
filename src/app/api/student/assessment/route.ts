import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type QuestionRow = {
  id: string;
  course_id: string;
  skill_id: string;
  question: string | null;
  question_text: string | null;
  correct_answer: string;
  explanation: string | null;
  difficulty: string | null;
  sort_order: number;
};

type Skill = {
  id: string;
  name: string;
};

type AnswerMap = Record<string, string>;

function normalizeAnswer(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function getSkillLevel(score: number) {
  if (score >= 80) {
    return "advanced";
  }

  if (score >= 50) {
    return "intermediate";
  }

  return "beginner";
}

export async function POST(
  request: Request
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  let body: {
    courseId?: string;
    answers?: AnswerMap;
  };

  try {
    body =
      (await request.json()) as {
        courseId?: string;
        answers?: AnswerMap;
      };
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const courseId = body.courseId;

  const answers =
    body.answers &&
    typeof body.answers === "object"
      ? body.answers
      : null;

  if (!courseId || !answers) {
    return NextResponse.json(
      {
        error:
          "Course and answers are required.",
      },
      { status: 400 }
    );
  }

  const { data: enrollmentData } =
    await supabase
      .from("enrollments")
      .select(
        "id, enrollment_status, payment_status"
      )
      .eq("student_id", user.id)
      .eq("course_id", courseId)
      .in("enrollment_status", [
        "active",
        "completed",
      ])
      .maybeSingle();

  if (!enrollmentData) {
    return NextResponse.json(
      {
        error:
          "You must be enrolled in this course before taking its assessment.",
      },
      { status: 403 }
    );
  }

  const { data: questionData } =
    await supabase
      .from("assessment_questions")
      .select(
        [
          "id",
          "course_id",
          "skill_id",
          "question",
          "question_text",
          "correct_answer",
          "explanation",
          "difficulty",
          "sort_order",
        ].join(", ")
      )
      .eq("course_id", courseId)
      .order("sort_order");

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

  const answerKeys = Object.keys(
    answers
  );

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

  const validQuestionIds = new Set(
    questions.map((question) => question.id)
  );

  for (const questionId of answerKeys) {
    if (!validQuestionIds.has(questionId)) {
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
      questions.map(
        (question) => question.skill_id
      )
    )
  );

  const { data: skillData } =
    await supabase
      .from("learning_skills")
      .select("id, name")
      .in("id", skillIds);

  const skills =
    (skillData as unknown as Skill[]) || [];

  const skillMap = new Map(
    skills.map((skill) => [
      skill.id,
      skill,
    ])
  );

  const skillStats = new Map<
    string,
    {
      correct: number;
      total: number;
    }
  >();

  let totalCorrect = 0;

  const answerRows = questions.map(
    (question) => {
      const submitted =
        normalizeAnswer(
          answers[question.id]
        );

      const correctAnswer =
        normalizeAnswer(
          question.correct_answer
        );

      const isCorrect =
        submitted === correctAnswer;

      if (isCorrect) {
        totalCorrect += 1;
      }

      const existing =
        skillStats.get(
          question.skill_id
        ) || {
          correct: 0,
          total: 0,
        };

      existing.total += 1;

      if (isCorrect) {
        existing.correct += 1;
      }

      skillStats.set(
        question.skill_id,
        existing
      );

      return {
        question_id: question.id,
        answer: submitted,
        is_correct: isCorrect,
      };
    }
  );

  const score = Math.round(
    (totalCorrect / questions.length) *
      100
  );

  const { data: attemptData, error: attemptError } =
    await supabase
      .from("assessment_attempts")
      .insert({
        student_id: user.id,
        course_id: courseId,
        score,
        total_questions:
          questions.length,
        completed_at:
          new Date().toISOString(),
      })
      .select("id")
      .single();

  if (attemptError || !attemptData) {
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
    answerRows.map((answer) => ({
      attempt_id: attemptData.id,
      question_id: answer.question_id,
      answer: answer.answer,
      is_correct: answer.is_correct,
    }));

  const { error: answersError } =
    await supabase
      .from("assessment_answers")
      .insert(assessmentAnswerRows);

  if (answersError) {
    return NextResponse.json(
      {
        error:
          answersError.message ||
          "Unable to save assessment answers.",
      },
      { status: 500 }
    );
  }

  const skillResults = [];

  for (const [
    skillId,
    stats,
  ] of skillStats.entries()) {
    const skillScore = Math.round(
      (stats.correct / stats.total) *
        100
    );

    const level =
      getSkillLevel(skillScore);

    const skill = skillMap.get(skillId);

    if (!skill) {
      continue;
    }

    const { error: profileError } =
      await supabase
        .from("learner_skill_profiles")
        .upsert(
          {
            student_id: user.id,
            skill_id: skillId,
            confidence_score: skillScore,
            skill_level: level,
            updated_at:
              new Date().toISOString(),
          },
          {
            onConflict:
              "student_id,skill_id",
          }
        );

    if (profileError) {
      console.error(
        "Skill profile update failed:",
        profileError
      );
    }

    skillResults.push({
      id: skill.id,
      name: skill.name,
      score: skillScore,
      correct: stats.correct,
      total: stats.total,
      level,
    });
  }

  const { error: activityError } =
    await supabase
      .from("learning_activity")
      .insert({
        student_id: user.id,
        course_id: courseId,
        activity_type:
          "assessment_completed",
        metadata: {
          score,
          total_questions:
            questions.length,
          correct_answers: totalCorrect,
        },
      });

  if (activityError) {
    console.error(
      "Assessment activity logging failed:",
      activityError
    );
  }

  skillResults.sort(
    (a, b) => b.score - a.score
  );

  return NextResponse.json({
    score,
    correctAnswers: totalCorrect,
    totalQuestions: questions.length,
    skills: skillResults,
  });
}