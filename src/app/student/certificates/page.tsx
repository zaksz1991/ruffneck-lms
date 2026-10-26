import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CertificateIssueButton from "@/components/CertificateIssueButton";
import CertificateVerification from "./CertificateVerification";

type Certificate = {
  id: string;
  certificate_number: string;
  course_id: string;
  course_title: string;
  issued_at: string;
  is_revoked: boolean;
  assessment_score: number | null;
  capstone_score: number | null;
};

type Enrollment = {
  course_id: string;
  enrollment_status: "active" | "completed" | "cancelled";
  payment_status:
    | "pending"
    | "paid"
    | "failed"
    | "refunded"
    | "free"
    | null;
};

type Course = {
  id: string;
  title: string;
  is_free: boolean;
};

type CurriculumItem = {
  course_id: string;
  lesson_id: string;
};

type LessonProgress = {
  course_id: string;
  lesson_id: string;
  completed: boolean;
};

type AssessmentAttempt = {
  id: string;
  course_id: string;
  score: number | null;
  total_points: number | null;
  earned_points: number | null;
  total_questions: number | null;
  completed_at: string | null;
  created_at: string;
};

type CourseProject = {
  id: string;
  course_id: string;
  project_type: string;
  is_published: boolean;
};

type ProjectSubmission = {
  id: string;
  project_id: string;
  student_id: string;
  status: string;
  score: number | null;
};

type CertificateCandidate = {
  course: Course;
  lessonsComplete: boolean;
  assessmentComplete: boolean;
  assessmentPassed: boolean;
  assessmentScore: number | null;
  capstoneAvailable: boolean;
  capstoneApproved: boolean;
  eligible: boolean;
};

const PAGE_STYLES = `
  .rn-certificates-page {
    --cert-navy: #0b1e3a;
    --cert-cyan: #00b4d8;
    --cert-gold: #fbbf24;
    --cert-muted: #64748b;
    --cert-border: #e2e8f0;
    --cert-green: #16834a;
    --cert-red: #b42318;
    padding: 28px 0 60px;
    color: #1d2b40;
  }

  .rn-certificates-page *,
  .rn-certificates-page *::before,
  .rn-certificates-page *::after {
    box-sizing: border-box;
  }

  .rn-certificates-page a {
    text-decoration: none;
  }

  .rn-certificates-page .rn-certificates-header {
    position: relative;
    isolation: isolate;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 220px;
    padding: 34px;
    margin-bottom: 25px;
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 20px;
    background: linear-gradient(125deg, #0b1e3a, #123b61 68%, #07566c);
    color: #fff;
  }

  .rn-certificates-page .rn-certificates-header::after {
    content: "";
    position: absolute;
    z-index: -1;
    top: -110px;
    right: -55px;
    width: 260px;
    height: 260px;
    border: 1px solid rgba(255,255,255,.16);
    border-radius: 50%;
    box-shadow:
      0 0 0 30px rgba(255,255,255,.035),
      0 0 0 65px rgba(255,255,255,.025);
    pointer-events: none;
  }

  .rn-certificates-page .rn-certificates-header > div {
    position: relative;
    z-index: 1;
    max-width: 680px;
  }

  .rn-certificates-page .rn-learning-back {
    display: inline-flex;
    margin-bottom: 22px;
    color: #c7eaf4;
    font-size: 12px;
    font-weight: 750;
    transition: color .18s ease;
  }

  .rn-certificates-page .rn-learning-back:hover {
    color: #fff;
  }

  .rn-certificates-page .rn-eyebrow {
    display: block;
    margin-bottom: 9px;
    color: #0788a5;
    font-size: 10px;
    font-weight: 850;
    letter-spacing: 1.5px;
    line-height: 1.6;
  }

  .rn-certificates-page .rn-certificates-header .rn-eyebrow {
    color: #67e8f9;
  }

  .rn-certificates-page .rn-certificates-header h1 {
    margin: 0;
    color: #fff;
    font-size: clamp(31px, 4vw, 43px);
    font-weight: 850;
    letter-spacing: -1.3px;
    line-height: 1.15;
  }

  .rn-certificates-page .rn-certificates-header p {
    max-width: 570px;
    margin: 13px 0 0;
    color: #d4e3f2;
    font-size: 14px;
    line-height: 1.8;
  }

  .rn-certificates-page .rn-certificate-summary {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
    margin-bottom: 25px;
  }

  .rn-certificates-page .rn-certificate-summary-card {
    min-width: 0;
    padding: 19px 20px;
    border: 1px solid var(--cert-border);
    border-radius: 13px;
    background: #fff;
    box-shadow: 0 3px 12px rgba(11,30,58,.025);
  }

  .rn-certificates-page .rn-certificate-summary-label {
    display: block;
    margin-bottom: 9px;
    color: var(--cert-muted);
    font-size: 11px;
    font-weight: 700;
    line-height: 1.6;
  }

  .rn-certificates-page .rn-certificate-summary-value {
    display: block;
    color: var(--cert-navy);
    font-size: 29px;
    font-weight: 850;
    letter-spacing: -.8px;
    line-height: 1.2;
  }

  .rn-certificates-page .rn-certificate-summary-note {
    display: block;
    margin-top: 8px;
    color: #718096;
    font-size: 11px;
    line-height: 1.6;
  }

  .rn-certificates-page .rn-certificate-claim-section,
  .rn-certificates-page .rn-certificate-progress-section,
  .rn-certificates-page .rn-certificate-list-section {
    padding: 27px;
    margin-bottom: 25px;
    border: 1px solid var(--cert-border);
    border-radius: 17px;
    background: #fff;
    box-shadow: 0 4px 18px rgba(11,30,58,.035);
  }

  .rn-certificates-page .rn-certificate-claim-section {
    border-color: #bcebd0;
    background: linear-gradient(145deg, #f4fff8, #fff 75%);
  }

  .rn-certificates-page .rn-certificates-section-heading {
    margin-bottom: 21px;
  }

  .rn-certificates-page .rn-certificate-claim-section h2,
  .rn-certificates-page .rn-certificates-section-heading h2 {
    margin: 0;
    color: var(--cert-navy);
    font-size: 23px;
    font-weight: 850;
    letter-spacing: -.5px;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }

  .rn-certificates-page .rn-certificate-claim-section > div > p,
  .rn-certificates-page .rn-certificates-section-heading > p {
    max-width: 650px;
    margin: 9px 0 0;
    color: var(--cert-muted);
    font-size: 13px;
    line-height: 1.8;
  }

  .rn-certificates-page .rn-certificate-claim-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 15px;
    margin-top: 22px;
  }

  .rn-certificates-page .rn-certificate-claim-card {
    display: flex;
    min-width: 0;
    flex-direction: column;
    align-items: flex-start;
    padding: 21px;
    border: 1px solid #d9eee1;
    border-radius: 13px;
    background: rgba(255,255,255,.92);
  }

  .rn-certificates-page .rn-certificate-claim-card > span {
    display: inline-flex;
    padding: 6px 9px;
    border-radius: 6px;
    background: #e8f9ee;
    color: #177342;
    font-size: 9px;
    font-weight: 850;
    letter-spacing: .5px;
    line-height: 1.5;
  }

  .rn-certificates-page .rn-certificate-claim-card h3 {
    margin: 15px 0 8px;
    color: var(--cert-navy);
    font-size: 18px;
    font-weight: 850;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .rn-certificates-page .rn-certificate-claim-card p {
    margin: 0 0 17px;
    color: var(--cert-muted);
    font-size: 12px;
    line-height: 1.8;
  }

  .rn-certificates-page .rn-certificate-progress-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 15px;
  }

  .rn-certificates-page .rn-certificate-progress-card {
    min-width: 0;
    padding: 20px;
    border: 1px solid var(--cert-border);
    border-radius: 13px;
    background: #fff;
  }

  .rn-certificates-page .rn-certificate-progress-card h3 {
    margin: 0 0 8px;
    color: var(--cert-navy);
    font-size: 17px;
    font-weight: 800;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .rn-certificates-page .rn-certificate-progress-card > p {
    margin: 0 0 16px;
    color: var(--cert-muted);
    font-size: 12px;
    line-height: 1.7;
  }

  .rn-certificates-page .rn-cert-requirement-list {
    display: grid;
    gap: 9px;
    padding: 0;
    margin: 0;
    list-style: none;
  }

  .rn-certificates-page .rn-cert-requirement {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 11px 12px;
    border: 1px solid #e8edf4;
    border-radius: 9px;
    background: #f9fbfe;
  }

  .rn-certificates-page .rn-cert-requirement-mark {
    display: inline-flex;
    width: 23px;
    height: 23px;
    flex: 0 0 23px;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: #e8edf4;
    color: #52627a;
    font-size: 12px;
    font-weight: 900;
  }

  .rn-certificates-page .rn-cert-requirement.is-complete {
    border-color: #d4efdf;
    background: #f4fcf7;
  }

  .rn-certificates-page .rn-cert-requirement.is-complete .rn-cert-requirement-mark {
    background: #d9f6e5;
    color: var(--cert-green);
  }

  .rn-certificates-page .rn-cert-requirement-copy {
    min-width: 0;
  }

  .rn-certificates-page .rn-cert-requirement-copy strong {
    display: block;
    color: #26384f;
    font-size: 12px;
    font-weight: 800;
    line-height: 1.5;
  }

  .rn-certificates-page .rn-cert-requirement-copy small {
    display: block;
    margin-top: 3px;
    color: var(--cert-muted);
    font-size: 11px;
    line-height: 1.6;
  }

  .rn-certificates-page .rn-certificate-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px;
  }

  .rn-certificates-page .rn-certificate-card {
    position: relative;
    display: flex;
    min-width: 0;
    flex-direction: column;
    overflow: hidden;
    padding: 23px;
    border: 1px solid var(--cert-border);
    border-radius: 15px;
    background: #fff;
    transition:
      border-color .18s ease,
      box-shadow .18s ease,
      transform .18s ease;
  }

  .rn-certificates-page .rn-certificate-card::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 4px;
    background: linear-gradient(90deg, #00b4d8, #67e8f9, #fbbf24);
  }

  .rn-certificates-page .rn-certificate-card:hover {
    transform: translateY(-2px);
    border-color: #b4e8f0;
    box-shadow: 0 10px 26px rgba(11,30,58,.07);
  }

  .rn-certificates-page .rn-certificate-card h3 {
    margin: 9px 0;
    color: var(--cert-navy);
    font-size: 20px;
    font-weight: 850;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .rn-certificates-page .rn-certificate-number {
    margin: 0 0 17px;
    color: #718096;
    font-size: 11px;
    font-weight: 750;
    letter-spacing: .25px;
    overflow-wrap: anywhere;
  }

  .rn-certificates-page .rn-certificate-card-meta {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 9px;
    margin-bottom: 18px;
  }

  .rn-certificates-page .rn-certificate-card-meta span {
    display: block;
    min-width: 0;
    padding: 11px;
    border: 1px solid #edf1f6;
    border-radius: 9px;
    background: #f9fbfe;
    color: #52627a;
    font-size: 11px;
    line-height: 1.65;
    overflow-wrap: anywhere;
  }

  .rn-certificates-page .rn-certificate-card-meta span:first-child {
    grid-column: 1 / -1;
  }

  .rn-certificates-page .rn-certificate-status {
    display: inline-flex;
    align-self: flex-start;
    padding: 7px 10px;
    margin-bottom: 14px;
    border: 1px solid #c5ead4;
    border-radius: 7px;
    background: #effbf3;
    color: #177342;
    font-size: 11px;
    font-weight: 850;
    line-height: 1.5;
  }

  .rn-certificates-page .rn-certificate-status.is-revoked {
    border-color: #f0c6c6;
    background: #fff1f1;
    color: #a22b2b;
  }

  .rn-certificates-page .rn-certificate-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 9px;
    margin-top: auto;
  }

  .rn-certificates-page .rn-button {
    display: inline-flex;
    min-height: 42px;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 15px;
    border: 1px solid #dbe4ef;
    border-radius: 9px;
    background: #fff;
    color: #20334d;
    font-size: 12px;
    font-weight: 800;
    line-height: 1.5;
    text-align: center;
    cursor: pointer;
    transition:
      transform .18s ease,
      box-shadow .18s ease;
  }

  .rn-certificates-page .rn-button:hover {
    transform: translateY(-1px);
    box-shadow: 0 5px 15px rgba(11,30,58,.1);
  }

  .rn-certificates-page .rn-button:focus-visible {
    outline: 3px solid rgba(0,180,216,.35);
    outline-offset: 3px;
  }

  .rn-certificates-page .rn-button-primary {
    border-color: #00b4d8;
    background: #00b4d8;
    color: #08243a;
  }

  .rn-certificates-page .rn-project-empty {
    padding: 42px 22px;
    border: 1px dashed #cad6e5;
    border-radius: 14px;
    background: #fafcff;
    text-align: center;
  }

  .rn-certificates-page .rn-project-empty h2 {
    margin: 0;
    color: var(--cert-navy);
    font-size: 21px;
    font-weight: 850;
  }

  .rn-certificates-page .rn-project-empty p {
    max-width: 520px;
    margin: 11px auto 20px;
    color: var(--cert-muted);
    font-size: 13px;
    line-height: 1.85;
  }

  .rn-certificates-page .rn-certificates-footer-note {
    margin: 14px 0 0;
    color: var(--cert-muted);
    font-size: 11px;
    line-height: 1.7;
  }

  @media (max-width: 760px) {
    .rn-certificates-page .rn-certificates-header {
      min-height: auto;
      padding: 27px 22px;
      border-radius: 16px;
    }

    .rn-certificates-page .rn-certificate-claim-section,
    .rn-certificates-page .rn-certificate-progress-section,
    .rn-certificates-page .rn-certificate-list-section {
      padding: 21px 16px;
    }

    .rn-certificates-page .rn-certificate-grid,
    .rn-certificates-page .rn-certificate-claim-grid,
    .rn-certificates-page .rn-certificate-progress-grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .rn-certificates-page .rn-certificate-summary {
      gap: 9px;
    }

    .rn-certificates-page .rn-certificate-summary-card {
      padding: 15px 12px;
    }

    .rn-certificates-page .rn-certificate-summary-value {
      font-size: 25px;
    }
  }

  @media (max-width: 480px) {
    .rn-certificates-page {
      padding-top: 15px;
    }

    .rn-certificates-page .rn-certificates-header h1 {
      font-size: 31px;
    }

    .rn-certificates-page .rn-certificate-summary {
      grid-template-columns: minmax(0, 1fr);
    }

    .rn-certificates-page .rn-certificate-summary-card {
      padding: 14px 16px;
    }

    .rn-certificates-page .rn-certificate-summary-value {
      font-size: 24px;
    }

    .rn-certificates-page .rn-certificate-card {
      padding: 19px 15px;
    }

    .rn-certificates-page .rn-certificate-card-meta {
      grid-template-columns: minmax(0, 1fr);
    }

    .rn-certificates-page .rn-certificate-card-meta span:first-child {
      grid-column: auto;
    }

    .rn-certificates-page .rn-certificate-actions {
      flex-direction: column;
      align-items: stretch;
    }

    .rn-certificates-page .rn-certificate-actions .rn-button {
      width: 100%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .rn-certificates-page *,
    .rn-certificates-page *::before,
    .rn-certificates-page *::after {
      scroll-behavior: auto !important;
      transition-duration: .01ms !important;
      animation-duration: .01ms !important;
    }
  }
`;

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "long",
  }).format(date);
}

function clampPercentage(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

/**
 * The assessment API stores `score` as a percentage.
 * When point totals exist, calculate from the recorded points.
 * Otherwise, use the stored percentage directly; do not divide it
 * by the question count, which can incorrectly produce values over 100%.
 */
function assessmentPercentage(attempt: AssessmentAttempt | null) {
  if (!attempt) {
    return null;
  }

  if (
    attempt.total_points !== null &&
    attempt.total_points > 0 &&
    attempt.earned_points !== null
  ) {
    return clampPercentage(
      (attempt.earned_points / attempt.total_points) * 100,
    );
  }

  if (attempt.score !== null && Number.isFinite(attempt.score)) {
    return clampPercentage(attempt.score);
  }

  return null;
}

function Requirement({
  complete,
  title,
  detail,
}: {
  complete: boolean;
  title: string;
  detail: string;
}) {
  return (
    <li
      className={`rn-cert-requirement${complete ? " is-complete" : ""}`}
    >
      <span className="rn-cert-requirement-mark" aria-hidden="true">
        {complete ? "✓" : "•"}
      </span>

      <span className="rn-cert-requirement-copy">
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
    </li>
  );
}

export default async function StudentCertificatesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/student/certificates");
  }

  const {
    data: certificateData,
    error: certificateError,
  } = await supabase
    .from("course_certificates")
    .select(
      [
        "id",
        "certificate_number",
        "course_id",
        "course_title",
        "issued_at",
        "is_revoked",
        "assessment_score",
        "capstone_score",
      ].join(", "),
    )
    .eq("student_id", user.id)
    .order("issued_at", { ascending: false });

  if (certificateError) {
    console.error(
      "Student certificates lookup failed:",
      certificateError,
    );
  }

  const certificates =
    (certificateData ?? []) as unknown as Certificate[];

  const {
    data: enrollmentData,
    error: enrollmentError,
  } = await supabase
    .from("enrollments")
    .select("course_id, enrollment_status, payment_status")
    .eq("student_id", user.id)
    .eq("enrollment_status", "completed");

  if (enrollmentError) {
    console.error(
      "Completed enrollment lookup failed:",
      enrollmentError,
    );
  }

  const completedEnrollments =
    (enrollmentData ?? []) as unknown as Enrollment[];

  const certificateCourseIds = new Set(
    certificates.map((item) => item.course_id),
  );

  const eligibleEnrollmentCourseIds = [
    ...new Set(
      completedEnrollments
        .filter(
          (enrollment) =>
            enrollment.payment_status === "paid" ||
            enrollment.payment_status === "free",
        )
        .map((enrollment) => enrollment.course_id),
    ),
  ];

  const uncategorizedCourseIds =
    eligibleEnrollmentCourseIds.filter(
      (courseId) => !certificateCourseIds.has(courseId),
    );

  const { data: courseData, error: courseError } =
    uncategorizedCourseIds.length > 0
      ? await supabase
          .from("courses")
          .select("id, title, is_free")
          .eq("status", "published")
          .in("id", uncategorizedCourseIds)
      : { data: [], error: null };

  if (courseError) {
    console.error(
      "Certificate candidate course lookup failed:",
      courseError,
    );
  }

  const courses = (courseData ?? []) as unknown as Course[];

  const validCertificateCourses = courses.filter((course) => {
    const enrollment = completedEnrollments.find(
      (item) => item.course_id === course.id,
    );

    if (!enrollment) {
      return false;
    }

    if (course.is_free) {
      return enrollment.payment_status === "free";
    }

    return enrollment.payment_status === "paid";
  });

  const candidateCourseIds = validCertificateCourses.map(
    (course) => course.id,
  );

  let curriculum: CurriculumItem[] = [];
  let lessonProgress: LessonProgress[] = [];
  let assessmentAttempts: AssessmentAttempt[] = [];
  let projects: CourseProject[] = [];
  let submissions: ProjectSubmission[] = [];

  if (candidateCourseIds.length > 0) {
    const [
      curriculumResult,
      lessonProgressResult,
      assessmentResult,
      projectResult,
    ] = await Promise.all([
      supabase
        .from("course_curriculum")
        .select("course_id, lesson_id")
        .in("course_id", candidateCourseIds)
        .eq("is_published", true),

      supabase
        .from("lesson_progress")
        .select("course_id, lesson_id, completed")
        .eq("student_id", user.id)
        .in("course_id", candidateCourseIds),

      supabase
        .from("assessment_attempts")
        .select(
          [
            "id",
            "course_id",
            "score",
            "total_points",
            "earned_points",
            "total_questions",
            "completed_at",
            "created_at",
          ].join(", "),
        )
        .eq("student_id", user.id)
        .in("course_id", candidateCourseIds)
        .not("completed_at", "is", null)
        .order("created_at", { ascending: false }),

      supabase
        .from("course_projects")
        .select("id, course_id, project_type, is_published")
        .in("course_id", candidateCourseIds)
        .eq("project_type", "capstone")
        .eq("is_published", true),
    ]);

    if (curriculumResult.error) {
      console.error(
        "Certificate curriculum lookup failed:",
        curriculumResult.error,
      );
    }

    if (lessonProgressResult.error) {
      console.error(
        "Certificate lesson progress lookup failed:",
        lessonProgressResult.error,
      );
    }

    if (assessmentResult.error) {
      console.error(
        "Certificate assessment lookup failed:",
        assessmentResult.error,
      );
    }

    if (projectResult.error) {
      console.error(
        "Certificate capstone lookup failed:",
        projectResult.error,
      );
    }

    curriculum =
      (curriculumResult.data ?? []) as unknown as CurriculumItem[];

    lessonProgress =
      (lessonProgressResult.data ?? []) as unknown as LessonProgress[];

    assessmentAttempts =
      (assessmentResult.data ?? []) as unknown as AssessmentAttempt[];

    projects = (projectResult.data ?? []) as unknown as CourseProject[];

    const capstoneProjectIds = projects.map((project) => project.id);

    if (capstoneProjectIds.length > 0) {
      const {
        data: submissionData,
        error: submissionError,
      } = await supabase
        .from("project_submissions")
        .select("id, project_id, student_id, status, score")
        .eq("student_id", user.id)
        .in("project_id", capstoneProjectIds);

      if (submissionError) {
        console.error(
          "Certificate capstone submission lookup failed:",
          submissionError,
        );
      }

      submissions =
        (submissionData ?? []) as unknown as ProjectSubmission[];
    }
  }

  const certificateCandidates: CertificateCandidate[] =
    validCertificateCourses.map((course) => {
      const courseCurriculum = curriculum.filter(
        (item) => item.course_id === course.id,
      );

      const completedLessonIds = new Set(
        lessonProgress
          .filter(
            (item) =>
              item.course_id === course.id && item.completed,
          )
          .map((item) => item.lesson_id),
      );

      const lessonsComplete =
        courseCurriculum.length > 0 &&
        courseCurriculum.every((item) =>
          completedLessonIds.has(item.lesson_id),
        );

      const latestAssessment =
        assessmentAttempts.find(
          (attempt) => attempt.course_id === course.id,
        ) ?? null;

      const assessmentScore =
        assessmentPercentage(latestAssessment);

      const assessmentComplete = latestAssessment !== null;

      const assessmentPassed =
        assessmentScore !== null && assessmentScore >= 70;

      const courseProjects = projects.filter(
        (project) => project.course_id === course.id,
      );

      const capstoneAvailable = courseProjects.length > 0;

      const capstoneProjectIds = new Set(
        courseProjects.map((project) => project.id),
      );

      const capstoneApproved = submissions.some(
        (submission) =>
          capstoneProjectIds.has(submission.project_id) &&
          submission.status === "approved",
      );

      const eligible =
        lessonsComplete &&
        assessmentComplete &&
        assessmentPassed &&
        capstoneAvailable &&
        capstoneApproved;

      return {
        course,
        lessonsComplete,
        assessmentComplete,
        assessmentPassed,
        assessmentScore,
        capstoneAvailable,
        capstoneApproved,
        eligible,
      };
    });

  const eligibleCandidates = certificateCandidates.filter(
    (candidate) => candidate.eligible,
  );

  const ineligibleCandidates = certificateCandidates.filter(
    (candidate) => !candidate.eligible,
  );

  const activeCertificates = certificates.filter(
    (certificate) => !certificate.is_revoked,
  );

  const revokedCertificates = certificates.filter(
    (certificate) => certificate.is_revoked,
  );

  return (
    <main className="rn-certificates-page">
      <style>{PAGE_STYLES}</style>

      <div className="container">
        <header className="rn-certificates-header">
          <div>
            <Link
              href="/student/dashboard"
              className="rn-learning-back"
            >
              ← Dashboard
            </Link>

            <span className="rn-eyebrow">
              RUFFNECK ENTERTAINMENT · LEARNING
            </span>

            <h1>My Certificates</h1>

            <p>
              View your course credentials, check certificate eligibility,
              and access certificate verification details.
            </p>
          </div>
        </header>

        <section
          className="rn-certificate-summary"
          aria-label="Certificate summary"
        >
          <article className="rn-certificate-summary-card">
            <span className="rn-certificate-summary-label">
              Active certificates
            </span>

            <strong className="rn-certificate-summary-value">
              {activeCertificates.length}
            </strong>

            <span className="rn-certificate-summary-note">
              Issued credentials that have not been revoked.
            </span>
          </article>

          <article className="rn-certificate-summary-card">
            <span className="rn-certificate-summary-label">
              Ready to claim
            </span>

            <strong className="rn-certificate-summary-value">
              {eligibleCandidates.length}
            </strong>

            <span className="rn-certificate-summary-note">
              Completed course requirements awaiting certificate issue.
            </span>
          </article>

          <article className="rn-certificate-summary-card">
            <span className="rn-certificate-summary-label">
              Revoked certificates
            </span>

            <strong className="rn-certificate-summary-value">
              {revokedCertificates.length}
            </strong>

            <span className="rn-certificate-summary-note">
              Credentials marked as revoked in the certificate record.
            </span>
          </article>
        </section>

        {eligibleCandidates.length > 0 && (
          <section
            className="rn-certificate-claim-section"
            aria-labelledby="rn-certificates-ready-heading"
          >
            <div>
              <span className="rn-eyebrow">
                CERTIFICATE ELIGIBILITY
              </span>

              <h2 id="rn-certificates-ready-heading">
                Certificates ready to claim
              </h2>

              <p>
                These courses meet the lesson, assessment and approved
                capstone requirements.
              </p>
            </div>

            <div className="rn-certificate-claim-grid">
              {eligibleCandidates.map((candidate) => (
                <article
                  key={candidate.course.id}
                  className="rn-certificate-claim-card"
                >
                  <span>ELIGIBLE FOR CERTIFICATE</span>

                  <h3>{candidate.course.title}</h3>

                  <p>
                    Published lessons completed, assessment passed with
                    a score of at least 70%, and capstone approved.
                  </p>

                  <CertificateIssueButton
                    courseId={candidate.course.id}
                  />
                </article>
              ))}
            </div>
          </section>
        )}

        {ineligibleCandidates.length > 0 && (
          <section
            className="rn-certificate-progress-section"
            aria-labelledby="rn-certificate-progress-heading"
          >
            <div className="rn-certificates-section-heading">
              <span className="rn-eyebrow">YOUR NEXT STEPS</span>

              <h2 id="rn-certificate-progress-heading">
                Certificate progress
              </h2>

              <p>
                Review each course to see which requirements are complete
                and which still need attention.
              </p>
            </div>

            <div className="rn-certificate-progress-grid">
              {ineligibleCandidates.map((candidate) => (
                <article
                  key={candidate.course.id}
                  className="rn-certificate-progress-card"
                >
                  <h3>{candidate.course.title}</h3>

                  <p>
                    Finish the remaining requirements to become eligible
                    for this course certificate.
                  </p>

                  <ul className="rn-cert-requirement-list">
                    <Requirement
                      complete={candidate.lessonsComplete}
                      title="Published lessons"
                      detail={
                        candidate.lessonsComplete
                          ? "All published curriculum lessons are marked complete."
                          : "Complete all published lessons in this course."
                      }
                    />

                    <Requirement
                      complete={candidate.assessmentComplete}
                      title="Assessment completed"
                      detail={
                        candidate.assessmentComplete
                          ? "A completed assessment attempt was found."
                          : "Complete the course assessment."
                      }
                    />

                    <Requirement
                      complete={candidate.assessmentPassed}
                      title="Assessment score of at least 70%"
                      detail={
                        candidate.assessmentScore !== null
                          ? `Latest assessment score: ${candidate.assessmentScore}%.`
                          : "A recorded assessment score is required."
                      }
                    />

                    <Requirement
                      complete={candidate.capstoneAvailable}
                      title="Published capstone"
                      detail={
                        candidate.capstoneAvailable
                          ? "A published capstone project is available."
                          : "The course must have a published capstone project."
                      }
                    />

                    <Requirement
                      complete={candidate.capstoneApproved}
                      title="Capstone approval"
                      detail={
                        candidate.capstoneApproved
                          ? "An approved capstone submission was found."
                          : "Submit the capstone and receive approval."
                      }
                    />
                  </ul>

                  <p style={{ marginTop: 15, marginBottom: 0 }}>
                    <Link
                      href={`/student/courses/${candidate.course.id}`}
                      className="rn-button"
                    >
                      Continue Course →
                    </Link>
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}

        <section
          className="rn-certificate-list-section"
          aria-labelledby="rn-issued-certificates-heading"
        >
          <div className="rn-certificates-section-heading">
            <span className="rn-eyebrow">YOUR CREDENTIALS</span>

            <h2 id="rn-issued-certificates-heading">
              Issued certificates
            </h2>

            <p>
              Access your issued credentials and their verification
              details.
            </p>
          </div>

          {certificates.length === 0 ? (
            <article className="rn-project-empty">
              <h2>No certificates issued yet</h2>

              <p>
                When a certificate is issued for one of your completed
                courses, it will appear here. You can also review your
                certificate progress above.
              </p>

              <Link
                href="/courses"
                className="rn-button rn-button-primary"
              >
                Explore Courses →
              </Link>
            </article>
          ) : (
            <div className="rn-certificate-grid">
              {certificates.map((certificate) => (
                <article
                  key={certificate.id}
                  className="rn-certificate-card"
                >
                  <span className="rn-eyebrow">
                    CERTIFICATE OF COMPLETION
                  </span>

                  <h3>{certificate.course_title}</h3>

                  <p className="rn-certificate-number">
                    Certificate number: {certificate.certificate_number}
                  </p>

                  <div className="rn-certificate-card-meta">
                    <span>
                      Issued: {formatDate(certificate.issued_at)}
                    </span>

                    <span>
                      Assessment:{" "}
                      {certificate.assessment_score === null
                        ? "—"
                        : `${clampPercentage(
                            certificate.assessment_score,
                          )}%`}
                    </span>

                    <span>
                      Capstone:{" "}
                      {certificate.capstone_score === null
                        ? "—"
                        : `${certificate.capstone_score}/100`}
                    </span>
                  </div>

                  {certificate.is_revoked ? (
                    <>
                      <div className="rn-certificate-status is-revoked">
                        Revoked
                      </div>

                      <div className="rn-certificate-actions">
                        <CertificateVerification
                          certificateId={certificate.id}
                          certificateNumber={
                            certificate.certificate_number
                          }
                          isRevoked
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="rn-certificate-status">
                        ✓ Active certificate
                      </div>

                      <div className="rn-certificate-actions">
                        <Link
                          href={`/student/certificates/${certificate.id}`}
                          className="rn-button rn-button-primary"
                        >
                          View Certificate →
                        </Link>
                      </div>

                      <div style={{ marginTop: 12 }}>
                        <CertificateVerification
                          certificateId={certificate.id}
                          certificateNumber={
                            certificate.certificate_number
                          }
                        />
                      </div>
                    </>
                  )}
                </article>
              ))}
            </div>
          )}

          <p className="rn-certificates-footer-note">
            Certificate eligibility is based on the recorded course
            completion, assessment result, published capstone and
            capstone approval status.
          </p>
        </section>
      </div>
    </main>
  );
}