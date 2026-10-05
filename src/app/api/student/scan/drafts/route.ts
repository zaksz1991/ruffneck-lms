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
  mode?: unknown;

  languageCode?: unknown;
  language?: unknown;

  audience?: unknown;

  focusInstruction?: unknown;
  focus?: unknown;

  learningPack?: unknown;
  pack?: unknown;
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

function normalizeOutputType(
  value: unknown
): OutputType | null {
  if (typeof value !== "string") {
    return null;
  }

  return OUTPUT_TYPES.includes(
    value as OutputType
  )
    ? (value as OutputType)
    : null;
}

function normalizeLanguageCode(
  value: unknown
): LanguageCode | null {
  if (typeof value !== "string") {
    return null;
  }

  return LANGUAGES.includes(
    value as LanguageCode
  )
    ? (value as LanguageCode)
    : null;
}

function normalizeAudience(
  value: unknown
): Audience | null {
  if (typeof value !== "string") {
    return null;
  }

  return AUDIENCES.includes(
    value as Audience
  )
    ? (value as Audience)
    : null;
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

    /*
     * Accept the current ScanAndLearn field names:
     *
     * outputType
     * languageCode
     * audience
     *
     * Also accept the generator's names as a safe
     * compatibility fallback:
     *
     * mode
     * language
     */
    const outputType =
      normalizeOutputType(
        body.outputType
      ) ||
      normalizeOutputType(
        body.mode
      ) ||
      "lesson";

    const languageCode =
      normalizeLanguageCode(
        body.languageCode
      ) ||
      normalizeLanguageCode(
        body.language
      ) ||
      "en";

    const audience =
      normalizeAudience(
        body.audience
      ) ||
      "general";

    const learningPack =
      normalizeLearningPack(
        body.learningPack
      ) ||
      normalizeLearningPack(
        body.pack
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

    /*
     * Prefer the explicit title, but safely fall back
     * to the generated learning-pack title.
     */
    const title =
      cleanText(
        body.title,
        300
      ) ||
      cleanText(
        learningPack.title,
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
      ) ||
      cleanText(
        body.focus,
        1500
      );

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
            outputType,

          language_code:
            languageCode,

          audience,

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