import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";
export const alt = "Published project created with RuffNeck Learn";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };
type RpcClient = {
  rpc: (
    functionName: string,
    parameters: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

type ImageProject = {
  publication_slug: string;
  project_title: string;
  project_type: string;
  project_json: unknown;
};

async function getProject(slug: string): Promise<ImageProject | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 64) return null;
  try {
    const supabase = await createClient();
    const rpc = supabase as unknown as RpcClient;
    const { data, error } = await rpc.rpc("get_published_lab_project", { p_slug: slug });
    if (error) return null;
    const item = Array.isArray(data) ? data[0] : data;
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const row = item as Record<string, unknown>;
    if (
      row.publication_slug !== slug ||
      typeof row.project_title !== "string" ||
      (row.project_type !== "web_development" && row.project_type !== "digital_publishing")
    ) return null;
    return row as unknown as ImageProject;
  } catch {
    return null;
  }
}

function getMetadata(project: ImageProject | null) {
  const raw = project?.project_json && typeof project.project_json === "object" && !Array.isArray(project.project_json)
    ? (project.project_json as Record<string, unknown>).metadata
    : null;
  const meta = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const titleValue = typeof meta.seoTitle === "string" && meta.seoTitle.trim()
    ? meta.seoTitle
    : typeof meta.title === "string" && meta.title.trim()
      ? meta.title
      : project?.project_title || "RuffNeck Learn Project";
  const excerptValue = typeof meta.metaDescription === "string" && meta.metaDescription.trim()
    ? meta.metaDescription
    : typeof meta.excerpt === "string" && meta.excerpt.trim()
      ? meta.excerpt
      : project?.project_type === "web_development"
        ? "A responsive website built with HTML and CSS in RuffNeck Learn."
        : "A digital publication prepared in RuffNeck Learn.";
  return {
    title: titleValue.replace(/\s+/g, " ").trim().slice(0, 100),
    description: excerptValue.replace(/\s+/g, " ").trim().slice(0, 180),
    kind: project?.project_type === "web_development" ? "WEB PROJECT" : "DIGITAL PUBLICATION",
  };
}

export default async function OpenGraphImage({ params }: Props) {
  const { slug } = await params;
  const project = await getProject(slug);
  const metadata = getMetadata(project);

  return new ImageResponse(
    (
      <div style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 64,
        background: "#07162d",
        color: "#f8fafc",
        fontFamily: "Arial, sans-serif",
        border: "14px solid #fbbf24",
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 16, height: 16, background: "#fbbf24", borderRadius: 4 }} />
            <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: 3, color: "#fbbf24" }}>RUFFNECK LEARN</span>
          </div>
          <div style={{ fontSize: 20, letterSpacing: 4, color: "#cbd5e1", fontWeight: 700 }}>{metadata.kind}</div>
          <div style={{ fontSize: metadata.title.length > 58 ? 44 : 58, lineHeight: 1.12, fontWeight: 800, maxWidth: 1030, overflow: "hidden" }}>{metadata.title}</div>
          <div style={{ fontSize: 25, lineHeight: 1.4, color: "#dbe4ee", maxWidth: 1000 }}>{metadata.description}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 20, color: "#cbd5e1", borderTop: "1px solid #334155", paddingTop: 24 }}>
          <span>Practical work, made visible.</span>
          <span>ruffneck-lms.vercel.app</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
