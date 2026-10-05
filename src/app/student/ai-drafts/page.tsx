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

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(date);
}

function getStatusClass(status: DraftStatus) {
  switch (status) {
    case "revision_required":
      return "rn-badge rn-ai-draft-status-revision";
    case "approved":
      return "rn-badge rn-ai-draft-status-approved";
    case "submitted":
      return "rn-badge rn-ai-draft-status-submitted";
    case "converted":
      return "rn-badge rn-ai-draft-status-converted";
    case "edited":
      return "rn-badge rn-ai-draft-status-edited";
    default:
      return "rn-badge";
  }
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
    .eq("student_id", user.id)
    .order("updated_at", {
      ascending: false,
    });

  if (error) {
    console.error("AI drafts page error:", error);
  }

  const draftRows = (drafts ?? []) as Draft[];

  const revisionCount = draftRows.filter(
    (draft) => draft.status === "revision_required",
  ).length;

  const submittedCount = draftRows.filter(
    (draft) => draft.status === "submitted",
  ).length;

  const approvedCount = draftRows.filter(
    (draft) => draft.status === "approved",
  ).length;

  const convertedCount = draftRows.filter(
    (draft) => draft.status === "converted",
  ).length;

  return (
    <main className="container rn-dashboard-shell">
      <section className="rn-page-header">
        <div>
          <p className="rn-eyebrow">AI Learning Workspace</p>

          <h1>My AI Drafts</h1>

          <p>
            Review and manage learning materials generated from your scanned
            notes, documents, and study materials.
          </p>
        </div>

        <div className="rn-page-header-actions">
          <Link href="/student/scan" className="btn btn-primary">
            Scan &amp; Learn
          </Link>
        </div>
      </section>

      {draftRows.length === 0 ? (
        <section className="rn-card">
          <h2>No AI drafts yet</h2>

          <p>
            Use Scan &amp; Learn to capture notes or documents and turn them
            into lessons, study guides, revision notes, quizzes, or
            flashcards.
          </p>

          <Link href="/student/scan" className="btn btn-primary">
            Create your first AI draft
          </Link>
        </section>
      ) : (
        <>
          <section className="rn-card">
            <div className="rn-section-heading">
              <div>
                <h2>Your AI learning workspace</h2>

                <p>
                  {draftRows.length} saved{" "}
                  {draftRows.length === 1 ? "draft" : "drafts"}.
                </p>
              </div>
            </div>

            <div className="rn-dashboard-stats">
              <div className="rn-dashboard-stat">
                <strong>{draftRows.length}</strong>
                <span>Total drafts</span>
              </div>

              <div className="rn-dashboard-stat">
                <strong>{submittedCount}</strong>
                <span>Under review</span>
              </div>

              <div className="rn-dashboard-stat">
                <strong>{revisionCount}</strong>
                <span>Revision required</span>
              </div>

              <div className="rn-dashboard-stat">
                <strong>{approvedCount}</strong>
                <span>Approved</span>
              </div>

              <div className="rn-dashboard-stat">
                <strong>{convertedCount}</strong>
                <span>Converted</span>
              </div>
            </div>
          </section>

          {revisionCount > 0 ? (
            <section className="rn-card">
              <h2>Revision required</h2>

              <p>
                {revisionCount === 1
                  ? "One of your AI drafts has been returned by an LMS reviewer."
                  : `${revisionCount} of your AI drafts have been returned by LMS reviewers.`}{" "}
                Open the affected draft, review the feedback, make the
                requested changes, and resubmit it.
              </p>
            </section>
          ) : null}

          <section className="rn-card">
            <div className="rn-section-heading">
              <div>
                <h2>Your drafts</h2>

                <p>
                  Open a draft to review its learning material and manage its
                  submission status.
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

                      <span className={getStatusClass(draft.status)}>
                        {STATUS_LABELS[draft.status] ?? draft.status}
                      </span>
                    </div>

                    <h3>{draft.title}</h3>

                    <p>
                      Audience:{" "}
                      {AUDIENCE_LABELS[draft.audience] ?? draft.audience}
                    </p>

                    {draft.focus_instruction ? (
                      <p>
                        <strong>Focus:</strong>{" "}
                        {draft.focus_instruction}
                      </p>
                    ) : null}

                    {draft.status === "revision_required" ? (
                      <div className="rn-card">
                        <h4>Reviewer feedback</h4>

                        {draft.review_note ? (
                          <p>{draft.review_note}</p>
                        ) : (
                          <p>
                            The LMS reviewer requested changes to this draft.
                            Open the draft for more information.
                          </p>
                        )}

                        {draft.reviewed_at ? (
                          <p>
                            <strong>Reviewed:</strong>{" "}
                            {formatDateTime(draft.reviewed_at)}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    {draft.status === "approved" ? (
                      <div className="rn-card">
                        <h4>Approved</h4>

                        <p>
                          This AI learning draft has been approved by an LMS
                          reviewer.
                        </p>

                        {draft.review_note ? (
                          <p>
                            <strong>Reviewer note:</strong>{" "}
                            {draft.review_note}
                          </p>
                        ) : null}

                        {draft.reviewed_at ? (
                          <p>
                            <strong>Approved:</strong>{" "}
                            {formatDateTime(draft.reviewed_at)}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    {draft.status === "submitted" ? (
                      <div className="rn-card">
                        <h4>Submitted for review</h4>

                        <p>
                          This draft is currently with an LMS reviewer. You
                          cannot edit it while it is under review.
                        </p>
                      </div>
                    ) : null}

                    {draft.status === "converted" ? (
                      <div className="rn-card">
                        <h4>Converted</h4>

                        <p>
                          This draft has been converted into learning
                          material.
                        </p>
                      </div>
                    ) : null}

                    <div className="rn-ai-draft-timestamps">
                      <div>
                        <span>Source uploaded</span>

                        <strong>
                          {formatDateTime(
                            draft.source_uploaded_at ?? draft.created_at,
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Draft created</span>

                        <strong>
                          {formatDateTime(draft.created_at)}
                        </strong>
                      </div>

                      <div>
                        <span>Last updated</span>

                        <strong>
                          {formatDateTime(draft.updated_at)}
                        </strong>
                      </div>

                      {draft.reviewed_at ? (
                        <div>
                          <span>Reviewed</span>

                          <strong>
                            {formatDateTime(draft.reviewed_at)}
                          </strong>
                        </div>
                      ) : null}
                    </div>

                    <div className="rn-course-card-actions">
                      <Link
                        href={`/student/ai-drafts/${draft.id}`}
                        className="btn btn-primary"
                      >
                        {draft.status === "revision_required"
                          ? "Review & revise"
                          : draft.status === "approved"
                            ? "View approved draft"
                            : "Open draft"}
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}