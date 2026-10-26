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

type AssessmentAnswer = {
  attempt_id: string;
  question_id: string;
  answer: string | null;
  is_correct: boolean | null;
  points_earned: number | null;
  answered_at: string | null;
};

type AssessmentQuestion = {
  id: string;
  course_id: string;
  skill_id: string | null;
  question: string | null;
  question_text: string | null;
  options: unknown;
  correct_answer: string;
  explanation: string | null;
  difficulty: string | null;
  points: number;
  question_type: string | null;
  sort_order: number | null;
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

  // Legacy score values are already percentages.
  // Do not divide them by total_questions.
  if (
    typeof attempt.score === "number" &&
    Number.isFinite(attempt.score) &&
    attempt.score >= 0 &&
    attempt.score <= 100
  ) {
    return Math.round(attempt.score);
  }

  // Compatibility fallback for a score saved as a raw question count.
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

function getQuestionText(question: AssessmentQuestion) {
  return (
    question.question?.trim() ||
    question.question_text?.trim() ||
    "Question unavailable"
  );
}

function parseOptions(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (option): option is string =>
      typeof option === "string" &&
      option.trim().length > 0
  );
}

function formatPoints(
  earnedPoints: number | null,
  totalPoints: number | null
) {
  if (
    typeof earnedPoints !== "number" ||
    !Number.isFinite(earnedPoints) ||
    typeof totalPoints !== "number" ||
    !Number.isFinite(totalPoints) ||
    totalPoints <= 0
  ) {
    return "Not recorded";
  }

  return `${earnedPoints}/${totalPoints}`;
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
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(
        `/student/assessment/results/${attemptId}`
      )}`
    );
  }

  const { data: attemptData, error: attemptError } = await supabase
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
    .eq("id", attemptId)
    .eq("student_id", user.id)
    .not("completed_at", "is", null)
    .maybeSingle();

  if (attemptError) {
    throw new Error(attemptError.message);
  }

  if (!attemptData) {
    notFound();
  }

  const attempt = attemptData as unknown as AssessmentAttempt;

  const [courseResult, answersResult] = await Promise.all([
    supabase
      .from("courses")
      .select("id, title, slug")
      .eq("id", attempt.course_id)
      .maybeSingle(),

    supabase
      .from("assessment_answers")
      .select(`
        attempt_id,
        question_id,
        answer,
        is_correct,
        points_earned,
        answered_at
      `)
      .eq("attempt_id", attempt.id),
  ]);

  if (courseResult.error) {
    throw new Error(courseResult.error.message);
  }

  const course = courseResult.data as unknown as Course | null;

  if (answersResult.error) {
    throw new Error(answersResult.error.message);
  }

  const answers =
    (answersResult.data as unknown as AssessmentAnswer[] | null) ??
    [];

  const questionIds = Array.from(
    new Set(
      answers
        .map((answer) => answer.question_id)
        .filter(Boolean)
    )
  );

  let questions: AssessmentQuestion[] = [];

  if (questionIds.length > 0) {
    const {
      data: questionData,
      error: questionError,
    } = await supabase
      .from("assessment_questions")
      .select(`
        id,
        course_id,
        skill_id,
        question,
        question_text,
        options,
        correct_answer,
        explanation,
        difficulty,
        points,
        question_type,
        sort_order
      `)
      .in("id", questionIds)
      .eq("course_id", attempt.course_id)
      .order("sort_order", { ascending: true });

    if (questionError) {
      throw new Error(questionError.message);
    }

    questions =
      (questionData as unknown as AssessmentQuestion[] | null) ??
      [];
  }

  const answerMap = new Map(
    answers.map((answer) => [answer.question_id, answer])
  );

  const percentage = calculatePercentage(attempt);
  const passed = percentage >= 70;

  const earnedPoints =
    typeof attempt.earned_points === "number"
      ? attempt.earned_points
      : null;

  const totalPoints =
    typeof attempt.total_points === "number"
      ? attempt.total_points
      : null;

  const correctAnswers = answers.filter(
    (answer) => answer.is_correct === true
  ).length;

  const incorrectAnswers = answers.filter(
    (answer) => answer.is_correct === false
  ).length;

  return (
    <main className="container rn-assessment-detail-page">
      <section className="rn-page-header rn-detail-header">
        <div>
          <p className="rn-detail-eyebrow">
            Assessment Result
          </p>

          <h1 className="rn-detail-course-title">
            {course?.title || "Course Assessment"}
          </h1>

          <p className="rn-detail-completed">
            Completed {formatDate(attempt.completed_at)}
          </p>
        </div>
      </section>

      <section className="rn-detail-stats">
        <div className="rn-card rn-detail-stat-card">
          <div className="rn-assessment-stat-label">
            Score
          </div>

          <div className="rn-assessment-stat-value rn-assessment-stat-value-score">
            {percentage}%
          </div>

          <div className="rn-assessment-stat-note">
            {passed
              ? "Assessment passed"
              : "Assessment not passed"}
          </div>
        </div>

        <div className="rn-card rn-detail-stat-card">
          <div className="rn-assessment-stat-label">
            Questions
          </div>

          <div className="rn-assessment-stat-value">
            {attempt.total_questions ?? "—"}
          </div>

          <div className="rn-assessment-stat-note">
            Questions in assessment
          </div>
        </div>

        <div className="rn-card rn-detail-stat-card">
          <div className="rn-assessment-stat-label">
            Points
          </div>

          <div className="rn-assessment-stat-value rn-assessment-stat-value-points">
            {formatPoints(earnedPoints, totalPoints)}
          </div>

          <div className="rn-assessment-stat-note">
            Earned points
          </div>
        </div>

        <div className="rn-card rn-detail-stat-card">
          <div className="rn-assessment-stat-label">
            Time
          </div>

          <div className="rn-assessment-stat-value rn-assessment-stat-time">
            {formatDuration(attempt.time_spent_seconds)}
          </div>

          <div className="rn-assessment-stat-note">
            Recorded assessment time
          </div>
        </div>
      </section>

      <section
        className="rn-card rn-detail-result-message"
        style={{
          borderLeft: passed
            ? "4px solid #16a34a"
            : "4px solid #dc2626",
        }}
      >
        <h2>
          {passed ? "Assessment Passed" : "Assessment Not Passed"}
        </h2>

        <p>
          {passed
            ? "You achieved the minimum passing score of 70% for this assessment."
            : "You scored below the 70% passing threshold. You can retake the assessment to improve your result."}
        </p>
      </section>

      <section className="rn-card rn-detail-information">
        <h2>Assessment Information</h2>

        <dl className="rn-detail-information-grid">
          <div>
            <dt className="rn-assessment-info-label">
              Course
            </dt>

            <dd className="rn-assessment-info-value">
              {course?.title || "Course assessment"}
            </dd>
          </div>

          <div>
            <dt className="rn-assessment-info-label">
              Completed
            </dt>

            <dd className="rn-assessment-info-value">
              {formatDate(attempt.completed_at)}
            </dd>
          </div>

          <div>
            <dt className="rn-assessment-info-label">
              Attempt recorded
            </dt>

            <dd className="rn-assessment-info-value">
              {formatDate(attempt.created_at)}
            </dd>
          </div>

          <div>
            <dt className="rn-assessment-info-label">
              Result
            </dt>

            <dd
              className="rn-assessment-info-value"
              style={{
                color: passed ? "#166534" : "#991b1b",
              }}
            >
              {passed ? "Passed" : "Not passed"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rn-detail-answer-review">
        <div className="rn-detail-answer-header">
          <div>
            <p className="rn-detail-eyebrow">
              Answer Review
            </p>

            <h2>Your submitted answers</h2>
          </div>

          <div className="rn-detail-answer-summary">
            <span className="rn-answer-summary-correct">
              {correctAnswers} correct
            </span>

            <span className="rn-answer-summary-incorrect">
              {incorrectAnswers} incorrect
            </span>
          </div>
        </div>

        {questions.length === 0 ? (
          <div className="rn-card">
            <h3>No question details available</h3>

            <p className="rn-detail-no-questions-text">
              The assessment result was saved, but the individual
              question review data is not currently available.
            </p>
          </div>
        ) : (
          <div className="rn-detail-question-list">
            {questions.map((question, index) => {
              const answer = answerMap.get(question.id);
              const options = parseOptions(question.options);
              const isCorrect = answer?.is_correct === true;
              const isIncorrect = answer?.is_correct === false;

              return (
                <article
                  key={question.id}
                  className="rn-card rn-detail-question-card"
                  style={{
                    borderLeft: isCorrect
                      ? "4px solid #16a34a"
                      : isIncorrect
                        ? "4px solid #dc2626"
                        : "4px solid var(--border)",
                  }}
                >
                  <div className="rn-detail-question-heading">
                    <div className="rn-detail-question-copy">
                      <div className="rn-detail-question-number">
                        Question {index + 1}
                      </div>

                      <h3>
                        {getQuestionText(question)}
                      </h3>

                      <div className="rn-detail-question-meta-list">
                        {question.difficulty ? (
                          <span className="rn-question-meta">
                            {question.difficulty}
                          </span>
                        ) : null}

                        {question.question_type ? (
                          <span className="rn-question-meta">
                            {question.question_type}
                          </span>
                        ) : null}

                        <span className="rn-question-meta">
                          {question.points}{" "}
                          {question.points === 1 ? "point" : "points"}
                        </span>
                      </div>
                    </div>

                    <span
                      className={
                        isCorrect
                          ? "rn-answer-status rn-answer-status-correct"
                          : isIncorrect
                            ? "rn-answer-status rn-answer-status-incorrect"
                            : "rn-answer-status rn-answer-status-neutral"
                      }
                    >
                      {isCorrect
                        ? "Correct"
                        : isIncorrect
                          ? "Incorrect"
                          : "Not recorded"}
                    </span>
                  </div>

                  {options.length > 0 ? (
                    <div className="rn-detail-options">
                      {options.map((option, optionIndex) => {
                        const selected = answer?.answer === option;
                        const correct =
                          question.correct_answer === option;

                        const optionClass =
                          selected && correct
                            ? "rn-answer-option rn-answer-option-correct"
                            : selected
                              ? "rn-answer-option rn-answer-option-selected"
                              : correct
                                ? "rn-answer-option rn-answer-option-correct"
                                : "rn-answer-option";

                        return (
                          <div
                            key={`${question.id}-${optionIndex}`}
                            className={optionClass}
                          >
                            <div className="rn-detail-option-row">
                              <span className="rn-answer-option-marker">
                                {selected || correct
                                  ? "✓"
                                  : String(optionIndex + 1)}
                              </span>

                              <span className="rn-detail-option-text">
                                {option}
                              </span>
                            </div>

                            {selected ? (
                              <div className="rn-answer-option-label">
                                Your answer
                              </div>
                            ) : null}

                            {!selected && correct ? (
                              <div className="rn-answer-option-label rn-answer-option-label-correct">
                                Correct answer
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  <div className="rn-detail-answer-boxes">
                    <div className="rn-answer-detail-box">
                      <div className="rn-answer-detail-label">
                        Your response
                      </div>

                      <div className="rn-answer-detail-value">
                        {answer?.answer || "Not recorded"}
                      </div>
                    </div>

                    <div className="rn-answer-detail-box rn-answer-detail-box-correct">
                      <div className="rn-answer-detail-label">
                        Correct response
                      </div>

                      <div className="rn-answer-detail-value">
                        {question.correct_answer}
                      </div>
                    </div>

                    <div className="rn-answer-detail-box">
                      <div className="rn-answer-detail-label">
                        Points earned
                      </div>

                      <div className="rn-answer-detail-value">
                        {typeof answer?.points_earned === "number"
                          ? answer.points_earned
                          : "Not recorded"}
                        {" / "}
                        {question.points}
                      </div>
                    </div>
                  </div>

                  {question.explanation ? (
                    <div className="rn-answer-explanation">
                      <div className="rn-answer-explanation-title">
                        Explanation
                      </div>

                      <p>{question.explanation}</p>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <nav className="rn-detail-navigation">
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
      </nav>

      <style>{`
        .rn-assessment-detail-page {
          min-width: 0;
          max-width: 100%;
        }

        .rn-detail-header {
          margin-bottom: 24px;
        }

        .rn-detail-eyebrow {
          margin: 0 0 5px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1.1px;
          text-transform: uppercase;
          color: var(--cyan);
        }

        .rn-detail-course-title {
          margin: 0;
          overflow-wrap: anywhere;
        }

        .rn-detail-completed {
          margin: 8px 0 0;
          color: var(--muted);
          line-height: 1.6;
        }

        .rn-detail-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .rn-detail-stat-card {
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .rn-assessment-stat-label,
        .rn-assessment-info-label {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: var(--muted);
        }

        .rn-assessment-stat-value {
          margin-top: 8px;
          font-size: clamp(25px, 5vw, 32px);
          font-weight: 800;
          line-height: 1.15;
          overflow-wrap: anywhere;
        }

        .rn-assessment-stat-value-score {
          font-size: clamp(30px, 8vw, 42px);
          line-height: 1.08;
          white-space: nowrap;
        }

        .rn-assessment-stat-value-points {
          font-size: clamp(20px, 4.5vw, 28px);
        }

        .rn-assessment-stat-time {
          font-size: clamp(20px, 4.5vw, 26px);
        }

        .rn-assessment-stat-note {
          margin-top: 5px;
          font-size: 13px;
          line-height: 1.5;
          color: var(--muted);
        }

        .rn-detail-result-message {
          margin-bottom: 24px;
        }

        .rn-detail-result-message h2 {
          margin: 0 0 8px;
        }

        .rn-detail-result-message p {
          margin: 0;
          line-height: 1.7;
          color: var(--muted);
        }

        .rn-detail-information {
          margin-bottom: 24px;
        }

        .rn-detail-information h2 {
          margin: 0 0 16px;
        }

        .rn-detail-information-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 18px;
          margin: 0;
        }

        .rn-assessment-info-value {
          margin: 5px 0 0;
          font-weight: 600;
          overflow-wrap: anywhere;
        }

        .rn-detail-answer-review {
          margin-bottom: 24px;
        }

        .rn-detail-answer-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          flex-wrap: wrap;
          gap: 16px;
          margin-bottom: 16px;
        }

        .rn-detail-answer-header h2 {
          margin: 0;
        }

        .rn-detail-answer-summary {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .rn-answer-summary-correct,
        .rn-answer-summary-incorrect {
          display: inline-flex;
          align-items: center;
          padding: 5px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
        }

        .rn-answer-summary-correct {
          color: #166534;
          background: #dcfce7;
        }

        .rn-answer-summary-incorrect {
          color: #991b1b;
          background: #fee2e2;
        }

        .rn-detail-no-questions-text {
          margin: 0;
          color: var(--muted);
          line-height: 1.7;
        }

        .rn-detail-question-list {
          display: grid;
          gap: 18px;
        }

        .rn-detail-question-card {
          min-width: 0;
          padding: 22px;
        }

        .rn-detail-question-heading {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 16px;
          margin-bottom: 16px;
        }

        .rn-detail-question-copy {
          flex: 1 1 220px;
          min-width: 0;
        }

        .rn-detail-question-number {
          margin-bottom: 7px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          color: var(--muted);
        }

        .rn-detail-question-copy h3 {
          margin: 0;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .rn-detail-question-meta-list {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 9px;
        }

        .rn-answer-status {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          padding: 5px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
        }

        .rn-answer-status-correct {
          color: #166534;
          background: #dcfce7;
        }

        .rn-answer-status-incorrect {
          color: #991b1b;
          background: #fee2e2;
        }

        .rn-answer-status-neutral {
          color: #475569;
          background: #e2e8f0;
        }

        .rn-question-meta {
          display: inline-flex;
          align-items: center;
          padding: 4px 8px;
          border: 1px solid var(--border);
          border-radius: 999px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--muted);
          background: #f8fafc;
        }

        .rn-detail-options {
          display: grid;
          gap: 9px;
          margin-bottom: 18px;
          min-width: 0;
        }

        .rn-answer-option {
          min-width: 0;
          padding: 12px 13px;
          border: 1px solid var(--border);
          border-radius: 9px;
          background: #ffffff;
          overflow-wrap: anywhere;
        }

        .rn-answer-option-selected {
          border-color: #dc2626;
          background: #fef2f2;
        }

        .rn-answer-option-correct {
          border-color: #86efac;
          background: #f0fdf4;
        }

        .rn-detail-option-row {
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }

        .rn-answer-option-marker {
          width: 25px;
          height: 25px;
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          background: #f1f5f9;
          color: #475569;
          font-size: 12px;
          font-weight: 800;
        }

        .rn-answer-option-selected .rn-answer-option-marker {
          background: #dc2626;
          color: #ffffff;
        }

        .rn-answer-option-correct .rn-answer-option-marker {
          background: #16a34a;
          color: #ffffff;
        }

        .rn-detail-option-text {
          flex: 1;
          min-width: 0;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .rn-answer-option-label {
          margin-top: 7px;
          margin-left: 35px;
          font-size: 11px;
          font-weight: 700;
          color: #991b1b;
        }

        .rn-answer-option-label-correct {
          color: #166534;
        }

        .rn-detail-answer-boxes {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .rn-answer-detail-box {
          min-width: 0;
          padding: 13px;
          border-radius: 9px;
          background: #f8fafc;
          border: 1px solid var(--border);
          overflow-wrap: anywhere;
        }

        .rn-answer-detail-box-correct {
          background: #f0fdf4;
          border-color: #bbf7d0;
        }

        .rn-answer-detail-label {
          margin-bottom: 5px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: var(--muted);
        }

        .rn-answer-detail-value {
          line-height: 1.5;
          font-weight: 600;
          overflow-wrap: anywhere;
        }

        .rn-answer-explanation {
          padding: 15px;
          border-radius: 9px;
          background: rgba(0, 180, 216, 0.05);
          border: 1px solid rgba(0, 180, 216, 0.18);
        }

        .rn-answer-explanation-title {
          margin-bottom: 6px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.7px;
          text-transform: uppercase;
          color: var(--cyan);
        }

        .rn-answer-explanation p {
          margin: 0;
          line-height: 1.7;
          overflow-wrap: anywhere;
        }

        .rn-detail-navigation {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 40px;
        }

        @media (max-width: 600px) {
          .rn-detail-stats {
            grid-template-columns: minmax(0, 1fr);
          }

          .rn-detail-stat-card {
            padding: 18px;
          }

          .rn-assessment-stat-value-score {
            font-size: clamp(28px, 9vw, 36px);
          }

          .rn-detail-information-grid,
          .rn-detail-answer-boxes {
            grid-template-columns: minmax(0, 1fr);
          }

          .rn-detail-question-card {
            padding: 16px;
          }

          .rn-detail-navigation {
            display: grid;
            grid-template-columns: minmax(0, 1fr);
          }

          .rn-detail-navigation .rn-button {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </main>
  );
}