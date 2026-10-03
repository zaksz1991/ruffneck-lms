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

  async function save(
    status: "draft" | "submitted"
  ) {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/student/projects/${projectId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            submissionText: text,
            submissionUrl: url,
            status,
          }),
        }
      );

      const result =
        (await response.json()) as {
          error?: string;
          message?: string;
        };

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to save submission."
        );
      }

      setMessage(
        result.message ||
          "Submission saved."
      );

      if (status === "submitted") {
        router.refresh();
        return;
      }
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

  const canEdit =
    initialStatus === "draft";

  if (!canEdit) {
    return null;
  }

  return (
    <section className="rn-project-submission-card">
      <span className="rn-eyebrow">
        YOUR SUBMISSION
      </span>

      <h2>
        Prepare your project
      </h2>

      <p>
        Describe your completed work and provide a
        link to supporting material where applicable.
      </p>

      <label>
        <span>Written submission</span>

        <textarea
          value={text}
          onChange={(event) =>
            setText(event.target.value)
          }
          placeholder="Explain your approach, work completed, findings, decisions and final result."
          rows={12}
          disabled={loading}
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
        />
      </label>

      {error ? (
        <div className="error">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="success">
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
        >
          {loading
            ? "Submitting…"
            : "Submit for Review"}
        </button>
      </div>
    </section>
  );
}