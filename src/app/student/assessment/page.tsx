import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AssessmentClient from "./AssessmentClient";

type Course = {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  category: string | null;
  level: "beginner" | "intermediate" | "advanced";
};

type Enrollment = {
  course_id: string;
  progress_percent: number;
  enrollment_status: "active" | "completed" | "cancelled";
};

type AssessmentQuestionRow = {
  id: string;
  course_id: string;
  skill_id: string;
  question: string | null;
  question_text: string | null;
  question_type: string | null;
  options: unknown;
  correct_answer: string;
  explanation: string | null;
  difficulty: string | null;
  sort_order: number;
};

type AssessmentQuestion = {
  id: string;
  question: string;
  options: string[];
  correctAnswer?: string;
  explanation?: string | null;
  difficulty: string;
};

function normalizeOptions(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String);
  }

  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed.map(String);
      }
    } catch {
      // Continue to support newline- and comma-separated options.
    }

    return value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).map(
      String
    );
  }

  return [];
}

function formatLevel(level: string): string {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

function getProgress(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, value));
}

const assessmentHubStyles = `
  .rn-hub-social,
  .rn-hub-social * {
    box-sizing: border-box;
  }

  .rn-hub-social {
    --hub-blue: #0a66c2;
    --hub-blue-dark: #004182;
    --hub-text: #191919;
    --hub-muted: #666a70;
    --hub-border: #dfe3e8;
    --hub-background: #f3f5f8;
    --hub-green: #16834a;

    width: 100%;
    min-height: 65vh;
    padding: 28px 20px 38px;
    background: var(--hub-background);
    color: var(--hub-text);
    font-family: Arial, Helvetica, sans-serif;
  }

  .rn-hub-social .rn-hub-container {
    width: 100%;
    max-width: 1180px;
    margin: 0 auto;
  }

  .rn-hub-social .rn-hub-header {
    padding: 27px 28px;
    margin-bottom: 20px;
    border: 1px solid var(--hub-border);
    border-radius: 12px;
    background: #fff;
    box-shadow: 0 1px 2px rgb(0 0 0 / 3%);
  }

  .rn-hub-social .rn-hub-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 20px;
  }

  .rn-hub-social .rn-hub-heading-copy {
    flex: 1;
    min-width: 0;
  }

  .rn-hub-social .rn-hub-eyebrow {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    color: var(--hub-blue);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 1px;
  }

  .rn-hub-social .rn-hub-eyebrow-dot {
    width: 8px;
    height: 8px;
    flex: 0 0 8px;
    border-radius: 50%;
    background: var(--hub-blue);
  }

  .rn-hub-social .rn-hub-header h1 {
    margin: 0;
    color: var(--hub-text);
    font-size: clamp(25px, 3vw, 33px);
    font-weight: 750;
    letter-spacing: -0.7px;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }

  .rn-hub-social .rn-hub-header p {
    max-width: 680px;
    margin: 10px 0 0;
    color: var(--hub-muted);
    font-size: 13px;
    line-height: 1.75;
  }

  .rn-hub-social .rn-hub-primary,
  .rn-hub-social .rn-hub-secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 41px;
    padding: 10px 17px;
    border: 1px solid transparent;
    border-radius: 23px;
    font-size: 12px;
    font-weight: 750;
    line-height: 1.4;
    text-align: center;
    text-decoration: none;
    transition:
      background 150ms ease,
      border-color 150ms ease,
      color 150ms ease;
  }

  .rn-hub-social .rn-hub-primary {
    border-color: var(--hub-blue);
    background: var(--hub-blue);
    color: #fff;
  }

  .rn-hub-social .rn-hub-primary:hover {
    border-color: var(--hub-blue-dark);
    background: var(--hub-blue-dark);
    color: #fff;
  }

  .rn-hub-social .rn-hub-secondary {
    border-color: #b7c0ca;
    background: #fff;
    color: #343a40;
  }

  .rn-hub-social .rn-hub-secondary:hover {
    border-color: var(--hub-blue);
    background: #edf5fd;
    color: var(--hub-blue);
  }

  .rn-hub-social .rn-hub-primary:focus-visible,
  .rn-hub-social .rn-hub-secondary:focus-visible {
    outline: 3px solid rgb(10 102 194 / 30%);
    outline-offset: 3px;
  }

  .rn-hub-social .rn-hub-section-heading {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    margin: 25px 0 15px;
  }

  .rn-hub-social .rn-hub-section-heading h2 {
    margin: 0;
    color: var(--hub-text);
    font-size: 20px;
    font-weight: 750;
    letter-spacing: -0.3px;
  }

  .rn-hub-social .rn-hub-section-heading p {
    margin: 5px 0 0;
    color: var(--hub-muted);
    font-size: 12px;
    line-height: 1.6;
  }

  .rn-hub-social .rn-hub-course-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 28px;
    padding: 5px 10px;
    border: 1px solid #d8e7f7;
    border-radius: 18px;
    background: #edf5fd;
    color: #0a579e;
    font-size: 10px;
    font-weight: 750;
  }

  .rn-hub-social .rn-assessment-course-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-items: stretch;
    gap: 17px;
  }

  .rn-hub-social .rn-assessment-course-card {
    display: flex;
    flex-direction: column;
    min-width: 0;
    padding: 22px;
    border: 1px solid var(--hub-border);
    border-radius: 12px;
    background: #fff;
    box-shadow: 0 1px 2px rgb(0 0 0 / 3%);
    transition:
      border-color 150ms ease,
      box-shadow 150ms ease,
      transform 150ms ease;
  }

  .rn-hub-social .rn-assessment-course-card:hover {
    border-color: #cad7e4;
    box-shadow: 0 4px 14px rgb(0 0 0 / 5%);
    transform: translateY(-1px);
  }

  .rn-hub-social .rn-hub-course-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    min-width: 0;
  }

  .rn-hub-social .rn-hub-course-category {
    min-width: 0;
    color: var(--hub-blue);
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.55px;
    line-height: 1.6;
    overflow-wrap: anywhere;
  }

  .rn-hub-social .rn-assessment-level {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    padding: 5px 8px;
    border: 1px solid #e1e6eb;
    border-radius: 16px;
    background: #f7f9fb;
    color: #59636f;
    font-size: 9px;
    font-weight: 750;
  }

  .rn-hub-social .rn-hub-course-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 43px;
    height: 43px;
    margin: 18px 0 14px;
    border: 1px solid #d1e3f6;
    border-radius: 11px;
    background: #edf5fd;
    color: var(--hub-blue);
    font-size: 17px;
    font-weight: 800;
  }

  .rn-hub-social .rn-assessment-course-card h2 {
    margin: 0;
    color: var(--hub-text);
    font-size: 17px;
    font-weight: 750;
    line-height: 1.5;
    letter-spacing: -0.2px;
    overflow-wrap: anywhere;
  }

  .rn-hub-social .rn-assessment-course-card > p {
    flex: 1;
    margin: 10px 0 18px;
    color: var(--hub-muted);
    font-size: 12px;
    line-height: 1.8;
    overflow-wrap: anywhere;
  }

  .rn-hub-social .rn-hub-course-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 10px;
    color: #4c5560;
    font-size: 11px;
    font-weight: 700;
  }

  .rn-hub-social .rn-hub-progress-track {
    width: 100%;
    height: 6px;
    margin-bottom: 17px;
    overflow: hidden;
    border-radius: 20px;
    background: #e9edf2;
  }

  .rn-hub-social .rn-hub-progress-fill {
    height: 100%;
    max-width: 100%;
    border-radius: inherit;
    background: var(--hub-blue);
  }

  .rn-hub-social .rn-hub-progress-complete {
    background: var(--hub-green);
  }

  .rn-hub-social .rn-hub-course-action {
    display: flex;
    flex-direction: column;
    gap: 9px;
    margin-top: auto;
  }

  .rn-hub-social .rn-hub-course-action .rn-hub-primary,
  .rn-hub-social .rn-hub-course-action .rn-hub-secondary {
    width: 100%;
    min-height: 42px;
  }

  .rn-hub-social .rn-hub-locked-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 42px;
    padding: 10px 14px;
    border: 1px solid #d7dce2;
    border-radius: 22px;
    background: #f1f3f5;
    color: #737780;
    font: inherit;
    font-size: 12px;
    font-weight: 750;
    cursor: not-allowed;
  }

  .rn-hub-social .rn-hub-lock-note {
    margin: 0 !important;
    color: var(--hub-muted);
    font-size: 11px !important;
    line-height: 1.65 !important;
  }

  .rn-hub-social .rn-hub-footer-actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 24px;
    padding-top: 19px;
    border-top: 1px solid #dfe3e8;
  }

  .rn-hub-social .rn-hub-empty-state {
    max-width: 760px;
    margin: 10px auto 0;
    padding: clamp(24px, 5vw, 40px);
    border: 1px solid var(--hub-border);
    border-radius: 12px;
    background: #fff;
    text-align: center;
    box-shadow: 0 1px 2px rgb(0 0 0 / 3%);
  }

  .rn-hub-social .rn-hub-empty-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    margin: 0 auto 17px;
    border-radius: 50%;
    background: #edf5fd;
    color: var(--hub-blue);
    font-size: 22px;
    font-weight: 800;
  }

  .rn-hub-social .rn-hub-empty-state h1,
  .rn-hub-social .rn-hub-empty-state h2 {
    margin: 0;
    color: var(--hub-text);
    font-size: clamp(23px, 3vw, 29px);
    font-weight: 750;
    line-height: 1.4;
    letter-spacing: -0.4px;
  }

  .rn-hub-social .rn-hub-empty-state > p {
    max-width: 560px;
    margin: 10px auto 21px;
    color: var(--hub-muted);
    font-size: 13px;
    line-height: 1.8;
  }

  .rn-hub-social .rn-hub-empty-actions {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 20px;
  }

  .rn-hub-social .rn-hub-locked-progress {
    max-width: 440px;
    margin: 20px auto 0;
    padding: 16px;
    border: 1px solid var(--hub-border);
    border-radius: 10px;
    background: #f8fafc;
    text-align: left;
  }

  .rn-hub-social .rn-hub-locked-progress-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
    color: #343a40;
    font-size: 12px;
    font-weight: 750;
  }

  .rn-hub-social .rn-hub-locked-progress > p {
    margin: 7px 0 0;
    color: var(--hub-muted);
    font-size: 11px;
    line-height: 1.6;
  }

  .rn-hub-social .rn-hub-assessment-header {
    padding: 23px 25px;
    margin-bottom: 18px;
    border: 1px solid var(--hub-border);
    border-radius: 12px;
    background: #fff;
    box-shadow: 0 1px 2px rgb(0 0 0 / 3%);
  }

  .rn-hub-social .rn-hub-assessment-header h1 {
    margin: 0;
    color: var(--hub-text);
    font-size: clamp(24px, 3vw, 31px);
    font-weight: 750;
    letter-spacing: -0.6px;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }

  .rn-hub-social .rn-hub-assessment-header > p {
    max-width: 670px;
    margin: 9px 0 0;
    color: var(--hub-muted);
    font-size: 12px;
    line-height: 1.75;
  }

  .rn-hub-social .rn-hub-assessment-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 16px;
  }

  .rn-hub-social .rn-hub-assessment-summary span {
    display: inline-flex;
    align-items: center;
    padding: 6px 10px;
    border: 1px solid #d8e7f7;
    border-radius: 18px;
    background: #edf5fd;
    color: #0a579e;
    font-size: 10px;
    font-weight: 750;
  }

  .rn-hub-social .rn-hub-assessment-navigation {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 15px;
  }

  @media (max-width: 1000px) {
    .rn-hub-social .rn-assessment-course-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 700px) {
    .rn-hub-social {
      padding: 19px 14px 30px;
    }

    .rn-hub-social .rn-hub-header {
      padding: 22px 19px;
    }

    .rn-hub-social .rn-assessment-course-grid {
      gap: 12px;
    }

    .rn-hub-social .rn-assessment-course-card {
      padding: 17px;
    }

    .rn-hub-social .rn-hub-course-top {
      flex-wrap: wrap;
    }

    .rn-hub-social .rn-assessment-course-card h2 {
      font-size: 15px;
    }

    .rn-hub-social .rn-hub-footer-actions {
      gap: 9px;
    }
  }

  @media (max-width: 520px) {
    .rn-hub-social {
      padding: 12px 10px 25px;
    }

    .rn-hub-social .rn-hub-header {
      padding: 19px 16px;
      margin-bottom: 14px;
      border-radius: 10px;
    }

    .rn-hub-social .rn-hub-header h1 {
      font-size: 25px;
    }

    .rn-hub-social .rn-hub-header p {
      font-size: 12px;
    }

    .rn-hub-social .rn-hub-header-row {
      gap: 14px;
    }

    .rn-hub-social .rn-hub-header-row > .rn-hub-secondary {
      width: 100%;
    }

    .rn-hub-social .rn-hub-section-heading {
      margin-top: 21px;
    }

    .rn-hub-social .rn-hub-section-heading h2 {
      font-size: 18px;
    }

    .rn-hub-social .rn-assessment-course-grid {
      grid-template-columns: minmax(0, 1fr);
      gap: 11px;
    }

    .rn-hub-social .rn-assessment-course-card {
      padding: 17px;
      border-radius: 10px;
    }

    .rn-hub-social .rn-hub-course-top {
      align-items: center;
      flex-wrap: nowrap;
    }

    .rn-hub-social .rn-hub-course-category {
      font-size: 9px;
    }

    .rn-hub-social .rn-hub-course-icon {
      width: 38px;
      height: 38px;
      margin: 14px 0 11px;
    }

    .rn-hub-social .rn-assessment-course-card h2 {
      font-size: 16px;
    }

    .rn-hub-social .rn-assessment-course-card > p {
      margin-top: 8px;
      font-size: 12px;
    }

    .rn-hub-social .rn-hub-footer-actions {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 9px;
    }

    .rn-hub-social .rn-hub-footer-actions > a {
      width: 100%;
    }

    .rn-hub-social .rn-hub-empty-state {
      padding: 25px 16px;
    }

    .rn-hub-social .rn-hub-empty-actions {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
    }

    .rn-hub-social .rn-hub-empty-actions > a {
      width: 100%;
    }

    .rn-hub-social .rn-hub-assessment-header {
      padding: 19px 15px;
    }

    .rn-hub-social .rn-hub-assessment-navigation {
      align-items: stretch;
    }

    .rn-hub-social .rn-hub-assessment-navigation > a {
      width: 100%;
    }
  }

  @media (max-width: 350px) {
    .rn-hub-social .rn-hub-header h1 {
      font-size: 22px;
    }

    .rn-hub-social .rn-hub-course-top {
      align-items: flex-start;
      flex-wrap: wrap;
    }

    .rn-hub-social .rn-hub-assessment-summary {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
    }

    .rn-hub-social .rn-hub-assessment-summary span {
      justify-content: center;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .rn-hub-social *,
    .rn-hub-social *::before,
    .rn-hub-social *::after {
      scroll-behavior: auto !important;
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
`;

export default async function AssessmentPage({
  searchParams,
}: {
  searchParams: Promise<{
    course?: string;
  }>;
}) {
  const { course: courseSlug } = await searchParams;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/student/assessment");
  }

  const { data: enrollmentData } = await supabase
    .from("enrollments")
    .select(
      "course_id, progress_percent, enrollment_status"
    )
    .eq("student_id", user.id)
    .in("enrollment_status", ["active", "completed"]);

  const enrollments =
    (enrollmentData as unknown as Enrollment[] | null) ?? [];

  const enrolledCourseIds = enrollments.map(
    (item) => item.course_id
  );

  if (enrolledCourseIds.length === 0) {
    return (
      <main className="rn-hub-social">
        <div className="rn-hub-container">
          <section className="rn-hub-empty-state">
            <div className="rn-hub-empty-icon" aria-hidden="true">
              A
            </div>

            <div className="rn-hub-eyebrow">
              <span className="rn-hub-eyebrow-dot" />
              LEARNING ASSESSMENTS
            </div>

            <h1>Start your learning journey</h1>

            <p>
              Enroll in a course to access its assessment, evaluate
              your progress and build your professional skills
              profile.
            </p>

            <div className="rn-hub-empty-actions">
              <Link
                href="/courses"
                className="rn-hub-primary"
              >
                Explore Courses
                <span aria-hidden="true">→</span>
              </Link>

              <Link
                href="/student/dashboard"
                className="rn-hub-secondary"
              >
                Return to Dashboard
              </Link>
            </div>
          </section>
        </div>

        <style>{assessmentHubStyles}</style>
      </main>
    );
  }

  /*
   * No course selected:
   * display the student's assessment catalogue.
   */
  if (!courseSlug) {
    const { data: courseData } = await supabase
      .from("courses")
      .select(
        [
          "id",
          "title",
          "slug",
          "short_description",
          "category",
          "level",
        ].join(", ")
      )
      .in("id", enrolledCourseIds)
      .eq("status", "published")
      .order("title");

    const courses =
      (courseData as unknown as Course[] | null) ?? [];

    return (
      <main className="rn-hub-social">
        <div className="rn-hub-container">
          <section className="rn-hub-header">
            <div className="rn-hub-header-row">
              <div className="rn-hub-heading-copy">
                <div className="rn-hub-eyebrow">
                  <span className="rn-hub-eyebrow-dot" />
                  LEARNING ASSESSMENTS
                </div>

                <h1>Choose your course assessment</h1>

                <p>
                  Assess your knowledge, identify your strengths
                  and find areas to develop. Each assessment is
                  aligned with its course curriculum.
                </p>
              </div>

              <Link
                href="/student/assessment/results"
                className="rn-hub-secondary"
              >
                View Results
              </Link>
            </div>
          </section>

          <div className="rn-hub-section-heading">
            <div>
              <h2>Your enrolled courses</h2>
              <p>
                Complete a course to unlock its final assessment.
              </p>
            </div>

            <span className="rn-hub-course-count">
              {courses.length}{" "}
              {courses.length === 1 ? "course" : "courses"}
            </span>
          </div>

          {courses.length === 0 ? (
            <section className="rn-hub-empty-state">
              <div className="rn-hub-empty-icon" aria-hidden="true">
                ▤
              </div>

              <h2>No published course assessments</h2>

              <p>
                Your current enrollments do not have any published
                courses available for assessment.
              </p>

              <div className="rn-hub-empty-actions">
                <Link
                  href="/student/courses"
                  className="rn-hub-primary"
                >
                  My Learning
                </Link>

                <Link
                  href="/courses"
                  className="rn-hub-secondary"
                >
                  Browse Courses
                </Link>
              </div>
            </section>
          ) : (
            <section className="rn-assessment-course-grid">
              {courses.map((course) => {
                const enrollment = enrollments.find(
                  (item) => item.course_id === course.id
                );

                const progress = getProgress(
                  enrollment?.progress_percent
                );

                const assessmentUnlocked = progress >= 100;

                return (
                  <article
                    key={course.id}
                    className="rn-assessment-course-card"
                  >
                    <div className="rn-hub-course-top">
                      <span className="rn-hub-course-category">
                        {course.category ||
                          "PROFESSIONAL LEARNING"}
                      </span>

                      <span className="rn-assessment-level">
                        {formatLevel(course.level)}
                      </span>
                    </div>

                    <div className="rn-hub-course-icon" aria-hidden="true">
                      {course.title.trim().charAt(0).toUpperCase() || "A"}
                    </div>

                    <h2>{course.title}</h2>

                    <p>
                      {course.short_description ||
                        "Assess the knowledge and practical skills covered in this course."}
                    </p>

                    <div className="rn-hub-course-meta">
                      <span>Course progress</span>
                      <span>{Math.round(progress)}%</span>
                    </div>

                    <div
                      className="rn-hub-progress-track"
                      role="progressbar"
                      aria-label={`${course.title} course progress`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(progress)}
                    >
                      <div
                        className={`rn-hub-progress-fill ${
                          assessmentUnlocked
                            ? "rn-hub-progress-complete"
                            : ""
                        }`}
                        style={{
                          width: `${progress}%`,
                        }}
                      />
                    </div>

                    <div className="rn-hub-course-action">
                      {assessmentUnlocked ? (
                        <Link
                          href={`/student/assessment?course=${encodeURIComponent(
                            course.slug
                          )}`}
                          className="rn-hub-primary"
                        >
                          Start Assessment
                          <span aria-hidden="true">→</span>
                        </Link>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="rn-hub-locked-button"
                            disabled
                            aria-disabled="true"
                          >
                            Complete Course to Unlock
                          </button>

                          <p className="rn-hub-lock-note">
                            Finish all course lessons to unlock
                            this assessment.
                          </p>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </section>
          )}

          <div className="rn-hub-footer-actions">
            <Link
              href="/student/dashboard"
              className="rn-hub-secondary"
            >
              Back to Dashboard
            </Link>

            <Link
              href="/student/skills"
              className="rn-hub-secondary"
            >
              View Skills
            </Link>

            <Link
              href="/student/assessment/results"
              className="rn-hub-secondary"
            >
              Assessment Results
            </Link>
          </div>
        </div>

        <style>{assessmentHubStyles}</style>
      </main>
    );
  }

  /*
   * Selected course assessment.
   */
  const { data: selectedCourseData } = await supabase
    .from("courses")
    .select(
      [
        "id",
        "title",
        "slug",
        "short_description",
        "category",
        "level",
      ].join(", ")
    )
    .eq("slug", courseSlug)
    .eq("status", "published")
    .maybeSingle();

  const selectedCourse =
    selectedCourseData as unknown as Course | null;

  if (!selectedCourse) {
    redirect("/student/assessment");
  }

  const enrollment = enrollments.find(
    (item) => item.course_id === selectedCourse.id
  );

  if (!enrollment) {
    redirect(`/courses/${selectedCourse.slug}`);
  }

  const progress = getProgress(enrollment.progress_percent);

  /*
   * Keep the existing full-course-completion requirement.
   */
  if (progress < 100) {
    return (
      <main className="rn-hub-social">
        <div className="rn-hub-container">
          <section className="rn-hub-empty-state">
            <div className="rn-hub-empty-icon" aria-hidden="true">
              🔒
            </div>

            <div className="rn-hub-eyebrow">
              <span className="rn-hub-eyebrow-dot" />
              ASSESSMENT LOCKED
            </div>

            <h1>Complete the course first</h1>

            <p>
              The final assessment for{" "}
              <strong>{selectedCourse.title}</strong> becomes
              available after all published lessons are completed.
            </p>

            <div className="rn-hub-locked-progress">
              <div className="rn-hub-locked-progress-heading">
                <span>Course progress</span>
                <span>{Math.round(progress)}%</span>
              </div>

              <div className="rn-hub-progress-track">
                <div
                  className="rn-hub-progress-fill"
                  style={{
                    width: `${progress}%`,
                  }}
                />
              </div>

              <p>
                Continue learning to reach 100% and unlock the
                assessment.
              </p>
            </div>

            <div className="rn-hub-empty-actions">
              <Link
                href={`/courses/${selectedCourse.slug}`}
                className="rn-hub-primary"
              >
                Continue Course
                <span aria-hidden="true">→</span>
              </Link>

              <Link
                href="/student/assessment"
                className="rn-hub-secondary"
              >
                All Assessments
              </Link>

              <Link
                href="/student/dashboard"
                className="rn-hub-secondary"
              >
                Dashboard
              </Link>
            </div>
          </section>
        </div>

        <style>{assessmentHubStyles}</style>
      </main>
    );
  }

  const { data: questionData } = await supabase
    .from("assessment_questions")
    .select(
      [
        "id",
        "course_id",
        "skill_id",
        "question",
        "question_text",
        "question_type",
        "options",
        "correct_answer",
        "explanation",
        "difficulty",
        "sort_order",
      ].join(", ")
    )
    .eq("course_id", selectedCourse.id)
    .order("sort_order");

  const rows =
    (questionData as unknown as AssessmentQuestionRow[] | null) ??
    [];

  const questions: AssessmentQuestion[] = rows.map((row) => ({
    id: row.id,
    question:
      row.question_text ||
      row.question ||
      "Assessment question",
    options: normalizeOptions(row.options),
    explanation: row.explanation,
    difficulty: row.difficulty || "intermediate",
  }));

  if (questions.length === 0) {
    return (
      <main className="rn-hub-social">
        <div className="rn-hub-container">
          <section className="rn-hub-empty-state">
            <div className="rn-hub-empty-icon" aria-hidden="true">
              i
            </div>

            <div className="rn-hub-eyebrow">
              <span className="rn-hub-eyebrow-dot" />
              {selectedCourse.category ||
                "COURSE ASSESSMENT"}
            </div>

            <h1>Assessment is being prepared</h1>

            <p>
              The course curriculum is available, but its assessment
              bank has not yet been populated.
            </p>

            <div className="rn-hub-empty-actions">
              <Link
                href={`/courses/${selectedCourse.slug}`}
                className="rn-hub-primary"
              >
                View Course
              </Link>

              <Link
                href="/student/assessment/results"
                className="rn-hub-secondary"
              >
                Assessment Results
              </Link>
            </div>
          </section>
        </div>

        <style>{assessmentHubStyles}</style>
      </main>
    );
  }

  return (
    <main className="rn-assessment-shell rn-hub-social">
      <div className="rn-hub-container">
        <div className="rn-hub-assessment-navigation">
          <Link
            href="/student/assessment"
            className="rn-hub-secondary"
          >
            <span aria-hidden="true">←</span>
            All Assessments
          </Link>

          <Link
            href="/student/assessment/results"
            className="rn-hub-secondary"
          >
            Assessment Results
          </Link>
        </div>

        <header className="rn-hub-assessment-header">
          <div className="rn-hub-eyebrow">
            <span className="rn-hub-eyebrow-dot" />
            {selectedCourse.category || "COURSE ASSESSMENT"}
          </div>

          <h1>{selectedCourse.title}</h1>

          <p>
            Test your understanding of the course material and
            generate an updated skills profile.
          </p>

          <div className="rn-hub-assessment-summary">
            <span>{questions.length} Questions</span>
            <span>{formatLevel(selectedCourse.level)}</span>
            <span>Course Progress: {Math.round(progress)}%</span>
          </div>
        </header>

        <AssessmentClient
          courseId={selectedCourse.id}
          courseTitle={selectedCourse.title}
          questions={questions}
        />
      </div>

      <style>{assessmentHubStyles}</style>
    </main>
  );
}