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
  project_type:
    | "practical"
    | "case_study"
    | "capstone";
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
  level:
    | "beginner"
    | "intermediate"
    | "advanced";
  category: string | null;
  status:
    | "draft"
    | "published"
    | "archived";
};

function formatLevel(level: string) {
  return (
    level.charAt(0).toUpperCase() +
    level.slice(1)
  );
}

function formatProjectType(
  projectType: Project["project_type"]
) {
  switch (projectType) {
    case "case_study":
      return "Case Study";

    case "capstone":
      return "Capstone";

    default:
      return "Practical Project";
  }
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

function getStatusClass(
  status: Submission["status"]
) {
  switch (status) {
    case "approved":
      return "success";

    case "revision_required":
      return "error";

    case "under_review":
      return "warning";

    case "submitted":
      return "info";

    default:
      return "";
  }
}

export default async function StudentProjectsPage() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect(
      "/login?next=/student/projects"
    );
  }

  const {
    data: enrollmentData,
    error: enrollmentError,
  } =
    await supabase
      .from("enrollments")
      .select(
        "course_id, enrollment_status, progress_percent"
      )
      .eq(
        "student_id",
        user.id
      )
      .in(
        "enrollment_status",
        [
          "active",
          "completed",
        ]
      );

  if (enrollmentError) {
    console.error(
      "Failed to load project enrollments:",
      enrollmentError
    );
  }

  const enrollments =
    (enrollmentData ||
      []) as Enrollment[];

  const enrolledCourseIds = [
    ...new Set(
      enrollments.map(
        (item) =>
          item.course_id
      )
    ),
  ];

  if (
    enrolledCourseIds.length ===
    0
  ) {
    return (
      <div className="container">
        <section className="page-header">
          <span className="rn-eyebrow">
            PROJECTS
          </span>

          <h1>
            Practical projects
          </h1>

          <p>
            Complete practical work,
            submit evidence and build
            demonstrable skills through
            your courses.
          </p>
        </section>

        <section className="card">
          <h2>
            No enrolled courses
          </h2>

          <p>
            Enroll in a course to access
            its practical projects and
            capstone work.
          </p>

          <Link
            href="/courses"
            className="rn-button rn-button-primary"
          >
            Browse Courses
          </Link>
        </section>
      </div>
    );
  }

  const {
    data: courseData,
    error: courseError,
  } =
    await supabase
      .from("courses")
      .select(
        "id, title, slug, level, category, status"
      )
      .in(
        "id",
        enrolledCourseIds
      )
      .eq(
        "status",
        "published"
      );

  if (courseError) {
    console.error(
      "Failed to load project courses:",
      courseError
    );
  }

  const courses =
    (courseData ||
      []) as Course[];

  const publishedCourseIds = [
    ...new Set(
      courses.map(
        (course) =>
          course.id
      )
    ),
  ];

  if (
    publishedCourseIds.length ===
    0
  ) {
    return (
      <div className="container">
        <section className="page-header">
          <span className="rn-eyebrow">
            PROJECTS
          </span>

          <h1>
            Practical projects
          </h1>

          <p>
            Your enrolled courses do
            not currently have any
            published project work
            available.
          </p>
        </section>

        <section className="card">
          <h2>
            No published projects
          </h2>

          <p>
            Check your courses again
            as project work becomes
            available.
          </p>

          <div className="rn-project-submission-actions">
            <Link
              href="/courses"
              className="rn-button rn-button-primary"
            >
              Browse Courses
            </Link>

            <Link
              href="/student/dashboard"
              className="rn-button rn-button-secondary"
            >
              My Learning
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const {
    data: projectData,
    error: projectError,
  } =
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
      .in(
        "course_id",
        publishedCourseIds
      )
      .eq(
        "is_published",
        true
      )
      .order(
        "sort_order"
      );

  if (projectError) {
    console.error(
      "Failed to load student projects:",
      projectError
    );
  }

  /*
   * Supabase can infer the result as a
   * GenericStringError[] when the selected
   * columns are not represented in the
   * generated database types.
   *
   * The runtime result is intentionally
   * normalized to the application type.
   */
  const projects =
    (projectData ||
      []) as unknown as Project[];

  const {
    data: submissionData,
    error: submissionError,
  } =
    await supabase
      .from("project_submissions")
      .select(
        "project_id, status, score"
      )
      .eq(
        "student_id",
        user.id
      );

  if (submissionError) {
    console.error(
      "Failed to load project submissions:",
      submissionError
    );
  }

  const submissions =
    (submissionData ||
      []) as unknown as Submission[];

  const courseMap =
    new Map(
      courses.map(
        (course) => [
          course.id,
          course,
        ]
      )
    );

  const submissionMap =
    new Map(
      submissions.map(
        (submission) => [
          submission.project_id,
          submission,
        ]
      )
    );

  const approvedCount =
    projects.filter(
      (project) =>
        submissionMap.get(
          project.id
        )?.status ===
        "approved"
    ).length;

  const activeCount =
    projects.filter(
      (project) =>
        [
          "submitted",
          "under_review",
          "revision_required",
        ].includes(
          submissionMap.get(
            project.id
          )?.status ?? ""
        )
    ).length;

  const completedCount =
    approvedCount;

  return (
    <div className="container">
      <section className="page-header">
        <span className="rn-eyebrow">
          PROJECTS
        </span>

        <h1>
          Practical projects
        </h1>

        <p>
          Apply what you learn through
          practical work, case studies
          and capstone projects.
        </p>
      </section>

      <section className="dashboard-summary">
        <div className="dashboard-summary-card">
          <span>
            Available
          </span>

          <strong>
            {projects.length}
          </strong>

          <small>
            Published projects
          </small>
        </div>

        <div className="dashboard-summary-card">
          <span>
            Active
          </span>

          <strong>
            {activeCount}
          </strong>

          <small>
            Submitted or awaiting action
          </small>
        </div>

        <div className="dashboard-summary-card">
          <span>
            Approved
          </span>

          <strong>
            {approvedCount}
          </strong>

          <small>
            Projects approved
          </small>
        </div>

        <div className="dashboard-summary-card">
          <span>
            Completed
          </span>

          <strong>
            {completedCount}
          </strong>

          <small>
            Approved project work
          </small>
        </div>
      </section>

      {projects.length ===
      0 ? (
        <section className="card">
          <h2>
            No projects available
          </h2>

          <p>
            There are currently no
            published projects for
            your enrolled courses.
          </p>

          <Link
            href="/courses"
            className="rn-button rn-button-primary"
          >
            Browse Courses
          </Link>
        </section>
      ) : (
        <section className="rn-project-grid">
          {projects.map(
            (project) => {
              const course =
                courseMap.get(
                  project.course_id
                );

              const submission =
                submissionMap.get(
                  project.id
                );

              const status =
                submission?.status ??
                "draft";

              return (
                <article
                  key={project.id}
                  className="rn-project-card"
                >
                  <div className="rn-project-card-header">
                    <div>
                      <span className="rn-eyebrow">
                        {formatProjectType(
                          project.project_type
                        )}
                      </span>

                      <h2>
                        {project.title}
                      </h2>
                    </div>

                    <span
                      className={`rn-project-status ${getStatusClass(
                        status
                      )}`}
                    >
                      {formatStatus(
                        status
                      )}
                    </span>
                  </div>

                  {course ? (
                    <p className="rn-project-course">
                      {course.title}
                    </p>
                  ) : null}

                  <p>
                    {project.brief}
                  </p>

                  <div className="rn-project-meta">
                    {course?.category ? (
                      <span>
                        {course.category}
                      </span>
                    ) : null}

                    {course?.level ? (
                      <span>
                        {formatLevel(
                          course.level
                        )}
                      </span>
                    ) : null}

                    <span>
                      {
                        project
                          .deliverables
                          .length
                      }{" "}
                      deliverable
                      {project
                        .deliverables
                        .length ===
                      1
                        ? ""
                        : "s"}
                    </span>

                    <span>
                      Max score:{" "}
                      {
                        project.max_score
                      }
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

                  <div className="rn-project-card-footer">
                    <Link
                      href={`/student/projects/${project.id}`}
                      className="rn-button rn-button-primary"
                    >
                      {status ===
                      "approved"
                        ? "View Project"
                        : status ===
                          "revision_required"
                        ? "Revise Project"
                        : status ===
                          "draft"
                        ? "Continue Project"
                        : "View Submission"}
                    </Link>
                  </div>
                </article>
              );
            }
          )}
        </section>
      )}

      <section className="rn-projects-footer-actions">
        <Link
          href="/courses"
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

        <Link
          href="/student/certificates"
          className="rn-button rn-button-secondary"
        >
          My Certificates
        </Link>
      </section>
    </div>
  );
}