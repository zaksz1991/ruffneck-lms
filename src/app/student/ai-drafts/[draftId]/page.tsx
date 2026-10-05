import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AiDraftEditor from "./AiDraftEditor";

type PageProps = {
  params: Promise<{
    draftId: string;
  }>;
};

export default async function StudentAiDraftPage({
  params,
}: PageProps) {
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
      "id, title, output_type, language_code, audience, focus_instruction, learning_pack, status, created_at, updated_at"
    )
    .eq("id", draftId)
    .eq("student_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("AI draft detail error:", error);
  }

  if (!draft) {
    notFound();
  }

  return (
    <main className="container rn-dashboard-shell">
      <div className="rn-page-header">
        <div>
          <Link href="/student/ai-drafts" className="rn-back-link">
            ← My AI Drafts
          </Link>

          <p className="rn-eyebrow">AI Learning Workspace</p>

          <h1>{draft.title}</h1>

          <p>
            Review, edit, and prepare this AI-generated learning
            material for future LMS conversion.
          </p>
        </div>
      </div>

      <AiDraftEditor draft={draft} />
    </main>
  );
}