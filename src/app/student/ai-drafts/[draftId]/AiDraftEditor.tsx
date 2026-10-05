"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Draft = {
  id: string;
  title: string;
  output_type: string;
  language_code: string;
  audience: string;
  focus_instruction: string | null;
  learning_pack: Record<string, unknown>;
  status: "draft" | "edited" | "submitted" | "converted";
  created_at: string;
  updated_at: string;
};

type Props = {
  draft: Draft;
};

function formatValue(value: unknown): string {
  if (typeof value === "string") return value;

  return JSON.stringify(value, null, 2);
}

export default function AiDraftEditor({ draft }: Props) {
  const router = useRouter();

  const [title, setTitle] = useState(draft.title);
  const [focus, setFocus] = useState(
    draft.focus_instruction ?? ""
  );

  const [packJson, setPackJson] = useState(
    JSON.stringify(draft.learning_pack, null, 2)
  );

  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isLocked =
    draft.status === "submitted" ||
    draft.status === "converted";

  async function saveDraft() {
    setSaving(true);
    setMessage("");
    setError("");

    let learningPack: unknown;

    try {
      learningPack = JSON.parse(packJson);
    } catch {
      setSaving(false);
      setError("The learning pack JSON is not valid.");
      return;
    }

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
            focusInstruction: focus,
            learningPack,
            status: "edited",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ?? "Unable to save the draft."
        );
      }

      setMessage("Draft saved.");

      if (data?.draft?.learning_pack) {
        setPackJson(
          JSON.stringify(
            data.draft.learning_pack,
            null,
            2
          )
        );
      }

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save the draft."
      );
    } finally {
      setSaving(false);
    }
  }

  async function submitForReview() {
    const confirmed = window.confirm(
      "Submit this draft for LMS review? You will no longer be able to edit or delete it unless an instructor or administrator returns it for revision."
    );

    if (!confirmed) return;

    setSubmitting(true);
    setMessage("");
    setError("");

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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ??
            "Unable to submit the draft for review."
        );
      }

      setMessage(
        "Draft submitted for LMS review."
      );

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to submit the draft for review."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteDraft() {
    const confirmed = window.confirm(
      "Delete this AI draft? This action cannot be undone."
    );

    if (!confirmed) return;

    setDeleting(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        `/api/student/scan/drafts?id=${encodeURIComponent(
          draft.id
        )}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ?? "Unable to delete the draft."
        );
      }

      router.push("/student/ai-drafts");
      router.refresh();
    } catch (err) {
      setDeleting(false);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete the draft."
      );
    }
  }

  return (
    <div className="rn-profile-grid">
      <section className="rn-profile-panel">
        <div className="rn-section-heading">
          <div>
            <h2>Draft information</h2>

            <p>
              {isLocked
                ? "This draft is currently locked."
                : "Edit the basic information before submitting it for review."}
            </p>
          </div>
        </div>

        <div className="rn-form-grid">
          <label className="rn-field">
            <span>Title</span>

            <input
              type="text"
              value={title}
              onChange={(event) =>
                setTitle(event.target.value)
              }
              maxLength={300}
              disabled={isLocked}
            />
          </label>

          <label className="rn-field">
            <span>Additional instruction</span>

            <textarea
              value={focus}
              onChange={(event) =>
                setFocus(event.target.value)
              }
              rows={5}
              maxLength={1500}
              placeholder="Optional focus or instruction."
              disabled={isLocked}
            />
          </label>
        </div>

        <div className="rn-course-card-meta">
          <span className="rn-badge">
            {draft.output_type}
          </span>

          <span className="rn-badge">
            {draft.language_code}
          </span>

          <span className="rn-badge">
            {draft.audience}
          </span>

          <span className="rn-badge">
            {draft.status}
          </span>
        </div>
      </section>

      <section className="rn-profile-panel">
        <div className="rn-section-heading">
          <div>
            <h2>Learning Pack</h2>

            <p>
              Review the generated material before
              submitting it for LMS review.
            </p>
          </div>
        </div>

        <label className="rn-field">
          <span>Learning pack data</span>

          <textarea
            value={packJson}
            onChange={(event) =>
              setPackJson(event.target.value)
            }
            rows={30}
            spellCheck={false}
            disabled={isLocked}
            style={{
              width: "100%",
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: "0.875rem",
              lineHeight: 1.5,
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
        </label>

        {!isLocked && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              alignItems: "center",
              marginTop: "16px",
            }}
          >
            <button
              type="button"
              className="btn btn-primary"
              onClick={saveDraft}
              disabled={saving || submitting || deleting}
            >
              {saving ? "Saving..." : "Save changes"}
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={submitForReview}
              disabled={saving || submitting || deleting}
            >
              {submitting
                ? "Submitting..."
                : "Submit for LMS Review"}
            </button>

            <Link
              href="/student/scan"
              className="btn btn-ghost"
            >
              Create another
            </Link>
          </div>
        )}

        {!isLocked && (
          <div
            style={{
              marginTop: "24px",
              paddingTop: "20px",
              borderTop:
                "1px solid var(--border, #ddd)",
            }}
          >
            <button
              type="button"
              className="btn btn-ghost"
              onClick={deleteDraft}
              disabled={saving || submitting || deleting}
              style={{
                border: "1px solid #c62828",
                color: "#c62828",
              }}
            >
              {deleting
                ? "Deleting..."
                : "Delete draft"}
            </button>
          </div>
        )}

        {draft.status === "submitted" && (
          <div
            className="rn-card"
            style={{ marginTop: "20px" }}
          >
            <h3>Submitted for review</h3>

            <p>
              This AI-generated learning material has
              been submitted to the LMS review workflow.
              You cannot edit or delete it while it is
              under review.
            </p>
          </div>
        )}

        {draft.status === "converted" && (
          <div
            className="rn-card"
            style={{ marginTop: "20px" }}
          >
            <h3>Converted to LMS content</h3>

            <p>
              This draft has already been converted into
              LMS content.
            </p>
          </div>
        )}

        {message && (
          <p
            className="rn-form-success"
            role="status"
            style={{ marginTop: "14px" }}
          >
            {message}
          </p>
        )}

        {error && (
          <p
            className="rn-form-error"
            role="alert"
            style={{ marginTop: "14px" }}
          >
            {error}
          </p>
        )}
      </section>

      <section className="rn-profile-panel">
        <div className="rn-section-heading">
          <div>
            <h2>Generated preview</h2>

            <p>
              A readable preview of the generated learning
              material.
            </p>
          </div>
        </div>

        <div className="rn-learning-preview">
          {Object.entries(draft.learning_pack).map(
            ([key, value]) => (
              <article
                key={key}
                className="rn-card"
              >
                <h3>
                  {key
                    .replace(/_/g, " ")
                    .replace(
                      /\b\w/g,
                      (letter) =>
                        letter.toUpperCase()
                    )}
                </h3>

                <pre
                  style={{
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                    margin: 0,
                    fontFamily: "inherit",
                  }}
                >
                  {formatValue(value)}
                </pre>
              </article>
            )
          )}
        </div>
      </section>
    </div>
  );
}