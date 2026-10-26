import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Enrollment = {
  course_id: string;
  enrollment_status: "active" | "completed" | "cancelled";
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
  status: "draft" | "published" | "archived";
};

const PAGE_STYLES = `
  .rn-student-projects-page {
    --projects-navy: #0b1e3a;
    --projects-blue: #1264a3;
    --projects-cyan: #00b4d8;
    --projects-ink: #24334a;
    --projects-muted: #64748b;
    --projects-border: #e2e8f0;
    padding-top: 28px;
    padding-bottom: 55px;
    color: var(--projects-ink);
  }

  .rn-student-projects-page *,
  .rn-student-projects-page *::before,
  .rn-student-projects-page *::after {
    box-sizing: border-box;
  }

  .rn-student-projects-page a {
    text-decoration: none;
  }

  .rn-student-projects-page .rn-eyebrow {
    display: block;
    margin: 0 0 9px;
    color: #087e9b;
    font-size: 10px;
    font-weight: 850;
    letter-spacing: 1.5px;
    line-height: 1.65;
  }

  .rn-student-projects-page .rn-projects-hero {
    position: relative;
    isolation: isolate;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    min-height: 205px;
    padding: 31px;
    margin-bottom: 22px;
    border: 1px solid #153c60;
    border-radius: 16px;
    background: linear-gradient(125deg, #0b1e3a, #123b61 70%, #07566c);
    color: #fff;
  }

  .rn-student-projects-page .rn-projects-hero::after {
    position: absolute;
    z-index: -1;
    top: -120px;
    right: -55px;
    width: 290px;
    height: 290px;
    border: 1px solid rgba(255,255,255,.15);
    border-radius: 50%;
    box-shadow:
      0 0 0 30px rgba(255,255,255,.035),
      0 0 0 65px rgba(255,255,255,.025);
    content: "";
    pointer-events: none;
  }

  .rn-student-projects-page .rn-projects-hero-content {
    max-width: 660px;
    min-width: 0;
  }

  .rn-student-projects-page .rn-projects-hero .rn-eyebrow {
    color: #67e8f9;
  }

  .rn-student-projects-page .rn-projects-hero h1 {
    margin: 0;
    color: #fff;
    font-size: clamp(30px, 4vw, 39px);
    font-weight: 850;
    letter-spacing: -1px;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .rn-student-projects-page .rn-projects-hero p {
    max-width: 610px;
    margin: 12px 0 0;
    color: #d4e3f2;
    font-size: 13px;
    line-height: 1.9;
  }

  .rn-student-projects-page .rn-projects-hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 9px;
    flex-shrink: 0;
  }

  .rn-student-projects-page .rn-project-button {
    display: inline-flex;
    min-height: 42px;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 10px 15px;
    border: 1px solid #d8e2ee;
    border-radius: 8px;
    background: #fff;
    color: var(--projects-navy);
    font-size: 12px;
    font-weight: 800;
    line-height: 1.5;
    text-align: center;
    cursor: pointer;
    transition:
      border-color .18s ease,
      box-shadow .18s ease,
      transform .18s ease;
  }

  .rn-student-projects-page .rn-project-button:hover {
    transform: translateY(-1px);
    border-color: #a7c8e5;
    box-shadow: 0 4px 13px rgba(11,30,58,.09);
  }

  .rn-student-projects-page .rn-project-button-primary {
    border-color: var(--projects-navy);
    background: var(--projects-navy);
    color: #fff;
  }

  .rn-student-projects-page .rn-project-button-primary:hover {
    border-color: #174b77;
    background: #174b77;
    color: #fff;
  }

  .rn-student-projects-page .rn-project-button-light {
    border-color: rgba(255,255,255,.35);
    background: rgba(255,255,255,.96);
    color: var(--projects-navy);
  }

  .rn-student-projects-page a:focus-visible {
    outline: 3px solid rgba(0,180,216,.4);
    outline-offset: 3px;
  }

  .rn-student-projects-page .rn-project-summary {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 13px;
    margin-bottom: 32px;
  }

  .rn-student-projects-page .rn-project-summary-card {
    position: relative;
    overflow: hidden;
    min-width: 0;
    padding: 19px;
    border: 1px solid var(--projects-border);
    border-radius: 12px;
    background: #fff;
    box-shadow: 0 2px 10px rgba(11,30,58,.025);
  }

  .rn-student-projects-page .rn-project-summary-card::before {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 3px;
    background: #cbd9e8;
    content: "";
  }

  .rn-student-projects-page .rn-project-summary-card:nth-child(1)::before {
    background: var(--projects-navy);
  }

  .rn-student-projects-page .rn-project-summary-card:nth-child(2)::before {
    background: #d99b28;
  }

  .rn-student-projects-page .rn-project-summary-card:nth-child(3)::before {
    background: #159b61;
  }

  .rn-student-projects-page .rn-project-summary-card:nth-child(4)::before {
    background: var(--projects-cyan);
  }

  .rn-student-projects-page .rn-project-summary-label {
    display: block;
    color: var(--projects-muted);
    font-size: 11px;
    font-weight: 750;
    line-height: 1.65;
  }

  .rn-student-projects-page .rn-project-summary-card strong {
    display: block;
    margin-top: 9px;
    color: var(--projects-navy);
    font-size: 32px;
    font-weight: 850;
    letter-spacing: -.8px;
    line-height: 1.2;
  }

  .rn-student-projects-page .rn-project-summary-card small {
    display: block;
    margin-top: 8px;
    color: #8190a3;
    font-size: 10px;
    line-height: 1.65;
  }

  .rn-student-projects-page .rn-project-section-heading {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 18px;
  }

  .rn-student-projects-page .rn-project-section-heading h2 {
    margin: 0;
    color: var(--projects-navy);
    font-size: 25px;
    font-weight: 850;
    letter-spacing: -.65px;
    line-height: 1.4;
  }

  .rn-student-projects-page .rn-project-section-heading p {
    margin: 7px 0 0;
    color: var(--projects-muted);
    font-size: 12px;
    line-height: 1.8;
  }

  .rn-student-projects-page .rn-project-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 31px;
    min-height: 29px;
    padding: 5px 9px;
    border: 1px solid #dbe8f5;
    border-radius: 8px;
    background: #f3f8fd;
    color: #315574;
    font-size: 12px;
    font-weight: 850;
  }

  .rn-student-projects-page .rn-project-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: stretch;
    gap: 17px;
  }

  .rn-student-projects-page .rn-project-card {
    position: relative;
    display: flex;
    min-width: 0;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid var(--projects-border);
    border-radius: 13px;
    background: #fff;
    box-shadow: 0 3px 12px rgba(11,30,58,.025);
    transition:
      border-color .18s ease,
      box-shadow .18s ease,
      transform .18s ease;
  }

  .rn-student-projects-page .rn-project-card:hover {
    transform: translateY(-2px);
    border-color: #c3d8eb;
    box-shadow: 0 8px 22px rgba(11,30,58,.06);
  }

  .rn-student-projects-page .rn-project-card-topline {
    height: 4px;
    background: linear-gradient(90deg, #1264a3, #00b4d8);
  }

  .rn-student-projects-page .rn-project-card[data-project-status="approved"] .rn-project-card-topline {
    background: linear-gradient(90deg, #16834a, #44c582);
  }

  .rn-student-projects-page .rn-project-card[data-project-status="revision_required"] .rn-project-card-topline {
    background: linear-gradient(90deg, #b42318, #e87979);
  }

  .rn-student-projects-page .rn-project-card-body {
    display: flex;
    height: 100%;
    min-width: 0;
    flex-direction: column;
    padding: 21px;
  }

  .rn-student-projects-page .rn-project-card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    min-width: 0;
  }

  .rn-student-projects-page .rn-project-card-title {
    min-width: 0;
  }

  .rn-student-projects-page .rn-project-card-title .rn-eyebrow {
    margin-bottom: 7px;
  }

  .rn-student-projects-page .rn-project-card h2 {
    margin: 0;
    color: var(--projects-navy);
    font-size: 19px;
    font-weight: 850;
    letter-spacing: -.25px;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .rn-student-projects-page .rn-project-status {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    padding: 6px 9px;
    border: 1px solid #dce5ef;
    border-radius: 7px;
    background: #f5f8fc;
    color: #52647a;
    font-size: 10px;
    font-weight: 850;
    line-height: 1.5;
    text-align: center;
  }

  .rn-student-projects-page .rn-project-status.success {
    border-color: #bce8ce;
    background: #effbf3;
    color: #187442;
  }

  .rn-student-projects-page .rn-project-status.error {
    border-color: #f0c5c8;
    background: #fff1f2;
    color: #a32635;
  }

  .rn-student-projects-page .rn-project-status.warning {
    border-color: #f0dfb7;
    background: #fff9e9;
    color: #91610d;
  }

  .rn-student-projects-page .rn-project-status.info {
    border-color: #c9e5f6;
    background: #eff8ff;
    color: #125c91;
  }

  .rn-student-projects-page .rn-project-course {
    margin: 11px 0 0;
    color: #1264a3;
    font-size: 12px;
    font-weight: 800;
    line-height: 1.7;
    overflow-wrap: anywhere;
  }

  .rn-student-projects-page .rn-project-brief {
    margin: 12px 0 17px;
    color: var(--projects-muted);
    font-size: 12px;
    line-height: 1.85;
    overflow-wrap: anywhere;
    white-space: pre-line;
  }

  .rn-student-projects-page .rn-project-deliverables {
    padding: 15px;
    margin-bottom: 17px;
    border: 1px solid #e8edf4;
    border-radius: 10px;
    background: #fafcff;
  }

  .rn-student-projects-page .rn-project-deliverables-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 10px;
  }

  .rn-student-projects-page .rn-project-deliverables-heading strong {
    color: var(--projects-navy);
    font-size: 11px;
    font-weight: 850;
  }

  .rn-student-projects-page .rn-project-deliverables-heading span {
    color: var(--projects-muted);
    font-size: 10px;
    font-weight: 700;
  }

  .rn-student-projects-page .rn-project-deliverables-list {
    display: grid;
    gap: 8px;
    padding: 0;
    margin: 0;
    list-style: none;
  }

  .rn-student-projects-page .rn-project-deliverables-list li {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    color: #52647a;
    font-size: 11px;
    line-height: 1.7;
    overflow-wrap: anywhere;
  }

  .rn-student-projects-page .rn-project-deliverables-list li::before {
    display: inline-flex;
    flex: 0 0 17px;
    align-items: center;
    justify-content: center;
    width: 17px;
    height: 17px;
    margin-top: 1px;
    border-radius: 50%;
    background: #e1f7fb;
    color: #087e9b;
    font-size: 10px;
    font-weight: 900;
    content: "✓";
  }

  .rn-student-projects-page .rn-project-no-deliverables {
    margin: 0;
    color: var(--projects-muted);
    font-size: 11px;
    line-height: 1.7;
  }

  .rn-student-projects-page .rn-project-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
    margin-bottom: 18px;
  }

  .rn-student-projects-page .rn-project-meta span {
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    padding: 6px 8px;
    border: 1px solid #e2eaf3;
    border-radius: 6px;
    background: #f6f9fc;
    color: #52647a;
    font-size: 10px;
    font-weight: 750;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .rn-student-projects-page .rn-project-score {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 13px;
    margin-bottom: 17px;
    border: 1px solid #cbe9d7;
    border-radius: 9px;
    background: #f3fcf6;
  }

  .rn-student-projects-page .rn-project-score span {
    color: #426751;
    font-size: 11px;
    font-weight: 700;
    line-height: 1.6;
  }

  .rn-student-projects-page .rn-project-score strong {
    color: #167647;
    font-size: 16px;
    font-weight: 850;
    white-space: nowrap;
  }

  .rn-student-projects-page .rn-project-card-footer {
    display: flex;
    flex-wrap: wrap;
    gap: 9px;
    margin-top: auto;
    padding-top: 16px;
    border-top: 1px solid #edf1f6;
  }

  .rn-student-projects-page .rn-project-empty {
    padding: 42px 22px;
    border: 1px dashed #cbd7e5;
    border-radius: 13px;
    background: #fff;
    text-align: center;
  }

  .rn-student-projects-page .rn-project-empty-mark {
    display: flex;
    width: 52px;
    height: 52px;
    align-items: center;
    justify-content: center;
    margin: 0 auto 15px;
    border: 1px solid #cdebf2;
    border-radius: 15px;
    background: #effbfe;
    color: #087e9b;
    font-size: 25px;
    font-weight: 800;
  }

  .rn-student-projects-page .rn-project-empty h2 {
    margin: 0;
    color: var(--projects-navy);
    font-size: 22px;
    font-weight: 850;
    line-height: 1.4;
  }

  .rn-student-projects-page .rn-project-empty p {
    max-width: 520px;
    margin: 10px auto 20px;
    color: var(--projects-muted);
    font-size: 13px;
    line-height: 1.85;
  }

  .rn-student-projects-page .rn-project-submission-actions,
  .rn-student-projects-page .rn-projects-footer-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }

  .rn-student-projects-page .rn-project-submission-actions {
    justify-content: center;
  }

  .rn-student-projects-page .rn-projects-footer-actions {
    padding-top: 24px;
    margin-top: 29px;
    border-top: 1px solid var(--projects-border);
  }

  .rn-student-projects-page .rn-projects-footer-actions > span {
    margin-right: auto;
    color: var(--projects-muted);
    font-size: 12px;
    line-height: 1.7;
  }

  @media (max-width: 950px) {
    .rn-student-projects-page .rn-projects-hero {
      align-items: flex-start;
      flex-direction: column;
      padding: 26px;
    }

    .rn-student-projects-page .rn-project-grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @media (max-width: 700px) {
    .rn-student-projects-page {
      padding-top: 17px;
      padding-bottom: 38px;
    }

    .rn-student-projects-page .rn-projects-hero {
      padding: 23px 20px;
      border-radius: 13px;
    }

    .rn-student-projects-page .rn-projects-hero h1 {
      font-size: 30px;
    }

    .rn-student-projects-page .rn-projects-hero-actions {
      width: 100%;
    }

    .rn-student-projects-page .rn-project-summary {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 27px;
    }

    .rn-student-projects-page .rn-project-summary-card {
      padding: 16px;
    }

    .rn-student-projects-page .rn-project-summary-card strong {
      font-size: 29px;
    }

    .rn-student-projects-page .rn-project-section-heading h2 {
      font-size: 23px;
    }

    .rn-student-projects-page .rn-project-card-body {
      padding: 18px;
    }
  }

  @media (max-width: 480px) {
    .rn-student-projects-page .rn-projects-hero {
      padding: 21px 16px;
    }

    .rn-student-projects-page .rn-projects-hero h1 {
      font-size: 27px;
    }

    .rn-student-projects-page .rn-projects-hero p {
      font-size: 12px;
    }

    .rn-student-projects-page .rn-projects-hero-actions {
      flex-direction: column;
      align-items: stretch;
    }

    .rn-student-projects-page .rn-projects-hero-actions .rn-project-button {
      width: 100%;
    }

    .rn-student-projects-page .rn-project-summary-card {
      padding: 15px 12px;
    }

    .rn-student-projects-page .rn-project-summary-card strong {
      font-size: 26px;
    }

    .rn-student-projects-page .rn-project-summary-card small {
      font-size: 10px;
    }

    .rn-student-projects-page .rn-project-section-heading {
      align-items: flex-start;
      flex-direction: column;
      gap: 8px;
    }

    .rn-student-projects-page .rn-project-card-body {
      padding: 16px;
    }

    .rn-student-projects-page .rn-project-card-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .rn-student-projects-page .rn-project-card h2 {
      font-size: 18px;
    }

    .rn-student-projects-page .rn-project-card-footer {
      flex-direction: column;
      align-items: stretch;
    }

    .rn-student-projects-page .rn-project-card-footer .rn-project-button {
      width: 100%;
    }

    .rn-student-projects-page .rn-project-submission-actions,
    .rn-student-projects-page .rn-projects-footer-actions {
      align-items: stretch;
      flex-direction: column;
    }

    .rn-student-projects-page .rn-project-submission-actions .rn-project-button,
    .rn-student-projects-page .rn-projects-footer-actions .rn-project-button {
      width: 100%;
    }

    .rn-student-projects-page .rn-projects-footer-actions > span {
      margin-right: 0;
    }

    .rn-student-projects-page .rn-project-empty {
      padding: 32px 17px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .rn-student-projects-page *,
    .rn-student-projects-page *::before,
    .rn-student-projects-page *::after {
      transition-duration: .01ms !important;
    }
  }
`;

function formatLevel(level: string) {
  if (!level) {
    return "General";
  }

  return level.charAt(0).toUpperCase() + level.slice(1);
}

function formatProjectType(
  projectType: Project["project_type"],
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

function getStatusClass(status: Submission["status"]) {
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

function getDeliverables(
  deliverables: string[] | null | undefined,
): string[] {
  if (!Array.isArray(deliverables)) {
    return [];
  }

  return deliverables.filter(
    (item): item is string =>
      typeof item === "string" && item.trim().length > 0,
  );
}

function getProjectBrief(brief: string | null | undefined) {
  return typeof brief === "string" && brief.trim()
    ? brief.trim()
    : "Review the project instructions and complete the required deliverables.";
}

export default async function StudentProjectsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/student/projects");
  }

  const {
    data: enrollmentData,
    error: enrollmentError,
  } = await supabase
    .from("enrollments")
    .select("course_id, enrollment_status, progress_percent")
    .eq("student_id", user.id)
    .in("enrollment_status", ["active", "completed"]);

  if (enrollmentError) {
    console.error(
      "Failed to load project enrollments:",
      enrollmentError,
    );
  }

  const enrollments = (enrollmentData || []) as Enrollment[];

  const enrolledCourseIds = [
    ...new Set(enrollments.map((item) => item.course_id)),
  ];

  if (enrolledCourseIds.length === 0) {
    return (
      <main className="container rn-student-projects-page">
        <style>{PAGE_STYLES}</style>

        <section className="rn-projects-hero">
          <div className="rn-projects-hero-content">
            <span className="rn-eyebrow">RUFFNECK LEARN · PRACTICAL WORK</span>

            <h1>Projects &amp; Capstones</h1>

            <p>
              Turn your learning into practical work. Complete assignments,
              submit evidence and build demonstrable professional skills
              through your courses.
            </p>
          </div>
        </section>

        <section className="rn-project-empty">
          <div className="rn-project-empty-mark" aria-hidden="true">
            +
          </div>

          <h2>No enrolled courses yet</h2>

          <p>
            Enroll in a course to access its practical projects, case studies
            and capstone assignments.
          </p>

          <Link
            href="/courses"
            className="rn-project-button rn-project-button-primary"
          >
            Browse Courses →
          </Link>
        </section>
      </main>
    );
  }

  const {
    data: courseData,
    error: courseError,
  } = await supabase
    .from("courses")
    .select("id, title, slug, level, category, status")
    .in("id", enrolledCourseIds)
    .eq("status", "published");

  if (courseError) {
    console.error(
      "Failed to load project courses:",
      courseError,
    );
  }

  const courses = (courseData || []) as Course[];

  const publishedCourseIds = [
    ...new Set(courses.map((course) => course.id)),
  ];

  if (publishedCourseIds.length === 0) {
    return (
      <main className="container rn-student-projects-page">
        <style>{PAGE_STYLES}</style>

        <section className="rn-projects-hero">
          <div className="rn-projects-hero-content">
            <span className="rn-eyebrow">RUFFNECK LEARN · PRACTICAL WORK</span>

            <h1>Projects &amp; Capstones</h1>

            <p>
              Access practical assignments from your enrolled courses and
              track the progress of your submissions.
            </p>
          </div>
        </section>

        <section className="rn-project-empty">
          <div className="rn-project-empty-mark" aria-hidden="true">
            ◷
          </div>

          <h2>No published courses available</h2>

          <p>
            Your current enrollments do not have published course content
            available for project work. Check again as your courses become
            available.
          </p>

          <div className="rn-project-submission-actions">
            <Link
              href="/courses"
              className="rn-project-button rn-project-button-primary"
            >
              Browse Courses
            </Link>

            <Link
              href="/student/dashboard"
              className="rn-project-button"
            >
              My Learning
            </Link>
          </div>
        </section>
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
      ].join(", "),
    )
    .in("course_id", publishedCourseIds)
    .eq("is_published", true)
    .order("sort_order");

  if (projectError) {
    console.error(
      "Failed to load student projects:",
      projectError,
    );
  }

  /*
   * Normalize the result because projects may not be fully represented
   * in the generated Supabase database types.
   */
  const projects = (projectData || []) as unknown as Project[];

  const {
    data: submissionData,
    error: submissionError,
  } = await supabase
    .from("project_submissions")
    .select("project_id, status, score")
    .eq("student_id", user.id);

  if (submissionError) {
    console.error(
      "Failed to load project submissions:",
      submissionError,
    );
  }

  const submissions = (submissionData || []) as unknown as Submission[];

  const courseMap = new Map(
    courses.map((course) => [course.id, course]),
  );

  const submissionMap = new Map(
    submissions.map((submission) => [
      submission.project_id,
      submission,
    ]),
  );

  const approvedCount = projects.filter(
    (project) =>
      submissionMap.get(project.id)?.status === "approved",
  ).length;

  const activeCount = projects.filter((project) =>
    ["submitted", "under_review", "revision_required"].includes(
      submissionMap.get(project.id)?.status ?? "",
    ),
  ).length;

  const draftCount = projects.filter(
    (project) =>
      (submissionMap.get(project.id)?.status ?? "draft") === "draft",
  ).length;

  const completionPercentage =
    projects.length > 0
      ? Math.round((approvedCount / projects.length) * 100)
      : 0;

  return (
    <main className="container rn-student-projects-page">
      <style>{PAGE_STYLES}</style>

      <section className="rn-projects-hero">
        <div className="rn-projects-hero-content">
          <span className="rn-eyebrow">
            RUFFNECK LEARN · PRACTICAL DEVELOPMENT
          </span>

          <h1>Projects &amp; Capstones</h1>

          <p>
            Apply what you learn through practical assignments, case studies
            and capstone projects. Track submissions, review feedback and
            build evidence of your skills.
          </p>
        </div>

        <div className="rn-projects-hero-actions">
          <Link
            href="/student/dashboard"
            className="rn-project-button rn-project-button-light"
          >
            ← Dashboard
          </Link>

          <Link
            href="/courses"
            className="rn-project-button rn-project-button-light"
          >
            Browse Courses
          </Link>
        </div>
      </section>

      <section
        className="rn-project-summary"
        aria-label="Project progress summary"
      >
        <article className="rn-project-summary-card">
          <span className="rn-project-summary-label">
            Published projects
          </span>

          <strong>{projects.length}</strong>

          <small>Available from your enrolled courses</small>
        </article>

        <article className="rn-project-summary-card">
          <span className="rn-project-summary-label">
            Active submissions
          </span>

          <strong>{activeCount}</strong>

          <small>Submitted, under review or requiring revision</small>
        </article>

        <article className="rn-project-summary-card">
          <span className="rn-project-summary-label">
            Approved
          </span>

          <strong>{approvedCount}</strong>

          <small>Project submissions approved</small>
        </article>

        <article className="rn-project-summary-card">
          <span className="rn-project-summary-label">
            Approval rate
          </span>

          <strong>{completionPercentage}%</strong>

          <small>
            {projects.length > 0
              ? "Approved projects as a share of all published projects"
              : "No published projects to measure"}
          </small>
        </article>
      </section>

      {projects.length === 0 ? (
        <section className="rn-project-empty">
          <div className="rn-project-empty-mark" aria-hidden="true">
            ◷
          </div>

          <h2>No published projects available</h2>

          <p>
            There are currently no published practical projects for your
            enrolled courses. Your project list will update when coursework
            becomes available.
          </p>

          <div className="rn-project-submission-actions">
            <Link
              href="/courses"
              className="rn-project-button rn-project-button-primary"
            >
              Browse Courses
            </Link>

            <Link
              href="/student/dashboard"
              className="rn-project-button"
            >
              My Learning
            </Link>
          </div>
        </section>
      ) : (
        <>
          <section>
            <div className="rn-project-section-heading">
              <div>
                <span className="rn-eyebrow">YOUR COURSEWORK</span>

                <h2>Available Projects</h2>

                <p>
                  Review the instructions and required deliverables before
                  opening each project.
                </p>
              </div>

              <span className="rn-project-count" aria-label={`${projects.length} projects`}>
                {projects.length}
              </span>
            </div>

            <div className="rn-project-grid">
              {projects.map((project) => {
                const course = courseMap.get(project.course_id);
                const submission = submissionMap.get(project.id);
                const status = submission?.status ?? "draft";
                const deliverables = getDeliverables(project.deliverables);

                return (
                  <article
                    key={project.id}
                    className="rn-project-card"
                    data-project-status={status}
                  >
                    <div className="rn-project-card-topline" />

                    <div className="rn-project-card-body">
                      <div className="rn-project-card-header">
                        <div className="rn-project-card-title">
                          <span className="rn-eyebrow">
                            {formatProjectType(project.project_type)}
                          </span>

                          <h2>{project.title}</h2>
                        </div>

                        <span
                          className={`rn-project-status ${getStatusClass(status)}`}
                        >
                          {formatStatus(status)}
                        </span>
                      </div>

                      {course ? (
                        <p className="rn-project-course">
                          {course.title}
                        </p>
                      ) : null}

                      <p className="rn-project-brief">
                        {getProjectBrief(project.brief)}
                      </p>

                      <div className="rn-project-deliverables">
                        <div className="rn-project-deliverables-heading">
                          <strong>Required deliverables</strong>

                          <span>
                            {deliverables.length} item
                            {deliverables.length === 1 ? "" : "s"}
                          </span>
                        </div>

                        {deliverables.length > 0 ? (
                          <ul className="rn-project-deliverables-list">
                            {deliverables.map((deliverable, index) => (
                              <li key={`${project.id}-deliverable-${index}`}>
                                {deliverable}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="rn-project-no-deliverables">
                            Open the project to review the full instructions
                            and submission requirements.
                          </p>
                        )}
                      </div>

                      <div className="rn-project-meta">
                        {course?.category ? (
                          <span>{course.category}</span>
                        ) : null}

                        {course?.level ? (
                          <span>{formatLevel(course.level)}</span>
                        ) : null}

                        <span>
                          Maximum score: {project.max_score}
                        </span>
                      </div>

                      {submission?.score !== null &&
                      submission?.score !== undefined ? (
                        <div className="rn-project-score">
                          <span>Recorded submission score</span>

                          <strong>
                            {submission.score} / {project.max_score}
                          </strong>
                        </div>
                      ) : null}

                      <div className="rn-project-card-footer">
                        <Link
                          href={`/student/projects/${project.id}`}
                          className="rn-project-button rn-project-button-primary"
                        >
                          {status === "approved"
                            ? "View Approved Project →"
                            : status === "revision_required"
                              ? "Revise Project →"
                              : status === "draft"
                                ? "Open Project →"
                                : "View Submission →"}
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <div className="rn-projects-footer-actions">
            <span>
              {draftCount > 0
                ? `${draftCount} project${draftCount === 1 ? "" : "s"} not yet submitted.`
                : "Review your projects and submission statuses above."}
            </span>

            <Link
              href="/student/assessment"
              className="rn-project-button"
            >
              Course Assessments
            </Link>

            <Link
              href="/student/skills"
              className="rn-project-button"
            >
              My Skills
            </Link>

            <Link
              href="/student/certificates"
              className="rn-project-button"
            >
              My Certificates
            </Link>
          </div>
        </>
      )}
    </main>
  );
}