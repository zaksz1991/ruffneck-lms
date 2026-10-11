import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CertificateIssueButton from "@/components/CertificateIssueButton";

type Enrollment = {
  id: string;
  course_id: string;
  enrollment_status: string;
  payment_status: string | null;
  progress_percent: number | null;
};

type Course = {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  level: string | null;
  duration_minutes: number | null;
};

type CurriculumLesson = {
  lesson_id: string;
  course_id: string;
  section_id: string | null;
  section_title: string | null;
  section_sort: number | null;
  lesson_title: string;
  lesson_slug: string;
  lesson_sort: number | null;
  duration_minutes: number | null;
  duration_seconds: number | null;
  is_preview: boolean;
  is_published: boolean;
};

type LessonProgress = {
  student_id: string;
  lesson_id: string;
  course_id: string;
  completed: boolean;
};

type AssessmentAttempt = {
  id: string;
  course_id: string;
  score: number | null;
  total_points: number | null;
  earned_points: number | null;
  total_questions: number | null;
  time_spent_seconds: number | null;
  completed_at: string | null;
};

type CourseAssessment = {
  status: "not_started" | "completed";
  attempt_id: string | null;
  score: number | null;
  total_questions: number | null;
  completed_at: string | null;
  percentage: number | null;
};

type Certificate = {
  id: string;
  student_id: string;
  course_id: string;
  certificate_number: string;
  is_revoked: boolean;
};

type CourseCertificate = {
  status: "not_issued" | "valid" | "revoked";
  certificate_id: string | null;
  certificate_number: string | null;
};

type CourseProject = {
  id: string;
  course_id: string;
  project_type: string | null;
  is_published: boolean;
};

type ProjectSubmission = {
  id: string;
  project_id: string;
  student_id: string;
  status: string;
  score: number | null;
};

type CourseCapstone = {
  has_capstone: boolean;
  approved_submission: boolean;
};

type CertificateEligibility = {
  eligible: boolean;
  lessons_complete: boolean;
  assessment_complete: boolean;
  assessment_passed: boolean;
  capstone_available: boolean;
  capstone_approved: boolean;
};

const DASHBOARD_STYLES = `
  .rn-student-courses {
    --rnc-navy: #0b1e3a;
    --rnc-cyan: #00b4d8;
    --rnc-gold: #fbbf24;
    --rnc-muted: #68778d;
    --rnc-border: #e4eaf2;
    color: #17243a;
    padding-bottom: 48px;
  }

  .rn-student-courses *,
  .rn-student-courses *::before,
  .rn-student-courses *::after {
    box-sizing: border-box;
  }

  .rn-student-courses a {
    text-decoration: none;
  }

  .rn-student-courses .rnc-hero {
    position: relative;
    overflow: hidden;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 24px;
    padding: 36px;
    margin-bottom: 24px;
    color: white;
    background: linear-gradient(125deg, #0b1e3a, #123a60 70%, #075b75);
    border-radius: 22px;
  }

  .rn-student-courses .rnc-hero::after {
    content: "";
    position: absolute;
    width: 250px;
    height: 250px;
    top: -130px;
    right: -60px;
    border: 1px solid rgba(255,255,255,.15);
    border-radius: 50%;
    box-shadow:
      0 0 0 30px rgba(255,255,255,.035),
      0 0 0 65px rgba(255,255,255,.025);
    pointer-events: none;
  }

  .rn-student-courses .rnc-hero-copy,
  .rn-student-courses .rnc-hero-actions {
    position: relative;
    z-index: 1;
  }

  .rn-student-courses .rnc-eyebrow {
    display: block;
    margin: 0 0 10px;
    color: #0086a6;
    font-size: 11px;
    font-weight: 850;
    letter-spacing: 1.8px;
    text-transform: uppercase;
  }

  .rn-student-courses .rnc-hero .rnc-eyebrow {
    color: #67e8f9;
  }

  .rn-student-courses .rnc-hero h1 {
    margin: 0;
    color: #fff;
    font-size: clamp(30px, 4vw, 42px);
    font-weight: 850;
    letter-spacing: -1.2px;
    line-height: 1.15;
  }

  .rn-student-courses .rnc-hero p {
    max-width: 590px;
    margin: 13px 0 0;
    color: #d5e5f5;
    font-size: 14px;
    line-height: 1.8;
  }

  .rn-student-courses .rnc-hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    flex-shrink: 0;
  }

  .rn-student-courses .rnc-button {
    display: inline-flex;
    min-height: 42px;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 15px;
    border: 1px solid #dbe4ef;
    border-radius: 9px;
    background: white;
    color: #0b1e3a;
    font-size: 12px;
    font-weight: 800;
    line-height: 1.4;
    text-align: center;
    cursor: pointer;
    transition: transform .18s ease, box-shadow .18s ease;
  }

  .rn-student-courses .rnc-button:hover {
    transform: translateY(-1px);
    box-shadow: 0 5px 16px rgba(11,30,58,.1);
  }

  .rn-student-courses .rnc-button-primary {
    border-color: #00b4d8;
    background: #00b4d8;
    color: #06223b;
  }

  .rn-student-courses .rnc-button-secondary {
    border-color: #dbe4ef;
    background: #fff;
    color: #23364e;
  }

  .rn-student-courses .rnc-hero .rnc-button-secondary {
    border-color: rgba(255,255,255,.3);
    background: rgba(255,255,255,.1);
    color: #fff;
  }

  .rn-student-courses .rnc-stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 15px;
    margin-bottom: 28px;
  }

  .rn-student-courses .rnc-stat {
    padding: 21px;
    border: 1px solid var(--rnc-border);
    border-radius: 15px;
    background: #fff;
    box-shadow: 0 4px 16px rgba(11,30,58,.035);
  }

  .rn-student-courses .rnc-stat-label {
    display: block;
    color: var(--rnc-muted);
    font-size: 12px;
    font-weight: 700;
  }

  .rn-student-courses .rnc-stat-value {
    display: block;
    margin-top: 12px;
    color: var(--rnc-navy);
    font-size: 33px;
    font-weight: 850;
    letter-spacing: -1px;
    line-height: 1;
  }

  .rn-student-courses .rnc-stat-note {
    display: block;
    margin-top: 9px;
    color: #8792a3;
    font-size: 11px;
    line-height: 1.5;
  }

  .rn-student-courses .rnc-section {
    padding: 26px;
    margin-top: 25px;
    border: 1px solid var(--rnc-border);
    border-radius: 19px;
    background: #fff;
    box-shadow: 0 4px 18px rgba(11,30,58,.03);
  }

  .rn-student-courses .rnc-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 22px;
  }

  .rn-student-courses .rnc-section-header h2 {
    margin: 0;
    color: var(--rnc-navy);
    font-size: 21px;
    font-weight: 850;
    letter-spacing: -.4px;
  }

  .rn-student-courses .rnc-section-header p {
    margin: 7px 0 0;
    color: var(--rnc-muted);
    font-size: 13px;
    line-height: 1.7;
  }

  .rn-student-courses .rnc-text-link {
    color: #087c99;
    font-size: 12px;
    font-weight: 800;
  }

  .rn-student-courses .rnc-text-link:hover {
    text-decoration: underline;
  }

  .rn-student-courses .rnc-course-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px;
  }

  .rn-student-courses .rnc-course {
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
    border: 1px solid #e3eaf2;
    border-radius: 16px;
    background: #fff;
    transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease;
  }

  .rn-student-courses .rnc-course:hover {
    transform: translateY(-2px);
    border-color: #a4e8f4;
    box-shadow: 0 10px 25px rgba(11,30,58,.065);
  }

  .rn-student-courses .rnc-course-accent {
    height: 4px;
    background: linear-gradient(90deg, #00b4d8, #67e8f9, #fbbf24);
  }

  .rn-student-courses .rnc-course-body {
    flex: 1;
    padding: 21px;
  }

  .rn-student-courses .rnc-course-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
    align-items: center;
  }

  .rn-student-courses .rnc-chip {
    display: inline-flex;
    align-items: center;
    padding: 6px 9px;
    border: 1px solid #e5ebf3;
    border-radius: 7px;
    background: #f8fafd;
    color: #52627a;
    font-size: 10px;
    font-weight: 800;
    text-transform: capitalize;
  }

  .rn-student-courses .rnc-chip-active {
    border-color: #bcebd0;
    background: #edfbf2;
    color: #177343;
  }

  .rn-student-courses .rnc-chip-completed {
    border-color: #c8d9ff;
    background: #eef4ff;
    color: #31599b;
  }

  .rn-student-courses .rnc-course h3 {
    margin: 17px 0 8px;
    color: var(--rnc-navy);
    font-size: 19px;
    font-weight: 850;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  .rn-student-courses .rnc-description {
    min-height: 40px;
    margin: 0;
    color: #718096;
    font-size: 12px;
    line-height: 1.75;
  }

  .rn-student-courses .rnc-progress {
    padding: 16px;
    margin-top: 21px;
    border: 1px solid #edf1f6;
    border-radius: 12px;
    background: #f9fbfe;
  }

  .rn-student-courses .rnc-progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }

  .rn-student-courses .rnc-progress-header strong {
    color: #263850;
    font-size: 12px;
  }

  .rn-student-courses .rnc-progress-value {
    color: #087c99;
    font-size: 14px;
    font-weight: 850;
  }

  .rn-student-courses .rnc-progress-track {
    height: 7px;
    overflow: hidden;
    border-radius: 99px;
    background: #e4eaf2;
  }

  .rn-student-courses .rnc-progress-fill {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #00b4d8, #0785a6);
    transition: width .25s ease;
  }

  .rn-student-courses .rnc-progress-caption {
    display: block;
    margin-top: 9px;
    color: #77859a;
    font-size: 11px;
  }

  .rn-student-courses .rnc-details {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 15px;
  }

  .rn-student-courses .rnc-detail {
    min-width: 0;
    padding: 13px;
    border: 1px solid #edf0f5;
    border-radius: 10px;
  }

  .rn-student-courses .rnc-detail-label {
    display: block;
    color: #78869a;
    font-size: 10px;
    font-weight: 750;
    text-transform: uppercase;
    letter-spacing: .5px;
  }

  .rn-student-courses .rnc-detail-value {
    display: block;
    margin-top: 7px;
    color: #20334d;
    font-size: 12px;
    font-weight: 800;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .rn-student-courses .rnc-next-lesson {
    padding: 13px 15px;
    margin-top: 14px;
    border-left: 3px solid var(--rnc-cyan);
    border-radius: 0 9px 9px 0;
    background: #f0fbfe;
  }

  .rn-student-courses .rnc-next-lesson span {
    display: block;
    margin-bottom: 5px;
    color: #087c99;
    font-size: 10px;
    font-weight: 850;
    text-transform: uppercase;
    letter-spacing: .7px;
  }

  .rn-student-courses .rnc-next-lesson strong {
    display: block;
    color: #20334d;
    font-size: 12px;
    line-height: 1.6;
  }

  .rn-student-courses .rnc-course-footer {
    padding: 17px 21px 20px;
    border-top: 1px solid #edf0f5;
    background: #fcfdff;
  }

  .rn-student-courses .rnc-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 9px;
    align-items: center;
  }

  .rn-student-courses .rnc-actions + .rnc-actions {
    margin-top: 11px;
  }

  .rn-student-courses .rnc-requirements {
    display: grid;
    gap: 9px;
    padding: 15px 21px 18px;
    border-top: 1px solid #edf0f5;
    background: #fffdf7;
  }

  .rn-student-courses .rnc-requirements-title {
    margin-bottom: 2px;
    color: #594717;
    font-size: 11px;
    font-weight: 850;
  }

  .rn-student-courses .rnc-requirement {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    color: #6f6858;
    font-size: 11px;
    line-height: 1.6;
  }

  .rn-student-courses .rnc-requirement-done {
    color: #197345;
  }

  .rn-student-courses .rnc-notice {
    padding: 14px 17px;
    margin-bottom: 18px;
    border: 1px solid #f1d997;
    border-radius: 11px;
    background: #fffaf0;
    color: #765b17;
    font-size: 12px;
    line-height: 1.75;
  }

  .rn-student-courses .rnc-empty {
    padding: 43px 20px;
    border: 1px dashed #cbd7e5;
    border-radius: 15px;
    background: #fafcff;
    text-align: center;
  }

  .rn-student-courses .rnc-empty-icon {
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    margin: 0 auto 16px;
    border-radius: 16px;
    background: #e4faff;
    color: #087c99;
    font-size: 26px;
    font-weight: 850;
  }

  .rn-student-courses .rnc-empty h2 {
    margin: 0;
    color: var(--rnc-navy);
    font-size: 21px;
  }

  .rn-student-courses .rnc-empty p {
    max-width: 480px;
    margin: 10px auto 20px;
    color: var(--rnc-muted);
    font-size: 13px;
    line-height: 1.8;
  }

  .rn-student-courses .rnc-tools-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 13px;
  }

  .rn-student-courses .rnc-tool {
    display: block;
    padding: 19px;
    border: 1px solid var(--rnc-border);
    border-radius: 13px;
    background: #fff;
    transition: border-color .18s ease, background .18s ease;
  }

  .rn-student-courses .rnc-tool:hover {
    border-color: #9be4f1;
    background: #f8fdff;
  }

  .rn-student-courses .rnc-tool strong {
    display: block;
    color: var(--rnc-navy);
    font-size: 13px;
    font-weight: 850;
  }

  .rn-student-courses .rnc-tool span {
    display: block;
    margin-top: 7px;
    color: var(--rnc-muted);
    font-size: 12px;
    line-height: 1.7;
  }

  @media (max-width: 950px) {
    .rn-student-courses .rnc-stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .rn-student-courses .rnc-hero {
      align-items: flex-start;
      flex-direction: column;
    }
  }

  @media (max-width: 680px) {
    .rn-student-courses .rnc-hero {
      padding: 25px 20px;
      border-radius: 17px;
    }

    .rn-student-courses .rnc-hero h1 {
      font-size: 31px;
    }

    .rn-student-courses .rnc-hero-actions {
      width: 100%;
    }

    .rn-student-courses .rnc-hero-actions .rnc-button {
      flex: 1;
    }

    .rn-student-courses .rnc-stats {
      gap: 10px;
    }

    .rn-student-courses .rnc-stat {
      padding: 16px;
    }

    .rn-student-courses .rnc-stat-value {
      font-size: 29px;
    }

    .rn-student-courses .rnc-section {
      padding: 19px 14px;
      border-radius: 15px;
    }

    .rn-student-courses .rnc-section-header {
      align-items: flex-start;
      flex-direction: column;
    }

    .rn-student-courses .rnc-course-grid,
    .rn-student-courses .rnc-tools-grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .rn-student-courses .rnc-course-body {
      padding: 18px;
    }

    .rn-student-courses .rnc-course-footer {
      padding: 16px 18px;
    }

    .rn-student-courses .rnc-actions .rnc-button {
      flex: 1 1 auto;
    }
  }

  @media (max-width: 380px) {
    .rn-student-courses .rnc-stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .rn-student-courses .rnc-details {
      grid-template-columns: minmax(0, 1fr);
    }

    .rn-student-courses .rnc-hero-actions {
      flex-direction: column;
    }

    .rn-student-courses .rnc-hero-actions .rnc-button {
      width: 100%;
    }
  }
`;

export default async function StudentCoursesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/student/courses");
  }

  const {
    data: enrollmentData,
    error: enrollmentError,
  } = await supabase
    .from("enrollments")
    .select(
      "id, course_id, enrollment_status, payment_status, progress_percent",
    )
    .eq("student_id", user.id)
    .in("enrollment_status", ["active", "completed"]);

  if (enrollmentError) {
    console.error(
      "Student courses: enrollment query failed:",
      enrollmentError,
    );

    const {
      data: fallbackEnrollmentData,
      error: fallbackEnrollmentError,
    } = await supabase
      .from("enrollments")
      .select("id, course_id, enrollment_status")
      .eq("student_id", user.id)
      .in("enrollment_status", ["active", "completed"]);

    if (fallbackEnrollmentError) {
      console.error(
        "Student courses: enrollment fallback failed:",
        fallbackEnrollmentError,
      );

      return (
        <main className="container rn-student-courses">
          <style>{DASHBOARD_STYLES}</style>
          <DashboardHeader />

          <section className="rnc-section rnc-empty">
            <div className="rnc-empty-icon">!</div>
            <h2>Learning data temporarily unavailable</h2>
            <p>
              Your account is intact, but your enrollment information could
              not be retrieved. Please try again later.
            </p>
            <Link
              href="/courses"
              className="rnc-button rnc-button-primary"
            >
              Browse Courses
            </Link>
          </section>
        </main>
      );
    }

    const fallbackEnrollments =
      (fallbackEnrollmentData ?? []) as unknown as Array<{
        id: string;
        course_id: string;
        enrollment_status: string;
      }>;

    const normalizedFallbackEnrollments: Enrollment[] =
      fallbackEnrollments.map((row) => ({
        id: row.id,
        course_id: row.course_id,
        enrollment_status: row.enrollment_status,
        payment_status: null,
        progress_percent: null,
      }));

    if (normalizedFallbackEnrollments.length === 0) {
      return <EmptyCoursesPage />;
    }

    return renderCoursesPage(
      supabase,
      user.id,
      normalizedFallbackEnrollments,
      true,
    );
  }

  const enrollments =
    (enrollmentData ?? []) as unknown as Enrollment[];

  if (enrollments.length === 0) {
    return <EmptyCoursesPage />;
  }

  return renderCoursesPage(
    supabase,
    user.id,
    enrollments,
    false,
  );
}

function DashboardHeader() {
  return (
    <section className="rnc-hero">
      <div className="rnc-hero-copy">
        <span className="rnc-eyebrow">RUFFNECK ENTERTAINMENT · LEARNING</span>
        <h1>My Courses</h1>
        <p>
          Track your lessons, resume learning, monitor assessments and manage
          your certificates.
        </p>
      </div>

      <div className="rnc-hero-actions">
        <Link
          href="/courses"
          className="rnc-button rnc-button-primary"
        >
          Browse Courses <span aria-hidden="true">→</span>
        </Link>

        <Link
          href="/student/certificates"
          className="rnc-button rnc-button-secondary"
        >
          Certificates
        </Link>
      </div>
    </section>
  );
}

function EmptyCoursesPage() {
  return (
    <main className="container rn-student-courses">
      <style>{DASHBOARD_STYLES}</style>
      <DashboardHeader />

      <section className="rnc-section rnc-empty">
        <div className="rnc-empty-icon" aria-hidden="true">
          +
        </div>

        <h2>No courses yet</h2>

        <p>
          You are not currently enrolled in any courses. Explore the
          RuffNeck Learn catalogue to start building practical professional
          skills.
        </p>

        <Link
          href="/courses"
          className="rnc-button rnc-button-primary"
        >
          Browse Available Courses <span aria-hidden="true">→</span>
        </Link>
      </section>
    </main>
  );
}

async function renderCoursesPage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  enrollments: Enrollment[],
  usedEnrollmentFallback: boolean,
) {
  const courseIds = Array.from(
    new Set(enrollments.map((enrollment) => enrollment.course_id)),
  );

  const [
    courseResult,
    curriculumResult,
    progressResult,
    assessmentResult,
    certificateResult,
    projectResult,
  ] = await Promise.all([
    supabase
      .from("courses")
      .select(
        "id, title, slug, short_description, level, duration_minutes",
      )
      .in("id", courseIds),

    supabase
      .from("course_curriculum")
      .select(
        [
          "lesson_id",
          "course_id",
          "section_id",
          "section_title",
          "section_sort",
          "lesson_title",
          "lesson_slug",
          "lesson_sort",
          "duration_minutes",
          "duration_seconds",
          "is_preview",
          "is_published",
        ].join(", "),
      )
      .in("course_id", courseIds)
      .eq("is_published", true)
      .order("section_sort", { ascending: true })
      .order("lesson_sort", { ascending: true }),

    supabase
      .from("lesson_progress")
      .select("student_id, lesson_id, course_id, completed")
      .eq("student_id", userId)
      .in("course_id", courseIds),

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
          "time_spent_seconds",
          "completed_at",
        ].join(", "),
      )
      .eq("student_id", userId)
      .in("course_id", courseIds)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false }),

    supabase
      .from("course_certificates")
      .select(
        "id, student_id, course_id, certificate_number, is_revoked",
      )
      .eq("student_id", userId)
      .in("course_id", courseIds),

    supabase
      .from("course_projects")
      .select("id, course_id, project_type, is_published")
      .in("course_id", courseIds)
      .eq("project_type", "capstone")
      .eq("is_published", true),
  ]);

  const queryErrors = [
    courseResult.error,
    curriculumResult.error,
    progressResult.error,
    assessmentResult.error,
    certificateResult.error,
    projectResult.error,
  ];

  queryErrors.forEach((error, index) => {
    if (error) {
      console.error(
        `Student courses: data query ${index + 1} failed:`,
        error,
      );
    }
  });

  const dataWarnings: string[] = [];

  if (courseResult.error) dataWarnings.push("course information");
  if (curriculumResult.error) dataWarnings.push("lesson curriculum");
  if (progressResult.error) dataWarnings.push("lesson progress");
  if (assessmentResult.error) dataWarnings.push("assessment history");
  if (certificateResult.error) dataWarnings.push("certificate information");
  if (projectResult.error) dataWarnings.push("capstone information");

  const courses = (courseResult.data ?? []) as unknown as Course[];
  const curriculum =
    (curriculumResult.data ?? []) as unknown as CurriculumLesson[];
  const lessonProgress =
    (progressResult.data ?? []) as unknown as LessonProgress[];
  const assessmentAttempts =
    (assessmentResult.data ?? []) as unknown as AssessmentAttempt[];
  const certificates =
    (certificateResult.data ?? []) as unknown as Certificate[];
  const capstoneProjects =
    (projectResult.data ?? []) as unknown as CourseProject[];

  if (courseResult.error) {
    return (
      <main className="container rn-student-courses">
        <style>{DASHBOARD_STYLES}</style>
        <DashboardHeader />

        <section className="rnc-section rnc-empty">
          <div className="rnc-empty-icon" aria-hidden="true">
            !
          </div>
          <h2>Course information unavailable</h2>
          <p>
            Your enrollment was found, but the course catalogue could not
            be loaded. Your enrollment records have not been changed.
          </p>
          <Link
            href="/courses"
            className="rnc-button rnc-button-primary"
          >
            Browse Courses
          </Link>
        </section>
      </main>
    );
  }

  const capstoneProjectIds = capstoneProjects.map(
    (project) => project.id,
  );

  let submissionData: ProjectSubmission[] = [];

  if (capstoneProjectIds.length > 0) {
    const { data, error } = await supabase
      .from("project_submissions")
      .select("id, project_id, student_id, status, score")
      .eq("student_id", userId)
      .in("project_id", capstoneProjectIds);

    if (error) {
      console.error(
        "Student courses: project submissions query failed:",
        error,
      );
      dataWarnings.push("capstone submission status");
    } else {
      submissionData = (data ?? []) as unknown as ProjectSubmission[];
    }
  }

  const courseMap = new Map(
    courses.map((course) => [course.id, course]),
  );

  const lessonsByCourse = new Map<string, CurriculumLesson[]>();

  for (const lesson of curriculum) {
    const existing = lessonsByCourse.get(lesson.course_id) ?? [];
    existing.push(lesson);
    lessonsByCourse.set(lesson.course_id, existing);
  }

  const completedLessonIds = new Set(
    lessonProgress
      .filter((progress) => progress.completed)
      .map((progress) => progress.lesson_id),
  );

  const assessmentByCourse = new Map<string, CourseAssessment>();

  for (const attempt of assessmentAttempts) {
    if (assessmentByCourse.has(attempt.course_id)) continue;

    let percentage: number | null = null;

    if (
      typeof attempt.earned_points === "number" &&
      typeof attempt.total_points === "number" &&
      attempt.total_points > 0
    ) {
      percentage =
        (attempt.earned_points / attempt.total_points) * 100;
    } else if (typeof attempt.score === "number") {
      percentage = attempt.score;
    }

    assessmentByCourse.set(attempt.course_id, {
      status: "completed",
      attempt_id: attempt.id,
      score:
        typeof attempt.score === "number" ? attempt.score : null,
      total_questions:
        typeof attempt.total_questions === "number"
          ? attempt.total_questions
          : null,
      completed_at: attempt.completed_at,
      percentage:
        percentage !== null ? Math.round(percentage) : null,
    });
  }

  const capstoneByCourse = new Map<string, CourseCapstone>();

  for (const project of capstoneProjects) {
    const existing = capstoneByCourse.get(project.course_id) ?? {
      has_capstone: false,
      approved_submission: false,
    };

    existing.has_capstone = true;

    if (
      submissionData.some(
        (submission) =>
          submission.project_id === project.id &&
          submission.status === "approved",
      )
    ) {
      existing.approved_submission = true;
    }

    capstoneByCourse.set(project.course_id, existing);
  }

  const certificateByCourse = new Map<string, CourseCertificate>();

  for (const certificate of certificates) {
    certificateByCourse.set(certificate.course_id, {
      status: certificate.is_revoked ? "revoked" : "valid",
      certificate_id: certificate.id,
      certificate_number: certificate.certificate_number,
    });
  }

  const courseRows = enrollments
    .map((enrollment) => {
      const course = courseMap.get(enrollment.course_id);
      if (!course) return null;

      const lessons = lessonsByCourse.get(course.id) ?? [];

      const completedCount = lessons.filter((lesson) =>
        completedLessonIds.has(lesson.lesson_id),
      ).length;

      const totalLessons = lessons.length;

      const allLessonsCompleted =
        totalLessons > 0 && completedCount === totalLessons;

      const lessonPercent =
        totalLessons > 0
          ? Math.round((completedCount / totalLessons) * 100)
          : Number(enrollment.progress_percent ?? 0);

      const nextLesson =
        lessons.find(
          (lesson) =>
            !completedLessonIds.has(lesson.lesson_id),
        ) ?? null;

      const assessment = assessmentByCourse.get(course.id) ?? {
        status: "not_started" as const,
        attempt_id: null,
        score: null,
        total_questions: null,
        completed_at: null,
        percentage: null,
      };

      const certificate = certificateByCourse.get(course.id) ?? {
        status: "not_issued" as const,
        certificate_id: null,
        certificate_number: null,
      };

      const capstone = capstoneByCourse.get(course.id) ?? {
        has_capstone: false,
        approved_submission: false,
      };

      const assessmentPassed =
        assessment.percentage !== null &&
        assessment.percentage >= 70;

      const certificateEligibility: CertificateEligibility = {
        eligible:
          allLessonsCompleted &&
          assessment.status === "completed" &&
          assessmentPassed &&
          capstone.has_capstone &&
          capstone.approved_submission,
        lessons_complete: allLessonsCompleted,
        assessment_complete: assessment.status === "completed",
        assessment_passed: assessmentPassed,
        capstone_available: capstone.has_capstone,
        capstone_approved: capstone.approved_submission,
      };

      return {
        enrollment,
        course,
        lessons,
        completedCount,
        totalLessons,
        allLessonsCompleted,
        lessonPercent: Math.min(100, Math.max(0, lessonPercent)),
        nextLesson,
        assessment,
        certificate,
        capstone,
        certificateEligibility,
      };
    })
    .filter(
      (row): row is NonNullable<typeof row> => row !== null,
    );

  const activeCourses = courseRows.filter(
    (row) => row.enrollment.enrollment_status === "active",
  );

  const completedCourses = courseRows.filter(
    (row) =>
      row.enrollment.enrollment_status === "completed" ||
      row.allLessonsCompleted,
  );

  const totalCompletedLessons = courseRows.reduce(
    (total, row) => total + row.completedCount,
    0,
  );

  return (
    <main className="container rn-student-courses">
      <style>{DASHBOARD_STYLES}</style>

      <DashboardHeader />

      {dataWarnings.length > 0 && (
        <div className="rnc-notice" role="status">
          Some learning information could not be loaded. Your enrolled
          courses remain available, but some details may be incomplete.
        </div>
      )}

      {usedEnrollmentFallback && (
        <div className="rnc-notice" role="status">
          Your enrollment records were loaded using a compatibility
          fallback. Some enrollment details may be unavailable.
        </div>
      )}

      <section className="rnc-stats" aria-label="Learning summary">
        <div className="rnc-stat">
          <span className="rnc-stat-label">Enrolled Courses</span>
          <strong className="rnc-stat-value">{courseRows.length}</strong>
          <span className="rnc-stat-note">
            Courses linked to your account
          </span>
        </div>

        <div className="rnc-stat">
          <span className="rnc-stat-label">Active Learning</span>
          <strong className="rnc-stat-value">{activeCourses.length}</strong>
          <span className="rnc-stat-note">
            Enrollments marked active
          </span>
        </div>

        <div className="rnc-stat">
          <span className="rnc-stat-label">Completed Courses</span>
          <strong className="rnc-stat-value">
            {completedCourses.length}
          </strong>
          <span className="rnc-stat-note">
            Enrollment complete or all lessons finished
          </span>
        </div>

        <div className="rnc-stat">
          <span className="rnc-stat-label">Lessons Completed</span>
          <strong className="rnc-stat-value">
            {totalCompletedLessons}
          </strong>
          <span className="rnc-stat-note">
            Completed published lessons
          </span>
        </div>
      </section>

      <section className="rnc-section">
        <div className="rnc-section-header">
          <div>
            <span className="rnc-eyebrow">YOUR LEARNING</span>
            <h2>Enrolled Courses</h2>
            <p>
              Resume lessons, review assessments and track certificate
              requirements.
            </p>
          </div>

          <Link href="/courses" className="rnc-text-link">
            Explore all courses →
          </Link>
        </div>

        {courseRows.length === 0 ? (
          <div className="rnc-empty">
            <div className="rnc-empty-icon" aria-hidden="true">
              +
            </div>
            <h2>No course details available</h2>
            <p>
              Your enrollment records were found, but no matching course
              information is currently available.
            </p>
            <Link
              href="/courses"
              className="rnc-button rnc-button-primary"
            >
              Browse Courses
            </Link>
          </div>
        ) : (
          <div className="rnc-course-grid">
            {courseRows.map((row) => {
              const {
                course,
                enrollment,
                completedCount,
                totalLessons,
                allLessonsCompleted,
                lessonPercent,
                nextLesson,
                assessment,
                certificate,
                certificateEligibility,
              } = row;

              const isEnrollmentCompleted =
                enrollment.enrollment_status === "completed";

              const primaryHref =
                !allLessonsCompleted && nextLesson
                  ? `/learn/${course.slug}/${nextLesson.lesson_slug}`
                  : `/courses/${course.slug}`;

              const primaryLabel =
                !allLessonsCompleted && nextLesson
                  ? "Continue Learning"
                  : "Review Course";

              const assessmentHref =
                `/student/assessment?course=${encodeURIComponent(course.slug)}`;

              const resultHref = assessment.attempt_id
                ? `/student/assessment/results/${encodeURIComponent(
                    assessment.attempt_id,
                  )}`
                : null;

              const certificateHref = certificate.certificate_id
                ? `/student/certificates/${encodeURIComponent(
                    certificate.certificate_id,
                  )}`
                : null;

              const assessmentStatus =
                assessment.status === "completed"
                  ? assessment.percentage !== null
                    ? `Completed · ${assessment.percentage}%`
                    : "Completed"
                  : "Not started";

              const certificateStatus =
                certificate.status === "valid"
                  ? "Issued"
                  : certificate.status === "revoked"
                    ? "Revoked"
                    : certificateEligibility.eligible
                      ? "Ready to issue"
                      : "In progress";

              return (
                <article className="rnc-course" key={enrollment.id}>
                  <div className="rnc-course-accent" />

                  <div className="rnc-course-body">
                    <div className="rnc-course-meta">
                      {course.level && (
                        <span className="rnc-chip">{course.level}</span>
                      )}

                      <span
                        className={
                          isEnrollmentCompleted
                            ? "rnc-chip rnc-chip-completed"
                            : "rnc-chip rnc-chip-active"
                        }
                      >
                        {isEnrollmentCompleted ? "Completed" : "Active"}
                      </span>

                      {course.duration_minutes && (
                        <span className="rnc-chip">
                          {course.duration_minutes} min
                        </span>
                      )}
                    </div>

                    <h3>{course.title}</h3>

                    <p className="rnc-description">
                      {course.short_description ||
                        "Continue developing practical skills through this course."}
                    </p>

                    <div className="rnc-progress">
                      <div className="rnc-progress-header">
                        <strong>Lesson Progress</strong>
                        <span className="rnc-progress-value">
                          {lessonPercent}%
                        </span>
                      </div>

                      <div
                        className="rnc-progress-track"
                        role="progressbar"
                        aria-label={`${course.title} lesson progress`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={lessonPercent}
                      >
                        <div
                          className="rnc-progress-fill"
                          style={{ width: `${lessonPercent}%` }}
                        />
                      </div>

                      <span className="rnc-progress-caption">
                        {completedCount} of {totalLessons} published lessons
                        completed
                      </span>
                    </div>

                    <div className="rnc-details">
                      <div className="rnc-detail">
                        <span className="rnc-detail-label">
                          Assessment
                        </span>
                        <span className="rnc-detail-value">
                          {assessmentStatus}
                        </span>
                      </div>

                      <div className="rnc-detail">
                        <span className="rnc-detail-label">
                          Certificate
                        </span>
                        <span className="rnc-detail-value">
                          {certificateStatus}
                        </span>
                      </div>
                    </div>

                    {nextLesson && (
                      <div className="rnc-next-lesson">
                        <span>Next lesson</span>
                        <strong>{nextLesson.lesson_title}</strong>
                      </div>
                    )}
                  </div>

                  <div className="rnc-course-footer">
                    <div className="rnc-actions">
                      <Link
                        href={primaryHref}
                        className="rnc-button rnc-button-primary"
                      >
                        {primaryLabel} →
                      </Link>

                      <Link
                        href={`/courses/${course.slug}`}
                        className="rnc-button rnc-button-secondary"
                      >
                        Course Details
                      </Link>
                    </div>

                    <div className="rnc-actions">
                      <Link
                        href={assessmentHref}
                        className="rnc-button rnc-button-secondary"
                      >
                        {assessment.status === "completed"
                          ? "Retake Assessment"
                          : "Start Assessment"}
                      </Link>

                      {resultHref && (
                        <Link href={resultHref} className="rnc-text-link">
                          View Result
                        </Link>
                      )}

                      {certificateHref ? (
                        <Link
                          href={certificateHref}
                          className="rnc-text-link"
                        >
                          View Certificate
                        </Link>
                      ) : certificateEligibility.eligible &&
                        certificate.status === "not_issued" ? (
                        <CertificateIssueButton courseId={course.id} />
                      ) : null}
                    </div>
                  </div>

                  {!certificateEligibility.eligible &&
                    certificate.status === "not_issued" && (
                      <div className="rnc-requirements">
                        <span className="rnc-requirements-title">
                          Certificate requirements
                        </span>

                        <span
                          className={
                            certificateEligibility.lessons_complete
                              ? "rnc-requirement rnc-requirement-done"
                              : "rnc-requirement"
                          }
                        >
                          {certificateEligibility.lessons_complete ? "✓" : "○"}{" "}
                          Complete all published lessons
                        </span>

                        <span
                          className={
                            certificateEligibility.assessment_passed
                              ? "rnc-requirement rnc-requirement-done"
                              : "rnc-requirement"
                          }
                        >
                          {certificateEligibility.assessment_passed
                            ? "✓"
                            : "○"}{" "}
                          Pass the assessment with at least 70%
                        </span>

                        <span
                          className={
                            certificateEligibility.capstone_approved
                              ? "rnc-requirement rnc-requirement-done"
                              : "rnc-requirement"
                          }
                        >
                          {certificateEligibility.capstone_approved
                            ? "✓"
                            : "○"}{" "}
                          Receive capstone approval
                        </span>
                      </div>
                    )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="rnc-section">
        <div className="rnc-section-header">
          <div>
            <span className="rnc-eyebrow">LEARNING TOOLS</span>
            <h2>More from RuffNeck Learn</h2>
            <p>
              Access study tools, practical projects and your learning records.
            </p>
          </div>
        </div>

        <div className="rnc-tools-grid">
          <Link href="/student/scan" className="rnc-tool">
            <strong>Scan &amp; Learn →</strong>
            <span>
              Create AI-assisted study drafts from learning materials.
            </span>
          </Link>

          <Link href="/student/ai-drafts" className="rnc-tool">
            <strong>My AI Drafts →</strong>
            <span>
              Return to your saved drafts and study materials.
            </span>
          </Link>

          <Link href="/student/payments" className="rnc-tool">
            <strong>Payment History →</strong>
            <span>
              Review your payment and transaction records.
            </span>
          </Link>

          <Link href="/student/certificates" className="rnc-tool">
            <strong>My Certificates →</strong>
            <span>
              Access certificates issued for completed courses.
            </span>
          </Link>
        </div>
      </section>
    </main>
  );
}