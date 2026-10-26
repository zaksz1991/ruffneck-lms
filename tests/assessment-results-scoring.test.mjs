import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAssessmentAttempt,
  summarizeAssessmentAttempts,
  formatAssessmentPercentage,
} from '../src/lib/assessment-results-scoring.ts';

test('accepts valid stored percentages', () => {
  assert.equal(normalizeAssessmentAttempt({ score: 100, earned_points: 26, total_points: 26 }).percentage, 100);
  assert.equal(normalizeAssessmentAttempt({ score: 70 }).valid, true);
});

test('rejects legacy percentages above 100 instead of clamping them', () => {
  assert.equal(normalizeAssessmentAttempt({ score: 833, earned_points: 0, total_points: 0 }).percentage, null);
  assert.equal(normalizeAssessmentAttempt({ score: 767 }).reason, 'invalid_percentage');
});

test('reconstructs percentage only when points have a positive maximum', () => {
  assert.equal(normalizeAssessmentAttempt({ score: null, earned_points: 7, total_points: 10 }).percentage, 70);
  assert.equal(normalizeAssessmentAttempt({ score: null, earned_points: 0, total_points: 0 }).valid, false);
});

test('does not count invalid legacy attempts in summary statistics', () => {
  const summary = summarizeAssessmentAttempts([
    { score: 100, earned_points: 26, total_points: 26 },
    { score: 100, earned_points: 26, total_points: 26 },
    { score: 833, earned_points: 0, total_points: 0 },
    { score: 833, earned_points: 0, total_points: 0 },
    { score: 767, earned_points: 0, total_points: 0 },
  ]);
  assert.equal(summary.attemptsCount, 5);
  assert.equal(summary.validAttemptsCount, 2);
  assert.equal(summary.invalidAttemptsCount, 3);
  assert.equal(summary.averageScore, 100);
  assert.equal(summary.bestScore, 100);
  assert.equal(summary.passedCount, 2);
});

test('pass threshold is inclusive at 70 percent', () => {
  assert.equal(summarizeAssessmentAttempts([{ score: 69 }, { score: 70 }]).passedCount, 1);
});

test('empty valid score set is represented as unavailable, not zero', () => {
  const summary = summarizeAssessmentAttempts([{ score: 833, total_points: 0, earned_points: 0 }]);
  assert.equal(summary.averageScore, null);
  assert.equal(summary.bestScore, null);
  assert.equal(summary.passedCount, 0);
  assert.equal(formatAssessmentPercentage(summary.averageScore), 'Unavailable');
});
