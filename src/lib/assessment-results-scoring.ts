/**
 * RuffNeck Learn assessment-result normalization.
 *
 * A stored percentage is trusted only when it is finite and within 0..100.
 * If it is missing/invalid, a percentage can be reconstructed from earned_points
 * and total_points only when total_points > 0. A 0/0 record is not a score.
 * This module does not mutate database rows.
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
  const questions = finiteNumber(attempt.total_questions);

  // Completed attempts with an explicit timestamp are expected in this view.
  // Do not reject legacy records solely because a timestamp is absent in a
  // caller's minimal object; reject only if a supplied timestamp is empty.
  if (attempt.completed_at === "") {
    return { attempt, percentage: null, valid: false, reason: "incomplete_attempt" };
  }

  if (storedScore !== null) {
    if (storedScore >= 0 && storedScore <= 100) {
      return {
        attempt,
        percentage: Math.round(storedScore),
        valid: true,
        reason: "stored_percentage",
      };
    }
    // Some legacy records have 767/833 stored in a percentage column.
    // Never clamp these to 100: doing so would falsely award a perfect score.
    return { attempt, percentage: null, valid: false, reason: "invalid_percentage" };
  }

  if (earned !== null && total !== null) {
    if (total > 0 && earned >= 0 && earned <= total) {
      return {
        attempt,
        percentage: roundedPercentage(earned, total),
        valid: true,
        reason: "derived_from_points",
      };
    }
    return { attempt, percentage: null, valid: false, reason: "invalid_points" };
  }

  if (questions !== null && questions <= 0) {
    return { attempt, percentage: null, valid: false, reason: "invalid_points" };
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
  return {
    attemptsCount: attempts.length,
    validAttemptsCount: valid.length,
    invalidAttemptsCount: normalized.length - valid.length,
    averageScore:
      percentages.length > 0
        ? Math.round(percentages.reduce((sum, score) => sum + score, 0) / percentages.length)
        : null,
    bestScore: percentages.length > 0 ? Math.max(...percentages) : null,
    passedCount: percentages.filter((score) => score >= passThreshold).length,
    normalized,
  };
}

export function formatAssessmentPercentage(value: number | null): string {
  return value === null ? "Unavailable" : `${value}%`;
}
