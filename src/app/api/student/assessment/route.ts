import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type SubmittedAnswers = Record<string, string>;

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    const courseId =
      typeof body?.courseId === "string"
        ? body.courseId
        : null;

    const answers: SubmittedAnswers =
      body?.answers &&
      typeof body.answers === "object" &&
      !Array.isArray(body.answers)
        ? body.answers
        : {};

    if (!courseId) {
      return NextResponse.json(
        { error: "Course ID is required." },
        { status: 400 }
      );
    }

    if (Object.keys(answers).length === 0) {
      return NextResponse.json(
        { error: "No assessment answers were submitted." },
        { status: 400 }
      );
    }

    const { data: questions, error: questionsError } =
      await supabase
        .from("assessment_questions")
        .select(
          `
            id,
            skill_id,
            question,
            correct_answer,
            difficulty,
            sort_order
          `
        )
        .eq("course_id", courseId)
        .order("sort_order", { ascending: true });

    if (questionsError) {
      console.error(
        "Assessment question lookup failed:",
        questionsError
      );

      return NextResponse.json(
        { error: "Unable to load assessment questions." },
        { status: 500 }
      );
    }

    if (!questions?.length) {
      return NextResponse.json(
        { error: "No assessment questions were found." },
        { status: 404 }
      );
    }

    const submittedQuestionIds = Object.keys(answers);

    const validQuestionIds = new Set(
      questions.map((question) => question.id)
    );

    const hasInvalidQuestion = submittedQuestionIds.some(
      (id) => !validQuestionIds.has(id)
    );

    if (hasInvalidQuestion) {
      return NextResponse.json(
        { error: "The submitted assessment contains an invalid question." },
        { status: 400 }
      );
    }

    if (submittedQuestionIds.length !== questions.length) {
      return NextResponse.json(
        { error: "Please answer all assessment questions." },
        { status: 400 }
      );
    }

    const skillIds = Array.from(
      new Set(
        questions
          .map((question) => question.skill_id)
          .filter((id): id is string => Boolean(id))
      )
    );

    const { data: skills, error: skillsError } = await supabase
      .from("learning_skills")
      .select("id, name, slug")
      .in("id", skillIds);

    if (skillsError) {
      console.error(
        "Assessment skill lookup failed:",
        skillsError
      );

      return NextResponse.json(
        { error: "Unable to load assessment skills." },
        { status: 500 }
      );
    }

    const skillMap = new Map(
      (skills || []).map((skill) => [skill.id, skill])
    );

    let correct = 0;

    const skillStats = new Map<
      string,
      {
        skillName: string;
        correct: number;
        total: number;
      }
    >();

    const answerRows = questions.map((question) => {
      const submittedAnswer = answers[question.id] ?? "";
      const isCorrect =
        submittedAnswer === question.correct_answer;

      if (isCorrect) {
        correct += 1;
      }

      if (question.skill_id) {
        const skill = skillMap.get(question.skill_id);

        if (skill) {
          const existing = skillStats.get(question.skill_id);

          if (existing) {
            existing.total += 1;

            if (isCorrect) {
              existing.correct += 1;
            }
          } else {
            skillStats.set(question.skill_id, {
              skillName: skill.name,
              correct: isCorrect ? 1 : 0,
              total: 1,
            });
          }
        }
      }

      return {
        question_id: question.id,
        answer: submittedAnswer,
        is_correct: isCorrect,
      };
    });

    const total = questions.length;
    const score = Math.round((correct / total) * 100);

    const { data: attempt, error: attemptError } =
      await supabase
        .from("assessment_attempts")
        .insert({
          student_id: user.id,
          course_id: courseId,
          score,
          total_questions: total,
          completed_at: new Date().toISOString(),
        })
        .select("id")
        .single();

    if (attemptError || !attempt) {
      console.error(
        "Assessment attempt insert failed:",
        attemptError
      );

      return NextResponse.json(
        { error: "Unable to save your assessment result." },
        { status: 500 }
      );
    }

    const assessmentAnswers = answerRows.map((answer) => ({
      attempt_id: attempt.id,
      question_id: answer.question_id,
      answer: answer.answer,
      is_correct: answer.is_correct,
    }));

    const { error: answersError } = await supabase
      .from("assessment_answers")
      .insert(assessmentAnswers);

    if (answersError) {
      console.error(
        "Assessment answers insert failed:",
        answersError
      );

      return NextResponse.json(
        { error: "Unable to save your assessment answers." },
        { status: 500 }
      );
    }

    const skillResults = Array.from(skillStats.entries()).map(
      ([skillId, stats]) => {
        const percentage = Math.round(
          (stats.correct / stats.total) * 100
        );

        let level = "beginner";

        if (percentage >= 80) {
          level = "advanced";
        } else if (percentage >= 50) {
          level = "intermediate";
        }

        return {
          skillId,
          skillName: stats.skillName,
          correct: stats.correct,
          total: stats.total,
          percentage,
          level,
        };
      }
    );

    for (const skill of skillResults) {
      const { error: profileError } = await supabase
        .from("learner_skill_profiles")
        .upsert(
          {
            student_id: user.id,
            skill_id: skill.skillId,
            confidence_score: skill.percentage,
            skill_level: skill.level,
            evidence: `Diagnostic assessment: ${skill.correct}/${skill.total} correct.`,
            strengths:
              skill.percentage >= 80
                ? `Strong performance in ${skill.skillName}.`
                : null,
            gaps:
              skill.percentage < 50
                ? `Further learning recommended in ${skill.skillName}.`
                : null,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "student_id,skill_id",
          }
        );

      if (profileError) {
        console.error(
          `Skill profile update failed for ${skill.skillName}:`,
          profileError
        );
      }
    }

    await supabase.from("learning_activity").insert({
      student_id: user.id,
      course_id: courseId,
      activity_type: "diagnostic_assessment_completed",
      metadata: {
        attempt_id: attempt.id,
        score,
        correct,
        total,
      },
    });

    return NextResponse.json({
      success: true,
      result: {
        score,
        correct,
        total,
        skillResults,
      },
    });
  } catch (error) {
    console.error("Assessment submission error:", error);

    return NextResponse.json(
      {
        error:
          "Something went wrong while processing the assessment.",
      },
      { status: 500 }
    );
  }
}