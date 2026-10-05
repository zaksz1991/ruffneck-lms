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
  step: string;
  action: string;
};

type KeyConcept = {
  term: string;
  explanation: string;
};

type AssessmentQuestion = {
  question: string;
  options?: string[];
  correct_answer?: string;
  explanation?: string;
};

type PracticalActivity = {
  title?: string;
  instructions?: string;
  expected_output?: string;
};

type LearningPack = {
  title?: string;
  summary?: string;
  sections?: Section[];
  difficulty?: string;
  flashcards?: Flashcard[];
  study_plan?: StudyPlanItem[];
  key_concepts?: KeyConcept[];
  prerequisites?: string[];
  source_warnings?: string[];
  practical_activity?: PracticalActivity;
  learning_objectives?: string[];
  assessment_questions?: AssessmentQuestion[];
  estimated_duration_minutes?: number | null;
  extracted_text?: string;
  source_summary?: string;
  [key: string]: unknown;
};

type Draft = {
  id: string;
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
};

type Props = {
  draft: Draft;
};

type DraftApiResponse = {
  success?: boolean;
  error?: string;
  message?: string;
  draft?: {
    id?: string;
    title?: string;
    output_type?: string;
    language_code?: string;
    audience?: string;
    status?: DraftStatus;
    source_uploaded_at?: string | null;
    created_at?: string;
    updated_at?: string;
    review_note?: string | null;
    reviewed_by?: string | null;
    reviewed_at?: string | null;
  };
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) =>
        typeof item === "string" ? item : String(item ?? "")
      )
    : [];
}

function normalizeSection(value: unknown): Section {
  if (!value || typeof value !== "object") {
    return {
      heading: "",
      content: "",
      examples: [],
    };
  }

  const item = value as Record<string, unknown>;

  return {
    heading: asString(item.heading),
    content: asString(item.content),
    examples: asStringArray(item.examples),
  };
}

function normalizeFlashcard(value: unknown): Flashcard {
  if (!value || typeof value !== "object") {
    return {
      front: "",
      back: "",
    };
  }

  const item = value as Record<string, unknown>;

  return {
    front: asString(item.front),
    back: asString(item.back),
  };
}

function normalizeStudyPlanItem(value: unknown): StudyPlanItem {
  if (!value || typeof value !== "object") {
    return {
      step: "",
      action: "",
    };
  }

  const item = value as Record<string, unknown>;

  return {
    step:
      typeof item.step === "number"
        ? String(item.step)
        : asString(item.step),
    action: asString(item.action),
  };
}

function normalizeKeyConcept(value: unknown): KeyConcept {
  if (!value || typeof value !== "object") {
    return {
      term: "",
      explanation: "",
    };
  }

  const item = value as Record<string, unknown>;

  return {
    term: asString(item.term),
    explanation: asString(item.explanation),
  };
}

function normalizeQuestion(value: unknown): AssessmentQuestion {
  if (!value || typeof value !== "object") {
    return {
      question: "",
      options: [],
      correct_answer: "",
      explanation: "",
    };
  }

  const item = value as Record<string, unknown>;

  return {
    question: asString(item.question),
    options: asStringArray(item.options),
    correct_answer: asString(item.correct_answer),
    explanation: asString(item.explanation),
  };
}

function normalizeActivity(value: unknown): PracticalActivity {
  if (!value || typeof value !== "object") {
    return {
      title: "",
      instructions: "",
      expected_output: "",
    };
  }

  const item = value as Record<string, unknown>;

  return {
    title: asString(item.title),
    instructions: asString(item.instructions),
    expected_output: asString(item.expected_output),
  };
}

function normalizePack(pack: LearningPack): LearningPack {
  return {
    ...pack,
    title: asString(pack.title),
    summary: asString(pack.summary),
    sections: Array.isArray(pack.sections)
      ? pack.sections.map(normalizeSection)
      : [],
    difficulty: asString(pack.difficulty),
    flashcards: Array.isArray(pack.flashcards)
      ? pack.flashcards.map(normalizeFlashcard)
      : [],
    study_plan: Array.isArray(pack.study_plan)
      ? pack.study_plan.map(normalizeStudyPlanItem)
      : [],
    key_concepts: Array.isArray(pack.key_concepts)
      ? pack.key_concepts.map(normalizeKeyConcept)
      : [],
    prerequisites: asStringArray(pack.prerequisites),
    source_warnings: asStringArray(pack.source_warnings),
    practical_activity: normalizeActivity(pack.practical_activity),
    learning_objectives: asStringArray(pack.learning_objectives),
    assessment_questions: Array.isArray(pack.assessment_questions)
      ? pack.assessment_questions.map(normalizeQuestion)
      : [],
    extracted_text: "",
    source_summary: asString(pack.source_summary),
  };
}

function formatDateTime(value: string | null | undefined): string {
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

function statusLabel(status: DraftStatus): string {
  switch (status) {
    case "submitted":
      return "Submitted for review";
    case "revision_required":
      return "Revision required";
    case "approved":
      return "Approved";
    case "converted":
      return "Converted";
    case "edited":
      return "Edited";
    default:
      return "Draft";
  }
}

function statusClass(status: DraftStatus): string {
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

function SectionCard({
  section,
  index,
  disabled,
  onChange,
  onRemove,
}: {
  section: Section;
  index: number;
  disabled: boolean;
  onChange: (next: Section) => void;
  onRemove: () => void;
}) {
  const examples = section.examples ?? [];

  return (
    <div className="rn-card" style={{ marginBottom: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <strong>Section {index + 1}</strong>

        {!disabled && (
          <button
            type="button"
            className="rn-button rn-button-secondary"
            onClick={onRemove}
          >
            Remove
          </button>
        )}
      </div>

      <label className="rn-field">
        <span>Heading</span>

        <input
          value={section.heading}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              ...section,
              heading: event.target.value,
            })
          }
        />
      </label>

      <label className="rn-field">
        <span>Content</span>

        <textarea
          value={section.content}
          disabled={disabled}
          rows={6}
          onChange={(event) =>
            onChange({
              ...section,
              content: event.target.value,
            })
          }
        />
      </label>

      <div>
        <strong>Examples</strong>

        {examples.map((example, exampleIndex) => (
          <div
            key={`${index}-${exampleIndex}`}
            style={{
              display: "flex",
              gap: 8,
              alignItems: "flex-start",
              marginTop: 8,
            }}
          >
            <input
              value={example}
              disabled={disabled}
              onChange={(event) => {
                const next = [...examples];
                next[exampleIndex] = event.target.value;

                onChange({
                  ...section,
                  examples: next,
                });
              }}
              style={{ flex: 1 }}
            />

            {!disabled && (
              <button
                type="button"
                className="rn-button rn-button-secondary"
                onClick={() =>
                  onChange({
                    ...section,
                    examples: examples.filter(
                      (_, itemIndex) =>
                        itemIndex !== exampleIndex
                    ),
                  })
                }
              >
                Remove
              </button>
            )}
          </div>
        ))}

        {!disabled && (
          <button
            type="button"
            className="rn-button rn-button-secondary"
            style={{ marginTop: 8 }}
            onClick={() =>
              onChange({
                ...section,
                examples: [...examples, ""],
              })
            }
          >
            Add example
          </button>
        )}
      </div>
    </div>
  );
}

export default function AiDraftEditor({ draft }: Props) {
  const router = useRouter();

  const [title, setTitle] = useState(draft.title);

  const [focusInstruction, setFocusInstruction] = useState(
    draft.focus_instruction ?? ""
  );

  const [pack, setPack] = useState<LearningPack>(() =>
    normalizePack(draft.learning_pack ?? {})
  );

  const [status, setStatus] = useState<DraftStatus>(
    draft.status
  );

  const [sourceUploadedAt, setSourceUploadedAt] =
    useState<string | null>(
      draft.source_uploaded_at ?? draft.created_at
    );

  const [createdAt, setCreatedAt] = useState(
    draft.created_at
  );

  const [updatedAt, setUpdatedAt] = useState(
    draft.updated_at
  );

  const [reviewNote, setReviewNote] = useState(
    draft.review_note ?? ""
  );

  const [reviewedBy, setReviewedBy] = useState(
    draft.reviewed_by ?? ""
  );

  const [reviewedAt, setReviewedAt] = useState<string | null>(
    draft.reviewed_at ?? null
  );

  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const locked =
    status === "submitted" ||
    status === "approved" ||
    status === "converted";

  const outputLabel = useMemo(
    () =>
      draft.output_type
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase()),
    [draft.output_type]
  );

  const languageLabel = useMemo(() => {
    const labels: Record<string, string> = {
      en: "English",
      ha: "Hausa",
      yo: "Yoruba",
      ig: "Igbo",
      sw: "Swahili",
    };

    return labels[draft.language_code] ?? draft.language_code;
  }, [draft.language_code]);

  const audienceLabel = useMemo(
    () =>
      draft.audience
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase()),
    [draft.audience]
  );

  function updatePackField<K extends keyof LearningPack>(
    key: K,
    value: LearningPack[K]
  ) {
    setPack((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function saveDraft() {
    if (locked) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/student/scan/drafts",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: draft.id,
            title,
            focusInstruction,
            learningPack: pack,
            status: "edited",
          }),
        }
      );

      const data = (await response.json().catch(() => null)) as
        | DraftApiResponse
        | null;

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to save the learning material."
        );
      }

      setStatus("edited");

      if (data?.draft?.updated_at) {
        setUpdatedAt(data.draft.updated_at);
      }

      if (data?.draft?.created_at) {
        setCreatedAt(data.draft.created_at);
      }

      if (data?.draft?.source_uploaded_at) {
        setSourceUploadedAt(
          data.draft.source_uploaded_at
        );
      }

      if (data?.draft?.review_note !== undefined) {
        setReviewNote(data.draft.review_note ?? "");
      }

      if (data?.draft?.reviewed_by !== undefined) {
        setReviewedBy(data.draft.reviewed_by ?? "");
      }

      if (data?.draft?.reviewed_at !== undefined) {
        setReviewedAt(data.draft.reviewed_at ?? null);
      }

      setMessage("Learning material saved.");

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save the learning material."
      );
    } finally {
      setSaving(false);
    }
  }

  async function submitForReview() {
    if (locked) return;

    const isResubmission =
      status === "revision_required";

    const confirmed = window.confirm(
      isResubmission
        ? "Resubmit this revised AI-generated learning material for LMS review?"
        : "Submit this AI-generated learning material for LMS review? You will not be able to edit or delete it while it is under review."
    );

    if (!confirmed) return;

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/student/scan/drafts/submit",
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

      const data = (await response.json().catch(() => null)) as
        | DraftApiResponse
        | null;

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to submit the learning material."
        );
      }

      setStatus("submitted");

      if (data?.draft?.updated_at) {
        setUpdatedAt(data.draft.updated_at);
      }

      if (data?.draft?.created_at) {
        setCreatedAt(data.draft.created_at);
      }

      if (data?.draft?.source_uploaded_at) {
        setSourceUploadedAt(
          data.draft.source_uploaded_at
        );
      }

      if (data?.draft?.review_note !== undefined) {
        setReviewNote(data.draft.review_note ?? "");
      }

      if (data?.draft?.reviewed_by !== undefined) {
        setReviewedBy(data.draft.reviewed_by ?? "");
      }

      if (data?.draft?.reviewed_at !== undefined) {
        setReviewedAt(data.draft.reviewed_at ?? null);
      }

      setMessage(
        data?.message ||
          "Draft submitted for LMS review."
      );

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to submit the learning material."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteDraft() {
    if (locked) return;

    const confirmed = window.confirm(
      "Delete this AI learning draft? This action cannot be undone."
    );

    if (!confirmed) return;

    setDeleting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/student/scan/drafts?id=${encodeURIComponent(
          draft.id
        )}`,
        {
          method: "DELETE",
        }
      );

      const data = (await response.json().catch(() => null)) as
        | DraftApiResponse
        | null;

      if (!response.ok) {
        throw new Error(
          data?.error || "Unable to delete the draft."
        );
      }

      router.push("/student/ai-drafts");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete the draft."
      );

      setDeleting(false);
    }
  }

  function updateStringArray(
    key:
      | "prerequisites"
      | "source_warnings"
      | "learning_objectives",
    index: number,
    value: string
  ) {
    const current = [...(pack[key] ?? [])];

    current[index] = value;

    updatePackField(key, current);
  }

  function removeStringArrayItem(
    key:
      | "prerequisites"
      | "source_warnings"
      | "learning_objectives",
    index: number
  ) {
    const current = [...(pack[key] ?? [])];

    updatePackField(
      key,
      current.filter(
        (_, itemIndex) => itemIndex !== index
      )
    );
  }

  return (
    <div className="container">
      <div
        className="rn-card"
        style={{
          marginBottom: 20,
          padding: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "0.8rem",
                opacity: 0.7,
                marginBottom: 4,
              }}
            >
              AI Learning Draft
            </div>

            <h1 style={{ margin: 0 }}>
              {title || "Untitled learning material"}
            </h1>
          </div>

          <span className={statusClass(status)}>
            {statusLabel(status)}
          </span>
        </div>

        <div className="rn-ai-draft-timestamps">
          <div>
            <span>Source uploaded</span>

            <strong>
              {formatDateTime(sourceUploadedAt)}
            </strong>
          </div>

          <div>
            <span>Draft created</span>

            <strong>
              {formatDateTime(createdAt)}
            </strong>
          </div>

          <div>
            <span>Last updated</span>

            <strong>
              {formatDateTime(updatedAt)}
            </strong>
          </div>

          {reviewedAt ? (
            <div>
              <span>Reviewed</span>

              <strong>
                {formatDateTime(reviewedAt)}
              </strong>
            </div>
          ) : null}
        </div>
      </div>

      {status === "revision_required" && (
        <div
          className="rn-card"
          style={{
            marginBottom: 20,
            borderLeft: "4px solid currentColor",
          }}
        >
          <strong>Revision required</strong>

          <p>
            An LMS reviewer has returned this learning
            material for revision. Review the note below,
            make the required changes, save the draft, and
            resubmit it for review.
          </p>

          {reviewNote ? (
            <div
              style={{
                marginTop: 12,
                padding: 14,
                border: "1px solid currentColor",
                borderRadius: 8,
                whiteSpace: "pre-wrap",
              }}
            >
              <strong>Reviewer note</strong>

              <p style={{ marginBottom: 0 }}>
                {reviewNote}
              </p>
            </div>
          ) : (
            <p style={{ marginBottom: 0 }}>
              No additional reviewer note was provided.
            </p>
          )}

          {reviewedAt ? (
            <p style={{ marginTop: 12, marginBottom: 0 }}>
              <strong>Reviewed:</strong>{" "}
              {formatDateTime(reviewedAt)}
            </p>
          ) : null}
        </div>
      )}

      {status === "submitted" && (
        <div
          className="rn-card"
          style={{
            marginBottom: 20,
            borderLeft: "4px solid currentColor",
          }}
        >
          <strong>Submitted for review</strong>

          <p style={{ marginBottom: 0 }}>
            This AI-generated learning material has been
            submitted to the LMS review workflow. You
            cannot edit or delete it while it is under
            review.
          </p>
        </div>
      )}

      {status === "approved" && (
        <div
          className="rn-card"
          style={{
            marginBottom: 20,
            borderLeft: "4px solid currentColor",
          }}
        >
          <strong>Approved</strong>

          <p>
            This learning material has been approved by an
            LMS reviewer and is no longer editable as a
            student draft.
          </p>

          {reviewedAt ? (
            <p>
              <strong>Approved:</strong>{" "}
              {formatDateTime(reviewedAt)}
            </p>
          ) : null}

          {reviewedBy ? (
            <p>
              <strong>Reviewed by:</strong>{" "}
              {reviewedBy}
            </p>
          ) : null}

          {reviewNote ? (
            <div style={{ marginTop: 12 }}>
              <strong>Reviewer note</strong>

              <p
                style={{
                  marginBottom: 0,
                  whiteSpace: "pre-wrap",
                }}
              >
                {reviewNote}
              </p>
            </div>
          ) : null}
        </div>
      )}

      {status === "converted" && (
        <div
          className="rn-card"
          style={{
            marginBottom: 20,
            borderLeft: "4px solid currentColor",
          }}
        >
          <strong>Converted to LMS content</strong>

          <p style={{ marginBottom: 0 }}>
            This learning material has already been
            converted into LMS content and is no longer
            editable as a draft.
          </p>
        </div>
      )}

      {error && (
        <div
          className="rn-card"
          style={{
            marginBottom: 20,
            borderLeft: "4px solid currentColor",
          }}
        >
          {error}
        </div>
      )}

      {message && (
        <div
          className="rn-card"
          style={{
            marginBottom: 20,
            borderLeft: "4px solid currentColor",
          }}
        >
          {message}
        </div>
      )}

      <section style={{ marginBottom: 24 }}>
        <h2 className="rn-section-heading">
          Learning material
        </h2>

        <div className="rn-card">
          <label className="rn-field">
            <span>Title</span>

            <input
              value={title}
              disabled={locked}
              onChange={(event) =>
                setTitle(event.target.value)
              }
            />
          </label>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div>
              <small>Output type</small>

              <div>
                <strong>{outputLabel}</strong>
              </div>
            </div>

            <div>
              <small>Language</small>

              <div>
                <strong>{languageLabel}</strong>
              </div>
            </div>

            <div>
              <small>Audience</small>

              <div>
                <strong>{audienceLabel}</strong>
              </div>
            </div>

            <div>
              <small>Difficulty</small>

              <div>
                <strong>
                  {pack.difficulty || "Not specified"}
                </strong>
              </div>
            </div>
          </div>

          <label className="rn-field">
            <span>Additional instruction</span>

            <textarea
              value={focusInstruction}
              disabled={locked}
              rows={4}
              onChange={(event) =>
                setFocusInstruction(event.target.value)
              }
              placeholder="Optional instruction for this learning material"
            />
          </label>
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 className="rn-section-heading">Overview</h2>

        <div className="rn-card">
          <label className="rn-field">
            <span>Summary</span>

            <textarea
              value={pack.summary ?? ""}
              disabled={locked}
              rows={6}
              onChange={(event) =>
                updatePackField(
                  "summary",
                  event.target.value
                )
              }
            />
          </label>

          <label className="rn-field">
            <span>Estimated duration (minutes)</span>

            <input
              type="number"
              min={1}
              value={
                pack.estimated_duration_minutes ?? ""
              }
              disabled={locked}
              onChange={(event) => {
                const value = event.target.value;

                updatePackField(
                  "estimated_duration_minutes",
                  value === "" ? null : Number(value)
                );
              }}
            />
          </label>
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <h2
            className="rn-section-heading"
            style={{ marginBottom: 0 }}
          >
            Sections
          </h2>

          {!locked && (
            <button
              type="button"
              className="rn-button rn-button-secondary"
              onClick={() =>
                updatePackField("sections", [
                  ...(pack.sections ?? []),
                  {
                    heading: "",
                    content: "",
                    examples: [],
                  },
                ])
              }
            >
              Add section
            </button>
          )}
        </div>

        {(pack.sections ?? []).length === 0 ? (
          <div className="rn-card">
            <p style={{ marginBottom: 0 }}>
              No lesson sections were generated.
            </p>
          </div>
        ) : (
          (pack.sections ?? []).map((section, index) => (
            <SectionCard
              key={index}
              section={section}
              index={index}
              disabled={locked}
              onChange={(next) => {
                const sections = [
                  ...(pack.sections ?? []),
                ];

                sections[index] = next;

                updatePackField(
                  "sections",
                  sections
                );
              }}
              onRemove={() => {
                const sections = [
                  ...(pack.sections ?? []),
                ];

                sections.splice(index, 1);

                updatePackField(
                  "sections",
                  sections
                );
              }}
            />
          ))
        )}
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 className="rn-section-heading">
          Learning objectives
        </h2>

        <div className="rn-card">
          {(pack.learning_objectives ?? []).map(
            (objective, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  gap: 8,
                  marginBottom: 8,
                  alignItems: "flex-start",
                }}
              >
                <input
                  value={objective}
                  disabled={locked}
                  onChange={(event) =>
                    updateStringArray(
                      "learning_objectives",
                      index,
                      event.target.value
                    )
                  }
                  style={{ flex: 1 }}
                />

                {!locked && (
                  <button
                    type="button"
                    className="rn-button rn-button-secondary"
                    onClick={() =>
                      removeStringArrayItem(
                        "learning_objectives",
                        index
                      )
                    }
                  >
                    Remove
                  </button>
                )}
              </div>
            )
          )}

          {!locked && (
            <button
              type="button"
              className="rn-button rn-button-secondary"
              onClick={() =>
                updatePackField(
                  "learning_objectives",
                  [
                    ...(pack.learning_objectives ?? []),
                    "",
                  ]
                )
              }
            >
              Add objective
            </button>
          )}
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 className="rn-section-heading">
          Key concepts
        </h2>

        <div className="rn-card">
          {(pack.key_concepts ?? []).map(
            (concept, index) => (
              <div
                key={index}
                style={{
                  borderBottom:
                    "1px solid currentColor",
                  paddingBottom: 16,
                  marginBottom: 16,
                  opacity: 0.9,
                }}
              >
                <label className="rn-field">
                  <span>Term</span>

                  <input
                    value={concept.term}
                    disabled={locked}
                    onChange={(event) => {
                      const concepts = [
                        ...(pack.key_concepts ?? []),
                      ];

                      concepts[index] = {
                        ...concept,
                        term: event.target.value,
                      };

                      updatePackField(
                        "key_concepts",
                        concepts
                      );
                    }}
                  />
                </label>

                <label className="rn-field">
                  <span>Explanation</span>

                  <textarea
                    value={concept.explanation}
                    disabled={locked}
                    rows={4}
                    onChange={(event) => {
                      const concepts = [
                        ...(pack.key_concepts ?? []),
                      ];

                      concepts[index] = {
                        ...concept,
                        explanation:
                          event.target.value,
                      };

                      updatePackField(
                        "key_concepts",
                        concepts
                      );
                    }}
                  />
                </label>

                {!locked && (
                  <button
                    type="button"
                    className="rn-button rn-button-secondary"
                    onClick={() =>
                      updatePackField(
                        "key_concepts",
                        (
                          pack.key_concepts ?? []
                        ).filter(
                          (_, itemIndex) =>
                            itemIndex !== index
                        )
                      )
                    }
                  >
                    Remove concept
                  </button>
                )}
              </div>
            )
          )}

          {!locked && (
            <button
              type="button"
              className="rn-button rn-button-secondary"
              onClick={() =>
                updatePackField("key_concepts", [
                  ...(pack.key_concepts ?? []),
                  {
                    term: "",
                    explanation: "",
                  },
                ])
              }
            >
              Add concept
            </button>
          )}
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 className="rn-section-heading">
          Prerequisites
        </h2>

        <div className="rn-card">
          {(pack.prerequisites ?? []).map(
            (item, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <input
                  value={item}
                  disabled={locked}
                  onChange={(event) =>
                    updateStringArray(
                      "prerequisites",
                      index,
                      event.target.value
                    )
                  }
                  style={{ flex: 1 }}
                />

                {!locked && (
                  <button
                    type="button"
                    className="rn-button rn-button-secondary"
                    onClick={() =>
                      removeStringArrayItem(
                        "prerequisites",
                        index
                      )
                    }
                  >
                    Remove
                  </button>
                )}
              </div>
            )
          )}

          {!locked && (
            <button
              type="button"
              className="rn-button rn-button-secondary"
              onClick={() =>
                updatePackField("prerequisites", [
                  ...(pack.prerequisites ?? []),
                  "",
                ])
              }
            >
              Add prerequisite
            </button>
          )}
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 className="rn-section-heading">
          Study plan
        </h2>

        <div className="rn-card">
          {(pack.study_plan ?? []).map(
            (item, index) => (
              <div
                key={index}
                style={{
                  borderBottom:
                    "1px solid currentColor",
                  paddingBottom: 16,
                  marginBottom: 16,
                }}
              >
                <label className="rn-field">
                  <span>Step</span>

                  <input
                    value={item.step}
                    disabled={locked}
                    onChange={(event) => {
                      const plan = [
                        ...(pack.study_plan ?? []),
                      ];

                      plan[index] = {
                        ...item,
                        step: event.target.value,
                      };

                      updatePackField(
                        "study_plan",
                        plan
                      );
                    }}
                  />
                </label>

                <label className="rn-field">
                  <span>Action</span>

                  <textarea
                    value={item.action}
                    disabled={locked}
                    rows={3}
                    onChange={(event) => {
                      const plan = [
                        ...(pack.study_plan ?? []),
                      ];

                      plan[index] = {
                        ...item,
                        action: event.target.value,
                      };

                      updatePackField(
                        "study_plan",
                        plan
                      );
                    }}
                  />
                </label>

                {!locked && (
                  <button
                    type="button"
                    className="rn-button rn-button-secondary"
                    onClick={() =>
                      updatePackField(
                        "study_plan",
                        (
                          pack.study_plan ?? []
                        ).filter(
                          (_, itemIndex) =>
                            itemIndex !== index
                        )
                      )
                    }
                  >
                    Remove step
                  </button>
                )}
              </div>
            )
          )}

          {!locked && (
            <button
              type="button"
              className="rn-button rn-button-secondary"
              onClick={() =>
                updatePackField("study_plan", [
                  ...(pack.study_plan ?? []),
                  {
                    step: "",
                    action: "",
                  },
                ])
              }
            >
              Add study step
            </button>
          )}
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 className="rn-section-heading">
          Flashcards
        </h2>

        <div className="rn-card">
          {(pack.flashcards ?? []).map(
            (card, index) => (
              <div
                key={index}
                style={{
                  borderBottom:
                    "1px solid currentColor",
                  paddingBottom: 16,
                  marginBottom: 16,
                }}
              >
                <label className="rn-field">
                  <span>Question / Front</span>

                  <textarea
                    value={card.front}
                    disabled={locked}
                    rows={3}
                    onChange={(event) => {
                      const cards = [
                        ...(pack.flashcards ?? []),
                      ];

                      cards[index] = {
                        ...card,
                        front: event.target.value,
                      };

                      updatePackField(
                        "flashcards",
                        cards
                      );
                    }}
                  />
                </label>

                <label className="rn-field">
                  <span>Answer / Back</span>

                  <textarea
                    value={card.back}
                    disabled={locked}
                    rows={3}
                    onChange={(event) => {
                      const cards = [
                        ...(pack.flashcards ?? []),
                      ];

                      cards[index] = {
                        ...card,
                        back: event.target.value,
                      };

                      updatePackField(
                        "flashcards",
                        cards
                      );
                    }}
                  />
                </label>

                {!locked && (
                  <button
                    type="button"
                    className="rn-button rn-button-secondary"
                    onClick={() =>
                      updatePackField(
                        "flashcards",
                        (
                          pack.flashcards ?? []
                        ).filter(
                          (_, itemIndex) =>
                            itemIndex !== index
                        )
                      )
                    }
                  >
                    Remove flashcard
                  </button>
                )}
              </div>
            )
          )}

          {!locked && (
            <button
              type="button"
              className="rn-button rn-button-secondary"
              onClick={() =>
                updatePackField("flashcards", [
                  ...(pack.flashcards ?? []),
                  {
                    front: "",
                    back: "",
                  },
                ])
              }
            >
              Add flashcard
            </button>
          )}
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 className="rn-section-heading">
          Practical activity
        </h2>

        <div className="rn-card">
          <label className="rn-field">
            <span>Activity title</span>

            <input
              value={
                pack.practical_activity?.title ?? ""
              }
              disabled={locked}
              onChange={(event) =>
                updatePackField(
                  "practical_activity",
                  {
                    ...(pack.practical_activity ?? {}),
                    title: event.target.value,
                  }
                )
              }
            />
          </label>

          <label className="rn-field">
            <span>Instructions</span>

            <textarea
              value={
                pack.practical_activity
                  ?.instructions ?? ""
              }
              disabled={locked}
              rows={6}
              onChange={(event) =>
                updatePackField(
                  "practical_activity",
                  {
                    ...(pack.practical_activity ?? {}),
                    instructions:
                      event.target.value,
                  }
                )
              }
            />
          </label>

          <label className="rn-field">
            <span>Expected output</span>

            <textarea
              value={
                pack.practical_activity
                  ?.expected_output ?? ""
              }
              disabled={locked}
              rows={4}
              onChange={(event) =>
                updatePackField(
                  "practical_activity",
                  {
                    ...(pack.practical_activity ?? {}),
                    expected_output:
                      event.target.value,
                  }
                )
              }
            />
          </label>
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 className="rn-section-heading">
          Assessment questions
        </h2>

        <div className="rn-card">
          {(pack.assessment_questions ?? []).map(
            (item, index) => (
              <div
                key={index}
                style={{
                  borderBottom:
                    "1px solid currentColor",
                  paddingBottom: 20,
                  marginBottom: 20,
                }}
              >
                <label className="rn-field">
                  <span>
                    Question {index + 1}
                  </span>

                  <textarea
                    value={item.question}
                    disabled={locked}
                    rows={4}
                    onChange={(event) => {
                      const questions = [
                        ...(pack.assessment_questions ??
                          []),
                      ];

                      questions[index] = {
                        ...item,
                        question:
                          event.target.value,
                      };

                      updatePackField(
                        "assessment_questions",
                        questions
                      );
                    }}
                  />
                </label>

                <div style={{ marginBottom: 16 }}>
                  <strong>Options</strong>

                  {(item.options ?? []).map(
                    (option, optionIndex) => (
                      <div
                        key={optionIndex}
                        style={{
                          display: "flex",
                          gap: 8,
                          marginTop: 8,
                        }}
                      >
                        <input
                          value={option}
                          disabled={locked}
                          onChange={(event) => {
                            const questions = [
                              ...(pack.assessment_questions ??
                                []),
                            ];

                            const options = [
                              ...(item.options ?? []),
                            ];

                            options[optionIndex] =
                              event.target.value;

                            questions[index] = {
                              ...item,
                              options,
                            };

                            updatePackField(
                              "assessment_questions",
                              questions
                            );
                          }}
                          style={{ flex: 1 }}
                        />

                        {!locked && (
                          <button
                            type="button"
                            className="rn-button rn-button-secondary"
                            onClick={() => {
                              const questions = [
                                ...(pack.assessment_questions ??
                                  []),
                              ];

                              questions[index] = {
                                ...item,
                                options: (
                                  item.options ?? []
                                ).filter(
                                  (_, itemIndex) =>
                                    itemIndex !==
                                    optionIndex
                                ),
                              };

                              updatePackField(
                                "assessment_questions",
                                questions
                              );
                            }}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    )
                  )}

                  {!locked && (
                    <button
                      type="button"
                      className="rn-button rn-button-secondary"
                      style={{ marginTop: 8 }}
                      onClick={() => {
                        const questions = [
                          ...(pack.assessment_questions ??
                            []),
                        ];

                        questions[index] = {
                          ...item,
                          options: [
                            ...(item.options ?? []),
                            "",
                          ],
                        };

                        updatePackField(
                          "assessment_questions",
                          questions
                        );
                      }}
                    >
                      Add option
                    </button>
                  )}
                </div>

                <label className="rn-field">
                  <span>Correct answer</span>

                  <input
                    value={
                      item.correct_answer ?? ""
                    }
                    disabled={locked}
                    onChange={(event) => {
                      const questions = [
                        ...(pack.assessment_questions ??
                          []),
                      ];

                      questions[index] = {
                        ...item,
                        correct_answer:
                          event.target.value,
                      };

                      updatePackField(
                        "assessment_questions",
                        questions
                      );
                    }}
                  />
                </label>

                <label className="rn-field">
                  <span>Explanation</span>

                  <textarea
                    value={
                      item.explanation ?? ""
                    }
                    disabled={locked}
                    rows={4}
                    onChange={(event) => {
                      const questions = [
                        ...(pack.assessment_questions ??
                          []),
                      ];

                      questions[index] = {
                        ...item,
                        explanation:
                          event.target.value,
                      };

                      updatePackField(
                        "assessment_questions",
                        questions
                      );
                    }}
                  />
                </label>

                {!locked && (
                  <button
                    type="button"
                    className="rn-button rn-button-secondary"
                    onClick={() =>
                      updatePackField(
                        "assessment_questions",
                        (
                          pack.assessment_questions ??
                          []
                        ).filter(
                          (_, itemIndex) =>
                            itemIndex !== index
                        )
                      )
                    }
                  >
                    Remove question
                  </button>
                )}
              </div>
            )
          )}

          {!locked && (
            <button
              type="button"
              className="rn-button rn-button-secondary"
              onClick={() =>
                updatePackField(
                  "assessment_questions",
                  [
                    ...(pack.assessment_questions ?? []),
                    {
                      question: "",
                      options: [],
                      correct_answer: "",
                      explanation: "",
                    },
                  ]
                )
              }
            >
              Add question
            </button>
          )}
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 className="rn-section-heading">
          Source warnings
        </h2>

        <div className="rn-card">
          {(pack.source_warnings ?? []).map(
            (warning, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <textarea
                  value={warning}
                  disabled={locked}
                  rows={3}
                  onChange={(event) =>
                    updateStringArray(
                      "source_warnings",
                      index,
                      event.target.value
                    )
                  }
                  style={{ flex: 1 }}
                />

                {!locked && (
                  <button
                    type="button"
                    className="rn-button rn-button-secondary"
                    onClick={() =>
                      removeStringArrayItem(
                        "source_warnings",
                        index
                      )
                    }
                  >
                    Remove
                  </button>
                )}
              </div>
            )
          )}

          {!locked && (
            <button
              type="button"
              className="rn-button rn-button-secondary"
              onClick={() =>
                updatePackField(
                  "source_warnings",
                  [
                    ...(pack.source_warnings ?? []),
                    "",
                  ]
                )
              }
            >
              Add warning
            </button>
          )}
        </div>
      </section>

      {pack.source_summary || pack.extracted_text ? (
        <section style={{ marginBottom: 24 }}>
          <h2 className="rn-section-heading">
            Source information
          </h2>

          <div className="rn-card">
            {pack.source_summary ? (
              <>
                <strong>Source summary</strong>

                <p
                  style={{
                    whiteSpace: "pre-wrap",
                    marginBottom: 0,
                  }}
                >
                  {pack.source_summary}
                </p>
              </>
            ) : null}

            {pack.extracted_text ? (
              <div
                style={{
                  marginTop: pack.source_summary ? 16 : 0,
                }}
              >
                <strong>Extracted source text</strong>

                <p
                  style={{
                    marginBottom: 0,
                    fontSize: "0.9rem",
                    opacity: 0.8,
                  }}
                >
                  Original extracted source text is not
                  displayed here. Privacy screening removes
                  sensitive source information before learning
                  material is stored and reviewed.
                </p>
              </div>
            ) : (
              <p
                style={{
                  marginTop: 16,
                  marginBottom: 0,
                  fontSize: "0.9rem",
                  opacity: 0.8,
                }}
              >
                Original extracted source text is not
                displayed here. Privacy screening removes
                sensitive source information before learning
                material is stored and reviewed.
              </p>
            )}
          </div>
        </section>
      ) : null}

      {!locked && (
        <div
          className="rn-card"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 32,
          }}
        >
          <button
            type="button"
            className="rn-button rn-button-primary"
            disabled={
              saving || submitting || deleting
            }
            onClick={saveDraft}
          >
            {saving ? "Saving..." : "Save changes"}
          </button>

          <button
            type="button"
            className="rn-button rn-button-primary"
            disabled={
              saving || submitting || deleting
            }
            onClick={submitForReview}
          >
            {submitting
              ? "Submitting..."
              : status === "revision_required"
                ? "Resubmit for LMS Review"
                : "Submit for LMS Review"}
          </button>

          <button
            type="button"
            className="rn-button rn-button-secondary"
            disabled={
              saving || submitting || deleting
            }
            onClick={() =>
              router.push("/student/scan")
            }
          >
            Create another
          </button>

          <button
            type="button"
            className="rn-button rn-button-secondary"
            disabled={
              saving || submitting || deleting
            }
            onClick={deleteDraft}
          >
            {deleting
              ? "Deleting..."
              : "Delete draft"}
          </button>
        </div>
      )}
    </div>
  );
}