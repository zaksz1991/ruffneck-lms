import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PUBLIC_SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://ruffneck-lms.vercel.app").replace(/\/+$/, "");

type PublishedProject = {
  publication_slug: string;
  project_title: string;
  project_type: "web_development" | "digital_publishing";
  published_at: string | null;
};

type RpcClient = {
  rpc: (
    functionName: string,
    parameters: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

function parsePublishedProjects(value: unknown): PublishedProject[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): PublishedProject[] => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    if (
      typeof row.publication_slug !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.publication_slug) ||
      row.publication_slug.length > 64 ||
      typeof row.project_title !== "string" ||
      (row.project_type !== "web_development" && row.project_type !== "digital_publishing")
    ) return [];
    return [{
      publication_slug: row.publication_slug,
      project_title: row.project_title.slice(0, 160),
      project_type: row.project_type,
      published_at: typeof row.published_at === "string" ? row.published_at : null,
    }];
  });
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${PUBLIC_SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${PUBLIC_SITE_URL}/courses`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${PUBLIC_SITE_URL}/showcase`, changeFrequency: "daily", priority: 0.8 },
  ];

  try {
    const supabase = await createClient();
    const rpc = supabase as unknown as RpcClient;
    const result = await rpc.rpc("list_published_lab_projects", { p_limit: 100 });
    if (result.error) {
      console.error("Sitemap public project lookup failed:", result.error);
      return staticEntries;
    }

    const projects = parsePublishedProjects(result.data);
    const projectEntries: MetadataRoute.Sitemap = projects.map((project) => {
      // Website URLs use the actual index document; articles use their public reader route.
      const path = project.project_type === "web_development"
        ? `/p/${encodeURIComponent(project.publication_slug)}/file/index.html`
        : `/p/${encodeURIComponent(project.publication_slug)}`;
      const date = project.published_at ? new Date(project.published_at) : null;
      return {
        url: `${PUBLIC_SITE_URL}${path}`,
        ...(date && !Number.isNaN(date.getTime()) ? { lastModified: date } : {}),
        changeFrequency: "monthly",
        priority: 0.6,
      };
    });

    return [...staticEntries, ...projectEntries];
  } catch (error) {
    console.error("Sitemap generation failed:", error);
    return staticEntries;
  }
}
