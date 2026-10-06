import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PracticalWorkClient from "./PracticalWorkClient";

type Course = {
  id: string;
  title: string;
  slug: string;
};

type Task = {
  id: string;
  course_id: string;
  title: string;
  scenario: string;
  instructions: string;
  expected_outcome: string | null;
  submission_type: string;
  max_score: number;
  sort_order: number;
  submission: {
    id: string;
    task_id: string;
    submission_text: string | null;
    status: string;
    score: number | null;
    reviewer_feedback: string | null;
    submitted_at: string | null;
    reviewed_at: string | null;
  } | null;
};

type TaskRow = Omit<Task, "submission">;

type SubmissionRow = NonNullable<
  Task["submission"]
>;

export default async function PracticalWorkPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      "/login?next=/student/practical-work",
    );
  }

  const { data: enrollments } =
    await supabase
      .from("enrollments")
      .select("course_id")
      .eq("student_id", user.id)
      .in("enrollment_status", [
        "active",
        "completed",
      ]);

  const courseIds = [
    ...new Set(
      (enrollments || []).map(
        (row) => row.course_id,
      ),
    ),
  ];

  let courses: Course[] = [];

  if (courseIds.length > 0) {
    const { data: courseData } =
      await supabase
        .from("courses")
        .select("id, title, slug")
        .in("id", courseIds)
        .eq("status", "published")
        .order("title");

    courses =
      (courseData || []) as unknown as Course[];
  }

  let tasks: Task[] = [];

  if (courseIds.length > 0) {
    const { data: taskData } =
      await supabase
        .from("course_practical_tasks")
        .select(
          [
            "id",
            "course_id",
            "title",
            "scenario",
            "instructions",
            "expected_outcome",
            "submission_type",
            "max_score",
            "sort_order",
          ].join(", "),
        )
        .in("course_id", courseIds)
        .eq("is_published", true)
        .order("course_id")
        .order("sort_order");

    const taskRows =
      (taskData || []) as unknown as TaskRow[];

    const taskIds = taskRows.map(
      (task) => task.id,
    );

    let submissions: SubmissionRow[] =
      [];

    if (taskIds.length > 0) {
      const {
        data: submissionData,
      } = await supabase
        .from(
          "student_practical_task_submissions",
        )
        .select(
          [
            "id",
            "task_id",
            "submission_text",
            "status",
            "score",
            "reviewer_feedback",
            "submitted_at",
            "reviewed_at",
          ].join(", "),
        )
        .eq("student_id", user.id)
        .in("task_id", taskIds);

      submissions =
        (submissionData ||
          []) as unknown as SubmissionRow[];
    }

    const submissionMap = new Map<
      string,
      SubmissionRow
    >(
      submissions.map((submission) => [
        submission.task_id,
        submission,
      ]),
    );

    tasks = taskRows.map((task) => ({
      ...task,
      submission:
        submissionMap.get(task.id) ||
        null,
    }));
  }

  const groupedTasks = courses.map(
    (course) => ({
      course,
      tasks: tasks.filter(
        (task) =>
          task.course_id === course.id,
      ),
    }),
  );

  const totalTasks = tasks.length;

  const completedTasks = tasks.filter(
    (task) =>
      task.submission?.status ===
      "approved",
  ).length;

  const submittedTasks = tasks.filter(
    (task) =>
      task.submission?.status ===
        "submitted" ||
      task.submission?.status ===
        "under_review",
  ).length;

  const revisionTasks = tasks.filter(
    (task) =>
      task.submission?.status ===
      "revision_required",
  ).length;

  return (
    <main className="container">
      <section className="page-header">
        <span className="rn-eyebrow">
          PRACTICAL WORKBENCH
        </span>

        <h1>
          Build skills by doing real work
        </h1>

        <p>
          Complete practical workplace tasks
          connected to your courses. Submit
          your work, receive review feedback,
          improve it, and build evidence of
          practical ability.
        </p>
      </section>

      <section className="stats-grid">
        <div className="card">
          <strong>{totalTasks}</strong>
          <span>Practical Tasks</span>
        </div>

        <div className="card">
          <strong>
            {submittedTasks}
          </strong>
          <span>Under Review</span>
        </div>

        <div className="card">
          <strong>
            {completedTasks}
          </strong>
          <span>Approved</span>
        </div>

        <div className="card">
          <strong>
            {revisionTasks}
          </strong>
          <span>Needs Revision</span>
        </div>
      </section>

      <section className="card">
        <h2>
          How the Workbench works
        </h2>

        <div className="stack">
          <div>
            <strong>
              1. Understand the situation
            </strong>

            <p>
              Each task presents a practical
              workplace scenario rather than
              another quiz question.
            </p>
          </div>

          <div>
            <strong>
              2. Complete the work
            </strong>

            <p>
              Apply the skills from your
              course to produce a useful
              professional outcome.
            </p>
          </div>

          <div>
            <strong>
              3. Submit your work
            </strong>

            <p>
              Submit your response through
              RuffNeck Learn for evaluation.
            </p>
          </div>

          <div>
            <strong>
              4. Improve
            </strong>

            <p>
              Approved work becomes practical
              evidence. Work requiring revision
              can be improved and resubmitted.
            </p>
          </div>
        </div>
      </section>

      {groupedTasks.length === 0 ? (
        <section className="card">
          <h2>
            No practical tasks yet
          </h2>

          <p>
            Practical tasks will appear here
            when they are published for your
            enrolled courses.
          </p>

          <Link
            href="/courses"
            className="button primary"
          >
            Browse Courses
          </Link>
        </section>
      ) : (
        <section className="stack">
          {groupedTasks.map(
            ({ course, tasks: courseTasks }) => (
              <section
                className="card"
                key={course.id}
              >
                <div className="course-card-header">
                  <div>
                    <span className="rn-eyebrow">
                      COURSE
                    </span>

                    <h2>{course.title}</h2>
                  </div>

                  <Link
                    href={`/courses/${course.slug}`}
                    className="button secondary"
                  >
                    Course
                  </Link>
                </div>

                {courseTasks.length === 0 ? (
                  <p>
                    No practical tasks have
                    been published for this
                    course yet.
                  </p>
                ) : (
                  <div className="stack">
                    {courseTasks.map(
                      (task, index) => {
                        const submission =
                          task.submission;

                        const status =
                          submission?.status ||
                          "not_started";

                        const statusLabel =
                          status ===
                          "approved"
                            ? "Approved"
                            : status ===
                                "submitted"
                              ? "Submitted"
                              : status ===
                                  "under_review"
                                ? "Under review"
                                : status ===
                                    "revision_required"
                                  ? "Revision required"
                                  : "Not started";

                        return (
                          <article
                            key={task.id}
                            className="card"
                          >
                            <div className="course-card-header">
                              <div>
                                <span className="rn-eyebrow">
                                  PRACTICAL TASK{" "}
                                  {index + 1}
                                </span>

                                <h3>
                                  {task.title}
                                </h3>
                              </div>

                              <span className="status-badge">
                                {statusLabel}
                              </span>
                            </div>

                            <div className="stack">
                              <div>
                                <strong>
                                  Workplace
                                  scenario
                                </strong>

                                <p>
                                  {task.scenario}
                                </p>
                              </div>

                              <div>
                                <strong>
                                  Your task
                                </strong>

                                <p>
                                  {
                                    task.instructions
                                  }
                                </p>
                              </div>

                              {task.expected_outcome ? (
                                <div>
                                  <strong>
                                    Expected
                                    outcome
                                  </strong>

                                  <p>
                                    {
                                      task.expected_outcome
                                    }
                                  </p>
                                </div>
                              ) : null}

                              <div className="course-meta">
                                <span>
                                  Submission:{" "}
                                  {task.submission_type}
                                </span>

                                <span>
                                  Maximum score:{" "}
                                  {task.max_score}
                                </span>

                                {submission?.score !==
                                null &&
                                submission?.score !==
                                  undefined ? (
                                  <span>
                                    Score:{" "}
                                    {
                                      submission.score
                                    }
                                  </span>
                                ) : null}
                              </div>

                              {submission?.reviewer_feedback ? (
                                <div className="alert success">
                                  <strong>
                                    Reviewer feedback
                                  </strong>

                                  <p>
                                    {
                                      submission.reviewer_feedback
                                    }
                                  </p>
                                </div>
                              ) : null}

                              <PracticalWorkClient
                                taskId={task.id}
                                initialText={
                                  submission?.submission_text ||
                                  ""
                                }
                                initialStatus={
                                  status
                                }
                              />
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
        </section>
      )}
    </main>
  );
}