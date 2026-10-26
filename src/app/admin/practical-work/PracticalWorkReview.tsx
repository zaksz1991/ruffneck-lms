"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type Status =
  | "draft"
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

  evidence_file_path: string | null;
  evidence_file_name: string | null;
  evidence_file_type: string | null;
  evidence_file_size: number | null;
  evidence_file_url?: string | null;
  evidence_recorded_at?: string | null;

  course_practical_tasks?: {
    id: string;
    course_id: string;
    title: string;
    scenario: string;
    expected_outcome: string | null;
    submission_type: string;
    max_score: number;
    sort_order: number;
    skill_id?: string | null;
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

type ApiResponse = {
  error?: string;
  message?: string;
  success?: boolean;
  approval_saved?: boolean;
  evidence_recorded?: boolean;
  submission?: {
    status?: Status;
    score?: number | null;
    reviewer_feedback?: string | null;
    reviewed_at?: string | null;
    evidence_recorded_at?: string | null;
    evidence_file_url?: string | null;
  };
};

type Filter = "all" | Status;

const REVIEW_API = "/api/admin/practical-work";

const FILTERS: {
  value: Filter;
  label: string;
}[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under review" },
  {
    value: "revision_required",
    label: "Revision required",
  },
  { value: "approved", label: "Approved" },
];

function createDraft(
  submission: Submission,
): ReviewDraft {
  return {
    status:
      submission.status === "submitted"
        ? "under_review"
        : submission.status,
    score:
      submission.score === null
        ? ""
        : String(submission.score),
    feedback:
      submission.reviewer_feedback ?? "",
  };
}

function formatDate(
  value: string | null | undefined,
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatFileSize(
  bytes: number | null,
): string {
  if (
    bytes === null ||
    !Number.isFinite(bytes) ||
    bytes <= 0
  ) {
    return "";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusLabel(status: Status): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "submitted":
      return "Submitted";
    case "under_review":
      return "Under review";
    case "approved":
      return "Approved";
    case "revision_required":
      return "Revision required";
  }
}

function evidenceLabel(
  type: string | null,
): string {
  if (!type) {
    return "Evidence file";
  }

  if (type === "application/pdf") {
    return "PDF";
  }

  if (
    type.includes("wordprocessingml") ||
    type === "application/msword"
  ) {
    return "Word document";
  }

  if (
    type.includes("spreadsheetml") ||
    type === "application/vnd.ms-excel"
  ) {
    return "Excel spreadsheet";
  }

  if (
    type.includes("presentationml") ||
    type === "application/vnd.ms-powerpoint"
  ) {
    return "PowerPoint presentation";
  }

  if (type.startsWith("image/")) {
    return "Image";
  }

  if (type === "text/csv") {
    return "CSV";
  }

  if (type === "text/plain") {
    return "Text file";
  }

  return "Evidence file";
}

async function readApiResponse(
  response: Response,
): Promise<ApiResponse> {
  try {
    const result: unknown = await response.json();

    if (
      !result ||
      typeof result !== "object"
    ) {
      return {};
    }

    return result as ApiResponse;
  } catch {
    return {};
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

  const [filter, setFilter] =
    useState<Filter>("all");

  const [loading, setLoading] =
    useState(true);

  const [savingId, setSavingId] =
    useState<string | null>(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadSubmissions = useCallback(
    async (
      resetDraftId?: string,
    ): Promise<boolean> => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          REVIEW_API,
          {
            method: "GET",
            cache: "no-store",
            headers: {
              Accept: "application/json",
            },
          },
        );

        const data =
          await readApiResponse(response);

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Unable to load practical work submissions.",
          );
        }

        const rows = (
          Array.isArray(
            (data as ApiResponse & {
              submissions?: unknown;
            }).submissions,
          )
            ? (data as ApiResponse & {
                submissions: Submission[];
              }).submissions
            : []
        ) as Submission[];

        setSubmissions(rows);

        setDrafts((current) => {
          const next = { ...current };
          const visibleIds = new Set(
            rows.map((row) => row.id),
          );

          for (const row of rows) {
            if (
              !next[row.id] ||
              row.id === resetDraftId
            ) {
              next[row.id] = createDraft(row);
            }
          }

          for (const key of Object.keys(next)) {
            if (!visibleIds.has(key)) {
              delete next[key];
            }
          }

          return next;
        });

        return true;
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load practical work submissions.",
        );

        return false;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

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
      draft: submissions.filter(
        (item) => item.status === "draft",
      ).length,
      submitted: submissions.filter(
        (item) => item.status === "submitted",
      ).length,
      under_review: submissions.filter(
        (item) => item.status === "under_review",
      ).length,
      approved: submissions.filter(
        (item) => item.status === "approved",
      ).length,
      revision_required: submissions.filter(
        (item) => item.status === "revision_required",
      ).length,
    };
  }, [submissions]);

  const evidencePendingCount = useMemo(
    () =>
      submissions.filter(
        (item) =>
          item.status === "approved" &&
          !item.evidence_recorded_at,
      ).length,
    [submissions],
  );

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

    setError("");
    setMessage("");
  }

  async function saveReview(
    submission: Submission,
  ) {
    if (savingId) {
      return;
    }

    if (submission.status === "draft") {
      setError(
        "This work is still a draft. The learner must submit it before it can be reviewed.",
      );
      return;
    }

    const draft = drafts[submission.id];

    if (!draft) {
      setError(
        "The review details could not be loaded. Refresh the submissions and try again.",
      );
      return;
    }

    const needsEvidenceRetry =
      submission.status === "approved" &&
      !submission.evidence_recorded_at;

    /*
     * Completed approvals are immutable in the review API.
     * Only approved submissions with missing evidence can be retried.
     */
    if (
      submission.status === "approved" &&
      !needsEvidenceRetry &&
      draft.status !== "approved"
    ) {
      setError(
        "This submission is already approved and its Skill Passport evidence has been recorded.",
      );
      return;
    }

    setSavingId(submission.id);
    setError("");
    setMessage("");

    const maxScoreValue =
      Number(
        submission.course_practical_tasks
          ?.max_score ?? 100,
      );

    const maxScore =
      Number.isFinite(maxScoreValue) &&
      maxScoreValue > 0
        ? maxScoreValue
        : 100;

    let score: number | null =
      draft.score.trim() === ""
        ? null
        : Number(draft.score);

    /*
     * Permit an evidence retry to use the score already saved
     * with the approval when the score field is left blank.
     */
    if (
      score === null &&
      needsEvidenceRetry &&
      submission.score !== null
    ) {
      score = submission.score;
    }

    if (
      score !== null &&
      (
        !Number.isFinite(score) ||
        score < 0 ||
        score > maxScore
      )
    ) {
      setError(
        `Score must be between 0 and ${maxScore}.`,
      );
      setSavingId(null);
      return;
    }

    if (
      draft.status === "approved" &&
      score === null
    ) {
      setError(
        "An approved submission must have a score.",
      );
      setSavingId(null);
      return;
    }

    if (
      draft.status === "revision_required" &&
      !draft.feedback.trim()
    ) {
      setError(
        "Feedback is required when requesting a revision.",
      );
      setSavingId(null);
      return;
    }

    try {
      const response = await fetch(
        REVIEW_API,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            id: submission.id,
            status: draft.status,
            score,
            reviewer_feedback:
              draft.feedback.trim() || null,
          }),
        },
      );

      const data =
        await readApiResponse(response);

      /*
       * Critical distinction:
       * approval may have been saved even when evidence recording
       * failed afterward. Reload the record, keep it approved, and
       * tell the reviewer precisely what still needs attention.
       */
      const evidenceRecordingFailed =
        draft.status === "approved" &&
        (
          data.evidence_recorded === false ||
          (
            response.ok &&
            data.evidence_recorded !== true
          ) ||
          (
            !response.ok &&
            data.approval_saved === true
          )
        );

      if (evidenceRecordingFailed) {
        await loadSubmissions(submission.id);

        setMessage("");

        setError(
          [
            data.approval_saved === true
              ? "The submission approval was saved, but Skill Passport evidence was not recorded."
              : "The API did not confirm that Skill Passport evidence was recorded.",
            data.error ||
              "Review the server error, then retry evidence recording for this approved submission.",
          ].join(" "),
        );

        return;
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to save the practical work review.",
        );
      }

      /*
       * Require explicit evidence confirmation for approval.
       * Other review decisions do not need to produce Skill Passport evidence.
       */
      if (
        draft.status === "approved" &&
        data.evidence_recorded !== true
      ) {
        await loadSubmissions(submission.id);

        setError(
          "Approval may have been saved, but the API did not confirm evidence recording. Please retry after checking the server response.",
        );

        return;
      }

      const refreshed = await loadSubmissions(
        submission.id,
      );

      if (!refreshed) {
        setMessage(
          draft.status === "approved"
            ? "Approval and evidence recording were confirmed. Refresh the list to view the updated record."
            : "Review saved. Refresh the list to see the latest submission status.",
        );

        return;
      }

      if (draft.status === "approved") {
        setMessage(
          "Practical work approved. Skill Passport evidence was successfully recorded.",
        );
      } else if (
        draft.status === "revision_required"
      ) {
        setMessage(
          "Revision request saved. The learner can review the feedback and resubmit.",
        );
      } else {
        setMessage(
          "Practical work review saved.",
        );
      }
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save the practical work review.",
      );
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="stack">
      {error ? (
        <div
          className="alert error"
          role="alert"
          style={{
            overflowWrap: "anywhere",
          }}
        >
          {error}
        </div>
      ) : null}

      {message ? (
        <div
          className="alert success"
          role="status"
        >
          {message}
        </div>
      ) : null}

      {evidencePendingCount > 0 ? (
        <section
          className="card"
          style={{
            border: "1px solid #f59e0b",
            background: "#fffbeb",
          }}
        >
          <h3
            style={{
              marginTop: 0,
              color: "#92400e",
            }}
          >
            Skill Passport evidence needs attention
          </h3>

          <p
            style={{
              marginBottom: 0,
              color: "#78350f",
              lineHeight: 1.7,
            }}
          >
            {evidencePendingCount} approved{" "}
            {evidencePendingCount === 1
              ? "submission has"
              : "submissions have"}{" "}
            no recorded evidence timestamp. Select an
            affected submission and retry evidence
            recording.
          </p>
        </section>
      ) : null}

      <section className="card">
        <div
          className="actions"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          {FILTERS.map(({ value, label }) => {
            const count =
              counts[value as keyof typeof counts];

            return (
              <button
                key={value}
                type="button"
                className={
                  filter === value
                    ? "button primary"
                    : "button secondary"
                }
                onClick={() => setFilter(value)}
                aria-pressed={filter === value}
              >
                {label} ({count})
              </button>
            );
          })}

          <button
            type="button"
            className="button secondary"
            disabled={loading || Boolean(savingId)}
            onClick={() => {
              setMessage("");
              void loadSubmissions();
            }}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </section>

      {loading ? (
        <section
          className="card"
          aria-live="polite"
        >
          <p>Loading learner submissions...</p>
        </section>
      ) : filtered.length === 0 ? (
        <section className="card">
          <h2>No submissions</h2>

          <p className="muted">
            There are no practical submissions matching
            this filter.
          </p>
        </section>
      ) : (
        filtered.map((submission) => {
          const task =
            submission.course_practical_tasks;

          const course = task?.courses;
          const student = submission.student;

          const draft =
            drafts[submission.id] ??
            createDraft(submission);

          const isSelected =
            selectedId === submission.id;

          const isSaving =
            savingId === submission.id;

          const evidenceRecorded =
            Boolean(submission.evidence_recorded_at);

          const needsEvidenceRetry =
            submission.status === "approved" &&
            !evidenceRecorded;

          const reviewLocked =
            submission.status === "approved" &&
            evidenceRecorded;

          const isDraft =
            submission.status === "draft";

          const maxScore =
            Number.isFinite(
              Number(task?.max_score),
            ) &&
            Number(task?.max_score) > 0
              ? Number(task?.max_score)
              : 100;

          return (
            <article
              className="card"
              key={submission.id}
            >
              <header
                className="page-header"
                style={{
                  gap: "1rem",
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    minWidth: 0,
                    flex: "1 1 18rem",
                  }}
                >
                  <p className="eyebrow">
                    {course?.title ?? "Course"}
                  </p>

                  <h2>
                    {task?.title ?? "Practical task"}
                  </h2>

                  <p className="muted">
                    Learner:{" "}
                    {student?.display_name ||
                      student?.email ||
                      submission.student_id}
                  </p>

                  {student?.email &&
                  student?.display_name ? (
                    <p className="muted">
                      {student.email}
                    </p>
                  ) : null}
                </div>

                <span className="status-badge">
                  {statusLabel(submission.status)}
                </span>
              </header>

              {needsEvidenceRetry ? (
                <div
                  className="alert error"
                  role="status"
                  style={{
                    marginTop: "1rem",
                  }}
                >
                  <strong>Evidence not recorded.</strong>{" "}
                  Approval is saved, but the Skill Passport
                  evidence timestamp is missing. Retry
                  recording below.
                </div>
              ) : null}

              {evidenceRecorded ? (
                <div
                  className="alert success"
                  role="status"
                  style={{
                    marginTop: "1rem",
                  }}
                >
                  <strong>
                    Skill Passport evidence recorded.
                  </strong>

                  <p
                    style={{
                      marginBottom: 0,
                      marginTop: "0.35rem",
                    }}
                  >
                    Recorded at:{" "}
                    {formatDate(
                      submission.evidence_recorded_at,
                    )}
                  </p>
                </div>
              ) : null}

              <div className="stack">
                <div>
                  <strong>Submitted</strong>

                  <p>
                    {formatDate(submission.submitted_at)}
                  </p>
                </div>

                {submission.reviewed_at ? (
                  <div>
                    <strong>Last reviewed</strong>

                    <p>
                      {formatDate(submission.reviewed_at)}
                    </p>
                  </div>
                ) : null}

                <div>
                  <strong>Scenario</strong>

                  <p>
                    {task?.scenario ?? "—"}
                  </p>
                </div>

                <div>
                  <strong>Expected outcome</strong>

                  <p>
                    {task?.expected_outcome ?? "—"}
                  </p>
                </div>

                <div>
                  <strong>Submission type</strong>

                  <p>
                    {task?.submission_type ?? "—"}
                  </p>
                </div>

                <div>
                  <strong>Learner submission</strong>

                  <div
                    className="card"
                    style={{
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                      maxHeight: isSelected
                        ? undefined
                        : "180px",
                      overflow: isSelected
                        ? undefined
                        : "auto",
                    }}
                  >
                    {submission.submission_text ||
                      "No text submission provided."}
                  </div>
                </div>

                {submission.evidence_file_name ? (
                  <section
                    className="card"
                    style={{
                      border: "1px solid #cbd5e1",
                      background: "#f8fafc",
                      overflowWrap: "anywhere",
                    }}
                  >
                    <h3>Submitted evidence</h3>

                    <p>
                      <strong>File:</strong>{" "}
                      {submission.evidence_file_name}
                    </p>

                    <p>
                      <strong>Type:</strong>{" "}
                      {evidenceLabel(
                        submission.evidence_file_type,
                      )}
                    </p>

                    {submission.evidence_file_size ? (
                      <p>
                        <strong>Size:</strong>{" "}
                        {formatFileSize(
                          submission.evidence_file_size,
                        )}
                      </p>
                    ) : null}

                    {submission.evidence_file_url ? (
                      <a
                        href={submission.evidence_file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="button primary"
                        style={{
                          display: "inline-block",
                          textDecoration: "none",
                        }}
                      >
                        Open evidence
                      </a>
                    ) : (
                      <p className="muted">
                        The evidence file is currently
                        unavailable. Its signed link may
                        have expired; refresh the list to
                        request a new one.
                      </p>
                    )}
                  </section>
                ) : (
                  <section className="card">
                    <strong>Evidence file</strong>

                    <p className="muted">
                      No evidence file was attached to
                      this submission. The written
                      submission can still be reviewed
                      according to the task requirements.
                    </p>
                  </section>
                )}

                {submission.score !== null ? (
                  <div>
                    <strong>Saved score</strong>

                    <p>
                      {submission.score} / {maxScore}
                    </p>
                  </div>
                ) : null}

                {submission.reviewer_feedback ? (
                  <div>
                    <strong>Reviewer feedback</strong>

                    <p
                      style={{
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {submission.reviewer_feedback}
                    </p>
                  </div>
                ) : null}

                {isSelected ? (
                  <section className="card">
                    <h3>Review</h3>

                    {isDraft ? (
                      <p
                        className="muted"
                        role="status"
                      >
                        This submission is still a draft.
                        The learner must submit it before
                        it can be reviewed.
                      </p>
                    ) : reviewLocked ? (
                      <div
                        className="alert success"
                        role="status"
                      >
                        This submission is approved and
                        its Skill Passport evidence has
                        been recorded. The review is
                        locked.
                      </div>
                    ) : (
                      <div className="stack">
                        <label>
                          <span>Decision</span>

                          <select
                            value={draft.status}
                            disabled={Boolean(savingId)}
                            onChange={(event) =>
                              updateDraft(
                                submission.id,
                                {
                                  status:
                                    event.target
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
                            Score (0–{maxScore})
                          </span>

                          <input
                            type="number"
                            min="0"
                            max={maxScore}
                            step="any"
                            value={draft.score}
                            disabled={Boolean(savingId)}
                            onChange={(event) =>
                              updateDraft(
                                submission.id,
                                {
                                  score:
                                    event.target.value,
                                },
                              )
                            }
                          />
                        </label>

                        <label>
                          <span>Reviewer feedback</span>

                          <textarea
                            rows={7}
                            maxLength={10_000}
                            value={draft.feedback}
                            disabled={Boolean(savingId)}
                            onChange={(event) =>
                              updateDraft(
                                submission.id,
                                {
                                  feedback:
                                    event.target.value,
                                },
                              )
                            }
                            placeholder="Explain what was done well, what needs improvement, and what the learner should do next."
                          />

                          <small>
                            {draft.feedback.length.toLocaleString()} / 10,000 characters
                          </small>
                        </label>

                        {draft.status === "approved" ? (
                          <p className="muted">
                            Saving approval should also
                            record Skill Passport evidence.
                            The interface will report a
                            separate error if the API
                            cannot confirm that recording.
                          </p>
                        ) : null}

                        {draft.status ===
                        "revision_required" ? (
                          <p className="muted">
                            Feedback is required when
                            requesting a revision.
                          </p>
                        ) : null}

                        <div className="actions">
                          <button
                            type="button"
                            className="button primary"
                            disabled={Boolean(savingId)}
                            onClick={() =>
                              saveReview(submission)
                            }
                          >
                            {isSaving
                              ? "Saving..."
                              : needsEvidenceRetry &&
                                  draft.status === "approved"
                                ? "Retry evidence recording"
                                : "Save review"}
                          </button>

                          <button
                            type="button"
                            className="button secondary"
                            disabled={Boolean(savingId)}
                            onClick={() =>
                              setSelectedId(null)
                            }
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    )}
                  </section>
                ) : null}

                <div className="actions">
                  <button
                    type="button"
                    className="button primary"
                    disabled={isDraft}
                    onClick={() =>
                      setSelectedId(
                        isSelected
                          ? null
                          : submission.id,
                      )
                    }
                  >
                    {isDraft
                      ? "Waiting for learner submission"
                      : isSelected
                        ? "Hide review"
                        : needsEvidenceRetry
                          ? "Retry evidence recording"
                          : reviewLocked
                            ? "View completed review"
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