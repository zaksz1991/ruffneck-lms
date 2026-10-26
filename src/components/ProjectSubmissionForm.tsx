"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Status =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_required";

type SaveAction = "draft" | "submitted";

type ApiResult = {
  error?: string;
  message?: string;
};

const FORM_STYLES = `
  .rn-project-submission-card {
    --ps-navy: #0b1e3a;
    --ps-blue: #1264a3;
    --ps-cyan: #00b4d8;
    --ps-ink: #24334a;
    --ps-muted: #64748b;
    --ps-border: #e2e8f0;

    min-width: 0;
    padding: 24px;
    border: 1px solid var(--ps-border);
    border-radius: 13px;
    background: #fff;
    box-shadow: 0 4px 16px rgba(11, 30, 58, .04);
  }

  .rn-project-submission-card *,
  .rn-project-submission-card *::before,
  .rn-project-submission-card *::after {
    box-sizing: border-box;
  }

  .rn-project-submission-card .rn-ps-eyebrow {
    display: block;
    margin: 0 0 9px;
    color: #087e9b;
    font-size: 10px;
    font-weight: 850;
    letter-spacing: 1.4px;
    line-height: 1.65;
  }

  .rn-project-submission-card h2 {
    margin: 0;
    color: var(--ps-navy);
    font-size: 22px;
    font-weight: 850;
    letter-spacing: -.45px;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }

  .rn-project-submission-card .rn-ps-intro {
    margin: 11px 0 21px;
    color: var(--ps-muted);
    font-size: 12px;
    line-height: 1.85;
  }

  .rn-project-submission-card .rn-ps-status {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px;
    margin-bottom: 18px;
    border: 1px solid #dce8f5;
    border-radius: 9px;
    background: #f5f9fe;
    color: #315574;
    font-size: 11px;
    line-height: 1.75;
  }

  .rn-project-submission-card .rn-ps-status-mark {
    display: inline-flex;
    width: 23px;
    height: 23px;
    flex: 0 0 23px;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: #e1effb;
    color: #1264a3;
    font-size: 12px;
    font-weight: 900;
  }

  .rn-project-submission-card .rn-ps-field {
    display: block;
    min-width: 0;
    margin-bottom: 19px;
  }

  .rn-project-submission-card .rn-ps-field-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 9px;
    margin-bottom: 8px;
    color: #34465e;
    font-size: 12px;
    font-weight: 800;
    line-height: 1.7;
  }

  .rn-project-submission-card .rn-ps-field-label small {
    color: #8491a3;
    font-size: 10px;
    font-weight: 650;
  }

  .rn-project-submission-card .rn-ps-textarea,
  .rn-project-submission-card .rn-ps-input {
    display: block;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    border: 1px solid #cbd7e5;
    border-radius: 9px;
    background: #fff;
    color: var(--ps-ink);
    font-family: inherit;
    font-size: 13px;
    line-height: 1.8;
    transition: border-color .18s ease, box-shadow .18s ease;
  }

  .rn-project-submission-card .rn-ps-textarea {
    min-height: 210px;
    padding: 13px;
    resize: vertical;
  }

  .rn-project-submission-card .rn-ps-input {
    min-height: 46px;
    padding: 11px 12px;
  }

  .rn-project-submission-card .rn-ps-textarea::placeholder,
  .rn-project-submission-card .rn-ps-input::placeholder {
    color: #98a5b5;
    opacity: 1;
  }

  .rn-project-submission-card .rn-ps-textarea:focus,
  .rn-project-submission-card .rn-ps-input:focus {
    border-color: var(--ps-blue);
    outline: none;
    box-shadow: 0 0 0 3px rgba(18, 100, 163, .11);
  }

  .rn-project-submission-card .rn-ps-textarea:disabled,
  .rn-project-submission-card .rn-ps-input:disabled {
    background: #f5f7fa;
    color: #7d8998;
    cursor: wait;
  }

  .rn-project-submission-card .rn-ps-field-help {
    display: block;
    margin-top: 7px;
    color: #748398;
    font-size: 11px;
    line-height: 1.75;
    overflow-wrap: anywhere;
  }

  .rn-project-submission-card .rn-project-form-help {
    padding: 13px;
    margin: 0 0 17px;
    border: 1px solid #dce8f5;
    border-radius: 9px;
    background: #f5f9fe;
    color: #526981;
    font-size: 11px;
    line-height: 1.8;
  }

  .rn-project-submission-card .rn-ps-feedback {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 13px;
    margin: 0 0 15px;
    border: 1px solid transparent;
    border-radius: 9px;
    font-size: 12px;
    line-height: 1.8;
    overflow-wrap: anywhere;
  }

  .rn-project-submission-card .rn-ps-feedback-mark {
    display: inline-flex;
    width: 22px;
    height: 22px;
    flex: 0 0 22px;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-size: 12px;
    font-weight: 900;
  }

  .rn-project-submission-card .rn-ps-feedback-error {
    border-color: #f0c5c8;
    background: #fff3f4;
    color: #9f2734;
  }

  .rn-project-submission-card .rn-ps-feedback-error .rn-ps-feedback-mark {
    background: #f9dfe2;
    color: #a32635;
  }

  .rn-project-submission-card .rn-ps-feedback-success {
    border-color: #bee8ce;
    background: #f0fbf4;
    color: #176b40;
  }

  .rn-project-submission-card .rn-ps-feedback-success .rn-ps-feedback-mark {
    background: #d9f5e4;
    color: #167647;
  }

  .rn-project-submission-card .rn-ps-feedback-info {
    border-color: #dce8f5;
    background: #f5f9fe;
    color: #315574;
  }

  .rn-project-submission-card .rn-ps-feedback-info .rn-ps-feedback-mark {
    background: #e1effb;
    color: #1264a3;
  }

  .rn-project-submission-card .rn-project-submission-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 20px;
  }

  .rn-project-submission-card .rn-ps-button {
    display: inline-flex;
    width: 100%;
    min-height: 45px;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 11px 15px;
    border: 1px solid #d5e0ec;
    border-radius: 9px;
    background: #fff;
    color: #263b55;
    font-family: inherit;
    font-size: 12px;
    font-weight: 850;
    line-height: 1.6;
    text-align: center;
    cursor: pointer;
    transition: border-color .18s ease, background .18s ease, box-shadow .18s ease;
  }

  .rn-project-submission-card .rn-ps-button:hover:not(:disabled) {
    border-color: #9fc6e6;
    box-shadow: 0 3px 10px rgba(11, 30, 58, .06);
  }

  .rn-project-submission-card .rn-ps-button-primary {
    border-color: var(--ps-navy);
    background: var(--ps-navy);
    color: #fff;
  }

  .rn-project-submission-card .rn-ps-button-primary:hover:not(:disabled) {
    border-color: #174b77;
    background: #174b77;
    color: #fff;
  }

  .rn-project-submission-card .rn-ps-button:disabled {
    opacity: .65;
    cursor: wait;
    box-shadow: none;
  }

  .rn-project-submission-card .rn-ps-button:focus-visible {
    outline: 3px solid rgba(0, 180, 216, .35);
    outline-offset: 3px;
  }

  .rn-project-submission-card .rn-ps-security-note {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-top: 16px;
    color: #7b899b;
    font-size: 10px;
    line-height: 1.8;
  }

  .rn-project-submission-card .rn-ps-security-note strong {
    color: #52647a;
  }

  @media (max-width: 480px) {
    .rn-project-submission-card {
      padding: 19px 15px;
      border-radius: 11px;
    }

    .rn-project-submission-card h2 {
      font-size: 20px;
    }

    .rn-project-submission-card .rn-ps-textarea {
      min-height: 180px;
      font-size: 13px;
    }

    .rn-project-submission-card .rn-ps-input {
      font-size: 16px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .rn-project-submission-card *,
    .rn-project-submission-card *::before,
    .rn-project-submission-card *::after {
      transition-duration: .01ms !important;
    }
  }
`;

function validateUrl(value: string): string | null {
  const trimmedUrl = value.trim();

  if (!trimmedUrl) {
    return null;
  }

  try {
    const parsedUrl = new URL(trimmedUrl);

    if (
      parsedUrl.protocol !== "https:" &&
      parsedUrl.protocol !== "http:"
    ) {
      return "Your supporting link must start with http:// or https://.";
    }

    if (!parsedUrl.hostname || !parsedUrl.hostname.includes(".")) {
      return "Enter a complete project URL, including its domain.";
    }

    return null;
  } catch {
    return "Enter a valid supporting project URL, such as https://example.com.";
  }
}

function getApiMessage(value: unknown): ApiResult {
  if (!value || typeof value !== "object") {
    return {};
  }

  const candidate = value as Record<string, unknown>;

  return {
    error:
      typeof candidate.error === "string"
        ? candidate.error
        : undefined,
    message:
      typeof candidate.message === "string"
        ? candidate.message
        : undefined,
  };
}

export default function ProjectSubmissionForm({
  projectId,
  initialText,
  initialUrl,
  initialStatus,
}: {
  projectId: string;
  initialText: string;
  initialUrl: string;
  initialStatus: Status;
}) {
  const router = useRouter();
  const busyRef = useRef(false);

  const [text, setText] = useState(initialText);
  const [url, setUrl] = useState(initialUrl);
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<SaveAction | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isRevision = initialStatus === "revision_required";

  function validateSubmission(
    status: SaveAction,
  ): string | null {
    const trimmedText = text.trim();
    const trimmedUrl = url.trim();

    if (
      status === "submitted" &&
      trimmedText.length === 0 &&
      trimmedUrl.length === 0
    ) {
      return "Add your written work, a supporting project link, or both before submitting.";
    }

    const urlError = validateUrl(trimmedUrl);

    if (urlError) {
      return urlError;
    }

    if (trimmedText.length > 100000) {
      return "Your written submission is too long. Reduce it and try again.";
    }

    if (trimmedUrl.length > 2048) {
      return "The supporting URL is too long. Use a shorter direct project link.";
    }

    return null;
  }

  async function save(status: SaveAction) {
    if (busyRef.current) {
      return;
    }

    setError(null);
    setMessage(null);

    const validationError = validateSubmission(status);

    if (validationError) {
      setError(validationError);
      return;
    }

    busyRef.current = true;
    setLoading(true);
    setActiveAction(status);

    try {
      const response = await fetch(
        `/api/student/projects/${encodeURIComponent(projectId)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            submissionText: text.trim(),
            submissionUrl: url.trim(),
            status,
          }),
        },
      );

      let result: ApiResult = {};

      try {
        result = getApiMessage(await response.json());
      } catch {
        // The API may return no JSON body.
      }

      if (!response.ok) {
        throw new Error(
          result.error ||
            (response.status === 401
              ? "Your session may have expired. Sign in again and retry."
              : response.status === 403
                ? "You are not permitted to submit this project."
                : response.status === 404
                  ? "This project could not be found or is no longer available."
                  : response.status === 413
                    ? "Your submission is too large. Reduce it and try again."
                    : "Unable to save your submission. Please try again."),
        );
      }

      if (status === "submitted") {
        setMessage(
          result.message ||
            (isRevision
              ? "Your revised project has been submitted for review."
              : "Your project has been submitted for review."),
        );

        router.refresh();
        return;
      }

      setMessage(result.message || "Draft saved successfully.");

      // Refresh the server-rendered record so a newly created draft is
      // reflected in the page without changing the API or database schema.
      router.refresh();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to save your submission. Please try again.",
      );
    } finally {
      busyRef.current = false;
      setLoading(false);
      setActiveAction(null);
    }
  }

  return (
    <section
      className="rn-project-submission-card"
      aria-labelledby="rn-project-submission-heading"
    >
      <style>{FORM_STYLES}</style>

      <span className="rn-ps-eyebrow">
        {isRevision ? "REVISE YOUR WORK" : "YOUR SUBMISSION"}
      </span>

      <h2 id="rn-project-submission-heading">
        {isRevision ? "Update and resubmit" : "Prepare your project"}
      </h2>

      <p className="rn-ps-intro">
        {isRevision
          ? "Address the assessor's feedback, update your evidence and resubmit your work for review."
          : "Describe your completed work and provide a link to supporting material where applicable."}
      </p>

      <div className="rn-ps-status">
        <span className="rn-ps-status-mark" aria-hidden="true">
          i
        </span>

        <span>
          You can save incomplete work as a draft. Submitting sends your work
          for review and may lock editing until the reviewer requests changes.
        </span>
      </div>

      <label className="rn-ps-field">
        <span className="rn-ps-field-label">
          <span>Written submission</span>
          <small>Optional for drafts</small>
        </span>

        <textarea
          className="rn-ps-textarea"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setError(null);
            setMessage(null);
          }}
          placeholder="Explain your approach, work completed, findings, decisions and final result."
          rows={10}
          disabled={loading}
          aria-label="Written project submission"
          aria-invalid={Boolean(error)}
          autoComplete="off"
        />

        <span className="rn-ps-field-help">
          Include enough detail for the reviewer to understand your process,
          decisions and outcome.
        </span>
      </label>

      <label className="rn-ps-field">
        <span className="rn-ps-field-label">
          <span>Supporting document or project link</span>
          <small>Optional for drafts</small>
        </span>

        <input
          className="rn-ps-input"
          type="url"
          inputMode="url"
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            setError(null);
            setMessage(null);
          }}
          placeholder="https://example.com/your-project"
          disabled={loading}
          aria-label="Supporting project URL"
          aria-invalid={Boolean(error)}
          autoComplete="url"
          maxLength={2048}
        />

        <span className="rn-ps-field-help">
          Use a link that your reviewer can open, with the appropriate sharing
          permissions enabled.
        </span>
      </label>

      <p className="rn-project-form-help">
        <strong>Before submitting:</strong> check that your written work and
        supporting link are ready for review. You can submit either one or both.
      </p>

      {error ? (
        <div
          className="rn-ps-feedback rn-ps-feedback-error"
          role="alert"
          aria-live="assertive"
        >
          <span className="rn-ps-feedback-mark" aria-hidden="true">
            !
          </span>

          <span>{error}</span>
        </div>
      ) : null}

      {message ? (
        <div
          className="rn-ps-feedback rn-ps-feedback-success"
          role="status"
          aria-live="polite"
        >
          <span className="rn-ps-feedback-mark" aria-hidden="true">
            ✓
          </span>

          <span>{message}</span>
        </div>
      ) : null}

      <div className="rn-project-submission-actions">
        <button
          type="button"
          className="rn-ps-button"
          onClick={() => save("draft")}
          disabled={loading}
          aria-busy={loading && activeAction === "draft"}
        >
          {loading && activeAction === "draft"
            ? "Saving draft…"
            : "Save Draft"}
        </button>

        <button
          type="button"
          className="rn-ps-button rn-ps-button-primary"
          onClick={() => save("submitted")}
          disabled={loading}
          aria-busy={loading && activeAction === "submitted"}
        >
          {loading && activeAction === "submitted"
            ? "Submitting…"
            : isRevision
              ? "Resubmit for Review →"
              : "Submit for Review →"}
        </button>
      </div>

      <div className="rn-ps-security-note">
        <span aria-hidden="true">●</span>

        <span>
          <strong>Submission privacy:</strong> your work is sent through the
          authenticated RuffNeck Learn submission endpoint.
        </span>
      </div>
    </section>
  );
}