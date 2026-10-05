"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type DraftStatus =
  | "draft"
  | "edited"
  | "submitted"
  | "revision_required"
  | "approved"
  | "converted";

type Section = {
  heading: string;
  content: string;
  examples?: string[];
};

type Flashcard = {
  front: string;
  back: string;
};

type StudyPlanItem = {
  title?: string;
  name?: string;
  step?: string;
  heading?: string;
  description?: string;
  content?: string;
  details?: string;
  action?: string;
  instruction?: string;
  what_to_do?: string;
  task?: string;
  summary?: string;
  duration_minutes?: number;
  duration?: number;
};

type LearningPack = {
  overview?: string;
  objectives?: string[];
  learning_objectives?: string[];
  key_concepts?: string[];
  prerequisites?: string[];
  sections?: Section[];
  study_plan?: StudyPlanItem[];
  flashcards?: Flashcard[];
  practical_activity?: string;
  assessment_questions?: string[];
  source_warnings?: string[];
  source_summary?: string;
  estimated_duration?: string;
  extracted_text?: string;
};

type Draft = {
  id: string;
  student_id: string;
  title: string;
  output_type: string;
  language_code: string;
  audience: string;
  focus_instruction: string | null;
  learning_pack: LearningPack;
  status: DraftStatus;
  source_uploaded_at: string | null;
  created_at: string;
  updated_at: string;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  converted_course_id: string | null;
  converted_at: string | null;
};

type Props = {
  draft: Draft;
};

function formatDateTime(value: string | null): string {
  if (!value) return "—";

  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Africa/Lagos",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function asArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function getPathTitle(
  item: StudyPlanItem,
  index: number
): string {
  return (
    item.title?.trim() ||
    item.name?.trim() ||
    item.step?.trim() ||
    item.heading?.trim() ||
    `Learning Step ${index + 1}`
  );
}

function getPathDescription(item: StudyPlanItem): string {
  return (
    item.description?.trim() ||
    item.content?.trim() ||
    item.details?.trim() ||
    item.action?.trim() ||
    item.instruction?.trim() ||
    item.what_to_do?.trim() ||
    item.task?.trim() ||
    item.summary?.trim() ||
    "No additional learning instruction was provided."
  );
}

export default function AdminAiDraftReview({
  draft: initialDraft,
}: Props) {
  const router = useRouter();

  const [draft, setDraft] = useState(initialDraft);
  const [reviewNote, setReviewNote] = useState(
    initialDraft.review_note ?? ""
  );

  const [busy, setBusy] = useState(false);
  const [convertBusy, setConvertBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const pack = draft.learning_pack ?? {};

  const objectives = asArray(
    pack.objectives ?? pack.learning_objectives
  );

  const concepts = asArray(pack.key_concepts);
  const prerequisites = asArray(pack.prerequisites);
  const sections = asArray(pack.sections);
  const learningPath = asArray(pack.study_plan);
  const flashcards = asArray(pack.flashcards);
  const assessmentQuestions = asArray(
    pack.assessment_questions
  );
  const sourceWarnings = asArray(pack.source_warnings);

  const isSubmitted = draft.status === "submitted";
  const isApproved = draft.status === "approved";
  const isConverted = draft.status === "converted";

  const statusLabel = useMemo(() => {
    switch (draft.status) {
      case "draft":
        return "Draft";
      case "edited":
        return "Edited";
      case "submitted":
        return "Submitted for review";
      case "revision_required":
        return "Revision required";
      case "approved":
        return "Approved";
      case "converted":
        return "Converted to LMS";
      default:
        return draft.status;
    }
  }, [draft.status]);

  async function review(
    action: "approve" | "revision_required"
  ) {
    setBusy(true);
    setError("");
    setSuccess("");

    if (
      action === "revision_required" &&
      !reviewNote.trim()
    ) {
      setError(
        "A review note is required when requesting revision."
      );
      setBusy(false);
      return;
    }

    try {
      const response = await fetch(
        "/api/admin/ai-drafts/review",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: draft.id,
            action,
            reviewNote: reviewNote.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "The review action could not be completed."
        );
      }

      if (data?.draft) {
        setDraft((current) => ({
          ...current,
          ...data.draft,
        }));
      } else {
        setDraft((current) => ({
          ...current,
          status:
            action === "approve"
              ? "approved"
              : "revision_required",
          review_note: reviewNote.trim() || null,
        }));
      }

      setSuccess(
        action === "approve"
          ? "AI draft approved. It is now ready for LMS conversion."
          : "Revision requested. The student can now update the draft."
      );
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : "The review action failed."
      );
    } finally {
      setBusy(false);
    }
  }

  async function convertToLms() {
    if (!isApproved) {
      setError(
        "Only an approved AI draft can be converted to an LMS course."
      );
      return;
    }

    const confirmed = window.confirm(
      "Convert this approved AI draft into an unpublished LMS course?"
    );

    if (!confirmed) return;

    setConvertBusy(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        "/api/admin/ai-drafts/convert",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: draft.id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "The AI draft could not be converted into an LMS course."
        );
      }

      const result = data?.result;

      const courseId =
        result?.course_id ??
        draft.converted_course_id ??
        null;

      const convertedAt =
        result?.converted_at ??
        new Date().toISOString();

      setDraft((current) => ({
        ...current,
        status: "converted",
        converted_course_id: courseId,
        converted_at: convertedAt,
        updated_at: convertedAt,
      }));

      setSuccess(
        "AI draft converted successfully. The LMS course is unpublished and ready for review."
      );
    } catch (conversionError) {
      setError(
        conversionError instanceof Error
          ? conversionError.message
          : "The conversion failed."
      );
    } finally {
      setConvertBusy(false);
    }
  }

  return (
    <main className="container rn-dashboard-shell">
      <div className="rn-page-header">
        <div>
          <p className="rn-eyebrow">AI Draft Review</p>

          <h1>Review AI Draft</h1>

          <p className="rn-muted">
            Review generated learning material before it enters
            the RuffNeck Learn LMS workflow.
          </p>
        </div>

        <div className="rn-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              router.push("/admin/ai-drafts")
            }
          >
            Back to AI Draft Review
          </button>
        </div>
      </div>

      <section className="card">
        <p className="rn-eyebrow">
          Submitted learning material
        </p>

        <h2>{draft.title}</h2>

        <span className="badge">{statusLabel}</span>

        <div className="grid-2">
          <div>
            <strong>Output</strong>
            <p>{draft.output_type}</p>
          </div>

          <div>
            <strong>Language</strong>
            <p>
              {draft.language_code === "en"
                ? "English"
                : draft.language_code}
            </p>
          </div>

          <div>
            <strong>Audience</strong>
            <p>{draft.audience}</p>
          </div>

          <div>
            <strong>Source uploaded</strong>
            <p>
              {formatDateTime(
                draft.source_uploaded_at
              )}
            </p>
          </div>

          <div>
            <strong>Draft created</strong>
            <p>
              {formatDateTime(draft.created_at)}
            </p>
          </div>

          <div>
            <strong>Last updated</strong>
            <p>
              {formatDateTime(draft.updated_at)}
            </p>
          </div>

          {draft.reviewed_at ? (
            <div>
              <strong>Reviewed</strong>
              <p>
                {formatDateTime(
                  draft.reviewed_at
                )}
              </p>
            </div>
          ) : null}

          {draft.converted_at ? (
            <div>
              <strong>Converted</strong>
              <p>
                {formatDateTime(
                  draft.converted_at
                )}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      {error ? (
        <section className="card">
          <p role="alert">{error}</p>
        </section>
      ) : null}

      {success ? (
        <section className="card">
          <p role="status">{success}</p>
        </section>
      ) : null}

      <section className="card">
        <h2>Privacy protection</h2>

        <p>
          Original source text and source-specific identifiers
          are not displayed in the review interface.
        </p>

        <p>
          Privacy screening is applied before AI-generated
          learning material is stored or converted into LMS
          content.
        </p>
      </section>

      {isApproved ? (
        <section className="card">
          <p className="rn-eyebrow">Approved</p>

          <h2>Convert to LMS</h2>

          <p>
            This draft has passed review and can now be converted
            into an unpublished LMS course.
          </p>

          <div className="rn-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={convertToLms}
              disabled={convertBusy}
            >
              {convertBusy
                ? "Converting..."
                : "Convert to LMS"}
            </button>
          </div>

          <p className="rn-muted">
            The Generated Learning Path will determine the
            initial course sequence. The course will remain
            unpublished until it is reviewed in Admin LMS.
          </p>
        </section>
      ) : null}

      {isConverted &&
      draft.converted_course_id ? (
        <section className="card">
          <p className="rn-eyebrow">Converted</p>

          <h2>LMS course created</h2>

          <p>
            This approved AI draft has already been converted
            into an unpublished LMS course.
          </p>

          <div className="grid-2">
            <div>
              <strong>Course ID</strong>
              <p>
                {draft.converted_course_id}
              </p>
            </div>

            <div>
              <strong>Converted at</strong>
              <p>
                {formatDateTime(
                  draft.converted_at
                )}
              </p>
            </div>
          </div>

          <div className="rn-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                router.push(
                  `/admin/lms?course=${draft.converted_course_id}`
                )
              }
            >
              Open LMS Course
            </button>
          </div>
        </section>
      ) : null}

      <section className="card">
        <p className="rn-eyebrow">
          Generated Learning Path
        </p>

        <h2>Primary learning sequence</h2>

        <p className="rn-muted">
          This is the actual learning sequence generated from
          the source material and used as the primary structure
          for LMS conversion.
        </p>

        {learningPath.length > 0 ? (
          <div className="stack">
            {learningPath.map((item, index) => (
              <article
                key={`${draft.id}-path-${index}`}
                className="card"
              >
                <p className="rn-eyebrow">
                  Learning step {index + 1}
                </p>

                <h3>
                  {getPathTitle(item, index)}
                </h3>

                <p>
                  {getPathDescription(item)}
                </p>

                {item.duration_minutes ||
                item.duration ? (
                  <p className="rn-muted">
                    Estimated duration:{" "}
                    {item.duration_minutes ??
                      item.duration}{" "}
                    minutes
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p>
            No generated learning path was provided.
          </p>
        )}
      </section>

      <section className="card">
        <p className="rn-eyebrow">
          Supporting learning material
        </p>

        <h2>Overview</h2>

        <p>
          {pack.overview ||
            "No overview was provided."}
        </p>
      </section>

      {objectives.length > 0 ? (
        <section className="card">
          <h2>Learning objectives</h2>

          <ul>
            {objectives.map((item, index) => (
              <li
                key={`${draft.id}-objective-${index}`}
              >
                {item}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {prerequisites.length > 0 ? (
        <section className="card">
          <h2>Prerequisites</h2>

          <ul>
            {prerequisites.map((item, index) => (
              <li
                key={`${draft.id}-prerequisite-${index}`}
              >
                {item}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {concepts.length > 0 ? (
        <section className="card">
          <h2>Key concepts</h2>

          <ul>
            {concepts.map((item, index) => (
              <li
                key={`${draft.id}-concept-${index}`}
              >
                {item}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sections.length > 0 ? (
        <section className="card">
          <h2>Learning content</h2>

          <div className="stack">
            {sections.map((section, index) => (
              <article
                key={`${draft.id}-section-${index}`}
                className="card"
              >
                <h3>{section.heading}</h3>

                <p>{section.content}</p>

                {section.examples &&
                section.examples.length > 0 ? (
                  <>
                    <h4>Examples</h4>

                    <ul>
                      {section.examples.map(
                        (example, exampleIndex) => (
                          <li
                            key={`${draft.id}-example-${index}-${exampleIndex}`}
                          >
                            {example}
                          </li>
                        )
                      )}
                    </ul>
                  </>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {flashcards.length > 0 ? (
        <section className="card">
          <h2>Flashcards</h2>

          <div className="stack">
            {flashcards.map((flashcard, index) => (
              <article
                key={`${draft.id}-flashcard-${index}`}
                className="card"
              >
                <h3>{flashcard.front}</h3>
                <p>{flashcard.back}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {pack.practical_activity ? (
        <section className="card">
          <h2>Practical activity</h2>
          <p>{pack.practical_activity}</p>
        </section>
      ) : null}

      {assessmentQuestions.length > 0 ? (
        <section className="card">
          <h2>Assessment questions</h2>

          <ol>
            {assessmentQuestions.map(
              (question, index) => (
                <li
                  key={`${draft.id}-question-${index}`}
                >
                  {question}
                </li>
              )
            )}
          </ol>
        </section>
      ) : null}

      {sourceWarnings.length > 0 ? (
        <section className="card">
          <h2>Privacy and source warnings</h2>

          <ul>
            {sourceWarnings.map((warning, index) => (
              <li
                key={`${draft.id}-warning-${index}`}
              >
                {warning}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {isSubmitted ? (
        <section className="card">
          <p className="rn-eyebrow">
            Reviewer decision
          </p>

          <h2>Review this learning material</h2>

          <label htmlFor="review-note">
            Review note
          </label>

          <textarea
            id="review-note"
            value={reviewNote}
            onChange={(event) =>
              setReviewNote(event.target.value)
            }
            rows={5}
            placeholder="Add feedback for the student..."
          />

          <div className="rn-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                review("revision_required")
              }
              disabled={busy}
            >
              {busy
                ? "Processing..."
                : "Request revision"}
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => review("approve")}
              disabled={busy}
            >
              {busy
                ? "Processing..."
                : "Approve draft"}
            </button>
          </div>
        </section>
      ) : (
        <section className="card">
          <p className="rn-muted">
            This draft has already been reviewed. It cannot be
            reviewed again from this screen.
          </p>
        </section>
      )}

      {draft.review_note ? (
        <section className="card">
          <h2>Reviewer note</h2>
          <p>{draft.review_note}</p>
        </section>
      ) : null}
    </main>
  );
}