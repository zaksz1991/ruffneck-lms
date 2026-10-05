"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ReviewAction = "approve" | "revision_required";

type LearningPack = {
  title?: unknown;
  summary?: unknown;
  source_summary?: unknown;
  extracted_text?: unknown;
  sections?: unknown;
  objectives?: unknown;
  key_concepts?: unknown;
  prerequisites?: unknown;
  study_plan?: unknown;
  flashcards?: unknown;
  practical_activity?: unknown;
  assessment?: unknown;
  source_warning?: unknown;
};

type Draft = {
  id: string;
  student_id: string;
  title: string;
  output_type: string;
  language_code: string;
  audience: string;
  focus_instruction: string | null;
  learning_pack: LearningPack | null;
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

type Props = {
  draft: Draft;
  reviewerRole: "admin" | "instructor";
};

type Section = {
  heading?: unknown;
  content?: unknown;
};

type Concept = {
  term?: unknown;
  definition?: unknown;
};

type StudyPlanItem = {
  step?: unknown;
  title?: unknown;
  description?: unknown;
};

type Flashcard = {
  question?: unknown;
  answer?: unknown;
};

type AssessmentQuestion = {
  question?: unknown;
  options?: unknown;
  answer?: unknown;
  explanation?: unknown;
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

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

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

function labelFor(
  labels: Record<string, string>,
  value: string,
): string {
  return labels[value] ?? value;
}

export default function AdminAiDraftReview({
  draft,
  reviewerRole,
}: Props) {
  const router = useRouter();

  const [reviewNote, setReviewNote] = useState(draft.review_note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const pack = draft.learning_pack ?? {};

  const sections = useMemo(
    () => asArray<Section>(pack.sections),
    [pack.sections],
  );

  const objectives = useMemo(
    () => asArray<unknown>(pack.objectives),
    [pack.objectives],
  );

  const concepts = useMemo(
    () => asArray<Concept>(pack.key_concepts),
    [pack.key_concepts],
  );

  const prerequisites = useMemo(
    () => asArray<unknown>(pack.prerequisites),
    [pack.prerequisites],
  );

  const studyPlan = useMemo(
    () => asArray<StudyPlanItem>(pack.study_plan),
    [pack.study_plan],
  );

  const flashcards = useMemo(
    () => asArray<Flashcard>(pack.flashcards),
    [pack.flashcards],
  );

  const assessment = useMemo(
    () => asArray<AssessmentQuestion>(pack.assessment),
    [pack.assessment],
  );

  const isSubmitted = draft.status === "submitted";

  async function submitReview(action: ReviewAction) {
    if (!isSubmitted || busy) {
      return;
    }

    if (action === "revision_required" && !reviewNote.trim()) {
      setError("Add a review note before requesting a revision.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/ai-drafts/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: draft.id,
          action,
          reviewNote: reviewNote.trim(),
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(
          data.error ?? "Unable to update the draft review.",
        );
      }

      setMessage(
        data.message ??
          (action === "approve"
            ? "AI draft approved."
            : "AI draft returned for revision."),
      );

      router.refresh();
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : "Unable to update the draft review.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rn-stack">
      <section className="rn-card">
        <div className="rn-card-header">
          <div>
            <p className="eyebrow">Submitted learning material</p>
            <h2>{draft.title}</h2>
          </div>

          <span className="rn-badge">
            {draft.status === "submitted"
              ? "Submitted for review"
              : draft.status.replaceAll("_", " ")}
          </span>
        </div>

        <div className="rn-meta-grid">
          <div>
            <span className="muted">Output</span>
            <strong>
              {labelFor(OUTPUT_LABELS, draft.output_type)}
            </strong>
          </div>

          <div>
            <span className="muted">Language</span>
            <strong>
              {labelFor(LANGUAGE_LABELS, draft.language_code)}
            </strong>
          </div>

          <div>
            <span className="muted">Audience</span>
            <strong>
              {labelFor(AUDIENCE_LABELS, draft.audience)}
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
      </section>

      {draft.focus_instruction ? (
        <section className="rn-card">
          <p className="eyebrow">Additional instruction</p>
          <p>{draft.focus_instruction}</p>
        </section>
      ) : null}

      {pack.summary ? (
        <section className="rn-card">
          <p className="eyebrow">Summary</p>
          <p>{asString(pack.summary)}</p>
        </section>
      ) : null}

      {pack.source_summary ? (
        <section className="rn-card">
          <p className="eyebrow">Source summary</p>
          <p>{asString(pack.source_summary)}</p>
        </section>
      ) : null}

      {pack.extracted_text ? (
        <section className="rn-card">
          <p className="eyebrow">Extracted source text</p>
          <p className="muted">
            Source text is not displayed in the review interface after
            generation for privacy protection.
          </p>
        </section>
      ) : null}

      {objectives.length > 0 ? (
        <section className="rn-card">
          <p className="eyebrow">Learning objectives</p>

          <ul>
            {objectives.map((objective, index) => (
              <li key={`objective-${index}`}>
                {asString(objective)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {prerequisites.length > 0 ? (
        <section className="rn-card">
          <p className="eyebrow">Prerequisites</p>

          <ul>
            {prerequisites.map((item, index) => (
              <li key={`prerequisite-${index}`}>
                {asString(item)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {concepts.length > 0 ? (
        <section className="rn-card">
          <p className="eyebrow">Key concepts</p>

          <div className="rn-stack">
            {concepts.map((concept, index) => (
              <div
                key={`concept-${index}`}
                className="rn-card rn-card-compact"
              >
                <h3>{asString(concept.term)}</h3>
                <p>{asString(concept.definition)}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {sections.length > 0 ? (
        <section className="rn-card">
          <p className="eyebrow">Learning content</p>

          <div className="rn-stack">
            {sections.map((section, index) => (
              <article
                key={`section-${index}`}
                className="rn-card rn-card-compact"
              >
                <h3>{asString(section.heading)}</h3>
                <p>{asString(section.content)}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {studyPlan.length > 0 ? (
        <section className="rn-card">
          <p className="eyebrow">Study plan</p>

          <div className="rn-stack">
            {studyPlan.map((item, index) => (
              <article
                key={`study-${index}`}
                className="rn-card rn-card-compact"
              >
                <p className="eyebrow">
                  Step {asString(item.step) || String(index + 1)}
                </p>

                <h3>{asString(item.title)}</h3>

                <p>{asString(item.description)}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {flashcards.length > 0 ? (
        <section className="rn-card">
          <p className="eyebrow">Flashcards</p>

          <div className="rn-stack">
            {flashcards.map((card, index) => (
              <article
                key={`flashcard-${index}`}
                className="rn-card rn-card-compact"
              >
                <h3>{asString(card.question)}</h3>
                <p>{asString(card.answer)}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {pack.practical_activity ? (
        <section className="rn-card">
          <p className="eyebrow">Practical activity</p>
          <p>{asString(pack.practical_activity)}</p>
        </section>
      ) : null}

      {assessment.length > 0 ? (
        <section className="rn-card">
          <p className="eyebrow">Assessment</p>

          <div className="rn-stack">
            {assessment.map((question, index) => {
              const options = asArray<unknown>(question.options);

              return (
                <article
                  key={`assessment-${index}`}
                  className="rn-card rn-card-compact"
                >
                  <h3>
                    {index + 1}. {asString(question.question)}
                  </h3>

                  {options.length > 0 ? (
                    <ul>
                      {options.map((option, optionIndex) => (
                        <li key={`option-${optionIndex}`}>
                          {asString(option)}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {question.answer ? (
                    <p>
                      <strong>Answer:</strong>{" "}
                      {asString(question.answer)}
                    </p>
                  ) : null}

                  {question.explanation ? (
                    <p>
                      <strong>Explanation:</strong>{" "}
                      {asString(question.explanation)}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {pack.source_warning ? (
        <section className="rn-card">
          <p className="eyebrow">Privacy / source warning</p>
          <p>{asString(pack.source_warning)}</p>
        </section>
      ) : null}

      {draft.review_note ? (
        <section className="rn-card">
          <p className="eyebrow">Previous review note</p>
          <p>{draft.review_note}</p>
        </section>
      ) : null}

      <section className="rn-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Reviewer decision</p>
            <h2>Review this learning material</h2>
          </div>
        </div>

        {isSubmitted ? (
          <>
            <label htmlFor="review-note">
              Review note
            </label>

            <textarea
              id="review-note"
              value={reviewNote}
              onChange={(event) =>
                setReviewNote(event.target.value)
              }
              placeholder="Add feedback for the student. A note is required when requesting a revision."
              rows={7}
              maxLength={5000}
              disabled={busy}
            />

            <p className="muted">
              {reviewNote.length}/5000 characters
            </p>

            {error ? (
              <div className="rn-alert rn-alert-error">
                {error}
              </div>
            ) : null}

            {message ? (
              <div className="rn-alert rn-alert-success">
                {message}
              </div>
            ) : null}

            <div className="rn-button-row">
              <button
                type="button"
                className="rn-button rn-button-primary"
                onClick={() => submitReview("approve")}
                disabled={busy}
              >
                {busy ? "Processing..." : "Approve draft"}
              </button>

              <button
                type="button"
                className="rn-button rn-button-secondary"
                onClick={() => submitReview("revision_required")}
                disabled={busy}
              >
                Request revision
              </button>
            </div>
          </>
        ) : (
          <div className="rn-alert rn-alert-info">
            This draft has already been reviewed. It cannot be reviewed
            again from this screen.
          </div>
        )}

        <p className="muted">
          Reviewer role: {reviewerRole}
        </p>
      </section>
    </div>
  );
}