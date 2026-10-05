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
  heading?: unknown;
  content?: unknown;
  examples?: unknown;
};

type Flashcard = {
  front?: unknown;
  back?: unknown;
};

type StudyPlanItem = {
  title?: unknown;
  name?: unknown;
  step?: unknown;
  heading?: unknown;
  description?: unknown;
  content?: unknown;
  details?: unknown;
  action?: unknown;
  instruction?: unknown;
  what_to_do?: unknown;
  task?: unknown;
  summary?: unknown;
  duration_minutes?: unknown;
  duration?: unknown;
};

type LearningPack = {
  overview?: unknown;
  objectives?: unknown;
  learning_objectives?: unknown;
  key_concepts?: unknown;
  prerequisites?: unknown;
  sections?: unknown;
  study_plan?: unknown;
  flashcards?: unknown;
  practical_activity?: unknown;
  assessment_questions?: unknown;
  source_warnings?: unknown;
  source_summary?: unknown;
  estimated_duration?: unknown;
  extracted_text?: unknown;
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

function asString(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => asString(item))
      .filter(Boolean)
      .join(", ");
  }

  if (
    value &&
    typeof value === "object"
  ) {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }

  return "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => asString(item))
    .filter(Boolean);
}

function asObjectArray<T>(
  value: unknown
): T[] {
  return Array.isArray(value)
    ? (value as T[])
    : [];
}

function asNumber(
  value: unknown
): number | null {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function formatDateTime(
  value: string | null
): string {
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

function getPathTitle(
  item: StudyPlanItem,
  index: number
): string {
  const candidates = [
    item.title,
    item.name,
    item.step,
    item.heading,
  ];

  for (const candidate of candidates) {
    const value = asString(candidate);

    if (value) {
      return value;
    }
  }

  return `Learning Step ${index + 1}`;
}

function getPathDescription(
  item: StudyPlanItem
): string {
  const candidates = [
    item.description,
    item.content,
    item.details,
    item.action,
    item.instruction,
    item.what_to_do,
    item.task,
    item.summary,
  ];

  for (const candidate of candidates) {
    const value = asString(candidate);

    if (value) {
      return value;
    }
  }

  return "No additional learning instruction was provided.";
}

function getSectionHeading(
  section: Section,
  index: number
): string {
  const heading = asString(section.heading);

  return heading || `Learning Section ${index + 1}`;
}

function getSectionContent(
  section: Section
): string {
  const content = asString(section.content);

  return content || "No section content was provided.";
}

function getFlashcardFront(
  flashcard: Flashcard,
  index: number
): string {
  const front = asString(flashcard.front);

  return front || `Flashcard ${index + 1}`;
}

function getFlashcardBack(
  flashcard: Flashcard
): string {
  const back = asString(flashcard.back);

  return back || "No answer was provided.";
}

export default function AdminAiDraftReview({
  draft: initialDraft,
}: Props) {
  const router = useRouter();

  const [draft, setDraft] =
    useState<Draft>(initialDraft);

  const [reviewNote, setReviewNote] =
    useState(
      initialDraft.review_note ?? ""
    );

  const [busy, setBusy] =
    useState(false);

  const [convertBusy, setConvertBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const pack: LearningPack =
    draft.learning_pack &&
    typeof draft.learning_pack === "object"
      ? draft.learning_pack
      : {};

  const objectives = asStringArray(
    Array.isArray(pack.objectives)
      ? pack.objectives
      : pack.learning_objectives
  );

  const concepts =
    asStringArray(pack.key_concepts);

  const prerequisites =
    asStringArray(pack.prerequisites);

  const sections =
    asObjectArray<Section>(
      pack.sections
    );

  const learningPath =
    asObjectArray<StudyPlanItem>(
      pack.study_plan
    );

  const flashcards =
    asObjectArray<Flashcard>(
      pack.flashcards
    );

  const assessmentQuestions =
    asStringArray(
      pack.assessment_questions
    );

  const sourceWarnings =
    asStringArray(
      pack.source_warnings
    );

  const isSubmitted =
    draft.status === "submitted";

  const isApproved =
    draft.status === "approved";

  const isConverted =
    draft.status === "converted";

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
        return asString(draft.status);
    }
  }, [draft.status]);

  async function review(
    action:
      | "approve"
      | "revision_required"
  ) {
    setBusy(true);
    setError("");
    setSuccess("");

    const cleanReviewNote =
      asString(reviewNote);

    if (
      action === "revision_required" &&
      !cleanReviewNote
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
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            id: draft.id,
            action,
            reviewNote:
              cleanReviewNote,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          asString(data?.error) ||
            "The review action could not be completed."
        );
      }

      if (data?.draft) {
        setDraft(
          (current) => ({
            ...current,
            ...data.draft,
          })
        );
      } else {
        setDraft(
          (current) => ({
            ...current,
            status:
              action === "approve"
                ? "approved"
                : "revision_required",
            review_note:
              cleanReviewNote || null,
          })
        );
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

    const confirmed =
      window.confirm(
        "Convert this approved AI draft into an unpublished LMS course?"
      );

    if (!confirmed) {
      return;
    }

    setConvertBusy(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        "/api/admin/ai-drafts/convert",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            id: draft.id,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          asString(data?.error) ||
            "The AI draft could not be converted into an LMS course."
        );
      }

      const result =
        data?.result;

      const courseId =
        result?.course_id ??
        draft.converted_course_id ??
        null;

      const convertedAt =
        result?.converted_at ??
        new Date().toISOString();

      setDraft(
        (current) => ({
          ...current,
          status: "converted",
          converted_course_id:
            courseId,
          converted_at:
            convertedAt,
          updated_at:
            convertedAt,
        })
      );

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

  const overview =
    asString(pack.overview) ||
    "No overview was provided.";

  const practicalActivity =
    asString(
      pack.practical_activity
    );

  const sourceWarningsExist =
    sourceWarnings.length > 0;

  return (
    <main className="container rn-dashboard-shell">
      <div className="rn-page-header">
        <div>
          <p className="rn-eyebrow">
            AI Draft Review
          </p>

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
              router.push(
                "/admin/ai-drafts"
              )
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

        <h2>
          {asString(draft.title) ||
            "Untitled AI Draft"}
        </h2>

        <span className="badge">
          {statusLabel}
        </span>

        <div className="grid-2">
          <div>
            <strong>Output</strong>
            <p>
              {asString(
                draft.output_type
              ) || "—"}
            </p>
          </div>

          <div>
            <strong>Language</strong>

            <p>
              {asString(
                draft.language_code
              ) === "en"
                ? "English"
                : asString(
                    draft.language_code
                  ) || "—"}
            </p>
          </div>

          <div>
            <strong>Audience</strong>

            <p>
              {asString(
                draft.audience
              ) || "—"}
            </p>
          </div>

          <div>
            <strong>
              Source uploaded
            </strong>

            <p>
              {formatDateTime(
                draft.source_uploaded_at
              )}
            </p>
          </div>

          <div>
            <strong>
              Draft created
            </strong>

            <p>
              {formatDateTime(
                draft.created_at
              )}
            </p>
          </div>

          <div>
            <strong>
              Last updated
            </strong>

            <p>
              {formatDateTime(
                draft.updated_at
              )}
            </p>
          </div>

          {draft.reviewed_at ? (
            <div>
              <strong>
                Reviewed
              </strong>

              <p>
                {formatDateTime(
                  draft.reviewed_at
                )}
              </p>
            </div>
          ) : null}

          {draft.converted_at ? (
            <div>
              <strong>
                Converted
              </strong>

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
          <p role="alert">
            {error}
          </p>
        </section>
      ) : null}

      {success ? (
        <section className="card">
          <p role="status">
            {success}
          </p>
        </section>
      ) : null}

      <section className="card">
        <h2>
          Privacy protection
        </h2>

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
          <p className="rn-eyebrow">
            Approved
          </p>

          <h2>
            Convert to LMS
          </h2>

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
          <p className="rn-eyebrow">
            Converted
          </p>

          <h2>
            LMS course created
          </h2>

          <p>
            This approved AI draft has already been converted
            into an unpublished LMS course.
          </p>

          <div className="grid-2">
            <div>
              <strong>
                Course ID
              </strong>

              <p>
                {asString(
                  draft.converted_course_id
                )}
              </p>
            </div>

            <div>
              <strong>
                Converted at
              </strong>

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

        <h2>
          Primary learning sequence
        </h2>

        <p className="rn-muted">
          This is the actual learning sequence generated from
          the source material and used as the primary structure
          for LMS conversion.
        </p>

        {learningPath.length > 0 ? (
          <div className="stack">
            {learningPath.map(
              (item, index) => {
                const duration =
                  asNumber(
                    item.duration_minutes
                  ) ??
                  asNumber(
                    item.duration
                  );

                return (
                  <article
                    key={`${draft.id}-path-${index}`}
                    className="card"
                  >
                    <p className="rn-eyebrow">
                      Learning step{" "}
                      {index + 1}
                    </p>

                    <h3>
                      {getPathTitle(
                        item,
                        index
                      )}
                    </h3>

                    <p>
                      {getPathDescription(
                        item
                      )}
                    </p>

                    {duration !==
                    null ? (
                      <p className="rn-muted">
                        Estimated duration:{" "}
                        {duration}{" "}
                        minutes
                      </p>
                    ) : null}
                  </article>
                );
              }
            )}
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

        <h2>
          Overview
        </h2>

        <p>
          {overview}
        </p>
      </section>

      {objectives.length >
      0 ? (
        <section className="card">
          <h2>
            Learning objectives
          </h2>

          <ul>
            {objectives.map(
              (item, index) => (
                <li
                  key={`${draft.id}-objective-${index}`}
                >
                  {item}
                </li>
              )
            )}
          </ul>
        </section>
      ) : null}

      {prerequisites.length >
      0 ? (
        <section className="card">
          <h2>
            Prerequisites
          </h2>

          <ul>
            {prerequisites.map(
              (item, index) => (
                <li
                  key={`${draft.id}-prerequisite-${index}`}
                >
                  {item}
                </li>
              )
            )}
          </ul>
        </section>
      ) : null}

      {concepts.length >
      0 ? (
        <section className="card">
          <h2>
            Key concepts
          </h2>

          <ul>
            {concepts.map(
              (item, index) => (
                <li
                  key={`${draft.id}-concept-${index}`}
                >
                  {item}
                </li>
              )
            )}
          </ul>
        </section>
      ) : null}

      {sections.length >
      0 ? (
        <section className="card">
          <h2>
            Learning content
          </h2>

          <div className="stack">
            {sections.map(
              (section, index) => {
                const examples =
                  asStringArray(
                    section.examples
                  );

                return (
                  <article
                    key={`${draft.id}-section-${index}`}
                    className="card"
                  >
                    <h3>
                      {getSectionHeading(
                        section,
                        index
                      )}
                    </h3>

                    <p>
                      {getSectionContent(
                        section
                      )}
                    </p>

                    {examples.length >
                    0 ? (
                      <>
                        <h4>
                          Examples
                        </h4>

                        <ul>
                          {examples.map(
                            (
                              example,
                              exampleIndex
                            ) => (
                              <li
                                key={`${draft.id}-example-${index}-${exampleIndex}`}
                              >
                                {
                                  example
                                }
                              </li>
                            )
                          )}
                        </ul>
                      </>
                    ) : null}
                  </article>
                );
              }
            )}
          </div>
        </section>
      ) : null}

      {flashcards.length >
      0 ? (
        <section className="card">
          <h2>
            Flashcards
          </h2>

          <div className="stack">
            {flashcards.map(
              (
                flashcard,
                index
              ) => (
                <article
                  key={`${draft.id}-flashcard-${index}`}
                  className="card"
                >
                  <h3>
                    {getFlashcardFront(
                      flashcard,
                      index
                    )}
                  </h3>

                  <p>
                    {getFlashcardBack(
                      flashcard
                    )}
                  </p>
                </article>
              )
            )}
          </div>
        </section>
      ) : null}

      {practicalActivity ? (
        <section className="card">
          <h2>
            Practical activity
          </h2>

          <p>
            {practicalActivity}
          </p>
        </section>
      ) : null}

      {assessmentQuestions.length >
      0 ? (
        <section className="card">
          <h2>
            Assessment questions
          </h2>

          <ol>
            {assessmentQuestions.map(
              (
                question,
                index
              ) => (
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

      {sourceWarningsExist ? (
        <section className="card">
          <h2>
            Privacy and source warnings
          </h2>

          <ul>
            {sourceWarnings.map(
              (
                warning,
                index
              ) => (
                <li
                  key={`${draft.id}-warning-${index}`}
                >
                  {warning}
                </li>
              )
            )}
          </ul>
        </section>
      ) : null}

      {isSubmitted ? (
        <section className="card">
          <p className="rn-eyebrow">
            Reviewer decision
          </p>

          <h2>
            Review this learning material
          </h2>

          <label htmlFor="review-note">
            Review note
          </label>

          <textarea
            id="review-note"
            value={reviewNote}
            onChange={(event) =>
              setReviewNote(
                event.target.value
              )
            }
            rows={5}
            placeholder="Add feedback for the student..."
          />

          <div className="rn-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                review(
                  "revision_required"
                )
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
              onClick={() =>
                review("approve")
              }
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
          <h2>
            Reviewer note
          </h2>

          <p>
            {asString(
              draft.review_note
            )}
          </p>
        </section>
      ) : null}
    </main>
  );
}