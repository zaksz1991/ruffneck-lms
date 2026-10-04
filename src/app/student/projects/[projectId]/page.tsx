import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProjectSubmissionForm from "@/components/ProjectSubmissionForm";

type Project = {
  id: string;
  course_id: string;
  title: string;
  project_type:
    | "practical"
    | "case_study"
    | "capstone";
  brief: string;
  scenario: string | null;
  deliverables: string[] | null;
  submission_instructions: string | null;
  evaluation_criteria: string[] | null;
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
  level:
    | "beginner"
    | "intermediate"
    | "advanced";
  category: string | null;
  status: "draft" | "published" | "archived";
};

type Enrollment = {
  id: string;
  enrollment_status:
    | "active"
    | "completed"
    | "cancelled";
  progress_percent: number;
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

function formatDate(
  value: string | null
) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(
    "en-NG",
    {
      dateStyle: "medium",
    }
  ).format(date);
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

  if (projectError) {
    console.error(
      "Failed to load student project:",
      projectError
    );

    throw new Error(
      "Unable to load the project."
    );
  }

  const project =
    projectData as unknown as Project | null;

  if (!project) {
    notFound();
  }

  const {
    data: courseData,
    error: courseError,
  } = await supabase
    .from("courses")
    .select(
      "id, title, slug, level, category, status"
    )
    .eq("id", project.course_id)
    .eq("status", "published")
    .maybeSingle();

  if (courseError) {
    console.error(
      "Failed to load project course:",
      courseError
    );

    throw new Error(
      "Unable to load the course."
    );
  }

  const course =
    courseData as unknown as Course | null;

  if (!course) {
    notFound();
  }

  const {
    data: enrollmentData,
    error: enrollmentError,
  } = await supabase
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

  if (enrollmentError) {
    console.error(
      "Failed to load project enrollment:",
      enrollmentError
    );

    throw new Error(
      "Unable to verify course enrollment."
    );
  }

  const enrollment =
    enrollmentData as Enrollment | null;

  if (!enrollment) {
    redirect("/student/projects");
  }

  const {
    data: submissionData,
    error: submissionError,
  } = await supabase
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

  if (submissionError) {
    console.error(
      "Failed to load project submission:",
      submissionError
    );

    throw new Error(
      "Unable to load your project submission."
    );
  }

  const submission =
    submissionData as unknown as Submission | null;

  const deliverables =
    Array.isArray(project.deliverables)
      ? project.deliverables
      : [];

  const evaluationCriteria =
    Array.isArray(
      project.evaluation_criteria
    )
      ? project.evaluation_criteria
      : [];

  /*
   * Only draft and revision-required
   * submissions can be changed by the
   * student.
   *
   * Submitted, under-review and approved
   * submissions remain locked.
   */
  const canEdit =
    !submission ||
    submission.status === "draft" ||
    submission.status ===
      "revision_required";

  const submittedDate =
    formatDate(
      submission?.submitted_at || null
    );

  const reviewedDate =
    formatDate(
      submission?.reviewed_at || null
    );

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

          <Link
            href={`/courses/${course.slug}`}
            className="rn-text-link"
          >
            View course
          </Link>
        </div>

        <section className="rn-project-hero">
          <span className="rn-eyebrow">
            {formatProjectType(
              project.project_type
            )}
          </span>

          <h1>{project.title}</h1>

          <p className="rn-project-hero-course">
            {course.title}
          </p>

          <div className="rn-project-hero-meta">
            <span>
              {deliverables.length}{" "}
              deliverables
            </span>

            <span>
              Maximum score:{" "}
              {project.max_score}
            </span>

            <span>
              Status:{" "}
              {submission
                ? formatStatus(
                    submission.status
                  )
                : "Not Started"}
            </span>
          </div>
        </section>

        {submission?.status ===
        "revision_required" ? (
          <section className="rn-project-revision-banner">
            <div>
              <span className="rn-eyebrow">
                REVISION REQUIRED
              </span>

              <h2>
                Your project needs revision
              </h2>

              <p>
                Review the assessor feedback,
                update your work and resubmit
                the project for another review.
              </p>
            </div>

            {submission.feedback ? (
              <div className="rn-project-revision-feedback">
                <strong>
                  Assessor feedback
                </strong>

                <p>
                  {submission.feedback}
                </p>
              </div>
            ) : null}
          </section>
        ) : null}

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

              {deliverables.length > 0 ? (
                <div className="rn-project-deliverables">
                  {deliverables.map(
                    (
                      deliverable,
                      index
                    ) => (
                      <div
                        key={`${project.id}-deliverable-${index}`}
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
              ) : (
                <p>
                  Follow the project brief and
                  submission guidance when
                  preparing your work.
                </p>
              )}
            </section>

            <section className="rn-project-section">
              <span className="rn-eyebrow">
                EVALUATION
              </span>

              <h2>
                How your work will be evaluated
              </h2>

              {evaluationCriteria.length >
              0 ? (
                <div className="rn-project-criteria">
                  {evaluationCriteria.map(
                    (
                      criterion,
                      index
                    ) => (
                      <div
                        key={`${project.id}-criterion-${index}`}
                      >
                        <span>
                          {index + 1}
                        </span>

                        <p>
                          {criterion}
                        </p>
                      </div>
                    )
                  )}
                </div>
              ) : (
                <p>
                  Your submission will be
                  evaluated against the project
                  requirements and course
                  objectives.
                </p>
              )}
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
              "draft" &&
            submission.status !==
              "revision_required" ? (
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

                {submittedDate ? (
                  <small>
                    Submitted{" "}
                    {submittedDate}
                  </small>
                ) : null}

                {reviewedDate ? (
                  <small>
                    Reviewed{" "}
                    {reviewedDate}
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
                    for the next review action.
                  </p>
                )}
              </section>
            ) : null}

            {canEdit ? (
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
            ) : (
              <section className="rn-project-status-card">
                <span className="rn-eyebrow">
                  SUBMISSION LOCKED
                </span>

                <h2>
                  No further changes required
                </h2>

                <p>
                  Your submission is currently{" "}
                  <strong>
                    {submission
                      ? formatStatus(
                          submission.status
                        )
                      : "unavailable"}
                  </strong>
                  . Student editing is disabled
                  while the submission is being
                  reviewed or after approval.
                </p>

                {submission?.status ===
                  "approved" ? (
                  <Link
                    href="/student/certificates"
                    className="rn-button rn-button-primary"
                  >
                    View Certificates
                  </Link>
                ) : null}
              </section>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}