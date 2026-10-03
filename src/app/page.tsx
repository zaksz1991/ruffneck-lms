import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Course = {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  category: string | null;
  is_free: boolean;
  level: string | null;
  thumbnail_url: string | null;
};

function getCourseVisual(course: Course) {
  const value =
    `${course.slug} ${course.title} ${course.category ?? ""}`.toLowerCase();

  /*
   * Specific categories come first.
   * This prevents "digital" from matching "ai".
   */

  if (
    value.includes("marketing") ||
    value.includes("content") ||
    value.includes("social media") ||
    value.includes("digital marketing")
  ) {
    return {
      className: "course-art course-art-marketing",
      icon: "◈",
      label: "Digital Marketing",
    };
  }

  if (
    value.includes("data") ||
    value.includes("excel") ||
    value.includes("power-bi") ||
    value.includes("power bi") ||
    value.includes("analytics")
  ) {
    return {
      className: "course-art course-art-data",
      icon: "▥",
      label: "Data & Analytics",
    };
  }

  if (
    value.includes("business") ||
    value.includes("entrepreneur") ||
    value.includes("startup")
  ) {
    return {
      className: "course-art course-art-business",
      icon: "◆",
      label: "Business",
    };
  }

  if (
    value.includes("operation") ||
    value.includes("logistics") ||
    value.includes("inventory") ||
    value.includes("warehouse")
  ) {
    return {
      className: "course-art course-art-operations",
      icon: "▦",
      label: "Operations",
    };
  }

  if (
    value.includes("teacher") ||
    value.includes("teaching") ||
    value.includes("education")
  ) {
    return {
      className: "course-art course-art-education",
      icon: "◇",
      label: "Education",
    };
  }

  if (
    value.includes("productivity") ||
    value.includes("digital skills") ||
    value.includes("office")
  ) {
    return {
      className: "course-art course-art-productivity",
      icon: "◫",
      label: "Productivity",
    };
  }

  const hasAi =
    /\bai\b/.test(value) ||
    value.includes("artificial intelligence") ||
    value.includes("automation") ||
    value.includes("prompt engineering");

  if (hasAi) {
    return {
      className: "course-art course-art-ai",
      icon: "✦",
      label: "AI & Technology",
    };
  }

  return {
    className: "course-art course-art-default",
    icon: "R",
    label: course.category || "Professional Skills",
  };
}

export default async function HomePage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("courses")
    .select(
      "id, title, slug, short_description, category, is_free, level, thumbnail_url"
    )
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(6);

  if (error) {
    console.error("Failed to load featured courses:", error);
  }

  const courses: Course[] = (data ?? []) as unknown as Course[];

  return (
    <>
      <section className="hero">
        <div className="container">
          <div className="hero-grid">
            <div>
              <div className="rn-brand-kicker">
                RuffNeck Entertainment · Learning
              </div>

              <h1>Learn AI & digital skills that work in Nigeria</h1>

              <p>
                Practical courses from RuffNeck Entertainment for founders,
                freelancers, professionals, teams, and anyone building useful
                digital skills.
              </p>

              <div className="hero-actions">
                <Link href="/courses" className="btn btn-primary">
                  Browse courses
                </Link>

                <Link href="/signup" className="btn btn-ghost">
                  Create free account
                </Link>
              </div>
            </div>

            <div className="hero-card rn-hero-brand-card">
              <div className="rn-hero-mark">RN</div>

              <strong>RuffNeck Learn</strong>

              <p>
                Practical AI literacy, digital skills, productivity, and
                professional learning.
              </p>

              <span>by RuffNeck Entertainment</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section rn-featured-courses-section">
        <div className="container">
          <div className="section-heading">
            <div>
              <div className="rn-brand-kicker">Learning library</div>

              <h2>Featured courses</h2>
            </div>

            <Link href="/courses" className="text-link">
              View all courses →
            </Link>
          </div>

          {!courses.length ? (
            <div className="rn-empty-state">
              <div className="rn-empty-icon">▦</div>

              <strong>No published courses yet</strong>

              <p>
                New courses will appear here when they are published.
              </p>
            </div>
          ) : (
            <div className="rn-featured-course-grid">
              {courses.map((course) => {
                const visual = getCourseVisual(course);

                return (
                  <article
                    key={course.id}
                    className="card rn-featured-course-card"
                  >
                    <Link
                      href={`/courses/${course.slug}`}
                      className="rn-featured-course-art"
                      aria-label={`View ${course.title}`}
                    >
                      {course.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={course.thumbnail_url}
                          alt=""
                          className="rn-featured-course-image"
                        />
                      ) : (
                        <div className={visual.className}>
                          <div className="course-art-grid" />

                          <div className="course-art-glow" />

                          <div className="course-art-content">
                            <span className="course-art-icon">
                              {visual.icon}
                            </span>

                            <span className="course-art-label">
                              {visual.label}
                            </span>
                          </div>

                          <div className="course-art-decoration course-art-decoration-one" />

                          <div className="course-art-decoration course-art-decoration-two" />

                          <div className="course-art-decoration course-art-decoration-three" />
                        </div>
                      )}
                    </Link>

                    <div className="card-body rn-featured-course-body">
                      <div className="rn-course-meta">
                        {course.is_free ? (
                          <span className="badge badge-free">
                            Free
                          </span>
                        ) : (
                          <span className="badge">
                            Premium
                          </span>
                        )}

                        {course.level ? (
                          <span>{course.level}</span>
                        ) : null}
                      </div>

                      <h3>
                        <Link href={`/courses/${course.slug}`}>
                          {course.title}
                        </Link>
                      </h3>

                      <p>
                        {course.short_description ||
                          "Practical learning designed for real-world use."}
                      </p>

                      <Link
                        href={`/courses/${course.slug}`}
                        className="btn btn-navy"
                      >
                        View course →
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="rn-founder-section">
        <div className="container">
          <div className="rn-founder-card">
            <div className="rn-founder-image-panel">
              <img
                src="https://ruffneck-entertainment.vercel.app/founder.png"
                alt="Hassan Zakariya, Founder and CEO of RuffNeck Entertainment"
                className="rn-founder-photo"
              />

              <div className="rn-founder-image-caption">
                <strong>Hassan Zakariya</strong>
                <span>Founder & CEO</span>
              </div>
            </div>

            <div className="rn-founder-content">
              <div className="rn-brand-kicker">
                About RuffNeck Entertainment
              </div>

              <h2>
                Practical technology. Practical skills. Practical learning.
              </h2>

              <p className="rn-founder-lead">
                RuffNeck Learn is the learning platform of RuffNeck
                Entertainment, a Nigerian digital services company focused on
                practical technology, AI, business support, and professional
                development.
              </p>

              <div className="rn-founder-name">
                <strong>Hassan Zakariya</strong>
                <span>
                  Founder & CEO · RuffNeck Entertainment
                </span>
              </div>

              <p>
                Hassan Zakariya is an IT & Operations Administration
                Specialist, AI Technical Content Writer, and Certified AI
                Fluency Professional with experience across IT operations,
                logistics, data systems, AI, digital business support, and
                professional training.
              </p>

              <p>
                RuffNeck Learn extends that practical approach into structured
                courses for professionals, founders, freelancers, teams, and
                organizations.
              </p>

              <div className="hero-actions">
                <a
                  href="https://ruffneck-entertainment.vercel.app/"
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-navy"
                >
                  RuffNeck Entertainment →
                </a>

                <a
                  href="https://www.linkedin.com/in/hassanzakariya"
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost"
                >
                  Founder LinkedIn
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}