import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const OUTPUT_TYPES = [
  "lesson",
  "study_guide",
  "lesson_plan",
  "revision_notes",
  "quiz",
  "flashcards",
] as const;

const LANGUAGES = [
  "en",
  "ha",
  "yo",
  "ig",
  "sw",
] as const;

const AUDIENCES = [
  "general",
  "office",
  "business",
  "education",
  "personal",
] as const;

type OutputType = (typeof OUTPUT_TYPES)[number];
type LanguageCode = (typeof LANGUAGES)[number];
type Audience = (typeof AUDIENCES)[number];

type SaveDraftBody = {
  title?: unknown;
  outputType?: unknown;
  languageCode?: unknown;
  audience?: unknown;
  focusInstruction?: unknown;
  learningPack?: unknown;
};

function isObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function cleanText(
  value: unknown,
  maxLength: number
) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function isOutputType(
  value: unknown
): value is OutputType {
  return (
    typeof value === "string" &&
    OUTPUT_TYPES.includes(
      value as OutputType
    )
  );
}

function isLanguageCode(
  value: unknown
): value is LanguageCode {
  return (
    typeof value === "string" &&
    LANGUAGES.includes(
      value as LanguageCode
    )
  );
}

function isAudience(
  value: unknown
): value is Audience {
  return (
    typeof value === "string" &&
    AUDIENCES.includes(
      value as Audience
    )
  );
}

function normalizeLearningPack(
  value: unknown
) {
  if (!isObject(value)) {
    return null;
  }

  const title = cleanText(
    value.title,
    300
  );

  if (!title) {
    return null;
  }

  return value;
}

export async function POST(
  request: Request
) {
  try {
    const supabase =
      await createClient();

    const {
      data: { user },
    } =
      await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error:
            "Authentication required.",
        },
        {
          status: 401,
        }
      );
    }

    let body: SaveDraftBody;

    try {
      body =
        (await request.json()) as SaveDraftBody;
    } catch {
      return NextResponse.json(
        {
          error:
            "Invalid request body.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !isOutputType(
        body.outputType
      )
    ) {
      return NextResponse.json(
        {
          error:
            "A valid output type is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !isLanguageCode(
        body.languageCode
      )
    ) {
      return NextResponse.json(
        {
          error:
            "A valid language is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !isAudience(
        body.audience
      )
    ) {
      return NextResponse.json(
        {
          error:
            "A valid audience is required.",
        },
        {
          status: 400,
        }
      );
    }

    const title =
      cleanText(
        body.title,
        300
      );

    if (!title) {
      return NextResponse.json(
        {
          error:
            "A draft title is required.",
        },
        {
          status: 400,
        }
      );
    }

    const focusInstruction =
      cleanText(
        body.focusInstruction,
        1500
      );

    const learningPack =
      normalizeLearningPack(
        body.learningPack
      );

    if (!learningPack) {
      return NextResponse.json(
        {
          error:
            "A valid learning pack is required.",
        },
        {
          status: 400,
        }
      );
    }

    const { data, error } =
      await supabase
        .from(
          "ai_learning_drafts"
        )
        .insert({
          student_id:
            user.id,

          title,

          output_type:
            body.outputType,

          language_code:
            body.languageCode,

          audience:
            body.audience,

          focus_instruction:
            focusInstruction ||
            null,

          learning_pack:
            learningPack,

          status:
            "draft",
        })
        .select(
          "id, title, output_type, language_code, audience, status, created_at, updated_at"
        )
        .single();

    if (error) {
      console.error(
        "AI learning draft insert failed:",
        error
      );

      return NextResponse.json(
        {
          error:
            "Unable to save the learning draft.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json(
      {
        success: true,

        draft: data,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Save AI draft error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Something went wrong while saving the learning draft.",
      },
      {
        status: 500,
      }
    );
  }
}