import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type DraftStatus =
  | "draft"
  | "edited"
  | "submitted"
  | "revision_required"
  | "approved"
  | "converted";

type Draft = {
  id: string;
  title: string;
  output_type: string;
  language_code: string;
  audience: string;
  focus_instruction: string | null;
  status: DraftStatus;
  source_uploaded_at: string | null;
  created_at: string;
  updated_at: string;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
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

const STATUS_LABELS: Record<DraftStatus, string> = {
  draft: "Draft",
  edited: "Edited",
  submitted: "Submitted for review",
  revision_required: "Revision required",
  approved: "Approved",
  converted: "Converted",
};

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(date);
}

function getStatusClass(status: DraftStatus): string {
  switch (status) {
    case "submitted":
      return "rn-badge rn-badge-warning";
    case "revision_required":
      return "rn-badge rn-badge-danger";
    case "approved":
      return "rn-badge rn-badge-success";
    case "converted":
      return "rn-badge rn-badge-success";
    default:
      return "rn-badge";
  }
}

export default async function AdminAiDraftsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/ai-drafts");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    (profile.role !== "admin" && profile.role !== "instructor")
  ) {
    redirect("/student/dashboard");
  }

  const { data: drafts, error: draftsError } = await supabase
    .from("ai_learning_drafts")
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
        updated_at,
        review_note,
        reviewed_by,
        reviewed_at
      `,
    )
    .in("status", [
      "submitted",
      "revision_required",
      "approved",
      "converted",
    ])
    .order("updated_at", { ascending: false });

  if (draftsError) {
    console.error("Admin AI drafts queue error:", draftsError);
  }

  const reviewQueue = (drafts ?? []) as Draft[];

  const submittedCount = reviewQueue.filter(
    (draft) => draft.status === "submitted",
  ).length;

  const revisionCount = reviewQueue.filter(
    (draft) => draft.status === "revision_required",
  ).length;

  const approvedCount = reviewQueue.filter(
    (draft) => draft.status === "approved",
  ).length;

  return (
    <main className="page">
      <div className="container">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Admin LMS</p>
            <h1>AI Draft Review</h1>
            <p className="muted">
              Review AI-generated learning material submitted by students
              before it enters the LMS conversion workflow.
            </p>
          </div>

          <div className="rn-button-row">
            <Link href="/admin/lms" className="rn-button rn-button-secondary">
              Back to Admin LMS
            </Link>

            <Link
              href="/student/ai-drafts"
              className="rn-button rn-button-secondary"
            >
              Student Drafts
            </Link>
          </div>
        </div>

        <section className="rn-grid rn-grid-3">
          <div className="rn-card">
            <p className="eyebrow">Awaiting review</p>
            <strong>{submittedCount}</strong>
            <p className="muted">Submitted drafts</p>
          </div>

          <div className="rn-card">
            <p className="eyebrow">Revision</p>
            <strong>{revisionCount}</strong>
            <p className="muted">Returned for revision</p>
          </div>

          <div className="rn-card">
            <p className="eyebrow">Approved</p>
            <strong>{approvedCount}</strong>
            <p className="muted">Ready for conversion</p>
          </div>
        </section>

        <section className="rn-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Review queue</p>
              <h2>AI-generated learning drafts</h2>
            </div>
          </div>

          {draftsError ? (
            <div className="rn-alert rn-alert-error">
              Unable to load the AI draft review queue.
            </div>
          ) : reviewQueue.length === 0 ? (
            <div className="rn-empty-state">
              <h3>No AI drafts in the review workflow</h3>
              <p className="muted">
                Submitted student learning material will appear here when it
                is ready for review.
              </p>
            </div>
          ) : (
            <div className="rn-stack">
              {reviewQueue.map((draft) => (
                <article
                  key={draft.id}
                  className="rn-card rn-card-compact"
                >
                  <div className="rn-card-header">
                    <div>
                      <div className="rn-badge-row">
                        <span className={getStatusClass(draft.status)}>
                          {STATUS_LABELS[draft.status]}
                        </span>

                        <span className="rn-badge">
                          {OUTPUT_LABELS[draft.output_type] ??
                            draft.output_type}
                        </span>

                        <span className="rn-badge">
                          {LANGUAGE_LABELS[draft.language_code] ??
                            draft.language_code}
                        </span>
                      </div>

                      <h3>{draft.title}</h3>
                    </div>

                    <Link
                      href={`/admin/ai-drafts/${draft.id}`}
                      className="rn-button rn-button-primary"
                    >
                      Review
                    </Link>
                  </div>

                  <div className="rn-meta-grid">
                    <div>
                      <span className="muted">Audience</span>
                      <strong>
                        {AUDIENCE_LABELS[draft.audience] ??
                          draft.audience}
                      </strong>
                    </div>

                    <div>
                      <span className="muted">Source uploaded</span>
                      <strong>
                        {formatDateTime(
                          draft.source_uploaded_at ?? draft.created_at,
                        )}
                      </strong>
                    </div>

                    <div>
                      <span className="muted">Draft created</span>
                      <strong>{formatDateTime(draft.created_at)}</strong>
                    </div>

                    <div>
                      <span className="muted">Last updated</span>
                      <strong>{formatDateTime(draft.updated_at)}</strong>
                    </div>

                    {draft.reviewed_at ? (
                      <div>
                        <span className="muted">Reviewed</span>
                        <strong>{formatDateTime(draft.reviewed_at)}</strong>
                      </div>
                    ) : null}
                  </div>

                  {draft.focus_instruction ? (
                    <div className="rn-card-note">
                      <span className="muted">Additional instruction</span>
                      <p>{draft.focus_instruction}</p>
                    </div>
                  ) : null}

                  {draft.review_note ? (
                    <div className="rn-card-note">
                      <span className="muted">Review note</span>
                      <p>{draft.review_note}</p>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}