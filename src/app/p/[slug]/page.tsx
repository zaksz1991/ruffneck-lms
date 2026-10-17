import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: Promise<{ slug: string }> };
type ProjectFile = { path: string; content: string };
type PublicProject = {
  publication_slug: string;
  project_title: string;
  project_type: "web_development" | "digital_publishing";
  project_json: unknown;
  published_at: string | null;
};
type ProjectDocument = { files: ProjectFile[]; metadata: Record<string, string> };
type PublicationRpcResult = { data: unknown; error: { message: string } | null };
async function callPublicationRpc(supabase: Awaited<ReturnType<typeof createClient>>, slug: string): Promise<PublicationRpcResult> {
  const rpc = supabase.rpc as unknown as (functionName: string, parameters: Record<string, unknown>) => Promise<PublicationRpcResult>;
  return rpc("get_published_lab_project", { p_slug: slug });
}

function normaliseProject(data: unknown): PublicProject | null {
  const item = Array.isArray(data) ? data[0] : data;
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const row = item as Record<string, unknown>;
  if (typeof row.publication_slug !== "string" || typeof row.project_title !== "string") return null;
  if (row.project_type !== "web_development" && row.project_type !== "digital_publishing") return null;
  if (!row.project_json || typeof row.project_json !== "object" || Array.isArray(row.project_json)) return null;
  return row as unknown as PublicProject;
}

async function getPublicProject(slug: string): Promise<PublicProject | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 64) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await callPublicationRpc(supabase, slug);
    if (error) {
      console.error("Public project lookup failed:", error);
      return null;
    }
    return normaliseProject(data);
  } catch (error) {
    console.error("Public project lookup failed:", error);
    return null;
  }
}

function readProject(value: unknown): ProjectDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { files: [], metadata: {} };
  const row = value as Record<string, unknown>;
  const files = Array.isArray(row.files) ? row.files.flatMap((value): ProjectFile[] => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const item = value as Record<string, unknown>;
    return typeof item.path === "string" && typeof item.content === "string" ? [{ path: item.path, content: item.content }] : [];
  }) : [];
  const raw = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? row.metadata as Record<string, unknown> : {};
  const metadata: Record<string, string> = {};
  for (const [key, item] of Object.entries(raw)) {
    if (typeof item === "string") metadata[key] = item.slice(0, 2000);
    else if (Array.isArray(item)) metadata[key] = item.filter((part) => typeof part === "string").join(", ").slice(0, 2000);
  }
  return { files, metadata };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function inlineMarkdown(value: string, files: ProjectFile[]): string {
  const placeholders: string[] = [];
  const withImages = value.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_whole, alt: string, source: string) => {
    const asset = files.find((file) => file.path === source && file.content.startsWith("data:image/"));
    if (!asset || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/i.test(asset.content)) {
      return escapeHtml(alt || "Image asset unavailable");
    }
    const token = `RNEPUBLICIMAGE${placeholders.length}TOKEN`;
    placeholders.push(`<img src="${asset.content}" alt="${escapeHtml(alt)}" loading="lazy">`);
    return token;
  });
  const withCode = withImages.replace(/`([^`]+)`/g, (_whole, code: string) => {
    const token = `RNEPUBLICCODE${placeholders.length}TOKEN`;
    placeholders.push(`<code>${escapeHtml(code)}</code>`);
    return token;
  });
  let html = escapeHtml(withCode);
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_whole, label: string, url: string) => `<a href="${url}" rel="nofollow noopener noreferrer">${label}</a>`);
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/RNEPUBLIC(?:IMAGE|CODE)(\d+)TOKEN/g, (_whole, index: string) => placeholders[Number(index)] ?? "");
  return html;
}

function markdownToHtml(markdown: string, files: ProjectFile[]): string {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n").slice(0, 12000);
  const output: string[] = [];
  let list: "ul" | "ol" | null = null;
  let inCode = false;
  let codeLines: string[] = [];
  const closeList = () => {
    if (list) output.push(`</${list}>`);
    list = null;
  };
  const closeCode = () => {
    if (inCode) output.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
    codeLines = [];
    inCode = false;
  };
  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      closeList();
      if (!inCode) { inCode = true; codeLines = []; } else closeCode();
      continue;
    }
    if (inCode) { codeLines.push(line); continue; }
    if (!line.trim()) { closeList(); continue; }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      closeList();
      const level = heading[1].length;
      output.push(`<h${level}>${inlineMarkdown(heading[2], files)}</h${level}>`);
      continue;
    }
    const bullet = /^\s*[-*]\s+(.+)$/.exec(line);
    if (bullet) {
      if (list !== "ul") { closeList(); list = "ul"; output.push("<ul>"); }
      output.push(`<li>${inlineMarkdown(bullet[1], files)}</li>`);
      continue;
    }
    const ordered = /^\s*\d+[.)]\s+(.+)$/.exec(line);
    if (ordered) {
      if (list !== "ol") { closeList(); list = "ol"; output.push("<ol>"); }
      output.push(`<li>${inlineMarkdown(ordered[1], files)}</li>`);
      continue;
    }
    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) { closeList(); output.push(`<blockquote><p>${inlineMarkdown(quote[1], files)}</p></blockquote>`); continue; }
    closeList();
    output.push(`<p>${inlineMarkdown(line, files)}</p>`);
  }
  closeList();
  closeCode();
  return output.join("\n");
}

function makePublicationDocument(project: ProjectDocument): string {
  const markdown = project.files.find((file) => file.path === "publication.md")?.content ?? "";
  const css = project.files.find((file) => file.path === "publication.css")?.content ?? "";
  const title = escapeHtml(project.metadata.title || "Untitled publication");
  const subtitle = escapeHtml(project.metadata.subtitle || "");
  const byline = escapeHtml(project.metadata.byline || "");
  const date = escapeHtml(project.metadata.publishDate || "");
  const description = escapeHtml(project.metadata.metaDescription || project.metadata.excerpt || "");
  // Keep user CSS inside the sandboxed document. Escape a closing style token so it cannot leave the style element.
  const safeCss = css.replace(/<\/style/gi, "<\\/style");
  const body = markdownToHtml(markdown, project.files);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' data:; img-src data:; font-src data:; script-src 'none'; connect-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'"><meta name="description" content="${description}"><title>${title}</title><style>
:root{color-scheme:light;--ink:#202b3a;--muted:#5c6878;--paper:#fbfaf7;--line:#e7ded2;--accent:#89592d}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:18px/1.8 Georgia,serif}article{max-width:760px;margin:0 auto;padding:clamp(24px,6vw,76px) clamp(18px,5vw,52px)}.pub-title{font-size:clamp(2.1rem,5vw,4.2rem);line-height:1.08;letter-spacing:-.04em;margin:.4em 0}.pub-subtitle{font-size:1.25rem;color:var(--muted)}.pub-meta{font:600 .85rem/1.5 Arial,sans-serif;color:var(--muted);border-bottom:1px solid var(--line);padding-bottom:1.2rem;margin-bottom:2rem}h1,h2,h3{line-height:1.2;letter-spacing:-.025em}h2{margin-top:2em}a{color:var(--accent);overflow-wrap:anywhere}img{max-width:100%;height:auto;border-radius:8px}pre{overflow-wrap:anywhere;white-space:pre-wrap;background:#f0ebe3;padding:1rem;border-radius:8px}blockquote{margin-inline:0;padding-left:1rem;border-left:4px solid var(--accent);color:var(--muted)}${safeCss}
</style></head><body><article><header><p class="pub-meta">${byline}${date ? ` · ${date}` : ""}</p><h1 class="pub-title">${title}</h1>${subtitle ? `<p class="pub-subtitle">${subtitle}</p>` : ""}</header><main>${body}</main><footer class="pub-meta">Published with RuffNeck Learn</footer></article></body></html>`;
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const row = await getPublicProject(slug);
  if (!row) return { title: "Publication not found | RuffNeck Learn", robots: { index: false, follow: false } };
  const project = readProject(row.project_json);
  return {
    title: project.metadata.seoTitle || project.metadata.title || row.project_title,
    description: project.metadata.metaDescription || project.metadata.excerpt || undefined,
    openGraph: {
      title: project.metadata.seoTitle || project.metadata.title || row.project_title,
      description: project.metadata.metaDescription || project.metadata.excerpt || undefined,
      type: row.project_type === "digital_publishing" ? "article" : "website",
    },
  };
}

export default async function PublicProjectPage({ params }: RouteParams) {
  const { slug } = await params;
  const row = await getPublicProject(slug);
  if (!row) notFound();
  const project = readProject(row.project_json);

  if (row.project_type === "web_development") {
    redirect(`/p/${encodeURIComponent(slug)}/file/index.html`);
  }

  const metaTitle = project.metadata.title || row.project_title;
  const metaSubtitle = project.metadata.subtitle || "";
  const metaByline = project.metadata.byline || "RuffNeck Learn Student";
  const metaExcerpt = project.metadata.excerpt || project.metadata.metaDescription || "A publication prepared in RuffNeck Learn.";
  const srcDoc = makePublicationDocument(project);

  return (
    <main style={{ minHeight: "100vh", background: "#f1f5f9", color: "#13263d" }}>
      <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "14px clamp(16px, 4vw, 48px)", background: "#07162d", color: "#f8fafc" }}>
        <a href="https://ruffneck-lms.vercel.app" style={{ color: "#fbbf24", fontWeight: 800, textDecoration: "none" }}>RUFFNECK LEARN</a>
        <span style={{ color: "#cbd5e1", fontSize: 13 }}>Public student publication</span>
      </header>
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "24px clamp(12px, 3vw, 28px) 42px" }}>
        <div style={{ padding: "12px 4px 18px" }}>
          <p style={{ margin: "0 0 8px", textTransform: "uppercase", letterSpacing: ".12em", fontSize: 12, fontWeight: 800, color: "#536273" }}>{metaByline}</p>
          <h1 style={{ margin: "0 0 8px", fontSize: "clamp(25px, 4vw, 42px)", lineHeight: 1.15 }}>{metaTitle}</h1>
          {metaSubtitle ? <p style={{ margin: "0 0 8px", fontSize: 18, color: "#465569" }}>{metaSubtitle}</p> : null}
          <p style={{ margin: 0, color: "#536273", maxWidth: 780 }}>{metaExcerpt}</p>
        </div>
        <iframe
          title={`Published article: ${metaTitle}`}
          srcDoc={srcDoc}
          sandbox=""
          referrerPolicy="no-referrer"
          style={{ display: "block", width: "100%", height: "min(82vh, 1100px)", minHeight: 620, border: "1px solid #d8e0e8", borderRadius: 12, background: "#fbfaf7" }}
        />
        <p style={{ margin: "12px 0 0", fontSize: 12, color: "#536273" }}>This publication is displayed in an isolated reader. Scripts, forms, pop-ups and external network requests are disabled.</p>
      </section>
    </main>
  );
}
