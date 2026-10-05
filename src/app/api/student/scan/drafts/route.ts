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

const LANGUAGES = ["en", "ha", "yo", "ig", "sw"] as const;

const AUDIENCES = [
  "general",
  "office",
  "business",
  "education",
  "personal",
] as const;

const STATUSES = ["draft", "edited", "converted"] as const;

type OutputType = (typeof OUTPUT_TYPES)[number];
type LanguageCode = (typeof LANGUAGES)[number];
type Audience = (typeof AUDIENCES)[number];
type DraftStatus = (typeof STATUSES)[number];

type DraftBody = {
  id?: unknown;
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
  status?: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;

  const cleaned = value.trim();

  if (!cleaned) return null;

  return cleaned.slice(0, maxLength);
}

function normalizeOutputType(value: unknown): OutputType | null {
  if (
    typeof value === "string" &&
    OUTPUT_TYPES.includes(value as OutputType)
  ) {
    return value as OutputType;
  }

  return null;
}

function normalizeLanguageCode(value: unknown): LanguageCode | null {
  if (
    typeof value === "string" &&
    LANGUAGES.includes(value as LanguageCode)
  ) {
    return value as LanguageCode;
  }

  return null;
}

function normalizeAudience(value: unknown): Audience | null {
  if (
    typeof value === "string" &&
    AUDIENCES.includes(value as Audience)
  ) {
    return value as Audience;
  }

  return null;
}

function normalizeStatus(value: unknown): DraftStatus | null {
  if (
    typeof value === "string" &&
    STATUSES.includes(value as DraftStatus)
  ) {
    return value as DraftStatus;
  }

  return null;
}

function normalizeLearningPack(value: unknown): Record<string, unknown> | null {
  if (!isObject(value)) return null;

  const title = cleanText(value.title, 300);

  if (!title) return null;

  return value;
}

async function getAuthenticatedUser() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user };
}

/**
 * GET /api/student/scan/drafts
 *
 * Without ?id=...:
 *   Returns the authenticated student's drafts.
 *
 * With ?id=...:
 *   Returns one draft belonging to the authenticated student.
 */
export async function GET(request: Request) {
  const { supabase, user } = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (id) {
    const { data, error } = await supabase
      .from("ai_learning_drafts")
      .select(
        "id, title, output_type, language_code, audience, focus_instruction, learning_pack, status, created_at, updated_at"
      )
      .eq("id", id)
      .eq("student_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("AI draft fetch error:", error);

      return NextResponse.json(
        { error: "Unable to load the draft." },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Draft not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      draft: data,
    });
  }

  const { data, error } = await supabase
    .from("ai_learning_drafts")
    .select(
      "id, title, output_type, language_code, audience, focus_instruction, status, created_at, updated_at"
    )
    .eq("student_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("AI drafts list error:", error);

    return NextResponse.json(
      { error: "Unable to load your drafts." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    drafts: data ?? [],
  });
}

/**
 * POST /api/student/scan/drafts
 *
 * Creates a new draft.
 */
export async function POST(request: Request) {
  const { supabase, user } = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  let body: DraftBody;

  try {
    body = (await request.json()) as DraftBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body." },
      { status: 400 }
    );
  }

  const outputType =
    normalizeOutputType(body.outputType) ??
    normalizeOutputType(body.mode) ??
    "lesson";

  const languageCode =
    normalizeLanguageCode(body.languageCode) ??
    normalizeLanguageCode(body.language) ??
    "en";

  const audience = normalizeAudience(body.audience) ?? "general";

  const learningPack =
    normalizeLearningPack(body.learningPack) ??
    normalizeLearningPack(body.pack);

  if (!learningPack) {
    return NextResponse.json(
      { error: "A valid learning pack is required." },
      { status: 400 }
    );
  }

  const title =
    cleanText(body.title, 300) ??
    cleanText(learningPack.title, 300);

  if (!title) {
    return NextResponse.json(
      { error: "A draft title is required." },
      { status: 400 }
    );
  }

  const focusInstruction =
    cleanText(body.focusInstruction, 1500) ??
    cleanText(body.focus, 1500);

  const { data, error } = await supabase
    .from("ai_learning_drafts")
    .insert({
      student_id: user.id,
      title,
      output_type: outputType,
      language_code: languageCode,
      audience,
      focus_instruction: focusInstruction,
      learning_pack: learningPack,
      status: "draft",
    })
    .select(
      "id, title, output_type, language_code, audience, focus_instruction, learning_pack, status, created_at, updated_at"
    )
    .single();

  if (error) {
    console.error("AI draft creation error:", error);

    return NextResponse.json(
      { error: "Unable to save the draft." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      draft: data,
    },
    { status: 201 }
  );
}

/**
 * PATCH /api/student/scan/drafts
 *
 * Updates an existing draft.
 */
export async function PATCH(request: Request) {
  const { supabase, user } = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  let body: DraftBody;

  try {
    body = (await request.json()) as DraftBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body." },
      { status: 400 }
    );
  }

  const id = cleanText(body.id, 100);

  if (!id) {
    return NextResponse.json(
      { error: "Draft ID is required." },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {};

  if (body.title !== undefined) {
    const title = cleanText(body.title, 300);

    if (!title) {
      return NextResponse.json(
        { error: "Draft title cannot be empty." },
        { status: 400 }
      );
    }

    updates.title = title;
  }

  if (
    body.outputType !== undefined ||
    body.mode !== undefined
  ) {
    const outputType =
      normalizeOutputType(body.outputType) ??
      normalizeOutputType(body.mode);

    if (!outputType) {
      return NextResponse.json(
        { error: "Invalid output type." },
        { status: 400 }
      );
    }

    updates.output_type = outputType;
  }

  if (
    body.languageCode !== undefined ||
    body.language !== undefined
  ) {
    const languageCode =
      normalizeLanguageCode(body.languageCode) ??
      normalizeLanguageCode(body.language);

    if (!languageCode) {
      return NextResponse.json(
        { error: "Invalid language." },
        { status: 400 }
      );
    }

    updates.language_code = languageCode;
  }

  if (body.audience !== undefined) {
    const audience = normalizeAudience(body.audience);

    if (!audience) {
      return NextResponse.json(
        { error: "Invalid audience." },
        { status: 400 }
      );
    }

    updates.audience = audience;
  }

  if (
    body.focusInstruction !== undefined ||
    body.focus !== undefined
  ) {
    updates.focus_instruction =
      cleanText(body.focusInstruction, 1500) ??
      cleanText(body.focus, 1500);
  }

  if (
    body.learningPack !== undefined ||
    body.pack !== undefined
  ) {
    const learningPack =
      normalizeLearningPack(body.learningPack) ??
      normalizeLearningPack(body.pack);

    if (!learningPack) {
      return NextResponse.json(
        { error: "Invalid learning pack." },
        { status: 400 }
      );
    }

    updates.learning_pack = learningPack;
  }

  if (body.status !== undefined) {
    const status = normalizeStatus(body.status);

    if (!status) {
      return NextResponse.json(
        { error: "Invalid draft status." },
        { status: 400 }
      );
    }

    updates.status = status;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No changes were provided." },
      { status: 400 }
    );
  }

  if (updates.status === undefined) {
    updates.status = "edited";
  }

  const { data, error } = await supabase
    .from("ai_learning_drafts")
    .update(updates)
    .eq("id", id)
    .eq("student_id", user.id)
    .select(
      "id, title, output_type, language_code, audience, focus_instruction, learning_pack, status, created_at, updated_at"
    )
    .maybeSingle();

  if (error) {
    console.error("AI draft update error:", error);

    return NextResponse.json(
      { error: "Unable to update the draft." },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Draft not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    draft: data,
  });
}

/**
 * DELETE /api/student/scan/drafts?id=...
 */
export async function DELETE(request: Request) {
  const { supabase, user } = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Draft ID is required." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("ai_learning_drafts")
    .delete()
    .eq("id", id)
    .eq("student_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("AI draft deletion error:", error);

    return NextResponse.json(
      { error: "Unable to delete the draft." },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Draft not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    deletedId: data.id,
  });
}