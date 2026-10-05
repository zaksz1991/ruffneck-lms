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

const STATUSES = [
  "draft",
  "edited",
  "submitted",
  "converted",
] as const;

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

const REDACTED = "[REDACTED]";

const SENSITIVE_FIELD_NAMES = new Set([
  "account",
  "account_number",
  "account_no",
  "account_name",
  "acct",
  "acct_number",
  "acct_no",
  "acct_name",
  "bvn",
  "nin",
  "iban",
  "card_number",
  "card_no",
  "transaction_id",
  "transaction_reference",
  "transaction_ref",
  "transaction_number",
  "transaction_no",
  "payment_id",
  "payment_reference",
  "payment_ref",
  "payment_number",
  "payment_no",
  "reference_number",
  "reference_no",
  "beneficiary_account",
  "beneficiary_name",
  "sender_account",
  "sender_name",
  "recipient_account",
  "recipient_name",
  "phone",
  "phone_number",
  "mobile",
  "mobile_number",
  "email",
  "email_address",
]);

const RAW_SOURCE_FIELD_NAMES = new Set([
  "extracted_text",
  "raw_text",
  "ocr_text",
  "source_text",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;

  const cleaned = value.trim();

  if (!cleaned) return null;

  return cleaned.slice(0, maxLength);
}

function normalizeFieldName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

/**
 * Removes common personal and financial identifiers from free text.
 *
 * The redactor deliberately does not remove ordinary dates, amounts,
 * lesson terminology, or general educational content.
 */
function redactSensitiveText(value: string): string {
  let result = value;

  // Email addresses.
  result = result.replace(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    REDACTED
  );

  // Nigerian mobile numbers in local and international format.
  result = result.replace(
    /\b(?:\+234|234|0)(?:70|71|80|81|90|91)\d{8}\b/g,
    REDACTED
  );

  // BVN and NIN when their labels are present.
  result = result.replace(
    /\b(?:bvn|nin)\s*[:#-]?\s*\d{11}\b/gi,
    (match) => {
      const label = match.match(/^(bvn|nin)/i)?.[1] ?? "ID";
      return `${label}: ${REDACTED}`;
    }
  );

  // Bank account numbers when a bank-account label is present.
  result = result.replace(
    /\b(?:account|acct)(?:\s+(?:number|no\.?|name))?\s*[:#-]\s*[A-Z0-9]{6,20}\b/gi,
    (match) => {
      const label = match.split(/[:#-]/)[0].trim();
      return `${label}: ${REDACTED}`;
    }
  );

  // Card numbers when a card label is present.
  result = result.replace(
    /\b(?:card)(?:\s+(?:number|no\.?))?\s*[:#-]?\s*(?:\d[ -]?){13,19}\b/gi,
    (match) => {
      const labelMatch = match.match(/^card(?:\s+(?:number|no\.?))?/i);
      const label = labelMatch?.[0] ?? "Card";
      return `${label}: ${REDACTED}`;
    }
  );

  // Transaction/payment/reference identifiers when explicitly labelled.
  result = result.replace(
    /\b(?:(?:transaction|payment|transfer)(?:\s+(?:id|reference|ref|number|no\.?))?|reference(?:\s+(?:number|no\.?))?)\s*[:#-]\s*[A-Z0-9-]{8,}\b/gi,
    (match) => {
      const separatorIndex = Math.max(
        match.lastIndexOf(":"),
        match.lastIndexOf("#"),
        match.lastIndexOf("-")
      );

      if (separatorIndex === -1) {
        return REDACTED;
      }

      return `${match.slice(0, separatorIndex).trim()}: ${REDACTED}`;
    }
  );

  // IBAN-style values.
  result = result.replace(
    /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/gi,
    REDACTED
  );

  return result;
}

/**
 * Recursively redacts sensitive values inside the learning pack.
 *
 * Raw OCR/source text is not retained after generation because it can
 * contain identifiers that are not needed for the reusable LMS material.
 */
function sanitizeValue(
  value: unknown,
  fieldName = ""
): unknown {
  if (typeof value === "string") {
    const normalizedFieldName = normalizeFieldName(fieldName);

    if (RAW_SOURCE_FIELD_NAMES.has(normalizedFieldName)) {
      return "[Source text omitted after generation for privacy.]";
    }

    if (SENSITIVE_FIELD_NAMES.has(normalizedFieldName)) {
      return REDACTED;
    }

    return redactSensitiveText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, fieldName));
  }

  if (isObject(value)) {
    const result: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value)) {
      result[key] = sanitizeValue(item, key);
    }

    return result;
  }

  return value;
}

function normalizeLearningPack(
  value: unknown
): Record<string, unknown> | null {
  if (!isObject(value)) return null;

  const sanitized = sanitizeValue(value);

  if (!isObject(sanitized)) return null;

  const title = cleanText(sanitized.title, 300);

  if (!title) return null;

  sanitized.title = title;

  return sanitized;
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
 * Without ?id=...
 * Returns the authenticated student's drafts.
 *
 * With ?id=...
 * Returns one draft belonging to the authenticated student.
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
      draft: {
        ...data,
        learning_pack:
          normalizeLearningPack(data.learning_pack) ??
          data.learning_pack,
      },
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
 *
 * Privacy protection:
 * learning_pack is sanitized before it reaches Supabase.
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
    body.focusInstruction !== undefined
      ? cleanText(
          redactSensitiveText(
            typeof body.focusInstruction === "string"
              ? body.focusInstruction
              : ""
          ),
          1500
        )
      : body.focus !== undefined
        ? cleanText(
            redactSensitiveText(
              typeof body.focus === "string" ? body.focus : ""
            ),
            1500
          )
        : null;

  const { data, error } = await supabase
    .from("ai_learning_drafts")
    .insert({
      student_id: user.id,
      title: redactSensitiveText(title),
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
 * Updates an existing editable draft.
 *
 * Privacy protection:
 * The supplied learning pack is sanitized.
 * When no learning pack is supplied, the existing one is sanitized again.
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

  const { data: existingDraft, error: existingError } =
    await supabase
      .from("ai_learning_drafts")
      .select("id, status, learning_pack")
      .eq("id", id)
      .eq("student_id", user.id)
      .maybeSingle();

  if (existingError) {
    console.error("AI draft lookup error:", existingError);

    return NextResponse.json(
      { error: "Unable to verify the draft." },
      { status: 500 }
    );
  }

  if (!existingDraft) {
    return NextResponse.json(
      { error: "Draft not found." },
      { status: 404 }
    );
  }

  if (existingDraft.status === "submitted") {
    return NextResponse.json(
      {
        error:
          "This draft has already been submitted for LMS review and can no longer be edited.",
      },
      { status: 409 }
    );
  }

  if (existingDraft.status === "converted") {
    return NextResponse.json(
      {
        error:
          "This draft has already been converted and can no longer be edited.",
      },
      { status: 409 }
    );
  }

  const updates: Record<string, unknown> = {};

  if (body.title !== undefined) {
    const title = cleanText(
      redactSensitiveText(
        typeof body.title === "string" ? body.title : ""
      ),
      300
    );

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
    const rawFocus =
      body.focusInstruction !== undefined
        ? body.focusInstruction
        : body.focus;

    const sanitizedFocus =
      typeof rawFocus === "string"
        ? redactSensitiveText(rawFocus)
        : "";

    updates.focus_instruction = cleanText(
      sanitizedFocus,
      1500
    );
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
  } else {
    const existingLearningPack = normalizeLearningPack(
      existingDraft.learning_pack
    );

    if (existingLearningPack) {
      updates.learning_pack = existingLearningPack;
    }
  }

  if (body.status !== undefined) {
    const status = normalizeStatus(body.status);

    if (!status) {
      return NextResponse.json(
        { error: "Invalid draft status." },
        { status: 400 }
      );
    }

    if (status === "submitted") {
      return NextResponse.json(
        {
          error:
            "Use the submission action to submit a draft for LMS review.",
        },
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
 * PUT /api/student/scan/drafts
 *
 * Legacy/backwards-compatible submission handler.
 *
 * The learning pack is sanitized again immediately before submission.
 *
 * The dedicated /submit route remains the preferred submission endpoint.
 */
export async function PUT(request: Request) {
  const { supabase, user } = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  let body: { id?: unknown };

  try {
    body = (await request.json()) as { id?: unknown };
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

  const { data: draft, error: draftError } = await supabase
    .from("ai_learning_drafts")
    .select(
      "id, title, status, learning_pack, output_type, language_code, audience"
    )
    .eq("id", id)
    .eq("student_id", user.id)
    .maybeSingle();

  if (draftError) {
    console.error("AI draft submission lookup error:", draftError);

    return NextResponse.json(
      { error: "Unable to verify the draft." },
      { status: 500 }
    );
  }

  if (!draft) {
    return NextResponse.json(
      { error: "Draft not found." },
      { status: 404 }
    );
  }

  if (draft.status === "submitted") {
    return NextResponse.json(
      { error: "This draft has already been submitted for review." },
      { status: 409 }
    );
  }

  if (draft.status === "converted") {
    return NextResponse.json(
      { error: "This draft has already been converted." },
      { status: 409 }
    );
  }

  const learningPack = normalizeLearningPack(
    draft.learning_pack
  );

  if (!learningPack) {
    return NextResponse.json(
      { error: "The learning pack is invalid." },
      { status: 400 }
    );
  }

  const title = cleanText(
    redactSensitiveText(draft.title),
    300
  );

  if (!title) {
    return NextResponse.json(
      { error: "A valid draft title is required." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("ai_learning_drafts")
    .update({
      title,
      learning_pack: learningPack,
      status: "submitted",
    })
    .eq("id", id)
    .eq("student_id", user.id)
    .select(
      "id, title, output_type, language_code, audience, status, updated_at"
    )
    .single();

  if (error) {
    console.error("AI draft submission error:", error);

    return NextResponse.json(
      { error: "Unable to submit the draft for review." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Draft submitted for LMS review.",
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

  const { data: existingDraft, error: existingError } =
    await supabase
      .from("ai_learning_drafts")
      .select("id, status")
      .eq("id", id)
      .eq("student_id", user.id)
      .maybeSingle();

  if (existingError) {
    console.error("AI draft deletion lookup error:", existingError);

    return NextResponse.json(
      { error: "Unable to verify the draft." },
      { status: 500 }
    );
  }

  if (!existingDraft) {
    return NextResponse.json(
      { error: "Draft not found." },
      { status: 404 }
    );
  }

  if (existingDraft.status === "submitted") {
    return NextResponse.json(
      {
        error:
          "This draft has already been submitted for LMS review and cannot be deleted.",
      },
      { status: 409 }
    );
  }

  if (existingDraft.status === "converted") {
    return NextResponse.json(
      {
        error:
          "This draft has already been converted and cannot be deleted.",
      },
      { status: 409 }
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