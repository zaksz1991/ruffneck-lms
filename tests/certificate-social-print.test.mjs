import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/app/certificate-social-print.css", import.meta.url), "utf8");

test("sets a Facebook-inspired light page background and clear card surfaces", () => {
  assert.match(css, /--rn-social-page:\s*#f0f2f5/i);
  assert.match(css, /--rn-social-surface:\s*#ffffff/i);
  assert.match(css, /\.certificate-toolbar[\s\S]*?background:\s*var\(--rn-social-surface\)/i);
});

test("preserves RuffNeck navy brand styling and uses blue for actions", () => {
  assert.match(css, /--rn-brand-navy:\s*#0b1e3a/i);
  assert.match(css, /--rn-social-blue:\s*#1877f2/i);
});

test("requests A4 landscape with zero margins", () => {
  assert.match(css, /@page\s*\{\s*size:\s*A4 landscape;\s*margin:\s*0;/i);
});

test("locks printed certificate to 297mm by 210mm", () => {
  assert.match(css, /width:\s*297mm !important/i);
  assert.match(css, /height:\s*210mm !important/i);
});

test("hides toolbar and no-print controls in print", () => {
  assert.match(css, /\.certificate-toolbar,[\s\S]*?\.no-print\s*\{\s*display:\s*none !important/i);
});

test("covers both certificate markup variants", () => {
  assert.match(css, /\.certificate-paper/);
  assert.match(css, /\.rn-certificate-document/);
  assert.match(css, /\.rn-certificate-view-page/);
});
