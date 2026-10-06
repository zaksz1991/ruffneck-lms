"use client";

import { useEffect, useMemo, useState } from "react";

type Course = {
  id: string;
  title: string;
};

type Skill = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
};

type PracticalTask = {
  id: string;
  course_id: string;
  title: string;
  scenario: string;
  instructions: string;
  expected_outcome: string | null;
  submission_type: string;
  max_score: number;
  sort_order: number;
  is_published: boolean;
  skill_id: string | null;
  created_at: string;
  updated_at: string;
};

type Props = {
  courses: Course[];
};

type FormState = {
  id: string;
  course_id: string;
  title: string;
  scenario: string;
  instructions: string;
  expected_outcome: string;
  submission_type: string;
  max_score: string;
  sort_order: string;
  skill_id: string;
  is_published: boolean;
};

const EMPTY_FORM: FormState = {
  id: "",
  course_id: "",
  title: "",
  scenario: "",
  instructions: "",
  expected_outcome: "",
  submission_type: "text",
  max_score: "100",
  sort_order: "0",
  skill_id: "",
  is_published: false,
};

const SUBMISSION_TYPES = [
  "text",
  "document",
  "spreadsheet",
  "presentation",
  "mixed",
];

function emptyForm(
  courseId = "",
): FormState {
  return {
    ...EMPTY_FORM,
    course_id: courseId,
  };
}

export default function PracticalTaskManager({
  courses,
}: Props) {
  const [tasks, setTasks] = useState<
    PracticalTask[]
  >([]);

  const [skills, setSkills] = useState<
    Skill[]
  >([]);

  const [form, setForm] =
    useState<FormState>(() =>
      emptyForm(courses[0]?.id || ""),
    );

  const [editing, setEditing] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  async function loadTasks() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/admin/practical-tasks",
        {
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

      setSkills(
        Array.isArray(data?.skills)
          ? data.skills
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
    void loadTasks();
  }, []);

  const skillMap = useMemo(() => {
    return new Map(
      skills.map((skill) => [
        skill.id,
        skill,
      ]),
    );
  }, [skills]);

  const courseMap = useMemo(() => {
    return new Map(
      courses.map((course) => [
        course.id,
        course,
      ]),
    );
  }, [courses]);

  const groupedTasks = useMemo(() => {
    return courses.map((course) => ({
      course,
      tasks: tasks
        .filter(
          (task) =>
            task.course_id === course.id,
        )
        .sort(
          (a, b) =>
            a.sort_order - b.sort_order,
        ),
    }));
  }, [courses, tasks]);

  function updateForm(
    field: keyof FormState,
    value: string | boolean,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function startCreate(courseId?: string) {
    setEditing(false);
    setMessage("");
    setError("");

    setForm(
      emptyForm(
        courseId ||
          form.course_id ||
          courses[0]?.id ||
          "",
      ),
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function startEdit(
    task: PracticalTask,
  ) {
    setEditing(true);
    setMessage("");
    setError("");

    setForm({
      id: task.id,
      course_id: task.course_id,
      title: task.title,
      scenario: task.scenario,
      instructions: task.instructions,
      expected_outcome:
        task.expected_outcome || "",
      submission_type:
        task.submission_type || "text",
      max_score: String(
        task.max_score ?? 100,
      ),
      sort_order: String(
        task.sort_order ?? 0,
      ),
      skill_id: task.skill_id || "",
      is_published: Boolean(
        task.is_published,
      ),
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function cancelEdit() {
    setEditing(false);
    setError("");
    setMessage("");

    setForm(
      emptyForm(
        form.course_id ||
          courses[0]?.id ||
          "",
      ),
    );
  }

  async function saveTask(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    if (!form.course_id) {
      setError("Select a course.");
      setSaving(false);
      return;
    }

    if (!form.title.trim()) {
      setError("Task title is required.");
      setSaving(false);
      return;
    }

    if (!form.scenario.trim()) {
      setError("Scenario is required.");
      setSaving(false);
      return;
    }

    if (!form.instructions.trim()) {
      setError(
        "Task instructions are required.",
      );
      setSaving(false);
      return;
    }

    const maxScore = Number(
      form.max_score,
    );

    const sortOrder = Number(
      form.sort_order,
    );

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

    if (!Number.isFinite(sortOrder)) {
      setError(
        "Sort order must be a number.",
      );
      setSaving(false);
      return;
    }

    try {
      const response = await fetch(
        "/api/admin/practical-tasks",
        {
          method: editing
            ? "PATCH"
            : "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            ...(editing
              ? { id: form.id }
              : {}),
            course_id:
              form.course_id,
            title: form.title.trim(),
            scenario:
              form.scenario.trim(),
            instructions:
              form.instructions.trim(),
            expected_outcome:
              form.expected_outcome.trim() ||
              null,
            submission_type:
              form.submission_type,
            max_score: maxScore,
            sort_order: sortOrder,
            skill_id:
              form.skill_id || null,
            is_published:
              form.is_published,
          }),
        },
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to save practical task.",
        );
      }

      setMessage(
        editing
          ? "Practical task updated."
          : "Practical task created.",
      );

      setEditing(false);

      setForm(
        emptyForm(form.course_id),
      );

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

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to update publication status.",
        );
      }

      setMessage(
        task.is_published
          ? "Task unpublished."
          : "Task published.",
      );

      await loadTasks();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update task.",
      );
    }
  }

  async function deleteTask(
    task: PracticalTask,
  ) {
    const confirmed =
      window.confirm(
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

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to delete practical task.",
        );
      }

      setMessage("Practical task deleted.");

      if (form.id === task.id) {
        cancelEdit();
      }

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

  return (
    <div className="stack">
      <section className="card">
        <div className="course-card-header">
          <div>
            <span className="rn-eyebrow">
              {editing
                ? "EDIT PRACTICAL TASK"
                : "CREATE PRACTICAL TASK"}
            </span>

            <h1>
              {editing
                ? "Edit practical task"
                : "Create practical task"}
            </h1>

            <p>
              Assign each practical task to a
              measurable learning skill so approved
              work can contribute evidence to the
              learner skill profile.
            </p>
          </div>

          {editing ? (
            <button
              type="button"
              className="button secondary"
              onClick={cancelEdit}
            >
              Cancel
            </button>
          ) : null}
        </div>

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
                  updateForm(
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
              <span>Learning skill</span>

              <select
                value={form.skill_id}
                onChange={(event) =>
                  updateForm(
                    "skill_id",
                    event.target.value,
                  )
                }
              >
                <option value="">
                  No skill assigned
                </option>

                {skills.map((skill) => (
                  <option
                    key={skill.id}
                    value={skill.id}
                  >
                    {skill.category
                      ? `${skill.category} — ${skill.name}`
                      : skill.name}
                  </option>
                ))}
              </select>

              <small>
                The selected skill receives
                practical evidence when this task
                is approved.
              </small>
            </label>
          </div>

          <label>
            <span>Task title</span>

            <input
              type="text"
              value={form.title}
              onChange={(event) =>
                updateForm(
                  "title",
                  event.target.value,
                )
              }
              placeholder="e.g. Build a monthly management report"
              required
            />
          </label>

          <label>
            <span>
              Workplace scenario
            </span>

            <textarea
              rows={5}
              value={form.scenario}
              onChange={(event) =>
                updateForm(
                  "scenario",
                  event.target.value,
                )
              }
              placeholder="Describe the realistic workplace situation..."
              required
            />
          </label>

          <label>
            <span>
              Task instructions
            </span>

            <textarea
              rows={7}
              value={form.instructions}
              onChange={(event) =>
                updateForm(
                  "instructions",
                  event.target.value,
                )
              }
              placeholder="Tell the learner exactly what they must produce..."
              required
            />
          </label>

          <label>
            <span>
              Expected outcome
            </span>

            <textarea
              rows={4}
              value={
                form.expected_outcome
              }
              onChange={(event) =>
                updateForm(
                  "expected_outcome",
                  event.target.value,
                )
              }
              placeholder="Describe what a successful submission should demonstrate..."
            />
          </label>

          <div className="form-grid">
            <label>
              <span>
                Submission type
              </span>

              <select
                value={
                  form.submission_type
                }
                onChange={(event) =>
                  updateForm(
                    "submission_type",
                    event.target.value,
                  )
                }
              >
                {SUBMISSION_TYPES.map(
                  (type) => (
                    <option
                      key={type}
                      value={type}
                    >
                      {type}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              <span>
                Maximum score
              </span>

              <input
                type="number"
                min="1"
                step="1"
                value={form.max_score}
                onChange={(event) =>
                  updateForm(
                    "max_score",
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              <span>
                Sort order
              </span>

              <input
                type="number"
                min="0"
                step="1"
                value={form.sort_order}
                onChange={(event) =>
                  updateForm(
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
              checked={
                form.is_published
              }
              onChange={(event) =>
                updateForm(
                  "is_published",
                  event.target.checked,
                )
              }
            />

            <span>
              Publish this practical task
              immediately
            </span>
          </label>

          <div>
            <button
              type="submit"
              className="button primary"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : editing
                  ? "Save changes"
                  : "Create practical task"}
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <div className="course-card-header">
          <div>
            <span className="rn-eyebrow">
              PRACTICAL WORKBENCH
            </span>

            <h2>
              Practical task library
            </h2>
          </div>

          {courses.length > 0 ? (
            <button
              type="button"
              className="button primary"
              onClick={() =>
                startCreate()
              }
            >
              New task
            </button>
          ) : null}
        </div>

        {loading ? (
          <p>Loading practical tasks...</p>
        ) : courses.length === 0 ? (
          <p>
            No courses are available for
            practical task management.
          </p>
        ) : (
          <div className="stack">
            {groupedTasks.map(
              ({
                course,
                tasks: courseTasks,
              }) => (
                <section
                  className="card"
                  key={course.id}
                >
                  <div className="course-card-header">
                    <div>
                      <span className="rn-eyebrow">
                        COURSE
                      </span>

                      <h3>
                        {course.title}
                      </h3>
                    </div>

                    <button
                      type="button"
                      className="button secondary"
                      onClick={() =>
                        startCreate(
                          course.id,
                        )
                      }
                    >
                      Add task
                    </button>
                  </div>

                  {courseTasks.length ===
                  0 ? (
                    <p>
                      No practical tasks
                      created for this course
                      yet.
                    </p>
                  ) : (
                    <div className="stack">
                      {courseTasks.map(
                        (task, index) => {
                          const skill =
                            task.skill_id
                              ? skillMap.get(
                                  task.skill_id,
                                )
                              : null;

                          return (
                            <article
                              className="card"
                              key={task.id}
                            >
                              <div className="course-card-header">
                                <div>
                                  <span className="rn-eyebrow">
                                    TASK{" "}
                                    {index +
                                      1}
                                  </span>

                                  <h4>
                                    {
                                      task.title
                                    }
                                  </h4>
                                </div>

                                <span className="status-badge">
                                  {task.is_published
                                    ? "Published"
                                    : "Draft"}
                                </span>
                              </div>

                              <p>
                                {
                                  task.scenario
                                }
                              </p>

                              <div className="course-meta">
                                <span>
                                  Submission:{" "}
                                  {
                                    task.submission_type
                                  }
                                </span>

                                <span>
                                  Max score:{" "}
                                  {
                                    task.max_score
                                  }
                                </span>

                                <span>
                                  Order:{" "}
                                  {
                                    task.sort_order
                                  }
                                </span>

                                <span>
                                  Skill:{" "}
                                  {skill
                                    ? skill.name
                                    : "Not assigned"}
                                </span>
                              </div>

                              <div className="course-meta">
                                <span>
                                  Evidence:
                                  {" "}
                                  {skill
                                    ? "Enabled"
                                    : "Not linked"}
                                </span>
                              </div>

                              <div className="button-row">
                                <button
                                  type="button"
                                  className="button secondary"
                                  onClick={() =>
                                    startEdit(
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
                                  className="button danger"
                                  disabled={
                                    deletingId ===
                                    task.id
                                  }
                                  onClick={() =>
                                    deleteTask(
                                      task,
                                    )
                                  }
                                >
                                  {deletingId ===
                                  task.id
                                    ? "Deleting..."
                                    : "Delete"}
                                </button>
                              </div>
                            </article>
                          );
                        },
                      )}
                    </div>
                  )}
                </section>
              ),
            )}
          </div>
        )}
      </section>
    </div>
  );
}