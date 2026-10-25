import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const component = readFileSync(new URL("../src/components/CertificateExportActions.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/components/certificate-export-reliability.css", import.meta.url), "utf8");

test("supports existing certificate sheet selectors", () => {
  assert.match(component, /certificate-paper/);
  assert.match(component, /mc-paper/);
  assert.match(component, /rn-certificate-document/);
});

test("waits for fonts and images before rendering", () => {
  assert.match(component, /document\.fonts\.ready/);
  assert.match(component, /Promise\.all\(images\.map\(waitForImage\)\)/);
});

test("exports a JPEG blob rather than a data URL", () => {
  assert.match(component, /canvas\.toBlob/);
  assert.match(component, /image\/jpeg/);
  assert.match(component, /downloadBlob/);
});

test("PDF action uses browser print and explains settings", () => {
  assert.match(component, /window\.print\(\)/);
  assert.match(component, /Save as PDF, Landscape, and A4/);
});

test("disabled state blocks export controls", () => {
  assert.match(component, /disabled=\{disabled \|\| busy !== null\}/);
});

test("print layout is A4 landscape and excludes controls", () => {
  assert.match(css, /size:\s*A4 landscape/);
  assert.match(css, /297mm/);
  assert.match(css, /\.no-print/);
});
