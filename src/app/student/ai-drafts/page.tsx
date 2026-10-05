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
  status:
    | "draft"
    | "edited"
    | "submitted"
    | "converted";
  source_uploaded_at: string | null;
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
  submitted: "Submitted for review",
  converted: "Converted",
};

function formatDateTime(
  value: string | null | undefined
) {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Africa/Lagos",
    }
  ).format(date);
}

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
      "id, title, output_type, language_code, audience, focus_instruction, status, source_uploaded_at, created_at, updated_at"
    )
    .eq("student_id", user.id)
    .order("updated_at", {
      ascending: false,
    });

  if (error) {
    console.error(
      "AI drafts page error:",
      error
    );
  }

  const draftRows =
    (drafts ?? []) as Draft[];

  return (
    <main className="container rn-dashboard-shell">
      <section className="rn-page-header">
        <div>
          <p className="rn-eyebrow">
            AI Learning Workspace
          </p>

          <h1>
            My AI Drafts
          </h1>

          <p>
            Review and manage learning materials
            generated from your scanned notes,
            documents, and study materials.
          </p>
        </div>

        <div className="rn-page-header-actions">
          <Link
            href="/student/scan"
            className="btn btn-primary"
          >
            Scan & Learn
          </Link>
        </div>
      </section>

      {draftRows.length === 0 ? (
        <section className="rn-card">
          <h2>
            No AI drafts yet
          </h2>

          <p>
            Use Scan & Learn to capture notes or
            documents and turn them into lessons,
            study guides, revision notes, quizzes,
            or flashcards.
          </p>

          <Link
            href="/student/scan"
            className="btn btn-primary"
          >
            Create your first AI draft
          </Link>
        </section>
      ) : (
        <section className="rn-card">
          <div className="rn-section-heading">
            <div>
              <h2>
                Your drafts
              </h2>

              <p>
                {draftRows.length} saved{" "}
                {draftRows.length === 1
                  ? "draft"
                  : "drafts"}
                .
              </p>
            </div>
          </div>

          <div className="rn-course-grid">
            {draftRows.map(
              (draft) => (
                <article
                  key={draft.id}
                  className="rn-course-card"
                >
                  <div className="rn-course-card-body">
                    <div className="rn-course-card-meta">
                      <span className="rn-badge">
                        {
                          OUTPUT_LABELS[
                            draft.output_type
                          ] ??
                            draft.output_type
                        }
                      </span>

                      <span className="rn-badge">
                        {
                          LANGUAGE_LABELS[
                            draft.language_code
                          ] ??
                            draft.language_code
                        }
                      </span>

                      <span className="rn-badge">
                        {
                          STATUS_LABELS[
                            draft.status
                          ] ??
                            draft.status
                        }
                      </span>
                    </div>

                    <h3>
                      {draft.title}
                    </h3>

                    <p>
                      Audience:{" "}
                      {
                        AUDIENCE_LABELS[
                          draft.audience
                        ] ??
                          draft.audience
                      }
                    </p>

                    {draft.focus_instruction ? (
                      <p>
                        <strong>
                          Focus:
                        </strong>{" "}
                        {
                          draft.focus_instruction
                        }
                      </p>
                    ) : null}

                    <div className="rn-ai-draft-timestamps">
                      <div>
                        <span>
                          Source uploaded
                        </span>

                        <strong>
                          {formatDateTime(
                            draft.source_uploaded_at ??
                              draft.created_at
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Draft created
                        </span>

                        <strong>
                          {formatDateTime(
                            draft.created_at
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Last updated
                        </span>

                        <strong>
                          {formatDateTime(
                            draft.updated_at
                          )}
                        </strong>
                      </div>
                    </div>

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
              )
            )}
          </div>
        </section>
      )}
    </main>
  );
}