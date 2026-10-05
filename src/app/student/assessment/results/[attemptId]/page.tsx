import Link from "next/link";
import { redirect, notFound } from "next/navigation";
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

export default async function AssessmentResultDetailPage({
  params,
}: {
  params: Promise<{
    attemptId: string;
  }>;
}) {
  const { attemptId } = await params;

  const supabase = await createClient();

  const {
    data: {
      user,
    },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(
        `/student/assessment/results/${attemptId}`
      )}`
    );
  }

  const { data: attemptData } = await supabase
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
    .eq("id", attemptId)
    .eq("student_id", user.id)
    .not("completed_at", "is", null)
    .maybeSingle();

  if (!attemptData) {
    notFound();
  }

  const attempt =
    attemptData as unknown as AssessmentAttempt;

  const { data: courseData } = await supabase
    .from("courses")
    .select("id, title, slug")
    .eq("id", attempt.course_id)
    .maybeSingle();

  const course =
    courseData as unknown as Course | null;

  const percentage =
    calculatePercentage(attempt);

  const passed = percentage >= 70;

  const earnedPoints =
    typeof attempt.earned_points === "number"
      ? attempt.earned_points
      : null;

  const totalPoints =
    typeof attempt.total_points === "number"
      ? attempt.total_points
      : null;

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
            Assessment Result
          </p>

          <h1
            style={{
              margin: 0,
            }}
          >
            {course?.title ||
              "Course Assessment"}
          </h1>

          <p
            style={{
              marginTop: 8,
              marginBottom: 0,
              color: "var(--muted)",
            }}
          >
            Completed{" "}
            {formatDate(attempt.completed_at)}
          </p>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 24,
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
            Score
          </div>

          <div
            style={{
              marginTop: 8,
              fontSize: 34,
              fontWeight: 800,
            }}
          >
            {percentage}%
          </div>

          <div
            style={{
              marginTop: 4,
              fontSize: 13,
              color: "var(--muted)",
            }}
          >
            {passed
              ? "Assessment passed"
              : "Assessment not passed"}
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
            Questions
          </div>

          <div
            style={{
              marginTop: 8,
              fontSize: 30,
              fontWeight: 800,
            }}
          >
            {attempt.total_questions ??
              "—"}
          </div>

          <div
            style={{
              marginTop: 4,
              fontSize: 13,
              color: "var(--muted)",
            }}
          >
            Questions in assessment
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
            Points
          </div>

          <div
            style={{
              marginTop: 8,
              fontSize: 30,
              fontWeight: 800,
            }}
          >
            {earnedPoints !== null &&
            totalPoints !== null
              ? `${earnedPoints}/${totalPoints}`
              : "—"}
          </div>

          <div
            style={{
              marginTop: 4,
              fontSize: 13,
              color: "var(--muted)",
            }}
          >
            Earned points
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
            Time
          </div>

          <div
            style={{
              marginTop: 8,
              fontSize: 30,
              fontWeight: 800,
            }}
          >
            {formatDuration(
              attempt.time_spent_seconds
            )}
          </div>

          <div
            style={{
              marginTop: 4,
              fontSize: 13,
              color: "var(--muted)",
            }}
          >
            Recorded assessment time
          </div>
        </div>
      </section>

      <section
        className="rn-card"
        style={{
          marginBottom: 24,
          borderLeft: passed
            ? "4px solid #16a34a"
            : "4px solid #dc2626",
        }}
      >
        <h2
          style={{
            marginTop: 0,
            marginBottom: 8,
          }}
        >
          {passed
            ? "Assessment Passed"
            : "Assessment Not Passed"}
        </h2>

        <p
          style={{
            margin: 0,
            lineHeight: 1.7,
            color: "var(--muted)",
          }}
        >
          {passed
            ? "You achieved the minimum passing score of 70% for this assessment."
            : "You scored below the 70% passing threshold. You can retake the assessment to improve your result."}
        </p>
      </section>

      <section
        className="rn-card"
        style={{
          marginBottom: 24,
        }}
      >
        <h2
          style={{
            marginTop: 0,
            marginBottom: 16,
          }}
        >
          Assessment Information
        </h2>

        <dl
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 18,
            margin: 0,
          }}
        >
          <div>
            <dt
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: 0.6,
              }}
            >
              Course
            </dt>

            <dd
              style={{
                margin: "5px 0 0",
                fontWeight: 600,
              }}
            >
              {course?.title ||
                "Course assessment"}
            </dd>
          </div>

          <div>
            <dt
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: 0.6,
              }}
            >
              Completed
            </dt>

            <dd
              style={{
                margin: "5px 0 0",
              }}
            >
              {formatDate(
                attempt.completed_at
              )}
            </dd>
          </div>

          <div>
            <dt
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: 0.6,
              }}
            >
              Attempt recorded
            </dt>

            <dd
              style={{
                margin: "5px 0 0",
              }}
            >
              {formatDate(attempt.created_at)}
            </dd>
          </div>

          <div>
            <dt
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: 0.6,
              }}
            >
              Result
            </dt>

            <dd
              style={{
                margin: "5px 0 0",
                fontWeight: 700,
                color: passed
                  ? "#166534"
                  : "#991b1b",
              }}
            >
              {passed
                ? "Passed"
                : "Not passed"}
            </dd>
          </div>
        </dl>
      </section>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 40,
        }}
      >
        <Link
          href="/student/assessment/results"
          className="rn-button rn-button-secondary"
        >
          Assessment Results
        </Link>

        {course?.slug ? (
          <Link
            href={`/student/assessment?course=${encodeURIComponent(
              course.slug
            )}`}
            className="rn-button rn-button-primary"
          >
            Retake Assessment
          </Link>
        ) : null}

        <Link
          href="/student/courses"
          className="rn-button rn-button-secondary"
        >
          My Learning
        </Link>
      </div>
    </main>
  );
}