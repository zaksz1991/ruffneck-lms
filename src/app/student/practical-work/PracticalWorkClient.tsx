"use client";

import {
  ChangeEvent,
  FormEvent,
  useState,
} from "react";

type SubmissionStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_required";

type PracticalSubmission = {
  id: string;
  task_id: string;
  student_id: string;
  submission_text: string | null;
  status: SubmissionStatus;
  score: number | null;
  reviewer_feedback: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  evidence_file_path: string | null;
  evidence_file_name: string | null;
  evidence_file_type: string | null;
  evidence_file_size: number | null;
  evidence_recorded_at: string | null;
  evidence_file_url?: string | null;
};

type PracticalTask = {
  id: string;
  course_id: string;
  title: string;
  scenario: string;
  instructions: string;
  expected_outcome: string;
  submission_type:
    | "text"
    | "document"
    | "spreadsheet"
    | "presentation"
    | "mixed";
  max_score: number;
  sort_order: number;
  is_published: boolean;
  skill_id: string | null;
  submission: PracticalSubmission | null;
};

type Props = {
  tasks: PracticalTask[];
};

const MAX_FILE_SIZE =
  10 * 1024 * 1024;

const ACCEPTED_FILE_TYPES = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".csv",
  ".txt",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
].join(",");

function formatFileSize(
  bytes: number | null | undefined
) {
  if (!bytes || bytes <= 0) {
    return "";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

function statusLabel(
  status: SubmissionStatus | null
) {
  switch (status) {
    case "submitted":
      return "Submitted";

    case "under_review":
      return "Under review";

    case "approved":
      return "Approved";

    case "revision_required":
      return "Revision required";

    case "draft":
      return "Draft";

    default:
      return "Not submitted";
  }
}

function statusClass(
  status: SubmissionStatus | null
) {
  switch (status) {
    case "approved":
      return "rn-alert rn-alert-success";

    case "revision_required":
      return "rn-alert rn-alert-warning";

    case "under_review":
      return "rn-alert rn-alert-info";

    case "submitted":
      return "rn-alert rn-alert-info";

    default:
      return "rn-alert";
  }
}

function requiresEvidence(
  submissionType: PracticalTask["submission_type"]
) {
  return submissionType !== "text";
}

export default function PracticalWorkClient({
  tasks,
}: Props) {
  const [drafts, setDrafts] =
    useState<
      Record<string, string>
    >(() => {
      const initial: Record<
        string,
        string
      > = {};

      for (const task of tasks) {
        initial[task.id] =
          task.submission
            ?.submission_text ?? "";
      }

      return initial;
    });

  const [
    selectedFiles,
    setSelectedFiles,
  ] = useState<
    Record<
      string,
      File | null
    >
  >({});

  const [busyTaskId, setBusyTaskId] =
    useState<string | null>(null);

  const [messages, setMessages] =
    useState<
      Record<string, string>
    >({});

  const [errors, setErrors] =
    useState<
      Record<string, string>
    >({});

  function updateDraft(
    taskId: string,
    value: string
  ) {
    setDrafts((current) => ({
      ...current,
      [taskId]: value,
    }));
  }

  function handleFileChange(
    taskId: string,
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0] ??
      null;

    setErrors((current) => ({
      ...current,
      [taskId]: "",
    }));

    setMessages((current) => ({
      ...current,
      [taskId]: "",
    }));

    if (!file) {
      setSelectedFiles(
        (current) => ({
          ...current,
          [taskId]: null,
        })
      );

      return;
    }

    if (
      file.size > MAX_FILE_SIZE
    ) {
      setSelectedFiles(
        (current) => ({
          ...current,
          [taskId]: null,
        })
      );

      setErrors((current) => ({
        ...current,
        [taskId]:
          "This file is too large. Maximum file size is 10 MB.",
      }));

      event.target.value = "";

      return;
    }

    setSelectedFiles(
      (current) => ({
        ...current,
        [taskId]: file,
      })
    );
  }

  async function submitTask(
    task: PracticalTask,
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const submission =
      task.submission;

    if (
      submission?.status ===
        "approved" ||
      submission?.status ===
        "under_review"
    ) {
      return;
    }

    const submissionText =
      drafts[task.id]?.trim() ?? "";

    const evidenceFile =
      selectedFiles[task.id] ??
      null;

    if (
      !submissionText &&
      !evidenceFile
    ) {
      setErrors((current) => ({
        ...current,
        [task.id]:
          requiresEvidence(
            task.submission_type
          )
            ? "Provide your practical response or attach an evidence file before submitting."
            : "Enter your practical response before submitting.",
      }));

      return;
    }

    if (
      evidenceFile &&
      evidenceFile.size >
        MAX_FILE_SIZE
    ) {
      setErrors((current) => ({
        ...current,
        [task.id]:
          "This file is too large. Maximum file size is 10 MB.",
      }));

      return;
    }

    setBusyTaskId(task.id);

    setErrors((current) => ({
      ...current,
      [task.id]: "",
    }));

    setMessages((current) => ({
      ...current,
      [task.id]: "",
    }));

    try {
      const formData =
        new FormData();

      formData.append(
        "taskId",
        task.id
      );

      formData.append(
        "submissionText",
        submissionText
      );

      if (evidenceFile) {
        formData.append(
          "evidenceFile",
          evidenceFile
        );
      }

      const response =
        await fetch(
          "/api/student/practical-work",
          {
            method: "POST",
            body: formData,
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "Unable to submit your practical work."
        );
      }

      setMessages((current) => ({
        ...current,
        [task.id]:
          "Your practical work has been submitted successfully.",
      }));

      setSelectedFiles(
        (current) => ({
          ...current,
          [task.id]: null,
        })
      );

      window.location.reload();
    } catch (error) {
      setErrors((current) => ({
        ...current,
        [task.id]:
          error instanceof Error
            ? error.message
            : "Unable to submit your practical work.",
      }));
    } finally {
      setBusyTaskId(null);
    }
  }

  if (tasks.length === 0) {
    return (
      <div className="rn-alert">
        No practical tasks are currently
        available for your enrolled courses.
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gap: "1.5rem",
      }}
    >
      {tasks.map((task) => {
        const submission =
          task.submission;

        const locked =
          submission?.status ===
            "approved" ||
          submission?.status ===
            "under_review";

        const selectedFile =
          selectedFiles[task.id] ??
          null;

        return (
          <article
            key={task.id}
            className="rn-card"
            style={{
              padding: "1.5rem",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "flex-start",
                gap: "1rem",
                flexWrap: "wrap",
              }}
            >
              <div>
                <h2
                  style={{
                    marginTop: 0,
                    marginBottom:
                      "0.5rem",
                  }}
                >
                  {task.title}
                </h2>

                <p
                  style={{
                    margin: 0,
                    color:
                      "#64748b",
                  }}
                >
                  Submission type:{" "}
                  <strong>
                    {task.submission_type}
                  </strong>{" "}
                  · Maximum score:{" "}
                  <strong>
                    {task.max_score}
                  </strong>
                </p>
              </div>

              <span
                className={statusClass(
                  submission?.status ??
                    null
                )}
                style={{
                  display:
                    "inline-block",
                }}
              >
                {statusLabel(
                  submission?.status ??
                    null
                )}
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gap: "1rem",
                marginTop:
                  "1.25rem",
              }}
            >
              <section>
                <h3>
                  Scenario
                </h3>

                <p>
                  {task.scenario}
                </p>
              </section>

              <section>
                <h3>
                  Instructions
                </h3>

                <p
                  style={{
                    whiteSpace:
                      "pre-wrap",
                  }}
                >
                  {task.instructions}
                </p>
              </section>

              <section>
                <h3>
                  Expected outcome
                </h3>

                <p>
                  {task.expected_outcome}
                </p>
              </section>
            </div>

            {submission?.reviewer_feedback ? (
              <div
                className={
                  submission.status ===
                  "revision_required"
                    ? "rn-alert rn-alert-warning"
                    : "rn-alert rn-alert-info"
                }
                style={{
                  marginTop:
                    "1.25rem",
                }}
              >
                <strong>
                  Reviewer feedback
                </strong>

                <p
                  style={{
                    marginBottom: 0,
                    whiteSpace:
                      "pre-wrap",
                  }}
                >
                  {
                    submission.reviewer_feedback
                  }
                </p>

                {submission.score !==
                  null && (
                  <p
                    style={{
                      marginBottom: 0,
                    }}
                  >
                    Score:{" "}
                    <strong>
                      {
                        submission.score
                      }{" "}
                      /{" "}
                      {
                        task.max_score
                      }
                    </strong>
                  </p>
                )}
              </div>
            ) : null}

            {submission?.evidence_file_name ? (
              <div
                style={{
                  marginTop:
                    "1.25rem",
                  padding:
                    "0.9rem 1rem",
                  border:
                    "1px solid #e2e8f0",
                  borderRadius:
                    "0.75rem",
                  background:
                    "#f8fafc",
                }}
              >
                <strong>
                  Submitted evidence
                </strong>

                <div
                  style={{
                    marginTop:
                      "0.35rem",
                  }}
                >
                  {submission.evidence_file_name}

                  {submission.evidence_file_size ? (
                    <span
                      style={{
                        marginLeft:
                          "0.5rem",
                        color:
                          "#64748b",
                      }}
                    >
                      (
                      {formatFileSize(
                        submission.evidence_file_size
                      )}
                      )
                    </span>
                  ) : null}
                </div>

                {submission.evidence_file_url ? (
                  <a
                    href={
                      submission.evidence_file_url
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display:
                        "inline-block",
                      marginTop:
                        "0.6rem",
                      fontWeight: 700,
                    }}
                  >
                    Open evidence
                  </a>
                ) : null}
              </div>
            ) : null}

            <form
              onSubmit={(event) =>
                submitTask(
                  task,
                  event
                )
              }
              style={{
                marginTop:
                  "1.5rem",
              }}
            >
              <label
                htmlFor={`submission-${task.id}`}
                style={{
                  display:
                    "block",
                  fontWeight: 700,
                  marginBottom:
                    "0.5rem",
                }}
              >
                Your practical response
              </label>

              <textarea
                id={`submission-${task.id}`}
                value={
                  drafts[task.id] ??
                  ""
                }
                onChange={(event) =>
                  updateDraft(
                    task.id,
                    event.target
                      .value
                  )
                }
                disabled={locked}
                rows={10}
                maxLength={50000}
                placeholder={
                  locked
                    ? "This submission is currently locked."
                    : "Complete the practical task and explain the work you performed, decisions you made, and result achieved."
                }
                style={{
                  width: "100%",
                  boxSizing:
                    "border-box",
                  resize:
                    "vertical",
                  padding:
                    "0.9rem",
                  border:
                    "1px solid #cbd5e1",
                  borderRadius:
                    "0.75rem",
                  font: "inherit",
                }}
              />

              <div
                style={{
                  marginTop:
                    "1rem",
                }}
              >
                <label
                  htmlFor={`evidence-${task.id}`}
                  style={{
                    display:
                      "block",
                    fontWeight: 700,
                    marginBottom:
                      "0.35rem",
                  }}
                >
                  Attach evidence
                  {requiresEvidence(
                    task.submission_type
                  )
                    ? " *"
                    : ""}
                </label>

                <p
                  style={{
                    marginTop: 0,
                    color:
                      "#64748b",
                    fontSize:
                      "0.9rem",
                  }}
                >
                  Upload the actual work
                  you produced for this
                  task. Maximum 10 MB.
                </p>

                <input
                  id={`evidence-${task.id}`}
                  type="file"
                  accept={
                    ACCEPTED_FILE_TYPES
                  }
                  onChange={(event) =>
                    handleFileChange(
                      task.id,
                      event
                    )
                  }
                  disabled={locked}
                />

                {selectedFile ? (
                  <div
                    style={{
                      marginTop:
                        "0.5rem",
                      color:
                        "#334155",
                    }}
                  >
                    Selected:{" "}
                    <strong>
                      {
                        selectedFile.name
                      }
                    </strong>{" "}
                    (
                    {formatFileSize(
                      selectedFile.size
                    )}
                    )
                  </div>
                ) : null}
              </div>

              {errors[task.id] ? (
                <div
                  className="rn-alert rn-alert-error"
                  style={{
                    marginTop:
                      "1rem",
                  }}
                >
                  {errors[task.id]}
                </div>
              ) : null}

              {messages[task.id] ? (
                <div
                  className="rn-alert rn-alert-success"
                  style={{
                    marginTop:
                      "1rem",
                  }}
                >
                  {messages[task.id]}
                </div>
              ) : null}

              <div
                style={{
                  display: "flex",
                  alignItems:
                    "center",
                  gap: "0.75rem",
                  flexWrap:
                    "wrap",
                  marginTop:
                    "1rem",
                }}
              >
                <button
                  type="submit"
                  className="rn-button rn-button-primary"
                  disabled={
                    locked ||
                    busyTaskId ===
                      task.id
                  }
                >
                  {busyTaskId ===
                  task.id
                    ? "Submitting..."
                    : submission?.status ===
                        "revision_required"
                      ? "Resubmit Practical Work"
                      : "Submit Practical Work"}
                </button>

                {locked ? (
                  <span
                    style={{
                      color:
                        "#64748b",
                      fontSize:
                        "0.9rem",
                    }}
                  >
                    This submission is{" "}
                    {submission?.status ===
                    "approved"
                      ? "approved."
                      : "currently under review."}
                  </span>
                ) : null}
              </div>
            </form>
          </article>
        );
      })}
    </div>
  );
}