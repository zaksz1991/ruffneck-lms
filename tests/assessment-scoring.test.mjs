import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAssessmentScore, summarizeAssessmentScores, formatAssessmentPercentage } from "../src/lib/assessment-scoring.mjs";

test("uses earned / possible points for a valid score", () => {
  assert.equal(normalizeAssessmentScore({ points_earned: 26, max_score: 26 }).percentage, 100);
  assert.equal(normalizeAssessmentScore({ points_earned: 7, max_score: 10 }).percentage, 70);
});

test("does not treat 0/0 as a passing score", () => {
  const result = normalizeAssessmentScore({ points_earned: 0, max_score: 0 });
  assert.equal(result.valid, false);
  assert.equal(result.percentage, null);
});

test("caps impossible percentages at 100", () => {
  assert.equal(normalizeAssessmentScore({ score: 833 }).percentage, 100);
  assert.equal(formatAssessmentPercentage(833), "100%");
});

test("does not fabricate a score when the score is missing", () => {
  assert.equal(normalizeAssessmentScore({ max_score: 12 }).percentage, null);
  assert.equal(normalizeAssessmentScore({}).percentage, null);
});

test("aggregates only valid scores and uses a 70% pass threshold", () => {
  const summary = summarizeAssessmentScores([
    { points_earned: 26, max_score: 26 },
    { points_earned: 7, max_score: 10 },
    { points_earned: 0, max_score: 0 },
    { score: 833 },
  ]);
  assert.equal(summary.validAttempts, 3);
  assert.equal(summary.invalidAttempts, 1);
  assert.equal(summary.average, 90);
  assert.equal(summary.best, 100);
  assert.equal(summary.passed, 3);
});

test("formats unavailable scores safely", () => {
  assert.equal(formatAssessmentPercentage(null), "—");
  assert.equal(formatAssessmentPercentage(76.7), "76.7%");
});
