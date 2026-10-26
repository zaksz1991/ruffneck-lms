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

  // The score column stores a percentage for legacy attempts.
  // Do not divide a stored percentage by total_questions again.
  if (
    typeof attempt.score === "number" &&
    Number.isFinite(attempt.score) &&
    attempt.score >= 0 &&
    attempt.score <= 100
  ) {
    return Math.round(attempt.score);
  }

  // Compatibility fallback for records where score is a raw count.
  if (
    typeof attempt.score === "number" &&
    Number.isFinite(attempt.score) &&
    typeof attempt.total_questions === "number" &&
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
  // Legacy records with zero have no usable recorded duration.
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

  const { data: attemptsData, error: attemptsError } = await supabase
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
    const { data: coursesData, error: coursesError } = await supabase
      .from("courses")
      .select("id, title, slug")
      .in("id", courseIds);

    if (coursesError) {
      throw new Error(coursesError.message);
    }

    courses = (coursesData as unknown as Course[] | null) ?? [];
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
    <main className="container rn-assessment-results-page">
      <section className="rn-page-header rn-results-header">
        <div>
          <p className="rn-results-eyebrow">
            Learning Records
          </p>

          <h1 className="rn-results-title">
            Assessment Results
          </h1>

          <p className="rn-results-intro">
            Review your completed assessments, scores and learning
            performance.
          </p>
        </div>
      </section>

      <section className="rn-results-stat-grid">
        <div className="rn-card rn-results-stat-card">
          <div className="rn-results-stat-label">
            Assessments
          </div>

          <div className="rn-results-stat-value">
            {attempts.length}
          </div>

          <div className="rn-results-stat-note">
            Completed attempts
          </div>
        </div>

        <div className="rn-card rn-results-stat-card">
          <div className="rn-results-stat-label">
            Average Score
          </div>

          <div className="rn-results-stat-value">
            {averageScore}%
          </div>

          <div className="rn-results-stat-note">
            Across completed attempts
          </div>
        </div>

        <div className="rn-card rn-results-stat-card">
          <div className="rn-results-stat-label">
            Best Score
          </div>

          <div className="rn-results-stat-value">
            {bestScore}%
          </div>

          <div className="rn-results-stat-note">
            Highest recorded result
          </div>
        </div>

        <div className="rn-card rn-results-stat-card">
          <div className="rn-results-stat-label">
            Passed
          </div>

          <div className="rn-results-stat-value">
            {passedAttempts}
          </div>

          <div className="rn-results-stat-note">
            Results at 70% or above
          </div>
        </div>
      </section>

      {attempts.length === 0 ? (
        <section className="rn-card rn-results-empty">
          <h2>No assessment results yet</h2>

          <p>
            Complete a course assessment and your result will
            appear here.
          </p>

          <Link
            href="/student/assessment"
            className="rn-button rn-button-primary"
          >
            Go to Assessments
          </Link>
        </section>
      ) : (
        <section>
          <div className="rn-results-history-header">
            <h2>Assessment History</h2>

            <Link
              href="/student/assessment"
              className="rn-button rn-button-secondary"
            >
              Take an Assessment
            </Link>
          </div>

          <div className="rn-results-attempt-list">
            {attempts.map((attempt) => {
              const course = courseMap.get(attempt.course_id);
              const percentage = calculatePercentage(attempt);
              const passed = percentage >= 70;

              return (
                <article
                  key={attempt.id}
                  className="rn-card rn-results-attempt"
                >
                  <div className="rn-results-attempt-heading">
                    <div className="rn-results-course">
                      <div className="rn-results-attempt-label">
                        Assessment
                      </div>

                      <h3>
                        {course?.title || "Course Assessment"}
                      </h3>

                      <div className="rn-results-completed-date">
                        Completed {formatDate(attempt.completed_at)}
                      </div>
                    </div>

                    <div className="rn-results-score">
                      <div className="rn-results-score-value">
                        {percentage}%
                      </div>

                      <div
                        className={
                          passed
                            ? "rn-assessment-result-pass"
                            : "rn-assessment-result-fail"
                        }
                      >
                        {passed ? "Passed" : "Not passed"}
                      </div>
                    </div>
                  </div>

                  <div className="rn-results-attempt-details">
                    <div>
                      <div className="rn-results-detail-label">
                        Questions
                      </div>

                      <div className="rn-results-detail-value">
                        {attempt.total_questions ?? "—"}
                      </div>
                    </div>

                    <div>
                      <div className="rn-results-detail-label">
                        Points
                      </div>

                      <div className="rn-results-detail-value">
                        {formatPoints(attempt)}
                      </div>
                    </div>

                    <div>
                      <div className="rn-results-detail-label">
                        Time
                      </div>

                      <div className="rn-results-detail-value">
                        {formatDuration(attempt.time_spent_seconds)}
                      </div>
                    </div>

                    <div className="rn-results-view-link">
                      <Link
                        href={`/student/assessment/results/${encodeURIComponent(
                          attempt.id
                        )}`}
                        className="rn-button rn-button-secondary"
                      >
                        View Result
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <style>{`
        .rn-assessment-results-page {
          min-width: 0;
          max-width: 100%;
        }

        .rn-results-header {
          margin-bottom: 24px;
        }

        .rn-results-eyebrow {
          margin: 0 0 6px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: var(--cyan);
        }

        .rn-results-title {
          margin: 0;
          overflow-wrap: anywhere;
        }

        .rn-results-intro {
          margin-top: 8px;
          margin-bottom: 0;
          color: var(--muted);
          line-height: 1.6;
        }

        .rn-results-stat-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px;
          margin-bottom: 28px;
        }

        .rn-results-stat-card {
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .rn-results-stat-label,
        .rn-results-attempt-label,
        .rn-results-detail-label {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: var(--muted);
        }

        .rn-results-stat-value {
          margin-top: 8px;
          font-size: clamp(26px, 5vw, 32px);
          font-weight: 800;
          line-height: 1.15;
          overflow-wrap: anywhere;
        }

        .rn-results-stat-note {
          margin-top: 4px;
          font-size: 13px;
          line-height: 1.5;
          color: var(--muted);
        }

        .rn-results-empty {
          padding: 32px;
          text-align: center;
        }

        .rn-results-empty h2 {
          margin-top: 0;
        }

        .rn-results-empty p {
          max-width: 620px;
          margin: 0 auto 20px;
          color: var(--muted);
          line-height: 1.7;
        }

        .rn-results-history-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
          margin-bottom: 16px;
        }

        .rn-results-history-header h2 {
          margin: 0;
        }

        .rn-results-attempt-list {
          display: grid;
          gap: 16px;
        }

        .rn-results-attempt {
          min-width: 0;
          padding: 22px;
        }

        .rn-results-attempt-heading {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 16px;
          min-width: 0;
        }

        .rn-results-course {
          flex: 1 1 220px;
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .rn-results-course h3 {
          margin: 6px 0 8px;
          overflow-wrap: anywhere;
        }

        .rn-results-completed-date {
          font-size: 13px;
          line-height: 1.5;
          color: var(--muted);
        }

        .rn-results-score {
          flex: 0 1 auto;
          min-width: 0;
          text-align: right;
        }

        .rn-results-score-value {
          font-size: clamp(24px, 6vw, 30px);
          font-weight: 800;
          line-height: 1.15;
          overflow-wrap: anywhere;
        }

        .rn-assessment-result-pass,
        .rn-assessment-result-fail {
          display: inline-flex;
          justify-content: center;
          margin-top: 7px;
          padding: 4px 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }

        .rn-assessment-result-pass {
          color: #166534;
          background: #dcfce7;
        }

        .rn-assessment-result-fail {
          color: #991b1b;
          background: #fee2e2;
        }

        .rn-results-attempt-details {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 12px;
          margin-top: 20px;
          padding-top: 18px;
          border-top: 1px solid var(--border);
        }

        .rn-results-detail-label {
          font-size: 11px;
        }

        .rn-results-detail-value {
          margin-top: 4px;
          font-weight: 700;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .rn-results-view-link {
          display: flex;
          align-items: flex-end;
          justify-content: flex-start;
        }

        @media (max-width: 600px) {
          .rn-results-stat-grid {
            grid-template-columns: minmax(0, 1fr);
          }

          .rn-results-attempt {
            padding: 16px;
          }

          .rn-results-score {
            text-align: left;
          }

          .rn-results-attempt-details {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .rn-results-view-link {
            grid-column: 1 / -1;
          }

          .rn-results-view-link .rn-button {
            width: 100%;
            justify-content: center;
          }

          .rn-results-empty {
            padding: 22px 16px;
          }
        }

        @media (max-width: 360px) {
          .rn-results-attempt-details {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      `}</style>
    </main>
  );
}