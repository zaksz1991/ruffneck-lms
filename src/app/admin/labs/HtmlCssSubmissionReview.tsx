"use client";

import { useMemo, useState } from "react";
import styles from "./HtmlCssSubmissionReview.module.css";

type ReviewTab = "preview" | "html" | "css" | "reflection";
type PreviewWidth = "desktop" | "tablet" | "mobile";

type ParsedStudioProject = {
  title: string;
  reflection: string;
  html: string;
  css: string;
};

const PROJECT_MARKER = "RUFFNECK_HTML_CSS_STUDIO_PROJECT_V1";
const REFLECTION_MARKER = "[STUDENT REFLECTION]";
const HTML_MARKER = "[HTML SOURCE]";
const CSS_MARKER = "[CSS SOURCE]";

function stripSectionSeparators(value: string) {
  let result = value;
  result = result.replace(/^\r?\n/, "");
  result = result.replace(/\r?\n\r?\n$/, "");
  if (/^\r?\n$/.test(result)) return "";
  return result;
}

function parseStudioProject(answerText: string): ParsedStudioProject | null {
  if (!answerText.startsWith(PROJECT_MARKER)) return null;

  const reflectionAt = answerText.indexOf(REFLECTION_MARKER);
  const htmlAt = answerText.indexOf(HTML_MARKER, reflectionAt + REFLECTION_MARKER.length);
  const cssAt = answerText.indexOf(CSS_MARKER, htmlAt + HTML_MARKER.length);

  if (
    reflectionAt < 0 ||
    htmlAt < 0 ||
    cssAt < 0 ||
    !(reflectionAt < htmlAt && htmlAt < cssAt)
  ) {
    return null;
  }

  const titleLine = answerText
    .split(/\r?\n/)
    .find((line) => line.startsWith("Project: "));

  const reflection = stripSectionSeparators(
    answerText.slice(reflectionAt + REFLECTION_MARKER.length, htmlAt),
  );
  const html = stripSectionSeparators(
    answerText.slice(htmlAt + HTML_MARKER.length, cssAt),
  );
  const css = answerText
    .slice(cssAt + CSS_MARKER.length)
    .replace(/^\r?\n/, "");

  return {
    title: titleLine?.slice("Project: ".length).trim() || "HTML/CSS Studio Project",
    reflection,
    html,
    css,
  };
}

function makePreviewDocument(html: string, css: string) {
  // Prevent the submitted CSS from terminating the surrounding style element.
  const safeCss = css.replace(/<\/style/gi, "<\\/style");
  const policy = [
    "default-src 'none'",
    "script-src 'none'",
    "connect-src 'none'",
    "img-src data:",
    "font-src data:",
    "style-src 'unsafe-inline'",
    "media-src 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "child-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${policy}">
<style>${safeCss}</style>
</head>
<body>${html}</body>
</html>`;
}

function downloadSource(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function HtmlCssSubmissionReview({
  answerText,
}: {
  answerText: string;
}) {
  const project = useMemo(() => parseStudioProject(answerText), [answerText]);
  const [activeTab, setActiveTab] = useState<ReviewTab>("preview");
  const [previewWidth, setPreviewWidth] = useState<PreviewWidth>("desktop");

  if (!project) {
    return (
      <div className={styles.fallbackResponse}>
        {answerText || "No response provided."}
      </div>
    );
  }

  const previewDocument = makePreviewDocument(project.html, project.css);
  const tabs: { id: ReviewTab; label: string }[] = [
    { id: "preview", label: "Live preview" },
    { id: "html", label: "HTML source" },
    { id: "css", label: "CSS source" },
    { id: "reflection", label: "Reflection" },
  ];

  const widthValue =
    previewWidth === "desktop"
      ? "100%"
      : previewWidth === "tablet"
        ? "768px"
        : "375px";

  return (
    <section className={styles.root} aria-label="HTML and CSS project review">
      <header className={styles.projectHeader}>
        <div>
          <p className={styles.kicker}>STUDENT WEBSITE PROJECT</p>
          <h3 className={styles.projectTitle}>{project.title}</h3>
          <p className={styles.projectHint}>
            Review the rendered page, inspect the submitted source, and read the student reflection.
          </p>
        </div>
        <div className={styles.downloadActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => downloadSource("index.html", project.html, "text/html")}
          >
            Download HTML
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => downloadSource("styles.css", project.css, "text/css")}
          >
            Download CSS
          </button>
        </div>
      </header>

      <div className={styles.tabs} role="tablist" aria-label="Submission review panels">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`studio-review-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls="studio-review-panel"
            className={`${styles.tab} ${activeTab === tab.id ? styles.activeTab : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        id="studio-review-panel"
        className={styles.panel}
        role="tabpanel"
        aria-labelledby={`studio-review-tab-${activeTab}`}
        tabIndex={0}
      >
        {activeTab === "preview" ? (
          <div className={styles.previewPanel}>
            <div className={styles.previewToolbar}>
              <div>
                <strong>Website preview</strong>
                <span className={styles.muted}> · scripts and external requests blocked</span>
              </div>
              <div className={styles.viewportButtons} role="group" aria-label="Preview width">
                {([
                  ["desktop", "Desktop"],
                  ["tablet", "Tablet"],
                  ["mobile", "Mobile"],
                ] as [PreviewWidth, string][]).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`${styles.viewportButton} ${previewWidth === value ? styles.activeViewport : ""}`}
                    aria-pressed={previewWidth === value}
                    onClick={() => setPreviewWidth(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.previewStage}>
              <div
                className={styles.previewFrame}
                style={{ width: widthValue, maxWidth: "100%" }}
              >
                <iframe
                  title={`${project.title} — sandboxed website preview`}
                  className={styles.previewIframe}
                  srcDoc={previewDocument}
                  sandbox=""
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />
              </div>
            </div>
            <p className={styles.safetyNote}>
              The preview runs in an isolated frame without script execution, form submission,
              pop-ups, or external network access.
            </p>
          </div>
        ) : null}

        {activeTab === "html" ? (
          <div className={styles.sourcePanel}>
            <div className={styles.sourceToolbar}>
              <div>
                <strong>index.html</strong>
                <span className={styles.muted}> · {project.html.length.toLocaleString()} characters</span>
              </div>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => downloadSource("index.html", project.html, "text/html")}
              >
                Download HTML
              </button>
            </div>
            <pre className={styles.codeBlock}><code>{project.html || "(No HTML source was submitted.)"}</code></pre>
          </div>
        ) : null}

        {activeTab === "css" ? (
          <div className={styles.sourcePanel}>
            <div className={styles.sourceToolbar}>
              <div>
                <strong>styles.css</strong>
                <span className={styles.muted}> · {project.css.length.toLocaleString()} characters</span>
              </div>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => downloadSource("styles.css", project.css, "text/css")}
              >
                Download CSS
              </button>
            </div>
            <pre className={styles.codeBlock}><code>{project.css || "(No CSS source was submitted.)"}</code></pre>
          </div>
        ) : null}

        {activeTab === "reflection" ? (
          <div className={styles.reflectionPanel}>
            <h4>Student reflection</h4>
            {project.reflection.trim() ? (
              <p className={styles.reflectionText}>{project.reflection}</p>
            ) : (
              <p className={styles.muted}>No reflection was submitted.</p>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
