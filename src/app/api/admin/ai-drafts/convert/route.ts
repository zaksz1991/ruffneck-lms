import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ConvertBody = {
  id?: unknown;
};

type Profile = {
  role: "admin" | "instructor" | "student";
};

type ConversionResult = {
  success?: boolean;
  already_converted?: boolean;
  draft_id?: string;
  course_id?: string;
  course_title?: string;
  section_count?: number;
  duration_minutes?: number;
  converted_at?: string;
};

type DraftRecord = {
  id: string;
  title: string;
  status: string;
  learning_pack: unknown;
  converted_course_id: string | null;
  converted_at: string | null;
};

type AiAssessmentQuestion = {
  question?: unknown;
  options?: unknown;
  correct_answer?: unknown;
  explanation?: unknown;
  difficulty?: unknown;
  points?: unknown;
  question_type?: unknown;
};

type AssessmentInsertRow = {
  course_id: string;
  skill_id: string | null;
  question: string;
  question_text: string;
  options: string[];
  correct_answer: string;
  explanation: string | null;
  difficulty: string;
  points: number;
  question_type: string;
  sort_order: number;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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

function asObject(value: unknown): Record<string, unknown> {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as Record<string, unknown>;
  }

  return {};
}

function isConversionResult(
  value: unknown
): value is ConversionResult {
  return (
    typeof value === "object" &&
    value !== null
  );
}

function normalizeAnswer(value: string): string {
  return value.trim().toLowerCase();
}

function getAiAssessmentQuestions(
  learningPack: unknown
): AiAssessmentQuestion[] {
  const pack = asObject(learningPack);
  const value = pack.assessment_questions;

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (
      item
    ): item is AiAssessmentQuestion =>
      Boolean(item) &&
      typeof item === "object" &&
      !Array.isArray(item)
  );
}

function buildAssessmentRows(
  courseId: string,
  learningPack: unknown
): AssessmentInsertRow[] {
  const questions =
    getAiAssessmentQuestions(
      learningPack
    );

  return questions.map(
    (item, index) => {
      const question = asString(
        item.question
      );

      const options = asStringArray(
        item.options
      );

      const correctAnswer = asString(
        item.correct_answer
      );

      const explanation =
        asString(item.explanation) ||
        null;

      const difficulty =
        asString(item.difficulty) ||
        "beginner";

      const questionType =
        asString(
          item.question_type
        ) || "multiple_choice";

      const points =
        typeof item.points === "number" &&
        Number.isFinite(item.points) &&
        item.points > 0
          ? Math.round(item.points)
          : 1;

      if (!question) {
        throw new Error(
          `AI assessment question ${
            index + 1
          } is missing question text.`
        );
      }

      if (options.length < 2) {
        throw new Error(
          `AI assessment question ${
            index + 1
          } must contain at least two options.`
        );
      }

      if (!correctAnswer) {
        throw new Error(
          `AI assessment question ${
            index + 1
          } is missing its correct answer.`
        );
      }

      const matchingOption =
        options.find(
          (option) =>
            normalizeAnswer(
              option
            ) ===
            normalizeAnswer(
              correctAnswer
            )
        );

      if (!matchingOption) {
        throw new Error(
          `AI assessment question ${
            index + 1
          } has a correct answer that does not match any of its options.`
        );
      }

      return {
        course_id: courseId,
        skill_id: null,
        question,
        question_text: question,
        options,
        correct_answer:
          matchingOption,
        explanation,
        difficulty,
        points,
        question_type:
          questionType,
        sort_order: index + 1,
      };
    }
  );
}

async function importAssessmentQuestions(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >,
  courseId: string,
  learningPack: unknown
) {
  const aiRows =
    buildAssessmentRows(
      courseId,
      learningPack
    );

  if (aiRows.length === 0) {
    return {
      imported: 0,
      existing: 0,
      message:
        "No assessment questions were included in the AI learning pack.",
    };
  }

  const {
    data: existingQuestions,
    error: existingError,
  } = await supabase
    .from("assessment_questions")
    .select("id")
    .eq("course_id", courseId);

  if (existingError) {
    throw new Error(
      existingError.message ||
        "Unable to check existing assessment questions."
    );
  }

  const existingCount =
    existingQuestions?.length ?? 0;

  /*
   * Never overwrite questions that already exist.
   * This protects manually created or previously
   * imported assessment content.
   */
  if (existingCount > 0) {
    return {
      imported: 0,
      existing: existingCount,
      message:
        "Existing assessment questions were preserved.",
    };
  }

  const {
    error: insertError,
  } = await supabase
    .from("assessment_questions")
    .insert(aiRows);

  if (insertError) {
    throw new Error(
      insertError.message ||
        "Unable to import AI assessment questions."
    );
  }

  return {
    imported: aiRows.length,
    existing: 0,
    message:
      `${aiRows.length} AI-generated assessment question${
        aiRows.length === 1
          ? ""
          : "s"
      } imported successfully.`,
  };
}

async function getDraft(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >,
  draftId: string
): Promise<{
  draft: DraftRecord | null;
  error: string | null;
}> {
  const {
    data,
    error,
  } = await supabase
    .from("ai_learning_drafts")
    .select(
      [
        "id",
        "title",
        "status",
        "learning_pack",
        "converted_course_id",
        "converted_at",
      ].join(", ")
    )
    .eq("id", draftId)
    .single<DraftRecord>();

  if (error || !data) {
    return {
      draft: null,
      error:
        error?.message ||
        "AI draft not found.",
    };
  }

  return {
    draft: data,
    error: null,
  };
}

export async function POST(
  request: Request
) {
  try {
    const supabase =
      await createClient();

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          error:
            "Authentication required.",
        },
        { status: 401 }
      );
    }

    const {
      data: profile,
      error: profileError,
    } =
      await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single<Profile>();

    if (
      profileError ||
      !profile
    ) {
      return NextResponse.json(
        {
          error:
            "User profile could not be verified.",
        },
        { status: 403 }
      );
    }

    if (
      profile.role !== "admin" &&
      profile.role !== "instructor"
    ) {
      return NextResponse.json(
        {
          error:
            "Only admins and instructors can convert AI drafts.",
        },
        { status: 403 }
      );
    }

    let body: ConvertBody;

    try {
      body =
        (await request.json()) as ConvertBody;
    } catch {
      return NextResponse.json(
        {
          error:
            "Invalid request body.",
        },
        { status: 400 }
      );
    }

    const draftId = asString(
      body.id
    );

    if (!draftId) {
      return NextResponse.json(
        {
          error:
            "AI draft ID is required.",
        },
        { status: 400 }
      );
    }

    const {
      draft,
      error: draftLookupError,
    } = await getDraft(
      supabase,
      draftId
    );

    if (
      draftLookupError ||
      !draft
    ) {
      return NextResponse.json(
        {
          error:
            draftLookupError ||
            "AI draft not found.",
        },
        { status: 404 }
      );
    }

    /*
     * Already-converted drafts are still allowed to
     * synchronize their assessment questions. This is
     * important for courses converted before assessment
     * import was added.
     */
    if (
      draft.status === "converted" &&
      draft.converted_course_id
    ) {
      try {
        const assessment =
          await importAssessmentQuestions(
            supabase,
            draft.converted_course_id,
            draft.learning_pack
          );

        return NextResponse.json({
          success: true,
          already_converted: true,
          course_id:
            draft.converted_course_id,
          assessment,
          draft: {
            id: draft.id,
            title: draft.title,
            status: draft.status,
            converted_course_id:
              draft.converted_course_id,
            converted_at:
              draft.converted_at,
          },
          message:
            assessment.imported > 0
              ? assessment.message
              : "This AI draft has already been converted to an LMS course.",
        });
      } catch (assessmentError) {
        console.error(
          "Assessment synchronization failed:",
          assessmentError
        );

        return NextResponse.json(
          {
            error:
              assessmentError instanceof
              Error
                ? assessmentError.message
                : "The converted LMS course could not receive its AI assessment questions.",
            course_id:
              draft.converted_course_id,
          },
          { status: 500 }
        );
      }
    }

    if (
      draft.status !== "approved"
    ) {
      return NextResponse.json(
        {
          error:
            "Only approved AI drafts can be converted to an LMS course.",
        },
        { status: 409 }
      );
    }

    const {
      data: result,
      error:
        conversionError,
    } = await supabase.rpc(
      "convert_ai_draft_to_course",
      {
        p_draft_id: draftId,
        p_reviewer_id: user.id,
      }
    );

    if (conversionError) {
      console.error(
        "AI draft conversion failed:",
        conversionError
      );

      return NextResponse.json(
        {
          error:
            conversionError.message ||
            "The AI draft could not be converted to an LMS course.",
        },
        { status: 500 }
      );
    }

    if (
      !isConversionResult(
        result
      )
    ) {
      console.error(
        "AI draft conversion returned an unexpected result:",
        result
      );

      return NextResponse.json(
        {
          error:
            "The AI draft conversion completed with an invalid server response.",
        },
        { status: 500 }
      );
    }

    const courseId = asString(
      result.course_id
    );

    if (!courseId) {
      console.error(
        "AI draft conversion returned no course_id:",
        result
      );

      return NextResponse.json(
        {
          error:
            "The AI draft conversion did not return the created course ID.",
        },
        { status: 500 }
      );
    }

    /*
     * Import the AI-generated assessment immediately
     * after the LMS course is created.
     */
    let assessment;

    try {
      assessment =
        await importAssessmentQuestions(
          supabase,
          courseId,
          draft.learning_pack
        );
    } catch (assessmentError) {
      console.error(
        "AI assessment import failed:",
        assessmentError
      );

      return NextResponse.json(
        {
          error:
            assessmentError instanceof
            Error
              ? `The LMS course was created, but assessment import failed: ${assessmentError.message}`
              : "The LMS course was created, but assessment import failed.",
          course_id:
            courseId,
          result,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      already_converted:
        result.already_converted ===
        true,
      course_id:
        courseId,
      result,
      assessment,
      message:
        assessment.imported > 0
          ? `AI draft converted successfully. ${assessment.imported} assessment question${
              assessment.imported === 1
                ? ""
                : "s"
            } imported into the LMS course.`
          : "AI draft converted successfully. No AI assessment questions were included.",
    });
  } catch (error) {
    console.error(
      "AI draft conversion route error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while converting the AI draft.",
      },
      { status: 500 }
    );
  }
}