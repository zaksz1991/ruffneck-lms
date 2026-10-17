import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ slug: string; path: string[] }> };
type PublicProject = { project_type: string; project_json: unknown };
type ProjectFile = { path: string; content: string };
type PublicationRpcResult = { data: unknown; error: { message: string } | null };
async function callPublicationRpc(supabase: Awaited<ReturnType<typeof createClient>>, slug: string): Promise<PublicationRpcResult> {
  const rpc = supabase.rpc as unknown as (functionName: string, parameters: Record<string, unknown>) => Promise<PublicationRpcResult>;
  return rpc("get_published_lab_project", { p_slug: slug });
}

const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'none'; script-src 'none'; style-src 'self' 'unsafe-inline' data:; img-src 'self' data:; font-src 'self' data:; media-src 'self' data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "SAMEORIGIN",
  "Cache-Control": "no-store",
};

function notFoundResponse() {
  return new Response("Published project file not found.", {
    status: 404,
    headers: { ...SECURITY_HEADERS, "Content-Type": "text/plain; charset=utf-8" },
  });
}
function normaliseProject(data: unknown): PublicProject | null {
  const item = Array.isArray(data) ? data[0] : data;
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const row = item as Record<string, unknown>;
  if (typeof row.project_type !== "string" || !row.project_json || typeof row.project_json !== "object" || Array.isArray(row.project_json)) return null;
  return row as unknown as PublicProject;
}
function safeFilePath(path: string): boolean {
  return path.length > 0 && path.length <= 140 &&
    /^[A-Za-z0-9._/-]+$/.test(path) &&
    !path.startsWith("/") && !path.includes("\\") &&
    !path.includes("//") && !path.split("/").some((part) => part === "" || part === "." || part === "..") &&
    !path.includes("..");
}
function contentType(path: string): string | null {
  const ext = path.toLowerCase().split(".").pop() ?? "";
  const types: Record<string, string> = {
    html: "text/html; charset=utf-8",
    htm: "text/html; charset=utf-8",
    css: "text/css; charset=utf-8",
    md: "text/markdown; charset=utf-8",
    txt: "text/plain; charset=utf-8",
    json: "application/json; charset=utf-8",
    csv: "text/csv; charset=utf-8",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
  };
  return types[ext] ?? null;
}
function hasUnsafeHtml(html: string): boolean {
  return /<\s*script\b/i.test(html) || /\son[a-z]+\s*=/i.test(html) || /javascript\s*:/i.test(html) || /<\s*(iframe|object|embed|applet)\b/i.test(html) || (/http-equiv/i.test(html) && /refresh/i.test(html));
}
function decodeImage(value: string, path: string): { bytes: Buffer; type: string } | null {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value);
  if (!match) return null;
  const format = match[1].toLowerCase();
  const extension = path.toLowerCase().split(".").pop();
  if ((extension === "png" && format !== "png") || (["jpg", "jpeg"].includes(extension ?? "") && format !== "jpeg") || (extension === "webp" && format !== "webp")) return null;
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > 150 * 1024) return null;
  return { bytes, type: format === "jpeg" ? "image/jpeg" : `image/${format}` };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { slug, path: parts } = await context.params;
    const path = Array.isArray(parts) ? parts.join("/") : "";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !safeFilePath(path)) return notFoundResponse();

    const supabase = await createClient();
    const { data, error } = await callPublicationRpc(supabase, slug);
    if (error) {
      console.error("Published project file lookup failed:", error);
      return notFoundResponse();
    }
    const publication = normaliseProject(data);
    if (!publication || publication.project_type !== "web_development") return notFoundResponse();
    const project = publication.project_json as Record<string, unknown>;
    if (!Array.isArray(project.files)) return notFoundResponse();
    const candidate = (project.files as unknown[]).find((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return false;
      const file = value as Record<string, unknown>;
      return file.path === path && typeof file.content === "string";
    }) as ProjectFile | undefined;
    if (!candidate) return notFoundResponse();

    const type = contentType(path);
    if (!type) return notFoundResponse();
    if (/\.(png|jpe?g|webp)$/i.test(path)) {
      const decoded = decodeImage(candidate.content, path);
      if (!decoded) return notFoundResponse();
      return new Response(decoded.bytes, { status: 200, headers: { ...SECURITY_HEADERS, "Content-Type": decoded.type } });
    }
    if (candidate.content.startsWith("data:")) return notFoundResponse();
    if (/\.html?$/i.test(path) && hasUnsafeHtml(candidate.content)) return notFoundResponse();
    return new Response(candidate.content, { status: 200, headers: { ...SECURITY_HEADERS, "Content-Type": type } });
  } catch (error) {
    console.error("Published project file route failed:", error);
    return notFoundResponse();
  }
}
