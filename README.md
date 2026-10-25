# RuffNeck Learn — Assessment Interaction Repair

## Root cause confirmed from public `main`
`AssessmentClient.tsx` applies the class `is-selected` when an answer is selected, but `src/app/globals.css` styles `.rn-answer-option.selected`. The selected-state CSS therefore does not match the class emitted by React. This update fixes that mismatch with scoped assessment styles.

## Included complete replacement files
- `src/app/student/assessment/AssessmentClient.tsx` — full component replacement.
- `src/app/student/assessment/assessment.css` — assessment-only interaction styling.
- `tests/assessment-interaction-repair.test.mjs` — regression checks.

## Apply using File Explorer / GitHub web UI
1. Extract this ZIP.
2. In the RuffNeck Learn repository, replace `src/app/student/assessment/AssessmentClient.tsx` with the included complete file.
3. Add `src/app/student/assessment/assessment.css`.
4. Add `tests/assessment-interaction-repair.test.mjs`.
5. Keep `src/app/globals.css`, API routes, scoring logic, Supabase configuration, course content and all other files unchanged.

## Changes
- High-contrast selected state with a filled marker and explicit “Selected” label.
- Corrects the `is-selected` class/CSS mismatch without overriding global styles.
- Whole answer row remains clickable; selected state is exposed with `aria-pressed`.
- Answers persist while moving between questions.
- Submission checks all questions and moves to the first unanswered question.
- Confirmation before final submission and duplicate-submit guard.
- Clear loading state, accessible error announcement and preserved answers on failure.
- Empty-question guard and mobile/touch sizing.

## Verification status
The source-level regression tests are included but were not executed against the complete repository here. The production build, live-browser interaction and live submission endpoint have not been verified. Do not treat this package as a verified production deployment.
