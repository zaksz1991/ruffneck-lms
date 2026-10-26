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

/**
 * New attempts use earned_points / total_points.
 * Legacy attempts store score as a percentage.
 * Never divide a stored percentage by total_questions.
 */
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

  if (
    typeof attempt.score === "number" &&
    Number.isFinite(attempt.score)
  ) {
    // Legacy score values such as 100 and 92 are percentages.
    if (attempt.score >= 0 && attempt.score <= 100) {
      return Math.round(attempt.score);
    }

    // Fallback for scores stored as raw question counts.
    if (
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
  }

  return 0;
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

  const { data: attemptsData, error: attemptsError } =
    await supabase
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
    const { data: coursesData, error: coursesError } =
      await supabase
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
    <main className="container rn-assessment-results-page">
      <section
        className="rn-page-header"
        style={{ marginBottom: 24 }}
      >
        <div>
          <p
            style={{
              margin: "0 0 6px",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              color: "var(--cyan)",
            }}
          >
            Learning Records
          </p>

          <h1 style={{ margin: 0 }}>
            Assessment Results
          </h1>

          <p
            style={{
              marginTop: 8,
              marginBottom: 0,
              color: "var(--muted)",
              lineHeight: 1.6,
            }}
          >
            Review your completed assessments, scores and learning
            performance.
          </p>
        </div>
      </section>

      <section
        className="rn-assessment-summary-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 28,
        }}
      >
        <div className="rn-card">
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.8,
              color: "var(--muted)",
            }}
          >
            Assessments
          </div>

          <div
            style={{
              marginTop: 8,
              fontSize: 32,
              fontWeight: 800,
            }}
          >
            {attempts.length}
          </div>

          <div
            style={{
              marginTop: 4,
              fontSize: 13,
              color: "var(--muted)",
            }}
          >
            Completed attempts
          </div>
        </div>

        <div className="rn-card">
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.8,
              color: "var(--muted)",
            }}
          >
            Average Score
          </div>

          <div
            style={{
              marginTop: 8,
              fontSize: 32,
              fontWeight: 800,
            }}
          >
            {averageScore}%
          </div>

          <div
            style={{
              marginTop: 4,
              fontSize: 13,
              color: "var(--muted)",
            }}
          >
            Across completed attempts
          </div>
        </div>

        <div className="rn-card">
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.8,
              color: "var(--muted)",
            }}
          >
            Best Score
          </div>

          <div
            style={{
              marginTop: 8,
              fontSize: 32,
              fontWeight: 800,
            }}
          >
            {bestScore}%
          </div>

          <div
            style={{
              marginTop: 4,
              fontSize: 13,
              color: "var(--muted)",
            }}
          >
            Highest recorded result
          </div>
        </div>

        <div className="rn-card">
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.8,
              color: "var(--muted)",
            }}
          >
            Passed
          </div>

          <div
            style={{
              marginTop: 8,
              fontSize: 32,
              fontWeight: 800,
            }}
          >
            {passedAttempts}
          </div>

          <div
            style={{
              marginTop: 4,
              fontSize: 13,
              color: "var(--muted)",
            }}
          >
            Results at 70% or above
          </div>
        </div>
      </section>

      {attempts.length === 0 ? (
        <section
          className="rn-card"
          style={{
            padding: 32,
            textAlign: "center",
          }}
        >
          <h2 style={{ marginTop: 0 }}>
            No assessment results yet
          </h2>

          <p
            style={{
              color: "var(--muted)",
              lineHeight: 1.7,
              maxWidth: 620,
              margin: "0 auto 20px",
            }}
          >
            Complete a course assessment and your result will appear
            here.
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
          <div
            className="rn-assessment-history-header"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
              marginBottom: 16,
            }}
          >
            <h2 style={{ margin: 0 }}>
              Assessment History
            </h2>

            <Link
              href="/student/assessment"
              className="rn-button rn-button-secondary"
            >
              Take an Assessment
            </Link>
          </div>

          <div style={{ display: "grid", gap: 16 }}>
            {attempts.map((attempt) => {
              const course = courseMap.get(attempt.course_id);
              const percentage = calculatePercentage(attempt);
              const passed = percentage >= 70;

              return (
                <article
                  key={attempt.id}
                  className="rn-card rn-assessment-history-card"
                  style={{ padding: 22, minWidth: 0 }}
                >
                  <div
                    className="rn-assessment-history-heading"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 20,
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        minWidth: 0,
                        flex: 1,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          letterSpacing: 0.7,
                          textTransform: "uppercase",
                          color: "var(--muted)",
                          marginBottom: 6,
                        }}
                      >
                        Assessment
                      </div>

                      <h3
                        style={{
                          margin: "0 0 8px",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {course?.title || "Course Assessment"}
                      </h3>

                      <div
                        style={{
                          fontSize: 13,
                          lineHeight: 1.5,
                          color: "var(--muted)",
                        }}
                      >
                        Completed {formatDate(attempt.completed_at)}
                      </div>
                    </div>

                    <div
                      className="rn-assessment-history-score"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        flexShrink: 0,
                      }}
                    >
                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            fontSize: "clamp(24px, 5vw, 30px)",
                            fontWeight: 800,
                            lineHeight: 1.15,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {percentage}%
                        </div>

                        <div
                          className={
                            passed
                              ? "rn-assessment-result-pass"
                              : "rn-assessment-result-fail"
                          }
                          style={{
                            display: "inline-flex",
                            marginTop: 7,
                            padding: "4px 9px",
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {passed ? "Passed" : "Not passed"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    className="rn-assessment-history-details"
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(150px, 1fr))",
                      gap: 12,
                      marginTop: 20,
                      paddingTop: 18,
                      borderTop: "1px solid var(--border)",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          color: "var(--muted)",
                        }}
                      >
                        Questions
                      </div>

                      <div
                        style={{
                          marginTop: 4,
                          fontWeight: 700,
                        }}
                      >
                        {attempt.total_questions ?? "—"}
                      </div>
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          color: "var(--muted)",
                        }}
                      >
                        Points
                      </div>

                      <div
                        style={{
                          marginTop: 4,
                          fontWeight: 700,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {formatPoints(attempt)}
                      </div>
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          color: "var(--muted)",
                        }}
                      >
                        Time
                      </div>

                      <div
                        style={{
                          marginTop: 4,
                          fontWeight: 700,
                        }}
                      >
                        {formatDuration(attempt.time_spent_seconds)}
                      </div>
                    </div>

                    <div
                      className="rn-assessment-history-view"
                      style={{
                        display: "flex",
                        alignItems: "flex-end",
                        justifyContent: "flex-start",
                      }}
                    >
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

        .rn-assessment-result-pass {
          color: #166534;
          background: #dcfce7;
        }

        .rn-assessment-result-fail {
          color: #991b1b;
          background: #fee2e2;
        }

        @media (max-width: 600px) {
          .rn-assessment-summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 12px !important;
          }

          .rn-assessment-summary-grid > .rn-card {
            padding: 16px;
            min-width: 0;
          }

          .rn-assessment-history-card {
            padding: 16px !important;
          }

          .rn-assessment-history-score {
            text-align: left !important;
          }

          .rn-assessment-history-score > div {
            text-align: left !important;
          }

          .rn-assessment-history-details {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .rn-assessment-history-view {
            grid-column: 1 / -1;
          }

          .rn-assessment-history-view .rn-button {
            width: 100%;
            justify-content: center;
          }
        }

        @media (max-width: 360px) {
          .rn-assessment-summary-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .rn-assessment-history-details {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }
      `}</style>
    </main>
  );
}