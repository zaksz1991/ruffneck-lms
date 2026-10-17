"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type LabReviewFormProps = {
  submissionId: string;
  currentScore: number | null;
  currentFeedback: string | null;
};

type ReviewStatus = "approved" | "revision_required";
type ReviewAction = ReviewStatus | null;
type RubricCriterion = {
  criterion: string;
  points: number;
  description?: string;
};
type SavedRubricScore = {
  criterion: string;
  earnedPoints: number;
};
type RubricReviewPayload = {
  ok?: boolean;
  error?: string;
  message?: string;
  hasRubric?: boolean;
  rubric?: RubricCriterion[];
  saved?: {
    rubric_scores?: Array<{
      criterion?: string;
      earnedPoints?: number;
      earned_points?: number;
    }>;
    total_score?: number;
  } | null;
  warning?: string;
  totalScore?: number;
};

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

function isValidRubric(value: unknown): value is RubricCriterion[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) return false;
  const criteria: RubricCriterion[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return false;
    const row = item as Record<string, unknown>;
    if (typeof row.criterion !== "string" || !row.criterion.trim()) return false;
    if (typeof row.points !== "number" || !Number.isInteger(row.points) || row.points < 0 || row.points > 100) return false;
    criteria.push({
      criterion: row.criterion.trim(),
      points: row.points,
      ...(typeof row.description === "string" && row.description.trim()
        ? { description: row.description.trim() }
        : {}),
    });
  }
  return new Set(criteria.map((item) => item.criterion)).size === criteria.length
    && criteria.reduce((sum, item) => sum + item.points, 0) === 100;
}

export default function LabReviewForm({
  submissionId,
  currentScore,
  currentFeedback,
}: LabReviewFormProps) {
  const router = useRouter();
  const [score, setScore] = useState(currentScore === null ? "" : String(currentScore));
  const [feedback, setFeedback] = useState(currentFeedback ?? "");
  const [rubricState, setRubricState] = useState<"loading" | "available" | "legacy">("loading");
  const [rubric, setRubric] = useState<RubricCriterion[]>([]);
  const [criterionScores, setCriterionScores] = useState<Record<string, string>>({});
  const [rubricWarning, setRubricWarning] = useState("");
  const [action, setAction] = useState<ReviewAction>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadRubric() {
      try {
        const response = await fetch(
          `/api/admin/labs/submissions/rubric-review?submissionId=${encodeURIComponent(submissionId)}`,
          { method: "GET", cache: "no-store" },
        );
        const result = await response.json().catch(() => null) as RubricReviewPayload | null;
        if (cancelled) return;

        if (!response.ok || !result?.ok) {
          setRubricWarning(result?.error || "Rubric details could not be loaded. The standard score form is available.");
          setRubricState("legacy");
          return;
        }

        if (!result.hasRubric || !isValidRubric(result.rubric)) {
          setRubricWarning(result.warning || "This lab does not have a valid 100-point rubric. Use the standard overall-score form.");
          setRubricState("legacy");
          return;
        }

        const saved = result.saved?.rubric_scores ?? [];
        const savedByCriterion = new Map<string, number>();
        for (const row of saved) {
          if (typeof row.criterion !== "string") continue;
          const points = typeof row.earnedPoints === "number"
            ? row.earnedPoints
            : typeof row.earned_points === "number"
              ? row.earned_points
              : NaN;
          if (Number.isInteger(points)) savedByCriterion.set(row.criterion, points);
        }

        const nextScores: Record<string, string> = {};
        for (const criterion of result.rubric) {
          const savedPoints = savedByCriterion.get(criterion.criterion);
          nextScores[criterion.criterion] = savedPoints !== undefined
            && savedPoints >= 0
            && savedPoints <= criterion.points
            ? String(savedPoints)
            : "";
        }
        setRubric(result.rubric);
        setCriterionScores(nextScores);
        setRubricState("available");
      } catch {
        if (cancelled) return;
        setRubricWarning("Rubric details could not be loaded. The standard score form is available.");
        setRubricState("legacy");
      }
    }

    void loadRubric();
    return () => { cancelled = true; };
  }, [submissionId]);

  const rubricTotal = useMemo(() => rubric.reduce((sum, item) => {
    const value = criterionScores[item.criterion];
    if (value === undefined || value.trim() === "") return sum;
    const number = Number(value);
    return Number.isInteger(number) && number >= 0 && number <= item.points ? sum + number : sum;
  }, 0), [rubric, criterionScores]);

  const unscoredCriteria = useMemo(() => rubric.filter((item) => {
    const value = criterionScores[item.criterion];
    if (value === undefined || value.trim() === "") return true;
    const number = Number(value);
    return !Number.isInteger(number) || number < 0 || number > item.points;
  }), [rubric, criterionScores]);

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

    if (feedback.length > 10000) {
      setError("Feedback cannot exceed 10,000 characters.");
      return;
    }
    if (nextStatus === "revision_required" && feedback.trim().length === 0) {
      setError("Provide feedback explaining what the student must improve.");
      return;
    }

    let parsedScore = Number(score);
    let rubricScores: SavedRubricScore[] | null = null;

    if (rubricState === "available") {
      if (unscoredCriteria.length > 0) {
        setError(`Enter a valid score for every rubric criterion. ${unscoredCriteria.length} remaining.`);
        return;
      }
      rubricScores = rubric.map((criterion) => ({
        criterion: criterion.criterion,
        earnedPoints: Number(criterionScores[criterion.criterion]),
      }));
      parsedScore = rubricTotal;
    } else if (
      score.trim() === "" ||
      !Number.isInteger(parsedScore) ||
      parsedScore < 0 ||
      parsedScore > 100
    ) {
      setError("Enter a whole-number score from 0 to 100.");
      return;
    }

    setAction(nextStatus);
    try {
      const response = await fetch(
        rubricScores
          ? "/api/admin/labs/submissions/rubric-review"
          : "/api/admin/labs/submissions/review",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rubricScores
            ? {
                submissionId,
                rubricScores,
                feedback: feedback.trim(),
                status: nextStatus,
              }
            : {
                submissionId,
                score: parsedScore,
                feedback: feedback.trim(),
                status: nextStatus,
              }),
        },
      );
      const result = await response.json().catch(() => null) as RubricReviewPayload | null;
      if (!response.ok || !result?.ok) {
        setError(result?.error || "Unable to save the review.");
        return;
      }
      const totalText = rubricScores && typeof result.totalScore === "number"
        ? ` Total rubric score: ${result.totalScore}/100.`
        : "";
      setSuccess(
        `${nextStatus === "approved" ? "Submission approved successfully." : "Revision requested successfully."}${totalText}`,
      );
      router.refresh();
    } catch {
      setError("A network error occurred. Please try again.");
    } finally {
      setAction(null);
    }
  }

  if (rubricState === "loading") {
    return (
      <div className="rn-lab-review-note" role="status" aria-live="polite">
        Loading assessment rubric…
      </div>
    );
  }

  const saving = action !== null;

  return (
    <form className="rn-lab-review-form" onSubmit={(event) => event.preventDefault()}>
      {rubricState === "available" ? (
        <section aria-labelledby={`rubric-title-${submissionId}`} style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <h3 id={`rubric-title-${submissionId}`} style={{ margin: "0 0 8px" }}>Assessment rubric</h3>
            <strong aria-live="polite" style={{ fontSize: 18 }}>{rubricTotal}/100</strong>
          </div>
          <p className="rn-lab-review-note">Score each criterion using its own maximum points. All criteria must have a valid score before saving the review.</p>
          <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
            {rubric.map((criterion, index) => (
              <div key={criterion.criterion} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 112px", gap: 14, alignItems: "start", border: "1px solid var(--border, #dbe4ef)", borderRadius: 12, padding: 14, background: "var(--surface, #f8fafc)" }}>
                <div style={{ minWidth: 0 }}>
                  <label htmlFor={`rubric-${submissionId}-${index}`} style={{ display: "block", fontWeight: 750, marginBottom: 5 }}>{criterion.criterion}</label>
                  {criterion.description ? <p className="rn-lab-review-note" style={{ margin: 0 }}>{criterion.description}</p> : null}
                  <small style={{ color: "var(--muted, #64748b)" }}>Maximum: {criterion.points} points</small>
                </div>
                <label htmlFor={`rubric-${submissionId}-${index}`} style={{ display: "grid", gap: 5 }}>
                  <span className="rn-lab-review-note">Points earned</span>
                  <input
                    id={`rubric-${submissionId}-${index}`}
                    type="number"
                    min={0}
                    max={criterion.points}
                    step={1}
                    inputMode="numeric"
                    value={criterionScores[criterion.criterion] ?? ""}
                    onChange={(event) => {
                      setCriterionScores((current) => ({ ...current, [criterion.criterion]: event.target.value }));
                      setError("");
                      setSuccess("");
                    }}
                    disabled={saving}
                    required
                    aria-describedby={`rubric-points-${submissionId}-${index}`}
                  />
                  <small id={`rubric-points-${submissionId}-${index}`}>of {criterion.points}</small>
                </label>
              </div>
            ))}
          </div>
          {unscoredCriteria.length > 0 ? <p className="rn-lab-review-note" style={{ marginTop: 10 }}>{unscoredCriteria.length} criterion/criteria still need a valid score.</p> : <p role="status" className="rn-lab-review-note" style={{ marginTop: 10 }}>All criteria scored. Total: {rubricTotal}/100.</p>}
        </section>
      ) : (
        <>
          {rubricWarning ? <div className="rn-lab-review-note" style={{ padding: 12, marginBottom: 14, border: "1px solid var(--border, #dbe4ef)", borderRadius: 10 }}>{rubricWarning}</div> : null}
          <div className="rn-lab-review-field">
            <label htmlFor={`score-${submissionId}`}>Score <span aria-hidden="true">*</span></label>
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
        </>
      )}

      <div className="rn-lab-review-field">
        <label>Feedback templates</label>
        <p className="rn-lab-review-note">Choose a template to add guidance to your feedback. Edit the text below so it reflects this student&apos;s actual work.</p>
        <div role="group" aria-label="Feedback templates" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
          {FEEDBACK_TEMPLATES.map((template) => (
            <button key={template.label} type="button" className="btn btn-ghost" onClick={() => addFeedbackTemplate(template.text)} disabled={saving}>
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
          onChange={(event) => { setFeedback(event.target.value); setError(""); setSuccess(""); }}
          maxLength={10000}
          rows={5}
          disabled={saving}
          placeholder="Explain what the student did well and what needs improvement..."
        />
        <small>{feedback.length.toLocaleString()} / 10,000 characters</small>
      </div>

      {error ? <div className="rn-lab-review-message error" role="alert">{error}</div> : null}
      {success ? <div className="rn-lab-review-message success" role="status">{success}</div> : null}

      <div className="rn-lab-review-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void submitReview("approved")}
          disabled={saving || (rubricState === "available" && unscoredCriteria.length > 0)}
        >
          {action === "approved" ? "Approving…" : "Approve Submission"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => void submitReview("revision_required")}
          disabled={saving || (rubricState === "available" && unscoredCriteria.length > 0)}
        >
          {action === "revision_required" ? "Saving…" : "Request Revision"}
        </button>
      </div>
      <p className="rn-lab-review-note">
        {rubricState === "available"
          ? "The total is calculated from the rubric. Review scores and feedback are saved through the authorized rubric-review endpoint."
          : "Approval records the overall score and feedback. Requesting a revision returns the submission to the student for improvement."}
      </p>
    </form>
  );
}
