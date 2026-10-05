import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type SubmitBody = {
  id?: unknown;
};

type LearningPack = Record<string, unknown>;

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function redactSensitiveText(value: string): string {
  let result = value;

  result = result.replace(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    "[email address removed]",
  );

  result = result.replace(
    /(?:\+?234|0)(?:[\s.-]?\d){10}\b/g,
    "[phone number removed]",
  );

  result = result.replace(
    /\b(?:BVN|NIN)\s*[:#-]?\s*\d{8,12}\b/gi,
    (match) =>
      match.toLowerCase().startsWith("bvn")
        ? "BVN [identifier removed]"
        : "NIN [identifier removed]",
  );

  result = result.replace(
    /\b(?:account|acct)\s*(?:number|no\.?)?\s*[:#-]?\s*\d{8,20}\b/gi,
    "account number [identifier removed]",
  );

  result = result.replace(
    /\b(?:card|debit card|credit card)\s*(?:number|no\.?)?\s*[:#-]?\s*\d{12,19}\b/gi,
    "card number [identifier removed]",
  );

  result = result.replace(
    /\b(?:transaction|payment|transfer|reference|ref)\s*(?:id|number|no\.?)?\s*[:#-]?\s*[A-Z0-9-]{6,40}\b/gi,
    "transaction reference [identifier removed]",
  );

  result = result.replace(
    /\b(?:transaction|payment|transfer)\s+amount\s*[:#-]?\s*(?:₦|NGN)?\s?[\d,]+(?:\.\d{1,2})?\b/gi,
    "transaction amount [amount removed]",
  );

  result = result.replace(
    /\b(?:amount|balance|account\s+balance|payment\s+value)\s*[:#-]?\s*(?:₦|NGN)?\s?[\d,]+(?:\.\d{1,2})?\b/gi,
    (match) => {
      if (/balance/i.test(match)) {
        return "balance [amount removed]";
      }

      return "amount [amount removed]";
    },
  );

  result = result.replace(
    /(?:₦|NGN)\s?[\d,]+(?:\.\d{1,2})?/gi,
    "[amount removed]",
  );

  result = result.replace(
    /\bIBAN\s*[:#-]?\s*[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/gi,
    "IBAN [identifier removed]",
  );

  return result;
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    return redactSensitiveText(value);
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, childValue]) => [
        key,
        sanitizeValue(childValue),
      ]),
    );
  }

  return value;
}

function sanitizeLearningPack(
  learningPack: unknown,
): LearningPack | null {
  if (!isObject(learningPack)) {
    return null;
  }

  const sanitized = sanitizeValue(learningPack) as LearningPack;

  if ("extracted_text" in sanitized) {
    sanitized.extracted_text = "";
  }

  if ("source_text" in sanitized) {
    sanitized.source_text = "";
  }

  if ("raw_text" in sanitized) {
    sanitized.raw_text = "";
  }

  return sanitized;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    let body: SubmitBody;

    try {
      body = (await request.json()) as SubmitBody;
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    const id = asString(body.id);

    if (!id) {
      return NextResponse.json(
        { error: "Draft ID is required." },
        { status: 400 },
      );
    }

    const { data: draft, error: draftError } = await supabase
      .from("ai_learning_drafts")
      .select(
        `
          id,
          student_id,
          title,
          output_type,
          language_code,
          audience,
          focus_instruction,
          learning_pack,
          status,
          source_uploaded_at,
          created_at,
          updated_at
        `,
      )
      .eq("id", id)
      .eq("student_id", user.id)
      .maybeSingle();

    if (draftError) {
      console.error("AI draft submission fetch error:", draftError);

      return NextResponse.json(
        { error: "Unable to load the draft." },
        { status: 500 },
      );
    }

    if (!draft) {
      return NextResponse.json(
        { error: "Draft not found." },
        { status: 404 },
      );
    }

    if (draft.status === "submitted") {
      return NextResponse.json(
        {
          error:
            "This draft has already been submitted for LMS review.",
        },
        { status: 409 },
      );
    }

    if (draft.status === "approved") {
      return NextResponse.json(
        {
          error:
            "This draft has already been approved and cannot be resubmitted.",
        },
        { status: 409 },
      );
    }

    if (draft.status === "converted") {
      return NextResponse.json(
        {
          error:
            "This draft has already been converted and cannot be resubmitted.",
        },
        { status: 409 },
      );
    }

    if (
      draft.status !== "draft" &&
      draft.status !== "edited" &&
      draft.status !== "revision_required"
    ) {
      return NextResponse.json(
        {
          error:
            "This draft is not currently eligible for submission.",
          status: draft.status,
        },
        { status: 409 },
      );
    }

    const title = asString(draft.title);

    if (!title) {
      return NextResponse.json(
        { error: "A valid title is required before submission." },
        { status: 400 },
      );
    }

    const learningPack = sanitizeLearningPack(draft.learning_pack);

    if (!learningPack) {
      return NextResponse.json(
        {
          error:
            "A valid learning pack is required before submission.",
        },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();

    const { data: updatedDraft, error: updateError } = await supabase
      .from("ai_learning_drafts")
      .update({
        learning_pack: learningPack,
        status: "submitted",
        updated_at: now,
      })
      .eq("id", id)
      .eq("student_id", user.id)
      .in("status", ["draft", "edited", "revision_required"])
      .select(
        `
          id,
          title,
          output_type,
          language_code,
          audience,
          focus_instruction,
          status,
          source_uploaded_at,
          created_at,
          updated_at
        `,
      )
      .maybeSingle();

    if (updateError) {
      console.error("AI draft submission update error:", updateError);

      return NextResponse.json(
        { error: "Unable to submit the draft for review." },
        { status: 500 },
      );
    }

    if (!updatedDraft) {
      return NextResponse.json(
        {
          error:
            "The draft could not be submitted because its status changed. Refresh and try again.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Draft submitted for LMS review.",
      draft: updatedDraft,
    });
  } catch (error) {
    console.error("AI draft submission unexpected error:", error);

    return NextResponse.json(
      {
        error:
          "An unexpected error occurred while submitting the draft.",
      },
      { status: 500 },
    );
  }
}