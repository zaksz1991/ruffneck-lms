import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Role =
  | "admin"
  | "instructor"
  | "student";

type AssessmentQuestion = {
  id: string;
  course_id: string;
  skill_id: string | null;
  question: string | null;
  question_text: string | null;
  options: unknown;
  correct_answer: string | null;
  explanation: string | null;
  difficulty: string | null;
  points: number | null;
  question_type: string | null;
  sort_order: number | null;
};

type QuestionInput = {
  question?: unknown;
  options?: unknown;
  correct_answer?: unknown;
  explanation?: unknown;
  difficulty?: unknown;
  points?: unknown;
  question_type?: unknown;
  skill_id?: unknown;
};

function asString(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is string =>
        typeof item === "string"
    )
    .map((item) => item.trim())
    .filter(Boolean);
}

function asPositiveInteger(
  value: unknown,
  fallback: number
): number {
  if (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0
  ) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    if (
      Number.isInteger(parsed) &&
      parsed > 0
    ) {
      return parsed;
    }
  }

  return fallback;
}

function normalizeDifficulty(
  value: unknown
): string {
  const difficulty =
    asString(value).toLowerCase();

  if (
    difficulty === "intermediate" ||
    difficulty === "advanced"
  ) {
    return difficulty;
  }

  return "beginner";
}

function normalizeQuestionType(
  value: unknown
): string {
  const questionType =
    asString(value).toLowerCase();

  if (
    questionType === "true_false" ||
    questionType === "short_answer" ||
    questionType === "multiple_choice"
  ) {
    return questionType;
  }

  return "multiple_choice";
}

function isOptionAnswerValid(
  options: string[],
  answer: string
): boolean {
  const normalizedAnswer =
    answer.trim().toLowerCase();

  return options.some(
    (option) =>
      option.trim().toLowerCase() ===
      normalizedAnswer
  );
}

async function getAuthorizedUser() {
  const supabase =
    await createClient();

  const {
    data: { user },
    error: userError,
  } =
    await supabase.auth.getUser();

  if (userError || !user) {
    return {
      supabase,
      user: null,
      role: null as Role | null,
      error:
        "Authentication required.",
      status: 401,
    };
  }

  const {
    data: profile,
    error: profileError,
  } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

  if (
    profileError ||
    !profile
  ) {
    return {
      supabase,
      user,
      role: null as Role | null,
      error:
        "Unable to verify your account role.",
      status: 403,
    };
  }

  const role =
    profile.role as Role;

  if (
    role !== "admin" &&
    role !== "instructor"
  ) {
    return {
      supabase,
      user,
      role,
      error:
        "Only admins and instructors can manage assessments.",
      status: 403,
    };
  }

  return {
    supabase,
    user,
    role,
    error: null,
    status: 200,
  };
}

async function verifyCourseAccess(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >,
  userId: string,
  role: Role,
  courseId: string
) {
  const {
    data: course,
    error,
  } = await supabase
    .from("courses")
    .select(
      "id, title, instructor_id"
    )
    .eq("id", courseId)
    .maybeSingle();

  if (error) {
    return {
      course: null,
      error: error.message,
      status: 500,
    };
  }

  if (!course) {
    return {
      course: null,
      error: "Course not found.",
      status: 404,
    };
  }

  if (
    role === "instructor" &&
    course.instructor_id !== userId
  ) {
    return {
      course: null,
      error:
        "You can only manage assessments for courses assigned to your instructor account.",
      status: 403,
    };
  }

  return {
    course,
    error: null,
    status: 200,
  };
}

function displayQuestion(
  row: AssessmentQuestion
): string {
  return (
    asString(row.question_text) ||
    asString(row.question) ||
    ""
  );
}

function normalizeOptions(
  value: unknown
): string[] {
  return asStringArray(value);
}

export async function GET(
  request: Request
) {
  try {
    const auth =
      await getAuthorizedUser();

    if (auth.error) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const url =
      new URL(request.url);

    const courseId =
      url.searchParams
        .get("courseId")
        ?.trim() || "";

    if (!courseId) {
      return NextResponse.json(
        {
          error:
            "Course ID is required.",
        },
        { status: 400 }
      );
    }

    const courseAccess =
      await verifyCourseAccess(
        auth.supabase,
        auth.user!.id,
        auth.role!,
        courseId
      );

    if (courseAccess.error) {
      return NextResponse.json(
        {
          error:
            courseAccess.error,
        },
        {
          status:
            courseAccess.status,
        }
      );
    }

    const {
      data: questionData,
      error: questionError,
    } = await auth.supabase
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
          error:
            questionError.message,
        },
        { status: 500 }
      );
    }

    const questions =
      (
        (questionData ??
          []) as unknown as AssessmentQuestion[]
      ).map((row, index) => ({
        id: row.id,
        course_id: row.course_id,
        skill_id: row.skill_id,
        question:
          displayQuestion(row),
        options:
          normalizeOptions(
            row.options
          ),
        correct_answer:
          asString(
            row.correct_answer
          ),
        explanation:
          asString(
            row.explanation
          ),
        difficulty:
          normalizeDifficulty(
            row.difficulty
          ),
        points:
          asPositiveInteger(
            row.points,
            1
          ),
        question_type:
          normalizeQuestionType(
            row.question_type
          ),
        sort_order:
          Number.isInteger(
            row.sort_order
          )
            ? row.sort_order
            : index + 1,
      }));

    return NextResponse.json({
      course:
        courseAccess.course,
      questions,
    });
  } catch (error) {
    console.error(
      "Admin assessment GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "An unexpected error occurred while loading assessment questions.",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request
) {
  try {
    const auth =
      await getAuthorizedUser();

    if (auth.error) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    let body:
      | Record<string, unknown>
      | null = null;

    try {
      body =
        (await request.json()) as Record<
          string,
          unknown
        >;
    } catch {
      return NextResponse.json(
        {
          error:
            "Invalid request body.",
        },
        { status: 400 }
      );
    }

    const courseId = asString(
      body.course_id
    );

    if (!courseId) {
      return NextResponse.json(
        {
          error:
            "Course ID is required.",
        },
        { status: 400 }
      );
    }

    const courseAccess =
      await verifyCourseAccess(
        auth.supabase,
        auth.user!.id,
        auth.role!,
        courseId
      );

    if (courseAccess.error) {
      return NextResponse.json(
        {
          error:
            courseAccess.error,
        },
        {
          status:
            courseAccess.status,
        }
      );
    }

    const input =
      body as QuestionInput;

    const question =
      asString(
        input.question
      );

    const options =
      asStringArray(
        input.options
      );

    const correctAnswer =
      asString(
        input.correct_answer
      );

    const explanation =
      asString(
        input.explanation
      ) || null;

    const difficulty =
      normalizeDifficulty(
        input.difficulty
      );

    const questionType =
      normalizeQuestionType(
        input.question_type
      );

    const skillId =
      asString(
        input.skill_id
      ) || null;

    const points =
      asPositiveInteger(
        input.points,
        1
      );

    if (!question) {
      return NextResponse.json(
        {
          error:
            "Question text is required.",
        },
        { status: 400 }
      );
    }

    if (
      questionType ===
        "multiple_choice" &&
      options.length < 2
    ) {
      return NextResponse.json(
        {
          error:
            "Multiple-choice questions require at least two options.",
        },
        { status: 400 }
      );
    }

    if (
      questionType ===
        "multiple_choice" &&
      !isOptionAnswerValid(
        options,
        correctAnswer
      )
    ) {
      return NextResponse.json(
        {
          error:
            "The correct answer must match one of the supplied options.",
        },
        { status: 400 }
      );
    }

    const {
      data: lastQuestion,
      error: orderError,
    } = await auth.supabase
      .from("assessment_questions")
      .select("sort_order")
      .eq("course_id", courseId)
      .order("sort_order", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (orderError) {
      return NextResponse.json(
        {
          error:
            orderError.message,
        },
        { status: 500 }
      );
    }

    /*
     * Read sort_order into a separate variable so TypeScript
     * can safely narrow the nullable query result.
     */
    const lastSortOrder =
      lastQuestion?.sort_order;

    const nextSortOrder =
      Number.isInteger(
        lastSortOrder
      )
        ? Number(lastSortOrder) + 1
        : 1;

    const {
      data: created,
      error: insertError,
    } = await auth.supabase
      .from("assessment_questions")
      .insert({
        course_id: courseId,
        skill_id: skillId,
        question,
        question_text: question,
        options,
        correct_answer:
          correctAnswer ||
          null,
        explanation,
        difficulty,
        points,
        question_type:
          questionType,
        sort_order:
          nextSortOrder,
      })
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
      .single();

    if (insertError) {
      return NextResponse.json(
        {
          error:
            insertError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        question: {
          ...created,
          question:
            displayQuestion(
              created as unknown as AssessmentQuestion
            ),
          options:
            normalizeOptions(
              created.options
            ),
        },
        message:
          "Assessment question added.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Admin assessment POST error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "An unexpected error occurred while adding the assessment question.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request
) {
  try {
    const auth =
      await getAuthorizedUser();

    if (auth.error) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    let body:
      | Record<string, unknown>
      | null = null;

    try {
      body =
        (await request.json()) as Record<
          string,
          unknown
        >;
    } catch {
      return NextResponse.json(
        {
          error:
            "Invalid request body.",
        },
        { status: 400 }
      );
    }

    const questionId =
      asString(body.id);

    if (!questionId) {
      return NextResponse.json(
        {
          error:
            "Assessment question ID is required.",
        },
        { status: 400 }
      );
    }

    const {
      data: currentQuestion,
      error: currentError,
    } = await auth.supabase
      .from("assessment_questions")
      .select(
        "id, course_id, sort_order"
      )
      .eq("id", questionId)
      .maybeSingle();

    if (currentError) {
      return NextResponse.json(
        {
          error:
            currentError.message,
        },
        { status: 500 }
      );
    }

    if (!currentQuestion) {
      return NextResponse.json(
        {
          error:
            "Assessment question not found.",
        },
        { status: 404 }
      );
    }

    const courseAccess =
      await verifyCourseAccess(
        auth.supabase,
        auth.user!.id,
        auth.role!,
        currentQuestion.course_id
      );

    if (courseAccess.error) {
      return NextResponse.json(
        {
          error:
            courseAccess.error,
        },
        {
          status:
            courseAccess.status,
        }
      );
    }

    const input =
      body as QuestionInput;

    const question =
      asString(
        input.question
      );

    const options =
      asStringArray(
        input.options
      );

    const correctAnswer =
      asString(
        input.correct_answer
      );

    const explanation =
      asString(
        input.explanation
      ) || null;

    const difficulty =
      normalizeDifficulty(
        input.difficulty
      );

    const questionType =
      normalizeQuestionType(
        input.question_type
      );

    const skillId =
      asString(
        input.skill_id
      ) || null;

    const points =
      asPositiveInteger(
        input.points,
        1
      );

    if (!question) {
      return NextResponse.json(
        {
          error:
            "Question text is required.",
        },
        { status: 400 }
      );
    }

    if (
      questionType ===
        "multiple_choice" &&
      options.length < 2
    ) {
      return NextResponse.json(
        {
          error:
            "Multiple-choice questions require at least two options.",
        },
        { status: 400 }
      );
    }

    if (
      questionType ===
        "multiple_choice" &&
      !isOptionAnswerValid(
        options,
        correctAnswer
      )
    ) {
      return NextResponse.json(
        {
          error:
            "The correct answer must match one of the supplied options.",
        },
        { status: 400 }
      );
    }

    const {
      data: updated,
      error: updateError,
    } = await auth.supabase
      .from("assessment_questions")
      .update({
        skill_id: skillId,
        question,
        question_text: question,
        options,
        correct_answer:
          correctAnswer ||
          null,
        explanation,
        difficulty,
        points,
        question_type:
          questionType,
      })
      .eq("id", questionId)
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
      .single();

    if (updateError) {
      return NextResponse.json(
        {
          error:
            updateError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      question: {
        ...updated,
        question:
          displayQuestion(
            updated as unknown as AssessmentQuestion
          ),
        options:
          normalizeOptions(
            updated.options
          ),
      },
      message:
        "Assessment question updated.",
    });
  } catch (error) {
    console.error(
      "Admin assessment PATCH error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "An unexpected error occurred while updating the assessment question.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request
) {
  try {
    const auth =
      await getAuthorizedUser();

    if (auth.error) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const url =
      new URL(request.url);

    const questionId =
      url.searchParams
        .get("id")
        ?.trim() || "";

    if (!questionId) {
      return NextResponse.json(
        {
          error:
            "Assessment question ID is required.",
        },
        { status: 400 }
      );
    }

    const {
      data: currentQuestion,
      error: currentError,
    } = await auth.supabase
      .from("assessment_questions")
      .select(
        "id, course_id"
      )
      .eq("id", questionId)
      .maybeSingle();

    if (currentError) {
      return NextResponse.json(
        {
          error:
            currentError.message,
        },
        { status: 500 }
      );
    }

    if (!currentQuestion) {
      return NextResponse.json(
        {
          error:
            "Assessment question not found.",
        },
        { status: 404 }
      );
    }

    const courseAccess =
      await verifyCourseAccess(
        auth.supabase,
        auth.user!.id,
        auth.role!,
        currentQuestion.course_id
      );

    if (courseAccess.error) {
      return NextResponse.json(
        {
          error:
            courseAccess.error,
        },
        {
          status:
            courseAccess.status,
        }
      );
    }

    const {
      error: deleteError,
    } = await auth.supabase
      .from("assessment_questions")
      .delete()
      .eq("id", questionId);

    if (deleteError) {
      return NextResponse.json(
        {
          error:
            deleteError.message,
        },
        { status: 500 }
      );
    }

    const {
      data: remaining,
      error:
        remainingError,
    } = await auth.supabase
      .from("assessment_questions")
      .select("id")
      .eq(
        "course_id",
        currentQuestion.course_id
      )
      .order("sort_order", {
        ascending: true,
      });

    if (!remainingError) {
      for (
        let index = 0;
        index <
        (remaining?.length ?? 0);
        index += 1
      ) {
        await auth.supabase
          .from(
            "assessment_questions"
          )
          .update({
            sort_order:
              index + 1,
          })
          .eq(
            "id",
            remaining![index].id
          );
      }
    }

    return NextResponse.json({
      success: true,
      message:
        "Assessment question deleted.",
    });
  } catch (error) {
    console.error(
      "Admin assessment DELETE error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "An unexpected error occurred while deleting the assessment question.",
      },
      { status: 500 }
    );
  }
}