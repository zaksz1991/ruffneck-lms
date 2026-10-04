"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ReviewStatus =
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_required";

type ReviewResponse = {
  error?: string;
  message?: string;
};

const MAX_FEEDBACK_LENGTH = 10000;

export default function ProjectReviewForm({
  submissionId,
  initialStatus,
  initialScore,
  initialFeedback,
  maxScore,
}: {
  submissionId: string;
  initialStatus:
    | "draft"
    | "submitted"
    | "under_review"
    | "approved"
    | "revision_required";
  initialScore: number | null;
  initialFeedback: string;
  maxScore: number;
}) {
  const router = useRouter();

  const normalizedMaxScore =
    Number.isFinite(maxScore) &&
    maxScore > 0
      ? Math.floor(maxScore)
      : 100;

  const [status, setStatus] =
    useState<ReviewStatus>(
      initialStatus === "draft"
        ? "submitted"
        : initialStatus
    );

  const [score, setScore] =
    useState(
      initialScore === null
        ? ""
        : String(initialScore)
    );

  const [feedback, setFeedback] =
    useState(initialFeedback);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [saved, setSaved] =
    useState(false);

  const isLocked =
    initialStatus === "approved";

  async function saveReview() {
    if (loading || isLocked) {
      return;
    }

    setLoading(true);
    setError(null);
    setSaved(false);

    const trimmedFeedback =
      feedback.trim();

    if (
      trimmedFeedback.length >
      MAX_FEEDBACK_LENGTH
    ) {
      setError(
        `Reviewer feedback cannot exceed ${MAX_FEEDBACK_LENGTH.toLocaleString()} characters.`
      );
      setLoading(false);
      return;
    }

    let numericScore:
      | number
      | null = null;

    if (score.trim() !== "") {
      const parsedScore =
        Number(score);

      if (
        !Number.isFinite(
          parsedScore
        ) ||
        !Number.isInteger(
          parsedScore
        )
      ) {
        setError(
          "Score must be a whole number."
        );
        setLoading(false);
        return;
      }

      if (
        parsedScore < 0 ||
        parsedScore >
          normalizedMaxScore
      ) {
        setError(
          `Score must be between 0 and ${normalizedMaxScore}.`
        );
        setLoading(false);
        return;
      }

      numericScore =
        parsedScore;
    }

    if (
      status === "approved" &&
      numericScore === null
    ) {
      setError(
        "A project score is required before approving the submission."
      );
      setLoading(false);
      return;
    }

    if (
      status ===
        "revision_required" &&
      !trimmedFeedback
    ) {
      setError(
        "Provide reviewer feedback explaining what needs to be revised."
      );
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/projects/${encodeURIComponent(
          submissionId
        )}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            status,
            score: numericScore,
            feedback:
              trimmedFeedback ||
              null,
          }),
        }
      );

      let result: ReviewResponse =
        {};

      try {
        result =
          (await response.json()) as ReviewResponse;
      } catch {
        throw new Error(
          "The review service returned an invalid response."
        );
      }

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to save review."
        );
      }

      setSaved(true);

      router.refresh();
    } catch (reviewError) {
      setError(
        reviewError instanceof Error
          ? reviewError.message
          : "Unable to save review."
      );
    } finally {
      setLoading(false);
    }
  }

  if (isLocked) {
    return (
      <div className="rn-project-review-form">
        <div
          className="success"
          role="status"
        >
          This project has already been
          approved. Its review is locked.
        </div>

        {initialScore !== null ? (
          <p>
            Final score:{" "}
            <strong>
              {initialScore} /{" "}
              {normalizedMaxScore}
            </strong>
          </p>
        ) : null}

        {initialFeedback ? (
          <div>
            <span className="rn-eyebrow">
              REVIEWER FEEDBACK
            </span>

            <p>
              {initialFeedback}
            </p>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rn-project-review-form">
      <div className="rn-project-review-fields">
        <label>
          <span>Status</span>

          <select
            value={status}
            onChange={(event) => {
              setStatus(
                event.target
                  .value as ReviewStatus
              );
              setSaved(false);
              setError(null);
            }}
            disabled={loading}
            aria-label="Project review status"
          >
            <option value="submitted">
              Submitted
            </option>

            <option value="under_review">
              Under Review
            </option>

            <option value="revision_required">
              Revision Required
            </option>

            <option value="approved">
              Approved
            </option>
          </select>
        </label>

        <label>
          <span>
            Score / {normalizedMaxScore}
          </span>

          <input
            type="number"
            min="0"
            max={normalizedMaxScore}
            step="1"
            inputMode="numeric"
            value={score}
            onChange={(event) => {
              setScore(
                event.target.value
              );
              setSaved(false);
              setError(null);
            }}
            disabled={loading}
            aria-label={`Project score out of ${normalizedMaxScore}`}
          />
        </label>
      </div>

      <label>
        <span>
          Reviewer feedback
        </span>

        <textarea
          rows={7}
          maxLength={
            MAX_FEEDBACK_LENGTH
          }
          value={feedback}
          onChange={(event) => {
            setFeedback(
              event.target.value
            );
            setSaved(false);
            setError(null);
          }}
          placeholder="Record strengths, required revisions, evidence, and next steps."
          disabled={loading}
          aria-label="Reviewer feedback"
        />

        <small>
          {feedback.length.toLocaleString()} /{" "}
          {MAX_FEEDBACK_LENGTH.toLocaleString()}
        </small>
      </label>

      {status === "approved" ? (
        <p>
          Approval requires a project score and
          successful completion of the published
          course lessons and a passing assessment
          score. The server will verify these
          requirements.
        </p>
      ) : null}

      {status ===
      "revision_required" ? (
        <p>
          Feedback is required when requesting
          revisions so the learner knows what to
          improve.
        </p>
      ) : null}

      {error ? (
        <div
          className="error"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {saved ? (
        <div
          className="success"
          role="status"
        >
          Review saved.
        </div>
      ) : null}

      <button
        type="button"
        className="rn-button rn-button-primary"
        onClick={saveReview}
        disabled={loading}
        aria-busy={loading}
      >
        {loading
          ? "Saving…"
          : "Save Review"}
      </button>
    </div>
  );
}