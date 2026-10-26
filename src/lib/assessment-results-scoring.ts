/**
 * RuffNeck Learn assessment score normalization.
 *
 * `assessment_attempts.score` is already a percentage (0..100). Prefer it
 * even when legacy earned_points/total_points are both zero. Only derive a
 * percentage from points when the stored score is absent and total_points > 0.
 * This module is read-only and never mutates database records.
 */
export type AssessmentAttemptScoreInput = {
  id?: string | null;
  score?: number | string | null;
  earned_points?: number | string | null;
  total_points?: number | string | null;
  total_questions?: number | string | null;
  time_spent_seconds?: number | string | null;
  completed_at?: string | null;
  created_at?: string | null;
};

export type NormalizedAssessmentAttempt<T extends AssessmentAttemptScoreInput> = {
  attempt: T;
  percentage: number | null;
  valid: boolean;
  reason: "stored_percentage" | "derived_from_points" | "invalid_percentage" | "missing_score" | "invalid_points" | "incomplete_attempt";
};

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundedPercentage(earned: number, total: number): number {
  return Math.max(0, Math.min(100, Math.round((earned / total) * 100)));
}

export function normalizeAssessmentAttempt<T extends AssessmentAttemptScoreInput>(
  attempt: T,
): NormalizedAssessmentAttempt<T> {
  const storedScore = finiteNumber(attempt.score);
  const earned = finiteNumber(attempt.earned_points);
  const total = finiteNumber(attempt.total_points);

  if (attempt.completed_at === "") {
    return { attempt, percentage: null, valid: false, reason: "incomplete_attempt" };
  }

  // The persisted `score` column is the canonical 0–100 percentage.
  // Do not divide it by total_questions or total_points.
  if (storedScore !== null) {
    if (storedScore >= 0 && storedScore <= 100) {
      return {
        attempt,
        percentage: Math.round(storedScore),
        valid: true,
        reason: "stored_percentage",
      };
    }
    return { attempt, percentage: null, valid: false, reason: "invalid_percentage" };
  }

  // Use point-based fallback only when the maximum is positive and reliable.
  if (earned !== null && total !== null) {
    if (total > 0 && earned >= 0 && earned <= total) {
      return {
        attempt,
        percentage: roundedPercentage(earned, total),
        valid: true,
        reason: "derived_from_points",
      };
    }
    if (total === 0) {
      return { attempt, percentage: null, valid: false, reason: "invalid_points" };
    }
  }

  return { attempt, percentage: null, valid: false, reason: "missing_score" };
}

export function summarizeAssessmentAttempts<T extends AssessmentAttemptScoreInput>(
  attempts: readonly T[],
  passThreshold = 70,
) {
  const normalized = attempts.map(normalizeAssessmentAttempt);
  const valid = normalized.filter(
    (entry): entry is typeof entry & { percentage: number } =>
      entry.valid && entry.percentage !== null,
  );
  const percentages = valid.map((entry) => entry.percentage);
  const exactAverage = percentages.length
    ? percentages.reduce((sum, score) => sum + score, 0) / percentages.length
    : null;

  return {
    attemptsCount: attempts.length,
    validAttemptsCount: valid.length,
    invalidAttemptsCount: normalized.length - valid.length,
    averageScore: exactAverage === null ? null : Math.round(exactAverage),
    averageScoreExact: exactAverage,
    bestScore: percentages.length ? Math.max(...percentages) : null,
    passedCount: percentages.filter((score) => score >= passThreshold).length,
    normalized,
  };
}

export function formatAssessmentPercentage(value: number | null): string {
  return value === null ? "Unavailable" : `${value}%`;
}

/** Display legacy duration safely; zero in old rows usually means unrecorded. */
export function formatAssessmentDuration(value: number | string | null | undefined): string {
  const seconds = finiteNumber(value);
  if (seconds === null || seconds <= 0) return "Not recorded";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
}
