import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Draft = {
  id: string;
  title: string;
  output_type: string;
  language_code: string;
  audience: string;
  focus_instruction: string | null;
  status: "draft" | "edited" | "converted";
  created_at: string;
  updated_at: string;
};

const OUTPUT_LABELS: Record<string, string> = {
  lesson: "Lesson",
  study_guide: "Study Guide",
  lesson_plan: "Lesson Plan",
  revision_notes: "Revision Notes",
  quiz: "Quiz",
  flashcards: "Flashcards",
};

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  ha: "Hausa",
  yo: "Yoruba",
  ig: "Igbo",
  sw: "Swahili",
};

const AUDIENCE_LABELS: Record<string, string> = {
  general: "General",
  office: "Office",
  business: "Business",
  education: "Education",
  personal: "Personal",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  edited: "Edited",
  converted: "Converted",
};

export default async function StudentAiDraftsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/student/ai-drafts");
  }

  const { data: drafts, error } = await supabase
    .from("ai_learning_drafts")
    .select(
      "id, title, output_type, language_code, audience, focus_instruction, status, created_at, updated_at"
    )
    .eq("student_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("AI drafts page error:", error);
  }

  const draftRows = (drafts ?? []) as Draft[];

  return (
    <main className="container rn-dashboard-shell">
      <section className="rn-page-header">
        <div>
          <p className="rn-eyebrow">AI Learning Workspace</p>
          <h1>My AI Drafts</h1>
          <p>
            Review and manage learning materials generated from your
            scanned notes, documents, and study materials.
          </p>
        </div>

        <div className="rn-page-header-actions">
          <Link href="/student/scan" className="btn btn-primary">
            Scan & Learn
          </Link>
        </div>
      </section>

      {draftRows.length === 0 ? (
        <section className="rn-card">
          <h2>No AI drafts yet</h2>
          <p>
            Use Scan & Learn to capture notes or documents and turn them
            into lessons, study guides, revision notes, quizzes, or
            flashcards.
          </p>

          <Link href="/student/scan" className="btn btn-primary">
            Create your first AI draft
          </Link>
        </section>
      ) : (
        <section className="rn-card">
          <div className="rn-section-heading">
            <div>
              <h2>Your drafts</h2>
              <p>
                {draftRows.length} saved{" "}
                {draftRows.length === 1 ? "draft" : "drafts"}.
              </p>
            </div>
          </div>

          <div className="rn-course-grid">
            {draftRows.map((draft) => (
              <article key={draft.id} className="rn-course-card">
                <div className="rn-course-card-body">
                  <div className="rn-course-card-meta">
                    <span className="rn-badge">
                      {OUTPUT_LABELS[draft.output_type] ??
                        draft.output_type}
                    </span>

                    <span className="rn-badge">
                      {LANGUAGE_LABELS[draft.language_code] ??
                        draft.language_code}
                    </span>

                    <span className="rn-badge">
                      {STATUS_LABELS[draft.status] ?? draft.status}
                    </span>
                  </div>

                  <h3>{draft.title}</h3>

                  <p>
                    Audience:{" "}
                    {AUDIENCE_LABELS[draft.audience] ??
                      draft.audience}
                  </p>

                  {draft.focus_instruction && (
                    <p>
                      <strong>Focus:</strong>{" "}
                      {draft.focus_instruction}
                    </p>
                  )}

                  <p className="rn-muted">
                    Updated{" "}
                    {new Date(draft.updated_at).toLocaleDateString(
                      "en-NG",
                      {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      }
                    )}
                  </p>

                  <div className="rn-course-card-actions">
                    <Link
                      href={`/student/ai-drafts/${draft.id}`}
                      className="btn btn-primary"
                    >
                      Open draft
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}