import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import styles from "./PublishingAnalytics.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://ruffneck-lms.vercel.app").replace(/\/+$/, "");

type DailyView = { date: string; views: number };
type Referrer = { host: string; views: number };
type PublicationAnalytics = {
  slug: string;
  title: string;
  type: "web_development" | "digital_publishing";
  currentlyPublic: boolean;
  publishedAt: string | null;
  views7Days: number;
  views30Days: number;
  dailyViews: DailyView[];
  topReferrers: Referrer[];
};
type RpcClient = {
  rpc: (
    functionName: string,
    parameters: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nonNegativeNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

function parseAnalytics(value: unknown): PublicationAnalytics[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw): PublicationAnalytics[] => {
    const item = asRecord(raw);
    if (
      !item ||
      typeof item.publication_slug !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.publication_slug) ||
      typeof item.project_title !== "string" ||
      (item.project_type !== "web_development" && item.project_type !== "digital_publishing")
    ) return [];

    const dailyViews: DailyView[] = Array.isArray(item.daily_views)
      ? item.daily_views.flatMap((rawDay): DailyView[] => {
          const day = asRecord(rawDay);
          if (!day || typeof day.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day.date)) return [];
          return [{ date: day.date, views: nonNegativeNumber(day.views) }];
        })
      : [];

    const topReferrers: Referrer[] = Array.isArray(item.top_referrers)
      ? item.top_referrers.flatMap((rawSource): Referrer[] => {
          const source = asRecord(rawSource);
          if (!source || typeof source.host !== "string") return [];
          return [{ host: source.host.slice(0, 120), views: nonNegativeNumber(source.views) }];
        })
      : [];

    return [{
      slug: item.publication_slug,
      title: item.project_title.slice(0, 160),
      type: item.project_type,
      currentlyPublic: item.currently_public === true,
      publishedAt: typeof item.published_at === "string" ? item.published_at : null,
      views7Days: nonNegativeNumber(item.views_7_days),
      views30Days: nonNegativeNumber(item.views_30_days),
      dailyViews,
      topReferrers,
    }];
  });
}

function formatDate(value: string | null): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleDateString("en-NG", { dateStyle: "medium" });
}

function publicUrl(project: PublicationAnalytics): string {
  return project.type === "web_development"
    ? `${SITE_URL}/p/${encodeURIComponent(project.slug)}/file/index.html`
    : `${SITE_URL}/p/${encodeURIComponent(project.slug)}`;
}

export default async function PublishingAnalyticsPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login?next=/student/labs/publishing-analytics");

  let loadError: string | null = null;
  let projects: PublicationAnalytics[] = [];
  try {
    const rpc = supabase as unknown as RpcClient;
    const result = await rpc.rpc("get_student_lab_publication_analytics", {});
    if (result.error) {
      console.error("Publication analytics lookup failed:", result.error.message);
      loadError = "Analytics are not available yet. Confirm that the public project analytics migration has been applied.";
    } else {
      projects = parseAnalytics(result.data);
    }
  } catch (error) {
    console.error("Publication analytics page failed:", error);
    loadError = "Analytics could not be loaded. Try reloading the page.";
  }

  const totalViews = projects.reduce((sum, project) => sum + project.views30Days, 0);
  const totalWeeklyViews = projects.reduce((sum, project) => sum + project.views7Days, 0);
  const publishedCount = projects.filter((project) => project.currentlyPublic).length;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>RUFFNECK LEARN · CREATOR TOOLS</p>
          <h1>Publishing analytics</h1>
          <p className={styles.intro}>See how often your approved, public projects are opened and which referring websites send readers.</p>
        </div>
        <nav className={styles.actions} aria-label="Publishing navigation">
          <Link href="/student/labs/advanced-studio">Project Studio</Link>
          <Link href="/student/labs">Practical Labs</Link>
        </nav>
      </header>

      <section className={styles.summary} aria-label="Analytics summary">
        <div className={styles.stat}><span>Published projects</span><strong>{publishedCount}</strong></div>
        <div className={styles.stat}><span>Views · last 7 days</span><strong>{totalWeeklyViews.toLocaleString("en-NG")}</strong></div>
        <div className={styles.stat}><span>Views · last 30 days</span><strong>{totalViews.toLocaleString("en-NG")}</strong></div>
      </section>

      {loadError ? (
        <section className={styles.notice} role="status">
          <h2>Analytics not available</h2>
          <p>{loadError}</p>
        </section>
      ) : projects.length === 0 ? (
        <section className={styles.empty}>
          <h2>No published projects yet</h2>
          <p>Once you publish an instructor-approved project, its daily views and referring websites will appear here.</p>
          <Link href="/student/labs/advanced-studio">Open Project Studio</Link>
        </section>
      ) : (
        <section className={styles.projects} aria-label="Project analytics">
          {projects.map((project) => {
            const maxViews = Math.max(1, ...project.dailyViews.map((day) => day.views));
            return (
              <article className={styles.project} key={project.slug}>
                <div className={styles.projectHeader}>
                  <div className={styles.projectIdentity}>
                    <span className={project.currentlyPublic ? styles.statusPublic : styles.statusPrivate}>
                      {project.currentlyPublic ? "Public" : "Not currently public"}
                    </span>
                    <h2>{project.title}</h2>
                    <p>{project.type === "web_development" ? "Website" : "Digital publication"} · Published {formatDate(project.publishedAt)}</p>
                  </div>
                  <div className={styles.projectActions}>
                    {project.currentlyPublic ? (
                      <a href={publicUrl(project)} target="_blank" rel="noopener noreferrer">Open public project ↗</a>
                    ) : null}
                    <strong>{project.views30Days.toLocaleString("en-NG")} <span>views / 30 days</span></strong>
                  </div>
                </div>

                <div className={styles.metrics}>
                  <div><span>Last 7 days</span><strong>{project.views7Days.toLocaleString("en-NG")}</strong></div>
                  <div><span>Last 30 days</span><strong>{project.views30Days.toLocaleString("en-NG")}</strong></div>
                </div>

                <div className={styles.chartSection}>
                  <h3>Daily views · last 30 days</h3>
                  {project.dailyViews.length ? (
                    <div className={styles.chart} role="img" aria-label={`Daily page views for ${project.title} over the last 30 days`}>
                      {project.dailyViews.map((day) => {
                        const height = day.views === 0 ? 3 : Math.max(8, Math.round((day.views / maxViews) * 78));
                        return <span key={day.date} className={styles.barSlot} title={`${day.date}: ${day.views} views`}><span className={styles.bar} style={{ height: `${height}px` }} /><span className={styles.barDate}>{day.date.slice(8)}</span></span>;
                      })}
                    </div>
                  ) : <p className={styles.muted}>No daily activity is recorded for this period.</p>}
                </div>

                <div className={styles.referrers}>
                  <h3>Top referring websites</h3>
                  {project.topReferrers.length ? (
                    <ul>{project.topReferrers.map((source) => <li key={source.host}><span>{source.host === "(direct)" ? "Direct / no referrer" : source.host}</span><strong>{source.views.toLocaleString("en-NG")}</strong></li>)}</ul>
                  ) : <p className={styles.muted}>No referring website data yet.</p>}
                </div>
              </article>
            );
          })}
        </section>
      )}

      <aside className={styles.privacy}>
        <strong>Privacy note</strong>
        <p>These are approximate page-view counts, not unique visitors. Common search and social-preview bots are filtered. RuffNeck Learn stores daily totals and referring hostnames only; it does not store visitor IP addresses, full referrer URLs, cookies or individual visitor identifiers. Counts may still include reloads and automated requests that are not recognised as bots.</p>
      </aside>
    </main>
  );
}
