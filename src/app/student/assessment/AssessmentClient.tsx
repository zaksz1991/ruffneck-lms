"use client";

import { useState } from "react";
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AssessmentResult | null>(null);

  if (questions.length === 0) {
    return (
      <section className="rn-assessment-card" role="status">
        <h2>Assessment unavailable</h2>
        <p>There are no published questions for this assessment yet.</p>
        <Link href="/student/dashboard" className="rn-button rn-button-secondary">
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
  const progress = Math.round(((currentIndex + 1) / questions.length) * 100);
  const unansweredCount = questions.length - answeredCount;

  function selectAnswer(answer: string) {
    setAnswers((previous) => ({ ...previous, [question.id]: answer }));
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
    setCurrentIndex((value) => Math.min(questions.length - 1, value + 1));
    setError(null);
  }

  async function submitAssessment() {
    if (submitting) return;

    const unanswered = questions.filter(
      (item) => !Object.prototype.hasOwnProperty.call(answers, item.id)
    );
    if (unanswered.length > 0) {
      const firstUnansweredIndex = questions.findIndex(
        (item) => !Object.prototype.hasOwnProperty.call(answers, item.id)
      );
      setCurrentIndex(firstUnansweredIndex);
      setError(
        `Answer all questions before submitting. ${unanswered.length} ${
          unanswered.length === 1 ? "question remains" : "questions remain"
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
      const response = await fetch("/api/student/assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, answers }),
      });

      let data: AssessmentResult | { error?: string };
      try {
        data = (await response.json()) as AssessmentResult | { error?: string };
      } catch {
        throw new Error("The server returned an unreadable response. Your answers are still on this page; try submitting again.");
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
    setCurrentIndex(0);
    setAnswers({});
    setResult(null);
    setError(null);
  }

  if (result) {
    return (
      <section className="rn-assessment-result" aria-live="polite">
        <div className="rn-result-hero">
          <span className="rn-eyebrow">ASSESSMENT COMPLETE</span>
          <h2>{courseTitle}</h2>
          <div className="rn-score-circle">
            <strong>{result.score}%</strong>
            <span>Overall score</span>
          </div>
          <p>
            You answered <strong>{result.correctAnswers}</strong> of{" "}
            <strong>{result.totalQuestions}</strong> questions correctly.
          </p>
        </div>

        <div className="rn-skill-results">
          <div className="rn-assessment-section-heading">
            <span className="rn-eyebrow">SKILL ANALYSIS</span>
            <h2>Your assessed skills</h2>
            <p>Your results are mapped to the skills covered by this course.</p>
          </div>
          <div className="rn-skill-result-grid">
            {result.skills.map((skill) => (
              <article key={skill.id} className="rn-skill-result-card">
                <div className="rn-skill-result-header">
                  <div>
                    <strong>{skill.name}</strong>
                    <span>
                      {skill.level.charAt(0).toUpperCase() + skill.level.slice(1)}
                    </span>
                  </div>
                  <strong>{skill.score}%</strong>
                </div>
                <div className="rn-skill-bar">
                  <div style={{ width: `${Math.max(0, Math.min(100, skill.score))}%` }} />
                </div>
                <small>{skill.correct} of {skill.total} correct</small>
              </article>
            ))}
          </div>
        </div>

        <div className="rn-assessment-actions">
          <Link
            href={`/student/assessment/results/${encodeURIComponent(result.attemptId)}`}
            className="rn-button rn-button-primary"
          >
            View Assessment Result
          </Link>
          <Link href="/student/assessment/results" className="rn-button rn-button-secondary">
            All Assessment Results
          </Link>
          <Link href="/student/skills" className="rn-button rn-button-secondary">
            View My Skills
          </Link>
          <Link href="/student/dashboard" className="rn-button rn-button-secondary">
            My Dashboard
          </Link>
          <button type="button" className="rn-button rn-button-secondary" onClick={restart}>
            Retake Assessment
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rn-assessment-card" aria-labelledby="rn-current-question">
      <div className="rn-assessment-progress-row">
        <span>Question {currentIndex + 1} of {questions.length}</span>
        <strong>{answeredCount}/{questions.length} answered</strong>
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
        <span>{question.difficulty.charAt(0).toUpperCase() + question.difficulty.slice(1)}</span>
        <span>{currentIndex + 1}/{questions.length}</span>
      </div>

      <h2 id="rn-current-question" className="rn-question" tabIndex={-1}>
        {question.question}
      </h2>

      <div className="rn-answer-list" role="group" aria-label="Answer options">
        {question.options.map((option, index) => {
          const selected = selectedAnswer === option;
          return (
            <button
              key={`${question.id}-${index}`}
              type="button"
              className={`rn-answer-option${selected ? " is-selected" : ""}`}
              aria-pressed={selected}
              onClick={() => selectAnswer(option)}
              disabled={submitting}
            >
              <span className="rn-answer-radio" aria-hidden="true">
                {selected ? "✓" : String.fromCharCode(65 + index)}
              </span>
              <span className="rn-answer-copy">{option}</span>
              <span className="rn-answer-selected-label" aria-hidden="true">
                {selected ? "Selected" : ""}
              </span>
            </button>
          );
        })}
      </div>

      <p className="rn-assessment-answer-status" aria-live="polite">
        {selectedAnswer ? "Answer selected. You can change it before submission." : "Choose one answer to continue."}
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
            {submitting ? "Submitting assessment…" : "Submit Assessment"}
          </button>
        )}
      </div>

      {unansweredCount > 0 ? (
        <p className="rn-assessment-unanswered">
          {unansweredCount} {unansweredCount === 1 ? "question is" : "questions are"} still unanswered.
        </p>
      ) : (
        <p className="rn-assessment-ready">All questions answered. Review your choices, then submit.</p>
      )}
    </section>
  );
}
