"use client";

import { FormEvent, useState } from "react";

type Props = {
  taskId: string;
  initialText: string;
  initialStatus: string;
};

export default function PracticalWorkClient({
  taskId,
  initialText,
  initialStatus,
}: Props) {
  const [text, setText] =
    useState(initialText);

  const [status, setStatus] =
    useState(initialStatus);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const locked =
    status === "submitted" ||
    status === "under_review" ||
    status === "approved";

  async function submitWork(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!text.trim()) {
      setError(
        "Enter your practical work before submitting.",
      );
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        "/api/student/practical-work",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            task_id: taskId,
            submission_text: text,
          }),
        },
      );

      const data =
        (await response.json()) as {
          ok?: boolean;
          error?: string;
          submission?: {
            status?: string;
          };
        };

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error ||
            "Unable to submit your work.",
        );
      }

      const nextStatus =
        data.submission?.status ||
        "submitted";

      setStatus(nextStatus);

      setMessage(
        "Your practical work has been submitted for review.",
      );
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to submit your work.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (locked) {
    return (
      <div className="stack">
        <div>
          <strong>
            Your submission
          </strong>

          <p>
            {status === "approved"
              ? "This practical task has been approved."
              : status === "under_review"
                ? "Your work is currently under review."
                : "Your work has been submitted."}
          </p>
        </div>

        {status === "approved" ? (
          <span className="status-badge">
            Practical evidence earned
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <form
      onSubmit={submitWork}
      className="stack"
    >
      <label htmlFor={`task-${taskId}`}>
        <strong>
          Your practical work
        </strong>
      </label>

      <textarea
        id={`task-${taskId}`}
        value={text}
        onChange={(event) =>
          setText(event.target.value)
        }
        rows={12}
        maxLength={50000}
        placeholder="Complete the task and describe the work you produced, decisions you made, and the final outcome."
        disabled={saving}
      />

      <div className="course-meta">
        <span>
          {text.length.toLocaleString()} /
          50,000 characters
        </span>
      </div>

      {error ? (
        <div className="alert error">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="alert success">
          {message}
        </div>
      ) : null}

      <button
        type="submit"
        className="button primary"
        disabled={saving}
      >
        {saving
          ? "Submitting..."
          : "Submit Practical Work"}
      </button>
    </form>
  );
}