"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Status =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_required";

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

  const [text, setText] =
    useState(initialText);

  const [url, setUrl] =
    useState(initialUrl);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [message, setMessage] =
    useState<string | null>(null);

  const isRevision =
    initialStatus ===
    "revision_required";

  function validateSubmission(
    status: "draft" | "submitted"
  ) {
    const trimmedText = text.trim();
    const trimmedUrl = url.trim();

    if (
      status === "submitted" &&
      trimmedText.length === 0 &&
      trimmedUrl.length === 0
    ) {
      return (
        "Add a written submission or a supporting project link before submitting."
      );
    }

    if (trimmedUrl) {
      try {
        const parsedUrl =
          new URL(trimmedUrl);

        if (
          parsedUrl.protocol !==
            "http:" &&
          parsedUrl.protocol !==
            "https:"
        ) {
          return (
            "The supporting link must use http:// or https://."
          );
        }
      } catch {
        return (
          "Enter a valid supporting project URL."
        );
      }
    }

    return null;
  }

  async function save(
    status: "draft" | "submitted"
  ) {
    setError(null);
    setMessage(null);

    const validationError =
      validateSubmission(status);

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `/api/student/projects/${projectId}`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            submissionText:
              text.trim(),
            submissionUrl:
              url.trim(),
            status,
          }),
        }
      );

      let result: {
        error?: string;
        message?: string;
      } = {};

      try {
        result =
          (await response.json()) as {
            error?: string;
            message?: string;
          };
      } catch {
        result = {};
      }

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to save submission."
        );
      }

      if (status === "submitted") {
        router.refresh();
        return;
      }

      setMessage(
        result.message ||
          "Draft saved successfully."
      );
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to save submission."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rn-project-submission-card">
      <span className="rn-eyebrow">
        {isRevision
          ? "REVISE YOUR WORK"
          : "YOUR SUBMISSION"}
      </span>

      <h2>
        {isRevision
          ? "Update and resubmit"
          : "Prepare your project"}
      </h2>

      <p>
        {isRevision
          ? "Make the requested improvements, update your evidence and resubmit the project for review."
          : "Describe your completed work and provide a link to supporting material where applicable."}
      </p>

      <label>
        <span>
          Written submission
        </span>

        <textarea
          value={text}
          onChange={(event) =>
            setText(event.target.value)
          }
          placeholder="Explain your approach, work completed, findings, decisions and final result."
          rows={12}
          disabled={loading}
          aria-label="Written project submission"
        />
      </label>

      <label>
        <span>
          Supporting document or project link
        </span>

        <input
          type="url"
          value={url}
          onChange={(event) =>
            setUrl(event.target.value)
          }
          placeholder="https://..."
          disabled={loading}
          aria-label="Supporting project URL"
        />
      </label>

      <p className="rn-project-form-help">
        You can save incomplete work as a
        draft. A submission must contain
        written work, a supporting link, or
        both.
      </p>

      {error ? (
        <div
          className="error"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {message ? (
        <div
          className="success"
          role="status"
        >
          {message}
        </div>
      ) : null}

      <div className="rn-project-submission-actions">
        <button
          type="button"
          className="rn-button rn-button-secondary"
          onClick={() =>
            save("draft")
          }
          disabled={loading}
          aria-busy={loading}
        >
          {loading
            ? "Saving…"
            : "Save Draft"}
        </button>

        <button
          type="button"
          className="rn-button rn-button-primary"
          onClick={() =>
            save("submitted")
          }
          disabled={loading}
          aria-busy={loading}
        >
          {loading
            ? "Submitting…"
            : isRevision
              ? "Resubmit for Review"
              : "Submit for Review"}
        </button>
      </div>
    </section>
  );
}