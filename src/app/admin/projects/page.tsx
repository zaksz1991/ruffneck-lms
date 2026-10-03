import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProjectReviewForm from "@/components/ProjectReviewForm";

type Submission = {
  id: string;
  project_id: string;
  student_id: string;
  submission_text: string | null;
  submission_url: string | null;
  status:
    | "draft"
    | "submitted"
    | "under_review"
    | "approved"
    | "revision_required";
  score: number | null;
  feedback: string | null;
  submitted_at: string | null;
};

type Project = {
  id: string;
  course_id: string;
  title: string;
  max_score: number;
};

type Course = {
  id: string;
  title: string;
};

type Student = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type Filter =
  | "all"
  | "pending"
  | "approved"
  | "revision_required";

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

function formatDate(
  value: string | null
) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-NG",
    {
      dateStyle: "medium",
    }
  ).format(new Date(value));
}

export default async function AdminProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
  }>;
}) {
  const params = await searchParams;

  const filter: Filter =
    params.status ===
      "pending" ||
    params.status === "approved" ||
    params.status ===
      "revision_required"
      ? params.status
      : "all";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      "/login?next=/admin/projects"
    );
  }

  const { data: profileData } =
    await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

  const profile =
    profileData as {
      id: string;
      role:
        | "student"
        | "instructor"
        | "admin";
    } | null;

  if (
    !profile ||
    !["admin", "instructor"].includes(
      profile.role
    )
  ) {
    redirect("/student/dashboard");
  }

  const [
    pendingResult,
    approvedResult,
    revisionResult,
  ] = await Promise.all([
    supabase
      .from("project_submissions")
      .select("*", {
        count: "exact",
        head: true,
      })
      .in("status", [
        "submitted",
        "under_review",
      ]),

    supabase
      .from("project_submissions")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("status", "approved"),

    supabase
      .from("project_submissions")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq(
        "status",
        "revision_required"
      ),
  ]);

  let query = supabase
    .from("project_submissions")
    .select(
      [
        "id",
        "project_id",
        "student_id",
        "submission_text",
        "submission_url",
        "status",
        "score",
        "feedback",
        "submitted_at",
      ].join(", ")
    )
    .order("created_at", {
      ascending: false,
    });

  if (filter === "pending") {
    query = query.in("status", [
      "submitted",
      "under_review",
    ]);
  }

  if (filter === "approved") {
    query = query.eq(
      "status",
      "approved"
    );
  }

  if (
    filter ===
    "revision_required"
  ) {
    query = query.eq(
      "status",
      "revision_required"
    );
  }

  const { data: submissionData } =
    await query;

  const submissions =
    (submissionData as unknown as Submission[]) ||
    [];

  const projectIds = Array.from(
    new Set(
      submissions.map(
        (submission) =>
          submission.project_id
      )
    )
  );

  const studentIds = Array.from(
    new Set(
      submissions.map(
        (submission) =>
          submission.student_id
      )
    )
  );

  const { data: projectData } =
    projectIds.length > 0
      ? await supabase
          .from("course_projects")
          .select(
            "id, course_id, title, max_score"
          )
          .in("id", projectIds)
      : { data: [] };

  const projects =
    (projectData as unknown as Project[]) ||
    [];

  const courseIds = Array.from(
    new Set(
      projects.map(
        (project) =>
          project.course_id
      )
    )
  );

  const { data: courseData } =
    courseIds.length > 0
      ? await supabase
          .from("courses")
          .select("id, title")
          .in("id", courseIds)
      : { data: [] };

  const courses =
    (courseData as unknown as Course[]) ||
    [];

  const { data: studentData } =
    studentIds.length > 0
      ? await supabase
          .from("profiles")
          .select(
            "id, full_name, email"
          )
          .in("id", studentIds)
      : { data: [] };

  const students =
    (studentData as unknown as Student[]) ||
    [];

  const projectMap = new Map(
    projects.map((project) => [
      project.id,
      project,
    ])
  );

  const courseMap = new Map(
    courses.map((course) => [
      course.id,
      course,
    ])
  );

  const studentMap = new Map(
    students.map((student) => [
      student.id,
      student,
    ])
  );

  const pendingCount =
    pendingResult.count || 0;

  const approvedCount =
    approvedResult.count || 0;

  const revisionCount =
    revisionResult.count || 0;

  return (
    <main className="rn-admin-projects-page">
      <div className="container">
        <div className="rn-admin-project-header">
          <div>
            <Link
              href="/admin/lms"
              className="rn-learning-back"
            >
              ← LMS Admin
            </Link>

            <span className="rn-eyebrow">
              PROJECT REVIEW
            </span>

            <h1>
              Projects & Capstones
            </h1>

            <p>
              Review practical work, manage
              revisions, approve projects and record
              assessment results.
            </p>
          </div>

          <div className="rn-admin-project-header-action">
            <Link
              href="/admin/lms"
              className="btn btn-ghost"
            >
              Back to LMS
            </Link>
          </div>
        </div>

        <section className="rn-project-review-summary">
          <Link
            href="/admin/projects?status=pending"
            className={`rn-project-review-summary-card ${
              filter === "pending"
                ? "active"
                : ""
            }`}
          >
            <strong>
              {pendingCount}
            </strong>

            <span>
              Awaiting Review
            </span>

            <small>
              Submitted + under review
            </small>
          </Link>

          <Link
            href="/admin/projects?status=approved"
            className={`rn-project-review-summary-card ${
              filter === "approved"
                ? "active"
                : ""
            }`}
          >
            <strong>
              {approvedCount}
            </strong>

            <span>
              Approved
            </span>

            <small>
              Completed project reviews
            </small>
          </Link>

          <Link
            href="/admin/projects?status=revision_required"
            className={`rn-project-review-summary-card ${
              filter ===
              "revision_required"
                ? "active"
                : ""
            }`}
          >
            <strong>
              {revisionCount}
            </strong>

            <span>
              Revision Required
            </span>

            <small>
              Waiting for learner resubmission
            </small>
          </Link>
        </section>

        <nav className="rn-project-review-tabs">
          <Link
            href="/admin/projects"
            className={
              filter === "all"
                ? "active"
                : ""
            }
          >
            All submissions
          </Link>

          <Link
            href="/admin/projects?status=pending"
            className={
              filter === "pending"
                ? "active"
                : ""
            }
          >
            Awaiting Review
          </Link>

          <Link
            href="/admin/projects?status=approved"
            className={
              filter === "approved"
                ? "active"
                : ""
            }
          >
            Approved
          </Link>

          <Link
            href="/admin/projects?status=revision_required"
            className={
              filter ===
              "revision_required"
                ? "active"
                : ""
            }
          >
            Revision Required
          </Link>
        </nav>

        {submissions.length === 0 ? (
          <section className="rn-project-empty">
            <span className="rn-eyebrow">
              {filter === "approved"
                ? "APPROVED"
                : filter ===
                    "revision_required"
                  ? "REVISION REQUIRED"
                  : filter === "pending"
                    ? "AWAITING REVIEW"
                    : "SUBMISSIONS"}
            </span>

            <h2>
              No submissions in this section
            </h2>

            <p>
              Student project submissions matching
              this workflow status will appear here.
            </p>
          </section>
        ) : (
          <section className="rn-admin-project-list">
            {submissions.map(
              (submission) => {
                const project =
                  projectMap.get(
                    submission.project_id
                  );

                if (!project) {
                  return null;
                }

                const course =
                  courseMap.get(
                    project.course_id
                  );

                const student =
                  studentMap.get(
                    submission.student_id
                  );

                return (
                  <article
                    key={submission.id}
                    className="rn-admin-project-card"
                  >
                    <div className="rn-admin-project-card-header">
                      <div>
                        <span className="rn-eyebrow">
                          {course?.title ||
                            "Course"}
                        </span>

                        <h2>
                          {project.title}
                        </h2>
                      </div>

                      <span
                        className={`rn-project-status status-${submission.status}`}
                      >
                        {formatStatus(
                          submission.status
                        )}
                      </span>
                    </div>

                    <div className="rn-admin-project-student">
                      <strong>
                        {student?.full_name ||
                          "Student"}
                      </strong>

                      <span>
                        {student?.email ||
                          "—"}
                      </span>

                      <span>
                        Submitted{" "}
                        {formatDate(
                          submission.submitted_at
                        )}
                      </span>
                    </div>

                    <div className="rn-admin-project-content">
                      {submission.submission_text ? (
                        <div>
                          <span className="rn-eyebrow">
                            WRITTEN SUBMISSION
                          </span>

                          <p>
                            {
                              submission.submission_text
                            }
                          </p>
                        </div>
                      ) : null}

                      {submission.submission_url ? (
                        <a
                          href={
                            submission.submission_url
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rn-button rn-button-secondary"
                        >
                          Open Supporting Work
                        </a>
                      ) : null}
                    </div>

                    <ProjectReviewForm
                      submissionId={
                        submission.id
                      }
                      initialStatus={
                        submission.status
                      }
                      initialScore={
                        submission.score
                      }
                      initialFeedback={
                        submission.feedback ||
                        ""
                      }
                      maxScore={
                        project.max_score
                      }
                    />
                  </article>
                );
              }
            )}
          </section>
        )}
      </div>
    </main>
  );
}