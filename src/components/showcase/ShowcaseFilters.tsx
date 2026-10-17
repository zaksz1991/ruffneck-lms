"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import styles from "./ShowcaseFilters.module.css";

export type ShowcaseProject = {
  slug: string;
  title: string;
  type: "web_development" | "digital_publishing";
  excerpt: string;
  category: string;
  publishedAt: string | null;
};

type Filter = "all" | ShowcaseProject["type"];

function dateLabel(value: string | null) {
  if (!value) return "Publication date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Publication date unavailable";
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(date);
}

export default function ShowcaseFilters({ projects }: { projects: ShowcaseProject[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return projects.filter((project) => {
      const typeMatches = filter === "all" || project.type === filter;
      const haystack = `${project.title} ${project.excerpt} ${project.category}`.toLowerCase();
      return typeMatches && (!term || haystack.includes(term));
    });
  }, [projects, filter, search]);

  return (
    <div className={styles.root}>
      <div className={styles.controls}>
        <label className={styles.searchLabel}>
          <span>Search published projects</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by title, topic or category"
            maxLength={100}
          />
        </label>
        <div className={styles.filters} aria-label="Filter by project type">
          {([
            ["all", "All projects"],
            ["web_development", "Websites"],
            ["digital_publishing", "Publications"],
          ] as [Filter, string][]).map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={filter === value ? styles.activeFilter : styles.filterButton}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className={styles.resultCount} role="status" aria-live="polite">
        Showing {filtered.length} of {projects.length} published {projects.length === 1 ? "project" : "projects"}.
      </p>

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden="true">↗</span>
          <h3>{projects.length === 0 ? "No public projects yet" : "No projects match this search"}</h3>
          <p>{projects.length === 0
            ? "When learners publish instructor-approved projects, they will appear here. Private drafts and unapproved submissions are never listed."
            : "Try a different title, topic, or project type."}</p>
          {search || filter !== "all" ? <button type="button" className={styles.filterButton} onClick={() => { setSearch(""); setFilter("all"); }}>Clear filters</button> : null}
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((project) => {
            const website = project.type === "web_development";
            return (
              <article className={styles.card} key={project.slug}>
                <div className={website ? styles.webVisual : styles.publicationVisual} aria-hidden="true">
                  <span className={styles.visualBadge}>{website ? "HTML + CSS" : "DIGITAL PUBLICATION"}</span>
                  <div className={styles.visualLines}><i /><i /><i /></div>
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.metaRow}>
                    <span className={styles.category}>{project.category}</span>
                    <span>{dateLabel(project.publishedAt)}</span>
                  </div>
                  <h3>{project.title}</h3>
                  <p className={styles.excerpt}>{project.excerpt}</p>
                  <Link className={styles.openLink} href={`/p/${encodeURIComponent(project.slug)}`}>
                    Open published project <span aria-hidden="true">↗</span>
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
