"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import "./assessment.css";

type Question = {
  id: string;
  question: string;
  options: string[];
  explanation?: string | null;
  difficulty: string;
};

type SkillResult = {
  id: string;
  name: string;
  score: number;
  correct: number;
  total: number;
  level: string;
};

type AssessmentResult = {
  attemptId: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  timeSpentSeconds?: number;
  earnedPoints?: number;
  totalPoints?: number;
  skills: SkillResult[];
};

function safePercentage(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.min(100, Math.max(0, value)));
}

function formatLevel(value: string): string {
  if (!value) return "Not specified";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "Less than a minute";
  }

  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainingSeconds = wholeSeconds % 60;

  if (minutes === 0) return `${remainingSeconds} seconds`;
  if (remainingSeconds === 0) return `${minutes} minutes`;

  return `${minutes}m ${remainingSeconds}s`;
}

export default function AssessmentClient({
  courseId,
  courseTitle,
  questions,
}: {
  courseId: string;
  courseTitle: string;
  questions: Question[];
}) {
  const startedAtRef = useRef(Date.now());

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AssessmentResult | null>(null);

  if (questions.length === 0) {
    return (
      <section className="rn-assessment-card" role="status">
        <h2>Assessment unavailable</h2>
        <p>
          There are no published questions for this assessment yet.
        </p>
        <Link
          href="/student/dashboard"
          className="rn-button rn-button-secondary"
        >
          Return to Dashboard
        </Link>
      </section>
    );
  }

  const question = questions[currentIndex];
  const selectedAnswer = answers[question.id];

  const answeredCount = questions.filter((item) =>
    Object.prototype.hasOwnProperty.call(answers, item.id)
  ).length;

  const progress = Math.round(
    ((currentIndex + 1) / questions.length) * 100
  );

  const unansweredCount = questions.length - answeredCount;

  function selectAnswer(answer: string) {
    setAnswers((previous) => ({
      ...previous,
      [question.id]: answer,
    }));

    setError(null);
  }

  function previous() {
    setCurrentIndex((value) => Math.max(0, value - 1));
    setError(null);
  }

  function next() {
    if (!selectedAnswer) {
      setError("Select an answer before continuing.");
      return;
    }

    setCurrentIndex((value) =>
      Math.min(questions.length - 1, value + 1)
    );

    setError(null);
  }

  async function submitAssessment() {
    if (submitting) return;

    const unanswered = questions.filter(
      (item) =>
        !Object.prototype.hasOwnProperty.call(answers, item.id)
    );

    if (unanswered.length > 0) {
      const firstUnansweredIndex = questions.findIndex(
        (item) =>
          !Object.prototype.hasOwnProperty.call(answers, item.id)
      );

      setCurrentIndex(firstUnansweredIndex);

      setError(
        `Answer all questions before submitting. ${
          unanswered.length
        } ${
          unanswered.length === 1
            ? "question remains"
            : "questions remain"
        }.`
      );

      return;
    }

    const confirmed = window.confirm(
      `Submit your assessment for ${courseTitle}?\n\n${answeredCount} of ${questions.length} questions are answered. You cannot change answers after submission.`
    );

    if (!confirmed) return;

    setSubmitting(true);
    setError(null);

    try {
      const timeSpentSeconds = Math.max(
        0,
        Math.floor((Date.now() - startedAtRef.current) / 1000)
      );

      const response = await fetch("/api/student/assessment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          courseId,
          answers,
          timeSpentSeconds,
        }),
      });

      let data: AssessmentResult | { error?: string };

      try {
        data = (await response.json()) as
          | AssessmentResult
          | { error?: string };
      } catch {
        throw new Error(
          "The server returned an unreadable response. Your answers are still on this page; try submitting again."
        );
      }

      if (!response.ok) {
        throw new Error(
          "error" in data && data.error
            ? data.error
            : "Unable to submit assessment. Your answers are still on this page."
        );
      }

      if (!("attemptId" in data) || !data.attemptId) {
        throw new Error(
          "The server did not return a result ID. Check your assessment results before trying again."
        );
      }

      setResult(data as AssessmentResult);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to submit assessment. Your answers are still on this page."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function restart() {
    const confirmed = window.confirm(
      "Retake this assessment? Your answers on this attempt will be cleared."
    );

    if (!confirmed) return;

    startedAtRef.current = Date.now();

    setCurrentIndex(0);
    setAnswers({});
    setResult(null);
    setError(null);
  }

  if (result) {
    const displayedScore = safePercentage(result.score);
    const passed = displayedScore >= 70;

    const skills = Array.isArray(result.skills)
      ? result.skills
      : [];

    const correctAnswers = Number.isFinite(result.correctAnswers)
      ? Math.max(0, result.correctAnswers)
      : 0;

    const totalQuestions = Number.isFinite(result.totalQuestions)
      ? Math.max(0, result.totalQuestions)
      : questions.length;

    const incorrectAnswers = Math.max(
      0,
      totalQuestions - correctAnswers
    );

    const elapsedSeconds =
      typeof result.timeSpentSeconds === "number"
        ? result.timeSpentSeconds
        : Math.floor((Date.now() - startedAtRef.current) / 1000);

    return (
      <section
        className="rn-ac-result"
        aria-live="polite"
        aria-labelledby="rn-ac-result-title"
      >
        <header className="rn-ac-result-header">
          <div className="rn-ac-heading-copy">
            <div className="rn-ac-eyebrow">
              <span className="rn-ac-eyebrow-dot" />
              ASSESSMENT COMPLETE
            </div>

            <h2 id="rn-ac-result-title">
              Your assessment result
            </h2>

            <p className="rn-ac-course-title">
              {courseTitle}
            </p>

            <p className="rn-ac-intro">
              Your result has been recorded. Review your performance
              and the skills assessed below.
            </p>
          </div>

          <span
            className={`rn-ac-status ${
              passed ? "rn-ac-passed" : "rn-ac-needs-review"
            }`}
          >
            <span aria-hidden="true">
              {passed ? "✓" : "!"}
            </span>
            {passed ? "Assessment passed" : "Keep practising"}
          </span>
        </header>

        <div className="rn-ac-overview">
          <section className="rn-ac-score-card">
            <div className="rn-ac-score-label">
              OVERALL SCORE
            </div>

            <div
              className="rn-ac-score-number"
              aria-label={`Overall score ${displayedScore} percent`}
            >
              {displayedScore}
              <span>%</span>
            </div>

            <p className="rn-ac-score-description">
              {passed
                ? "You reached the 70% passing threshold."
                : "Your score is below the 70% passing threshold."}
            </p>

            <div
              className="rn-ac-progress-track"
              role="progressbar"
              aria-label="Overall assessment score"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={displayedScore}
            >
              <div
                className={`rn-ac-progress-fill ${
                  passed ? "rn-ac-green-fill" : "rn-ac-amber-fill"
                }`}
                style={{ width: `${displayedScore}%` }}
              />
            </div>

            <div className="rn-ac-score-scale">
              <span>0%</span>
              <span>Pass: 70%</span>
              <span>100%</span>
            </div>
          </section>

          <section className="rn-ac-summary-card">
            <div className="rn-ac-summary-heading">
              <h3>Performance summary</h3>
              <p>Your results at a glance.</p>
            </div>

            <div className="rn-ac-metrics">
              <article className="rn-ac-metric">
                <span className="rn-ac-metric-icon rn-ac-green">
                  ✓
                </span>
                <div>
                  <span>Correct answers</span>
                  <strong>{correctAnswers}</strong>
                </div>
              </article>

              <article className="rn-ac-metric">
                <span className="rn-ac-metric-icon rn-ac-red">
                  !
                </span>
                <div>
                  <span>Incorrect answers</span>
                  <strong>{incorrectAnswers}</strong>
                </div>
              </article>

              <article className="rn-ac-metric">
                <span className="rn-ac-metric-icon rn-ac-blue">
                  #
                </span>
                <div>
                  <span>Total questions</span>
                  <strong>{totalQuestions}</strong>
                </div>
              </article>

              <article className="rn-ac-metric">
                <span className="rn-ac-metric-icon rn-ac-purple">
                  ◷
                </span>
                <div>
                  <span>Time spent</span>
                  <strong>{formatDuration(elapsedSeconds)}</strong>
                </div>
              </article>
            </div>
          </section>
        </div>

        <section className="rn-ac-skills-panel">
          <div className="rn-ac-section-header">
            <div>
              <div className="rn-ac-section-eyebrow">
                SKILL ANALYSIS
              </div>

              <h3>Your assessed skills</h3>

              <p>
                Explore your performance in the skills covered by
                this course.
              </p>
            </div>

            <span className="rn-ac-count">
              {skills.length} {skills.length === 1 ? "skill" : "skills"}
            </span>
          </div>

          {skills.length === 0 ? (
            <div className="rn-ac-no-skills">
              <strong>No skill breakdown available</strong>
              <p>
                Your overall result is available, but individual skill
                results were not returned for this attempt.
              </p>
            </div>
          ) : (
            <div className="rn-ac-skill-grid">
              {skills.map((skill) => {
                const skillScore = safePercentage(skill.score);
                const skillPassed = skillScore >= 70;

                return (
                  <article
                    key={skill.id}
                    className="rn-ac-skill-card"
                  >
                    <div className="rn-ac-skill-heading">
                      <div className="rn-ac-skill-copy">
                        <strong>{skill.name}</strong>
                        <span>{formatLevel(skill.level)}</span>
                      </div>

                      <strong
                        className={
                          skillPassed
                            ? "rn-ac-skill-score-good"
                            : "rn-ac-skill-score-review"
                        }
                      >
                        {skillScore}%
                      </strong>
                    </div>

                    <div
                      className="rn-ac-progress-track rn-ac-skill-track"
                      role="progressbar"
                      aria-label={`${skill.name} score`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={skillScore}
                    >
                      <div
                        className={`rn-ac-progress-fill ${
                          skillPassed
                            ? "rn-ac-green-fill"
                            : "rn-ac-amber-fill"
                        }`}
                        style={{ width: `${skillScore}%` }}
                      />
                    </div>

                    <div className="rn-ac-skill-footer">
                      <span>
                        {skill.correct} of {skill.total} correct
                      </span>
                      <span>
                        {skillPassed ? "Strong result" : "Room to improve"}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <nav
          className="rn-ac-actions"
          aria-label="Assessment result actions"
        >
          <Link
            href={`/student/assessment/results/${encodeURIComponent(
              result.attemptId
            )}`}
            className="rn-ac-action rn-ac-action-primary"
          >
            View Full Result →
          </Link>

          <Link
            href="/student/assessment/results"
            className="rn-ac-action rn-ac-action-secondary"
          >
            All Assessment Results
          </Link>

          <Link
            href="/student/skills"
            className="rn-ac-action rn-ac-action-secondary"
          >
            View My Skills
          </Link>

          <Link
            href="/student/dashboard"
            className="rn-ac-action rn-ac-action-secondary"
          >
            My Dashboard
          </Link>

          <button
            type="button"
            className="rn-ac-action rn-ac-action-secondary"
            onClick={restart}
          >
            Retake Assessment
          </button>
        </nav>

        <style>{`
          .rn-ac-result,
          .rn-ac-result * {
            box-sizing: border-box;
          }

          .rn-ac-result {
            --ac-blue: #0a66c2;
            --ac-blue-dark: #004182;
            --ac-text: #191919;
            --ac-muted: #666a70;
            --ac-border: #dfe3e8;

            width: 100%;
            max-width: 1120px;
            min-width: 0;
            margin: 24px auto 36px;
            padding: clamp(12px, 2.8vw, 24px);
            overflow: hidden;
            border: 1px solid var(--ac-border);
            border-radius: 14px;
            background: #f3f5f8;
            color: var(--ac-text);
          }

          .rn-ac-result-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 20px;
            padding: 24px;
            border: 1px solid var(--ac-border);
            border-radius: 11px;
            background: #fff;
          }

          .rn-ac-heading-copy {
            flex: 1;
            min-width: 0;
          }

          .rn-ac-eyebrow {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 10px;
            color: var(--ac-blue);
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 1px;
          }

          .rn-ac-eyebrow-dot {
            width: 8px;
            height: 8px;
            flex: 0 0 8px;
            border-radius: 50%;
            background: var(--ac-blue);
          }

          .rn-ac-heading-copy h2 {
            margin: 0;
            font-size: clamp(22px, 3vw, 29px);
            font-weight: 750;
            line-height: 1.3;
            letter-spacing: -0.5px;
            overflow-wrap: anywhere;
          }

          .rn-ac-course-title {
            margin: 8px 0 0;
            color: #353a40;
            font-size: 14px;
            font-weight: 700;
            line-height: 1.55;
            overflow-wrap: anywhere;
          }

          .rn-ac-intro {
            max-width: 600px;
            margin: 8px 0 0;
            color: var(--ac-muted);
            font-size: 13px;
            line-height: 1.7;
          }

          .rn-ac-status {
            display: inline-flex;
            flex: 0 0 auto;
            align-items: center;
            justify-content: center;
            gap: 7px;
            max-width: 100%;
            padding: 8px 12px;
            border-radius: 22px;
            font-size: 11px;
            font-weight: 750;
            line-height: 1.4;
          }

          .rn-ac-passed {
            background: #e8f6ed;
            color: #176b3c;
          }

          .rn-ac-needs-review {
            background: #fff3df;
            color: #86540a;
          }

          .rn-ac-overview {
            display: grid;
            grid-template-columns: minmax(0, .88fr) minmax(0, 1.35fr);
            gap: 16px;
            margin-top: 16px;
          }

          .rn-ac-score-card {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            justify-content: center;
            min-width: 0;
            padding: 24px;
            border: 1px solid #cfe0f2;
            border-radius: 11px;
            background: #edf5fd;
          }

          .rn-ac-score-label {
            color: #4d6275;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: .9px;
          }

          .rn-ac-score-number {
            display: flex;
            align-items: baseline;
            gap: 2px;
            max-width: 100%;
            margin-top: 10px;
            color: var(--ac-blue);
            font-size: clamp(38px, 5vw, 55px);
            font-weight: 800;
            letter-spacing: -1.7px;
            line-height: 1.1;
            white-space: nowrap;
          }

          .rn-ac-score-number span {
            font-size: .53em;
            letter-spacing: -.3px;
          }

          .rn-ac-score-description {
            margin: 10px 0 0;
            color: #4d6275;
            font-size: 12px;
            line-height: 1.65;
          }

          .rn-ac-progress-track {
            width: 100%;
            height: 7px;
            margin-top: 19px;
            overflow: hidden;
            border-radius: 20px;
            background: #dce4ec;
          }

          .rn-ac-progress-fill {
            height: 100%;
            max-width: 100%;
            border-radius: inherit;
            transition: width 250ms ease;
          }

          .rn-ac-green-fill {
            background: #21884e;
          }

          .rn-ac-amber-fill {
            background: #d18b24;
          }

          .rn-ac-score-scale {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            width: 100%;
            margin-top: 7px;
            color: #637589;
            font-size: 9px;
            line-height: 1.5;
          }

          .rn-ac-summary-card,
          .rn-ac-skills-panel {
            min-width: 0;
            padding: 22px;
            border: 1px solid var(--ac-border);
            border-radius: 11px;
            background: #fff;
          }

          .rn-ac-summary-heading h3,
          .rn-ac-section-header h3 {
            margin: 0;
            font-size: 17px;
            font-weight: 750;
            letter-spacing: -.3px;
          }

          .rn-ac-summary-heading p,
          .rn-ac-section-header p {
            margin: 5px 0 0;
            color: var(--ac-muted);
            font-size: 12px;
            line-height: 1.7;
          }

          .rn-ac-metrics {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 18px 14px;
            margin-top: 22px;
          }

          .rn-ac-metric {
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 0;
          }

          .rn-ac-metric-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 34px;
            height: 34px;
            flex: 0 0 34px;
            border-radius: 9px;
            font-size: 15px;
            font-weight: 800;
          }

          .rn-ac-green {
            background: #e6f5ec;
            color: #16834a;
          }

          .rn-ac-red {
            background: #fceaea;
            color: #b53333;
          }

          .rn-ac-blue {
            background: #e8f2fc;
            color: #0a66c2;
          }

          .rn-ac-purple {
            background: #f0eafd;
            color: #7550b3;
          }

          .rn-ac-metric > div {
            display: flex;
            flex-direction: column;
            gap: 4px;
            min-width: 0;
          }

          .rn-ac-metric > div > span {
            color: var(--ac-muted);
            font-size: 10px;
            line-height: 1.5;
            overflow-wrap: anywhere;
          }

          .rn-ac-metric > div > strong {
            font-size: 21px;
            font-weight: 800;
            line-height: 1.2;
            overflow-wrap: anywhere;
          }

          .rn-ac-skills-panel {
            margin-top: 16px;
          }

          .rn-ac-section-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 15px;
            margin-bottom: 19px;
          }

          .rn-ac-section-header > div {
            min-width: 0;
          }

          .rn-ac-section-eyebrow {
            margin-bottom: 7px;
            color: var(--ac-blue);
            font-size: 10px;
            font-weight: 800;
            letter-spacing: .9px;
          }

          .rn-ac-section-count {
            flex: 0 0 auto;
            padding: 6px 10px;
            border: 1px solid #d8e7f7;
            border-radius: 18px;
            background: #edf5fd;
            color: #0a579e;
            font-size: 10px;
            font-weight: 750;
          }

          .rn-ac-skill-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }

          .rn-ac-skill-card {
            min-width: 0;
            padding: 16px;
            border: 1px solid #e1e6eb;
            border-radius: 9px;
            background: #fff;
          }

          .rn-ac-skill-heading {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
            min-width: 0;
          }

          .rn-ac-skill-copy {
            display: flex;
            flex-direction: column;
            gap: 6px;
            min-width: 0;
          }

          .rn-ac-skill-copy strong {
            font-size: 12px;
            font-weight: 750;
            line-height: 1.55;
            overflow-wrap: anywhere;
          }

          .rn-ac-skill-copy span {
            color: var(--ac-muted);
            font-size: 10px;
          }

          .rn-ac-skill-score-good,
          .rn-ac-skill-score-review {
            flex: 0 0 auto;
            font-size: 20px;
            font-weight: 800;
            white-space: nowrap;
          }

          .rn-ac-skill-score-good {
            color: #16834a;
          }

          .rn-ac-skill-score-review {
            color: #a86b13;
          }

          .rn-ac-skill-track {
            height: 6px;
            margin-top: 15px;
          }

          .rn-ac-skill-footer {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            margin-top: 9px;
            color: var(--ac-muted);
            font-size: 10px;
            line-height: 1.6;
          }

          .rn-ac-skill-footer span {
            min-width: 0;
            overflow-wrap: anywhere;
          }

          .rn-ac-no-skills {
            padding: 16px;
            border: 1px solid #e1e6eb;
            border-radius: 9px;
            background: #f8fafc;
          }

          .rn-ac-no-skills strong {
            font-size: 12px;
          }

          .rn-ac-no-skills p {
            margin: 6px 0 0;
            color: var(--ac-muted);
            font-size: 11px;
            line-height: 1.7;
          }

          .rn-ac-actions {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 17px;
          }

          .rn-ac-action {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            min-height: 40px;
            padding: 10px 16px;
            border: 1px solid transparent;
            border-radius: 22px;
            font-family: inherit;
            font-size: 11px;
            font-weight: 750;
            line-height: 1.4;
            text-align: center;
            text-decoration: none;
            cursor: pointer;
            transition: background 150ms ease, border-color 150ms ease;
          }

          .rn-ac-action-primary {
            border-color: var(--ac-blue);
            background: var(--ac-blue);
            color: #fff;
          }

          .rn-ac-action-primary:hover {
            border-color: var(--ac-blue-dark);
            background: var(--ac-blue-dark);
            color: #fff;
          }

          .rn-ac-action-secondary {
            border-color: #b7c0ca;
            background: #fff;
            color: #343a40;
          }

          .rn-ac-action-secondary:hover {
            border-color: var(--ac-blue);
            background: #edf5fd;
            color: var(--ac-blue);
          }

          .rn-ac-action:focus-visible {
            outline: 3px solid rgb(10 102 194 / 30%);
            outline-offset: 3px;
          }

          @media (max-width: 800px) {
            .rn-ac-overview {
              grid-template-columns: minmax(0, 1fr);
            }

            .rn-ac-score-number {
              font-size: clamp(38px, 7vw, 50px);
            }
          }

          @media (max-width: 560px) {
            .rn-ac-result {
              margin-top: 15px;
              padding: 10px;
              border-radius: 10px;
            }

            .rn-ac-result-header {
              flex-direction: column;
              align-items: flex-start;
              gap: 14px;
              padding: 18px 15px;
            }

            .rn-ac-heading-copy h2 {
              font-size: 23px;
            }

            .rn-ac-intro {
              font-size: 12px;
            }

            .rn-ac-overview {
              gap: 11px;
              margin-top: 11px;
            }

            .rn-ac-score-card {
              padding: 19px 16px;
            }

            .rn-ac-score-number {
              font-size: clamp(32px, 9vw, 43px);
              letter-spacing: -1px;
            }

            .rn-ac-score-description {
              font-size: 11px;
            }

            .rn-ac-score-scale {
              font-size: 8px;
            }

            .rn-ac-summary-card,
            .rn-ac-skills-panel {
              padding: 17px 14px;
            }

            .rn-ac-metrics {
              gap: 17px 10px;
              margin-top: 18px;
            }

            .rn-ac-metric {
              align-items: flex-start;
              gap: 8px;
            }

            .rn-ac-metric-icon {
              width: 29px;
              height: 29px;
              flex-basis: 29px;
              font-size: 13px;
            }

            .rn-ac-metric > div > span {
              font-size: 9px;
            }

            .rn-ac-metric > div > strong {
              font-size: 19px;
            }

            .rn-ac-section-header {
              gap: 9px;
            }

            .rn-ac-section-header h3 {
              font-size: 17px;
            }

            .rn-ac-section-header p {
              font-size: 11px;
            }

            .rn-ac-section-count {
              padding: 5px 8px;
              font-size: 9px;
            }

            .rn-ac-skill-grid {
              grid-template-columns: minmax(0, 1fr);
              gap: 10px;
            }

            .rn-ac-skill-card {
              padding: 14px;
            }

            .rn-ac-skill-score-good,
            .rn-ac-skill-score-review {
              font-size: 19px;
            }

            .rn-ac-actions {
              display: grid;
              grid-template-columns: minmax(0, 1fr);
              gap: 9px;
              margin-top: 13px;
            }

            .rn-ac-action {
              width: 100%;
              min-height: 42px;
              padding: 10px 13px;
              font-size: 12px;
            }
          }

          @media (max-width: 350px) {
            .rn-ac-result {
              padding: 8px;
            }

            .rn-ac-result-header {
              padding: 15px 12px;
            }

            .rn-ac-heading-copy h2 {
              font-size: 21px;
            }

            .rn-ac-score-number {
              font-size: 32px;
            }

            .rn-ac-summary-card {
              padding: 15px 11px;
            }

            .rn-ac-metric {
              gap: 6px;
            }

            .rn-ac-metric-icon {
              width: 25px;
              height: 25px;
              flex-basis: 25px;
            }

            .rn-ac-metric > div > span {
              font-size: 8px;
            }

            .rn-ac-metric > div > strong {
              font-size: 18px;
            }

            .rn-ac-skill-footer {
              flex-direction: column;
              gap: 3px;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .rn-ac-result *,
            .rn-ac-result *::before,
            .rn-ac-result *::after {
              transition-duration: 0.01ms !important;
              animation-duration: 0.01ms !important;
            }
          }
        `}</style>
      </section>
    );
  }

  return (
    <section
      className="rn-assessment-card"
      aria-labelledby="rn-current-question"
    >
      <div className="rn-assessment-progress-row">
        <span>
          Question {currentIndex + 1} of {questions.length}
        </span>

        <strong>
          {answeredCount}/{questions.length} answered
        </strong>
      </div>

      <div
        className="rn-assessment-progress"
        role="progressbar"
        aria-label="Assessment progress"
        aria-valuemin={0}
        aria-valuemax={questions.length}
        aria-valuenow={currentIndex + 1}
      >
        <div style={{ width: `${progress}%` }} />
      </div>

      <div className="rn-question-meta">
        <span>{formatLevel(question.difficulty)}</span>
        <span>
          {currentIndex + 1}/{questions.length}
        </span>
      </div>

      <h2
        id="rn-current-question"
        className="rn-question"
        tabIndex={-1}
      >
        {question.question}
      </h2>

      <div
        className="rn-answer-list"
        role="group"
        aria-label="Answer options"
      >
        {question.options.map((option, index) => {
          const selected = selectedAnswer === option;

          return (
            <button
              key={`${question.id}-${index}`}
              type="button"
              className={`rn-answer-option${
                selected ? " is-selected" : ""
              }`}
              aria-pressed={selected}
              onClick={() => selectAnswer(option)}
              disabled={submitting}
            >
              <span className="rn-answer-radio" aria-hidden="true">
                {selected ? "✓" : String.fromCharCode(65 + index)}
              </span>

              <span className="rn-answer-copy">
                {option}
              </span>

              <span
                className="rn-answer-selected-label"
                aria-hidden="true"
              >
                {selected ? "Selected" : ""}
              </span>
            </button>
          );
        })}
      </div>

      <p
        className="rn-assessment-answer-status"
        aria-live="polite"
      >
        {selectedAnswer
          ? "Answer selected. You can change it before submission."
          : "Choose one answer to continue."}
      </p>

      {error ? (
        <div className="rn-assessment-error" role="alert">
          <strong>Assessment not submitted</strong>
          <span>{error}</span>
        </div>
      ) : null}

      <div className="rn-assessment-navigation">
        <button
          type="button"
          className="rn-button rn-button-secondary"
          onClick={previous}
          disabled={currentIndex === 0 || submitting}
        >
          Previous
        </button>

        {currentIndex < questions.length - 1 ? (
          <button
            type="button"
            className="rn-button rn-button-primary"
            onClick={next}
            disabled={submitting}
          >
            Save answer &amp; continue
          </button>
        ) : (
          <button
            type="button"
            className="rn-button rn-button-primary rn-assessment-submit"
            onClick={submitAssessment}
            disabled={submitting}
          >
            {submitting
              ? "Submitting assessment…"
              : "Submit Assessment"}
          </button>
        )}
      </div>

      {unansweredCount > 0 ? (
        <p className="rn-assessment-unanswered">
          {unansweredCount}{" "}
          {unansweredCount === 1
            ? "question is"
            : "questions are"}{" "}
          still unanswered.
        </p>
      ) : (
        <p className="rn-assessment-ready">
          All questions answered. Review your choices, then submit.
        </p>
      )}
    </section>
  );
}