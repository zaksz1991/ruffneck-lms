"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type RubricCriterion = {
  criterion: string;
  points: number;
  description?: string;
};

type SavedRubricScore = {
  criterion: string;
  maxPoints: number;
  earnedPoints: number;
  description?: string;
};

type SavedRubricReview = {
  rubric_scores?: SavedRubricScore[];
  total_score?: number;
};

type RubricApiResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  hasRubric?: boolean;
  rubric?: RubricCriterion[];
  saved?: SavedRubricReview | null;
  warning?: string;
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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function LabReviewForm({
  submissionId,
  currentScore,
  currentFeedback,
}: {
  submissionId: string;
  currentScore: number | null;
  currentFeedback: string | null;
}) {
  const router = useRouter();
  const [score, setScore] = useState(currentScore === null ? "" : String(currentScore));
  const [feedback, setFeedback] = useState(currentFeedback ?? "");
  const [status, setStatus] = useState<ReviewStatus>("approved");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [rubric, setRubric] = useState<RubricCriterion[]>([]);
  const [rubricScores, setRubricScores] = useState<Record<string, string>>({});
  const [rubricEnabled, setRubricEnabled] = useState(false);
  const [rubricLoading, setRubricLoading] = useState(true);
  const [rubricWarning, setRubricWarning] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadRubric() {
      if (!UUID_PATTERN.test(submissionId)) {
        setRubricWarning("Rubric scoring could not load because the submission ID is invalid.");
        setRubricLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `/api/admin/labs/submissions/rubric-review?submissionId=${encodeURIComponent(submissionId)}`,
          { method: "GET", cache: "no-store" },
        );
        const result = (await response.json().catch(() => null)) as RubricApiResponse | null;
        if (!response.ok || !result?.ok) {
          throw new Error(result?.error || "The assessment rubric could not be loaded.");
        }
        if (cancelled) return;

        const criteria = Array.isArray(result.rubric) ? result.rubric : [];
        setRubric(criteria);
        setRubricEnabled(Boolean(result.hasRubric) && criteria.length > 0);
        setRubricWarning(result.warning ?? "");

        const nextScores: Record<string, string> = {};
        const savedScores = Array.isArray(result.saved?.rubric_scores)
          ? result.saved.rubric_scores
          : [];
        for (const saved of savedScores) {
          if (typeof saved.criterion === "string" && Number.isInteger(saved.earnedPoints)) {
            nextScores[saved.criterion] = String(saved.earnedPoints);
          }
        }
        setRubricScores(nextScores);
      } catch (loadError) {
        if (cancelled) return;
        setRubricWarning(
          loadError instanceof Error
            ? `${loadError.message} The standard overall-score form remains available.`
            : "Rubric scoring could not load. The standard overall-score form remains available.",
        );
        setRubricEnabled(false);
      } finally {
        if (!cancelled) setRubricLoading(false);
      }
    }

    void loadRubric();
    return () => {
      cancelled = true;
    };
  }, [submissionId]);

  const rubricMaximum = useMemo(
    () => rubric.reduce((sum, item) => sum + item.points, 0),
    [rubric],
  );
  const completedCriterionCount = useMemo(
    () => rubric.filter((item) => rubricScores[item.criterion]?.trim() !== "").length,
    [rubric, rubricScores],
  );
  const calculatedScore = useMemo(
    () => rubric.reduce((sum, item) => {
      const value = rubricScores[item.criterion]?.trim();
      return value !== undefined && value !== "" && Number.isInteger(Number(value))
        ? sum + Number(value)
        : sum;
    }, 0),
    [rubric, rubricScores],
  );

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

  function updateRubricScore(criterion: RubricCriterion, rawValue: string) {
    if (rawValue !== "" && !/^\d+$/.test(rawValue)) return;
    if (rawValue !== "" && Number(rawValue) > criterion.points) return;
    setRubricScores((current) => ({ ...current, [criterion.criterion]: rawValue }));
    setError("");
    setSuccess("");
  }

  async function submitReview(nextStatus: ReviewStatus) {
    setError("");
    setSuccess("");

    if (rubricLoading) {
      setError("Wait for the assessment rubric to finish loading before submitting this review.");
      return;
    }

    let parsedScore: number;
    if (rubricEnabled) {
      if (!rubric.length || rubricMaximum !== 100) {
        setError("The configured rubric must contain criteria totalling 100 points.");
        return;
      }
      const missing = rubric.find((item) => {
        const value = rubricScores[item.criterion];
        return value === undefined || value.trim() === "";
      });
      if (missing) {
        setError(`Enter a score for every criterion. Missing: ${missing.criterion}.`);
        return;
      }
      for (const item of rubric) {
        const value = Number(rubricScores[item.criterion]);
        if (!Number.isInteger(value) || value < 0 || value > item.points) {
          setError(`Enter a whole-number score from 0 to ${item.points} for “${item.criterion}”.`);
          return;
        }
      }
      parsedScore = calculatedScore;
    } else {
      parsedScore = Number(score);
      if (
        score.trim() === "" ||
        !Number.isInteger(parsedScore) ||
        parsedScore < 0 ||
        parsedScore > 100
      ) {
        setError("Enter a whole-number score from 0 to 100.");
        return;
      }
    }

    if (feedback.length > 10000) {
      setError("Feedback cannot exceed 10,000 characters.");
      return;
    }
    if (nextStatus === "revision_required" && feedback.trim().length === 0) {
      setError("Provide feedback explaining what the student must improve.");
      return;
    }

    setSaving(true);
    setStatus(nextStatus);
    try {
      const url = rubricEnabled
        ? "/api/admin/labs/submissions/rubric-review"
        : "/api/admin/labs/submissions/review";
      const body = rubricEnabled
        ? {
            submissionId,
            rubricScores: rubric.map((item) => ({
              criterion: item.criterion,
              earnedPoints: Number(rubricScores[item.criterion]),
            })),
            feedback: feedback.trim(),
            status: nextStatus,
          }
        : {
            submissionId,
            score: parsedScore,
            feedback: feedback.trim(),
            status: nextStatus,
          };

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        message?: string;
        totalScore?: number;
      } | null;

      if (!response.ok || !result?.ok) {
        setError(result?.error || "Unable to save the review.");
        return;
      }
      setSuccess(
        nextStatus === "approved"
          ? `Submission approved successfully${rubricEnabled ? ` with a rubric score of ${result.totalScore ?? parsedScore}/100` : ""}.`
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
    <form className="rn-lab-review-form" onSubmit={(event) => event.preventDefault()}>
      {rubricWarning ? (
        <div className="rn-lab-review-message" role="status" style={{ marginBottom: 16 }}>
          {rubricWarning}
        </div>
      ) : null}

      {rubricLoading ? (
        <p className="rn-lab-review-note" role="status" aria-live="polite">
          Loading the assessment rubric…
        </p>
      ) : null}

      {!rubricLoading && rubricEnabled ? (
        <section
          aria-label="Criterion-by-criterion assessment rubric"
          style={{
            display: "grid",
            gap: 14,
            marginBottom: 22,
            padding: 18,
            border: "1px solid var(--border, #dbe4ef)",
            borderRadius: 14,
            background: "var(--surface, #f7f9fc)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <h4 style={{ margin: 0 }}>Assessment rubric</h4>
              <p className="rn-lab-review-note" style={{ margin: "5px 0 0" }}>
                Score each criterion. The total is calculated automatically.
              </p>
            </div>
            <strong aria-live="polite">{completedCriterionCount === rubric.length ? calculatedScore : "—"}/100</strong>
          </div>

          {rubric.map((item, index) => {
            const inputId = `rubric-${submissionId}-${index}`;
            const fieldValue = rubricScores[item.criterion] ?? "";
            return (
              <div
                key={`${item.criterion}-${index}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) minmax(90px, 120px)",
                  gap: 14,
                  alignItems: "start",
                  paddingTop: 14,
                  borderTop: "1px solid var(--border, #dbe4ef)",
                }}
              >
                <div>
                  <label htmlFor={inputId} style={{ display: "block", fontWeight: 700 }}>
                    {index + 1}. {item.criterion}
                  </label>
                  {item.description ? (
                    <p className="rn-lab-review-note" style={{ margin: "5px 0 0" }}>
                      {item.description}
                    </p>
                  ) : null}
                </div>
                <div>
                  <input
                    id={inputId}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={item.points}
                    step={1}
                    value={fieldValue}
                    onChange={(event) => updateRubricScore(item, event.target.value)}
                    aria-label={`${item.criterion}, points earned out of ${item.points}`}
                    placeholder="Points"
                    disabled={saving}
                    style={{ width: "100%", minHeight: 42, padding: "9px 10px", border: "1px solid var(--border, #cbd5e1)", borderRadius: 8, background: "var(--background, #fff)", color: "inherit", font: "inherit" }}
                  />
                  <small style={{ display: "block", textAlign: "right", marginTop: 4 }}>of {item.points}</small>
                </div>
              </div>
            );
          })}

          <div style={{ paddingTop: 12, borderTop: "1px solid var(--border, #dbe4ef)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <span className="rn-lab-review-note">Criteria scored</span>
              <strong>{completedCriterionCount} of {rubric.length}</strong>
            </div>
            <div style={{ height: 7, marginTop: 8, overflow: "hidden", borderRadius: 999, background: "var(--border, #dbe4ef)" }}>
              <div style={{ height: "100%", width: `${rubric.length ? (completedCriterionCount / rubric.length) * 100 : 0}%`, background: "var(--accent, #087f8c)", transition: "width 120ms ease" }} />
            </div>
            <p className="rn-lab-review-note" style={{ marginBottom: 0, marginTop: 8 }}>
              Every criterion must be scored before the review can be submitted. The saved overall score is the sum of these points.
            </p>
          </div>
        </section>
      ) : null}

      {!rubricLoading && !rubricEnabled ? (
        <div className="rn-lab-review-field">
          <label htmlFor={`score-${submissionId}`}>
            Overall score <span aria-hidden="true">*</span>
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
      ) : null}

      <div className="rn-lab-review-field">
        <label>Feedback templates</label>
        <p className="rn-lab-review-note">
          Choose a template to add guidance to your feedback. Edit the text below so it reflects this student&apos;s actual work.
        </p>
        <div role="group" aria-label="Feedback templates" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
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

      {error ? <div className="rn-lab-review-message error" role="alert">{error}</div> : null}
      {success ? <div className="rn-lab-review-message success" role="status">{success}</div> : null}

      <div className="rn-lab-review-actions">
        <button type="button" className="btn btn-primary" onClick={() => submitReview("approved")} disabled={saving || rubricLoading}>
          {saving && status === "approved" ? "Approving…" : "Approve Submission"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => submitReview("revision_required")} disabled={saving || rubricLoading}>
          {saving && status === "revision_required" ? "Saving…" : "Request Revision"}
        </button>
      </div>
      <p className="rn-lab-review-note">
        {rubricEnabled
          ? "The rubric breakdown and total score are saved together with your review. Requesting a revision returns the submission to the student for improvement."
          : "Approval records the overall score and feedback. Requesting a revision returns the submission to the student for improvement."}
      </p>
    </form>
  );
}
