"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import styles from "./AdvancedProjectStudio.module.css";

type Track = "web_development" | "digital_publishing";
type Action = "draft" | "autosave" | "submitted";
type ProjectFile = { path: string; content: string };
type PublicationMeta = {
  publicationType: string;
  title: string;
  subtitle: string;
  byline: string;
  slug: string;
  category: string;
  tags: string;
  excerpt: string;
  seoTitle: string;
  metaDescription: string;
  publishDate: string;
};
type ProjectJson = { files?: ProjectFile[]; metadata?: Partial<PublicationMeta> };
type ApiResult = {
  ok?: boolean;
  error?: string;
  message?: string;
  workspace?: { id?: string };
  submission?: { status?: string; score?: number | null; feedback?: string | null; updated_at?: string | null };
};

type Props = {
  labId: string;
  track: Track;
  labTitle: string;
  courseTitle: string;
  summary: string;
  instructions: string;
  deliverable: string;
  practiceSteps: string[];
  rubric: { criterion: string; points: number; description?: string }[];
  initialProject: ProjectJson | null;
  initialReflection: string;
  initialStatus: string;
  initialScore: number | null;
  initialFeedback: string | null;
  updatedAt: string | null;
};

const MAX_FILES = 14;
const MAX_TEXT_FILE = 30_000;
const MAX_TOTAL_PROJECT = 250_000;
const MAX_SINGLE_ASSET = 150 * 1024;
const MAX_TOTAL_ASSETS = 300 * 1024;
const REFLECTION_LIMIT = 1_000;
const WEBSITE_STARTERS: ProjectFile[] = [
  {
    path: "index.html",
    content: `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>Northstar Digital</title>\n  <link rel="stylesheet" href="css/styles.css">\n</head>\n<body>\n  <header class="site-header">\n    <a class="brand" href="index.html">Northstar<span>.</span></a>\n    <nav aria-label="Main navigation">\n      <a href="index.html">Home</a>\n      <a href="about.html">About</a>\n      <a href="contact.html">Contact</a>\n    </nav>\n  </header>\n  <main>\n    <section class="hero">\n      <p class="eyebrow">DIGITAL PARTNERS FOR GROWING BUSINESSES</p>\n      <h1>Make your next digital move count.</h1>\n      <p>Practical websites, content and systems for ambitious local businesses.</p>\n      <a class="button" href="contact.html">Start a conversation</a>\n    </section>\n    <section class="section" aria-labelledby="services-title">\n      <p class="eyebrow">WHAT WE DO</p>\n      <h2 id="services-title">Clear, useful digital work</h2>\n      <div class="cards">\n        <article><h3>Website foundations</h3><p>Responsive pages with clear customer journeys.</p></article>\n        <article><h3>Content and campaigns</h3><p>Useful messages organised around measurable goals.</p></article>\n        <article><h3>Business systems</h3><p>Small workflows that reduce repetitive work.</p></article>\n      </div>\n    </section>\n  </main>\n  <footer><p>Northstar Digital · Fictional student project</p></footer>\n</body>\n</html>`,
  },
  {
    path: "about.html",
    content: `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>About | Northstar Digital</title>\n  <link rel="stylesheet" href="css/styles.css">\n</head>\n<body>\n  <header class="site-header"><a class="brand" href="index.html">Northstar<span>.</span></a><nav aria-label="Main navigation"><a href="index.html">Home</a><a href="about.html" aria-current="page">About</a><a href="contact.html">Contact</a></nav></header>\n  <main class="section narrow"><p class="eyebrow">OUR APPROACH</p><h1>Start with the problem.</h1><p>We turn business goals into practical digital experiences. This page demonstrates a second HTML page connected to the shared stylesheet.</p><h2>How we work</h2><ol><li>Understand the audience and goal.</li><li>Design a clear first version.</li><li>Test, learn and improve.</li></ol><a class="button" href="contact.html">Talk to us</a></main>\n  <footer><p>Northstar Digital · Fictional student project</p></footer>\n</body>\n</html>`,
  },
  {
    path: "contact.html",
    content: `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>Contact | Northstar Digital</title>\n  <link rel="stylesheet" href="css/styles.css">\n</head>\n<body>\n  <header class="site-header"><a class="brand" href="index.html">Northstar<span>.</span></a><nav aria-label="Main navigation"><a href="index.html">Home</a><a href="about.html">About</a><a href="contact.html" aria-current="page">Contact</a></nav></header>\n  <main class="section narrow"><p class="eyebrow">NEXT STEP</p><h1>Let's plan something useful.</h1><p>Describe the business problem, the audience and the result you need. Replace this sample with your own contact brief.</p><p><strong>Practice note:</strong> This demo does not send messages or submit forms.</p><a class="button" href="index.html">Return home</a></main>\n  <footer><p>Northstar Digital · Fictional student project</p></footer>\n</body>\n</html>`,
  },
  {
    path: "css/styles.css",
    content: `:root {\n  --ink: #13263d;\n  --muted: #5c6d80;\n  --paper: #f5f7fa;\n  --surface: #ffffff;\n  --accent: #087d75;\n  --accent-soft: #dff5ef;\n  --line: #dce4ec;\n  --space: clamp(1rem, 3vw, 2.5rem);\n  --radius: 18px;\n}\n* { box-sizing: border-box; }\nbody { margin: 0; color: var(--ink); background: var(--paper); font: 16px/1.65 Arial, sans-serif; }\na { color: inherit; }\na:focus-visible, button:focus-visible { outline: 3px solid #edb64b; outline-offset: 4px; }\n.site-header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 1.2rem clamp(1rem, 5vw, 4rem); background: var(--surface); border-bottom: 1px solid var(--line); }\n.brand { font-size: 1.35rem; font-weight: 850; text-decoration: none; }\n.brand span { color: var(--accent); }\nnav { display: flex; flex-wrap: wrap; gap: 1rem; }\nnav a { text-decoration: none; color: var(--muted); font-weight: 700; }\n.hero { padding: clamp(3rem, 8vw, 7rem) clamp(1rem, 9vw, 7rem); background: linear-gradient(135deg, #e5f4f1, #f4f6f9); }\n.eyebrow { margin: 0 0 .8rem; color: var(--accent); font-size: .75rem; font-weight: 800; letter-spacing: .14em; }\nh1, h2 { line-height: 1.1; letter-spacing: -.035em; }\nh1 { max-width: 780px; font-size: clamp(2.4rem, 6vw, 5rem); }\n.hero > p:not(.eyebrow) { max-width: 600px; color: var(--muted); font-size: 1.1rem; }\n.button { display: inline-flex; min-height: 44px; align-items: center; padding: .7rem 1.1rem; color: #fff; background: var(--accent); border-radius: 999px; text-decoration: none; font-weight: 800; }\n.section { padding: clamp(2.5rem, 6vw, 5rem) clamp(1rem, 7vw, 6rem); }\n.narrow { max-width: 850px; margin-inline: auto; }\n.cards { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 1rem; }\n.cards article { padding: 1.3rem; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); }\n.cards p { color: var(--muted); }\nfooter { padding: 1.4rem clamp(1rem, 5vw, 4rem); border-top: 1px solid var(--line); color: var(--muted); }\n@media (max-width: 720px) { .site-header { align-items: flex-start; flex-direction: column; } nav { gap: .8rem; } .cards { grid-template-columns: 1fr; } .hero { padding-block: 3rem; } }\n`,
  },
  { path: "README.md", content: "# Northstar Digital\n\nA multi-page HTML/CSS practice project built in RuffNeck Learn.\n\nOpen `index.html` to begin. The site uses `css/styles.css`. Edit the HTML files and shared CSS, then re-test at desktop, tablet and mobile widths.\n" },
];
const PUBLISHING_STARTERS: ProjectFile[] = [
  {
    path: "publication.md",
    content: `# Practical Digital Skills for Small Businesses\n\n*A useful, evidence-led guide to improving everyday work.*\n\n## Why digital skills matter\n\nSmall organisations do not need to adopt every new tool. They need to identify recurring problems, choose appropriate tools and measure whether the change helps. Start with a clear goal such as faster customer responses, fewer data-entry errors or a more consistent publishing process.\n\n## Start with the reader\n\nA good publication answers a real question for a defined audience. Use plain language, short sections and examples that make sense in the reader's context. Explain unfamiliar terms, verify claims and link recommendations to a practical next step.\n\n## Build an editorial workflow\n\nA dependable workflow includes a brief, a draft, a factual review, an accessibility check, an approval step and a distribution plan. Keep a record of the sources used. Mark estimates as estimates and obtain permission before using identifiable stories or photographs.\n\n## Measure usefulness\n\nChoose measures that match the purpose. A newsletter might track delivery, clicks and reader replies. A guide might be assessed by completion, questions answered or changes in a work process. Do not treat a large audience as proof that the material is accurate or useful.\n\n## Conclusion\n\nUseful publishing combines clear writing, careful verification, accessible presentation and a realistic distribution plan. Publish only after the content, metadata, links and rights have been checked.\n\n## References\n\n- Add the actual source title, author or organisation, publication date and URL for every factual source you use.\n- Do not invent quotations, research findings or citations.`,
  },
  {
    path: "publication.css",
    content: `:root { --ink: #202b3a; --muted: #5c6878; --paper: #fbfaf7; --accent: #89592d; --line: #e7ded2; --measure: 70ch; }\n* { box-sizing: border-box; }\nbody { margin: 0; background: var(--paper); color: var(--ink); font: 18px/1.8 Georgia, 'Times New Roman', serif; }\n.publication-header { padding: 3rem 1.25rem 2rem; border-bottom: 1px solid var(--line); }\n.publication-header > div, article, .publication-footer { width: min(100%, var(--measure)); margin-inline: auto; }\n.eyebrow { color: var(--accent); font: 800 .75rem/1.4 Arial, sans-serif; letter-spacing: .14em; text-transform: uppercase; }\nh1, h2, h3 { line-height: 1.2; }\nh1 { font-size: clamp(2.2rem, 5vw, 4.3rem); letter-spacing: -.04em; margin: .6rem 0 1rem; }\n.subtitle { color: var(--muted); font-size: 1.2rem; }\n.byline { color: var(--muted); font: .9rem/1.5 Arial, sans-serif; }\narticle { padding: 2rem 1.25rem 4rem; }\narticle h2 { margin-top: 2.2rem; font-size: 1.65rem; }\narticle a { color: var(--accent); text-underline-offset: .2em; }\narticle blockquote { margin-inline: 0; padding-left: 1.1rem; border-left: 4px solid var(--accent); color: var(--muted); }\narticle img { max-width: 100%; height: auto; }\n.publication-footer { padding: 1.5rem 1.25rem 3rem; border-top: 1px solid var(--line); color: var(--muted); font: .85rem/1.5 Arial, sans-serif; }\n@media (max-width: 600px) { body { font-size: 16px; } .publication-header { padding-top: 2rem; } }\n`,
  },
  { path: "metadata.json", content: JSON.stringify({ publicationType: "article", title: "Practical Digital Skills for Small Businesses", subtitle: "A useful, evidence-led guide to improving everyday work.", byline: "RuffNeck Learn Student", slug: "practical-digital-skills-small-businesses", category: "Digital Skills", tags: ["digital skills", "small business"], excerpt: "A practical guide to choosing tools, creating a reliable editorial workflow and measuring usefulness.", seoTitle: "Practical Digital Skills for Small Businesses", metaDescription: "Learn how small businesses can choose useful digital tools, build editorial workflows and measure results.", publishDate: new Date().toISOString().slice(0, 10) }, null, 2) + "\n" },
  { path: "editorial-checklist.md", content: "# Editorial and publication checklist\n\n- [ ] Title describes the main value to the reader.\n- [ ] Content is written for a defined audience.\n- [ ] Headings create a logical structure.\n- [ ] Factual claims are verified against the original source.\n- [ ] Quotations and citations are accurate.\n- [ ] Images and excerpts have usage permission.\n- [ ] SEO title and description are accurate and not misleading.\n- [ ] Links and spelling have been checked.\n- [ ] Byline, publication date and category are correct.\n- [ ] Distribution channel and call to action are planned.\n" },
];
const DEFAULT_META: PublicationMeta = {
  publicationType: "article", title: "Practical Digital Skills for Small Businesses", subtitle: "A useful, evidence-led guide to improving everyday work.", byline: "RuffNeck Learn Student", slug: "practical-digital-skills-small-businesses", category: "Digital Skills", tags: "digital skills, small business", excerpt: "A practical guide to choosing tools, creating a reliable editorial workflow and measuring usefulness.", seoTitle: "Practical Digital Skills for Small Businesses", metaDescription: "Learn how small businesses can choose useful digital tools, build editorial workflows and measure results.", publishDate: new Date().toISOString().slice(0, 10),
};

function safeProjectTitle(value: string, fallback: string) {
  return value.trim().replace(/[<>\r\n]/g, "").slice(0, 140) || fallback;
}
function safeSlug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90);
}
function fingerprint(track: Track, files: ProjectFile[], metadata: PublicationMeta, reflection: string) {
  return JSON.stringify([track, files, metadata, reflection]);
}
function hydrateFiles(saved: ProjectFile[] | undefined, track: Track): ProjectFile[] {
  const base = track === "web_development" ? WEBSITE_STARTERS : PUBLISHING_STARTERS;
  if (!saved?.length) return base.map((file) => ({ ...file }));
  const allowed = saved.filter((file) => file && typeof file.path === "string" && typeof file.content === "string");
  return allowed.length ? allowed.map((file) => ({ ...file })) : base.map((file) => ({ ...file }));
}
function mimeFromDataUrl(value: string): string | null {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,/i.exec(value);
  return match?.[1]?.toLowerCase() ?? null;
}
function dataUrlBytes(value: string): number {
  const comma = value.indexOf(",");
  if (!value.startsWith("data:") || comma < 0) return 0;
  return Math.floor((value.length - comma - 1) * 3 / 4);
}
function resolveProjectPath(baseFilePath: string, requestedPath: string): string | null {
  const raw = requestedPath.trim();
  if (!raw || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(raw)) return null;
  let decoded = raw.split(/[?#]/, 1)[0];
  try { decoded = decodeURIComponent(decoded); } catch { return null; }
  const baseDir = baseFilePath.includes("/") ? baseFilePath.slice(0, baseFilePath.lastIndexOf("/") + 1) : "";
  const combined = decoded.startsWith("/") ? decoded.slice(1) : `${baseDir}${decoded}`;
  const parts: string[] = [];
  for (const segment of combined.replace(/\\/g, "/").split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (!parts.length) return null;
      parts.pop();
    } else parts.push(segment);
  }
  return parts.join("/") || null;
}
function getLocalAsset(baseFilePath: string, requestedPath: string, files: ProjectFile[]): ProjectFile | undefined {
  if (/^(?:data:|blob:|https?:|\/\/|#)/i.test(requestedPath.trim())) return undefined;
  const resolved = resolveProjectPath(baseFilePath, requestedPath);
  if (!resolved) return undefined;
  const asset = files.find((file) => file.path === resolved);
  return asset && mimeFromDataUrl(asset.content) ? asset : undefined;
}
function inlineCssAssets(css: string, cssPath: string, files: ProjectFile[]): string {
  return css
    .replace(/@import\s+[^;]+;?/gi, "")
    .replace(/url\(\s*(?:(['"])(.*?)\1|([^)]*?))\s*\)/gi, (whole, quote: string | undefined, quoted: string | undefined, unquoted: string | undefined) => {
      const reference = (quoted ?? unquoted ?? "").trim();
      if (!reference || /^(?:data:|blob:|https?:|\/\/|#)/i.test(reference)) return whole;
      const asset = getLocalAsset(cssPath, reference, files);
      return asset ? `url("${asset.content}")` : whole;
    })
    .replace(/<\/style/gi, "<\\/style");
}
function htmlSafeForPreview(html: string, files: ProjectFile[], selectedPath: string) {
  let value = html
    .replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "")
    .replace(/<\s*(iframe|object|embed|applet|base)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(iframe|object|embed|applet|base)\b[^>]*\/?\s*>/gi, "")
    .replace(/<meta\b(?=[^>]*\bhttp-equiv\s*=\s*(?:"refresh"|'refresh'|refresh\b))[^>]*>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+srcdoc\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '$1="#"');
  value = value.replace(/<link\b[^>]*rel\s*=\s*(["'])[^"']*\bstylesheet\b[^"']*\1[^>]*>/gi, "");
  value = value.replace(/\s(src|poster)\s*=\s*(["'])(?!data:|blob:|https?:|\/\/|#)([^"']+)\2/gi, (full, attr, quote, path) => {
    const asset = getLocalAsset(selectedPath, path, files);
    return asset ? ` ${attr}=${quote}${asset.content}${quote}` : full;
  });
  return value;
}
function linkedStylesheets(html: string, htmlPath: string, files: ProjectFile[]): ProjectFile[] {
  const found: ProjectFile[] = [];
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const rel = /\brel\s*=\s*(["'])(.*?)\1/i.exec(tag)?.[2] ?? "";
    if (!rel.toLowerCase().split(/\s+/).includes("stylesheet")) continue;
    const href = /\bhref\s*=\s*(["'])(.*?)\1/i.exec(tag)?.[2];
    if (!href || /^(?:data:|blob:|https?:|\/\/|#)/i.test(href)) continue;
    const resolved = resolveProjectPath(htmlPath, href);
    const file = resolved ? files.find((candidate) => candidate.path === resolved && candidate.path.toLowerCase().endsWith(".css")) : undefined;
    if (file && !found.some((candidate) => candidate.path === file.path)) found.push(file);
  }
  return found;
}
function buildWebsitePreview(html: string, css: string, files: ProjectFile[], selectedPath: string) {
  const linkedCss = linkedStylesheets(html, selectedPath, files);
  const fallbackCss = files.find((file) => file.content === css && file.path.toLowerCase().endsWith(".css"))
    ?? files.find((file) => /(^|\/)styles\.css$/i.test(file.path))
    ?? files.find((file) => file.path.toLowerCase().endsWith(".css"));
  const stylesToRender = linkedCss.length ? linkedCss : fallbackCss ? [fallbackCss] : [];
  const safeCss = stylesToRender.map((file) => inlineCssAssets(file.content, file.path, files)).join("\n\n");
  const safeHtml = htmlSafeForPreview(html, files, selectedPath);
  const policy = "default-src 'none'; script-src 'none'; connect-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data:; media-src data:; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'; navigate-to 'self'";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${policy}"><style>${safeCss}</style></head><body>${safeHtml}</body></html>`;
}
function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function inlineMarkdown(value: string, basePath: string, files: ProjectFile[]): string {
  let escaped = escapeHtml(value);
  escaped = escaped.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (whole, alt: string, path: string, title: string | undefined) => {
    const asset = getLocalAsset(basePath, path, files);
    if (!asset) return `<span class="image-not-available">[Image unavailable in this offline preview: ${alt || "image"}]</span>`;
    return `<img src="${asset.content}" alt="${alt}"${title ? ` title="${escapeHtml(title)}"` : ""} loading="lazy">`;
  });
  escaped = escaped.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+|tel:[^\s)]+)\)/g, '<a href="$2">$1</a>');
  escaped = escaped.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  escaped = escaped.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  escaped = escaped.replace(/`([^`]+)`/g, "<code>$1</code>");
  return escaped;
}
function markdownToHtml(markdown: string, files: ProjectFile[], markdownPath = "publication.md"): string {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const output: string[] = [];
  let paragraph: string[] = [];
  let listOpen = false;
  const flushParagraph = () => {
    if (paragraph.length) output.push(`<p>${paragraph.map((part) => inlineMarkdown(part, markdownPath, files)).join(" ")}</p>`);
    paragraph = [];
  };
  const closeList = () => { if (listOpen) { output.push("</ul>"); listOpen = false; } };
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { flushParagraph(); closeList(); continue; }
    const heading = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph(); closeList();
      const level = heading[1].length + 1;
      output.push(`<h${level}>${inlineMarkdown(heading[2], markdownPath, files)}</h${level}>`);
      continue;
    }
    if (/^[-*+]\s+/.test(trimmed)) {
      flushParagraph();
      if (!listOpen) { output.push("<ul>"); listOpen = true; }
      output.push(`<li>${inlineMarkdown(trimmed.replace(/^[-*+]\s+/, ""), markdownPath, files)}</li>`);
      continue;
    }
    if (/^>\s?/.test(trimmed)) {
      flushParagraph(); closeList();
      output.push(`<blockquote><p>${inlineMarkdown(trimmed.replace(/^>\s?/, ""), markdownPath, files)}</p></blockquote>`);
      continue;
    }
    paragraph.push(trimmed);
  }
  flushParagraph(); closeList();
  return output.join("\n");
}
function makePublicationPreview(meta: PublicationMeta, markdown: string, css: string, files: ProjectFile[]) {
  const title = escapeHtml(meta.title || "Untitled publication");
  const subtitle = escapeHtml(meta.subtitle || "");
  const byline = escapeHtml(meta.byline || "");
  const safeCss = inlineCssAssets(css, "publication.css", files);
  const body = markdownToHtml(markdown, files);
  const description = escapeHtml(meta.metaDescription || meta.excerpt || "");
  const seoTitle = escapeHtml(meta.seoTitle || meta.title || "Untitled publication");
  const policy = "default-src 'none'; script-src 'none'; connect-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data:; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${policy}"><title>${seoTitle}</title><meta name="description" content="${description}"><style>${safeCss}</style></head><body><header class="publication-header"><div><p class="eyebrow">${escapeHtml(meta.category || meta.publicationType)}</p><h1>${title}</h1><p class="subtitle">${subtitle}</p><p class="byline">By ${byline} · ${escapeHtml(meta.publishDate || "Date not set")}</p></div></header><article>${body}</article><footer class="publication-footer">Prepared in RuffNeck Learn · Editorial practice project</footer></body></html>`;
}
function createZip(entries: { path: string; content: string | Uint8Array }[]): Uint8Array {
  const encoder = new TextEncoder();
  const crcTable = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    crcTable[index] = value >>> 0;
  }
  const crc32 = (bytes: Uint8Array) => { let crc = 0xffffffff; for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff]; return (crc ^ 0xffffffff) >>> 0; };
  const u16 = (arr: Uint8Array, off: number, val: number) => { arr[off] = val & 255; arr[off + 1] = (val >>> 8) & 255; };
  const u32 = (arr: Uint8Array, off: number, val: number) => { arr[off] = val & 255; arr[off + 1] = (val >>> 8) & 255; arr[off + 2] = (val >>> 16) & 255; arr[off + 3] = (val >>> 24) & 255; };
  const local: Uint8Array[] = []; const central: Uint8Array[] = []; let offset = 0;
  const now = new Date(); const year = Math.max(1980, now.getFullYear()); const tm = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2); const dt = ((year - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  for (const entry of entries) {
    const name = encoder.encode(entry.path);
    let bytes: Uint8Array;
    if (typeof entry.content === "string" && entry.content.startsWith("data:") && entry.content.includes(";base64,")) {
      const encoded = entry.content.slice(entry.content.indexOf(",") + 1);
      const raw = atob(encoded); bytes = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
    } else bytes = typeof entry.content === "string" ? encoder.encode(entry.content) : entry.content;
    const crc = crc32(bytes); const lh = new Uint8Array(30 + name.length);
    u32(lh, 0, 0x04034b50); u16(lh, 4, 20); u16(lh, 6, 0x0800); u16(lh, 8, 0); u16(lh, 10, tm); u16(lh, 12, dt); u32(lh, 14, crc); u32(lh, 18, bytes.length); u32(lh, 22, bytes.length); u16(lh, 26, name.length); u16(lh, 28, 0); lh.set(name, 30); local.push(lh, bytes);
    const ch = new Uint8Array(46 + name.length); u32(ch, 0, 0x02014b50); u16(ch, 4, 20); u16(ch, 6, 20); u16(ch, 8, 0x0800); u16(ch, 10, 0); u16(ch, 12, tm); u16(ch, 14, dt); u32(ch, 16, crc); u32(ch, 20, bytes.length); u32(ch, 24, bytes.length); u16(ch, 28, name.length); u16(ch, 30, 0); u16(ch, 32, 0); u16(ch, 34, 0); u16(ch, 36, 0); u32(ch, 38, 0); u32(ch, 42, offset); ch.set(name, 46); central.push(ch); offset += lh.length + bytes.length;
  }
  const centralSize = central.reduce((sum, item) => sum + item.length, 0); const end = new Uint8Array(22); u32(end, 0, 0x06054b50); u16(end, 4, 0); u16(end, 6, 0); u16(end, 8, entries.length); u16(end, 10, entries.length); u32(end, 12, centralSize); u32(end, 16, offset); u16(end, 20, 0);
  const archive = new Uint8Array(offset + centralSize + end.length); let pos = 0; for (const item of local) { archive.set(item, pos); pos += item.length; } for (const item of central) { archive.set(item, pos); pos += item.length; } archive.set(end, pos); return archive;
}
function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function fileNameStem(title: string) { return safeSlug(title) || "ruffneck-project"; }

export default function AdvancedProjectStudio(props: Props) {
  const { labId, track, labTitle, courseTitle, summary, instructions, deliverable, practiceSteps, rubric, initialProject, initialReflection, initialStatus, initialScore, initialFeedback, updatedAt } = props;
  const [files, setFiles] = useState<ProjectFile[]>(() => hydrateFiles(initialProject?.files, track));
  const [metadata, setMetadata] = useState<PublicationMeta>(() => ({ ...DEFAULT_META, ...(initialProject?.metadata ?? {}) }));
  const [reflection, setReflection] = useState(initialReflection ?? "");
  const [activeFile, setActiveFile] = useState(() => (track === "web_development" ? "index.html" : "publication.md"));
  const [previewFile, setPreviewFile] = useState("index.html");
  const [previewMode, setPreviewMode] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [status, setStatus] = useState(initialStatus || "new");
  const [score, setScore] = useState<number | null>(initialScore);
  const [feedback, setFeedback] = useState<string | null>(initialFeedback);
  const [updated, setUpdated] = useState<string | null>(updatedAt);
  const [saving, setSaving] = useState(false);
  const [saveLabel, setSaveLabel] = useState("Auto-save enabled");
  const [message, setMessage] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);
  const [publishSlugInput, setPublishSlugInput] = useState(() => {
    const candidate = track === "digital_publishing"
      ? initialProject?.metadata?.slug || "my-digital-publication"
      : "my-business-website";
    const normalised = safeSlug(candidate).slice(0, 64);
    return normalised.length >= 3 ? normalised : "ruffneck-student-project";
  });
  const [publicationState, setPublicationState] = useState<"checking" | "ready" | "unavailable">("checking");
  const [publicationBusy, setPublicationBusy] = useState(false);
  const [publishConfirmed, setPublishConfirmed] = useState(false);
  const [newFilePath, setNewFilePath] = useState("");
  const [showAddFile, setShowAddFile] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const hydratedRef = useRef(false);
  const manualSaveRef = useRef(false);
  const lastSavedRef = useRef("");
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const locked = status === "submitted" || status === "approved";
  const totalRubric = rubric.reduce((sum, item) => sum + item.points, 0);
  const activeContent = files.find((file) => file.path === activeFile)?.content ?? "";
  const htmlFiles = files.filter((file) => file.path.toLowerCase().endsWith(".html"));
  const cssFile = files.find((file) => /(^|\/)styles\.css$/i.test(file.path)) ?? files.find((file) => file.path.toLowerCase().endsWith(".css"));
  const mainHtml = files.find((file) => file.path === "index.html") ?? htmlFiles[0];
  const mainCss = cssFile?.content ?? "";
  const publicationFile = files.find((file) => file.path === "publication.md");
  const publicationCss = files.find((file) => file.path === "publication.css")?.content ?? "";
  const currentFingerprint = fingerprint(track, files, metadata, reflection);
  const canEdit = !locked && !saving;
  const totalAssets = files.filter((file) => file.content.startsWith("data:image/")).reduce((sum, file) => sum + dataUrlBytes(file.content), 0);
  const publicationHtml = useMemo(() => makePublicationPreview(metadata, publicationFile?.content ?? "", publicationCss, files), [metadata, publicationFile?.content, publicationCss, files]);
  const previewDocument = track === "digital_publishing"
    ? publicationHtml
    : buildWebsitePreview(files.find((file) => file.path === previewFile)?.content ?? mainHtml?.content ?? "", mainCss, files, previewFile);

  useEffect(() => {
    const nextPreview = track === "web_development" ? (htmlFiles.some((file) => file.path === previewFile) ? previewFile : (mainHtml?.path ?? "index.html")) : "publication.md";
    if (nextPreview !== previewFile && track === "web_development") setPreviewFile(nextPreview);
  }, [track, htmlFiles, mainHtml?.path, previewFile]);

  useEffect(() => {
    if (hydratedRef.current) return;
    lastSavedRef.current = currentFingerprint;
    hydratedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createPayload = useCallback((action: Action) => {
    const normalizedFiles = files.map((file) => ({ path: file.path, content: file.content }));
    const nextMeta = { ...metadata, title: safeProjectTitle(metadata.title, track === "web_development" ? "Multi-page website project" : "Digital publication"), slug: safeSlug(metadata.slug) };
    return {
      track,
      title: track === "web_development" ? safeProjectTitle(labTitle, "Multi-file website") : safeProjectTitle(nextMeta.title, "Digital publication"),
      files: normalizedFiles,
      metadata: nextMeta,
      reflection,
      action,
    };
  }, [files, metadata, reflection, track, labTitle]);

  const saveProject = useCallback(async (action: Action) => {
    if (locked) {
      setMessage({ kind: "error", text: status === "approved" ? "This project has been approved and is locked." : "This project is awaiting review and is locked until the instructor responds." });
      return false;
    }
    if (files.length > MAX_FILES) { setMessage({ kind: "error", text: `Keep the project to ${MAX_FILES} files or fewer.` }); return false; }
    if (files.some((file) => !file.path || file.content.length > MAX_TEXT_FILE && !file.content.startsWith("data:image/"))) { setMessage({ kind: "error", text: "A project file is too large. Each text file must be 30,000 characters or less." }); return false; }
    if (files.filter((file) => !file.content.startsWith("data:image/")).reduce((sum, file) => sum + file.content.length, 0) > MAX_TOTAL_PROJECT) { setMessage({ kind: "error", text: "The project is too large. Reduce the source content before saving." }); return false; }
    if (totalAssets > MAX_TOTAL_ASSETS) { setMessage({ kind: "error", text: "Image assets exceed the 300 KB combined limit." }); return false; }
    if (reflection.length > REFLECTION_LIMIT) { setMessage({ kind: "error", text: "The reflection must be 1,000 characters or fewer." }); return false; }
    if (track === "web_development") {
      if (!files.some((file) => file.path === "index.html")) { setMessage({ kind: "error", text: "The website project must include index.html." }); return false; }
      if (!files.some((file) => file.path.toLowerCase().endsWith(".css"))) { setMessage({ kind: "error", text: "Add at least one CSS file before saving." }); return false; }
      if (files.some((file) => file.path.toLowerCase().endsWith(".html") && /<\s*script\b|\son[a-z]+\s*=|javascript\s*:/i.test(file.content))) { setMessage({ kind: "error", text: "This web-development track allows HTML and CSS only. Remove script tags, inline event handlers, and javascript: URLs." }); return false; }
    } else {
      if (!files.some((file) => file.path === "publication.md")) { setMessage({ kind: "error", text: "The publishing project must include publication.md." }); return false; }
      if (!metadata.title.trim() || !safeSlug(metadata.slug)) { setMessage({ kind: "error", text: "Provide a publication title and a valid URL slug." }); return false; }
      if (action === "submitted") {
        if ((publicationFile?.content ?? "").trim().length < 500) { setMessage({ kind: "error", text: "Build the publication body to at least 500 characters before submitting." }); return false; }
        if (metadata.metaDescription.trim().length < 50 || metadata.metaDescription.length > 160) { setMessage({ kind: "error", text: "The SEO description must be 50–160 characters before submission." }); return false; }
      }
    }
    if (action === "submitted" && reflection.trim().length < 60) { setMessage({ kind: "error", text: "Write a reflection of at least 60 characters describing your decisions and the checks you completed." }); return false; }
    const validSlugFiles = files.every((file) => /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\)[A-Za-z0-9._/-]+$/.test(file.path) && !file.path.includes("//"));
    if (!validSlugFiles) { setMessage({ kind: "error", text: "File paths may use letters, numbers, hyphens, underscores, dots and folders only. Parent-directory paths are not permitted." }); return false; }
    manualSaveRef.current = action !== "autosave";
    if (action !== "autosave") setMessage(null);
    setSaving(true);
    setSaveLabel(action === "submitted" ? "Submitting…" : action === "draft" ? "Saving draft…" : "Auto-saving…");
    try {
      const task = async () => {
        const response = await fetch(`/api/student/labs/advanced-studio/${encodeURIComponent(labId)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createPayload(action)),
        });
        const result = await response.json().catch(() => null) as ApiResult | null;
        if (!response.ok || !result?.ok) throw new Error(result?.error || "The project could not be saved.");
        const nextStatus = result.submission?.status ?? (action === "submitted" ? "submitted" : "draft");
        setStatus(nextStatus);
        setScore(result.submission?.score ?? score);
        setFeedback(result.submission?.feedback ?? feedback);
        setUpdated(result.submission?.updated_at ?? new Date().toISOString());
        lastSavedRef.current = fingerprint(track, files, metadata, reflection);
        setSaveLabel("All changes saved");
        if (action !== "autosave") setMessage({ kind: "success", text: result.message || (action === "submitted" ? "Project submitted for instructor review." : "Draft saved." ) });
        return true;
      };
      const queued = saveQueueRef.current.then(task, task);
      saveQueueRef.current = queued.then(() => undefined, () => undefined);
      return await queued;
    } catch (error) {
      setSaveLabel("Save failed · use Save draft");
      if (action !== "autosave") setMessage({ kind: "error", text: error instanceof Error ? error.message : "Network error while saving the project." });
      return false;
    } finally {
      setSaving(false);
      manualSaveRef.current = false;
    }
  }, [locked, status, files, totalAssets, reflection, track, metadata, publicationFile?.content, labId, createPayload, score, feedback]);

  useEffect(() => {
    let active = true;
    fetch(`/api/student/labs/advanced-studio/${encodeURIComponent(labId)}/publish`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json().catch(() => null);
        if (!active) return;
        if (!response.ok || !result || result.ok !== true) {
          setPublicationState("unavailable");
          return;
        }
        const publication = result.publication as { slug?: unknown; isPublished?: unknown } | null;
        const slug = publication && typeof publication.slug === "string" ? publication.slug : null;
        setPublishedSlug(publication?.isPublished === true ? slug : null);
        if (slug) setPublishSlugInput(slug);
        setPublicationState("ready");
      })
      .catch(() => {
        if (active) setPublicationState("unavailable");
      });
    return () => { active = false; };
  }, [labId]);

  const changePublicState = useCallback(async (action: "publish" | "unpublish") => {
    if (status !== "approved") {
      setMessage({ kind: "error", text: "Public publishing is available only after an instructor approves this project." });
      return;
    }
    if (action === "publish") {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(publishSlugInput) || publishSlugInput.length < 3 || publishSlugInput.length > 64) {
        setMessage({ kind: "error", text: "Use a URL slug of 3–64 lowercase letters, numbers, and single hyphens." });
        return;
      }
      if (!publishConfirmed) {
        setMessage({ kind: "error", text: "Confirm that the project is safe to share publicly before publishing." });
        return;
      }
    }
    setPublicationBusy(true);
    try {
      const response = await fetch(`/api/student/labs/advanced-studio/${encodeURIComponent(labId)}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "publish"
          ? { action, slug: publishSlugInput }
          : { action }),
      });
      const result = await response.json().catch(() => null) as {
        ok?: boolean; error?: string; publication?: { slug?: string; isPublished?: boolean } | null;
      } | null;
      if (!response.ok || !result?.ok) throw new Error(result?.error || "The publication request failed.");
      if (action === "publish") {
        const slug = result.publication?.slug || publishSlugInput;
        setPublishedSlug(slug);
        setPublishSlugInput(slug);
        setPublishConfirmed(false);
        setMessage({ kind: "success", text: `Your approved project is live at ${window.location.origin}/p/${slug}` });
      } else {
        setPublishedSlug(null);
        setPublishConfirmed(false);
        setMessage({ kind: "success", text: "Your public project has been unpublished. Its public URL no longer serves the project." });
      }
      setPublicationState("ready");
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "The publication request failed." });
    } finally {
      setPublicationBusy(false);
    }
  }, [labId, status, publishSlugInput, publishConfirmed]);

  useEffect(() => {
    if (!hydratedRef.current || locked || manualSaveRef.current || currentFingerprint === lastSavedRef.current) return;
    setSaveLabel("Unsaved changes · saving shortly");
    const timer = window.setTimeout(() => { void saveProject("autosave"); }, 1200);
    return () => window.clearTimeout(timer);
  }, [currentFingerprint, locked, saveProject]);

  function updateFile(path: string, content: string) {
    setFiles((current) => current.map((file) => file.path === path ? { ...file, content } : file));
  }
  function updateMetadata(key: keyof PublicationMeta, value: string) {
    setMetadata((current) => {
      const next = { ...current, [key]: value };
      if (key === "title" && (!current.slug || current.slug === safeSlug(current.title))) next.slug = safeSlug(value);
      return next;
    });
  }
  useEffect(() => {
    if (track !== "digital_publishing") return;
    const metadataFile = JSON.stringify({ ...metadata, tags: metadata.tags.split(",").map((tag) => tag.trim()).filter(Boolean) }, null, 2) + "\n";
    setFiles((current) => current.map((file) => file.path === "metadata.json" ? { ...file, content: metadataFile } : file));
  }, [track, metadata]);

  function addFile() {
    const path = newFilePath.trim().replace(/\\/g, "/");
    if (!path || !/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/.test(path) || path.includes("//")) { setMessage({ kind: "error", text: "Enter a safe relative path such as pages/services.html or css/components.css." }); return; }
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    const allowed = track === "web_development" ? ["html", "css", "md", "txt", "json", "csv"] : ["md", "css", "json", "txt", "csv"];
    if (!allowed.includes(ext)) { setMessage({ kind: "error", text: `This track accepts: ${allowed.join(", ")}. Add image assets using Upload image.` }); return; }
    if (files.length >= MAX_FILES) { setMessage({ kind: "error", text: `The project limit is ${MAX_FILES} files.` }); return; }
    if (files.some((file) => file.path.toLowerCase() === path.toLowerCase())) { setMessage({ kind: "error", text: "That file path already exists." }); return; }
    setFiles((current) => [...current, { path, content: ext === "html" ? `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>New page</title>\n  <link rel="stylesheet" href="css/styles.css">\n</head>\n<body>\n  <main>\n    <h1>New page</h1>\n    <p>Replace this starter content.</p>\n  </main>\n</body>\n</html>\n` : "" }]);
    setActiveFile(path);
    if (ext === "html" && track === "web_development") setPreviewFile(path);
    setNewFilePath(""); setShowAddFile(false); setMessage({ kind: "info", text: `Created ${path}.` });
  }
  function deleteActiveFile() {
    const protectedPaths = track === "web_development" ? ["index.html", "css/styles.css", "README.md"] : ["publication.md", "publication.css", "metadata.json", "editorial-checklist.md"];
    if (protectedPaths.includes(activeFile)) { setMessage({ kind: "error", text: "This starter file is required and cannot be removed." }); return; }
    if (!window.confirm(`Delete ${activeFile}? This cannot be undone.`)) return;
    setFiles((current) => current.filter((file) => file.path !== activeFile));
    setActiveFile(track === "web_development" ? "index.html" : "publication.md");
    if (previewFile === activeFile) setPreviewFile("index.html");
  }
  async function uploadAsset(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    if (!/image\/(png|jpeg|webp)/i.test(file.type)) { setMessage({ kind: "error", text: "Upload a PNG, JPEG or WebP image." }); return; }
    if (file.size > MAX_SINGLE_ASSET) { setMessage({ kind: "error", text: "Each image must be 150 KB or smaller." }); return; }
    if (totalAssets + file.size > MAX_TOTAL_ASSETS) { setMessage({ kind: "error", text: "The total image limit is 300 KB per project." }); return; }
    if (files.length >= MAX_FILES) { setMessage({ kind: "error", text: `The project limit is ${MAX_FILES} files.` }); return; }
    const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]/g, "-"); const path = `assets/${safeName}`;
    if (files.some((item) => item.path === path)) { setMessage({ kind: "error", text: "An asset with that filename already exists." }); return; }
    const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Image upload could not be read.")); reader.readAsDataURL(file); }).catch(() => "");
    if (!dataUrl) { setMessage({ kind: "error", text: "Image upload could not be read." }); return; }
    setFiles((current) => [...current, { path, content: dataUrl }]); setActiveFile(path); setMessage({ kind: "success", text: `${safeName} added to the project asset library.` });
  }

  function downloadFile(file: ProjectFile) {
    if (file.content.startsWith("data:") && file.content.includes(";base64,")) {
      const raw = atob(file.content.slice(file.content.indexOf(",") + 1)); const bytes = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i); downloadBlob(file.path.split("/").pop() || "asset.bin", new Blob([bytes]));
    } else downloadBlob(file.path.split("/").pop() || "project-file.txt", new Blob([file.content], { type: file.path.endsWith(".css") ? "text/css;charset=utf-8" : "text/plain;charset=utf-8" }));
  }
  function exportProject() {
    const projectName = fileNameStem(track === "digital_publishing" ? metadata.title : labTitle);
    const generatedReadme = track === "web_development"
      ? `# ${labTitle}\n\nA multi-file HTML/CSS practice project from RuffNeck Learn.\n\n## Open locally\n1. Extract this ZIP.\n2. Keep the folders intact so pages can find CSS and assets.\n3. Open index.html in a modern browser.\n4. Test every page, internal link and responsive layout.\n\n## Publishing\nThis ZIP is a static site package. To publish it publicly, upload the extracted project to a static-site host or connect it to a repository using that provider's own account and publishing process. Check the host's requirements first. RuffNeck Learn does not publish it to the internet automatically.\n`
      : `# ${metadata.title}\n\nPublication package prepared in RuffNeck Learn.\n\n## Package contents\n- publication.md: editable manuscript\n- publication.html: styled HTML rendering\n- publication.css: presentation stylesheet\n- metadata.json: title, byline, slug, tags and SEO details\n- editorial-checklist.md: pre-release verification\n- project-reflection.txt: editorial decisions and checks\n\n## Publishing workflow\n1. Verify claims and citations against original sources.\n2. Confirm image, quotation and other usage rights.\n3. Review title, byline, metadata, links and publication date.\n4. Open publication.html and use Print / Save as PDF when a PDF is needed.\n5. For a public release, copy/upload the approved content to your chosen CMS, newsletter platform, eBook workflow or publication host, using that provider's account. Confirm the final destination and permissions before release.\n\nThis is an export-ready publication package, not automatic publication to a public URL.\n`;
    const exportFiles = files.filter((file) => {
      const path = file.path.toLowerCase();
      if (path === "readme.md" || path === "project-reflection.txt") return false;
      if (track === "digital_publishing" && ["metadata.json", "metadata-export.json", "publication.html"].includes(path)) return false;
      return true;
    });
    const entries: { path: string; content: string | Uint8Array }[] = exportFiles.map((file) => ({ path: `${projectName}/${file.path}`, content: file.content }));
    entries.push({ path: `${projectName}/project-reflection.txt`, content: reflection.trim() || "No reflection provided yet." });
    entries.push({ path: `${projectName}/README.md`, content: generatedReadme });
    if (track === "digital_publishing") {
      entries.push({ path: `${projectName}/publication.html`, content: publicationHtml });
      entries.push({ path: `${projectName}/metadata.json`, content: JSON.stringify({ ...metadata, tags: metadata.tags.split(",").map((tag) => tag.trim()).filter(Boolean) }, null, 2) + "\n" });
    }
    const zip = createZip(entries);
    downloadBlob(`${projectName}-project.zip`, new Blob([zip], { type: "application/zip" }));
  }
  function printPublication() {
    if (track !== "digital_publishing") return;
    const printUrl = URL.createObjectURL(new Blob([publicationHtml], { type: "text/html;charset=utf-8" }));
    const popup = window.open(printUrl, "_blank");
    if (!popup) { URL.revokeObjectURL(printUrl); setMessage({ kind: "error", text: "The browser blocked the print window. Use Download project ZIP, then open publication.html and choose Print / Save as PDF." }); return; }
    popup.opener = null;
    window.setTimeout(() => { try { popup.focus(); popup.print(); } catch { /* The user can print from the opened document. */ } window.setTimeout(() => URL.revokeObjectURL(printUrl), 10000); }, 800);
  }
  const checks = useMemo(() => {
    if (track === "web_development") {
      const index = mainHtml?.content ?? "";
      const css = mainCss;
      const h1Count = (index.match(/<h1\b/gi) ?? []).length;
      const ids = [...index.matchAll(/\bid=["']([^"']+)["']/gi)].map((match) => match[1]);
      const duplicateIds = ids.some((id, i) => ids.indexOf(id) !== i);
      return [
        { label: "Project has an index.html", passed: !!mainHtml },
        { label: "At least two HTML pages", passed: htmlFiles.length >= 2 },
        { label: "One clear H1 on the home page", passed: h1Count === 1 },
        { label: "Shared CSS includes responsive rules", passed: /@media\b/i.test(css) },
        { label: "No duplicate IDs in the home page", passed: !duplicateIds },
        { label: "Images have alt attributes", passed: !/<img\b(?![^>]*\balt\s*=)[^>]*>/i.test(index) },
        { label: "Navigation links use local HTML pages or page sections", passed: [...index.matchAll(/href=["']([^"']+)["']/gi)].every((match) => /^(#|[a-z0-9_./-]+\.html(?:#.*)?$)/i.test(match[1]) || /^(mailto:|tel:)/i.test(match[1])) },
      ];
    }
    const body = publicationFile?.content ?? "";
    const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;
    const headingCount = (body.match(/^#{1,4}\s+/gm) ?? []).length;
    return [
      { label: "Publication title and slug are present", passed: Boolean(metadata.title.trim() && safeSlug(metadata.slug)) },
      { label: "SEO description is 50–160 characters", passed: metadata.metaDescription.trim().length >= 50 && metadata.metaDescription.length <= 160 },
      { label: "Content includes at least three headings", passed: headingCount >= 3 },
      { label: "Publication is at least 250 words", passed: wordCount >= 250 },
      { label: "Byline and publication date are filled", passed: Boolean(metadata.byline.trim() && metadata.publishDate) },
      { label: "References section is present", passed: /^#{1,4}\s+(references|sources|further reading)\s*$/im.test(body) },
      { label: "Editorial checklist is included", passed: files.some((file) => file.path === "editorial-checklist.md") },
    ];
  }, [track, mainHtml?.content, mainCss, htmlFiles.length, publicationFile?.content, metadata, files]);
  const passedChecks = checks.filter((check) => check.passed).length;
  const trackLabel = track === "web_development" ? "MULTI-FILE WEB DEVELOPMENT" : "DIGITAL PUBLISHING & EDITORIAL";
  const previewWidth = previewMode === "desktop" ? "100%" : previewMode === "tablet" ? "768px" : "375px";

  function handleFrameLoad() {
    const frame = iframeRef.current;
    try {
      const documentRef = frame?.contentDocument;
      if (!documentRef) return;
      documentRef.onclick = (event) => {
        const target = event.target as Element | null;
        const element = target && typeof target.closest === "function" ? target : target?.parentElement ?? null;
        const anchor = element?.closest("a[href]") as HTMLAnchorElement | null;
        if (!anchor) return;
        const href = anchor.getAttribute("href") ?? "";
        if (!href) { event.preventDefault(); return; }
        if (href.startsWith("#")) return;
        if (/^(?:https?:|mailto:|tel:|\/\/|javascript:|data:)/i.test(href)) { event.preventDefault(); return; }
        if (track !== "web_development") { event.preventDefault(); return; }
        const pathPart = href.split(/[?#]/)[0];
        if (!pathPart.toLowerCase().endsWith(".html")) { event.preventDefault(); return; }
        event.preventDefault();
        const resolved = resolveProjectPath(previewFile, pathPart);
        if (resolved && htmlFiles.some((file) => file.path === resolved)) setPreviewFile(resolved);
      };
    } catch { /* The isolated preview remains usable even if click interception is unavailable. */ }
  }

  return (
    <main className={styles.page}>
      <div className={styles.topbar}>
        <Link href="/student/labs" className={styles.back}>← All practical labs</Link>
        <div className={styles.topStatus}><span className={`${styles.pill} ${status === "approved" ? styles.approved : status === "submitted" ? styles.submitted : status === "revision_required" ? styles.revision : ""}`}>{status === "new" ? "Not started" : status.replaceAll("_", " ")}</span><span role="status" aria-live="polite">{saveLabel}</span>{updated && <span>Last saved {new Date(updated).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</span>}</div>
      </div>
      <header className={styles.hero}>
        <div><p className={styles.eyebrow}>RUFFNECK LEARN · ADVANCED PROJECT STUDIO</p><p className={styles.trackLabel}>{trackLabel} · {courseTitle}</p><h1>{track === "web_development" ? "Build a real multi-page website" : "Create a publication ready for distribution"}</h1><p>{summary}</p></div>
        <div className={styles.heroBadge}><strong>{track === "web_development" ? "HTML + CSS" : "Editorial + Content"}</strong><span>{track === "web_development" ? `${files.length} project files` : `${metadata.publicationType.replaceAll("_", " ")} package`}</span><span>{totalRubric || 100}/100 rubric points</span></div>
      </header>
      <section className={styles.briefGrid}>
        <div className={styles.panel}><h2>Project brief</h2><p className={styles.prewrap}>{instructions}</p><h3>Required deliverable</h3><p className={styles.prewrap}>{deliverable}</p></div>
        <aside className={styles.panel}><h2>Practice sequence</h2><ol className={styles.steps}>{practiceSteps.map((step, index) => <li key={`${index}-${step.slice(0, 18)}`}>{step}</li>)}</ol><h3>Assessment rubric</h3><ol className={styles.rubric}>{rubric.map((item) => <li key={item.criterion}><span><strong>{item.criterion}</strong>{item.description && <small>{item.description}</small>}</span><b>{item.points}</b></li>)}</ol></aside>
      </section>
      {feedback && (status === "revision_required" || status === "approved") && <section className={`${styles.message} ${status === "revision_required" ? styles.warning : styles.success}`}><strong>{status === "revision_required" ? "Instructor feedback — revision required" : "Instructor feedback"}</strong><p>{feedback}</p>{score !== null && <small>Current score: {score}/100</small>}</section>}
      {status === "submitted" && <p className={styles.notice}>Your project is awaiting instructor review. Editing is locked until the instructor responds.</p>}
      {status === "approved" && <p className={styles.notice}>This project has been approved and is locked.</p>}

      {track === "digital_publishing" && <section className={styles.panel}>
        <div className={styles.sectionHead}><div><p className={styles.eyebrow}>PUBLICATION METADATA</p><h2>Editorial details</h2></div><span className={styles.muted}>Export metadata follows this form.</span></div>
        <div className={styles.metadataGrid}>
          <label>Publication type<select value={metadata.publicationType} onChange={(e) => updateMetadata("publicationType", e.target.value)} disabled={!canEdit}><option value="article">Article / blog post</option><option value="newsletter">Newsletter</option><option value="ebook_chapter">eBook chapter</option><option value="press_release">Press release</option><option value="editorial_feature">Editorial feature</option></select></label>
          <label>Title<input value={metadata.title} onChange={(e) => updateMetadata("title", e.target.value)} maxLength={160} disabled={!canEdit}/></label>
          <label>Subtitle / deck<input value={metadata.subtitle} onChange={(e) => updateMetadata("subtitle", e.target.value)} maxLength={220} disabled={!canEdit}/></label>
          <label>Byline / author<input value={metadata.byline} onChange={(e) => updateMetadata("byline", e.target.value)} maxLength={120} disabled={!canEdit}/></label>
          <label>URL slug<input value={metadata.slug} onChange={(e) => updateMetadata("slug", e.target.value)} maxLength={90} disabled={!canEdit}/><small>{safeSlug(metadata.slug) || "your-publication-title"}</small></label>
          <label>Category<input value={metadata.category} onChange={(e) => updateMetadata("category", e.target.value)} maxLength={80} disabled={!canEdit}/></label>
          <label>Tags, comma separated<input value={metadata.tags} onChange={(e) => updateMetadata("tags", e.target.value)} maxLength={250} disabled={!canEdit}/></label>
          <label>Publication date<input type="date" value={metadata.publishDate} onChange={(e) => updateMetadata("publishDate", e.target.value)} disabled={!canEdit}/></label>
          <label className={styles.full}>Excerpt<textarea value={metadata.excerpt} onChange={(e) => updateMetadata("excerpt", e.target.value)} rows={2} maxLength={360} disabled={!canEdit}/></label>
          <label>SEO title<input value={metadata.seoTitle} onChange={(e) => updateMetadata("seoTitle", e.target.value)} maxLength={70} disabled={!canEdit}/><small>{metadata.seoTitle.length}/70</small></label>
          <label>SEO description<textarea value={metadata.metaDescription} onChange={(e) => updateMetadata("metaDescription", e.target.value)} rows={2} maxLength={160} disabled={!canEdit}/><small>{metadata.metaDescription.length}/160 characters</small></label>
        </div>
      </section>}

      <section className={styles.workbench}>
        <div className={styles.sectionHead}><div><p className={styles.eyebrow}>YOUR PROJECT FILES</p><h2>{track === "web_development" ? "Multi-file website builder" : "Digital publishing workspace"}</h2><p>{track === "web_development" ? "Manage connected HTML pages, shared CSS and small image assets. Select a page in the preview to test internal navigation." : "Write in Markdown, manage your publication stylesheet and metadata, then export a publication-ready package."}</p></div><div className={styles.actions}><button type="button" className={styles.secondary} onClick={exportProject} disabled={!files.length}>Download project ZIP</button>{track === "digital_publishing" && <button type="button" className={styles.secondary} onClick={printPublication}>Print / Save as PDF</button>}</div></div>
        <div className={styles.workspaceGrid}>
          <aside className={styles.filePanel} aria-label="Project files"><div className={styles.filePanelHeader}><strong>Project explorer</strong><span>{files.length}/{MAX_FILES}</span></div>
            <div className={styles.fileTree}>{files.map((file) => <button key={file.path} type="button" className={`${styles.fileItem} ${file.path === activeFile ? styles.fileActive : ""}`} onClick={() => { setActiveFile(file.path); if (track === "web_development" && file.path.toLowerCase().endsWith(".html")) setPreviewFile(file.path); }} disabled={!canEdit && file.path !== activeFile}><span aria-hidden="true">{file.content.startsWith("data:image/") ? "▧" : file.path.endsWith(".html") ? "◇" : file.path.endsWith(".css") ? "#" : file.path.endsWith(".md") ? "¶" : file.path.endsWith(".json") ? "{}" : "▤"}</span>{file.path}</button>)}</div>
            {!locked && <><button type="button" className={styles.textButton} onClick={() => setShowAddFile((value) => !value)}>+ New file</button>{showAddFile && <div className={styles.addFile}><label htmlFor="new-project-file">Relative path</label><input id="new-project-file" value={newFilePath} onChange={(e) => setNewFilePath(e.target.value)} placeholder={track === "web_development" ? "pages/services.html" : "sources/interview-notes.md"}/><button type="button" className={styles.secondary} onClick={addFile}>Create file</button></div>}
              <label className={styles.uploadLabel}>Upload image (PNG/JPEG/WebP, max 150 KB)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadAsset} disabled={!canEdit}/></label>
              <button type="button" className={styles.textButtonDanger} onClick={deleteActiveFile} disabled={!canEdit}>Delete selected file</button></>}
          </aside>
          <div className={styles.editorPanel}>
            <div className={styles.editorToolbar}><strong>{activeFile}</strong><span>{activeContent.length.toLocaleString()} characters</span><button type="button" className={styles.secondary} onClick={() => { const file = files.find((item) => item.path === activeFile); if (file) downloadFile(file); }}>Download file</button></div>
            {activeContent.startsWith("data:image/") ? <div className={styles.assetPreview}><img src={activeContent} alt={`Preview of ${activeFile}`} /><p>This asset is stored in the project and will be included in the ZIP export.</p></div> : <label className={styles.codeLabel} htmlFor="project-code-editor">Edit file contents<textarea id="project-code-editor" value={activeContent} onChange={(e) => updateFile(activeFile, e.target.value)} spellCheck={activeFile.endsWith(".md")} readOnly={!canEdit} className={styles.codeEditor} rows={24}/></label>}
            <div className={styles.reflection}><label htmlFor="project-reflection">Project reflection <span>{reflection.length}/{REFLECTION_LIMIT}</span><textarea id="project-reflection" rows={3} value={reflection} onChange={(e) => setReflection(e.target.value.slice(0, REFLECTION_LIMIT))} maxLength={REFLECTION_LIMIT} disabled={!canEdit} placeholder="Describe your audience, one key decision, what you tested and what you would improve next." /></label></div>
          </div>
        </div>
      </section>

      <section className={styles.previewSection}>
        <div className={styles.previewHead}><div><p className={styles.eyebrow}>{track === "web_development" ? "LIVE MULTI-PAGE PREVIEW" : "PUBLICATION PREVIEW"}</p><h2>{track === "web_development" ? "Test the website" : "Review the publication"}</h2></div><div className={styles.previewControls}>{track === "web_development" && <label>Preview page<select value={previewFile} onChange={(e) => setPreviewFile(e.target.value)}>{htmlFiles.map((file) => <option key={file.path} value={file.path}>{file.path}</option>)}</select></label>}{([ ["desktop", "Desktop"], ["tablet", "Tablet"], ["mobile", "Mobile"] ] as [typeof previewMode, string][]).map(([mode, label]) => <button key={mode} type="button" className={previewMode === mode ? styles.activeView : styles.secondary} onClick={() => setPreviewMode(mode)} aria-pressed={previewMode === mode}>{label}</button>)}</div></div>
        <div className={styles.previewStage}><div className={styles.previewFrame} style={{ width: previewWidth, maxWidth: "100%" }}><iframe ref={iframeRef} title={track === "web_development" ? `${previewFile} website preview` : "Publication preview"} srcDoc={previewDocument} sandbox="allow-same-origin" referrerPolicy="no-referrer" onLoad={handleFrameLoad}/></div></div>
        <p className={styles.previewSafety}>{track === "web_development" ? "The preview blocks JavaScript, pop-ups, form submission and external network requests. This is an HTML/CSS learning environment." : "This publication preview renders Markdown as safe HTML. Script execution and external network requests are blocked."}</p>
      </section>

      <section className={styles.panel}><div className={styles.sectionHead}><div><p className={styles.eyebrow}>PRE-SUBMISSION CHECKS</p><h2>{track === "web_development" ? "Project quality checks" : "Editorial and publication checks"}</h2></div><strong className={styles.checkScore}>{passedChecks}/{checks.length} passed</strong></div><div className={styles.checkList}>{checks.map((check) => <div className={check.passed ? styles.checkPass : styles.checkPending} key={check.label}><span aria-hidden="true">{check.passed ? "✓" : "○"}</span>{check.label}</div>)}</div>{track === "digital_publishing" && <p className={styles.publishNotice}><strong>Publishing:</strong> This studio prepares an export-ready publication. After instructor approval, you can publish it to a public RuffNeck Learn URL below. External CMS integrations are not included.</p>}</section>

      {message && <div className={`${styles.message} ${message.kind === "error" ? styles.error : message.kind === "success" ? styles.success : styles.info}`} role="status" aria-live="polite">{message.text}</div>}
      <section className={`${styles.panel} ${styles.publicPublishPanel}`} aria-labelledby="public-publish-title">
        <div className={styles.sectionHead}>
          <div><p className={styles.eyebrow}>PUBLIC RELEASE</p><h2 id="public-publish-title">Publish your approved project</h2></div>
          <span className={styles.muted}>{publishedSlug ? "Live" : "Not published"}</span>
        </div>
        {publicationState === "checking" ? <p className={styles.muted}>Checking publication availability…</p> : publicationState === "unavailable" ? <p className={styles.publishNotice}>Public publishing is not configured in this deployment yet. The private project workspace and export tools remain available.</p> : status !== "approved" ? <p className={styles.muted}>Public publishing unlocks after an instructor approves the submitted project. You can continue editing until submission; submitted work is locked during review.</p> : <>
          <p className={styles.muted}>Anyone with this URL can view the published project. Publish only work you have permission to share; do not include private information.</p>
          <div className={styles.publicPublishRow}>
            <label htmlFor="public-project-slug">Public URL slug</label>
            <div className={styles.publicSlugField}><span>/p/</span><input id="public-project-slug" className={styles.publicSlugInput} value={publishSlugInput} maxLength={64} onChange={(event) => setPublishSlugInput(event.target.value)} disabled={publicationBusy} autoComplete="off" spellCheck={false} /></div>
          </div>
          {publishedSlug ? <p className={styles.publicLiveLink}><strong>Live URL:</strong> <a href={`/p/${publishedSlug}`} target="_blank" rel="noopener noreferrer">{`/p/${publishedSlug}`}</a></p> : null}
          {!publishedSlug ? <label className={styles.publicConfirm}><input type="checkbox" checked={publishConfirmed} onChange={(event) => setPublishConfirmed(event.target.checked)} disabled={publicationBusy} /><span>I confirm this project is ready to be shared publicly and contains no private or unauthorized material.</span></label> : <label className={styles.publicConfirm}><input type="checkbox" checked={publishConfirmed} onChange={(event) => setPublishConfirmed(event.target.checked)} disabled={publicationBusy} /><span>I confirm that the updated public project remains safe to share.</span></label>}
          <div className={styles.publicPublishActions}>
            <button type="button" className={styles.primary} onClick={() => void changePublicState("publish")} disabled={publicationBusy || !publishConfirmed}>{publicationBusy ? "Publishing…" : publishedSlug ? "Update publication" : "Publish publicly"}</button>
            {publishedSlug ? <button type="button" className={styles.secondary} onClick={() => void changePublicState("unpublish")} disabled={publicationBusy}>{publicationBusy ? "Working…" : "Unpublish"}</button> : null}
            {publishedSlug ? <a className={styles.secondary} href={`/p/${publishedSlug}`} target="_blank" rel="noopener noreferrer">Open live project</a> : null}
          </div>
        </>}
      </section>

      <footer className={styles.footerActions}><div><span className={styles.eyebrow}>SUBMISSION</span><p>Drafts autosave after brief inactivity. Final submissions are locked while awaiting review.</p></div><div><button type="button" className={styles.secondary} onClick={() => void saveProject("draft")} disabled={!canEdit}>Save draft</button><button type="button" className={styles.primary} onClick={() => void saveProject("submitted")} disabled={!canEdit}>Submit for review</button></div></footer>
    </main>
  );
}
