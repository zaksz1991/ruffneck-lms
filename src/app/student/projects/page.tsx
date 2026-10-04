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
  status: "draft" | "published" | "archived";
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

  const {
    data: enrollmentData,
    error: enrollmentError,
  } = await supabase
    .from("enrollments")
    .select(
      "course_id, enrollment_status, progress_percent"
    )
    .eq("student_id", user.id)
    .in("enrollment_status", [
      "active",
      "completed",
    ]);

  if (enrollmentError) {
    console.error(
      "Failed to load project enrollments:",
      enrollmentError
    );
  }

  const enrollments =
    (enrollmentData || []) as Enrollment[];

  const enrolledCourseIds = [
    ...new Set(
      enrollments.map(
        (item) => item.course_id
      )
    ),
  ];

  if (enrolledCourseIds.length === 0) {
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
              demonstrate the skills developed
              through your courses.
            </p>
          </section>

          <section className="rn-project-empty">
            <span className="rn-eyebrow">
              START LEARNING
            </span>

            <h2>
              No enrolled courses yet
            </h2>

            <p>
              Enroll in a RuffNeck Learn course
              to access its practical projects
              and capstone work.
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

  const {
    data: courseData,
    error: courseError,
  } = await supabase
    .from("courses")
    .select(
      "id, title, slug, level, category, status"
    )
    .in("id", enrolledCourseIds)
    .eq("status", "published");

  if (courseError) {
    console.error(
      "Failed to load enrolled courses:",
      courseError
    );
  }

  const courses =
    (courseData || []) as Course[];

  const publishedCourseIds = [
    ...new Set(
      courses.map((course) => course.id)
    ),
  ];

  if (publishedCourseIds.length === 0) {
    return (
      <main className="rn-projects-page">
        <div className="container">
          <section className="rn-projects-header">
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
              Your available project work appears
              here when it belongs to a currently
              published course.
            </p>
          </section>

          <section className="rn-project-empty">
            <span className="rn-eyebrow">
              NO AVAILABLE PROJECTS
            </span>

            <h2>
              No published course projects yet
            </h2>

            <p>
              Your enrolled courses are not
              currently available as published
              learning courses.
            </p>

            <Link
              href="/student/dashboard"
              className="rn-button rn-button-primary"
            >
              Return to Dashboard
            </Link>
          </section>
        </div>
      </main>
    );
  }

  const {
    data: projectData,
    error: projectError,
  } = await supabase
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
    .eq("is_published", true)
    .order("sort_order");

  if (projectError) {
    console.error(
      "Failed to load student projects:",
      projectError
    );
  }

  const projects =
    (projectData || []) as Project[];

  const {
    data: submissionData,
    error: submissionError,
  } = await supabase
    .from("project_submissions")
    .select(
      "project_id, status, score"
    )
    .eq("student_id", user.id);

  if (submissionError) {
    console.error(
      "Failed to load project submissions:",
      submissionError
    );
  }

  const submissions =
    (submissionData || []) as Submission[];

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
    projects.filter((project) => {
      const submission =
        submissionMap.get(project.id);

      return (
        submission?.status === "approved"
      );
    }).length;

  const activeCount =
    projects.filter((project) => {
      const submission =
        submissionMap.get(project.id);

      return (
        submission?.status ===
          "submitted" ||
        submission?.status ===
          "under_review" ||
        submission?.status ===
          "revision_required"
      );
    }).length;

  const completedCount =
    projects.filter((project) => {
      const submission =
        submissionMap.get(project.id);

      return (
        submission?.status === "approved"
      );
    }).length;

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

            <h1>
              Projects & Capstones
            </h1>

            <p>
              Demonstrate your knowledge by
              completing real-world projects
              aligned with your courses.
            </p>
          </div>

          <div className="rn-project-summary">
            <div>
              <strong>
                {projects.length}
              </strong>

              <span>
                Available
              </span>
            </div>

            <div>
              <strong>
                {approvedCount}
              </strong>

              <span>
                Approved
              </span>
            </div>

            <div>
              <strong>
                {activeCount}
              </strong>

              <span>
                Active
              </span>
            </div>

            <div>
              <strong>
                {completedCount}
              </strong>

              <span>
                Completed
              </span>
            </div>
          </div>
        </section>

        {projects.length === 0 ? (
          <section className="rn-project-empty">
            <span className="rn-eyebrow">
              PROJECT LIBRARY
            </span>

            <h2>
              No projects available yet
            </h2>

            <p>
              Published practical projects and
              capstones from your enrolled
              courses will appear here.
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
                      {formatProjectType(
                        project.project_type
                      )}
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

                  <h2>
                    {project.title}
                  </h2>

                  <p className="rn-project-course">
                    {course?.title ||
                      "RuffNeck Learn Course"}
                  </p>

                  {course?.category ? (
                    <span className="rn-project-category">
                      {course.category}
                    </span>
                  ) : null}

                  <p>
                    {project.brief}
                  </p>

                  <div className="rn-project-card-meta">
                    <span>
                      {Array.isArray(
                        project.deliverables
                      )
                        ? project
                            .deliverables
                            .length
                        : 0}{" "}
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
        )}

        <div className="rn-project-footer-actions">
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
            Certificates
          </Link>
        </div>
      </div>
    </main>
  );
}