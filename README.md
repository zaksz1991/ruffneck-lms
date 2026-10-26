# RuffNeck Learn — Assessment Results Scoring Repair

## What this package fixes

- Rejects stored percentages outside `0..100`; `767` and `833` are not silently clamped to 100.
- Reconstructs a percentage from `earned_points / total_points` only when `total_points > 0` and the values are consistent.
- Treats `0/0` records as invalid for score statistics instead of counting them as passed.
- Computes average, best score and pass count from valid attempts only; pass threshold defaults to 70% inclusive.
- Keeps invalid historical attempts visible to the UI through `normalized` and exposes their reason, without deleting or rewriting database rows.
- Includes a read-only SQL diagnostic query for legacy records.

## Important integration boundary

This is a scoring module plus tests and a read-only diagnostic. It is **not yet wired into** `src/app/student/assessment/results/page.tsx`, any individual result page, or the deployed Vercel app. The currently available project material in this workspace does not include the latest results-page source, so replacing that page would risk breaking authentication, Supabase query handling, and existing layout. Do not claim this package has repaired the live page until the module is integrated and the page is tested.

## GUI integration checklist

1. In the current `ruffneck-lms` project, add `src/lib/assessment-results-scoring.ts` at the path shown in this ZIP.
2. Add `tests/assessment-results-scoring.test.mjs` to the project test suite. This test file imports TypeScript directly and may require the project's existing TypeScript test runner; if Node cannot load `.ts` directly in the project's Node version, run it through the existing test runner or compile the helper to JavaScript for tests.
3. In `src/app/student/assessment/results/page.tsx`, normalize the existing `assessment_attempts` rows using `normalizeAssessmentAttempt` and use `summarizeAssessmentAttempts` for the metric cards. Render invalid records with a neutral “Score unavailable — legacy record needs review” state rather than a percentage or “Passed” badge.
4. Apply the same normalizer to `/student/assessment/results/[resultId]` so history and individual detail pages agree. Keep the existing logged-in user check and `student_id` query filter unchanged.
5. Before changing legacy rows, use the read-only SQL file to inspect the original data and determine whether old answers allow their scores to be reconstructed. Do not delete or rewrite attempts based on the displayed `0/0` alone.
6. Run the project's full test suite and build, then check the results page and detail routes in a browser. This package does not perform deployment.

## Verification status

The included tests cover normalization and summary logic. They do not verify the Next.js app, Supabase schema, authentication, browser rendering, or live deployment.
