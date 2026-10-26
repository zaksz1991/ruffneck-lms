# RuffNeck Learn — Assessment Results Score Calculation Fix

## Diagnosis from the supplied database rows

The three legacy rows have `score` values of **100, 100, and 92**. In this application, `score` is already a percentage from 0 to 100. Their `total_questions` value of 12 is not the denominator for that percentage. Dividing `score` by `total_questions` and multiplying by 100 creates the exact displayed errors: 100 / 12 × 100 ≈ 833%, and 92 / 12 × 100 ≈ 767%.

The `earned_points = 0`, `total_points = 0`, and `time_spent_seconds = 0` values show missing legacy detail; they do not invalidate the stored percentage score. Do not overwrite or delete these records based on those fields alone.

For the five displayed attempts (100, 100, 100, 100, 92), expected summary values are:

- Completed attempts: **5**
- Exact average: **98.4%** (if the card uses whole percentages, show **98%**)
- Best score: **100%**
- Passed at a 70% threshold: **5**

## Contents

- `src/lib/assessment-results-scoring.ts`: normalizes the canonical stored percentage and computes summary statistics.
- `tests/assessment-results-scoring.test.mjs`: seven regression tests including the exact legacy records and expected summary.
- `supabase/diagnose-legacy-assessment-attempts.sql`: read-only query for the three supplied records.

## Integration boundary

This is a source update package, not a deployment. The current `src/app/student/assessment/results/page.tsx` and `src/app/student/assessment/results/[resultId]/page.tsx` have not been modified here because their current source was not supplied in this conversation. To complete the live repair, import the helper into the existing results page, use `summarizeAssessmentAttempts` for the cards, use each normalized `percentage` for row badges, and apply the same normalizer to individual result pages. Preserve the current authentication and student ownership filters.

Do not recalculate `score` in the database. Do not treat `total_questions` as a score denominator. For legacy zero durations, render “Not recorded” rather than “0s”.

## Test command

Run these tests through the project's existing test runner. Node versions supporting TypeScript type stripping may run the `.mjs` file directly; otherwise use the project's established TypeScript test setup. The tests do not verify Next.js integration, Supabase access controls, browser rendering, or deployment.
