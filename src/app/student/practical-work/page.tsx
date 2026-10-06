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
};

type Submission = {
  id: string;
  task_id: string;
  student_id: string;
  submission_text: string | null;
  status:
    | "draft"
    | "submitted"
    | "under_review"
    | "approved"
    | "revision_required";
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

async function getPageData() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect(
      "/login?next=/student/practical-work",
    );
  }

  const {
    data: enrollments,
    error: enrollmentError,
  } = await supabase
    .from("enrollments")
    .select(
      "course_id, enrollment_status",
    )
    .eq("student_id", user.id)
    .in("enrollment_status", [
      "active",
      "completed",
    ]);

  if (enrollmentError) {
    throw new Error(
      "Unable to load your course access.",
    );
  }

  const courseIds = [
    ...new Set(
      (enrollments ?? []).map(
        (enrollment) =>
          enrollment.course_id,
      ),
    ),
  ];

  if (courseIds.length === 0) {
    return {
      courses: [] as Course[],
      tasks: [] as Task[],
      submissions:
        [] as Submission[],
    };
  }

  const [
    coursesResult,
    tasksResult,
    submissionsResult,
  ] = await Promise.all([
    supabase
      .from("courses")
      .select(
        "id, title, slug",
      )
      .in("id", courseIds)
      .eq("status", "published")
      .order("title", {
        ascending: true,
      }),

    supabase
      .from("course_practical_tasks")
      .select(
        `
          id,
          course_id,
          title,
          scenario,
          instructions,
          expected_outcome,
          submission_type,
          max_score,
          sort_order,
          is_published,
          skill_id
        `,
      )
      .in("course_id", courseIds)
      .eq("is_published", true)
      .order("sort_order", {
        ascending: true,
      }),

    supabase
      .from(
        "student_practical_task_submissions",
      )
      .select(
        `
          id,
          task_id,
          student_id,
          submission_text,
          status,
          score,
          reviewer_feedback,
          submitted_at,
          reviewed_at,
          evidence_file_path,
          evidence_file_name,
          evidence_file_type,
          evidence_file_size,
          evidence_recorded_at
        `,
      )
      .eq(
        "student_id",
        user.id,
      ),
  ]);

  if (coursesResult.error) {
    throw new Error(
      "Unable to load your courses.",
    );
  }

  if (tasksResult.error) {
    throw new Error(
      "Unable to load practical tasks.",
    );
  }

  if (submissionsResult.error) {
    throw new Error(
      "Unable to load your practical submissions.",
    );
  }

  return {
    courses:
      (coursesResult.data ??
        []) as Course[],

    tasks:
      (tasksResult.data ??
        []) as unknown as Task[],

    submissions:
      (submissionsResult.data ??
        []) as unknown as Submission[],
  };
}

export default async function PracticalWorkPage() {
  const {
    courses,
    tasks,
    submissions,
  } = await getPageData();

  const submissionMap =
    new Map<string, Submission>();

  for (const submission of submissions) {
    submissionMap.set(
      submission.task_id,
      submission,
    );
  }

  const enrichedTasks =
    tasks.map((task) => ({
      ...task,
      submission:
        submissionMap.get(
          task.id,
        ) ?? null,
    }));

  const courseMap =
    new Map<string, Course>();

  for (const course of courses) {
    courseMap.set(
      course.id,
      course,
    );
  }

  const groupedTasks =
    courses
      .map((course) => ({
        course,
        tasks:
          enrichedTasks.filter(
            (task) =>
              task.course_id ===
              course.id,
          ),
      }))
      .filter(
        (group) =>
          group.tasks.length > 0,
      );

  const totalTasks =
    enrichedTasks.length;

  const submittedTasks =
    enrichedTasks.filter(
      (task) =>
        task.submission?.status ===
          "submitted" ||
        task.submission?.status ===
          "under_review" ||
        task.submission?.status ===
          "approved" ||
        task.submission?.status ===
          "revision_required",
    ).length;

  const approvedTasks =
    enrichedTasks.filter(
      (task) =>
        task.submission?.status ===
        "approved",
    ).length;

  const revisionTasks =
    enrichedTasks.filter(
      (task) =>
        task.submission?.status ===
        "revision_required",
    ).length;

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">
            Practical Workbench
          </p>

          <h1>
            Do the work. Submit evidence.
            Build verified skills.
          </h1>

          <p className="muted">
            Complete realistic workplace
            tasks, submit the work you
            actually produced, receive
            reviewer feedback, and turn
            approved practical performance
            into verified skill evidence.
          </p>
        </div>

        <div className="actions">
          <Link
            href="/student/courses"
            className="button secondary"
          >
            My learning
          </Link>
        </div>
      </div>

      <section
        className="card"
        style={{
          marginBottom: "1.5rem",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "1rem",
          }}
        >
          <div>
            <strong>
              Available tasks
            </strong>

            <p
              style={{
                fontSize: "1.6rem",
                fontWeight: 800,
                margin:
                  "0.25rem 0 0",
              }}
            >
              {totalTasks}
            </p>
          </div>

          <div>
            <strong>
              Submitted
            </strong>

            <p
              style={{
                fontSize: "1.6rem",
                fontWeight: 800,
                margin:
                  "0.25rem 0 0",
              }}
            >
              {submittedTasks}
            </p>
          </div>

          <div>
            <strong>
              Approved
            </strong>

            <p
              style={{
                fontSize: "1.6rem",
                fontWeight: 800,
                margin:
                  "0.25rem 0 0",
              }}
            >
              {approvedTasks}
            </p>
          </div>

          <div>
            <strong>
              Revision required
            </strong>

            <p
              style={{
                fontSize: "1.6rem",
                fontWeight: 800,
                margin:
                  "0.25rem 0 0",
              }}
            >
              {revisionTasks}
            </p>
          </div>
        </div>
      </section>

      <section
        className="card"
        style={{
          marginBottom: "1.5rem",
        }}
      >
        <h2>
          How the Workbench works
        </h2>

        <div
          style={{
            display: "grid",
            gap: "0.75rem",
          }}
        >
          <p>
            <strong>
              1. Learn
            </strong>{" "}
            — study the relevant lesson
            and understand the expected
            skill.
          </p>

          <p>
            <strong>
              2. Practice
            </strong>{" "}
            — complete a realistic
            workplace task.
          </p>

          <p>
            <strong>
              3. Submit
            </strong>{" "}
            — provide your explanation
            and, where appropriate, the
            actual document, spreadsheet,
            presentation, image, or other
            evidence you created.
          </p>

          <p>
            <strong>
              4. Review
            </strong>{" "}
            — an authorized instructor or
            administrator evaluates your
            work.
          </p>

          <p>
            <strong>
              5. Improve
            </strong>{" "}
            — if revision is required,
            use the feedback and resubmit.
          </p>

          <p>
            <strong>
              6. Verify
            </strong>{" "}
            — approved practical
            performance can contribute
            evidence to your learning
            profile.
          </p>
        </div>
      </section>

      {groupedTasks.length === 0 ? (
        <div className="card">
          <h2>
            No practical work available
          </h2>

          <p className="muted">
            Practical tasks will appear
            here when they are published
            for your enrolled courses.
          </p>
        </div>
      ) : (
        <div
          className="stack"
          style={{
            gap: "2rem",
          }}
        >
          {groupedTasks.map(
            ({
              course,
              tasks: courseTasks,
            }) => (
              <section
                key={course.id}
              >
                <div
                  className="page-header"
                >
                  <div>
                    <p className="eyebrow">
                      Practical tasks
                    </p>

                    <h2>
                      {course.title}
                    </h2>
                  </div>

                  <Link
                    href={`/courses/${course.slug}`}
                    className="button secondary"
                  >
                    View course
                  </Link>
                </div>

                <PracticalWorkClient
                  tasks={courseTasks}
                />
              </section>
            ),
          )}
        </div>
      )}
    </main>
  );
}