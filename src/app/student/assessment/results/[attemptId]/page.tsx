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

  // Older assessment records store score as a percentage.
  if (
    typeof attempt.score === "number" &&
    Number.isFinite(attempt.score) &&
    attempt.score >= 0 &&
    attempt.score <= 100
  ) {
    return Math.round(attempt.score);
  }

  // Fallback for records in which score is a raw question count.
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

function formatDate(value: string | null): string {
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

function formatDuration(seconds: number | null): string {
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

function formatPoints(
  earnedPoints: number | null,
  totalPoints: number | null
): string {
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

function getQuestionText(question: AssessmentQuestion): string {
  return (
    question.question?.trim() ||
    question.question_text?.trim() ||
    "Question unavailable"
  );
}

function parseOptions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (option): option is string =>
      typeof option === "string" &&
      option.trim().length > 0
  );
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

  const {
    data: attemptData,
    error: attemptError,
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

  if (answersResult.error) {
    throw new Error(answersResult.error.message);
  }

  const course =
    courseResult.data as unknown as Course | null;

  const answers =
    (answersResult.data as unknown as AssessmentAnswer[] | null) ?? [];

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
      .order("sort_order", {
        ascending: true,
      });

    if (questionError) {
      throw new Error(questionError.message);
    }

    questions =
      (questionData as unknown as AssessmentQuestion[] | null) ?? [];
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
    <main className="rn-detail-social">
      <div className="rn-detail-shell">
        {/* Heading */}
        <header className="rn-detail-page-header">
          <div className="rn-detail-heading-copy">
            <div className="rn-detail-eyebrow">
              <span className="rn-detail-eyebrow-dot" />
              LEARNING RECORDS
            </div>

            <h1>Assessment Result</h1>

            <p className="rn-detail-course-subtitle">
              {course?.title || "Course Assessment"}
            </p>

            <p className="rn-detail-date">
              Completed {formatDate(attempt.completed_at)}
            </p>
          </div>

          <Link
            href="/student/assessment/results"
            className="rn-detail-secondary-button"
          >
            <span aria-hidden="true">←</span>
            All Results
          </Link>
        </header>

        {/* Main score panel */}
        <section
          className={`rn-detail-score-banner ${
            passed
              ? "rn-detail-banner-passed"
              : "rn-detail-banner-failed"
          }`}
        >
          <div className="rn-detail-score-main">
            <div className="rn-detail-banner-label">
              YOUR ASSESSMENT SCORE
            </div>

            <div className="rn-detail-score-number">
              {percentage}%
            </div>

            <div className="rn-detail-banner-description">
              {passed
                ? "You reached the passing threshold for this assessment."
                : "Your score is below the 70% passing threshold."}
            </div>
          </div>

          <div className="rn-detail-score-status">
            <span
              className={`rn-detail-status-badge ${
                passed
                  ? "rn-detail-status-passed"
                  : "rn-detail-status-failed"
              }`}
            >
              <span aria-hidden="true">
                {passed ? "✓" : "!"}
              </span>
              {passed ? "Assessment Passed" : "Not Passed"}
            </span>

            <div className="rn-detail-threshold">
              <span>Passing score</span>
              <strong>70%</strong>
            </div>
          </div>
        </section>

        {/* Key metrics */}
        <section
          className="rn-detail-stats-grid"
          aria-label="Assessment statistics"
        >
          <article className="rn-detail-stat-card">
            <div className="rn-detail-stat-icon rn-detail-icon-blue">
              #
            </div>

            <div className="rn-detail-stat-label">
              Questions
            </div>

            <div className="rn-detail-stat-value">
              {attempt.total_questions ?? "—"}
            </div>

            <div className="rn-detail-stat-note">
              Questions in assessment
            </div>
          </article>

          <article className="rn-detail-stat-card">
            <div className="rn-detail-stat-icon rn-detail-icon-green">
              ✓
            </div>

            <div className="rn-detail-stat-label">
              Correct answers
            </div>

            <div className="rn-detail-stat-value">
              {correctAnswers}
            </div>

            <div className="rn-detail-stat-note">
              Confirmed correct responses
            </div>
          </article>

          <article className="rn-detail-stat-card">
            <div className="rn-detail-stat-icon rn-detail-icon-red">
              !
            </div>

            <div className="rn-detail-stat-label">
              Incorrect answers
            </div>

            <div className="rn-detail-stat-value">
              {incorrectAnswers}
            </div>

            <div className="rn-detail-stat-note">
              Confirmed incorrect responses
            </div>
          </article>

          <article className="rn-detail-stat-card">
            <div className="rn-detail-stat-icon rn-detail-icon-purple">
              ◷
            </div>

            <div className="rn-detail-stat-label">
              Time spent
            </div>

            <div className="rn-detail-stat-value rn-detail-time-value">
              {formatDuration(attempt.time_spent_seconds)}
            </div>

            <div className="rn-detail-stat-note">
              Recorded assessment time
            </div>
          </article>
        </section>

        {/* Main content and sidebar */}
        <div className="rn-detail-dashboard">
          <div className="rn-detail-main-column">
            {/* Answer review */}
            <section className="rn-detail-panel">
              <div className="rn-detail-panel-header">
                <div>
                  <h2>Answer Review</h2>
                  <p>
                    Review your submitted answers and the correct
                    responses.
                  </p>
                </div>

                <span className="rn-detail-review-count">
                  {questions.length}{" "}
                  {questions.length === 1 ? "question" : "questions"}
                </span>
              </div>

              {questions.length === 0 ? (
                <div className="rn-detail-empty-review">
                  <div className="rn-detail-empty-icon">
                    i
                  </div>

                  <h3>No question details available</h3>

                  <p>
                    The assessment result was saved, but individual
                    question review data is not currently available
                    for this attempt.
                  </p>
                </div>
              ) : (
                <div className="rn-detail-question-list">
                  {questions.map((question, index) => {
                    const answer = answerMap.get(question.id);
                    const options = parseOptions(question.options);
                    const isCorrect = answer?.is_correct === true;
                    const isIncorrect = answer?.is_correct === false;

                    const statusClass = isCorrect
                      ? "rn-detail-question-correct"
                      : isIncorrect
                        ? "rn-detail-question-incorrect"
                        : "rn-detail-question-neutral";

                    return (
                      <article
                        key={question.id}
                        className={`rn-detail-question ${statusClass}`}
                      >
                        <div className="rn-detail-question-header">
                          <div className="rn-detail-question-heading">
                            <div className="rn-detail-question-number">
                              QUESTION {index + 1}
                            </div>

                            <h3>
                              {getQuestionText(question)}
                            </h3>

                            <div className="rn-detail-question-tags">
                              {question.difficulty ? (
                                <span className="rn-detail-tag">
                                  {question.difficulty}
                                </span>
                              ) : null}

                              {question.question_type ? (
                                <span className="rn-detail-tag">
                                  {question.question_type}
                                </span>
                              ) : null}

                              <span className="rn-detail-tag">
                                {question.points}{" "}
                                {question.points === 1 ? "point" : "points"}
                              </span>
                            </div>
                          </div>

                          <span
                            className={`rn-detail-answer-badge ${
                              isCorrect
                                ? "rn-detail-answer-badge-correct"
                                : isIncorrect
                                  ? "rn-detail-answer-badge-incorrect"
                                  : "rn-detail-answer-badge-neutral"
                            }`}
                          >
                            {isCorrect
                              ? "✓ Correct"
                              : isIncorrect
                                ? "✕ Incorrect"
                                : "Not recorded"}
                          </span>
                        </div>

                        {options.length > 0 ? (
                          <div className="rn-detail-options">
                            {options.map((option, optionIndex) => {
                              const selected = answer?.answer === option;
                              const correct =
                                question.correct_answer === option;

                              let optionClass =
                                "rn-detail-option";

                              if (selected && correct) {
                                optionClass +=
                                  " rn-detail-option-correct";
                              } else if (selected) {
                                optionClass +=
                                  " rn-detail-option-selected";
                              } else if (correct) {
                                optionClass +=
                                  " rn-detail-option-correct";
                              }

                              return (
                                <div
                                  key={`${question.id}-${optionIndex}`}
                                  className={optionClass}
                                >
                                  <div className="rn-detail-option-row">
                                    <span className="rn-detail-option-marker">
                                      {selected || correct
                                        ? "✓"
                                        : String(optionIndex + 1)}
                                    </span>

                                    <span className="rn-detail-option-text">
                                      {option}
                                    </span>
                                  </div>

                                  {selected ? (
                                    <span className="rn-detail-option-label">
                                      Your answer
                                    </span>
                                  ) : null}

                                  {!selected && correct ? (
                                    <span className="rn-detail-option-label rn-detail-correct-label">
                                      Correct answer
                                    </span>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}

                        <div className="rn-detail-response-grid">
                          <div className="rn-detail-response-box">
                            <div className="rn-detail-response-label">
                              YOUR RESPONSE
                            </div>

                            <div className="rn-detail-response-value">
                              {answer?.answer || "Not recorded"}
                            </div>
                          </div>

                          <div className="rn-detail-response-box rn-detail-correct-response">
                            <div className="rn-detail-response-label">
                              CORRECT RESPONSE
                            </div>

                            <div className="rn-detail-response-value">
                              {question.correct_answer}
                            </div>
                          </div>

                          <div className="rn-detail-response-box">
                            <div className="rn-detail-response-label">
                              POINTS EARNED
                            </div>

                            <div className="rn-detail-response-value">
                              {typeof answer?.points_earned === "number"
                                ? answer.points_earned
                                : "Not recorded"}
                              {" / "}
                              {question.points}
                            </div>
                          </div>
                        </div>

                        {question.explanation ? (
                          <div className="rn-detail-explanation">
                            <div className="rn-detail-explanation-heading">
                              <span aria-hidden="true">i</span>
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
          </div>

          {/* Sidebar */}
          <aside className="rn-detail-sidebar">
            <section className="rn-detail-sidebar-card">
              <div className="rn-detail-sidebar-title">
                <span className="rn-detail-sidebar-title-icon">
                  ▤
                </span>
                <h2>Assessment Summary</h2>
              </div>

              <div className="rn-detail-summary-row">
                <span>Final score</span>
                <strong>{percentage}%</strong>
              </div>

              <div className="rn-detail-summary-row">
                <span>Points</span>
                <strong>
                  {formatPoints(earnedPoints, totalPoints)}
                </strong>
              </div>

              <div className="rn-detail-summary-row">
                <span>Questions</span>
                <strong>{attempt.total_questions ?? "—"}</strong>
              </div>

              <div className="rn-detail-summary-row">
                <span>Passing threshold</span>
                <strong>70%</strong>
              </div>

              <div className="rn-detail-summary-result">
                <span>Final status</span>

                <strong
                  className={
                    passed
                      ? "rn-detail-summary-passed"
                      : "rn-detail-summary-failed"
                  }
                >
                  {passed ? "Passed" : "Not passed"}
                </strong>
              </div>
            </section>

            <section className="rn-detail-sidebar-card">
              <div className="rn-detail-sidebar-title">
                <span className="rn-detail-sidebar-title-icon">
                  ◷
                </span>
                <h2>Attempt Information</h2>
              </div>

              <div className="rn-detail-info-item">
                <span>Course</span>
                <strong>
                  {course?.title || "Course Assessment"}
                </strong>
              </div>

              <div className="rn-detail-info-item">
                <span>Completed</span>
                <strong>
                  {formatDate(attempt.completed_at)}
                </strong>
              </div>

              <div className="rn-detail-info-item">
                <span>Attempt recorded</span>
                <strong>
                  {formatDate(attempt.created_at)}
                </strong>
              </div>

              <div className="rn-detail-info-item">
                <span>Duration</span>
                <strong>
                  {formatDuration(attempt.time_spent_seconds)}
                </strong>
              </div>
            </section>

            <section className="rn-detail-sidebar-card rn-detail-learning-card">
              <div className="rn-detail-sidebar-title">
                <span className="rn-detail-sidebar-title-icon">
                  ↗
                </span>
                <h2>Continue Learning</h2>
              </div>

              <p>
                Keep developing your practical AI and digital skills
                with RuffNeck Learn.
              </p>

              {course?.slug ? (
                <Link
                  href={`/student/assessment?course=${encodeURIComponent(
                    course.slug
                  )}`}
                  className="rn-detail-sidebar-action"
                >
                  Retake Assessment
                  <span aria-hidden="true">→</span>
                </Link>
              ) : (
                <Link
                  href="/student/assessment"
                  className="rn-detail-sidebar-action"
                >
                  Browse Assessments
                  <span aria-hidden="true">→</span>
                </Link>
              )}

              <Link
                href="/student/courses"
                className="rn-detail-sidebar-action rn-detail-sidebar-action-secondary"
              >
                My Learning
                <span aria-hidden="true">→</span>
              </Link>
            </section>
          </aside>
        </div>

        {/* Page actions */}
        <nav className="rn-detail-bottom-nav">
          <Link
            href="/student/assessment/results"
            className="rn-detail-secondary-button"
          >
            <span aria-hidden="true">←</span>
            Assessment Results
          </Link>

          {course?.slug ? (
            <Link
              href={`/student/assessment?course=${encodeURIComponent(
                course.slug
              )}`}
              className="rn-detail-primary-button"
            >
              Retake Assessment
              <span aria-hidden="true">→</span>
            </Link>
          ) : null}

          <Link
            href="/student/courses"
            className="rn-detail-secondary-button"
          >
            My Learning
          </Link>
        </nav>

        <footer className="rn-detail-footer">
          <span>RuffNeck Learn</span>
          <span>Assessment Records</span>
          <span>Practical AI &amp; Digital Skills</span>
        </footer>
      </div>

      <style>{`
        .rn-detail-social,
        .rn-detail-social * {
          box-sizing: border-box;
        }

        .rn-detail-social {
          --detail-blue: #0a66c2;
          --detail-blue-dark: #004182;
          --detail-text: #191919;
          --detail-secondary: #666a70;
          --detail-muted: #737780;
          --detail-border: #dfe3e8;
          --detail-background: #f3f5f8;
          --detail-green: #16834a;

          width: 100%;
          min-height: 100vh;
          padding: 26px 22px 36px;
          background: var(--detail-background);
          color: var(--detail-text);
          font-family: Arial, Helvetica, sans-serif;
        }

        .rn-detail-shell {
          width: 100%;
          max-width: 1180px;
          margin: 0 auto;
        }

        .rn-detail-page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 20px;
          padding: 25px 28px;
          margin-bottom: 18px;
          background: #fff;
          border: 1px solid var(--detail-border);
          border-radius: 12px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.025);
        }

        .rn-detail-heading-copy {
          min-width: 0;
          flex: 1;
        }

        .rn-detail-eyebrow {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 9px;
          color: var(--detail-blue);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1px;
        }

        .rn-detail-eyebrow-dot {
          width: 8px;
          height: 8px;
          flex: 0 0 8px;
          border-radius: 50%;
          background: var(--detail-blue);
        }

        .rn-detail-heading-copy h1 {
          margin: 0;
          font-size: clamp(25px, 3vw, 32px);
          font-weight: 750;
          letter-spacing: -0.7px;
          line-height: 1.25;
          overflow-wrap: anywhere;
        }

        .rn-detail-course-subtitle {
          margin: 8px 0 0;
          font-size: 15px;
          font-weight: 700;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .rn-detail-date {
          margin: 5px 0 0;
          color: var(--detail-muted);
          font-size: 12px;
          line-height: 1.6;
        }

        .rn-detail-primary-button,
        .rn-detail-secondary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 40px;
          padding: 9px 16px;
          border: 1px solid transparent;
          border-radius: 22px;
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

        .rn-detail-primary-button {
          border-color: var(--detail-blue);
          background: var(--detail-blue);
          color: #fff;
        }

        .rn-detail-primary-button:hover {
          border-color: var(--detail-blue-dark);
          background: var(--detail-blue-dark);
        }

        .rn-detail-secondary-button {
          border-color: #9ca3af;
          background: #fff;
          color: #41454b;
        }

        .rn-detail-secondary-button:hover {
          border-color: var(--detail-blue);
          background: #f0f7ff;
          color: var(--detail-blue);
        }

        .rn-detail-primary-button:focus-visible,
        .rn-detail-secondary-button:focus-visible,
        .rn-detail-sidebar-action:focus-visible {
          outline: 3px solid rgba(10, 102, 194, 0.3);
          outline-offset: 3px;
        }

        .rn-detail-score-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 25px;
          padding: 27px 30px;
          margin-bottom: 18px;
          border: 1px solid var(--detail-border);
          border-radius: 12px;
          background: #fff;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.025);
        }

        .rn-detail-banner-passed {
          border-top: 3px solid #21884e;
        }

        .rn-detail-banner-failed {
          border-top: 3px solid #c63737;
        }

        .rn-detail-score-main {
          min-width: 0;
        }

        .rn-detail-banner-label {
          color: var(--detail-muted);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1px;
        }

        .rn-detail-score-number {
          margin-top: 8px;
          color: var(--detail-blue);
          font-size: clamp(38px, 5vw, 54px);
          font-weight: 800;
          letter-spacing: -1.8px;
          line-height: 1.1;
          overflow-wrap: anywhere;
        }

        .rn-detail-banner-description {
          margin-top: 9px;
          color: var(--detail-secondary);
          font-size: 13px;
          line-height: 1.6;
        }

        .rn-detail-score-status {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 16px;
          flex: 0 0 auto;
        }

        .rn-detail-status-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 8px 13px;
          border-radius: 24px;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .rn-detail-status-passed {
          background: #e8f6ed;
          color: #176b3c;
        }

        .rn-detail-status-failed {
          background: #fceaea;
          color: #a52d2d;
        }

        .rn-detail-threshold {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--detail-muted);
          font-size: 11px;
        }

        .rn-detail-threshold strong {
          color: var(--detail-text);
          font-size: 13px;
        }

        .rn-detail-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 15px;
          margin-bottom: 23px;
        }

        .rn-detail-stat-card {
          min-width: 0;
          padding: 19px;
          border: 1px solid var(--detail-border);
          border-radius: 11px;
          background: #fff;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.025);
        }

        .rn-detail-stat-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          margin-bottom: 13px;
          border-radius: 9px;
          font-size: 16px;
          font-weight: 800;
        }

        .rn-detail-icon-blue {
          background: #e8f2fc;
          color: #0a66c2;
        }

        .rn-detail-icon-green {
          background: #e6f5ec;
          color: #16834a;
        }

        .rn-detail-icon-red {
          background: #fceaea;
          color: #b53333;
        }

        .rn-detail-icon-purple {
          background: #f0eafd;
          color: #7550b3;
        }

        .rn-detail-stat-label {
          color: var(--detail-muted);
          font-size: 10px;
          font-weight: 750;
          line-height: 1.4;
        }

        .rn-detail-stat-value {
          margin-top: 7px;
          color: var(--detail-text);
          font-size: clamp(25px, 3vw, 31px);
          font-weight: 800;
          letter-spacing: -0.5px;
          line-height: 1.2;
          overflow-wrap: anywhere;
        }

        .rn-detail-time-value {
          font-size: clamp(17px, 2vw, 22px);
          letter-spacing: -0.3px;
        }

        .rn-detail-stat-note {
          margin-top: 6px;
          color: var(--detail-muted);
          font-size: 10px;
          line-height: 1.6;
        }

        .rn-detail-dashboard {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 305px;
          align-items: start;
          gap: 20px;
        }

        .rn-detail-main-column {
          min-width: 0;
        }

        .rn-detail-panel,
        .rn-detail-sidebar-card {
          min-width: 0;
          margin-bottom: 17px;
          overflow: hidden;
          border: 1px solid var(--detail-border);
          border-radius: 12px;
          background: #fff;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.025);
        }

        .rn-detail-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 21px 23px;
          border-bottom: 1px solid #e9ecef;
        }

        .rn-detail-panel-header h2 {
          margin: 0;
          color: var(--detail-text);
          font-size: 18px;
          font-weight: 750;
          letter-spacing: -0.3px;
        }

        .rn-detail-panel-header p {
          margin: 6px 0 0;
          color: var(--detail-secondary);
          font-size: 12px;
          line-height: 1.6;
        }

        .rn-detail-review-count {
          flex: 0 0 auto;
          padding: 6px 10px;
          border: 1px solid #d8e7f7;
          border-radius: 20px;
          background: #edf5fd;
          color: #0a579e;
          font-size: 10px;
          font-weight: 750;
        }

        .rn-detail-question-list {
          display: grid;
        }

        .rn-detail-question {
          min-width: 0;
          padding: 22px 23px;
          border-bottom: 1px solid #e9ecef;
          border-left: 3px solid transparent;
        }

        .rn-detail-question:last-child {
          border-bottom: none;
        }

        .rn-detail-question-correct {
          border-left-color: #21884e;
        }

        .rn-detail-question-incorrect {
          border-left-color: #c63737;
        }

        .rn-detail-question-neutral {
          border-left-color: #cbd2d9;
        }

        .rn-detail-question-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 17px;
        }

        .rn-detail-question-heading {
          flex: 1;
          min-width: 0;
        }

        .rn-detail-question-number {
          margin-bottom: 7px;
          color: var(--detail-muted);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.8px;
        }

        .rn-detail-question-heading h3 {
          margin: 0;
          color: #24272b;
          font-size: 14px;
          font-weight: 700;
          line-height: 1.65;
          overflow-wrap: anywhere;
        }

        .rn-detail-question-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 10px;
        }

        .rn-detail-tag {
          display: inline-flex;
          align-items: center;
          max-width: 100%;
          padding: 4px 8px;
          border: 1px solid #e0e5e9;
          border-radius: 14px;
          background: #f7f9fb;
          color: #626a73;
          font-size: 9px;
          font-weight: 750;
          line-height: 1.4;
          text-transform: uppercase;
          overflow-wrap: anywhere;
        }

        .rn-detail-answer-badge {
          display: inline-flex;
          flex: 0 0 auto;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 6px 9px;
          border-radius: 18px;
          font-size: 10px;
          font-weight: 800;
          white-space: nowrap;
        }

        .rn-detail-answer-badge-correct {
          background: #e8f6ed;
          color: #176b3c;
        }

        .rn-detail-answer-badge-incorrect {
          background: #fceaea;
          color: #a52d2d;
        }

        .rn-detail-answer-badge-neutral {
          background: #edf0f3;
          color: #59636f;
        }

        .rn-detail-options {
          display: grid;
          gap: 8px;
          margin-bottom: 16px;
        }

        .rn-detail-option {
          min-width: 0;
          padding: 11px 12px;
          border: 1px solid #e0e5e9;
          border-radius: 9px;
          background: #fff;
          overflow-wrap: anywhere;
        }

        .rn-detail-option-correct {
          border-color: #b9e3c8;
          background: #f0faf3;
        }

        .rn-detail-option-selected {
          border-color: #edc1c1;
          background: #fff5f5;
        }

        .rn-detail-option-row {
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }

        .rn-detail-option-marker {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 25px;
          height: 25px;
          flex: 0 0 25px;
          border-radius: 7px;
          background: #eef1f4;
          color: #59636f;
          font-size: 11px;
          font-weight: 800;
        }

        .rn-detail-option-correct .rn-detail-option-marker {
          background: #21884e;
          color: #fff;
        }

        .rn-detail-option-selected .rn-detail-option-marker {
          background: #c63737;
          color: #fff;
        }

        .rn-detail-option-text {
          flex: 1;
          min-width: 0;
          padding-top: 3px;
          color: #33383f;
          font-size: 12px;
          line-height: 1.65;
          overflow-wrap: anywhere;
        }

        .rn-detail-option-label {
          display: block;
          margin: 7px 0 0 35px;
          color: #a52d2d;
          font-size: 10px;
          font-weight: 750;
        }

        .rn-detail-correct-label {
          color: #176b3c;
        }

        .rn-detail-response-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
          gap: 9px;
          margin-top: 15px;
        }

        .rn-detail-response-box {
          min-width: 0;
          padding: 12px;
          border: 1px solid #e5e9ed;
          border-radius: 9px;
          background: #f8fafc;
        }

        .rn-detail-correct-response {
          border-color: #d1ead9;
          background: #f1faf4;
        }

        .rn-detail-response-label {
          margin-bottom: 7px;
          color: var(--detail-muted);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.5px;
          line-height: 1.5;
        }

        .rn-detail-response-value {
          color: #30343b;
          font-size: 12px;
          font-weight: 650;
          line-height: 1.6;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .rn-detail-explanation {
          margin-top: 13px;
          padding: 14px;
          border: 1px solid #d7eafa;
          border-radius: 9px;
          background: #f1f8fe;
        }

        .rn-detail-explanation-heading {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 7px;
          color: #0a579e;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .rn-detail-explanation-heading span {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #dceefe;
          font-size: 10px;
        }

        .rn-detail-explanation p {
          margin: 0;
          color: #3d5367;
          font-size: 12px;
          line-height: 1.75;
          overflow-wrap: anywhere;
        }

        .rn-detail-empty-review {
          padding: 36px 23px;
          text-align: center;
        }

        .rn-detail-empty-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 42px;
          height: 42px;
          margin: 0 auto 13px;
          border-radius: 50%;
          background: #e8f2fc;
          color: var(--detail-blue);
          font-size: 18px;
          font-weight: 800;
        }

        .rn-detail-empty-review h3 {
          margin: 0;
          font-size: 16px;
        }

        .rn-detail-empty-review p {
          max-width: 430px;
          margin: 9px auto 0;
          color: var(--detail-secondary);
          font-size: 12px;
          line-height: 1.75;
        }

        .rn-detail-sidebar {
          display: grid;
          gap: 0;
          min-width: 0;
        }

        .rn-detail-sidebar-card {
          padding: 19px;
        }

        .rn-detail-sidebar-title {
          display: flex;
          align-items: center;
          gap: 9px;
          padding-bottom: 15px;
          margin-bottom: 6px;
          border-bottom: 1px solid #e9ecef;
        }

        .rn-detail-sidebar-title-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          flex: 0 0 30px;
          border-radius: 8px;
          background: #e8f2fc;
          color: var(--detail-blue);
          font-size: 15px;
          font-weight: 800;
        }

        .rn-detail-sidebar-title h2 {
          margin: 0;
          color: var(--detail-text);
          font-size: 14px;
          font-weight: 750;
          line-height: 1.4;
        }

        .rn-detail-summary-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 0;
          border-bottom: 1px solid #f0f2f4;
          color: var(--detail-secondary);
          font-size: 11px;
          line-height: 1.5;
        }

        .rn-detail-summary-row strong {
          color: #30343b;
          font-size: 12px;
          font-weight: 800;
          text-align: right;
          overflow-wrap: anywhere;
        }

        .rn-detail-summary-result {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding-top: 14px;
          color: var(--detail-secondary);
          font-size: 11px;
        }

        .rn-detail-summary-result strong {
          font-size: 11px;
          font-weight: 800;
        }

        .rn-detail-summary-passed {
          color: #16834a;
        }

        .rn-detail-summary-failed {
          color: #b53333;
        }

        .rn-detail-info-item {
          display: flex;
          flex-direction: column;
          gap: 5px;
          padding: 12px 0;
          border-bottom: 1px solid #f0f2f4;
        }

        .rn-detail-info-item:last-child {
          padding-bottom: 0;
          border-bottom: none;
        }

        .rn-detail-info-item > span {
          color: var(--detail-muted);
          font-size: 10px;
          font-weight: 700;
        }

        .rn-detail-info-item > strong {
          color: #30343b;
          font-size: 11px;
          font-weight: 650;
          line-height: 1.6;
          overflow-wrap: anywhere;
        }

        .rn-detail-learning-card > p {
          margin: 13px 0 14px;
          color: var(--detail-secondary);
          font-size: 11px;
          line-height: 1.75;
        }

        .rn-detail-sidebar-action {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          min-height: 40px;
          padding: 10px 12px;
          margin-top: 8px;
          border: 1px solid var(--detail-blue);
          border-radius: 7px;
          background: var(--detail-blue);
          color: #fff;
          font-size: 11px;
          font-weight: 750;
          line-height: 1.5;
          text-decoration: none;
          transition: background 150ms ease;
        }

        .rn-detail-sidebar-action:hover {
          background: var(--detail-blue-dark);
        }

        .rn-detail-sidebar-action-secondary {
          border-color: #cfd6de;
          background: #fff;
          color: #41454b;
        }

        .rn-detail-sidebar-action-secondary:hover {
          border-color: var(--detail-blue);
          background: #f0f7ff;
          color: var(--detail-blue);
        }

        .rn-detail-bottom-nav {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 5px;
          padding: 17px 0 5px;
        }

        .rn-detail-footer {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 8px 20px;
          padding-top: 22px;
          color: #7a8088;
          font-size: 10px;
          line-height: 1.6;
          text-align: center;
        }

        @media (max-width: 1050px) {
          .rn-detail-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .rn-detail-dashboard {
            grid-template-columns: minmax(0, 1fr) 275px;
            gap: 15px;
          }
        }

        @media (max-width: 800px) {
          .rn-detail-social {
            padding: 19px 15px 30px;
          }

          .rn-detail-dashboard {
            grid-template-columns: minmax(0, 1fr);
          }

          .rn-detail-sidebar {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 0 12px;
            align-items: start;
          }

          .rn-detail-sidebar-card:last-child {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 520px) {
          .rn-detail-social {
            padding: 12px 10px 25px;
          }

          .rn-detail-page-header {
            align-items: flex-start;
            padding: 19px 16px;
            gap: 15px;
            margin-bottom: 13px;
          }

          .rn-detail-heading-copy h1 {
            font-size: 25px;
          }

          .rn-detail-course-subtitle {
            font-size: 13px;
          }

          .rn-detail-page-header > .rn-detail-secondary-button {
            width: 100%;
          }

          .rn-detail-score-banner {
            align-items: flex-start;
            flex-direction: column;
            gap: 18px;
            padding: 21px 18px;
            margin-bottom: 13px;
          }

          .rn-detail-score-number {
            font-size: clamp(36px, 11vw, 48px);
          }

          .rn-detail-score-status {
            width: 100%;
            align-items: flex-start;
            gap: 10px;
          }

          .rn-detail-threshold {
            width: 100%;
            justify-content: space-between;
            padding-top: 11px;
            border-top: 1px solid #e9ecef;
          }

          .rn-detail-stats-grid {
            gap: 10px;
            margin-bottom: 16px;
          }

          .rn-detail-stat-card {
            padding: 15px 13px;
          }

          .rn-detail-stat-icon {
            width: 30px;
            height: 30px;
            margin-bottom: 10px;
          }

          .rn-detail-stat-value {
            font-size: 27px;
          }

          .rn-detail-time-value {
            font-size: clamp(16px, 4vw, 20px);
          }

          .rn-detail-panel-header {
            align-items: flex-start;
            flex-direction: column;
            padding: 18px 16px;
            gap: 10px;
          }

          .rn-detail-panel-header h2 {
            font-size: 17px;
          }

          .rn-detail-question {
            padding: 17px 13px;
          }

          .rn-detail-question-header {
            flex-direction: column;
            gap: 11px;
          }

          .rn-detail-answer-badge {
            align-self: flex-start;
          }

          .rn-detail-response-grid {
            grid-template-columns: minmax(0, 1fr);
          }

          .rn-detail-sidebar {
            grid-template-columns: minmax(0, 1fr);
          }

          .rn-detail-sidebar-card:last-child {
            grid-column: auto;
          }

          .rn-detail-sidebar-card {
            padding: 17px;
          }

          .rn-detail-bottom-nav {
            display: grid;
            grid-template-columns: minmax(0, 1fr);
          }

          .rn-detail-bottom-nav > a {
            width: 100%;
          }

          .rn-detail-footer {
            gap: 5px 12px;
            font-size: 9px;
          }
        }

        @media (max-width: 350px) {
          .rn-detail-stats-grid {
            grid-template-columns: minmax(0, 1fr);
          }

          .rn-detail-stat-card {
            display: grid;
            grid-template-columns: 35px minmax(0, 1fr);
            column-gap: 11px;
            align-items: center;
          }

          .rn-detail-stat-icon {
            grid-row: 1 / span 3;
            margin: 0;
          }

          .rn-detail-stat-label,
          .rn-detail-stat-value,
          .rn-detail-stat-note {
            grid-column: 2;
          }

          .rn-detail-stat-value {
            margin-top: 4px;
          }

          .rn-detail-stat-note {
            margin-top: 3px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .rn-detail-social *,
          .rn-detail-social *::before,
          .rn-detail-social *::after {
            scroll-behavior: auto !important;
            transition-duration: 0.01ms !important;
            animation-duration: 0.01ms !important;
          }
        }
      `}</style>
    </main>
  );
}