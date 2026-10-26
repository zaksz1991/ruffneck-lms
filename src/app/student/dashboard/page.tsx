import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LearningIntelligence from "@/components/LearningIntelligence";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
};

type Course = {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  category: string | null;
  level: "beginner" | "intermediate" | "advanced";
  duration_minutes: number | null;
  is_free: boolean;
  price_ngn: number;
  status: "draft" | "published" | "archived";
};

type Enrollment = {
  id: string;
  student_id: string;
  course_id: string;
  payment_status: string;
  enrollment_status: string;
  progress_percent: number;
  enrolled_at: string;
  completed_at: string | null;
  last_accessed_at: string | null;
};

type SkillProfile = {
  id: string;
  student_id: string;
  skill_id: string;
  confidence_score: number;
  skill_level: string;
  evidence: string | null;
  strengths: string | null;
  gaps: string | null;
  updated_at: string;
};

type CurriculumRow = {
  lesson_id: string;
  course_id: string;
};

type LessonProgressRow = {
  lesson_id: string;
  course_id: string;
  completed: boolean;
};

const PAGE_STYLES = `
  .rn-dashboard-page {
    --dash-navy: #0b1e3a;
    --dash-blue: #1264a3;
    --dash-cyan: #00b4d8;
    --dash-ink: #24334a;
    --dash-muted: #65758b;
    --dash-border: #e2e8f0;
    --dash-page: #f3f6f9;
    --dash-green: #167647;

    width: 100%;
    max-width: 1200px;
    min-height: 100vh;
    padding-top: 28px;
    padding-bottom: 60px;
    color: var(--dash-ink);
    background: transparent;
  }

  .rn-dashboard-page *,
  .rn-dashboard-page *::before,
  .rn-dashboard-page *::after {
    box-sizing: border-box;
  }

  .rn-dashboard-page a {
    text-decoration: none;
  }

  .rn-dashboard-page .rn-eyebrow {
    display: block;
    margin: 0 0 9px;
    color: #087e9b;
    font-size: 10px;
    font-weight: 850;
    letter-spacing: 1.45px;
    line-height: 1.65;
  }

  .rn-dashboard-page .rn-dashboard-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 25px;
    padding: 31px;
    margin-bottom: 20px;
    border: 1px solid var(--dash-border);
    border-radius: 15px;
    background: #fff;
    box-shadow: 0 3px 12px rgba(11, 30, 58, .035);
  }

  .rn-dashboard-page .rn-dashboard-header-content {
    min-width: 0;
    max-width: 670px;
  }

  .rn-dashboard-page .rn-dashboard-header h1 {
    margin: 0;
    color: var(--dash-navy);
    font-size: clamp(29px, 4vw, 38px);
    font-weight: 850;
    letter-spacing: -1.15px;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .rn-dashboard-page .rn-dashboard-intro {
    max-width: 620px;
    margin: 12px 0 0;
    color: var(--dash-muted);
    font-size: 14px;
    line-height: 1.85;
  }

  .rn-dashboard-page .rn-dashboard-header-actions {
    display: flex;
    flex: 0 0 auto;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 9px;
    max-width: 420px;
  }

  .rn-dashboard-page .rn-button {
    display: inline-flex;
    min-height: 41px;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 10px 14px;
    border: 1px solid #d7e1ed;
    border-radius: 8px;
    background: #fff;
    color: #253b55;
    font-size: 12px;
    font-weight: 800;
    line-height: 1.5;
    text-align: center;
    cursor: pointer;
    transition: background .18s ease, border-color .18s ease, box-shadow .18s ease;
  }

  .rn-dashboard-page .rn-button:hover {
    border-color: #9fc8e8;
    box-shadow: 0 3px 10px rgba(11, 30, 58, .07);
  }

  .rn-dashboard-page .rn-button-primary {
    border-color: var(--dash-navy);
    background: var(--dash-navy);
    color: #fff;
  }

  .rn-dashboard-page .rn-button-primary:hover {
    border-color: #164c79;
    background: #164c79;
    color: #fff;
  }

  .rn-dashboard-page .rn-button-secondary {
    background: #fff;
    color: var(--dash-navy);
  }

  .rn-dashboard-page a:focus-visible {
    outline: 3px solid rgba(0, 180, 216, .35);
    outline-offset: 3px;
  }

  .rn-dashboard-page .rn-dashboard-stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
    margin-bottom: 23px;
  }

  .rn-dashboard-page .rn-dashboard-stat {
    position: relative;
    min-width: 0;
    overflow: hidden;
    padding: 20px;
    border: 1px solid var(--dash-border);
    border-radius: 12px;
    background: #fff;
    box-shadow: 0 2px 10px rgba(11, 30, 58, .025);
  }

  .rn-dashboard-page .rn-dashboard-stat::before {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 3px;
    background: #cbd9e8;
    content: "";
  }

  .rn-dashboard-page .rn-dashboard-stat:nth-child(1)::before {
    background: var(--dash-navy);
  }

  .rn-dashboard-page .rn-dashboard-stat:nth-child(2)::before {
    background: #1e9b62;
  }

  .rn-dashboard-page .rn-dashboard-stat:nth-child(3)::before {
    background: var(--dash-cyan);
  }

  .rn-dashboard-page .rn-dashboard-stat:nth-child(4)::before {
    background: #e8aa37;
  }

  .rn-dashboard-page .rn-dashboard-stat-label {
    display: block;
    color: var(--dash-muted);
    font-size: 12px;
    font-weight: 700;
    line-height: 1.6;
  }

  .rn-dashboard-page .rn-dashboard-stat > strong {
    display: block;
    margin-top: 9px;
    color: var(--dash-navy);
    font-size: 34px;
    font-weight: 850;
    letter-spacing: -1px;
    line-height: 1.2;
  }

  .rn-dashboard-page .rn-dashboard-stat > small {
    display: block;
    margin-top: 8px;
    color: #8190a3;
    font-size: 11px;
    line-height: 1.6;
  }

  .rn-dashboard-page .rn-dashboard-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: stretch;
    gap: 17px;
    margin-bottom: 32px;
  }

  .rn-dashboard-page .rn-dashboard-card {
    display: flex;
    min-width: 0;
    flex-direction: column;
    padding: 25px;
    border: 1px solid var(--dash-border);
    border-radius: 13px;
    background: #fff;
    box-shadow: 0 3px 12px rgba(11, 30, 58, .025);
  }

  .rn-dashboard-page .rn-dashboard-card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    min-width: 0;
  }

  .rn-dashboard-page .rn-dashboard-card h2 {
    margin: 0;
    color: var(--dash-navy);
    font-size: 21px;
    font-weight: 850;
    letter-spacing: -.4px;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }

  .rn-dashboard-page .rn-text-link {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    gap: 5px;
    color: #1264a3;
    font-size: 12px;
    font-weight: 800;
    line-height: 1.7;
  }

  .rn-dashboard-page .rn-text-link:hover {
    color: #087e9b;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .rn-dashboard-page .rn-profile-summary {
    display: grid;
    grid-template-columns: minmax(110px, .7fr) minmax(0, 1.3fr);
    align-items: center;
    gap: 22px;
    margin-top: 24px;
  }

  .rn-dashboard-page .rn-profile-score {
    display: flex;
    min-height: 130px;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 17px 10px;
    border: 1px solid #cdebf2;
    border-radius: 12px;
    background: linear-gradient(145deg, #f0fcff, #f9fdff);
    text-align: center;
  }

  .rn-dashboard-page .rn-profile-score > strong {
    color: var(--dash-navy);
    font-size: 32px;
    font-weight: 850;
    letter-spacing: -1px;
    line-height: 1.3;
  }

  .rn-dashboard-page .rn-profile-score > span {
    max-width: 130px;
    margin-top: 5px;
    color: var(--dash-muted);
    font-size: 10px;
    font-weight: 700;
    line-height: 1.6;
  }

  .rn-dashboard-page .rn-profile-details {
    min-width: 0;
  }

  .rn-dashboard-page .rn-profile-details p {
    margin: 8px 0;
    color: var(--dash-muted);
    font-size: 12px;
    line-height: 1.7;
    overflow-wrap: anywhere;
  }

  .rn-dashboard-page .rn-profile-details strong {
    color: #34465e;
    font-weight: 800;
  }

  .rn-dashboard-page .rn-dashboard-card-text {
    margin: 17px 0 21px;
    color: var(--dash-muted);
    font-size: 13px;
    line-height: 1.85;
  }

  .rn-dashboard-page .rn-dashboard-inline-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 9px;
    margin-top: auto;
  }

  .rn-dashboard-page .rn-dashboard-section {
    margin-top: 31px;
  }

  .rn-dashboard-page .rn-dashboard-section-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 18px;
  }

  .rn-dashboard-page .rn-dashboard-section-header h2 {
    margin: 0;
    color: var(--dash-navy);
    font-size: 25px;
    font-weight: 850;
    letter-spacing: -.7px;
    line-height: 1.3;
  }

  .rn-dashboard-page .rn-dashboard-section-header p {
    margin: 7px 0 0;
    color: var(--dash-muted);
    font-size: 13px;
    line-height: 1.8;
  }

  .rn-dashboard-page .rn-course-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: stretch;
    gap: 16px;
  }

  .rn-dashboard-page .rn-course-card {
    display: flex;
    min-width: 0;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid var(--dash-border);
    border-radius: 13px;
    background: #fff;
    box-shadow: 0 3px 12px rgba(11, 30, 58, .025);
    transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease;
  }

  .rn-dashboard-page .rn-course-card:hover {
    transform: translateY(-2px);
    border-color: #c5d8e9;
    box-shadow: 0 7px 20px rgba(11, 30, 58, .055);
  }

  .rn-dashboard-page .rn-course-card-body {
    display: flex;
    height: 100%;
    min-width: 0;
    flex-direction: column;
    padding: 21px;
  }

  .rn-dashboard-page .rn-course-card-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
    margin-bottom: 15px;
  }

  .rn-dashboard-page .rn-course-card-meta span {
    display: inline-flex;
    align-items: center;
    padding: 5px 8px;
    border: 1px solid #e1e9f2;
    border-radius: 6px;
    background: #f6f9fc;
    color: #4a5d75;
    font-size: 10px;
    font-weight: 750;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .rn-dashboard-page .rn-course-card-meta span:last-child {
    border-color: #c9ecf4;
    background: #effbfe;
    color: #0a7188;
  }

  .rn-dashboard-page .rn-course-card h3 {
    margin: 0;
    color: var(--dash-navy);
    font-size: 18px;
    font-weight: 850;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .rn-dashboard-page .rn-course-card-body > p {
    display: -webkit-box;
    min-height: 46px;
    overflow: hidden;
    margin: 9px 0 19px;
    color: var(--dash-muted);
    font-size: 12px;
    line-height: 1.85;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
  }

  .rn-dashboard-page .rn-progress-block {
    margin-top: auto;
    padding: 14px;
    border: 1px solid #edf1f6;
    border-radius: 9px;
    background: #fafcff;
  }

  .rn-dashboard-page .rn-progress-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 10px;
  }

  .rn-dashboard-page .rn-progress-header span {
    color: #52627a;
    font-size: 11px;
    font-weight: 750;
  }

  .rn-dashboard-page .rn-progress-header strong {
    color: var(--dash-navy);
    font-size: 13px;
    font-weight: 850;
  }

  .rn-dashboard-page .rn-progress-track {
    height: 7px;
    overflow: hidden;
    border-radius: 999px;
    background: #e7edf4;
  }

  .rn-dashboard-page .rn-progress-fill {
    height: 100%;
    min-width: 0;
    border-radius: inherit;
    background: linear-gradient(90deg, #1264a3, #00b4d8);
    transition: width .25s ease;
  }

  .rn-dashboard-page .rn-progress-fill.is-complete {
    background: linear-gradient(90deg, #16834a, #30b974);
  }

  .rn-dashboard-page .rn-course-card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    padding-top: 17px;
  }

  .rn-dashboard-page .rn-course-card-footer > span {
    color: var(--dash-muted);
    font-size: 11px;
    font-weight: 700;
    line-height: 1.7;
  }

  .rn-dashboard-page .rn-empty-state {
    padding: 42px 24px;
    border: 1px dashed #cbd7e5;
    border-radius: 13px;
    background: #fff;
    text-align: center;
  }

  .rn-dashboard-page .rn-empty-state h3 {
    margin: 0;
    color: var(--dash-navy);
    font-size: 21px;
    font-weight: 850;
  }

  .rn-dashboard-page .rn-empty-state p {
    max-width: 520px;
    margin: 10px auto 20px;
    color: var(--dash-muted);
    font-size: 13px;
    line-height: 1.85;
  }

  .rn-dashboard-page .rn-dashboard-actions-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 13px;
  }

  .rn-dashboard-page .rn-dashboard-action {
    display: flex;
    min-width: 0;
    flex-direction: column;
    padding: 20px;
    border: 1px solid var(--dash-border);
    border-radius: 11px;
    background: #fff;
    box-shadow: 0 2px 10px rgba(11, 30, 58, .025);
    transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease;
  }

  .rn-dashboard-page .rn-dashboard-action:hover {
    transform: translateY(-2px);
    border-color: #b7d7ee;
    box-shadow: 0 6px 17px rgba(11, 30, 58, .06);
  }

  .rn-dashboard-page .rn-dashboard-action strong {
    color: var(--dash-navy);
    font-size: 14px;
    font-weight: 850;
    line-height: 1.6;
    overflow-wrap: anywhere;
  }

  .rn-dashboard-page .rn-dashboard-action span {
    margin-top: 8px;
    color: var(--dash-muted);
    font-size: 12px;
    line-height: 1.8;
  }

  .rn-dashboard-page .rn-dashboard-footer-note {
    margin-top: 27px;
    padding: 20px 22px;
    border: 1px solid var(--dash-border);
    border-radius: 11px;
    background: #fff;
  }

  .rn-dashboard-page .rn-dashboard-footer-note p {
    margin: 0;
    color: var(--dash-muted);
    font-size: 11px;
    line-height: 1.8;
  }

  .rn-dashboard-page .rn-dashboard-footer-note p + p {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid #edf1f6;
  }

  @media (max-width: 1000px) {
    .rn-dashboard-page .rn-dashboard-header {
      flex-direction: column;
    }

    .rn-dashboard-page .rn-dashboard-header-actions {
      max-width: none;
      justify-content: flex-start;
    }

    .rn-dashboard-page .rn-dashboard-actions-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 760px) {
    .rn-dashboard-page {
      padding-top: 17px;
      padding-bottom: 38px;
    }

    .rn-dashboard-page .rn-dashboard-header {
      padding: 23px 20px;
    }

    .rn-dashboard-page .rn-dashboard-stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .rn-dashboard-page .rn-dashboard-stat {
      padding: 17px;
    }

    .rn-dashboard-page .rn-dashboard-stat > strong {
      font-size: 30px;
    }

    .rn-dashboard-page .rn-dashboard-grid {
      grid-template-columns: minmax(0, 1fr);
      gap: 13px;
    }

    .rn-dashboard-page .rn-dashboard-card {
      padding: 21px;
    }

    .rn-dashboard-page .rn-course-grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .rn-dashboard-page .rn-dashboard-section-header {
      align-items: flex-start;
    }

    .rn-dashboard-page .rn-dashboard-actions-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 480px) {
    .rn-dashboard-page .rn-dashboard-header {
      padding: 21px 16px;
    }

    .rn-dashboard-page .rn-dashboard-header h1 {
      font-size: 29px;
    }

    .rn-dashboard-page .rn-dashboard-intro {
      font-size: 13px;
    }

    .rn-dashboard-page .rn-dashboard-header-actions {
      width: 100%;
      flex-direction: column;
      align-items: stretch;
    }

    .rn-dashboard-page .rn-dashboard-header-actions .rn-button {
      width: 100%;
    }

    .rn-dashboard-page .rn-dashboard-stat {
      padding: 15px 12px;
    }

    .rn-dashboard-page .rn-dashboard-stat > strong {
      font-size: 27px;
    }

    .rn-dashboard-page .rn-dashboard-stat > small {
      font-size: 10px;
    }

    .rn-dashboard-page .rn-dashboard-card {
      padding: 18px 15px;
    }

    .rn-dashboard-page .rn-dashboard-card h2 {
      font-size: 19px;
    }

    .rn-dashboard-page .rn-profile-summary {
      grid-template-columns: minmax(0, 1fr);
      gap: 14px;
      margin-top: 18px;
    }

    .rn-dashboard-page .rn-profile-score {
      min-height: 105px;
    }

    .rn-dashboard-page .rn-dashboard-card-header {
      flex-wrap: wrap;
    }

    .rn-dashboard-page .rn-dashboard-section-header {
      flex-direction: column;
      gap: 10px;
    }

    .rn-dashboard-page .rn-dashboard-section-header h2 {
      font-size: 23px;
    }

    .rn-dashboard-page .rn-course-card-body {
      padding: 17px;
    }

    .rn-dashboard-page .rn-course-card-footer {
      align-items: stretch;
      flex-direction: column;
    }

    .rn-dashboard-page .rn-course-card-footer .rn-button {
      width: 100%;
    }

    .rn-dashboard-page .rn-dashboard-actions-grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .rn-dashboard-page .rn-dashboard-inline-actions {
      flex-direction: column;
      align-items: stretch;
    }

    .rn-dashboard-page .rn-dashboard-inline-actions .rn-button {
      width: 100%;
    }

    .rn-dashboard-page .rn-empty-state {
      padding: 30px 17px;
    }

    .rn-dashboard-page .rn-dashboard-footer-note {
      padding: 17px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .rn-dashboard-page *,
    .rn-dashboard-page *::before,
    .rn-dashboard-page *::after {
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

function formatDate(value: string | null) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeZone: "Africa/Lagos",
  }).format(date);
}

function getProgressLabel(progress: number) {
  if (progress >= 100) {
    return "Completed";
  }

  if (progress > 0) {
    return "In progress";
  }

  return "Not started";
}

function getEnrollmentProgress(
  enrollment: Enrollment,
  curriculumLessons: CurriculumRow[],
  completedLessons: LessonProgressRow[],
) {
  if (enrollment.enrollment_status === "completed") {
    return 100;
  }

  const courseLessonIds = new Set(
    curriculumLessons
      .filter(
        (lesson) => lesson.course_id === enrollment.course_id,
      )
      .map((lesson) => lesson.lesson_id),
  );

  const totalLessons = courseLessonIds.size;

  if (totalLessons === 0) {
    const fallbackProgress = Number(
      enrollment.progress_percent || 0,
    );

    if (!Number.isFinite(fallbackProgress)) {
      return 0;
    }

    return Math.min(100, Math.max(0, Math.round(fallbackProgress)));
  }

  const completedCount = new Set(
    completedLessons
      .filter(
        (progress) =>
          progress.course_id === enrollment.course_id &&
          progress.completed &&
          courseLessonIds.has(progress.lesson_id),
      )
      .map((progress) => progress.lesson_id),
  ).size;

  return Math.min(
    100,
    Math.max(
      0,
      Math.round((completedCount / totalLessons) * 100),
    ),
  );
}

export default async function StudentDashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/student/dashboard");
  }

  const { data: profileData, error: profileError } =
    await supabase
      .from("profiles")
      .select("id, email, full_name, role")
      .eq("id", user.id)
      .maybeSingle();

  if (profileError) {
    console.error(
      "Failed to load dashboard profile:",
      profileError,
    );
  }

  const profile = profileData as Profile | null;

  const { data: enrollmentData, error: enrollmentError } =
    await supabase
      .from("enrollments")
      .select(
        `
          id,
          student_id,
          course_id,
          payment_status,
          enrollment_status,
          progress_percent,
          enrolled_at,
          completed_at,
          last_accessed_at
        `,
      )
      .eq("student_id", user.id)
      .in("enrollment_status", ["active", "completed"])
      .order("last_accessed_at", {
        ascending: false,
        nullsFirst: false,
      });

  if (enrollmentError) {
    console.error(
      "Failed to load dashboard enrollments:",
      enrollmentError,
    );
  }

  const enrollments = (enrollmentData || []) as Enrollment[];

  const enrolledCourseIds = [
    ...new Set(enrollments.map((item) => item.course_id)),
  ];

  let enrolledCourses: Course[] = [];

  if (enrolledCourseIds.length > 0) {
    const { data: courseData, error: courseError } =
      await supabase
        .from("courses")
        .select(
          `
            id,
            title,
            slug,
            short_description,
            category,
            level,
            duration_minutes,
            is_free,
            price_ngn,
            status
          `,
        )
        .in("id", enrolledCourseIds)
        .eq("status", "published");

    if (courseError) {
      console.error(
        "Failed to load dashboard courses:",
        courseError,
      );
    }

    enrolledCourses = (courseData || []) as Course[];
  }

  const courseMap = new Map<string, Course>();

  enrolledCourses.forEach((course) => {
    courseMap.set(course.id, course);
  });

  const visibleEnrollments = enrollments.filter((enrollment) =>
    courseMap.has(enrollment.course_id),
  );

  const visibleCourseIds = [
    ...new Set(
      visibleEnrollments.map((enrollment) => enrollment.course_id),
    ),
  ];

  let curriculumLessons: CurriculumRow[] = [];

  if (visibleCourseIds.length > 0) {
    const {
      data: curriculumData,
      error: curriculumError,
    } = await supabase
      .from("course_curriculum")
      .select("lesson_id, course_id")
      .in("course_id", visibleCourseIds)
      .eq("is_published", true);

    if (curriculumError) {
      console.error(
        "Failed to load dashboard curriculum:",
        curriculumError,
      );
    }

    curriculumLessons = (curriculumData ||
      []) as CurriculumRow[];
  }

  let completedLessons: LessonProgressRow[] = [];

  if (visibleCourseIds.length > 0) {
    const { data: progressData, error: progressError } =
      await supabase
        .from("lesson_progress")
        .select("lesson_id, course_id, completed")
        .eq("student_id", user.id)
        .in("course_id", visibleCourseIds)
        .eq("completed", true);

    if (progressError) {
      console.error(
        "Failed to load dashboard lesson progress:",
        progressError,
      );
    }

    completedLessons = (progressData ||
      []) as LessonProgressRow[];
  }

  const enrollmentProgressMap = new Map<string, number>();

  visibleEnrollments.forEach((enrollment) => {
    enrollmentProgressMap.set(
      enrollment.id,
      getEnrollmentProgress(
        enrollment,
        curriculumLessons,
        completedLessons,
      ),
    );
  });

  const { data: skillProfileData, error: skillProfileError } =
    await supabase
      .from("learner_skill_profiles")
      .select(
        `
          id,
          student_id,
          skill_id,
          confidence_score,
          skill_level,
          evidence,
          strengths,
          gaps,
          updated_at
        `,
      )
      .eq("student_id", user.id)
      .order("confidence_score", {
        ascending: false,
      });

  if (skillProfileError) {
    console.error(
      "Failed to load dashboard skill profiles:",
      skillProfileError,
    );
  }

  const skillProfiles = (skillProfileData ||
    []) as SkillProfile[];

  const totalCourses = visibleEnrollments.length;

  const completedCourses = visibleEnrollments.filter(
    (enrollment) =>
      enrollmentProgressMap.get(enrollment.id) === 100,
  ).length;

  const inProgressCourses = visibleEnrollments.filter(
    (enrollment) => {
      const progress = enrollmentProgressMap.get(enrollment.id) ?? 0;
      return progress > 0 && progress < 100;
    },
  ).length;

  const strengthCount = skillProfiles.filter((skill) => {
    const score = Number(skill.confidence_score);
    return Number.isFinite(score) && score >= 80;
  }).length;

  const developmentCount = skillProfiles.filter((skill) => {
    const score = Number(skill.confidence_score);
    return Number.isFinite(score) && score < 50;
  }).length;

  const displayName =
    profile?.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "Learner";

  const averageSkillScore =
    skillProfiles.length > 0
      ? Math.round(
          skillProfiles.reduce((total, skill) => {
            const score = Number(skill.confidence_score);
            return total + (
              Number.isFinite(score)
                ? Math.min(100, Math.max(0, score))
                : 0
            );
          }, 0) / skillProfiles.length,
        )
      : 0;

  const hasLearningProfile = skillProfiles.length > 0;

  return (
    <main className="container rn-dashboard-shell rn-dashboard-page">
      <style>{PAGE_STYLES}</style>

      <section className="rn-dashboard-header">
        <div className="rn-dashboard-header-content">
          <div className="rn-eyebrow">RUFFNECK LEARN</div>

          <h1>Learning Dashboard</h1>

          <p className="rn-dashboard-intro">
            Welcome, {displayName}. Follow your learning progress, build
            practical skills and keep track of your professional development.
          </p>
        </div>

        <div className="rn-dashboard-header-actions">
          <Link
            href="/courses"
            className="rn-button rn-button-primary"
          >
            Browse Courses
          </Link>

          <Link
            href="/student/projects"
            className="rn-button rn-button-secondary"
          >
            Projects &amp; Capstones
          </Link>

          <Link
            href="/student/certificates"
            className="rn-button rn-button-secondary"
          >
            Certificates
          </Link>
        </div>
      </section>

      <section
        className="rn-dashboard-stats"
        aria-label="Learning overview"
      >
        <article className="rn-dashboard-stat">
          <span className="rn-dashboard-stat-label">
            Courses enrolled
          </span>

          <strong>{totalCourses}</strong>

          <small>Published courses in your learning list</small>
        </article>

        <article className="rn-dashboard-stat">
          <span className="rn-dashboard-stat-label">
            Courses completed
          </span>

          <strong>{completedCourses}</strong>

          <small>
            {totalCourses > 0
              ? `${Math.round(
                  (completedCourses / totalCourses) * 100,
                )}% of your enrolled courses`
              : "Your completed courses will appear here"}
          </small>
        </article>

        <article className="rn-dashboard-stat">
          <span className="rn-dashboard-stat-label">
            Skill strengths
          </span>

          <strong>{strengthCount}</strong>

          <small>Tracked skills at 80% confidence or higher</small>
        </article>

        <article className="rn-dashboard-stat">
          <span className="rn-dashboard-stat-label">
            Development areas
          </span>

          <strong>{developmentCount}</strong>

          <small>Tracked skills below 50% confidence</small>
        </article>
      </section>

      <section className="rn-dashboard-grid">
        <article className="rn-dashboard-card">
          <div className="rn-dashboard-card-header">
            <div>
              <span className="rn-eyebrow">LEARNER PROFILE</span>
              <h2>{displayName}</h2>
            </div>

            <Link
              href="/student/skills"
              className="rn-text-link"
            >
              View skills →
            </Link>
          </div>

          <div className="rn-profile-summary">
            <div className="rn-profile-score">
              <strong>{averageSkillScore}%</strong>

              <span>Average skill confidence</span>
            </div>

            <div className="rn-profile-details">
              <p>
                <strong>Email:</strong>{" "}
                {profile?.email || user.email || "Not available"}
              </p>

              <p>
                <strong>Role:</strong>{" "}
                {profile?.role || "student"}
              </p>

              <p>
                <strong>Skills tracked:</strong>{" "}
                {skillProfiles.length}
              </p>
            </div>
          </div>

          {!hasLearningProfile && (
            <p className="rn-dashboard-card-text">
              Your skill profile will become more informative as you complete
              course assessments.
            </p>
          )}
        </article>

        <article className="rn-dashboard-card">
          <div className="rn-dashboard-card-header">
            <div>
              <span className="rn-eyebrow">
                {hasLearningProfile ? "KEEP DEVELOPING" : "YOUR NEXT STEP"}
              </span>

              <h2>
                {hasLearningProfile
                  ? "Advance your capabilities"
                  : "Start building your skill profile"}
              </h2>
            </div>
          </div>

          <p className="rn-dashboard-card-text">
            {hasLearningProfile
              ? "Review your measured skills, work on development areas, and build practical experience through relevant courses and capstone projects."
              : "Choose a course and complete its assessment to begin establishing your learning profile. Your recorded assessment results can help identify strengths and development areas."}
          </p>

          <div className="rn-dashboard-inline-actions">
            {hasLearningProfile ? (
              <>
                <Link
                  href="/student/skills"
                  className="rn-button rn-button-primary"
                >
                  View My Skills
                </Link>

                <Link
                  href="/courses"
                  className="rn-button rn-button-secondary"
                >
                  Explore Courses
                </Link>
              </>
            ) : (
              <Link
                href="/courses"
                className="rn-button rn-button-primary"
              >
                Choose a Course →
              </Link>
            )}
          </div>
        </article>
      </section>

      <section className="rn-dashboard-section">
        <div className="rn-dashboard-section-header">
          <div>
            <span className="rn-eyebrow">MY LEARNING</span>

            <h2>My Courses</h2>

            <p>
              Continue where you stopped and monitor your course completion.
              {inProgressCourses > 0
                ? ` You currently have ${inProgressCourses} course${
                    inProgressCourses === 1 ? "" : "s"
                  } in progress.`
                : ""}
            </p>
          </div>

          <Link
            href="/courses"
            className="rn-text-link"
          >
            Browse all courses →
          </Link>
        </div>

        {visibleEnrollments.length === 0 ? (
          <article className="rn-empty-state">
            <h3>Your learning starts here</h3>

            <p>
              You do not currently have an enrollment in a published course.
              Explore the course catalogue to find training relevant to your
              learning goals.
            </p>

            <Link
              href="/courses"
              className="rn-button rn-button-primary"
            >
              Explore Courses →
            </Link>
          </article>
        ) : (
          <div className="rn-course-grid">
            {visibleEnrollments.map((enrollment) => {
              const course = courseMap.get(enrollment.course_id);

              if (!course) {
                return null;
              }

              const progress =
                enrollmentProgressMap.get(enrollment.id) ?? 0;

              const isComplete = progress >= 100;

              return (
                <article
                  key={enrollment.id}
                  className="rn-course-card"
                >
                  <div className="rn-course-card-body">
                    <div className="rn-course-card-meta">
                      <span>{formatLevel(course.level)}</span>

                      {course.category ? (
                        <span>{course.category}</span>
                      ) : null}

                      <span>
                        {course.is_free ? "Free course" : "Premium course"}
                      </span>
                    </div>

                    <h3>{course.title}</h3>

                    <p>
                      {course.short_description ||
                        "Continue learning and build practical skills through this course."}
                    </p>

                    <div className="rn-progress-block">
                      <div className="rn-progress-header">
                        <span>{getProgressLabel(progress)}</span>

                        <strong>{progress}%</strong>
                      </div>

                      <div
                        className="rn-progress-track"
                        role="progressbar"
                        aria-label={`${course.title} completion`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progress}
                      >
                        <div
                          className={`rn-progress-fill${
                            isComplete ? " is-complete" : ""
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="rn-course-card-footer">
                      <span>
                        {course.duration_minutes &&
                        course.duration_minutes > 0
                          ? `${course.duration_minutes} min`
                          : "Self-paced"}
                      </span>

                      <Link
                        href={`/courses/${course.slug}`}
                        className="rn-button rn-button-primary"
                      >
                        {isComplete
                          ? "Review Course →"
                          : progress > 0
                            ? "Continue Learning →"
                            : "Start Course →"}
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="rn-dashboard-section">
        <LearningIntelligence />
      </section>

      <section className="rn-dashboard-section">
        <div className="rn-dashboard-section-header">
          <div>
            <span className="rn-eyebrow">QUICK ACTIONS</span>

            <h2>Continue Learning</h2>

            <p>
              Open the main tools for your learning and professional
              development.
            </p>
          </div>
        </div>

        <div className="rn-dashboard-actions-grid">
          <Link
            href="/courses"
            className="rn-dashboard-action"
          >
            <strong>Browse Courses →</strong>

            <span>
              Explore AI, data, digital marketing, productivity and other
              practical courses.
            </span>
          </Link>

          <Link
            href="/student/assessment"
            className="rn-dashboard-action"
          >
            <strong>Course Assessments →</strong>

            <span>
              Open available course assessments, measure your knowledge and
              review your results.
            </span>
          </Link>

          <Link
            href="/student/projects"
            className="rn-dashboard-action"
          >
            <strong>Projects &amp; Capstones →</strong>

            <span>
              Work on practical projects, submit your work and track reviews.
            </span>
          </Link>

          <Link
            href="/student/certificates"
            className="rn-dashboard-action"
          >
            <strong>Certificates →</strong>

            <span>
              Access your issued credentials and check certificate eligibility.
            </span>
          </Link>

          <Link
            href="/student/skills"
            className="rn-dashboard-action"
          >
            <strong>My Skills →</strong>

            <span>
              Review skill confidence scores, strengths and development areas.
            </span>
          </Link>

          <Link
            href="/student/skill-passport"
            className="rn-dashboard-action"
          >
            <strong>Skill Passport →</strong>

            <span>
              Review your practical evidence and documented skill development.
            </span>
          </Link>
        </div>
      </section>

      <footer className="rn-dashboard-footer-note">
        <p>
          RuffNeck Learn supports practical professional development through
          structured courses, assessments, projects and skill tracking.
        </p>

        <p>
          Last skill profile update:{" "}
          {formatDate(skillProfiles[0]?.updated_at ?? null)}
        </p>
      </footer>
    </main>
  );
}