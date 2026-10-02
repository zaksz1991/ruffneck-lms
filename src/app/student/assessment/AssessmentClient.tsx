"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Question = {
  id: string;
  question: string;
  questionType: string;
  options: string[];
  difficulty: string;
  sortOrder: number;
  skillId: string | null;
};

type Props = {
  courseId: string;
  courseTitle: string;
  questions: Question[];
};

type Result = {
  score: number;
  correct: number;
  total: number;
  skillResults: {
    skillName: string;
    correct: number;
    total: number;
    percentage: number;
    level: string;
  }[];
};

export default function AssessmentClient({
  courseId,
  courseTitle,
  questions,
}: Props) {
  const router = useRouter();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentQuestion = questions[currentIndex];

  const answeredCount = useMemo(
    () => Object.keys(answers).length,
    [answers]
  );

  const progress = Math.round(
    ((currentIndex + 1) / questions.length) * 100
  );

  function selectAnswer(answer: string) {
    setAnswers((previous) => ({
      ...previous,
      [currentQuestion.id]: answer,
    }));

    setError(null);
  }

  function nextQuestion() {
    if (!answers[currentQuestion.id]) {
      setError("Please select an answer before continuing.");
      return;
    }

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((previous) => previous + 1);
      setError(null);
      return;
    }

    submitAssessment();
  }

  function previousQuestion() {
    if (currentIndex > 0) {
      setCurrentIndex((previous) => previous - 1);
      setError(null);
    }
  }

  async function submitAssessment() {
    if (submitting) return;

    if (Object.keys(answers).length !== questions.length) {
      setError("Please answer all questions before submitting.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/student/assessment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          courseId,
          answers,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(
          data?.error ||
            "The assessment could not be submitted. Please try again."
        );
        return;
      }

      setResult(data.result);
    } catch {
      setError(
        "Unable to connect to the assessment service. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="rn-assessment-result">
        <div className="rn-result-hero">
          <span className="rn-eyebrow">Assessment complete</span>
          <h2>Your learning profile has been updated</h2>

          <div className="rn-score-circle">
            <strong>{result.score}%</strong>
            <span>Overall score</span>
          </div>

          <p>
            You answered <strong>{result.correct}</strong> of{" "}
            <strong>{result.total}</strong> questions correctly.
          </p>
        </div>

        <section className="rn-skill-results">
          <div className="rn-section-heading">
            <div>
              <span className="rn-eyebrow">Skill analysis</span>
              <h2>Your current skill profile</h2>
            </div>
          </div>

          <div className="rn-skill-result-grid">
            {result.skillResults.map((skill) => (
              <article
                className="rn-skill-result-card"
                key={skill.skillName}
              >
                <div className="rn-skill-result-top">
                  <strong>{skill.skillName}</strong>
                  <span>{skill.level}</span>
                </div>

                <div className="rn-skill-bar">
                  <span
                    style={{
                      width: `${skill.percentage}%`,
                    }}
                  />
                </div>

                <div className="rn-skill-result-meta">
                  <span>
                    {skill.correct}/{skill.total} correct
                  </span>
                  <span>{skill.percentage}%</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="rn-assessment-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => router.push("/student/dashboard")}
          >
            Go to My Learning
          </button>

          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => router.push("/student/skills")}
          >
            View My Skills
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="rn-assessment-card">
      <div className="rn-assessment-progress-row">
        <div>
          <strong>
            Question {currentIndex + 1} of {questions.length}
          </strong>
          <span>
            {answeredCount} of {questions.length} answered
          </span>
        </div>

        <strong>{progress}%</strong>
      </div>

      <div className="rn-assessment-progress">
        <span style={{ width: `${progress}%` }} />
      </div>

      <div className="rn-question">
        <div className="rn-question-meta">
          <span>Question {currentIndex + 1}</span>
          <span>
            {currentQuestion.difficulty.charAt(0).toUpperCase() +
              currentQuestion.difficulty.slice(1)}
          </span>
        </div>

        <h2>{currentQuestion.question}</h2>

        <div className="rn-answer-list">
          {currentQuestion.options.map((option) => {
            const selected =
              answers[currentQuestion.id] === option;

            return (
              <button
                key={option}
                type="button"
                className={`rn-answer-option ${
                  selected ? "selected" : ""
                }`}
                onClick={() => selectAnswer(option)}
              >
                <span className="rn-answer-radio">
                  {selected ? "✓" : ""}
                </span>

                <span>{option}</span>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="error rn-assessment-error">
            {error}
          </div>
        )}
      </div>

      <div className="rn-assessment-navigation">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={previousQuestion}
          disabled={currentIndex === 0 || submitting}
        >
          Previous
        </button>

        <button
          type="button"
          className="btn btn-primary"
          onClick={nextQuestion}
          disabled={submitting}
        >
          {submitting
            ? "Submitting…"
            : currentIndex === questions.length - 1
              ? "Submit Assessment"
              : "Next Question"}
        </button>
      </div>

      <p className="rn-assessment-course">
        Assessment: {courseTitle}
      </p>
    </section>
  );
}