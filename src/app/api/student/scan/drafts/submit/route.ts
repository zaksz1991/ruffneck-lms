import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;

  const cleaned = value.trim();

  if (!cleaned) return null;

  return cleaned.slice(0, maxLength);
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
    body = await request.json();
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

  if (!isObject(draft.learning_pack)) {
    return NextResponse.json(
      {
        error:
          "The learning pack is invalid and cannot be submitted.",
      },
      { status: 400 }
    );
  }

  const title = cleanText(draft.title, 300);

  if (!title) {
    return NextResponse.json(
      { error: "A valid draft title is required." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("ai_learning_drafts")
    .update({
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