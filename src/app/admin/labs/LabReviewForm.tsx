"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type LabReviewFormProps = {
  submissionId: string;
  currentScore: number | null;
  currentFeedback: string | null;
};

export default function LabReviewForm({
  submissionId,
  currentScore,
  currentFeedback,
}: LabReviewFormProps) {
  const router = useRouter();

  const [score, setScore] = useState(
    currentScore === null ? "" : String(currentScore),
  );
  const [feedback, setFeedback] = useState(currentFeedback ?? "");
  const [status, setStatus] = useState<"approved" | "revision_required">(
    "approved",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submitReview(
    nextStatus: "approved" | "revision_required",
  ) {
    setError("");
    setSuccess("");

    const parsedScore = Number(score);

    if (
      score.trim() === "" ||
      !Number.isInteger(parsedScore) ||
      parsedScore < 0 ||
      parsedScore > 100
    ) {
      setError("Enter a whole-number score from 0 to 100.");
      return;
    }

    if (feedback.length > 10000) {
      setError("Feedback cannot exceed 10,000 characters.");
      return;
    }

    if (
      nextStatus === "revision_required" &&
      feedback.trim().length === 0
    ) {
      setError("Provide feedback explaining what the student must improve.");
      return;
    }

    setSaving(true);
    setStatus(nextStatus);

    try {
      const response = await fetch(
        "/api/admin/labs/submissions/review",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            submissionId,
            score: parsedScore,
            feedback: feedback.trim(),
            status: nextStatus,
          }),
        },
      );

      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        message?: string;
      } | null;

      if (!response.ok || !result?.ok) {
        setError(result?.error || "Unable to save the review.");
        return;
      }

      setSuccess(
        nextStatus === "approved"
          ? "Submission approved successfully."
          : "Revision requested successfully.",
      );

      router.refresh();
    } catch {
      setError("A network error occurred. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="rn-lab-review-form"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="rn-lab-review-field">
        <label htmlFor={`score-${submissionId}`}>
          Score <span aria-hidden="true">*</span>
        </label>

        <div className="rn-lab-score-input">
          <input
            id={`score-${submissionId}`}
            type="number"
            min={0}
            max={100}
            step={1}
            value={score}
            onChange={(event) => setScore(event.target.value)}
            required
            disabled={saving}
            placeholder="Enter score"
          />
          <span>/ 100</span>
        </div>
      </div>

      <div className="rn-lab-review-field">
        <label htmlFor={`feedback-${submissionId}`}>
          Feedback
        </label>

        <textarea
          id={`feedback-${submissionId}`}
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
          maxLength={10000}
          rows={5}
          disabled={saving}
          placeholder="Explain what the student did well and what needs improvement..."
        />

        <small>{feedback.length.toLocaleString()} / 10,000 characters</small>
      </div>

      {error ? (
        <div className="rn-lab-review-message error" role="alert">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rn-lab-review-message success" role="status">
          {success}
        </div>
      ) : null}

      <div className="rn-lab-review-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => submitReview("approved")}
          disabled={saving}
        >
          {saving && status === "approved"
            ? "Approving..."
            : "Approve Submission"}
        </button>

        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => submitReview("revision_required")}
          disabled={saving}
        >
          {saving && status === "revision_required"
            ? "Saving..."
            : "Request Revision"}
        </button>
      </div>

      <p className="rn-lab-review-note">
        Approval records the score and feedback. Requesting a revision returns
        the submission to the student for improvement.
      </p>
    </form>
  );
}