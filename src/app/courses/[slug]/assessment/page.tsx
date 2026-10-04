"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type AssessmentQuestion = {
  id: string;
  skillId: string | null;
  skillName: string | null;
  question: string;
  options: string[];
  difficulty: string;
  points: number;
  questionType: string;
  sortOrder: number;
};

type AssessmentResponse = {
  courseId: string;
  totalQuestions: number;
  questions: AssessmentQuestion[];
};

type AssessmentResult = {
  attemptId: string;
  score: number;
  earnedPoints: number;
  totalPoints: number;
  correctAnswers: number;
  totalQuestions: number;
  timeSpentSeconds: number;
  skills: Array<{
    id: string;
    name: string;
    score: number;
    correct: number;
    total: number;
    level: string;
  }>;
};

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    remainingSeconds
  ).padStart(2, "0")}`;
}

export default function AssessmentPage() {
  const params = useParams();
  const router = useRouter();

  const slug =
    typeof params.slug === "string"
      ? params.slug
      : "";

  const [courseId, setCourseId] = useState<string | null>(
    null
  );

  const [questions, setQuestions] = useState<
    AssessmentQuestion[]
  >([]);

  const [answers, setAnswers] = useState<
    Record<string, string>
  >({});

  const [currentIndex, setCurrentIndex] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [result, setResult] =
    useState<AssessmentResult | null>(null);

  const [elapsedSeconds, setElapsedSeconds] =
    useState(0);

  const [started, setStarted] =
    useState(false);

  /*
   * Resolve the course ID from the public course slug.
   */
  useEffect(() => {
    let cancelled = false;

    async function loadCourseAndAssessment() {
      try {
        setLoading(true);
        setError(null);

        const courseResponse =
          await fetch(
            `/api/courses/${encodeURIComponent(
              slug
            )}`,
            {
              cache: "no-store",
            }
          );

        /*
         * If the project does not expose this API route,
         * fall back to resolving the course through the
         * public Supabase browser client below.
         */
        if (!courseResponse.ok) {
          throw new Error(
            "Unable to load the course."
          );
        }

        const courseData =
          (await courseResponse.json()) as {
            id?: string;
          };

        if (!courseData.id) {
          throw new Error(
            "The course could not be identified."
          );
        }

        const resolvedCourseId =
          courseData.id;

        const assessmentResponse =
          await fetch(
            `/api/student/assessment?courseId=${encodeURIComponent(
              resolvedCourseId
            )}`,
            {
              cache: "no-store",
            }
          );

        const assessmentData =
          (await assessmentResponse.json()) as
            | AssessmentResponse
            | { error?: string };

        if (!assessmentResponse.ok) {
          throw new Error(
            "error" in assessmentData &&
              assessmentData.error
              ? assessmentData.error
              : "Unable to load the assessment."
          );
        }

        if (cancelled) {
          return;
        }

        const validAssessment =
          assessmentData as AssessmentResponse;

        setCourseId(
          resolvedCourseId
        );

        setQuestions(
          validAssessment.questions
        );
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load the assessment."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (slug) {
      loadCourseAndAssessment();
    }

    return () => {
      cancelled = true;
    };
  }, [slug]);

  /*
   * Assessment timer.
   */
  useEffect(() => {
    if (
      !started ||
      result ||
      submitting
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      setElapsedSeconds(
        (current) => current + 1
      );
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [
    started,
    result,
    submitting,
  ]);

  const currentQuestion =
    questions[currentIndex] || null;

  const answeredCount =
    Object.keys(answers).length;

  const progressPercentage =
    questions.length > 0
      ? Math.round(
          (answeredCount /
            questions.length) *
            100
        )
      : 0;

  const allAnswered =
    questions.length > 0 &&
    answeredCount ===
      questions.length;

  const currentAnswer =
    currentQuestion
      ? answers[currentQuestion.id] || ""
      : "";

  const canGoBack =
    currentIndex > 0;

  const canGoNext =
    currentIndex <
    questions.length - 1;

  const currentQuestionNumber =
    currentIndex + 1;

  const assessmentTitle =
    useMemo(
      () => "Final Course Assessment",
      []
    );

  function selectAnswer(
    answer: string
  ) {
    if (!currentQuestion) {
      return;
    }

    setStarted(true);

    setAnswers(
      (current) => ({
        ...current,
        [currentQuestion.id]:
          answer,
      })
    );
  }

  function goPrevious() {
    if (canGoBack) {
      setCurrentIndex(
        (current) =>
          current - 1
      );
    }
  }

  function goNext() {
    if (canGoNext) {
      setCurrentIndex(
        (current) =>
          current + 1
      );
    }
  }

  async function submitAssessment() {
    if (!courseId) {
      setError(
        "The course could not be identified."
      );
      return;
    }

    if (!allAnswered) {
      setError(
        "Please answer every question before submitting the assessment."
      );
      return;
    }

    if (submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response =
        await fetch(
          "/api/student/assessment",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              courseId,
              answers,
              timeSpentSeconds:
                elapsedSeconds,
            }),
          }
        );

      const data =
        (await response.json()) as
          | AssessmentResult
          | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in data &&
            data.error
            ? data.error
            : "Unable to submit the assessment."
        );
      }

      setResult(
        data as AssessmentResult
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to submit the assessment."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="container rn-learning-shell">
        <section className="rn-card">
          <p>Loading assessment…</p>
        </section>
      </main>
    );
  }

  if (error && questions.length === 0) {
    return (
      <main className="container rn-learning-shell">
        <section className="rn-card">
          <h1>
            Assessment unavailable
          </h1>

          <p className="error">
            {error}
          </p>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              router.push(
                `/courses/${slug}`
              )
            }
          >
            Back to course
          </button>
        </section>
      </main>
    );
  }

  if (result) {
    const passed =
      result.score >= 70;

    return (
      <main className="container rn-learning-shell">
        <section className="rn-card">
          <div className="rn-learning-topbar">
            <div>
              <span className="rn-eyebrow">
                Assessment complete
              </span>

              <h1>
                {assessmentTitle}
              </h1>

              <p>
                Your assessment has been
                recorded successfully.
              </p>
            </div>
          </div>

          <div className="rn-assessment-result">
            <div className="rn-assessment-score">
              <span className="rn-assessment-score-value">
                {result.score}%
              </span>

              <span className="rn-assessment-score-label">
                Final score
              </span>
            </div>

            <div className="rn-assessment-result-summary">
              <div>
                <strong>
                  {result.correctAnswers}
                </strong>
                <span>
                  Correct answers
                </span>
              </div>

              <div>
                <strong>
                  {result.totalQuestions}
                </strong>
                <span>
                  Total questions
                </span>
              </div>

              <div>
                <strong>
                  {result.earnedPoints}/
                  {result.totalPoints}
                </strong>
                <span>
                  Points earned
                </span>
              </div>

              <div>
                <strong>
                  {formatTime(
                    result.timeSpentSeconds
                  )}
                </strong>
                <span>
                  Time taken
                </span>
              </div>
            </div>
          </div>

          <div className="rn-assessment-status">
            <strong>
              {passed
                ? "Assessment passed"
                : "Assessment completed"}
            </strong>

            <p>
              {passed
                ? "Your score meets the current assessment benchmark."
                : "Your attempt has been recorded. You can review the course material and retake the assessment when permitted."}
            </p>
          </div>

          {result.skills.length >
            0 && (
            <section className="rn-assessment-skills">
              <div className="rn-section-heading">
                <span className="rn-eyebrow">
                  Skill performance
                </span>

                <h2>
                  Performance by skill
                </h2>
              </div>

              <div className="rn-assessment-skill-list">
                {result.skills.map(
                  (skill) => (
                    <div
                      className="rn-assessment-skill"
                      key={
                        skill.id
                      }
                    >
                      <div className="rn-assessment-skill-header">
                        <strong>
                          {skill.name}
                        </strong>

                        <span>
                          {
                            skill.score
                          }%
                        </span>
                      </div>

                      <div className="rn-assessment-skill-bar">
                        <span
                          style={{
                            width: `${skill.score}%`,
                          }}
                        />
                      </div>

                      <div className="rn-assessment-skill-meta">
                        <span>
                          {
                            skill.correct
                          }{" "}
                          /{" "}
                          {
                            skill.total
                          }{" "}
                          correct
                        </span>

                        <span>
                          {
                            skill.level
                          }
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>
            </section>
          )}

          <div className="rn-learning-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                router.push(
                  `/courses/${slug}`
                )
              }
            >
              Return to course
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                router.push(
                  "/dashboard"
                )
              }
            >
              Go to dashboard
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="container rn-learning-shell">
      <section className="rn-card">
        <div className="rn-learning-topbar">
          <div>
            <button
              type="button"
              className="rn-learning-back"
              onClick={() =>
                router.push(
                  `/courses/${slug}`
                )
              }
            >
              ← Back to course
            </button>

            <span className="rn-eyebrow">
              RuffNeck Learn
            </span>

            <h1>
              {assessmentTitle}
            </h1>

            <p>
              Complete all questions. Your
              answers are scored and recorded
              securely.
            </p>
          </div>

          <div className="rn-assessment-timer">
            <span>Time</span>
            <strong>
              {formatTime(
                elapsedSeconds
              )}
            </strong>
          </div>
        </div>

        <div className="rn-assessment-progress">
          <div className="rn-assessment-progress-header">
            <span>
              Question{" "}
              {currentQuestionNumber} of{" "}
              {questions.length}
            </span>

            <span>
              {answeredCount} of{" "}
              {questions.length} answered
            </span>
          </div>

          <div className="rn-assessment-progress-track">
            <span
              style={{
                width: `${progressPercentage}%`,
              }}
            />
          </div>
        </div>

        {error && (
          <div
            className="error"
            role="alert"
          >
            {error}
          </div>
        )}

        {currentQuestion && (
          <section className="rn-assessment-question">
            <div className="rn-assessment-question-meta">
              <span>
                Question{" "}
                {currentQuestionNumber}
              </span>

              <span>
                {currentQuestion.points}{" "}
                {currentQuestion.points ===
                1
                  ? "point"
                  : "points"}
              </span>

              <span>
                {
                  currentQuestion.difficulty
                }
              </span>

              {currentQuestion.skillName && (
                <span>
                  {
                    currentQuestion.skillName
                  }
                </span>
              )}
            </div>

            <h2>
              {currentQuestion.question}
            </h2>

            <div className="rn-assessment-options">
              {currentQuestion.options.map(
                (option, index) => {
                  const selected =
                    currentAnswer ===
                    option;

                  return (
                    <button
                      key={`${currentQuestion.id}-${index}`}
                      type="button"
                      className={`rn-assessment-option${
                        selected
                          ? " is-selected"
                          : ""
                      }`}
                      onClick={() =>
                        selectAnswer(
                          option
                        )
                      }
                      aria-pressed={
                        selected
                      }
                    >
                      <span className="rn-assessment-option-letter">
                        {String.fromCharCode(
                          65 + index
                        )}
                      </span>

                      <span>
                        {option}
                      </span>
                    </button>
                  );
                }
              )}
            </div>
          </section>
        )}

        <div className="rn-assessment-navigation">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={goPrevious}
            disabled={
              !canGoBack ||
              submitting
            }
          >
            Previous
          </button>

          <div className="rn-assessment-navigation-center">
            {questions.map(
              (question, index) => {
                const answered =
                  Boolean(
                    answers[
                      question.id
                    ]
                  );

                const active =
                  index ===
                  currentIndex;

                return (
                  <button
                    key={question.id}
                    type="button"
                    className={`rn-assessment-question-index${
                      active
                        ? " is-active"
                        : ""
                    }${
                      answered
                        ? " is-answered"
                        : ""
                    }`}
                    onClick={() =>
                      setCurrentIndex(
                        index
                      )
                    }
                    aria-label={`Go to question ${
                      index + 1
                    }`}
                  >
                    {index + 1}
                  </button>
                );
              }
            )}
          </div>

          {canGoNext ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={goNext}
              disabled={
                submitting
              }
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={
                submitAssessment
              }
              disabled={
                submitting ||
                !allAnswered
              }
            >
              {submitting
                ? "Submitting…"
                : "Submit assessment"}
            </button>
          )}
        </div>

        {!allAnswered &&
          currentIndex ===
            questions.length - 1 && (
            <p className="rn-assessment-submit-note">
              Answer all{" "}
              {questions.length} questions
              before submitting.
            </p>
          )}
      </section>
    </main>
  );
}