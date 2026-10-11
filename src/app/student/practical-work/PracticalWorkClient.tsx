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

const MAX_FILE_SIZE = 10 * 1024 * 1024;

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

const styles = `
  .pwc-list {
    display: grid;
    gap: 20px;
    color: #172b43;
  }

  .pwc-list *,
  .pwc-list *::before,
  .pwc-list *::after {
    box-sizing: border-box;
  }

  .pwc-empty {
    padding: 24px;
    color: #53667c;
    background: #f8fafc;
    border: 1px dashed #cbd8e5;
    border-radius: 14px;
    font-size: 14px;
    line-height: 1.7;
  }

  .pwc-card {
    min-width: 0;
    padding: 25px;
    background: #fff;
    border: 1px solid #dfe7ef;
    border-radius: 17px;
    box-shadow: 0 5px 18px rgba(11, 30, 58, .035);
    transition: border-color .18s ease, box-shadow .18s ease;
  }

  .pwc-card:hover {
    border-color: #c3dce9;
    box-shadow: 0 9px 24px rgba(11, 30, 58, .065);
  }

  .pwc-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    flex-wrap: wrap;
  }

  .pwc-card-title {
    margin: 0;
    color: #0b1e3a;
    font-size: 22px;
    font-weight: 850;
    line-height: 1.35;
    letter-spacing: -.025em;
    overflow-wrap: anywhere;
  }

  .pwc-task-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 11px;
  }

  .pwc-meta-chip {
    display: inline-flex;
    align-items: center;
    padding: 6px 10px;
    border: 1px solid #e1eaf1;
    border-radius: 7px;
    background: #f5f8fb;
    color: #52667c;
    font-size: 12px;
    font-weight: 700;
  }

  .pwc-meta-chip strong {
    margin-left: 4px;
    color: #19334e;
  }

  .pwc-status {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    flex-shrink: 0;
    padding: 8px 11px;
    border: 1px solid #dbe4ed;
    border-radius: 100px;
    background: #f1f5f9;
    color: #465970;
    font-size: 11px;
    font-weight: 850;
    line-height: 1.4;
  }

  .pwc-status::before {
    content: "";
    width: 7px;
    height: 7px;
    flex-shrink: 0;
    border-radius: 50%;
    background: #8292a6;
  }

  .pwc-status-submitted,
  .pwc-status-review {
    color: #075d80;
    background: #eaf7ff;
    border-color: #c5e7f8;
  }

  .pwc-status-submitted::before,
  .pwc-status-review::before {
    background: #0b93c4;
  }

  .pwc-status-approved {
    color: #126943;
    background: #eafaf2;
    border-color: #b7e8d1;
  }

  .pwc-status-approved::before {
    background: #15945b;
  }

  .pwc-status-revision {
    color: #92500a;
    background: #fff7e7;
    border-color: #f6dfac;
  }

  .pwc-status-revision::before {
    background: #e8a126;
  }

  .pwc-status-draft {
    color: #596b80;
    background: #f1f5f9;
    border-color: #dbe4ed;
  }

  .pwc-task-sections {
    display: grid;
    gap: 12px;
    margin-top: 23px;
  }

  .pwc-info-block {
    min-width: 0;
    padding: 16px 17px;
    background: #f8fafc;
    border: 1px solid #e6edf4;
    border-radius: 12px;
  }

  .pwc-info-heading {
    display: flex;
    align-items: center;
    gap: 9px;
    margin: 0 0 8px;
    color: #0b1e3a;
    font-size: 14px;
    font-weight: 850;
  }

  .pwc-info-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 25px;
    height: 25px;
    flex-shrink: 0;
    border-radius: 7px;
    background: #dff8fc;
    color: #07647c;
    font-size: 11px;
    font-weight: 850;
  }

  .pwc-info-content {
    margin: 0;
    color: #53667c;
    font-size: 14px;
    line-height: 1.8;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .pwc-feedback {
    margin-top: 18px;
    padding: 17px;
    border: 1px solid #c7e6f7;
    border-radius: 12px;
    background: #f0f9ff;
  }

  .pwc-feedback-warning {
    border-color: #f4dda8;
    background: #fffaed;
  }

  .pwc-feedback-heading {
    margin: 0 0 8px;
    color: #075985;
    font-size: 14px;
    font-weight: 850;
  }

  .pwc-feedback-warning .pwc-feedback-heading {
    color: #92500a;
  }

  .pwc-feedback-text {
    margin: 0;
    color: #3e566d;
    font-size: 14px;
    line-height: 1.8;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .pwc-score {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    margin-top: 12px;
    padding: 7px 10px;
    border-radius: 8px;
    background: rgba(255,255,255,.75);
    color: #19334e;
    font-size: 13px;
  }

  .pwc-evidence-existing {
    display: flex;
    align-items: flex-start;
    gap: 13px;
    margin-top: 18px;
    padding: 16px;
    border: 1px solid #dce8f1;
    border-radius: 12px;
    background: #f8fbfe;
  }

  .pwc-file-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 40px;
    height: 44px;
    border: 1px solid #ccebf3;
    border-radius: 9px;
    background: #e6f9fc;
    color: #087f9c;
    font-size: 11px;
    font-weight: 900;
    text-transform: uppercase;
  }

  .pwc-file-info {
    min-width: 0;
    flex: 1;
  }

  .pwc-file-name {
    display: block;
    color: #19334e;
    font-size: 13px;
    font-weight: 800;
    line-height: 1.6;
    overflow-wrap: anywhere;
  }

  .pwc-file-size {
    display: block;
    margin-top: 3px;
    color: #718198;
    font-size: 12px;
  }

  .pwc-file-link {
    display: inline-block;
    margin-top: 9px;
    color: #087f9c;
    font-size: 13px;
    font-weight: 850;
    text-decoration: none;
  }

  .pwc-file-link:hover {
    text-decoration: underline;
  }

  .pwc-form {
    margin-top: 23px;
    padding-top: 22px;
    border-top: 1px solid #e6edf4;
  }

  .pwc-form-heading {
    margin: 0 0 5px;
    color: #0b1e3a;
    font-size: 17px;
    font-weight: 850;
  }

  .pwc-form-description {
    margin: 0 0 17px;
    color: #64748b;
    font-size: 13px;
    line-height: 1.7;
  }

  .pwc-label {
    display: block;
    margin-bottom: 8px;
    color: #19334e;
    font-size: 13px;
    font-weight: 800;
  }

  .pwc-required {
    color: #c2410c;
  }

  .pwc-textarea {
    display: block;
    width: 100%;
    min-height: 180px;
    padding: 13px 14px;
    resize: vertical;
    border: 1px solid #cbd7e3;
    border-radius: 10px;
    outline: none;
    background: #fff;
    color: #172b43;
    font: inherit;
    font-size: 14px;
    line-height: 1.75;
    transition: border-color .18s ease, box-shadow .18s ease;
  }

  .pwc-textarea:focus {
    border-color: #00a4c8;
    box-shadow: 0 0 0 3px rgba(0, 180, 216, .13);
  }

  .pwc-textarea:disabled {
    background: #f1f5f9;
    color: #718198;
    cursor: not-allowed;
  }

  .pwc-character-count {
    margin-top: 6px;
    color: #8290a2;
    text-align: right;
    font-size: 11px;
  }

  .pwc-upload {
    margin-top: 20px;
  }

  .pwc-upload-box {
    padding: 17px;
    border: 1px dashed #bdcfde;
    border-radius: 12px;
    background: #f8fafc;
  }

  .pwc-upload-description {
    margin: 0 0 13px;
    color: #64748b;
    font-size: 13px;
    line-height: 1.7;
  }

  .pwc-file-input {
    display: block;
    width: 100%;
    max-width: 100%;
    color: #41536a;
    font: inherit;
    font-size: 13px;
  }

  .pwc-file-input::file-selector-button {
    margin-right: 12px;
    padding: 9px 12px;
    border: 1px solid #cbd7e3;
    border-radius: 8px;
    background: #fff;
    color: #19334e;
    font: inherit;
    font-weight: 800;
    cursor: pointer;
  }

  .pwc-file-input:disabled {
    opacity: .65;
    cursor: not-allowed;
  }

  .pwc-selected-file {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin-top: 13px;
    padding: 11px 12px;
    border: 1px solid #bcecf4;
    border-radius: 9px;
    background: #effbfe;
  }

  .pwc-selected-file-name {
    min-width: 0;
    flex: 1;
    color: #07566b;
    font-size: 12px;
    font-weight: 800;
    line-height: 1.6;
    overflow-wrap: anywhere;
  }

  .pwc-remove-file {
    flex-shrink: 0;
    padding: 3px 6px;
    border: 0;
    border-radius: 5px;
    background: transparent;
    color: #07566b;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
  }

  .pwc-alert {
    margin-top: 15px;
    padding: 12px 14px;
    border: 1px solid #dbe4ed;
    border-radius: 10px;
    background: #f8fafc;
    color: #40546b;
    font-size: 13px;
    line-height: 1.7;
    overflow-wrap: anywhere;
  }

  .pwc-alert-error {
    border-color: #fecaca;
    background: #fff1f2;
    color: #9f1239;
  }

  .pwc-alert-success {
    border-color: #b7e8d1;
    background: #eafaf2;
    color: #126943;
  }

  .pwc-submit-row {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 18px;
  }

  .pwc-submit-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 45px;
    padding: 11px 17px;
    border: 1px solid transparent;
    border-radius: 10px;
    background: #00b4d8;
    color: #062138;
    font: inherit;
    font-size: 13px;
    font-weight: 850;
    cursor: pointer;
    transition: filter .18s ease, transform .18s ease;
  }

  .pwc-submit-button:hover:not(:disabled) {
    filter: brightness(1.05);
    transform: translateY(-1px);
  }

  .pwc-submit-button:disabled {
    opacity: .6;
    cursor: not-allowed;
    transform: none;
  }

  .pwc-lock-note {
    color: #64748b;
    font-size: 12px;
    line-height: 1.7;
  }

  .pwc-locked-notice {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin-top: 20px;
    padding: 13px 14px;
    border: 1px solid #dbe4ed;
    border-radius: 10px;
    background: #f8fafc;
    color: #52667c;
    font-size: 13px;
    line-height: 1.7;
  }

  .pwc-locked-icon {
    color: #087f9c;
    font-weight: 900;
  }

  @media (max-width: 600px) {
    .pwc-card {
      padding: 17px;
      border-radius: 14px;
    }

    .pwc-card-title {
      font-size: 19px;
    }

    .pwc-card-header {
      gap: 12px;
    }

    .pwc-info-block {
      padding: 13px;
    }

    .pwc-evidence-existing {
      padding: 12px;
    }

    .pwc-form {
      margin-top: 19px;
      padding-top: 19px;
    }

    .pwc-upload-box {
      padding: 13px;
    }

    .pwc-submit-row {
      align-items: stretch;
    }

    .pwc-submit-button {
      width: 100%;
    }

    .pwc-lock-note {
      width: 100%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .pwc-list *,
    .pwc-list *::before,
    .pwc-list *::after {
      transition: none !important;
    }
  }
`;

function formatFileSize(
  bytes: number | null | undefined,
) {
  if (bytes == null || bytes <= 0) {
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

function statusLabel(
  status: SubmissionStatus | null,
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
  status: SubmissionStatus | null,
) {
  switch (status) {
    case "approved":
      return "pwc-status pwc-status-approved";
    case "revision_required":
      return "pwc-status pwc-status-revision";
    case "under_review":
      return "pwc-status pwc-status-review";
    case "submitted":
      return "pwc-status pwc-status-submitted";
    case "draft":
      return "pwc-status pwc-status-draft";
    default:
      return "pwc-status";
  }
}

function requiresEvidence(
  submissionType: PracticalTask["submission_type"],
) {
  return submissionType !== "text";
}

function fileExtension(name: string) {
  const extension = name.split(".").pop();

  return extension && extension !== name
    ? extension.slice(0, 4).toUpperCase()
    : "FILE";
}

export default function PracticalWorkClient({
  tasks,
}: Props) {
  const [drafts, setDrafts] = useState<
    Record<string, string>
  >(() => {
    const initial: Record<string, string> = {};

    for (const task of tasks) {
      initial[task.id] =
        task.submission?.submission_text ?? "";
    }

    return initial;
  });

  const [selectedFiles, setSelectedFiles] = useState<
    Record<string, File | null>
  >({});

  const [busyTaskId, setBusyTaskId] = useState<
    string | null
  >(null);

  const [messages, setMessages] = useState<
    Record<string, string>
  >({});

  const [errors, setErrors] = useState<
    Record<string, string>
  >({});

  function updateDraft(taskId: string, value: string) {
    setDrafts((current) => ({
      ...current,
      [taskId]: value,
    }));
  }

  function handleFileChange(
    taskId: string,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0] ?? null;

    setErrors((current) => ({
      ...current,
      [taskId]: "",
    }));

    setMessages((current) => ({
      ...current,
      [taskId]: "",
    }));

    if (!file) {
      setSelectedFiles((current) => ({
        ...current,
        [taskId]: null,
      }));

      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setSelectedFiles((current) => ({
        ...current,
        [taskId]: null,
      }));

      setErrors((current) => ({
        ...current,
        [taskId]:
          "This file is too large. Maximum file size is 10 MB.",
      }));

      event.target.value = "";
      return;
    }

    setSelectedFiles((current) => ({
      ...current,
      [taskId]: file,
    }));
  }

  function removeSelectedFile(taskId: string) {
    setSelectedFiles((current) => ({
      ...current,
      [taskId]: null,
    }));

    setErrors((current) => ({
      ...current,
      [taskId]: "",
    }));

    const input = document.getElementById(
      `pwc-evidence-${taskId}`,
    );

    if (input instanceof HTMLInputElement) {
      input.value = "";
    }
  }

  async function submitTask(
    task: PracticalTask,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const submission = task.submission;

    if (
      submission?.status === "approved" ||
      submission?.status === "under_review"
    ) {
      return;
    }

    const submissionText = drafts[task.id]?.trim() ?? "";
    const evidenceFile = selectedFiles[task.id] ?? null;

    if (!submissionText && !evidenceFile) {
      setErrors((current) => ({
        ...current,
        [task.id]: requiresEvidence(task.submission_type)
          ? "Provide your practical response or attach an evidence file before submitting."
          : "Enter your practical response before submitting.",
      }));

      return;
    }

    if (evidenceFile && evidenceFile.size > MAX_FILE_SIZE) {
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
      const formData = new FormData();

      formData.append("taskId", task.id);
      formData.append("submissionText", submissionText);

      if (evidenceFile) {
        formData.append("evidenceFile", evidenceFile);
      }

      const response = await fetch(
        "/api/student/practical-work",
        {
          method: "POST",
          body: formData,
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "Unable to submit your practical work.",
        );
      }

      setMessages((current) => ({
        ...current,
        [task.id]:
          "Your practical work has been submitted successfully.",
      }));

      setSelectedFiles((current) => ({
        ...current,
        [task.id]: null,
      }));

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
      <>
        <style>{styles}</style>
        <div className="pwc-empty">
          No practical tasks are currently available for your
          enrolled courses.
        </div>
      </>
    );
  }

  return (
    <>
      <style>{styles}</style>

      <div className="pwc-list">
        {tasks.map((task) => {
          const submission = task.submission;

          const locked =
            submission?.status === "approved" ||
            submission?.status === "under_review";

          const selectedFile = selectedFiles[task.id] ?? null;

          const status = submission?.status ?? null;

          return (
            <article className="pwc-card" key={task.id}>
              <div className="pwc-card-header">
                <div>
                  <h2 className="pwc-card-title">
                    {task.title}
                  </h2>

                  <div className="pwc-task-meta">
                    <span className="pwc-meta-chip">
                      Type:
                      <strong>{task.submission_type}</strong>
                    </span>

                    <span className="pwc-meta-chip">
                      Maximum score:
                      <strong>{task.max_score}</strong>
                    </span>
                  </div>
                </div>

                <span className={statusClass(status)}>
                  {statusLabel(status)}
                </span>
              </div>

              <div className="pwc-task-sections">
                <section className="pwc-info-block">
                  <h3 className="pwc-info-heading">
                    <span className="pwc-info-number">
                      01
                    </span>
                    Scenario
                  </h3>

                  <p className="pwc-info-content">
                    {task.scenario}
                  </p>
                </section>

                <section className="pwc-info-block">
                  <h3 className="pwc-info-heading">
                    <span className="pwc-info-number">
                      02
                    </span>
                    Instructions
                  </h3>

                  <p className="pwc-info-content">
                    {task.instructions}
                  </p>
                </section>

                <section className="pwc-info-block">
                  <h3 className="pwc-info-heading">
                    <span className="pwc-info-number">
                      03
                    </span>
                    Expected outcome
                  </h3>

                  <p className="pwc-info-content">
                    {task.expected_outcome}
                  </p>
                </section>
              </div>

              {submission?.reviewer_feedback && (
                <div
                  className={
                    submission.status === "revision_required"
                      ? "pwc-feedback pwc-feedback-warning"
                      : "pwc-feedback"
                  }
                >
                  <h3 className="pwc-feedback-heading">
                    {submission.status === "revision_required"
                      ? "Revision requested"
                      : "Reviewer feedback"}
                  </h3>

                  <p className="pwc-feedback-text">
                    {submission.reviewer_feedback}
                  </p>

                  {submission.score !== null && (
                    <div className="pwc-score">
                      Score:
                      <strong>
                        {submission.score} / {task.max_score}
                      </strong>
                    </div>
                  )}
                </div>
              )}

              {submission?.evidence_file_name && (
                <div className="pwc-evidence-existing">
                  <div className="pwc-file-icon">
                    {fileExtension(
                      submission.evidence_file_name,
                    )}
                  </div>

                  <div className="pwc-file-info">
                    <span className="pwc-file-name">
                      {submission.evidence_file_name}
                    </span>

                    {submission.evidence_file_size ? (
                      <span className="pwc-file-size">
                        {formatFileSize(
                          submission.evidence_file_size,
                        )}
                      </span>
                    ) : null}

                    {submission.evidence_file_url && (
                      <a
                        className="pwc-file-link"
                        href={submission.evidence_file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open submitted evidence ↗
                      </a>
                    )}
                  </div>
                </div>
              )}

              {locked ? (
                <div className="pwc-locked-notice">
                  <span className="pwc-locked-icon">
                    ✓
                  </span>

                  <span>
                    {submission?.status === "approved"
                      ? "This submission has been approved. Your submitted work is locked."
                      : "Your submission is currently under review. You can update it after the review is completed."}
                  </span>
                </div>
              ) : (
                <form
                  className="pwc-form"
                  onSubmit={(event) =>
                    submitTask(task, event)
                  }
                >
                  <h3 className="pwc-form-heading">
                    Your practical response
                  </h3>

                  <p className="pwc-form-description">
                    Explain what you did, the decisions you made,
                    and the result you achieved.
                  </p>

                  <label
                    className="pwc-label"
                    htmlFor={`pwc-submission-${task.id}`}
                  >
                    Written response
                  </label>

                  <textarea
                    id={`pwc-submission-${task.id}`}
                    className="pwc-textarea"
                    value={drafts[task.id] ?? ""}
                    onChange={(event) =>
                      updateDraft(task.id, event.target.value)
                    }
                    maxLength={50000}
                    rows={8}
                    placeholder="Describe your approach, work performed, and results..."
                    disabled={busyTaskId === task.id}
                  />

                  <div className="pwc-character-count">
                    {(drafts[task.id] ?? "").length.toLocaleString()}{" "}
                    / 50,000 characters
                  </div>

                  <div className="pwc-upload">
                    <label
                      className="pwc-label"
                      htmlFor={`pwc-evidence-${task.id}`}
                    >
                      Attach your evidence{" "}
                      {requiresEvidence(task.submission_type) && (
                        <span className="pwc-required">
                          (recommended for this task)
                        </span>
                      )}
                    </label>

                    <div className="pwc-upload-box">
                      <p className="pwc-upload-description">
                        Upload your actual document, spreadsheet,
                        presentation, image, or other work.
                        Maximum file size: 10 MB.
                      </p>

                      <input
                        id={`pwc-evidence-${task.id}`}
                        className="pwc-file-input"
                        type="file"
                        accept={ACCEPTED_FILE_TYPES}
                        onChange={(event) =>
                          handleFileChange(task.id, event)
                        }
                        disabled={busyTaskId === task.id}
                      />

                      {selectedFile && (
                        <div className="pwc-selected-file">
                          <span className="pwc-file-icon">
                            {fileExtension(selectedFile.name)}
                          </span>

                          <span className="pwc-selected-file-name">
                            {selectedFile.name}
                            <br />
                            <span className="pwc-file-size">
                              {formatFileSize(selectedFile.size)}
                            </span>
                          </span>

                          <button
                            type="button"
                            className="pwc-remove-file"
                            onClick={() =>
                              removeSelectedFile(task.id)
                            }
                            disabled={busyTaskId === task.id}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {errors[task.id] && (
                    <div
                      className="pwc-alert pwc-alert-error"
                      role="alert"
                    >
                      {errors[task.id]}
                    </div>
                  )}

                  {messages[task.id] && (
                    <div
                      className="pwc-alert pwc-alert-success"
                      role="status"
                    >
                      {messages[task.id]}
                    </div>
                  )}

                  <div className="pwc-submit-row">
                    <button
                      type="submit"
                      className="pwc-submit-button"
                      disabled={busyTaskId === task.id}
                    >
                      {busyTaskId === task.id
                        ? "Submitting..."
                        : status === "revision_required"
                          ? "Resubmit practical work"
                          : status === "submitted"
                            ? "Submit updated work"
                            : "Submit practical work"}
                    </button>

                    <span className="pwc-lock-note">
                      {status === "revision_required"
                        ? "Address the reviewer feedback before resubmitting."
                        : "Review your response and attached evidence before submitting."}
                    </span>
                  </div>
                </form>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}