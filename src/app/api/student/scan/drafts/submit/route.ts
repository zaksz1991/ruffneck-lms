import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
 * Redacts common personal, banking and transaction identifiers
 * from ordinary text while preserving useful educational content.
 */
function redactSensitiveText(value: string): string {
  let result = value;

  // Email addresses.
  result = result.replace(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    REDACTED
  );

  // Nigerian mobile numbers:
  // 080..., 081..., 090..., 091..., +234..., 234...
  result = result.replace(
    /\b(?:\+234|234|0)(?:70|71|80|81|90|91)\d{8}\b/g,
    REDACTED
  );

  // BVN / NIN where explicitly labelled.
  result = result.replace(
    /\b(bvn|nin)\s*[:#-]?\s*\d{11}\b/gi,
    (_match, label: string) => `${label}: ${REDACTED}`
  );

  // Account numbers where explicitly labelled.
  result = result.replace(
    /\b((?:account|acct)(?:\s+(?:number|no\.?|name))?)\s*[:#-]\s*[A-Z0-9]{6,20}\b/gi,
    (_match, label: string) => `${label}: ${REDACTED}`
  );

  // Card numbers where explicitly labelled.
  result = result.replace(
    /\b((?:card)(?:\s+(?:number|no\.?))?)\s*[:#-]?\s*(?:\d[ -]?){13,19}\b/gi,
    (_match, label: string) => `${label}: ${REDACTED}`
  );

  // Transaction/payment/reference values where explicitly labelled.
  result = result.replace(
    /\b((?:(?:transaction|payment|transfer)\s+(?:id|reference|ref|number|no\.?)|reference(?:\s+(?:number|no\.?))?))\s*[:#-]\s*[A-Z0-9-]{8,}\b/gi,
    (_match, label: string) => `${label}: ${REDACTED}`
  );

  // Common labelled identifiers without requiring a separator.
  result = result.replace(
    /\b(transaction\s+reference|transaction\s+id|payment\s+reference|payment\s+id|reference\s+number)\s+(?:is\s+)?[A-Z0-9-]{8,}\b/gi,
    (match) => {
      const labelMatch = match.match(
        /^(transaction\s+reference|transaction\s+id|payment\s+reference|payment\s+id|reference\s+number)/i
      );

      return `${labelMatch?.[1] ?? "Reference"}: ${REDACTED}`;
    }
  );

  // IBAN values.
  result = result.replace(
    /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/gi,
    REDACTED
  );

  return result;
}

/**
 * Recursively sanitizes an object/array/string.
 *
 * Raw OCR/source text is replaced because it may contain identifiers
 * that are not necessary for reusable LMS learning material.
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

function sanitizeLearningPack(
  value: unknown
): Record<string, unknown> | null {
  if (!isObject(value)) return null;

  const sanitized = sanitizeValue(value);

  if (!isObject(sanitized)) return null;

  return sanitized;
}

export async function POST(request: Request) {
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
      {
        error:
          "This draft has already been submitted for review.",
      },
      { status: 409 }
    );
  }

  if (draft.status === "converted") {
    return NextResponse.json(
      {
        error:
          "This draft has already been converted.",
      },
      { status: 409 }
    );
  }

  const sanitizedLearningPack = sanitizeLearningPack(
    draft.learning_pack
  );

  if (!sanitizedLearningPack) {
    return NextResponse.json(
      {
        error:
          "The learning pack is invalid and cannot be submitted.",
      },
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
      learning_pack: sanitizedLearningPack,
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