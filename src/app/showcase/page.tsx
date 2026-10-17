import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ShowcaseFilters, { type ShowcaseProject } from "@/components/showcase/ShowcaseFilters";
import styles from "./Showcase.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Public Project Showcase | RuffNeck Learn",
  description:
    "Explore published student websites and digital publications created in RuffNeck Learn's practical studios.",
  openGraph: {
    title: "Public Project Showcase | RuffNeck Learn",
    description:
      "Explore approved, published websites and digital publications created through practical learning.",
    type: "website",
  },
};

type ShowcaseRpcClient = {
  rpc: (
    functionName: string,
    parameters: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

function parseProjects(value: unknown): ShowcaseProject[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row): ShowcaseProject[] => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return [];
    const item = row as Record<string, unknown>;
    if (
      typeof item.publication_slug !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.publication_slug) ||
      typeof item.project_title !== "string" ||
      (item.project_type !== "web_development" && item.project_type !== "digital_publishing")
    ) {
      return [];
    }
    return [{
      slug: item.publication_slug,
      title: item.project_title.slice(0, 160),
      type: item.project_type,
      excerpt: typeof item.excerpt === "string" ? item.excerpt.slice(0, 360) : "A project published with RuffNeck Learn.",
      category: typeof item.category === "string" ? item.category.slice(0, 80) : "Practical learning",
      publishedAt: typeof item.published_at === "string" ? item.published_at : null,
    }];
  });
}

export default async function PublicProjectShowcasePage() {
  let projects: ShowcaseProject[] = [];
  let loadError = false;

  try {
    const supabase = await createClient();
    const rpc = supabase as unknown as ShowcaseRpcClient;
    const result = await rpc.rpc("list_published_lab_projects", { p_limit: 100 });
    if (result.error) {
      console.error("Public project showcase lookup failed:", result.error);
      loadError = true;
    } else {
      projects = parseProjects(result.data);
    }
  } catch (error) {
    console.error("Public project showcase failed:", error);
    loadError = true;
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/">RUFFNECK LEARN</Link>
        <span>Student-built · Instructor-approved · Publicly shared</span>
      </header>

      <section className={styles.hero}>
        <p className={styles.kicker}>PRACTICAL WORK, MADE VISIBLE</p>
        <h1>Public Project Showcase</h1>
        <p className={styles.intro}>
          Explore websites and digital publications that learners created in RuffNeck Learn and chose to publish after instructor approval.
        </p>
        <div className={styles.heroMeta}>
          <span>{projects.length} {projects.length === 1 ? "project" : "projects"} in this listing</span>
          <span>HTML · CSS · Digital publishing</span>
        </div>
      </section>

      <section className={styles.content} aria-labelledby="projects-title">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.kicker}>EXPLORE THE WORK</p>
            <h2 id="projects-title">Published projects</h2>
          </div>
          <Link className={styles.secondaryLink} href="/student/labs">Explore practical labs ↗</Link>
        </div>

        {loadError ? (
          <div className={styles.notice} role="status">
            <h3>Showcase temporarily unavailable</h3>
            <p>The public project listing could not be loaded. Confirm that the showcase database migration is installed, then reload this page.</p>
          </div>
        ) : (
          <ShowcaseFilters projects={projects} />
        )}
      </section>

      <footer className={styles.footer}>
        <span>RuffNeck Learn · Practical AI &amp; digital systems for Nigerian professionals</span>
        <Link href="/courses">Browse courses</Link>
      </footer>
    </main>
  );
}
