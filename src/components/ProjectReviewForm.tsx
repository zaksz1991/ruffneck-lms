"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ReviewStatus =
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_required";

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

  async function saveReview() {
    setLoading(true);
    setError(null);
    setSaved(false);

    const numericScore =
      score === ""
        ? null
        : Number(score);

    if (
      numericScore !== null &&
      (!Number.isInteger(
        numericScore
      ) ||
        numericScore < 0 ||
        numericScore > maxScore)
    ) {
      setError(
        `Score must be between 0 and ${maxScore}.`
      );
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `/api/student/projects/${submissionId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            status,
            score: numericScore,
            feedback,
          }),
        }
      );

      const result =
        (await response.json()) as {
          error?: string;
        };

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

  return (
    <div className="rn-project-review-form">
      <div className="rn-project-review-fields">
        <label>
          <span>Status</span>

          <select
            value={status}
            onChange={(event) =>
              setStatus(
                event.target
                  .value as ReviewStatus
              )
            }
            disabled={loading}
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
            Score / {maxScore}
          </span>

          <input
            type="number"
            min="0"
            max={maxScore}
            value={score}
            onChange={(event) =>
              setScore(event.target.value)
            }
            disabled={loading}
          />
        </label>
      </div>

      <label>
        <span>Reviewer feedback</span>

        <textarea
          rows={6}
          value={feedback}
          onChange={(event) =>
            setFeedback(event.target.value)
          }
          placeholder="Provide clear strengths, improvements and next steps."
          disabled={loading}
        />
      </label>

      {error ? (
        <div className="error">
          {error}
        </div>
      ) : null}

      {saved ? (
        <div className="success">
          Review saved.
        </div>
      ) : null}

      <button
        type="button"
        className="rn-button rn-button-primary"
        onClick={saveReview}
        disabled={loading}
      >
        {loading
          ? "Saving…"
          : "Save Review"}
      </button>
    </div>
  );
}