import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AiDraftEditor from "./AiDraftEditor";

type PageProps = {
  params: Promise<{
    draftId: string;
  }>;
};

type DraftStatus =
  | "draft"
  | "edited"
  | "submitted"
  | "revision_required"
  | "approved"
  | "converted";

type OutputType =
  | "lesson"
  | "study_guide"
  | "lesson_plan"
  | "revision_notes"
  | "quiz"
  | "flashcards";

type LanguageCode = "en" | "ha" | "yo" | "ig" | "sw";

type Audience =
  | "general"
  | "office"
  | "business"
  | "education"
  | "personal";

type Draft = {
  id: string;
  title: string;
  output_type: OutputType;
  language_code: LanguageCode;
  audience: Audience;
  focus_instruction: string | null;
  learning_pack: Record<string, unknown>;
  status: DraftStatus;
  source_uploaded_at: string | null;
  created_at: string;
  updated_at: string;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

const STATUS_LABELS: Record<DraftStatus, string> = {
  draft: "Draft",
  edited: "Edited",
  submitted: "Submitted for review",
  revision_required: "Revision required",
  approved: "Approved",
  converted: "Converted",
};

const STATUS_CLASSES: Record<DraftStatus, string> = {
  draft: "rn-badge",
  edited: "rn-badge rn-ai-draft-status-edited",
  submitted: "rn-badge rn-ai-draft-status-submitted",
  revision_required: "rn-badge rn-ai-draft-status-revision",
  approved: "rn-badge rn-ai-draft-status-approved",
  converted: "rn-badge rn-ai-draft-status-converted",
};

function isOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is T {
  return (
    typeof value === "string" &&
    (allowed as readonly string[]).includes(value)
  );
}

function isDraftStatus(value: unknown): value is DraftStatus {
  return isOneOf(value, [
    "draft",
    "edited",
    "submitted",
    "revision_required",
    "approved",
    "converted",
  ] as const);
}

function isOutputType(value: unknown): value is OutputType {
  return isOneOf(value, [
    "lesson",
    "study_guide",
    "lesson_plan",
    "revision_notes",
    "quiz",
    "flashcards",
  ] as const);
}

function isLanguageCode(value: unknown): value is LanguageCode {
  return isOneOf(value, ["en", "ha", "yo", "ig", "sw"] as const);
}

function isAudience(value: unknown): value is Audience {
  return isOneOf(value, [
    "general",
    "office",
    "business",
    "education",
    "personal",
  ] as const);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function formatDateTime(
  value: string | null | undefined,
): string {
  if (!value) return "Not recorded";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(date);
}

export default async function AiDraftPage({
  params,
}: PageProps) {
  const { draftId } = await params;

  if (
    !draftId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      draftId,
    )
  ) {
    notFound();
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(
        `/student/ai-drafts/${draftId}`,
      )}`,
    );
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

  if (
    !draft ||
    !isDraftStatus(draft.status) ||
    !isOutputType(draft.output_type) ||
    !isLanguageCode(draft.language_code) ||
    !isAudience(draft.audience)
  ) {
    notFound();
  }

  const typedDraft: Draft = {
    id: draft.id,
    title:
      typeof draft.title === "string" && draft.title.trim()
        ? draft.title.trim()
        : "AI Learning Draft",
    output_type: draft.output_type,
    language_code: draft.language_code,
    audience: draft.audience,
    focus_instruction: nullableString(draft.focus_instruction),
    learning_pack: isRecord(draft.learning_pack)
      ? draft.learning_pack
      : {},
    status: draft.status,
    source_uploaded_at: nullableString(draft.source_uploaded_at),
    created_at: draft.created_at,
    updated_at: draft.updated_at,
    review_note: nullableString(draft.review_note),
    reviewed_by: nullableString(draft.reviewed_by),
    reviewed_at: nullableString(draft.reviewed_at),
  };

  return (
    <main className="container rn-dashboard-shell">
      <nav aria-label="Breadcrumb" className="rn-page-header">
        <div>
          <p className="rn-eyebrow">AI Learning Workspace</p>

          <h1>{typedDraft.title}</h1>

          <p className="rn-page-description">
            Review your AI-generated learning material, respond to reviewer
            feedback, and manage your draft.
          </p>

          <div className="rn-course-card-meta">
            <span className={STATUS_CLASSES[typedDraft.status]}>
              {STATUS_LABELS[typedDraft.status]}
            </span>

            <span className="rn-badge">
              Updated {formatDateTime(typedDraft.updated_at)}
            </span>
          </div>
        </div>

        <div className="rn-page-header-actions">
          <Link
            href="/student/ai-drafts"
            className="btn btn-secondary"
          >
            All AI Drafts
          </Link>

          <Link
            href="/student/learning-resources"
            className="btn btn-secondary"
          >
            Learning Resources
          </Link>
        </div>
      </nav>

      {typedDraft.status === "revision_required" && (
        <section
          className="rn-card"
          aria-labelledby="revision-heading"
        >
          <h2 id="revision-heading">Revision required</h2>

          <p>
            Review the feedback below, update your learning material, and
            use the editor to resubmit your draft.
          </p>

          {typedDraft.review_note ? (
            <div>
              <h3>Reviewer feedback</h3>
              <p>{typedDraft.review_note}</p>
            </div>
          ) : (
            <p>
              No written feedback was recorded. Review any instructions
              provided by your LMS reviewer.
            </p>
          )}

          {typedDraft.reviewed_at && (
            <p>
              <strong>Reviewed:</strong>{" "}
              {formatDateTime(typedDraft.reviewed_at)}
            </p>
          )}
        </section>
      )}

      {typedDraft.status === "submitted" && (
        <section
          className="rn-card"
          aria-labelledby="submitted-heading"
        >
          <h2 id="submitted-heading">Submitted for review</h2>

          <p>
            Your draft is awaiting review. Editing or resubmission may be
            restricted while the review is in progress.
          </p>
        </section>
      )}

      {typedDraft.status === "approved" && (
        <section
          className="rn-card"
          aria-labelledby="approved-heading"
        >
          <h2 id="approved-heading">Draft approved</h2>

          <p>
            Your learning material has been approved by an LMS reviewer.
          </p>

          {typedDraft.review_note && (
            <p>
              <strong>Reviewer note:</strong>{" "}
              {typedDraft.review_note}
            </p>
          )}

          {typedDraft.reviewed_at && (
            <p>
              <strong>Approved:</strong>{" "}
              {formatDateTime(typedDraft.reviewed_at)}
            </p>
          )}
        </section>
      )}

      {typedDraft.status === "converted" && (
        <section className="rn-card">
          <h2>Learning material converted</h2>

          <p>
            This draft has been converted into learning material.
          </p>
        </section>
      )}

      <section className="rn-card">
        <div className="rn-section-heading">
          <div>
            <h2>Draft editor</h2>

            <p>
              Review the content and use the available editor actions to
              manage your draft.
            </p>
          </div>
        </div>

        <AiDraftEditor draft={typedDraft} />
      </section>

      <section className="rn-card">
        <h2>Draft information</h2>

        <div className="rn-ai-draft-timestamps">
          <div>
            <span>Source uploaded</span>
            <strong>
              {formatDateTime(
                typedDraft.source_uploaded_at ??
                  typedDraft.created_at,
              )}
            </strong>
          </div>

          <div>
            <span>Draft created</span>
            <strong>{formatDateTime(typedDraft.created_at)}</strong>
          </div>

          <div>
            <span>Last updated</span>
            <strong>{formatDateTime(typedDraft.updated_at)}</strong>
          </div>

          <div>
            <span>Last reviewed</span>
            <strong>{formatDateTime(typedDraft.reviewed_at)}</strong>
          </div>
        </div>
      </section>
    </main>
  );
}