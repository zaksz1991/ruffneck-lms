"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type LabReviewFormProps = {
  submissionId: string;
  currentScore: number | null;
  currentFeedback: string | null;
};

type ReviewStatus = "approved" | "revision_required";

const FEEDBACK_TEMPLATES = [
  {
    label: "Needs more detail",
    text: "Your response needs more detail. Address each part of the task brief and explain the steps you took, the decisions you made, and the result.",
  },
  {
    label: "Check accuracy",
    text: "Review the factual accuracy of your response. Verify important claims against reliable sources and correct any unsupported or inaccurate information.",
  },
  {
    label: "Follow the brief",
    text: "Your submission does not yet meet all the requirements in the task brief. Compare your work with the requested deliverable and address each requirement that is missing.",
  },
  {
    label: "Improve structure",
    text: "Improve the structure and readability of your response. Use clear sections or steps, explain your reasoning, and make the final deliverable easy to follow.",
  },
  {
    label: "Good work",
    text: "Your submission addresses the task requirements and communicates the result clearly. Review the feedback above for any final points to carry into future work.",
  },
] as const;

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
  const [status, setStatus] = useState<ReviewStatus>("approved");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function addFeedbackTemplate(template: string) {
    setFeedback((current) => {
      const existing = current.trim();
      if (!existing) return template;
      if (existing.includes(template)) return current;
      return `${existing}\n\n${template}`;
    });
    setError("");
    setSuccess("");
  }

  async function submitReview(nextStatus: ReviewStatus) {
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
        <label>Feedback templates</label>
        <p className="rn-lab-review-note">
          Choose a template to add guidance to your feedback. Edit the text
          below so it reflects this student's actual work.
        </p>
        <div
          role="group"
          aria-label="Feedback templates"
          style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}
        >
          {FEEDBACK_TEMPLATES.map((template) => (
            <button
              key={template.label}
              type="button"
              className="btn btn-ghost"
              onClick={() => addFeedbackTemplate(template.text)}
              disabled={saving}
            >
              {template.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rn-lab-review-field">
        <label htmlFor={`feedback-${submissionId}`}>Feedback</label>
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
