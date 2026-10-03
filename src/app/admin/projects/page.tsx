import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProjectReviewForm from "@/components/ProjectReviewForm";

type Profile = {
  id: string;
  role:
    | "student"
    | "instructor"
    | "admin";
};

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

export default async function AdminProjectsPage() {
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
    profileData as unknown as Profile | null;

  if (
    !profile ||
    !["admin", "instructor"].includes(
      profile.role
    )
  ) {
    redirect("/student/dashboard");
  }

  const { data: submissionData } =
    await supabase
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
        (project) => project.course_id
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
    projects.map((item) => [
      item.id,
      item,
    ])
  );

  const courseMap = new Map(
    courses.map((item) => [
      item.id,
      item,
    ])
  );

  const studentMap = new Map(
    students.map((item) => [
      item.id,
      item,
    ])
  );

  const pendingCount =
    submissions.filter((item) =>
      [
        "submitted",
        "under_review",
      ].includes(item.status)
    ).length;

  const approvedCount =
    submissions.filter(
      (item) =>
        item.status === "approved"
    ).length;

  const revisionCount =
    submissions.filter(
      (item) =>
        item.status ===
        "revision_required"
    ).length;

  return (
    <main className="rn-admin-projects-page">
      <div className="container">
        <div className="rn-admin-project-header">
          <div>
            <Link
              href="/admin"
              className="rn-learning-back"
            >
              ← Admin Dashboard
            </Link>

            <span className="rn-eyebrow">
              PROJECT REVIEW
            </span>

            <h1>
              Projects & Capstones
            </h1>

            <p>
              Review student practical work,
              provide feedback and record final
              scores.
            </p>
          </div>

          <div className="rn-admin-project-stats">
            <div>
              <strong>
                {pendingCount}
              </strong>
              <span>Awaiting review</span>
            </div>

            <div>
              <strong>
                {approvedCount}
              </strong>
              <span>Approved</span>
            </div>

            <div>
              <strong>
                {revisionCount}
              </strong>
              <span>Revision required</span>
            </div>
          </div>
        </div>

        {submissions.length === 0 ? (
          <section className="rn-project-empty">
            <span className="rn-eyebrow">
              SUBMISSIONS
            </span>

            <h2>
              No project submissions yet
            </h2>

            <p>
              Student capstone submissions will
              appear here when they are submitted.
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

                const course =
                  project
                    ? courseMap.get(
                        project.course_id
                      )
                    : null;

                const student =
                  studentMap.get(
                    submission.student_id
                  );

                if (!project) {
                  return null;
                }

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