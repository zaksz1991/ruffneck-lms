"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  submissionId: string;
  initialScore: number | null;
  initialFeedback: string | null;
};

export default function LabReviewForm({
  submissionId,
  initialScore,
  initialFeedback,
}: Props) {
  const router = useRouter();

  const [score, setScore] = useState(
    initialScore === null ? "" : String(initialScore),
  );
  const [feedback, setFeedback] = useState(initialFeedback ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submitReview(status: "approved" | "revision_required") {
    setError("");
    setSuccess("");

    if (score.trim() === "") {
      setError("Enter a score from 0 to 100.");
      return;
    }

    const numericScore = Number(score);

    if (
      !Number.isInteger(numericScore) ||
      numericScore < 0 ||
      numericScore > 100
    ) {
      setError("The score must be a whole number from 0 to 100.");
      return;
    }

    setBusy(true);

    try {
      const response = await fetch("/api/admin/labs/submissions/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          score: numericScore,
          feedback,
          status,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        setError(result?.error || "Unable to save this review.");
        return;
      }

      setSuccess(
        status === "approved"
          ? "Submission approved."
          : "Revision requested.",
      );

      router.refresh();
    } catch {
      setError("A network error occurred. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 20 }}>
      <h4>Review submission</h4>

      <div
        style={{
          display: "grid",
          gap: 14,
          maxWidth: 720,
        }}
      >
        <label>
          <span style={{ display: "block", marginBottom: 6 }}>
            Score (0–100)
          </span>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={score}
            onChange={(event) => setScore(event.target.value)}
            disabled={busy}
            required
            style={{ width: "100%", maxWidth: 220 }}
          />
        </label>

        <label>
          <span style={{ display: "block", marginBottom: 6 }}>
            Feedback for learner
          </span>
          <textarea
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            maxLength={10000}
            rows={5}
            disabled={busy}
            placeholder="Explain what was done well and what needs improvement."
            style={{ width: "100%", resize: "vertical" }}
          />
          <small>{feedback.length}/10,000 characters</small>
        </label>

        {error ? (
          <p role="alert" style={{ color: "#b42318" }}>
            {error}
          </p>
        ) : null}

        {success ? (
          <p role="status" style={{ color: "#067647" }}>
            {success}
          </p>
        ) : null}

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => submitReview("approved")}
          >
            {busy ? "Saving…" : "Approve submission"}
          </button>

          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy}
            onClick={() => submitReview("revision_required")}
          >
            {busy ? "Saving…" : "Request revision"}
          </button>
        </div>
      </div>
    </div>
  );
}