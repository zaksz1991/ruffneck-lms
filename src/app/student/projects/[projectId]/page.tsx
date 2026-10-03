import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProjectSubmissionForm from "@/components/ProjectSubmissionForm";

type Project = {
  id: string;
  course_id: string;
  title: string;
  project_type: "practical" | "case_study" | "capstone";
  brief: string;
  scenario: string | null;
  deliverables: string[];
  submission_instructions: string | null;
  evaluation_criteria: string[];
  max_score: number;
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
  reviewed_at: string | null;
};

type Course = {
  id: string;
  title: string;
  slug: string;
  level: "beginner" | "intermediate" | "advanced";
  category: string | null;
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
    return null;
  }

  return new Intl.DateTimeFormat(
    "en-NG",
    {
      dateStyle: "medium",
    }
  ).format(new Date(value));
}

export default async function StudentProjectPage({
  params,
}: {
  params: Promise<{
    projectId: string;
  }>;
}) {
  const { projectId } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?next=/student/projects/${projectId}`
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
          "scenario",
          "deliverables",
          "submission_instructions",
          "evaluation_criteria",
          "max_score",
        ].join(", ")
      )
      .eq("id", projectId)
      .eq("is_published", true)
      .maybeSingle();

  const project =
    projectData as unknown as Project | null;

  if (!project) {
    notFound();
  }

  const { data: enrollment } =
    await supabase
      .from("enrollments")
      .select(
        "id, enrollment_status, progress_percent"
      )
      .eq("student_id", user.id)
      .eq("course_id", project.course_id)
      .in("enrollment_status", [
        "active",
        "completed",
      ])
      .maybeSingle();

  if (!enrollment) {
    redirect("/student/projects");
  }

  const { data: courseData } =
    await supabase
      .from("courses")
      .select(
        "id, title, slug, level, category"
      )
      .eq("id", project.course_id)
      .maybeSingle();

  const course =
    courseData as unknown as Course | null;

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
          "reviewed_at",
        ].join(", ")
      )
      .eq("project_id", project.id)
      .eq("student_id", user.id)
      .maybeSingle();

  const submission =
    submissionData as unknown as Submission | null;

  const locked =
    submission &&
    submission.status !== "draft";

  return (
    <main className="rn-project-workspace">
      <div className="container">
        <div className="rn-project-workspace-top">
          <Link
            href="/student/projects"
            className="rn-learning-back"
          >
            ← Projects & Capstones
          </Link>

          {course ? (
            <Link
              href={`/courses/${course.slug}`}
              className="rn-text-link"
            >
              View course
            </Link>
          ) : null}
        </div>

        <section className="rn-project-hero">
          <span className="rn-eyebrow">
            {course?.category ||
              "PRACTICAL CAPSTONE"}
          </span>

          <h1>{project.title}</h1>

          {course ? (
            <p className="rn-project-hero-course">
              {course.title}
            </p>
          ) : null}

          <div className="rn-project-hero-meta">
            <span>
              {project.deliverables.length}{" "}
              deliverables
            </span>

            <span>
              Maximum score:{" "}
              {project.max_score}
            </span>

            {submission ? (
              <span>
                Status:{" "}
                {formatStatus(
                  submission.status
                )}
              </span>
            ) : null}
          </div>
        </section>

        <div className="rn-project-workspace-grid">
          <div>
            <section className="rn-project-section">
              <span className="rn-eyebrow">
                PROJECT BRIEF
              </span>

              <h2>
                Your assignment
              </h2>

              <p>
                {project.brief}
              </p>
            </section>

            {project.scenario ? (
              <section className="rn-project-section rn-project-scenario">
                <span className="rn-eyebrow">
                  SCENARIO
                </span>

                <h2>
                  Real-world context
                </h2>

                <p>
                  {project.scenario}
                </p>
              </section>
            ) : null}

            <section className="rn-project-section">
              <span className="rn-eyebrow">
                REQUIRED DELIVERABLES
              </span>

              <h2>
                What you must submit
              </h2>

              <div className="rn-project-deliverables">
                {project.deliverables.map(
                  (
                    deliverable,
                    index
                  ) => (
                    <div
                      key={deliverable}
                      className="rn-project-deliverable"
                    >
                      <span>
                        {String(
                          index + 1
                        ).padStart(
                          2,
                          "0"
                        )}
                      </span>

                      <p>
                        {deliverable}
                      </p>
                    </div>
                  )
                )}
              </div>
            </section>

            <section className="rn-project-section">
              <span className="rn-eyebrow">
                EVALUATION
              </span>

              <h2>
                How your work will be evaluated
              </h2>

              <div className="rn-project-criteria">
                {project.evaluation_criteria.map(
                  (criterion) => (
                    <div
                      key={criterion}
                    >
                      <span>✓</span>

                      <p>
                        {criterion}
                      </p>
                    </div>
                  )
                )}
              </div>
            </section>

            {project.submission_instructions ? (
              <section className="rn-project-section">
                <span className="rn-eyebrow">
                  SUBMISSION GUIDANCE
                </span>

                <h2>
                  Before you submit
                </h2>

                <p>
                  {
                    project.submission_instructions
                  }
                </p>
              </section>
            ) : null}
          </div>

          <aside className="rn-project-submission-column">
            {submission &&
            submission.status !==
              "draft" ? (
              <section className="rn-project-status-card">
                <span className="rn-eyebrow">
                  SUBMISSION STATUS
                </span>

                <h2>
                  {formatStatus(
                    submission.status
                  )}
                </h2>

                {submission.score !==
                null ? (
                  <div className="rn-project-result-score">
                    <strong>
                      {submission.score}
                    </strong>

                    <span>
                      / {project.max_score}
                    </span>
                  </div>
                ) : null}

                {submission.submitted_at ? (
                  <small>
                    Submitted{" "}
                    {formatDate(
                      submission.submitted_at
                    )}
                  </small>
                ) : null}

                {submission.feedback ? (
                  <div className="rn-project-feedback">
                    <strong>
                      Reviewer feedback
                    </strong>

                    <p>
                      {submission.feedback}
                    </p>
                  </div>
                ) : (
                  <p>
                    Your submission is waiting
                    for review.
                  </p>
                )}
              </section>
            ) : null}

            {!locked ? (
              <ProjectSubmissionForm
                projectId={project.id}
                initialText={
                  submission?.submission_text ||
                  ""
                }
                initialUrl={
                  submission?.submission_url ||
                  ""
                }
                initialStatus={
                  submission?.status ||
                  "draft"
                }
              />
            ) : null}

            {locked ? (
              <div className="rn-project-locked">
                <strong>
                  Submission locked
                </strong>

                <p>
                  This submission has been
                  sent for review and cannot
                  be edited while it is being
                  evaluated.
                </p>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}