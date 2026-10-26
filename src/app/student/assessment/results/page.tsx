import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type AssessmentAttempt = {
  id: string;
  course_id: string;
  score: number | null;
  total_points: number | null;
  earned_points: number | null;
  total_questions: number | null;
  time_spent_seconds: number | null;
  completed_at: string | null;
  created_at: string;
};

type Course = {
  id: string;
  title: string;
  slug: string;
};

function calculatePercentage(attempt: AssessmentAttempt): number {
  if (
    typeof attempt.earned_points === "number" &&
    Number.isFinite(attempt.earned_points) &&
    typeof attempt.total_points === "number" &&
    Number.isFinite(attempt.total_points) &&
    attempt.total_points > 0
  ) {
    return Math.max(
      0,
      Math.min(
        100,
        Math.round(
          (attempt.earned_points / attempt.total_points) * 100
        )
      )
    );
  }

  // Legacy records store score as a percentage.
  if (
    typeof attempt.score === "number" &&
    Number.isFinite(attempt.score) &&
    attempt.score >= 0 &&
    attempt.score <= 100
  ) {
    return Math.round(attempt.score);
  }

  // Compatibility fallback for a raw score count.
  if (
    typeof attempt.score === "number" &&
    typeof attempt.total_questions === "number" &&
    Number.isFinite(attempt.score) &&
    Number.isFinite(attempt.total_questions) &&
    attempt.total_questions > 0
  ) {
    return Math.max(
      0,
      Math.min(
        100,
        Math.round(
          (attempt.score / attempt.total_questions) * 100
        )
      )
    );
  }

  return 0;
}

function formatDate(value: string | null) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDuration(seconds: number | null) {
  if (
    typeof seconds !== "number" ||
    !Number.isFinite(seconds) ||
    seconds <= 0
  ) {
    return "Not recorded";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) {
    return `${remainingSeconds}s`;
  }

  return `${minutes}m ${remainingSeconds}s`;
}

function formatPoints(attempt: AssessmentAttempt) {
  if (
    typeof attempt.earned_points !== "number" ||
    !Number.isFinite(attempt.earned_points) ||
    typeof attempt.total_points !== "number" ||
    !Number.isFinite(attempt.total_points) ||
    attempt.total_points <= 0
  ) {
    return "Not recorded";
  }

  return `${attempt.earned_points}/${attempt.total_points}`;
}

export default async function AssessmentResultsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/student/assessment/results");
  }

  const {
    data: attemptsData,
    error: attemptsError,
  } = await supabase
    .from("assessment_attempts")
    .select(`
      id,
      course_id,
      score,
      total_points,
      earned_points,
      total_questions,
      time_spent_seconds,
      completed_at,
      created_at
    `)
    .eq("student_id", user.id)
    .not("completed_at", "is", null)
    .order("created_at", { ascending: false });

  if (attemptsError) {
    throw new Error(attemptsError.message);
  }

  const attempts =
    (attemptsData as unknown as AssessmentAttempt[] | null) ?? [];

  const courseIds = Array.from(
    new Set(attempts.map((attempt) => attempt.course_id))
  );

  let courses: Course[] = [];

  if (courseIds.length > 0) {
    const {
      data: coursesData,
      error: coursesError,
    } = await supabase
      .from("courses")
      .select("id, title, slug")
      .in("id", courseIds);

    if (coursesError) {
      throw new Error(coursesError.message);
    }

    courses =
      (coursesData as unknown as Course[] | null) ?? [];
  }

  const courseMap = new Map(
    courses.map((course) => [course.id, course])
  );

  const percentages = attempts.map(calculatePercentage);

  const averageScore =
    percentages.length > 0
      ? Math.round(
          percentages.reduce((sum, value) => sum + value, 0) /
            percentages.length
        )
      : 0;

  const bestScore =
    percentages.length > 0 ? Math.max(...percentages) : 0;

  const passedAttempts = percentages.filter(
    (score) => score >= 70
  ).length;

  return (
    <main className="rn-social-results">
      <div className="rn-social-shell">

        {/* Page heading */}
        <header className="rn-social-page-header">
          <div className="rn-social-heading-copy">
            <div className="rn-social-eyebrow">
              <span className="rn-social-eyebrow-dot" />
              LEARNING RECORDS
            </div>

            <h1>Assessment Results</h1>

            <p>
              Track your progress, review your results and see how
              your skills are developing.
            </p>
          </div>

          <Link
            href="/student/assessment"
            className="rn-social-primary-button"
          >
            <span aria-hidden="true">＋</span>
            Take an Assessment
          </Link>
        </header>

        {/* Summary cards */}
        <section
          className="rn-social-stat-grid"
          aria-label="Assessment statistics"
        >
          <article className="rn-social-stat-card">
            <div className="rn-social-stat-top">
              <span className="rn-social-stat-icon rn-icon-blue">
                A
              </span>
              <span className="rn-social-stat-caption">
                LEARNING ACTIVITY
              </span>
            </div>

            <div className="rn-social-stat-number">
              {attempts.length}
            </div>

            <div className="rn-social-stat-title">
              Assessments completed
            </div>

            <div className="rn-social-stat-footer">
              Your completed attempts
            </div>
          </article>

          <article className="rn-social-stat-card">
            <div className="rn-social-stat-top">
              <span className="rn-social-stat-icon rn-icon-cyan">
                %
              </span>
              <span className="rn-social-stat-caption">
                OVERALL PERFORMANCE
              </span>
            </div>

            <div className="rn-social-stat-number">
              {averageScore}%
            </div>

            <div className="rn-social-stat-title">
              Average score
            </div>

            <div className="rn-social-progress-track">
              <div
                className="rn-social-progress-fill"
                style={{ width: `${averageScore}%` }}
              />
            </div>
          </article>

          <article className="rn-social-stat-card">
            <div className="rn-social-stat-top">
              <span className="rn-social-stat-icon rn-icon-green">
                ★
              </span>
              <span className="rn-social-stat-caption">
                PERSONAL BEST
              </span>
            </div>

            <div className="rn-social-stat-number">
              {bestScore}%
            </div>

            <div className="rn-social-stat-title">
              Highest score
            </div>

            <div className="rn-social-stat-footer">
              Your best recorded result
            </div>
          </article>

          <article className="rn-social-stat-card">
            <div className="rn-social-stat-top">
              <span className="rn-social-stat-icon rn-icon-purple">
                ✓
              </span>
              <span className="rn-social-stat-caption">
                ACHIEVEMENT
              </span>
            </div>

            <div className="rn-social-stat-number">
              {passedAttempts}
            </div>

            <div className="rn-social-stat-title">
              Assessments passed
            </div>

            <div className="rn-social-stat-footer">
              Scores of 70% or above
            </div>
          </article>
        </section>

        {/* Main dashboard */}
        <div className="rn-social-dashboard">

          {/* Assessment history */}
          <section className="rn-social-feed">
            <div className="rn-social-section-header">
              <div>
                <h2>Assessment History</h2>
                <p>
                  Your results, from newest to oldest.
                </p>
              </div>

              <span className="rn-social-count-badge">
                {attempts.length}{" "}
                {attempts.length === 1 ? "result" : "results"}
              </span>
            </div>

            {attempts.length === 0 ? (
              <div className="rn-social-empty-card">
                <div className="rn-social-empty-icon">
                  ✓
                </div>

                <h3>No assessment results yet</h3>

                <p>
                  Complete your first course assessment to start
                  tracking your learning progress here.
                </p>

                <Link
                  href="/student/assessment"
                  className="rn-social-primary-button"
                >
                  Explore Assessments
                </Link>
              </div>
            ) : (
              <div className="rn-social-attempt-list">
                {attempts.map((attempt) => {
                  const course = courseMap.get(attempt.course_id);
                  const percentage = calculatePercentage(attempt);
                  const passed = percentage >= 70;

                  return (
                    <article
                      key={attempt.id}
                      className="rn-social-attempt-card"
                    >
                      <div className="rn-social-attempt-heading">
                        <div className="rn-social-course-avatar">
                          {course?.title
                            ?.trim()
                            .charAt(0)
                            .toUpperCase() || "A"}
                        </div>

                        <div className="rn-social-attempt-title">
                          <div className="rn-social-attempt-category">
                            COURSE ASSESSMENT
                          </div>

                          <h3>
                            {course?.title || "Course Assessment"}
                          </h3>

                          <p>
                            Completed{" "}
                            {formatDate(attempt.completed_at)}
                          </p>
                        </div>

                        <div className="rn-social-score-block">
                          <div
                            className={`rn-social-score ${
                              passed
                                ? "rn-score-passed"
                                : "rn-score-failed"
                            }`}
                          >
                            {percentage}%
                          </div>

                          <span
                            className={`rn-social-status ${
                              passed
                                ? "rn-status-passed"
                                : "rn-status-failed"
                            }`}
                          >
                            <span aria-hidden="true">
                              {passed ? "✓" : "!"}
                            </span>
                            {passed ? "Passed" : "Not passed"}
                          </span>
                        </div>
                      </div>

                      <div className="rn-social-divider" />

                      <div className="rn-social-attempt-metrics">
                        <div className="rn-social-metric">
                          <span className="rn-social-metric-icon">
                            #
                          </span>

                          <div>
                            <span className="rn-social-metric-label">
                              Questions
                            </span>

                            <strong>
                              {attempt.total_questions ?? "—"}
                            </strong>
                          </div>
                        </div>

                        <div className="rn-social-metric">
                          <span className="rn-social-metric-icon">
                            ✓
                          </span>

                          <div>
                            <span className="rn-social-metric-label">
                              Points
                            </span>

                            <strong>
                              {formatPoints(attempt)}
                            </strong>
                          </div>
                        </div>

                        <div className="rn-social-metric">
                          <span className="rn-social-metric-icon">
                            ◷
                          </span>

                          <div>
                            <span className="rn-social-metric-label">
                              Time spent
                            </span>

                            <strong>
                              {formatDuration(
                                attempt.time_spent_seconds
                              )}
                            </strong>
                          </div>
                        </div>
                      </div>

                      <div className="rn-social-attempt-footer">
                        <span className="rn-social-footer-note">
                          {passed
                            ? "You reached the passing threshold."
                            : "Review your answers to improve."}
                        </span>

                        <Link
                          href={`/student/assessment/results/${encodeURIComponent(
                            attempt.id
                          )}`}
                          className="rn-social-view-button"
                        >
                          View Result
                          <span aria-hidden="true">→</span>
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* Sidebar */}
          <aside className="rn-social-sidebar">

            <section className="rn-social-sidebar-card">
              <div className="rn-social-sidebar-heading">
                <span className="rn-social-sidebar-heading-icon">
                  ↗
                </span>

                <h2>Your Progress</h2>
              </div>

              <p className="rn-social-sidebar-description">
                Your current performance across completed assessments.
              </p>

              <div className="rn-social-overview-row">
                <span>Average score</span>
                <strong>{averageScore}%</strong>
              </div>

              <div className="rn-social-progress-track">
                <div
                  className="rn-social-progress-fill"
                  style={{ width: `${averageScore}%` }}
                />
              </div>

              <div className="rn-social-overview-row rn-overview-spaced">
                <span>Passing rate</span>

                <strong>
                  {attempts.length > 0
                    ? Math.round(
                        (passedAttempts / attempts.length) * 100
                      )
                    : 0}
                  %
                </strong>
              </div>

              <div className="rn-social-progress-track rn-progress-green">
                <div
                  className="rn-social-progress-fill"
                  style={{
                    width: `${
                      attempts.length > 0
                        ? (passedAttempts / attempts.length) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>

              <p className="rn-social-sidebar-footnote">
                The passing threshold is 70% per assessment.
              </p>
            </section>

            <section className="rn-social-sidebar-card">
              <div className="rn-social-sidebar-heading">
                <span className="rn-social-sidebar-heading-icon">
                  ⇧
                </span>

                <h2>Keep Learning</h2>
              </div>

              <p className="rn-social-sidebar-description">
                Continue building practical skills through your courses
                and assessments.
              </p>

              <Link
                href="/student/assessment"
                className="rn-social-sidebar-link"
              >
                <span className="rn-social-link-icon">
                  ✓
                </span>

                <span>
                  <strong>Take an assessment</strong>
                  <small>Test what you have learned</small>
                </span>

                <span className="rn-social-link-arrow">→</span>
              </Link>

              <Link
                href="/student/courses"
                className="rn-social-sidebar-link"
              >
                <span className="rn-social-link-icon rn-link-icon-cyan">
                  ▤
                </span>

                <span>
                  <strong>My Learning</strong>
                  <small>Continue your courses</small>
                </span>

                <span className="rn-social-link-arrow">→</span>
              </Link>

              <Link
                href="/student/skill-passport"
                className="rn-social-sidebar-link"
              >
                <span className="rn-social-link-icon rn-link-icon-purple">
                  ★
                </span>

                <span>
                  <strong>Skill Passport</strong>
                  <small>Explore your skills record</small>
                </span>

                <span className="rn-social-link-arrow">→</span>
              </Link>
            </section>

            <section className="rn-social-sidebar-note">
              <div className="rn-social-note-mark">
                RN
              </div>

              <div>
                <strong>RuffNeck Learn</strong>

                <p>
                  Practical AI and digital skills for Nigerian
                  professionals.
                </p>
              </div>
            </section>

          </aside>
        </div>

        <footer className="rn-social-footer">
          <span>RuffNeck Learn</span>
          <span>Assessment Records</span>
          <span>Practical AI &amp; Digital Skills</span>
        </footer>
      </div>

      <style>{`
        .rn-social-results,
        .rn-social-results * {
          box-sizing: border-box;
        }

        .rn-social-results {
          --rn-blue: #0a66c2;
          --rn-blue-hover: #004182;
          --rn-text: #191919;
          --rn-secondary: #666a70;
          --rn-muted: #737780;
          --rn-border: #dfe3e8;
          --rn-background: #f3f5f8;
          --rn-green: #16834a;
          --rn-card-radius: 12px;

          width: 100%;
          min-height: 100vh;
          padding: 28px 22px 36px;
          background: var(--rn-background);
          color: var(--rn-text);
          font-family: Arial, Helvetica, sans-serif;
        }

        .rn-social-shell {
          width: 100%;
          max-width: 1180px;
          margin: 0 auto;
        }

        .rn-social-page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 22px;
          padding: 26px 28px;
          margin-bottom: 22px;
          background: #ffffff;
          border: 1px solid var(--rn-border);
          border-radius: var(--rn-card-radius);
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.035);
        }

        .rn-social-heading-copy {
          flex: 1;
          min-width: 0;
        }

        .rn-social-eyebrow {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 9px;
          color: var(--rn-blue);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.1px;
        }

        .rn-social-eyebrow-dot {
          width: 8px;
          height: 8px;
          flex: 0 0 8px;
          border-radius: 50%;
          background: var(--rn-blue);
        }

        .rn-social-heading-copy h1 {
          margin: 0;
          color: var(--rn-text);
          font-size: clamp(25px, 3vw, 33px);
          font-weight: 750;
          letter-spacing: -0.8px;
          line-height: 1.2;
          overflow-wrap: anywhere;
        }

        .rn-social-heading-copy > p {
          margin: 9px 0 0;
          max-width: 650px;
          color: var(--rn-secondary);
          font-size: 14px;
          line-height: 1.65;
        }

        .rn-social-primary-button {
          display: inline-flex;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 42px;
          padding: 10px 18px;
          border: 1px solid var(--rn-blue);
          border-radius: 24px;
          background: var(--rn-blue);
          color: #ffffff;
          font-size: 13px;
          font-weight: 700;
          text-align: center;
          text-decoration: none;
          transition:
            background 160ms ease,
            border-color 160ms ease,
            box-shadow 160ms ease;
        }

        .rn-social-primary-button:hover {
          border-color: var(--rn-blue-hover);
          background: var(--rn-blue-hover);
          box-shadow: 0 2px 5px rgba(10, 102, 194, 0.18);
        }

        .rn-social-primary-button:focus-visible,
        .rn-social-view-button:focus-visible,
        .rn-social-sidebar-link:focus-visible {
          outline: 3px solid rgba(10, 102, 194, 0.35);
          outline-offset: 3px;
        }

        .rn-social-stat-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .rn-social-stat-card {
          min-width: 0;
          padding: 21px 20px 19px;
          overflow: hidden;
          background: #ffffff;
          border: 1px solid var(--rn-border);
          border-radius: var(--rn-card-radius);
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.025);
          transition:
            box-shadow 160ms ease,
            transform 160ms ease;
        }

        .rn-social-stat-card:hover {
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.055);
          transform: translateY(-1px);
        }

        .rn-social-stat-top {
          display: flex;
          align-items: center;
          gap: 9px;
          min-width: 0;
        }

        .rn-social-stat-icon {
          width: 34px;
          height: 34px;
          display: inline-flex;
          flex: 0 0 34px;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          font-size: 16px;
          font-weight: 800;
        }

        .rn-icon-blue {
          background: #e8f2fc;
          color: #0a66c2;
        }

        .rn-icon-cyan {
          background: #e3f7fb;
          color: #087f98;
        }

        .rn-icon-green {
          background: #e6f5ec;
          color: #16834a;
        }

        .rn-icon-purple {
          background: #f0eafd;
          color: #7550b3;
        }

        .rn-social-stat-caption {
          color: var(--rn-muted);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.65px;
          line-height: 1.4;
          overflow-wrap: anywhere;
        }

        .rn-social-stat-number {
          margin-top: 19px;
          color: var(--rn-text);
          font-size: clamp(29px, 3vw, 36px);
          font-weight: 750;
          letter-spacing: -1px;
          line-height: 1.1;
        }

        .rn-social-stat-title {
          margin-top: 6px;
          color: #41454b;
          font-size: 13px;
          font-weight: 700;
          line-height: 1.5;
        }

        .rn-social-stat-footer {
          min-height: 18px;
          margin-top: 12px;
          color: var(--rn-muted);
          font-size: 11px;
          line-height: 1.5;
        }

        .rn-social-progress-track {
          width: 100%;
          height: 6px;
          margin-top: 15px;
          overflow: hidden;
          border-radius: 20px;
          background: #e8ebef;
        }

        .rn-social-progress-fill {
          height: 100%;
          max-width: 100%;
          border-radius: inherit;
          background: var(--rn-blue);
          transition: width 250ms ease;
        }

        .rn-progress-green .rn-social-progress-fill {
          background: #16834a;
        }

        .rn-social-dashboard {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 300px;
          align-items: start;
          gap: 22px;
        }

        .rn-social-feed {
          min-width: 0;
        }

        .rn-social-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 14px;
        }

        .rn-social-section-header h2 {
          margin: 0;
          color: var(--rn-text);
          font-size: 20px;
          font-weight: 750;
          letter-spacing: -0.35px;
        }

        .rn-social-section-header p {
          margin: 5px 0 0;
          color: var(--rn-secondary);
          font-size: 12px;
          line-height: 1.5;
        }

        .rn-social-count-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 27px;
          padding: 5px 10px;
          border: 1px solid #d8e7f7;
          border-radius: 18px;
          background: #edf5fd;
          color: #0a579e;
          font-size: 11px;
          font-weight: 700;
        }

        .rn-social-attempt-list {
          display: grid;
          gap: 14px;
        }

        .rn-social-attempt-card {
          min-width: 0;
          padding: 23px;
          background: #ffffff;
          border: 1px solid var(--rn-border);
          border-radius: var(--rn-card-radius);
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.025);
          transition: box-shadow 160ms ease;
        }

        .rn-social-attempt-card:hover {
          box-shadow: 0 3px 12px rgba(0, 0, 0, 0.045);
        }

        .rn-social-attempt-heading {
          display: flex;
          align-items: flex-start;
          gap: 13px;
          min-width: 0;
        }

        .rn-social-course-avatar {
          width: 43px;
          height: 43px;
          display: flex;
          flex: 0 0 43px;
          align-items: center;
          justify-content: center;
          border: 1px solid #c8def5;
          border-radius: 50%;
          background: #e8f2fc;
          color: #0a66c2;
          font-size: 19px;
          font-weight: 800;
        }

        .rn-social-attempt-title {
          flex: 1;
          min-width: 0;
          padding-top: 2px;
        }

        .rn-social-attempt-category {
          margin-bottom: 5px;
          color: var(--rn-muted);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.8px;
        }

        .rn-social-attempt-title h3 {
          margin: 0;
          color: var(--rn-text);
          font-size: 16px;
          font-weight: 750;
          line-height: 1.45;
          overflow-wrap: anywhere;
        }

        .rn-social-attempt-title p {
          margin: 6px 0 0;
          color: var(--rn-muted);
          font-size: 11px;
          line-height: 1.6;
          overflow-wrap: anywhere;
        }

        .rn-social-score-block {
          display: flex;
          flex: 0 0 auto;
          flex-direction: column;
          align-items: flex-end;
          gap: 6px;
          text-align: right;
        }

        .rn-social-score {
          font-size: clamp(26px, 3vw, 31px);
          font-weight: 800;
          letter-spacing: -0.8px;
          line-height: 1.15;
          white-space: nowrap;
        }

        .rn-score-passed {
          color: #16834a;
        }

        .rn-score-failed {
          color: #c63737;
        }

        .rn-social-status {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          padding: 5px 9px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 750;
          white-space: nowrap;
        }

        .rn-status-passed {
          background: #e8f6ed;
          color: #176b3c;
        }

        .rn-status-failed {
          background: #fceaea;
          color: #a52d2d;
        }

        .rn-social-divider {
          height: 1px;
          margin: 19px 0;
          background: #e9ecef;
        }

        .rn-social-attempt-metrics {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 15px;
        }

        .rn-social-metric {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          min-width: 0;
        }

        .rn-social-metric-icon {
          display: inline-flex;
          width: 29px;
          height: 29px;
          flex: 0 0 29px;
          align-items: center;
          justify-content: center;
          border: 1px solid #e5e9ee;
          border-radius: 8px;
          background: #f6f8fa;
          color: #536273;
          font-size: 14px;
          font-weight: 700;
        }

        .rn-social-metric > div {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }

        .rn-social-metric-label {
          color: var(--rn-muted);
          font-size: 10px;
          line-height: 1.4;
        }

        .rn-social-metric strong {
          color: #30343b;
          font-size: 12px;
          font-weight: 750;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .rn-social-attempt-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 20px;
          padding-top: 15px;
          border-top: 1px solid #edf0f2;
        }

        .rn-social-footer-note {
          color: var(--rn-muted);
          font-size: 11px;
          line-height: 1.5;
        }

        .rn-social-view-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          min-height: 35px;
          padding: 8px 15px;
          border: 1px solid var(--rn-blue);
          border-radius: 20px;
          background: #ffffff;
          color: var(--rn-blue);
          font-size: 12px;
          font-weight: 750;
          text-decoration: none;
          transition:
            background 150ms ease,
            color 150ms ease;
        }

        .rn-social-view-button:hover {
          background: #e8f2fc;
          color: var(--rn-blue-hover);
        }

        .rn-social-sidebar {
          display: grid;
          gap: 16px;
          min-width: 0;
        }

        .rn-social-sidebar-card {
          padding: 20px;
          background: #ffffff;
          border: 1px solid var(--rn-border);
          border-radius: var(--rn-card-radius);
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.025);
        }

        .rn-social-sidebar-heading {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .rn-social-sidebar-heading-icon {
          display: inline-flex;
          width: 32px;
          height: 32px;
          flex: 0 0 32px;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: #e8f2fc;
          color: var(--rn-blue);
          font-size: 17px;
          font-weight: 800;
        }

        .rn-social-sidebar-heading h2 {
          margin: 0;
          color: var(--rn-text);
          font-size: 15px;
          font-weight: 750;
        }

        .rn-social-sidebar-description {
          margin: 13px 0 18px;
          color: var(--rn-secondary);
          font-size: 12px;
          line-height: 1.7;
        }

        .rn-social-overview-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          color: #52565d;
          font-size: 12px;
        }

        .rn-social-overview-row strong {
          color: var(--rn-text);
          font-size: 13px;
          font-weight: 800;
        }

        .rn-overview-spaced {
          margin-top: 20px;
        }

        .rn-social-sidebar-card > .rn-social-progress-track {
          margin-top: 9px;
        }

        .rn-social-sidebar-footnote {
          margin: 17px 0 0;
          padding-top: 13px;
          border-top: 1px solid #edf0f2;
          color: var(--rn-muted);
          font-size: 11px;
          line-height: 1.6;
        }

        .rn-social-sidebar-link {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          padding: 12px 0;
          border-top: 1px solid #edf0f2;
          color: inherit;
          text-decoration: none;
          transition: background 150ms ease;
        }

        .rn-social-sidebar-link:first-of-type {
          border-top: none;
        }

        .rn-social-sidebar-link:hover strong {
          color: var(--rn-blue);
        }

        .rn-social-link-icon {
          display: inline-flex;
          width: 34px;
          height: 34px;
          flex: 0 0 34px;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: #e8f2fc;
          color: var(--rn-blue);
          font-size: 16px;
          font-weight: 800;
        }

        .rn-link-icon-cyan {
          background: #e3f7fb;
          color: #087f98;
        }

        .rn-link-icon-purple {
          background: #f0eafd;
          color: #7550b3;
        }

        .rn-social-sidebar-link > span:nth-child(2) {
          display: flex;
          flex: 1;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }

        .rn-social-sidebar-link strong {
          color: #31353b;
          font-size: 12px;
          font-weight: 750;
          line-height: 1.4;
          overflow-wrap: anywhere;
        }

        .rn-social-sidebar-link small {
          color: var(--rn-muted);
          font-size: 10px;
          line-height: 1.5;
        }

        .rn-social-link-arrow {
          flex: 0 0 auto;
          color: #8a9099;
          font-size: 17px;
          transition:
            color 150ms ease,
            transform 150ms ease;
        }

        .rn-social-sidebar-link:hover .rn-social-link-arrow {
          color: var(--rn-blue);
          transform: translateX(2px);
        }

        .rn-social-sidebar-note {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 18px;
          border: 1px solid #dce8f5;
          border-radius: var(--rn-card-radius);
          background: #eaf3fc;
        }

        .rn-social-note-mark {
          display: flex;
          width: 37px;
          height: 37px;
          flex: 0 0 37px;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: var(--rn-blue);
          color: #ffffff;
          font-size: 11px;
          font-weight: 850;
          letter-spacing: -0.2px;
        }

        .rn-social-sidebar-note strong {
          display: block;
          color: #174c7d;
          font-size: 12px;
          font-weight: 800;
        }

        .rn-social-sidebar-note p {
          margin: 6px 0 0;
          color: #49677f;
          font-size: 11px;
          line-height: 1.65;
        }

        .rn-social-empty-card {
          padding: 42px 22px;
          border: 1px solid var(--rn-border);
          border-radius: var(--rn-card-radius);
          background: #ffffff;
          text-align: center;
        }

        .rn-social-empty-icon {
          display: flex;
          width: 52px;
          height: 52px;
          align-items: center;
          justify-content: center;
          margin: 0 auto 15px;
          border-radius: 50%;
          background: #e8f2fc;
          color: var(--rn-blue);
          font-size: 24px;
          font-weight: 800;
        }

        .rn-social-empty-card h3 {
          margin: 0;
          color: var(--rn-text);
          font-size: 18px;
        }

        .rn-social-empty-card p {
          max-width: 430px;
          margin: 10px auto 22px;
          color: var(--rn-secondary);
          font-size: 13px;
          line-height: 1.7;
        }

        .rn-social-footer {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 8px 20px;
          padding-top: 24px;
          color: #7a8088;
          font-size: 10px;
          line-height: 1.6;
          text-align: center;
        }

        @media (max-width: 1050px) {
          .rn-social-stat-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .rn-social-dashboard {
            grid-template-columns: minmax(0, 1fr) 270px;
            gap: 16px;
          }

          .rn-social-stat-number {
            font-size: 32px;
          }

          .rn-social-attempt-card {
            padding: 19px;
          }
        }

        @media (max-width: 800px) {
          .rn-social-results {
            padding: 20px 16px 30px;
          }

          .rn-social-dashboard {
            grid-template-columns: minmax(0, 1fr);
          }

          .rn-social-sidebar {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            align-items: start;
          }

          .rn-social-sidebar-note {
            grid-column: 1 / -1;
          }

          .rn-social-sidebar-card {
            padding: 17px;
          }
        }

        @media (max-width: 520px) {
          .rn-social-results {
            padding: 13px 10px 25px;
          }

          .rn-social-page-header {
            align-items: flex-start;
            padding: 21px 17px;
            gap: 17px;
            margin-bottom: 14px;
          }

          .rn-social-heading-copy h1 {
            font-size: 25px;
            letter-spacing: -0.6px;
          }

          .rn-social-heading-copy > p {
            font-size: 12px;
          }

          .rn-social-page-header > .rn-social-primary-button {
            width: 100%;
          }

          .rn-social-stat-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
            margin-bottom: 23px;
          }

          .rn-social-stat-card {
            padding: 14px 12px;
            border-radius: 10px;
          }

          .rn-social-stat-top {
            align-items: flex-start;
            gap: 7px;
          }

          .rn-social-stat-icon {
            width: 29px;
            height: 29px;
            flex-basis: 29px;
            border-radius: 8px;
            font-size: 14px;
          }

          .rn-social-stat-caption {
            padding-top: 2px;
            font-size: 8px;
            letter-spacing: 0.3px;
          }

          .rn-social-stat-number {
            margin-top: 15px;
            font-size: 29px;
          }

          .rn-social-stat-title {
            font-size: 11px;
          }

          .rn-social-stat-footer {
            font-size: 10px;
          }

          .rn-social-section-header {
            align-items: flex-start;
            margin-bottom: 12px;
          }

          .rn-social-section-header h2 {
            font-size: 19px;
          }

          .rn-social-count-badge {
            font-size: 10px;
          }

          .rn-social-attempt-list {
            gap: 11px;
          }

          .rn-social-attempt-card {
            padding: 15px 13px;
            border-radius: 10px;
          }

          .rn-social-attempt-heading {
            display: grid;
            grid-template-columns: 36px minmax(0, 1fr);
            gap: 10px;
          }

          .rn-social-course-avatar {
            width: 36px;
            height: 36px;
            flex-basis: 36px;
            font-size: 16px;
          }

          .rn-social-attempt-title h3 {
            font-size: 13px;
          }

          .rn-social-attempt-title p {
            font-size: 10px;
          }

          .rn-social-score-block {
            grid-column: 2;
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            margin-top: 3px;
          }

          .rn-social-score {
            font-size: 27px;
          }

          .rn-social-divider {
            margin: 15px 0;
          }

          .rn-social-attempt-metrics {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 8px;
          }

          .rn-social-metric {
            flex-direction: column;
            gap: 7px;
          }

          .rn-social-metric-icon {
            width: 27px;
            height: 27px;
            flex-basis: 27px;
          }

          .rn-social-metric-label {
            font-size: 9px;
          }

          .rn-social-metric strong {
            font-size: 11px;
          }

          .rn-social-attempt-footer {
            align-items: stretch;
            flex-direction: column;
            gap: 11px;
          }

          .rn-social-footer-note {
            font-size: 10px;
          }

          .rn-social-view-button {
            width: 100%;
            min-height: 39px;
          }

          .rn-social-sidebar {
            grid-template-columns: minmax(0, 1fr);
            gap: 12px;
          }

          .rn-social-sidebar-note {
            grid-column: auto;
          }

          .rn-social-sidebar-card {
            padding: 18px;
          }

          .rn-social-empty-card {
            padding: 31px 17px;
          }

          .rn-social-footer {
            gap: 5px 12px;
            font-size: 9px;
          }
        }

        @media (max-width: 350px) {
          .rn-social-stat-grid {
            grid-template-columns: minmax(0, 1fr);
          }

          .rn-social-stat-card {
            padding: 17px;
          }

          .rn-social-stat-top {
            align-items: center;
          }

          .rn-social-attempt-metrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .rn-social-metric:last-child {
            grid-column: 1 / -1;
            flex-direction: row;
            align-items: center;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .rn-social-results *,
          .rn-social-results *::before,
          .rn-social-results *::after {
            scroll-behavior: auto !important;
            transition-duration: 0.01ms !important;
            animation-duration: 0.01ms !important;
          }
        }
      `}</style>
    </main>
  );
}