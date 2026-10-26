import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAssessmentAttempt,
  summarizeAssessmentAttempts,
  formatAssessmentPercentage,
  formatAssessmentDuration,
} from '../src/lib/assessment-results-scoring.ts';

const actualLegacyRows = [
  { id: '27d5cc81-1346-467c-8099-fa41384f0241', score: 100, earned_points: 0, total_points: 0, total_questions: 12, time_spent_seconds: 0 },
  { id: 'e6d10246-cf7f-43e0-b58a-e71e2d048018', score: 100, earned_points: 0, total_points: 0, total_questions: 12, time_spent_seconds: 0 },
  { id: 'fe821802-fa4f-4e2c-a1bc-6dea9b005c0c', score: 92, earned_points: 0, total_points: 0, total_questions: 12, time_spent_seconds: 0 },
];

test('uses stored score as a percentage even when legacy points are 0/0', () => {
  assert.equal(normalizeAssessmentAttempt(actualLegacyRows[0]).percentage, 100);
  assert.equal(normalizeAssessmentAttempt(actualLegacyRows[1]).percentage, 100);
  assert.equal(normalizeAssessmentAttempt(actualLegacyRows[2]).percentage, 92);
  assert.equal(normalizeAssessmentAttempt(actualLegacyRows[2]).valid, true);
});

test('matches expected five-attempt page statistics', () => {
  const summary = summarizeAssessmentAttempts([
    { score: 100, earned_points: 26, total_points: 26 },
    { score: 100, earned_points: 26, total_points: 26 },
    ...actualLegacyRows,
  ]);
  assert.equal(summary.attemptsCount, 5);
  assert.equal(summary.validAttemptsCount, 5);
  assert.equal(summary.averageScoreExact, 98.4);
  assert.equal(summary.averageScore, 98);
  assert.equal(summary.bestScore, 100);
  assert.equal(summary.passedCount, 5);
});

test('rejects genuinely invalid stored percentages instead of clamping them', () => {
  assert.equal(normalizeAssessmentAttempt({ score: 833, total_points: 0, earned_points: 0 }).percentage, null);
  assert.equal(normalizeAssessmentAttempt({ score: 767 }).reason, 'invalid_percentage');
});

test('derives a score from points only when total_points is positive', () => {
  assert.equal(normalizeAssessmentAttempt({ score: null, earned_points: 7, total_points: 10 }).percentage, 70);
  assert.equal(normalizeAssessmentAttempt({ score: null, earned_points: 0, total_points: 0 }).valid, false);
});

test('pass threshold is inclusive at 70 percent', () => {
  assert.equal(summarizeAssessmentAttempts([{ score: 69 }, { score: 70 }]).passedCount, 1);
});

test('formats zero legacy duration as not recorded', () => {
  assert.equal(formatAssessmentDuration(0), 'Not recorded');
  assert.equal(formatAssessmentDuration(71), '1m 11s');
});

test('empty or invalid score set is unavailable, not a zero score', () => {
  const summary = summarizeAssessmentAttempts([{ score: 833, total_points: 0, earned_points: 0 }]);
  assert.equal(summary.averageScore, null);
  assert.equal(summary.bestScore, null);
  assert.equal(summary.passedCount, 0);
  assert.equal(formatAssessmentPercentage(summary.averageScore), 'Unavailable');
});
