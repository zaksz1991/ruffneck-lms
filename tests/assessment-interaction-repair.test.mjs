import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const component = readFileSync(
  new URL("../src/app/student/assessment/AssessmentClient.tsx", import.meta.url),
  "utf8"
);
const styles = readFileSync(
  new URL("../src/app/student/assessment/assessment.css", import.meta.url),
  "utf8"
);

test("selected state class matches the dedicated visible CSS selector", () => {
  assert.match(component, /selected\s*\?\s*" is-selected"/);
  assert.match(styles, /\.rn-answer-option\.is-selected/);
});

test("answer buttons expose selected state accessibly", () => {
  assert.match(component, /aria-pressed=\{selected\}/);
  assert.match(component, /aria-live="polite"/);
});

test("submission prevents duplicate requests and confirms before sending", () => {
  assert.match(component, /if \(submitting\) return/);
  assert.match(component, /window\.confirm\(/);
  assert.match(component, /fetch\("\/api\/student\/assessment"/);
});

test("all unanswered questions are located before submission", () => {
  assert.match(component, /firstUnansweredIndex/);
  assert.match(component, /Answer all questions before submitting/);
});

test("submit errors are announced and answers remain on screen", () => {
  assert.match(component, /role="alert"/);
  assert.match(component, /Your answers are still on this page/);
});

test("selection and submission controls remain touch accessible", () => {
  assert.match(styles, /min-height: 64px/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /@media \(max-width: 560px\)/);
});
