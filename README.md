# RuffNeck Learn — assessment scoring repair (safe integration package)

## What this update provides
- One shared scoring helper for consistent percentages and summary cards.
- Rejects attempts with a zero/missing denominator instead of counting them as 100%.
- Prevents displayed percentages above 100%.
- Excludes invalid attempts from average, best-score, and pass-count calculations.
- Preserves all stored assessment rows; it does not delete or rewrite historical records.
- Includes six focused regression tests.

## Important integration note
This is a source overlay, not a deploy-ready replacement of the live page. The exact current route implementation and database schema were not available in this build session, so the helper is intentionally isolated rather than guessing at the route or modifying database queries.

## Integration
1. Copy `src/lib/assessment-scoring.mjs` into the matching path in the RuffNeck Learn repository.
2. In `src/app/student/assessment/results/page.tsx`, import:
   `import { summarizeAssessmentScores, formatAssessmentPercentage } from "@/lib/assessment-scoring";`
3. After the existing authorized query has returned the current student's attempts, map each attempt into the helper using the actual database field names for earned points, maximum points, and legacy percentage. Do not change authentication, student filtering, or row-level security.
4. Use `summary.average`, `summary.best`, and `summary.passed` for the metric cards. Render `null` metrics as `—`; render percentages through `formatAssessmentPercentage`.
5. For each history row, call `normalizeAssessmentScore(attempt)` with the same normalized field mapping. If invalid, show `Score unavailable — this historical attempt has incomplete scoring data` instead of a false percentage or pass status. Keep the View Result link available so the underlying record can be investigated.
6. Apply the same helper to individual result pages and any dashboard aggregates so they cannot disagree.
7. Inspect the actual Supabase schema and the three legacy attempt rows before any database repair. Do not manufacture a score or overwrite records based on the visible 0/0 values alone.

## Tests
The helper is plain ESM JavaScript so its tests can run directly with Node. These tests cover the helper only; they were not run against the live application or Supabase data.

## Acceptance criteria
- No score displayed above 100%.
- 0/0 and missing-score attempts do not inflate average, best score, or pass count.
- Existing valid 26/26 results remain 100%.
- Existing assessment rows remain unchanged until their original data can be verified.
