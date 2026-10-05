import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AiDraftEditor from "./AiDraftEditor";

type PageProps = {
  params: Promise<{
    draftId: string;
  }>;
};

type Draft = {
  id: string;
  title: string;
  output_type:
    | "lesson"
    | "study_guide"
    | "lesson_plan"
    | "revision_notes"
    | "quiz"
    | "flashcards";
  language_code: "en" | "ha" | "yo" | "ig" | "sw";
  audience: "general" | "office" | "business" | "education" | "personal";
  focus_instruction: string | null;
  learning_pack: Record<string, unknown>;
  status:
    | "draft"
    | "edited"
    | "submitted"
    | "revision_required"
    | "approved"
    | "converted";
  source_uploaded_at: string | null;
  created_at: string;
  updated_at: string;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

export default async function AiDraftPage({ params }: PageProps) {
  const { draftId } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/student/ai-drafts/${draftId}`);
  }

  const { data: draft, error } = await supabase
    .from("ai_learning_drafts")
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
    .eq("id", draftId)
    .eq("student_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("AI draft page fetch error:", error);
    notFound();
  }

  if (!draft) {
    notFound();
  }

  const typedDraft: Draft = {
    id: draft.id,
    title: draft.title,
    output_type: draft.output_type,
    language_code: draft.language_code,
    audience: draft.audience,
    focus_instruction: draft.focus_instruction,
    learning_pack:
      draft.learning_pack &&
      typeof draft.learning_pack === "object" &&
      !Array.isArray(draft.learning_pack)
        ? (draft.learning_pack as Record<string, unknown>)
        : {},
    status: draft.status,
    source_uploaded_at: draft.source_uploaded_at ?? null,
    created_at: draft.created_at,
    updated_at: draft.updated_at,
    review_note: draft.review_note ?? null,
    reviewed_by: draft.reviewed_by ?? null,
    reviewed_at: draft.reviewed_at ?? null,
  };

  return (
    <main className="container">
      <div className="rn-page-header">
        <div>
          <p className="rn-eyebrow">My AI Drafts</p>
          <h1>{typedDraft.title || "AI Learning Draft"}</h1>
          <p className="rn-page-description">
            Review, edit, and submit your AI-generated learning material.
          </p>
        </div>
      </div>

      <AiDraftEditor draft={typedDraft} />
    </main>
  );
}