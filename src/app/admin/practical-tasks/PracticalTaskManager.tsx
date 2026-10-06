"use client";

import { useEffect, useMemo, useState } from "react";

type Course = {
  id: string;
  title: string;
  slug: string;
  instructor_id: string | null;
};

type SubmissionType =
  | "text"
  | "document"
  | "spreadsheet"
  | "presentation"
  | "mixed";

type PracticalTask = {
  id: string;
  course_id: string;
  title: string;
  scenario: string;
  instructions: string;
  expected_outcome: string;
  submission_type: SubmissionType;
  max_score: number;
  sort_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  courses?: {
    id: string;
    title: string;
    slug: string;
    instructor_id: string | null;
  } | null;
};

type FormState = {
  course_id: string;
  title: string;
  scenario: string;
  instructions: string;
  expected_outcome: string;
  submission_type: SubmissionType;
  max_score: string;
  sort_order: string;
  is_published: boolean;
};

const EMPTY_FORM: FormState = {
  course_id: "",
  title: "",
  scenario: "",
  instructions: "",
  expected_outcome: "",
  submission_type: "text",
  max_score: "100",
  sort_order: "1",
  is_published: false,
};

const SUBMISSION_TYPES: Array<{
  value: SubmissionType;
  label: string;
}> = [
  {
    value: "text",
    label: "Written response",
  },
  {
    value: "document",
    label: "Document",
  },
  {
    value: "spreadsheet",
    label: "Spreadsheet",
  },
  {
    value: "presentation",
    label: "Presentation",
  },
  {
    value: "mixed",
    label: "Mixed submission",
  },
];

export default function PracticalTaskManager({
  courses,
}: {
  courses: Course[];
}) {
  const [tasks, setTasks] = useState<PracticalTask[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const courseMap = useMemo(() => {
    return new Map(
      courses.map((course) => [
        course.id,
        course,
      ]),
    );
  }, [courses]);

  async function loadTasks() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/admin/practical-tasks",
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to load practical tasks.",
        );
      }

      setTasks(
        Array.isArray(data?.tasks)
          ? data.tasks
          : [],
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load practical tasks.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
  }, []);

  function updateField<K extends keyof FormState>(
    field: K,
    value: FormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetForm() {
    setForm({
      ...EMPTY_FORM,
      course_id:
        courses.length === 1
          ? courses[0].id
          : "",
    });

    setEditingId(null);
  }

  function startEditing(task: PracticalTask) {
    setMessage("");
    setError("");

    setEditingId(task.id);

    setForm({
      course_id: task.course_id,
      title: task.title,
      scenario: task.scenario,
      instructions: task.instructions,
      expected_outcome: task.expected_outcome,
      submission_type: task.submission_type,
      max_score: String(task.max_score),
      sort_order: String(task.sort_order),
      is_published: task.is_published,
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function saveTask(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    const title = form.title.trim();
    const scenario = form.scenario.trim();
    const instructions =
      form.instructions.trim();
    const expectedOutcome =
      form.expected_outcome.trim();

    if (!form.course_id) {
      setError("Select a course.");
      setSaving(false);
      return;
    }

    if (!title) {
      setError("Task title is required.");
      setSaving(false);
      return;
    }

    if (!scenario) {
      setError("Scenario is required.");
      setSaving(false);
      return;
    }

    if (!instructions) {
      setError("Instructions are required.");
      setSaving(false);
      return;
    }

    if (!expectedOutcome) {
      setError(
        "Expected outcome is required.",
      );
      setSaving(false);
      return;
    }

    const maxScore = Number(form.max_score);
    const sortOrder = Number(form.sort_order);

    if (
      !Number.isFinite(maxScore) ||
      maxScore <= 0
    ) {
      setError(
        "Maximum score must be greater than zero.",
      );
      setSaving(false);
      return;
    }

    if (
      !Number.isFinite(sortOrder) ||
      sortOrder < 0
    ) {
      setError(
        "Sort order must be zero or greater.",
      );
      setSaving(false);
      return;
    }

    try {
      const response = await fetch(
        "/api/admin/practical-tasks",
        {
          method: editingId
            ? "PATCH"
            : "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(
            editingId
              ? {
                  id: editingId,
                  course_id: form.course_id,
                  title,
                  scenario,
                  instructions,
                  expected_outcome:
                    expectedOutcome,
                  submission_type:
                    form.submission_type,
                  max_score: maxScore,
                  sort_order: sortOrder,
                  is_published:
                    form.is_published,
                }
              : {
                  course_id: form.course_id,
                  title,
                  scenario,
                  instructions,
                  expected_outcome:
                    expectedOutcome,
                  submission_type:
                    form.submission_type,
                  max_score: maxScore,
                  sort_order: sortOrder,
                  is_published:
                    form.is_published,
                },
          ),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to save practical task.",
        );
      }

      setMessage(
        editingId
          ? "Practical task updated successfully."
          : "Practical task created successfully.",
      );

      resetForm();
      await loadTasks();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save practical task.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteTask(task: PracticalTask) {
    const confirmed = window.confirm(
      `Delete "${task.title}"? This cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(task.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/admin/practical-tasks",
        {
          method: "DELETE",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            id: task.id,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to delete practical task.",
        );
      }

      if (editingId === task.id) {
        resetForm();
      }

      setMessage(
        "Practical task deleted successfully.",
      );

      await loadTasks();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete practical task.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function togglePublished(
    task: PracticalTask,
  ) {
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/admin/practical-tasks",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            id: task.id,
            is_published:
              !task.is_published,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to update publication status.",
        );
      }

      setMessage(
        task.is_published
          ? "Practical task unpublished."
          : "Practical task published.",
      );

      await loadTasks();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update publication status.",
      );
    }
  }

  const groupedTasks = courses.map(
    (course) => ({
      course,
      tasks: tasks
        .filter(
          (task) =>
            task.course_id === course.id,
        )
        .sort(
          (a, b) =>
            a.sort_order - b.sort_order ||
            a.title.localeCompare(b.title),
        ),
    }),
  );

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

      <section className="card">
        <div className="page-header">
          <div>
            <h2>
              {editingId
                ? "Edit practical task"
                : "Create practical task"}
            </h2>

            <p className="muted">
              Build a realistic workplace task
              that produces evidence of actual
              learner ability.
            </p>
          </div>

          {editingId ? (
            <button
              type="button"
              className="button secondary"
              onClick={resetForm}
            >
              Cancel editing
            </button>
          ) : null}
        </div>

        <form
          className="stack"
          onSubmit={saveTask}
        >
          <div className="form-grid">
            <label>
              <span>Course</span>

              <select
                value={form.course_id}
                onChange={(event) =>
                  updateField(
                    "course_id",
                    event.target.value,
                  )
                }
                required
              >
                <option value="">
                  Select course
                </option>

                {courses.map((course) => (
                  <option
                    key={course.id}
                    value={course.id}
                  >
                    {course.title}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Task title</span>

              <input
                type="text"
                value={form.title}
                onChange={(event) =>
                  updateField(
                    "title",
                    event.target.value,
                  )
                }
                placeholder="e.g. Build a professional monthly sales report"
                maxLength={200}
                required
              />
            </label>
          </div>

          <label>
            <span>Real-world scenario</span>

            <textarea
              value={form.scenario}
              onChange={(event) =>
                updateField(
                  "scenario",
                  event.target.value,
                )
              }
              placeholder="Describe the workplace situation the learner is facing."
              rows={5}
              required
            />
          </label>

          <label>
            <span>Task instructions</span>

            <textarea
              value={form.instructions}
              onChange={(event) =>
                updateField(
                  "instructions",
                  event.target.value,
                )
              }
              placeholder="Give the learner clear instructions for completing the task."
              rows={7}
              required
            />
          </label>

          <label>
            <span>Expected outcome</span>

            <textarea
              value={form.expected_outcome}
              onChange={(event) =>
                updateField(
                  "expected_outcome",
                  event.target.value,
                )
              }
              placeholder="Define what a successful submission should demonstrate."
              rows={5}
              required
            />
          </label>

          <div className="form-grid">
            <label>
              <span>Submission type</span>

              <select
                value={form.submission_type}
                onChange={(event) =>
                  updateField(
                    "submission_type",
                    event.target
                      .value as SubmissionType,
                  )
                }
              >
                {SUBMISSION_TYPES.map(
                  (type) => (
                    <option
                      key={type.value}
                      value={type.value}
                    >
                      {type.label}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              <span>Maximum score</span>

              <input
                type="number"
                min="1"
                value={form.max_score}
                onChange={(event) =>
                  updateField(
                    "max_score",
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              <span>Sort order</span>

              <input
                type="number"
                min="0"
                value={form.sort_order}
                onChange={(event) =>
                  updateField(
                    "sort_order",
                    event.target.value,
                  )
                }
              />
            </label>
          </div>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={(event) =>
                updateField(
                  "is_published",
                  event.target.checked,
                )
              }
            />

            <span>
              Publish this task for enrolled
              learners
            </span>
          </label>

          <div className="actions">
            <button
              type="submit"
              className="button primary"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Update task"
                  : "Create task"}
            </button>

            {editingId ? (
              <button
                type="button"
                className="button secondary"
                onClick={resetForm}
                disabled={saving}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="stack">
        <div>
          <h2>Practical tasks</h2>

          <p className="muted">
            {tasks.length} task
            {tasks.length === 1 ? "" : "s"} across{" "}
            {courses.length} course
            {courses.length === 1 ? "" : "s"}.
          </p>
        </div>

        {loading ? (
          <div className="card">
            <p>Loading practical tasks...</p>
          </div>
        ) : groupedTasks.every(
            (group) =>
              group.tasks.length === 0,
          ) ? (
          <div className="card">
            <p>
              No practical tasks have been
              created yet.
            </p>
          </div>
        ) : (
          groupedTasks.map((group) => {
            if (group.tasks.length === 0) {
              return null;
            }

            return (
              <section
                className="card"
                key={group.course.id}
              >
                <div className="page-header">
                  <div>
                    <h3>
                      {group.course.title}
                    </h3>

                    <p className="muted">
                      {group.tasks.length} practical
                      task
                      {group.tasks.length === 1
                        ? ""
                        : "s"}
                    </p>
                  </div>
                </div>

                <div className="stack">
                  {group.tasks.map(
                    (task) => (
                      <article
                        key={task.id}
                        className="card"
                      >
                        <div className="page-header">
                          <div>
                            <h3>
                              {task.sort_order}.{" "}
                              {task.title}
                            </h3>

                            <p className="muted">
                              {task.submission_type}{" "}
                              · max{" "}
                              {task.max_score} points
                            </p>
                          </div>

                          <span
                            className={
                              task.is_published
                                ? "status-badge status-success"
                                : "status-badge"
                            }
                          >
                            {task.is_published
                              ? "Published"
                              : "Draft"}
                          </span>
                        </div>

                        <div className="stack">
                          <div>
                            <strong>
                              Scenario
                            </strong>

                            <p>
                              {task.scenario}
                            </p>
                          </div>

                          <div>
                            <strong>
                              Instructions
                            </strong>

                            <p
                              style={{
                                whiteSpace:
                                  "pre-wrap",
                              }}
                            >
                              {
                                task.instructions
                              }
                            </p>
                          </div>

                          <div>
                            <strong>
                              Expected outcome
                            </strong>

                            <p
                              style={{
                                whiteSpace:
                                  "pre-wrap",
                              }}
                            >
                              {
                                task.expected_outcome
                              }
                            </p>
                          </div>
                        </div>

                        <div className="actions">
                          <button
                            type="button"
                            className="button primary"
                            onClick={() =>
                              startEditing(
                                task,
                              )
                            }
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="button secondary"
                            onClick={() =>
                              togglePublished(
                                task,
                              )
                            }
                          >
                            {task.is_published
                              ? "Unpublish"
                              : "Publish"}
                          </button>

                          <button
                            type="button"
                            className="button secondary"
                            onClick={() =>
                              deleteTask(task)
                            }
                            disabled={
                              deletingId ===
                              task.id
                            }
                          >
                            {deletingId ===
                            task.id
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        </div>
                      </article>
                    ),
                  )}
                </div>
              </section>
            );
          })
        )}
      </section>
    </div>
  );
}