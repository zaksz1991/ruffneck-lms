/** Shared defensive scoring helpers. Display/aggregation only; never rewrites rows. */
function finiteNonNegative(value) {
  if (typeof value === 'string' && value.trim() === '') return null;
  const n = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function firstPresent(...values) { return values.find(v => v !== undefined && v !== null); }
export function normalizeAssessmentScore(input = {}) {
  const earnedRaw = firstPresent(input.points_earned, input.earned_points, input.points);
  const possibleRaw = firstPresent(input.max_score, input.maximum_score, input.total_points, input.points_possible, input.max_points);
  const earned = finiteNonNegative(earnedRaw), possible = finiteNonNegative(possibleRaw);
  if (earnedRaw != null && earned === null) return { earned: null, possible, percentage: null, valid: false, reason: 'invalid-values' };
  if (possibleRaw != null && possible === null) return { earned, possible: null, percentage: null, valid: false, reason: 'invalid-values' };
  if (possible !== null) {
    if (possible <= 0 || earned === null) return { earned, possible, percentage: null, valid: false, reason: possible <= 0 ? 'invalid-maximum' : 'missing-score' };
    return { earned, possible, percentage: Math.round(Math.min(100, earned / possible * 100) * 10) / 10, valid: true, reason: 'valid' };
  }
  const legacyPercent = finiteNonNegative(input.score);
  if (legacyPercent === null) return { earned, possible: null, percentage: null, valid: false, reason: 'missing-score' };
  return { earned, possible: null, percentage: Math.round(Math.min(100, legacyPercent) * 10) / 10, valid: true, reason: 'valid' };
}
export function summarizeAssessmentScores(inputs, passThreshold = 70) {
  const normalized = inputs.map(normalizeAssessmentScore);
  const scores = normalized.filter(x => x.valid && x.percentage !== null).map(x => x.percentage);
  return { attempted: inputs.length, validAttempts: scores.length, invalidAttempts: normalized.length - scores.length,
    average: scores.length ? Math.round(scores.reduce((a,b) => a+b, 0) / scores.length * 10) / 10 : null,
    best: scores.length ? Math.max(...scores) : null, passed: scores.filter(s => s >= passThreshold).length, normalized };
}
export function formatAssessmentPercentage(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const n = Math.min(100, Math.max(0, value));
  return `${Number.isInteger(n) ? n : n.toFixed(1)}%`;
}
