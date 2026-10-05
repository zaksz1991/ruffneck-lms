import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ReviewAction = "approve" | "revision_required";

type ReviewBody = {
  id?: unknown;
  action?: unknown;
  reviewNote?: unknown;
};

type Profile = {
  role: "admin" | "instructor" | "student";
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isReviewAction(value: unknown): value is ReviewAction {
  return value === "approve" || value === "revision_required";
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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle<Profile>();

    if (profileError) {
      console.error("Admin AI draft review profile error:", profileError);

      return NextResponse.json(
        { error: "Unable to verify reviewer permissions." },
        { status: 500 },
      );
    }

    if (
      !profile ||
      (profile.role !== "admin" && profile.role !== "instructor")
    ) {
      return NextResponse.json(
        { error: "You do not have permission to review AI drafts." },
        { status: 403 },
      );
    }

    let body: ReviewBody;

    try {
      body = (await request.json()) as ReviewBody;
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 },
      );
    }

    const id = asString(body.id);
    const action = body.action;
    const reviewNote = asString(body.reviewNote);

    if (!id) {
      return NextResponse.json(
        { error: "Draft ID is required." },
        { status: 400 },
      );
    }

    if (!isReviewAction(action)) {
      return NextResponse.json(
        {
          error:
            'Invalid review action. Use "approve" or "revision_required".',
        },
        { status: 400 },
      );
    }

    if (reviewNote.length > 5000) {
      return NextResponse.json(
        { error: "Review note cannot exceed 5,000 characters." },
        { status: 400 },
      );
    }

    const { data: draft, error: draftError } = await supabase
      .from("ai_learning_drafts")
      .select(
        `
          id,
          title,
          status,
          student_id,
          review_note,
          reviewed_by,
          reviewed_at,
          source_uploaded_at,
          created_at,
          updated_at
        `,
      )
      .eq("id", id)
      .maybeSingle();

    if (draftError) {
      console.error("Admin AI draft review fetch error:", draftError);

      return NextResponse.json(
        { error: "Unable to load the AI draft." },
        { status: 500 },
      );
    }

    if (!draft) {
      return NextResponse.json(
        { error: "AI draft not found." },
        { status: 404 },
      );
    }

    if (draft.status !== "submitted") {
      return NextResponse.json(
        {
          error:
            "Only drafts submitted for review can be approved or returned for revision.",
          status: draft.status,
        },
        { status: 409 },
      );
    }

    if (action === "revision_required" && !reviewNote) {
      return NextResponse.json(
        {
          error:
            "A review note is required when requesting a revision.",
        },
        { status: 400 },
      );
    }

    const nextStatus =
      action === "approve" ? "approved" : "revision_required";

    const now = new Date().toISOString();

    const { data: updatedDraft, error: updateError } = await supabase
      .from("ai_learning_drafts")
      .update({
        status: nextStatus,
        review_note: reviewNote || null,
        reviewed_by: user.id,
        reviewed_at: now,
        updated_at: now,
      })
      .eq("id", id)
      .eq("status", "submitted")
      .select(
        `
          id,
          title,
          output_type,
          language_code,
          audience,
          focus_instruction,
          learning_pack,
          status,
          source_uploaded_at,
          created_at,
          updated_at,
          review_note,
          reviewed_by,
          reviewed_at
        `,
      )
      .maybeSingle();

    if (updateError) {
      console.error("Admin AI draft review update error:", updateError);

      return NextResponse.json(
        { error: "Unable to update the AI draft review status." },
        { status: 500 },
      );
    }

    if (!updatedDraft) {
      return NextResponse.json(
        {
          error:
            "The draft was already reviewed or is no longer available for review.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      success: true,
      message:
        action === "approve"
          ? "AI draft approved."
          : "AI draft returned for revision.",
      draft: updatedDraft,
    });
  } catch (error) {
    console.error("Admin AI draft review unexpected error:", error);

    return NextResponse.json(
      { error: "An unexpected error occurred while reviewing the AI draft." },
      { status: 500 },
    );
  }
}