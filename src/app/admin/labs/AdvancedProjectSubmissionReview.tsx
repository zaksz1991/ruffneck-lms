"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./AdvancedProjectSubmissionReview.module.css";

type ProjectFile = { path: string; content: string };
type Track = "web_development" | "digital_publishing";
type Workspace = {
  id: string;
  lab_id: string;
  student_id: string;
  project_type: Track;
  project_title: string;
  project_json: { files?: ProjectFile[]; metadata?: Record<string, unknown> };
  reflection: string | null;
  updated_at: string;
};
type Tab = "preview" | "files" | "reflection" | "metadata";
type Props = { answerText: string };

function parseWorkspacePointer(answerText: string) {
  if (!answerText.startsWith("RUFFNECK_ADVANCED_PROJECT_STUDIO_V1")) return null;
  const id = /^Workspace:\s*([0-9a-f-]{36})\s*$/im.exec(answerText)?.[1];
  const title = /^Project:\s*(.+)$/im.exec(answerText)?.[1]?.trim() || "Advanced student project";
  const track = /^Type:\s*(web_development|digital_publishing)\s*$/im.exec(answerText)?.[1] as Track | undefined;
  return id ? { id, title, track: track ?? "web_development" } : null;
}
function downloadFile(filename: string, content: string) {
  const blob = content.startsWith("data:") && content.includes(";base64,")
    ? (() => { const raw = atob(content.slice(content.indexOf(",") + 1)); const bytes = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i); return new Blob([bytes]); })()
    : new Blob([content], { type: filename.endsWith(".css") ? "text/css;charset=utf-8" : "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function esc(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
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
    if (segment === "..") { if (!parts.length) return null; parts.pop(); }
    else parts.push(segment);
  }
  return parts.join("/") || null;
}
function imageAsset(baseFilePath: string, requestedPath: string, files: ProjectFile[]) {
  if (/^(?:data:|blob:|https?:|\/\/|#)/i.test(requestedPath.trim())) return undefined;
  const path = resolveProjectPath(baseFilePath, requestedPath);
  if (!path) return undefined;
  const found = files.find((file) => file.path === path);
  return found && /^data:image\/(?:png|jpeg|webp);base64,/i.test(found.content) ? found : undefined;
}
function cssForPreview(css: string, cssPath: string, files: ProjectFile[]) {
  return css.replace(/@import\s+[^;]+;?/gi, "")
    .replace(/url\(\s*(?:(['"])(.*?)\1|([^)]*?))\s*\)/gi, (whole, _quote: string | undefined, quoted: string | undefined, unquoted: string | undefined) => {
      const reference = (quoted ?? unquoted ?? "").trim();
      if (!reference || /^(?:data:|blob:|https?:|\/\/|#)/i.test(reference)) return whole;
      const asset = imageAsset(cssPath, reference, files);
      return asset ? `url("${asset.content}")` : whole;
    }).replace(/<\/style/gi, "<\\/style");
}
function mdInline(value: string, files: ProjectFile[], markdownPath = "publication.md") {
  let result = esc(value);
  result = result.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_whole, alt: string, path: string, title: string | undefined) => {
    const asset = imageAsset(markdownPath, path, files);
    if (!asset) return `<span class="image-not-available">[Image unavailable in this offline preview: ${alt || "image"}]</span>`;
    return `<img src="${asset.content}" alt="${alt}"${title ? ` title="${title}"` : ""} loading="lazy">`;
  });
  return result.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+|tel:[^\s)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\*([^*]+)\*/g, "<em>$1</em>").replace(/`([^`]+)`/g, "<code>$1</code>");
}
function markdownHtml(markdown: string, files: ProjectFile[]) {
  const output: string[] = []; let paragraph: string[] = []; let list = false;
  const flush = () => { if (paragraph.length) output.push(`<p>${paragraph.map((part) => mdInline(part, files)).join(" ")}</p>`); paragraph = []; };
  const closeList = () => { if (list) { output.push("</ul>"); list = false; } };
  for (const raw of markdown.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (!line) { flush(); closeList(); continue; }
    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) { flush(); closeList(); const level = heading[1].length + 1; output.push(`<h${level}>${mdInline(heading[2], files)}</h${level}>`); continue; }
    if (/^[-*+]\s+/.test(line)) { flush(); if (!list) { output.push("<ul>"); list = true; } output.push(`<li>${mdInline(line.replace(/^[-*+]\s+/, ""), files)}</li>`); continue; }
    if (/^>\s?/.test(line)) { flush(); closeList(); output.push(`<blockquote><p>${mdInline(line.replace(/^>\s?/, ""), files)}</p></blockquote>`); continue; }
    paragraph.push(line);
  }
  flush(); closeList(); return output.join("\n");
}
function linkedStylesheets(html: string, htmlPath: string, files: ProjectFile[]) {
  const found: ProjectFile[] = [];
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const rel = /\brel\s*=\s*(["'])(.*?)\1/i.exec(tag)?.[2] ?? "";
    if (!rel.toLowerCase().split(/\s+/).includes("stylesheet")) continue;
    const href = /\bhref\s*=\s*(["'])(.*?)\1/i.exec(tag)?.[2];
    if (!href || /^(?:data:|blob:|https?:|\/\/|#)/i.test(href)) continue;
    const path = resolveProjectPath(htmlPath, href);
    const file = path ? files.find((candidate) => candidate.path === path && candidate.path.toLowerCase().endsWith(".css")) : undefined;
    if (file && !found.some((candidate) => candidate.path === file.path)) found.push(file);
  }
  return found;
}
function buildPreview(workspace: Workspace, files: ProjectFile[], selectedPath: string) {
  const policy = "default-src 'none'; script-src 'none'; connect-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data:; media-src data:; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";
  if (workspace.project_type === "digital_publishing") {
    const metadata = workspace.project_json.metadata ?? {};
    const get = (key: string) => typeof metadata[key] === "string" ? String(metadata[key]) : "";
    const publicationCssFile = files.find((file) => file.path === "publication.css");
    const css = cssForPreview(publicationCssFile?.content ?? "", publicationCssFile?.path ?? "publication.css", files);
    const body = markdownHtml(files.find((file) => file.path === "publication.md")?.content ?? "", files);
    const title = esc(get("title") || workspace.project_title);
    const description = esc(get("metaDescription") || get("excerpt"));
    const seoTitle = esc(get("seoTitle") || get("title") || workspace.project_title);
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${policy}"><title>${seoTitle}</title><meta name="description" content="${description}"><style>${css}</style></head><body><header class="publication-header"><div><p class="eyebrow">${esc(get("category"))}</p><h1>${title}</h1><p class="subtitle">${esc(get("subtitle"))}</p><p class="byline">By ${esc(get("byline"))} · ${esc(get("publishDate"))}</p></div></header><article>${body}</article><footer class="publication-footer">Instructor preview · external requests disabled</footer></body></html>`;
  }
  const htmlFile = files.find((file) => file.path === selectedPath) ?? files.find((file) => file.path === "index.html") ?? files.find((file) => file.path.toLowerCase().endsWith(".html"));
  const html = htmlFile?.content ?? "";
  const htmlPath = htmlFile?.path ?? selectedPath;
  const baseDir = htmlPath.includes("/") ? htmlPath.slice(0, htmlPath.lastIndexOf("/") + 1) : "";
  let safeHtml = html
    .replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "")
    .replace(/<\s*(iframe|object|embed|applet|base)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(iframe|object|embed|applet|base)\b[^>]*\/?\s*>/gi, "")
    .replace(/<meta\b(?=[^>]*\bhttp-equiv\s*=\s*(?:"refresh"|'refresh'|refresh\b))[^>]*>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+srcdoc\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '$1="#"');
  safeHtml = safeHtml.replace(/<link\b[^>]*rel\s*=\s*(["'])[^"']*\bstylesheet\b[^"']*\1[^>]*>/gi, "");
  safeHtml = safeHtml.replace(/\s(src|poster)\s*=\s*(["'])(?!data:|blob:|https?:|\/\/|#)([^"']+)\2/gi, (full, attr, quote, path) => {
    const asset = imageAsset(htmlPath, path, files);
    return asset ? ` ${attr}=${quote}${asset.content}${quote}` : full;
  });
  const cssLinks = linkedStylesheets(html, htmlPath, files);
  const fallbackCss = files.find((file) => /(^|\/)styles\.css$/i.test(file.path)) ?? files.find((file) => file.path.toLowerCase().endsWith(".css"));
  const cssFiles = cssLinks.length ? cssLinks : fallbackCss ? [fallbackCss] : [];
  const css = cssFiles.map((file) => cssForPreview(file.content, file.path, files)).join("\n\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${policy}"><style>${css}</style></head><body>${safeHtml}</body></html>`;
}

export default function AdvancedProjectSubmissionReview({ answerText }: Props) {
  const pointer = useMemo(() => parseWorkspacePointer(answerText), [answerText]);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("preview");
  const [activeFile, setActiveFile] = useState("index.html");
  const [previewFile, setPreviewFile] = useState("index.html");
  const [width, setWidth] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!pointer?.id) { setError("This submission does not contain a valid project workspace link."); setLoading(false); return; }
      setLoading(true); setError(null);
      try {
        const response = await fetch(`/api/admin/labs/advanced-studio/${encodeURIComponent(pointer.id)}`, { cache: "no-store" });
        const result = await response.json().catch(() => null) as { ok?: boolean; error?: string; workspace?: Workspace } | null;
        if (!response.ok || !result?.ok || !result.workspace) throw new Error(result?.error || "Unable to load the submitted project files.");
        const row = result.workspace;
        const nextFiles = Array.isArray(row.project_json?.files) ? row.project_json.files.filter((file) => file && typeof file.path === "string" && typeof file.content === "string") : [];
        if (!cancelled) {
          setWorkspace(row); setFiles(nextFiles);
          const firstHtml = nextFiles.find((file) => file.path === "index.html") ?? nextFiles.find((file) => file.path.endsWith(".html"));
          setActiveFile(firstHtml?.path ?? nextFiles[0]?.path ?? ""); setPreviewFile(firstHtml?.path ?? "index.html");
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load the submitted project.");
      } finally { if (!cancelled) setLoading(false); }
    }
    void load(); return () => { cancelled = true; };
  }, [pointer?.id]);

  const htmlFiles = files.filter((file) => file.path.toLowerCase().endsWith(".html"));
  const preview = useMemo(() => workspace ? buildPreview(workspace, files, previewFile) : "", [workspace, files, previewFile]);
  const viewportWidth = width === "desktop" ? "100%" : width === "tablet" ? "768px" : "375px";
  const metadata = workspace?.project_json.metadata ?? {};

  function handlePreviewLoad() {
    try {
      const documentRef = previewFrameRef.current?.contentDocument;
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
        if (workspace?.project_type !== "web_development") { event.preventDefault(); return; }
        const pathPart = href.split(/[?#]/)[0];
        if (!pathPart.toLowerCase().endsWith(".html")) { event.preventDefault(); return; }
        event.preventDefault();
        const resolved = resolveProjectPath(previewFile, pathPart);
        if (resolved && htmlFiles.some((file) => file.path === resolved)) setPreviewFile(resolved);
      };
    } catch { /* The sandboxed source preview remains readable without click interception. */ }
  }

  if (!pointer) return <div className={styles.fallback}>Advanced project marker detected, but the workspace ID is missing.</div>;
  if (loading) return <section className={styles.root}><p className={styles.muted}>Loading submitted project files…</p></section>;
  if (error || !workspace) return <section className={styles.root}><div className={styles.error}>{error || "Project workspace unavailable."}</div><p className={styles.muted}>The submission record remains available above; project files could not be retrieved.</p></section>;
  const active = files.find((file) => file.path === activeFile);

  return (
    <section className={styles.root} aria-label="Advanced project submission review">
      <header className={styles.header}><div><p className={styles.kicker}>{workspace.project_type === "web_development" ? "MULTI-FILE WEBSITE PROJECT" : "DIGITAL PUBLICATION PROJECT"}</p><h3>{workspace.project_title || pointer.title}</h3><p className={styles.muted}>{files.length} project files · Updated {new Date(workspace.updated_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</p></div><button type="button" className={styles.secondary} onClick={() => { if (active) downloadFile(active.path.split("/").pop() || active.path, active.content); }} disabled={!active}>Download selected file</button></header>
      <div className={styles.tabs} role="tablist" aria-label="Project review views">
        {([ ["preview", "Live preview"], ["files", "Project files"], ["reflection", "Reflection"], ["metadata", "Metadata"] ] as [Tab, string][]).map(([tab, label]) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} className={`${styles.tab} ${activeTab === tab ? styles.activeTab : ""}`} onClick={() => setActiveTab(tab)}>{label}</button>)}
      </div>
      {activeTab === "preview" && <div className={styles.panel}>
        <div className={styles.toolbar}><strong>{workspace.project_type === "web_development" ? "Website preview" : "Publication preview"}</strong><div className={styles.controls}>{workspace.project_type === "web_development" && <label>Page<select value={previewFile} onChange={(event) => setPreviewFile(event.target.value)}>{htmlFiles.map((file) => <option key={file.path} value={file.path}>{file.path}</option>)}</select></label>}{([ ["desktop", "Desktop"], ["tablet", "Tablet"], ["mobile", "Mobile"] ] as [typeof width, string][]).map(([value, label]) => <button key={value} type="button" className={width === value ? styles.activeWidth : styles.secondary} aria-pressed={width === value} onClick={() => setWidth(value)}>{label}</button>)}</div></div>
        <div className={styles.previewStage}><div className={styles.previewFrame} style={{ width: viewportWidth, maxWidth: "100%" }}><iframe ref={previewFrameRef} title={`${workspace.project_title} instructor preview`} sandbox="allow-same-origin" referrerPolicy="no-referrer" srcDoc={preview} onLoad={handlePreviewLoad}/></div></div><p className={styles.muted}>Sandboxed preview: scripts, external network requests, forms and pop-ups are blocked.</p>
      </div>}
      {activeTab === "files" && <div className={styles.fileReview}>
        <div className={styles.fileList}><strong>Project explorer</strong>{files.map((file) => <button type="button" key={file.path} className={activeFile === file.path ? styles.fileSelected : styles.fileButton} onClick={() => setActiveFile(file.path)}>{file.path}</button>)}</div>
        <div className={styles.source}><div className={styles.toolbar}><strong>{active?.path ?? "Select a file"}</strong><span>{active?.content.length.toLocaleString() ?? 0} characters</span></div>{active?.content.startsWith("data:image/") ? <img className={styles.asset} src={active.content} alt={`Submitted asset ${active.path}`}/> : <pre><code>{active?.content ?? "Select a file from the project explorer."}</code></pre>}</div>
      </div>}
      {activeTab === "reflection" && <div className={styles.reflection}><h4>Student reflection</h4><p>{workspace.reflection || "No reflection was submitted."}</p></div>}
      {activeTab === "metadata" && <div className={styles.metadata}><h4>Project metadata</h4><dl>{Object.entries(metadata).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{Array.isArray(value) ? value.join(", ") : typeof value === "string" || typeof value === "number" ? String(value) : JSON.stringify(value)}</dd></div>)}</dl><p className={styles.muted}>Track: {workspace.project_type.replaceAll("_", " ")}</p></div>}
    </section>
  );
}
