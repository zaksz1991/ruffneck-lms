"use client";

import { useState } from "react";
import Link from "next/link";

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
  skills: SkillResult[];
};

export default function AssessmentClient({
  courseId,
  courseTitle,
  questions,
}: {
  courseId: string;
  courseTitle: string;
  questions: Question[];
}) {
  const [currentIndex, setCurrentIndex] =
    useState(0);

  const [answers, setAnswers] =
    useState<Record<string, string>>({});

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [result, setResult] =
    useState<AssessmentResult | null>(null);

  const question = questions[currentIndex];

  const selectedAnswer =
    answers[question.id];

  const answeredCount =
    Object.keys(answers).length;

  const progress = Math.round(
    ((currentIndex + 1) /
      questions.length) *
      100
  );

  function selectAnswer(answer: string) {
    setAnswers((previous) => ({
      ...previous,
      [question.id]: answer,
    }));

    setError(null);
  }

  function previous() {
    setCurrentIndex((value) =>
      Math.max(0, value - 1)
    );
  }

  function next() {
    if (!selectedAnswer) {
      setError(
        "Select an answer before continuing."
      );
      return;
    }

    setCurrentIndex((value) =>
      Math.min(
        questions.length - 1,
        value + 1
      )
    );

    setError(null);
  }

  async function submitAssessment() {
    if (!selectedAnswer) {
      setError(
        "Select an answer before submitting."
      );
      return;
    }

    if (
      Object.keys(answers).length !==
      questions.length
    ) {
      setError(
        `Please answer all ${questions.length} questions before submitting.`
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        "/api/student/assessment",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            courseId,
            answers,
          }),
        }
      );

      const data =
        (await response.json()) as
          | AssessmentResult
          | { error?: string };

      if (!response.ok) {
        throw new Error(
          "error" in data && data.error
            ? data.error
            : "Unable to submit assessment."
        );
      }

      if (
        !("attemptId" in data) ||
        !data.attemptId
      ) {
        throw new Error(
          "Assessment was submitted, but no result ID was returned."
        );
      }

      setResult(
        data as AssessmentResult
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to submit assessment."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function restart() {
    setCurrentIndex(0);
    setAnswers({});
    setResult(null);
    setError(null);
  }

  if (result) {
    return (
      <section className="rn-assessment-result">
        <div className="rn-result-hero">
          <span className="rn-eyebrow">
            ASSESSMENT COMPLETE
          </span>

          <h2>
            {courseTitle}
          </h2>

          <div className="rn-score-circle">
            <strong>
              {result.score}%
            </strong>

            <span>Overall score</span>
          </div>

          <p>
            You answered{" "}
            <strong>
              {result.correctAnswers}
            </strong>{" "}
            of{" "}
            <strong>
              {result.totalQuestions}
            </strong>{" "}
            questions correctly.
          </p>
        </div>

        <div className="rn-skill-results">
          <div className="rn-assessment-section-heading">
            <span className="rn-eyebrow">
              SKILL ANALYSIS
            </span>

            <h2>
              Your assessed skills
            </h2>

            <p>
              Your results are mapped to the skills
              covered by this course.
            </p>
          </div>

          <div className="rn-skill-result-grid">
            {result.skills.map(
              (skill) => (
                <article
                  key={skill.id}
                  className="rn-skill-result-card"
                >
                  <div className="rn-skill-result-header">
                    <div>
                      <strong>
                        {skill.name}
                      </strong>

                      <span>
                        {skill.level
                          .charAt(0)
                          .toUpperCase() +
                          skill.level.slice(
                            1
                          )}
                      </span>
                    </div>

                    <strong>
                      {skill.score}%
                    </strong>
                  </div>

                  <div className="rn-skill-bar">
                    <div
                      style={{
                        width: `${skill.score}%`,
                      }}
                    />
                  </div>

                  <small>
                    {skill.correct} of{" "}
                    {skill.total} correct
                  </small>
                </article>
              )
            )}
          </div>
        </div>

        <div className="rn-assessment-actions">
          <Link
            href={`/student/assessment/results/${encodeURIComponent(
              result.attemptId
            )}`}
            className="rn-button rn-button-primary"
          >
            View Assessment Result
          </Link>

          <Link
            href="/student/assessment/results"
            className="rn-button rn-button-secondary"
          >
            All Assessment Results
          </Link>

          <Link
            href="/student/skills"
            className="rn-button rn-button-secondary"
          >
            View My Skills
          </Link>

          <Link
            href="/student/dashboard"
            className="rn-button rn-button-secondary"
          >
            My Dashboard
          </Link>

          <button
            type="button"
            className="rn-button rn-button-secondary"
            onClick={restart}
          >
            Retake Assessment
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rn-assessment-card">
      <div className="rn-assessment-progress-row">
        <span>
          Question {currentIndex + 1} of{" "}
          {questions.length}
        </span>

        <strong>
          {answeredCount}/
          {questions.length} answered
        </strong>
      </div>

      <div className="rn-assessment-progress">
        <div
          style={{
            width: `${progress}%`,
          }}
        />
      </div>

      <div className="rn-question-meta">
        <span>
          {question.difficulty
            .charAt(0)
            .toUpperCase() +
            question.difficulty.slice(1)}
        </span>

        <span>
          {currentIndex + 1}/
          {questions.length}
        </span>
      </div>

      <h2 className="rn-question">
        {question.question}
      </h2>

      <div className="rn-answer-list">
        {question.options.map(
          (option, index) => {
            const selected =
              selectedAnswer === option;

            return (
              <button
                key={`${question.id}-${index}`}
                type="button"
                className={`rn-answer-option ${
                  selected
                    ? "is-selected"
                    : ""
                }`}
                onClick={() =>
                  selectAnswer(option)
                }
              >
                <span className="rn-answer-radio">
                  {selected ? "✓" : ""}
                </span>

                <span>{option}</span>
              </button>
            );
          }
        )}
      </div>

      {error ? (
        <div className="error">
          {error}
        </div>
      ) : null}

      <div className="rn-assessment-navigation">
        <button
          type="button"
          className="rn-button rn-button-secondary"
          onClick={previous}
          disabled={
            currentIndex === 0 ||
            submitting
          }
        >
          Previous
        </button>

        {currentIndex <
        questions.length - 1 ? (
          <button
            type="button"
            className="rn-button rn-button-primary"
            onClick={next}
            disabled={submitting}
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            className="rn-button rn-button-primary"
            onClick={submitAssessment}
            disabled={submitting}
          >
            {submitting
              ? "Submitting…"
              : "Submit Assessment"}
          </button>
        )}
      </div>
    </section>
  );
}