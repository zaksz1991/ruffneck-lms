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
  level: "beginner" | "intermediate" | "advanced";
  category: string | null;
  status: "draft" | "published" | "archived";
};

type Enrollment = {
  id: string;
  enrollment_status: "active" | "completed" | "cancelled";
  progress_percent: number;
};

const PAGE_STYLES = `
  .rn-project-workspace {
    --pw-navy: #0b1e3a;
    --pw-blue: #1264a3;
    --pw-cyan: #00b4d8;
    --pw-ink: #24334a;
    --pw-muted: #64748b;
    --pw-border: #e2e8f0;
    --pw-green: #167647;

    padding: 25px 0 55px;
    color: var(--pw-ink);
  }

  .rn-project-workspace *,
  .rn-project-workspace *::before,
  .rn-project-workspace *::after {
    box-sizing: border-box;
  }

  .rn-project-workspace a {
    text-decoration: none;
  }

  .rn-project-workspace .rn-eyebrow {
    display: block;
    margin: 0 0 9px;
    color: #087e9b;
    font-size: 10px;
    font-weight: 850;
    letter-spacing: 1.45px;
    line-height: 1.65;
  }

  .rn-project-workspace .rn-project-workspace-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 18px;
  }

  .rn-project-workspace .rn-learning-back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #52647a;
    font-size: 12px;
    font-weight: 800;
    line-height: 1.7;
  }

  .rn-project-workspace .rn-learning-back:hover {
    color: var(--pw-blue);
  }

  .rn-project-workspace .rn-text-link {
    color: var(--pw-blue);
    font-size: 12px;
    font-weight: 800;
    line-height: 1.7;
    text-underline-offset: 3px;
  }

  .rn-project-workspace .rn-text-link:hover {
    text-decoration: underline;
  }

  .rn-project-workspace .rn-project-hero {
    position: relative;
    isolation: isolate;
    overflow: hidden;
    padding: 31px;
    margin-bottom: 23px;
    border: 1px solid #153c60;
    border-radius: 15px;
    background: linear-gradient(
      125deg,
      #0b1e3a,
      #123b61 68%,
      #07566c
    );
    color: #fff;
  }

  .rn-project-workspace .rn-project-hero::after {
    position: absolute;
    z-index: -1;
    top: -130px;
    right: -55px;
    width: 280px;
    height: 280px;
    border: 1px solid rgba(255,255,255,.14);
    border-radius: 50%;
    box-shadow:
      0 0 0 30px rgba(255,255,255,.035),
      0 0 0 65px rgba(255,255,255,.025);
    content: "";
    pointer-events: none;
  }

  .rn-project-workspace .rn-project-hero .rn-eyebrow {
    color: #67e8f9;
  }

  .rn-project-workspace .rn-project-hero h1 {
    max-width: 850px;
    margin: 0;
    color: #fff;
    font-size: clamp(29px, 4vw, 39px);
    font-weight: 850;
    letter-spacing: -1px;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }

  .rn-project-workspace .rn-project-hero-course {
    margin: 10px 0 0;
    color: #d3e8f6;
    font-size: 14px;
    font-weight: 700;
    line-height: 1.8;
    overflow-wrap: anywhere;
  }

  .rn-project-workspace .rn-project-hero-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 9px;
    margin-top: 21px;
  }

  .rn-project-workspace .rn-project-hero-meta span {
    display: inline-flex;
    align-items: center;
    padding: 7px 10px;
    border: 1px solid rgba(255,255,255,.19);
    border-radius: 7px;
    background: rgba(255,255,255,.075);
    color: #eff8ff;
    font-size: 11px;
    font-weight: 750;
    line-height: 1.6;
    overflow-wrap: anywhere;
  }

  .rn-project-workspace .rn-project-revision-banner {
    padding: 22px;
    margin-bottom: 23px;
    border: 1px solid #efc5c8;
    border-radius: 13px;
    background: linear-gradient(145deg, #fff5f5, #fff 80%);
  }

  .rn-project-workspace .rn-project-revision-banner .rn-eyebrow {
    color: #a32635;
  }

  .rn-project-workspace .rn-project-revision-banner h2 {
    margin: 0;
    color: #84202b;
    font-size: 21px;
    font-weight: 850;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  .rn-project-workspace .rn-project-revision-banner > div > p {
    margin: 9px 0 0;
    color: #7c3942;
    font-size: 13px;
    line-height: 1.8;
  }

  .rn-project-workspace .rn-project-revision-feedback {
    padding: 15px;
    margin-top: 17px;
    border: 1px solid #f0d9dc;
    border-radius: 9px;
    background: #fff;
  }

  .rn-project-workspace .rn-project-revision-feedback strong {
    display: block;
    color: #84202b;
    font-size: 12px;
    font-weight: 850;
    line-height: 1.6;
  }

  .rn-project-workspace .rn-project-revision-feedback p {
    margin: 7px 0 0;
    color: #633a41;
    font-size: 13px;
    line-height: 1.85;
    overflow-wrap: anywhere;
    white-space: pre-line;
  }

  .rn-project-workspace .rn-project-workspace-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 350px;
    align-items: start;
    gap: 22px;
  }

  .rn-project-workspace .rn-project-workspace-grid > div {
    display: grid;
    min-width: 0;
    gap: 17px;
  }

  .rn-project-workspace .rn-project-section {
    min-width: 0;
    padding: 24px;
    border: 1px solid var(--pw-border);
    border-radius: 13px;
    background: #fff;
    box-shadow: 0 3px 12px rgba(11,30,58,.025);
  }

  .rn-project-workspace .rn-project-section h2 {
    margin: 0;
    color: var(--pw-navy);
    font-size: 21px;
    font-weight: 850;
    letter-spacing: -.35px;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  .rn-project-workspace .rn-project-section > p {
    margin: 13px 0 0;
    color: #52627a;
    font-size: 13px;
    line-height: 1.95;
    overflow-wrap: anywhere;
    white-space: pre-line;
  }

  .rn-project-workspace .rn-project-scenario {
    border-color: #d5e8f5;
    background: linear-gradient(145deg, #f4f9ff, #fff 75%);
  }

  .rn-project-workspace .rn-project-scenario .rn-eyebrow {
    color: var(--pw-blue);
  }

  .rn-project-workspace .rn-project-deliverables {
    display: grid;
    gap: 10px;
    margin-top: 19px;
  }

  .rn-project-workspace .rn-project-deliverable {
    display: flex;
    align-items: flex-start;
    gap: 13px;
    min-width: 0;
    padding: 14px;
    border: 1px solid #e7edf4;
    border-radius: 10px;
    background: #fafcff;
  }

  .rn-project-workspace .rn-project-deliverable > span {
    display: inline-flex;
    width: 34px;
    height: 34px;
    flex: 0 0 34px;
    align-items: center;
    justify-content: center;
    border: 1px solid #cdebf2;
    border-radius: 9px;
    background: #effbfe;
    color: #087e9b;
    font-size: 11px;
    font-weight: 850;
  }

  .rn-project-workspace .rn-project-deliverable p {
    min-width: 0;
    margin: 5px 0 0;
    color: #40516a;
    font-size: 12px;
    line-height: 1.85;
    overflow-wrap: anywhere;
    white-space: pre-line;
  }

  .rn-project-workspace .rn-project-criteria {
    display: grid;
    gap: 10px;
    margin-top: 19px;
  }

  .rn-project-workspace .rn-project-criteria > div {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    min-width: 0;
    padding: 13px;
    border: 1px solid #e8edf4;
    border-radius: 9px;
    background: #fafcff;
  }

  .rn-project-workspace .rn-project-criteria > div > span {
    display: inline-flex;
    width: 26px;
    height: 26px;
    flex: 0 0 26px;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: #e8f0fa;
    color: #315c85;
    font-size: 11px;
    font-weight: 850;
  }

  .rn-project-workspace .rn-project-criteria p {
    min-width: 0;
    margin: 3px 0 0;
    color: #40516a;
    font-size: 12px;
    line-height: 1.85;
    overflow-wrap: anywhere;
    white-space: pre-line;
  }

  .rn-project-workspace .rn-project-submission-column {
    display: grid;
    min-width: 0;
    gap: 16px;
  }

  .rn-project-workspace .rn-project-status-card {
    min-width: 0;
    padding: 23px;
    border: 1px solid var(--pw-border);
    border-radius: 13px;
    background: #fff;
    box-shadow: 0 3px 12px rgba(11,30,58,.03);
  }

  .rn-project-workspace .rn-project-status-card h2 {
    margin: 0;
    color: var(--pw-navy);
    font-size: 21px;
    font-weight: 850;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .rn-project-workspace .rn-project-status-card > p {
    margin: 13px 0 0;
    color: var(--pw-muted);
    font-size: 12px;
    line-height: 1.85;
    overflow-wrap: anywhere;
    white-space: pre-line;
  }

  .rn-project-workspace .rn-project-status-card > small {
    display: block;
    margin-top: 10px;
    color: var(--pw-muted);
    font-size: 11px;
    line-height: 1.7;
  }

  .rn-project-workspace .rn-project-result-score {
    display: flex;
    align-items: baseline;
    gap: 7px;
    padding: 17px;
    margin-top: 17px;
    border: 1px solid #ccebd8;
    border-radius: 10px;
    background: #f2fcf6;
  }

  .rn-project-workspace .rn-project-result-score strong {
    color: #167647;
    font-size: 35px;
    font-weight: 900;
    letter-spacing: -1px;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }

  .rn-project-workspace .rn-project-result-score span {
    color: #4b7460;
    font-size: 13px;
    font-weight: 750;
  }

  .rn-project-workspace .rn-project-feedback {
    padding: 15px;
    margin-top: 18px;
    border: 1px solid #dbe6f2;
    border-radius: 9px;
    background: #f8fafd;
  }

  .rn-project-workspace .rn-project-feedback strong {
    color: var(--pw-navy);
    font-size: 12px;
    font-weight: 850;
    line-height: 1.6;
  }

  .rn-project-workspace .rn-project-feedback p {
    margin: 8px 0 0;
    color: #52627a;
    font-size: 12px;
    line-height: 1.85;
    overflow-wrap: anywhere;
    white-space: pre-line;
  }

  .rn-project-workspace .rn-project-status-card .rn-button {
    display: inline-flex;
    min-height: 42px;
    align-items: center;
    justify-content: center;
    padding: 10px 15px;
    margin-top: 16px;
    border: 1px solid var(--pw-navy);
    border-radius: 8px;
    background: var(--pw-navy);
    color: #fff;
    font-size: 12px;
    font-weight: 800;
    line-height: 1.5;
    text-align: center;
    text-decoration: none;
  }

  .rn-project-workspace .rn-project-status-card .rn-button:hover {
    background: #174b77;
  }

  /*
   * Style the existing submission component without changing its
   * handlers, fields, upload behavior, or submit API.
   */
  .rn-project-workspace .rn-project-submission-column form {
    min-width: 0;
  }

  .rn-project-workspace .rn-project-submission-column input:not([type="checkbox"]):not([type="radio"]),
  .rn-project-workspace .rn-project-submission-column textarea,
  .rn-project-workspace .rn-project-submission-column select {
    width: 100%;
    max-width: 100%;
    border: 1px solid #cbd7e5;
    border-radius: 8px;
    background: #fff;
    color: var(--pw-ink);
    font: inherit;
    line-height: 1.65;
  }

  .rn-project-workspace .rn-project-submission-column input:not([type="checkbox"]):not([type="radio"]),
  .rn-project-workspace .rn-project-submission-column select {
    min-height: 43px;
    padding: 10px 12px;
  }

  .rn-project-workspace .rn-project-submission-column textarea {
    min-height: 130px;
    padding: 12px;
    resize: vertical;
  }

  .rn-project-workspace .rn-project-submission-column input:focus,
  .rn-project-workspace .rn-project-submission-column textarea:focus,
  .rn-project-workspace .rn-project-submission-column select:focus {
    border-color: var(--pw-blue);
    outline: 3px solid rgba(18,100,163,.12);
    outline-offset: 1px;
  }

  .rn-project-workspace .rn-project-submission-column button {
    max-width: 100%;
    overflow-wrap: anywhere;
  }

  .rn-project-workspace .rn-project-submission-column label {
    color: #34465e;
    font-size: 12px;
    font-weight: 750;
    line-height: 1.7;
  }

  .rn-project-workspace a:focus-visible,
  .rn-project-workspace button:focus-visible {
    outline: 3px solid rgba(0,180,216,.4);
    outline-offset: 3px;
  }

  @media (max-width: 1000px) {
    .rn-project-workspace .rn-project-workspace-grid {
      grid-template-columns: minmax(0, 1fr) 310px;
      gap: 16px;
    }

    .rn-project-workspace .rn-project-section {
      padding: 20px;
    }

    .rn-project-workspace .rn-project-status-card {
      padding: 19px;
    }
  }

  @media (max-width: 800px) {
    .rn-project-workspace .rn-project-workspace-grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .rn-project-workspace .rn-project-submission-column {
      grid-row: 1;
    }
  }

  @media (max-width: 480px) {
    .rn-project-workspace {
      padding-top: 14px;
      padding-bottom: 35px;
    }

    .rn-project-workspace .rn-project-workspace-top {
      align-items: flex-start;
      gap: 12px;
    }

    .rn-project-workspace .rn-project-hero {
      padding: 22px 17px;
      border-radius: 12px;
    }

    .rn-project-workspace .rn-project-hero h1 {
      font-size: 28px;
    }

    .rn-project-workspace .rn-project-hero-course {
      font-size: 13px;
    }

    .rn-project-workspace .rn-project-hero-meta {
      gap: 7px;
      margin-top: 17px;
    }

    .rn-project-workspace .rn-project-hero-meta span {
      font-size: 10px;
    }

    .rn-project-workspace .rn-project-section {
      padding: 18px 15px;
    }

    .rn-project-workspace .rn-project-section h2 {
      font-size: 19px;
    }

    .rn-project-workspace .rn-project-deliverable {
      gap: 10px;
      padding: 12px;
    }

    .rn-project-workspace .rn-project-status-card {
      padding: 19px 16px;
    }

    .rn-project-workspace .rn-project-revision-banner {
      padding: 19px 16px;
    }

    .rn-project-workspace .rn-project-revision-banner h2 {
      font-size: 19px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .rn-project-workspace *,
    .rn-project-workspace *::before,
    .rn-project-workspace *::after {
      transition-duration: .01ms !important;
    }
  }
`;

function formatStatus(status: Submission["status"]) {
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

function formatProjectType(projectType: Project["project_type"]) {
  switch (projectType) {
    case "case_study":
      return "Case Study";
    case "capstone":
      return "Capstone";
    default:
      return "Practical Project";
  }
}

function formatDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeZone: "Africa/Lagos",
  }).format(date);
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
      `/login?next=/student/projects/${encodeURIComponent(projectId)}`,
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
      ].join(", "),
    )
    .eq("id", projectId)
    .eq("is_published", true)
    .maybeSingle();

  if (projectError) {
    console.error(
      "Failed to load student project:",
      projectError,
    );

    throw new Error("Unable to load the project.");
  }

  const project = projectData as unknown as Project | null;

  if (!project) {
    notFound();
  }

  const {
    data: courseData,
    error: courseError,
  } = await supabase
    .from("courses")
    .select("id, title, slug, level, category, status")
    .eq("id", project.course_id)
    .eq("status", "published")
    .maybeSingle();

  if (courseError) {
    console.error(
      "Failed to load project course:",
      courseError,
    );

    throw new Error("Unable to load the course.");
  }

  const course = courseData as unknown as Course | null;

  if (!course) {
    notFound();
  }

  const {
    data: enrollmentData,
    error: enrollmentError,
  } = await supabase
    .from("enrollments")
    .select("id, enrollment_status, progress_percent")
    .eq("student_id", user.id)
    .eq("course_id", project.course_id)
    .in("enrollment_status", ["active", "completed"])
    .maybeSingle();

  if (enrollmentError) {
    console.error(
      "Failed to load project enrollment:",
      enrollmentError,
    );

    throw new Error("Unable to verify course enrollment.");
  }

  const enrollment = enrollmentData as Enrollment | null;

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
      ].join(", "),
    )
    .eq("project_id", project.id)
    .eq("student_id", user.id)
    .maybeSingle();

  if (submissionError) {
    console.error(
      "Failed to load project submission:",
      submissionError,
    );

    throw new Error("Unable to load your project submission.");
  }

  const submission = submissionData as unknown as Submission | null;

  const deliverables = Array.isArray(project.deliverables)
    ? project.deliverables
    : [];

  const evaluationCriteria = Array.isArray(
    project.evaluation_criteria,
  )
    ? project.evaluation_criteria
    : [];

  /*
   * Preserve existing submission rules:
   * only draft and revision-required records can be edited.
   */
  const canEdit =
    !submission ||
    submission.status === "draft" ||
    submission.status === "revision_required";

  const submittedDate = formatDate(
    submission?.submitted_at || null,
  );

  const reviewedDate = formatDate(
    submission?.reviewed_at || null,
  );

  const projectStatus = submission
    ? formatStatus(submission.status)
    : "Not Started";

  return (
    <main className="rn-project-workspace">
      <style>{PAGE_STYLES}</style>

      <div className="container">
        <nav
          className="rn-project-workspace-top"
          aria-label="Project navigation"
        >
          <Link
            href="/student/projects"
            className="rn-learning-back"
          >
            ← Projects &amp; Capstones
          </Link>

          <Link
            href={`/courses/${course.slug}`}
            className="rn-text-link"
          >
            View course →
          </Link>
        </nav>

        <header className="rn-project-hero">
          <span className="rn-eyebrow">
            {formatProjectType(project.project_type)}
          </span>

          <h1>{project.title}</h1>

          <p className="rn-project-hero-course">
            {course.title}
            {course.category ? ` · ${course.category}` : ""}
          </p>

          <div className="rn-project-hero-meta">
            <span>
              {deliverables.length} deliverable
              {deliverables.length === 1 ? "" : "s"}
            </span>

            <span>
              Maximum score: {project.max_score}
            </span>

            <span>Status: {projectStatus}</span>

            <span>
              {canEdit ? "Editing available" : "Editing locked"}
            </span>
          </div>
        </header>

        {submission?.status === "revision_required" && (
          <section
            className="rn-project-revision-banner"
            aria-labelledby="project-revision-heading"
          >
            <div>
              <span className="rn-eyebrow">
                REVISION REQUIRED
              </span>

              <h2 id="project-revision-heading">
                Your project needs revision
              </h2>

              <p>
                Review the assessor feedback below, update your work,
                and resubmit it for another review.
              </p>
            </div>

            {submission.feedback ? (
              <div className="rn-project-revision-feedback">
                <strong>Assessor feedback</strong>

                <p>{submission.feedback}</p>
              </div>
            ) : null}
          </section>
        )}

        <div className="rn-project-workspace-grid">
          <div>
            <section className="rn-project-section">
              <span className="rn-eyebrow">PROJECT BRIEF</span>

              <h2>Your assignment</h2>

              <p>{project.brief}</p>
            </section>

            {project.scenario ? (
              <section className="rn-project-section rn-project-scenario">
                <span className="rn-eyebrow">SCENARIO</span>

                <h2>Real-world context</h2>

                <p>{project.scenario}</p>
              </section>
            ) : null}

            <section className="rn-project-section">
              <span className="rn-eyebrow">REQUIRED DELIVERABLES</span>

              <h2>What you must submit</h2>

              {deliverables.length > 0 ? (
                <div className="rn-project-deliverables">
                  {deliverables.map((deliverable, index) => (
                    <div
                      key={`${project.id}-deliverable-${index}`}
                      className="rn-project-deliverable"
                    >
                      <span>
                        {String(index + 1).padStart(2, "0")}
                      </span>

                      <p>{deliverable}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p>
                  Follow the project brief and submission guidance when
                  preparing your work.
                </p>
              )}
            </section>

            <section className="rn-project-section">
              <span className="rn-eyebrow">EVALUATION</span>

              <h2>How your work will be evaluated</h2>

              {evaluationCriteria.length > 0 ? (
                <div className="rn-project-criteria">
                  {evaluationCriteria.map((criterion, index) => (
                    <div
                      key={`${project.id}-criterion-${index}`}
                    >
                      <span>{index + 1}</span>

                      <p>{criterion}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p>
                  Your submission will be evaluated against the project
                  requirements and course objectives.
                </p>
              )}
            </section>

            {project.submission_instructions ? (
              <section className="rn-project-section">
                <span className="rn-eyebrow">
                  SUBMISSION GUIDANCE
                </span>

                <h2>Before you submit</h2>

                <p>{project.submission_instructions}</p>
              </section>
            ) : null}
          </div>

          <aside
            className="rn-project-submission-column"
            aria-label="Project submission"
          >
            {submission &&
            submission.status !== "draft" &&
            submission.status !== "revision_required" ? (
              <section className="rn-project-status-card">
                <span className="rn-eyebrow">
                  SUBMISSION STATUS
                </span>

                <h2>{formatStatus(submission.status)}</h2>

                {submission.score !== null ? (
                  <div className="rn-project-result-score">
                    <strong>{submission.score}</strong>

                    <span>/ {project.max_score}</span>
                  </div>
                ) : null}

                {submittedDate ? (
                  <small>Submitted {submittedDate}</small>
                ) : null}

                {reviewedDate ? (
                  <small>Reviewed {reviewedDate}</small>
                ) : null}

                {submission.feedback ? (
                  <div className="rn-project-feedback">
                    <strong>Reviewer feedback</strong>

                    <p>{submission.feedback}</p>
                  </div>
                ) : (
                  <p>
                    Your submission is awaiting the next review action.
                    You can return here to check its status.
                  </p>
                )}
              </section>
            ) : null}

            {canEdit ? (
              <ProjectSubmissionForm
                projectId={project.id}
                initialText={submission?.submission_text || ""}
                initialUrl={submission?.submission_url || ""}
                initialStatus={submission?.status || "draft"}
              />
            ) : (
              <section className="rn-project-status-card">
                <span className="rn-eyebrow">
                  SUBMISSION LOCKED
                </span>

                <h2>No changes available</h2>

                <p>
                  Your submission is currently{" "}
                  <strong>{projectStatus}</strong>. Student editing is
                  disabled while the submission is awaiting review or after
                  approval.
                </p>

                {submission?.status === "approved" ? (
                  <Link
                    href="/student/certificates"
                    className="rn-button rn-button-primary"
                  >
                    View Certificates →
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