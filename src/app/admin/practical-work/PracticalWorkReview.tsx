"use client";

import { useEffect, useMemo, useState } from "react";

type Status =
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_required";

type Submission = {
  id: string;
  task_id: string;
  student_id: string;
  submission_text: string | null;
  status: Status;
  score: number | null;
  reviewer_feedback: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  course_practical_tasks?: {
    id: string;
    course_id: string;
    title: string;
    scenario: string;
    expected_outcome: string;
    submission_type: string;
    max_score: number;
    sort_order: number;
    courses?: {
      id: string;
      title: string;
      slug: string;
      instructor_id: string | null;
    } | null;
  } | null;
  student?: {
    id: string;
    display_name: string | null;
    email: string | null;
  } | null;
};

type ReviewDraft = {
  status: Status;
  score: string;
  feedback: string;
};

function formatDate(
  value: string | null,
) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString();
}

function statusLabel(status: Status) {
  switch (status) {
    case "submitted":
      return "Submitted";
    case "under_review":
      return "Under review";
    case "approved":
      return "Approved";
    case "revision_required":
      return "Revision required";
    default:
      return status;
  }
}

export default function PracticalWorkReview() {
  const [submissions, setSubmissions] =
    useState<Submission[]>([]);

  const [selectedId, setSelectedId] =
    useState<string | null>(null);

  const [drafts, setDrafts] = useState<
    Record<string, ReviewDraft>
  >({});

  const [filter, setFilter] = useState<
    "all" | Status
  >("all");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  async function loadSubmissions() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/admin/practical-work",
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to load submissions.",
        );
      }

      const rows = Array.isArray(
        data?.submissions,
      )
        ? data.submissions
        : [];

      setSubmissions(rows);

      setDrafts((current) => {
        const next = {
          ...current,
        };

        for (const row of rows) {
          if (!next[row.id]) {
            next[row.id] = {
              status:
                row.status === "submitted"
                  ? "under_review"
                  : row.status,
              score:
                row.score === null
                  ? ""
                  : String(row.score),
              feedback:
                row.reviewer_feedback ??
                "",
            };
          }
        }

        return next;
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load submissions.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSubmissions();
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") {
      return submissions;
    }

    return submissions.filter(
      (submission) =>
        submission.status === filter,
    );
  }, [filter, submissions]);

  const counts = useMemo(() => {
    return {
      all: submissions.length,
      submitted: submissions.filter(
        (item) =>
          item.status === "submitted",
      ).length,
      under_review: submissions.filter(
        (item) =>
          item.status === "under_review",
      ).length,
      approved: submissions.filter(
        (item) =>
          item.status === "approved",
      ).length,
      revision_required:
        submissions.filter(
          (item) =>
            item.status ===
            "revision_required",
        ).length,
    };
  }, [submissions]);

  function updateDraft(
    id: string,
    changes: Partial<ReviewDraft>,
  ) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...(current[id] ?? {
          status: "under_review",
          score: "",
          feedback: "",
        }),
        ...changes,
      },
    }));
  }

  async function saveReview(
    submission: Submission,
  ) {
    const draft = drafts[submission.id];

    if (!draft) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const maxScore =
      submission
        .course_practical_tasks
        ?.max_score ?? 100;

    const score =
      draft.score.trim() === ""
        ? null
        : Number(draft.score);

    if (
      score !== null &&
      (!Number.isFinite(score) ||
        score < 0 ||
        score > maxScore)
    ) {
      setError(
        `Score must be between 0 and ${maxScore}.`,
      );
      setSaving(false);
      return;
    }

    if (
      draft.status === "approved" &&
      score === null
    ) {
      setError(
        "An approved submission must have a score.",
      );
      setSaving(false);
      return;
    }

    if (
      draft.status ===
        "revision_required" &&
      !draft.feedback.trim()
    ) {
      setError(
        "Feedback is required when requesting a revision.",
      );
      setSaving(false);
      return;
    }

    try {
      const response = await fetch(
        "/api/admin/practical-work",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            id: submission.id,
            status: draft.status,
            score,
            reviewer_feedback:
              draft.feedback.trim() ||
              null,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to save review.",
        );
      }

      setMessage(
        "Practical work review saved.",
      );

      await loadSubmissions();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save review.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack">
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

      <div className="card">
        <div className="actions">
          {(
            [
              ["all", "All"],
              ["submitted", "Submitted"],
              ["under_review", "Under review"],
              ["revision_required", "Revision required"],
              ["approved", "Approved"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={
                filter === value
                  ? "button primary"
                  : "button secondary"
              }
              onClick={() =>
                setFilter(value)
              }
            >
              {label} (
              {counts[
                value as keyof typeof counts
              ] ?? 0}
              )
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="card">
          <p>
            Loading learner submissions...
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <h2>
            No submissions
          </h2>

          <p className="muted">
            There are no practical submissions
            matching this filter.
          </p>
        </div>
      ) : (
        filtered.map((submission) => {
          const task =
            submission
              .course_practical_tasks;

          const course =
            task?.courses;

          const student =
            submission.student;

          const draft =
            drafts[submission.id] ?? {
              status:
                submission.status ===
                "submitted"
                  ? "under_review"
                  : submission.status,
              score:
                submission.score === null
                  ? ""
                  : String(
                      submission.score,
                    ),
              feedback:
                submission
                  .reviewer_feedback ??
                "",
            };

          const isSelected =
            selectedId ===
            submission.id;

          return (
            <article
              className="card"
              key={submission.id}
            >
              <div className="page-header">
                <div>
                  <p className="eyebrow">
                    {course?.title ??
                      "Course"}
                  </p>

                  <h2>
                    {task?.title ??
                      "Practical task"}
                  </h2>

                  <p className="muted">
                    Learner:{" "}
                    {student?.display_name ||
                      student?.email ||
                      submission.student_id}
                  </p>
                </div>

                <span className="status-badge">
                  {statusLabel(
                    submission.status,
                  )}
                </span>
              </div>

              <div className="stack">
                <div>
                  <strong>
                    Submitted
                  </strong>

                  <p>
                    {formatDate(
                      submission.submitted_at,
                    )}
                  </p>
                </div>

                <div>
                  <strong>
                    Scenario
                  </strong>

                  <p>
                    {task?.scenario ??
                      "—"}
                  </p>
                </div>

                <div>
                  <strong>
                    Expected outcome
                  </strong>

                  <p>
                    {task?.expected_outcome ??
                      "—"}
                  </p>
                </div>

                <div>
                  <strong>
                    Learner submission
                  </strong>

                  <div
                    className="card"
                    style={{
                      whiteSpace:
                        "pre-wrap",
                      maxHeight:
                        isSelected
                          ? undefined
                          : "180px",
                      overflow:
                        isSelected
                          ? undefined
                          : "auto",
                    }}
                  >
                    {submission.submission_text ||
                      "No text submission provided."}
                  </div>
                </div>

                {isSelected ? (
                  <div className="card">
                    <h3>
                      Review
                    </h3>

                    <div className="stack">
                      <label>
                        <span>
                          Decision
                        </span>

                        <select
                          value={
                            draft.status
                          }
                          onChange={(
                            event,
                          ) =>
                            updateDraft(
                              submission.id,
                              {
                                status:
                                  event
                                    .target
                                    .value as Status,
                              },
                            )
                          }
                        >
                          <option value="under_review">
                            Under review
                          </option>

                          <option value="approved">
                            Approved
                          </option>

                          <option value="revision_required">
                            Revision required
                          </option>
                        </select>
                      </label>

                      <label>
                        <span>
                          Score
                          {task
                            ? ` (0–${task.max_score})`
                            : ""}
                        </span>

                        <input
                          type="number"
                          min="0"
                          max={
                            task?.max_score ??
                            100
                          }
                          value={
                            draft.score
                          }
                          onChange={(
                            event,
                          ) =>
                            updateDraft(
                              submission.id,
                              {
                                score:
                                  event
                                    .target
                                    .value,
                              },
                            )
                          }
                        />
                      </label>

                      <label>
                        <span>
                          Reviewer feedback
                        </span>

                        <textarea
                          rows={7}
                          value={
                            draft.feedback
                          }
                          onChange={(
                            event,
                          ) =>
                            updateDraft(
                              submission.id,
                              {
                                feedback:
                                  event
                                    .target
                                    .value,
                              },
                            )
                          }
                          placeholder="Explain what was done well, what needs improvement, and what the learner should do next."
                        />
                      </label>

                      <div className="actions">
                        <button
                          type="button"
                          className="button primary"
                          disabled={
                            saving
                          }
                          onClick={() =>
                            saveReview(
                              submission,
                            )
                          }
                        >
                          {saving
                            ? "Saving..."
                            : "Save review"}
                        </button>

                        <button
                          type="button"
                          className="button secondary"
                          onClick={() =>
                            setSelectedId(
                              null,
                            )
                          }
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="actions">
                  <button
                    type="button"
                    className="button primary"
                    onClick={() =>
                      setSelectedId(
                        isSelected
                          ? null
                          : submission.id,
                      )
                    }
                  >
                    {isSelected
                      ? "Hide review"
                      : "Review submission"}
                  </button>
                </div>
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}