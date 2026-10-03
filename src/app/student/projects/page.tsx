import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Enrollment = {
  course_id: string;
  enrollment_status:
    | "active"
    | "completed"
    | "cancelled";
  progress_percent: number;
};

type Project = {
  id: string;
  course_id: string;
  title: string;
  project_type: "practical" | "case_study" | "capstone";
  brief: string;
  deliverables: string[];
  max_score: number;
};

type Submission = {
  project_id: string;
  status:
    | "draft"
    | "submitted"
    | "under_review"
    | "approved"
    | "revision_required";
  score: number | null;
};

type Course = {
  id: string;
  title: string;
  slug: string;
  level: "beginner" | "intermediate" | "advanced";
  category: string | null;
};

function formatLevel(level: string) {
  return (
    level.charAt(0).toUpperCase() +
    level.slice(1)
  );
}

function formatStatus(
  status: Submission["status"]
) {
  switch (status) {
    case "under_review":
      return "Under Review";
    case "revision_required":
      return "Revision Required";
    case "approved":
      return "Approved";
    case "submitted":
      return "Submitted";
    default:
      return "Draft";
  }
}

export default async function StudentProjectsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      "/login?next=/student/projects"
    );
  }

  const { data: enrollmentData } =
    await supabase
      .from("enrollments")
      .select(
        "course_id, enrollment_status, progress_percent"
      )
      .eq("student_id", user.id)
      .in("enrollment_status", [
        "active",
        "completed",
      ]);

  const enrollments =
    (enrollmentData as unknown as Enrollment[]) ||
    [];

  const courseIds = enrollments.map(
    (item) => item.course_id
  );

  if (courseIds.length === 0) {
    return (
      <main className="rn-projects-page">
        <div className="container">
          <section className="rn-projects-header">
            <span className="rn-eyebrow">
              PRACTICAL PROJECTS
            </span>

            <h1>Projects & Capstones</h1>

            <p>
              Complete practical projects to
              demonstrate the skills developed in
              your courses.
            </p>
          </section>

          <section className="rn-project-empty">
            <span className="rn-eyebrow">
              START LEARNING
            </span>

            <h2>No enrolled courses yet</h2>

            <p>
              Enroll in a RuffNeck Learn course to
              access its practical project and
              capstone work.
            </p>

            <Link
              href="/courses"
              className="rn-button rn-button-primary"
            >
              Explore Courses
            </Link>
          </section>
        </div>
      </main>
    );
  }

  const { data: projectData } =
    await supabase
      .from("course_projects")
      .select(
        [
          "id",
          "course_id",
          "title",
          "project_type",
          "brief",
          "deliverables",
          "max_score",
        ].join(", ")
      )
      .in("course_id", courseIds)
      .eq("is_published", true)
      .order("sort_order");

  const projects =
    (projectData as unknown as Project[]) || [];

  const { data: submissionData } =
    await supabase
      .from("project_submissions")
      .select(
        "project_id, status, score"
      )
      .eq("student_id", user.id);

  const submissions =
    (submissionData as unknown as Submission[]) ||
    [];

  const projectCourseIds = Array.from(
    new Set(
      projects.map(
        (project) => project.course_id
      )
    )
  );

  const { data: courseData } =
    await supabase
      .from("courses")
      .select(
        "id, title, slug, level, category"
      )
      .in("id", projectCourseIds);

  const courses =
    (courseData as unknown as Course[]) || [];

  const courseMap = new Map(
    courses.map((course) => [
      course.id,
      course,
    ])
  );

  const submissionMap = new Map(
    submissions.map((submission) => [
      submission.project_id,
      submission,
    ])
  );

  const approvedCount =
    submissions.filter(
      (submission) =>
        submission.status === "approved"
    ).length;

  const pendingCount =
    submissions.filter((submission) =>
      [
        "submitted",
        "under_review",
        "revision_required",
      ].includes(submission.status)
    ).length;

  return (
    <main className="rn-projects-page">
      <div className="container">
        <section className="rn-projects-header">
          <div>
            <Link
              href="/student/dashboard"
              className="rn-learning-back"
            >
              ← Dashboard
            </Link>

            <span className="rn-eyebrow">
              PRACTICAL PROJECTS
            </span>

            <h1>Projects & Capstones</h1>

            <p>
              Demonstrate your knowledge by
              completing real-world projects aligned
              with your course.
            </p>
          </div>

          <div className="rn-project-summary">
            <div>
              <strong>
                {projects.length}
              </strong>
              <span>Available</span>
            </div>

            <div>
              <strong>
                {approvedCount}
              </strong>
              <span>Approved</span>
            </div>

            <div>
              <strong>
                {pendingCount}
              </strong>
              <span>Active</span>
            </div>
          </div>
        </section>

        <section className="rn-project-grid">
          {projects.map((project) => {
            const course =
              courseMap.get(
                project.course_id
              );

            const submission =
              submissionMap.get(
                project.id
              );

            return (
              <article
                key={project.id}
                className="rn-project-card"
              >
                <div className="rn-project-card-top">
                  <span className="rn-eyebrow">
                    {course?.category ||
                      "PRACTICAL PROJECT"}
                  </span>

                  {submission ? (
                    <span
                      className={`rn-project-status status-${submission.status}`}
                    >
                      {formatStatus(
                        submission.status
                      )}
                    </span>
                  ) : (
                    <span className="rn-project-status status-draft">
                      Not Started
                    </span>
                  )}
                </div>

                <h2>{project.title}</h2>

                <p className="rn-project-course">
                  {course?.title ||
                    "RuffNeck Learn Course"}
                </p>

                <p>
                  {project.brief}
                </p>

                <div className="rn-project-card-meta">
                  <span>
                    {project.deliverables
                      .length}{" "}
                    deliverables
                  </span>

                  <span>
                    Max score:{" "}
                    {project.max_score}
                  </span>

                  {course ? (
                    <span>
                      {formatLevel(
                        course.level
                      )}
                    </span>
                  ) : null}
                </div>

                {submission?.score !==
                null &&
                submission?.score !==
                  undefined ? (
                  <div className="rn-project-score">
                    <strong>
                      {submission.score}
                    </strong>

                    <span>
                      / {project.max_score}
                    </span>
                  </div>
                ) : null}

                <Link
                  href={`/student/projects/${project.id}`}
                  className="rn-button rn-button-primary"
                >
                  {submission
                    ? "Open Project"
                    : "Start Project"}
                </Link>
              </article>
            );
          })}
        </section>

        <div className="rn-project-footer-actions">
          <Link
            href="/student/assessment"
            className="rn-button rn-button-secondary"
          >
            Course Assessments
          </Link>

          <Link
            href="/student/skills"
            className="rn-button rn-button-secondary"
          >
            My Skills
          </Link>
        </div>
      </div>
    </main>
  );
}