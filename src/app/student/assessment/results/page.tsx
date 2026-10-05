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

function calculatePercentage(
  attempt: AssessmentAttempt
) {
  if (
    typeof attempt.earned_points === "number" &&
    typeof attempt.total_points === "number" &&
    attempt.total_points > 0
  ) {
    return Math.round(
      (attempt.earned_points /
        attempt.total_points) *
        100
    );
  }

  if (
    typeof attempt.score === "number" &&
    typeof attempt.total_questions === "number" &&
    attempt.total_questions > 0
  ) {
    return Math.round(
      (attempt.score /
        attempt.total_questions) *
        100
    );
  }

  if (typeof attempt.score === "number") {
    return Math.round(attempt.score);
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
    seconds < 0
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

export default async function AssessmentResultsPage() {
  const supabase = await createClient();

  const {
    data: {
      user,
    },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      "/login?next=/student/assessment/results"
    );
  }

  const { data: attemptsData } = await supabase
    .from("assessment_attempts")
    .select(
      `
        id,
        course_id,
        score,
        total_points,
        earned_points,
        total_questions,
        time_spent_seconds,
        completed_at,
        created_at
      `
    )
    .eq("student_id", user.id)
    .not("completed_at", "is", null)
    .order("created_at", {
      ascending: false,
    });

  const attempts =
    (attemptsData as unknown as AssessmentAttempt[]) ||
    [];

  const courseIds = Array.from(
    new Set(
      attempts.map(
        (attempt) => attempt.course_id
      )
    )
  );

  let courses: Course[] = [];

  if (courseIds.length > 0) {
    const { data: coursesData } = await supabase
      .from("courses")
      .select("id, title, slug")
      .in("id", courseIds);

    courses =
      (coursesData as unknown as Course[]) ||
      [];
  }

  const courseMap = new Map(
    courses.map((course) => [
      course.id,
      course,
    ])
  );

  const percentages = attempts.map(
    calculatePercentage
  );

  const averageScore =
    percentages.length > 0
      ? Math.round(
          percentages.reduce(
            (sum, value) => sum + value,
            0
          ) / percentages.length
        )
      : 0;

  const bestScore =
    percentages.length > 0
      ? Math.max(...percentages)
      : 0;

  const passedAttempts =
    percentages.filter(
      (score) => score >= 70
    ).length;

  return (
    <main className="container">
      <section
        className="rn-page-header"
        style={{
          marginBottom: 24,
        }}
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

          <h1
            style={{
              margin: 0,
            }}
          >
            Assessment Results
          </h1>

          <p
            style={{
              marginTop: 8,
              marginBottom: 0,
              color: "var(--muted)",
            }}
          >
            Review your completed assessments,
            scores and learning performance.
          </p>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(180px, 1fr))",
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
          <h2
            style={{
              marginTop: 0,
            }}
          >
            No assessment results yet
          </h2>

          <p
            style={{
              color: "var(--muted)",
              lineHeight: 1.7,
              maxWidth: 620,
              margin:
                "0 auto 20px",
            }}
          >
            Complete a course assessment and
            your result will appear here.
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
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
              marginBottom: 16,
            }}
          >
            <h2
              style={{
                margin: 0,
              }}
            >
              Assessment History
            </h2>

            <Link
              href="/student/assessment"
              className="rn-button rn-button-secondary"
            >
              Take an Assessment
            </Link>
          </div>

          <div
            style={{
              display: "grid",
              gap: 16,
            }}
          >
            {attempts.map((attempt) => {
              const course =
                courseMap.get(
                  attempt.course_id
                );

              const percentage =
                calculatePercentage(
                  attempt
                );

              const passed =
                percentage >= 70;

              return (
                <article
                  key={attempt.id}
                  className="rn-card"
                  style={{
                    padding: 22,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems:
                        "flex-start",
                      gap: 20,
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        minWidth: 220,
                        flex: 1,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          letterSpacing: 0.7,
                          textTransform:
                            "uppercase",
                          color:
                            "var(--muted)",
                          marginBottom: 6,
                        }}
                      >
                        Assessment
                      </div>

                      <h3
                        style={{
                          margin:
                            "0 0 8px",
                        }}
                      >
                        {course?.title ||
                          "Course Assessment"}
                      </h3>

                      <div
                        style={{
                          fontSize: 13,
                          color:
                            "var(--muted)",
                        }}
                      >
                        Completed{" "}
                        {formatDate(
                          attempt.completed_at
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems:
                          "center",
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          textAlign:
                            "right",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 30,
                            fontWeight: 800,
                            lineHeight: 1,
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
                            display:
                              "inline-flex",
                            marginTop: 7,
                            padding:
                              "4px 9px",
                            borderRadius:
                              999,
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {passed
                            ? "Passed"
                            : "Not passed"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(150px, 1fr))",
                      gap: 12,
                      marginTop: 20,
                      paddingTop: 18,
                      borderTop:
                        "1px solid var(--border)",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform:
                            "uppercase",
                          color:
                            "var(--muted)",
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
                        {attempt.total_questions ??
                          "—"}
                      </div>
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform:
                            "uppercase",
                          color:
                            "var(--muted)",
                        }}
                      >
                        Points
                      </div>

                      <div
                        style={{
                          marginTop: 4,
                          fontWeight: 700,
                        }}
                      >
                        {typeof attempt.earned_points ===
                          "number" &&
                        typeof attempt.total_points ===
                          "number"
                          ? `${attempt.earned_points}/${attempt.total_points}`
                          : "—"}
                      </div>
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform:
                            "uppercase",
                          color:
                            "var(--muted)",
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
                        {formatDuration(
                          attempt.time_spent_seconds
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems:
                          "flex-end",
                        justifyContent:
                          "flex-start",
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
        .rn-assessment-result-pass {
          color: #166534;
          background: #dcfce7;
        }

        .rn-assessment-result-fail {
          color: #991b1b;
          background: #fee2e2;
        }
      `}</style>
    </main>
  );
}