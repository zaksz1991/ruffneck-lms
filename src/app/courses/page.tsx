import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Course = {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  category: string | null;
  level: string | null;
  is_free: boolean;
  price_ngn: number;
  duration_minutes: number | null;
  thumbnail_url: string | null;
};

function getCourseVisual(course: Course) {
  const value =
    `${course.slug} ${course.title} ${course.category ?? ""}`.toLowerCase();

  if (
    value.includes("ai") ||
    value.includes("artificial intelligence") ||
    value.includes("automation")
  ) {
    return {
      className: "course-art course-art-ai",
      icon: "✦",
      label: "AI & Technology",
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
    value.includes("marketing") ||
    value.includes("content") ||
    value.includes("social media")
  ) {
    return {
      className: "course-art course-art-marketing",
      icon: "◈",
      label: "Digital Marketing",
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

  return {
    className: "course-art course-art-default",
    icon: "R",
    label: course.category || "Professional Skills",
  };
}

function formatDuration(minutes: number | null) {
  if (!minutes) return null;

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  return remaining
    ? `${hours} hr ${remaining} min`
    : `${hours} hr`;
}

export default async function CoursesPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("courses")
    .select(
      [
        "id",
        "title",
        "slug",
        "short_description",
        "category",
        "level",
        "is_free",
        "price_ngn",
        "duration_minutes",
        "thumbnail_url",
      ].join(", ")
    )
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error) {
    console.error("Failed to load courses:", error);
  }

  const courses: Course[] = (data ?? []) as Course[];

  return (
    <main className="rn-courses-page">
      <section className="rn-courses-hero">
        <div className="container">
          <div className="rn-courses-hero-content">
            <span className="rn-eyebrow">RUFFNECK LEARN</span>

            <h1>
              Practical skills for work, business and the digital economy.
            </h1>

            <p>
              Learn practical AI, data, business, marketing, operations and
              digital skills through structured courses built for real-world
              application.
            </p>

            <div className="rn-courses-hero-actions">
              <Link
                href="#course-catalogue"
                className="rn-button rn-button-primary"
              >
                Explore courses
              </Link>

              <span className="rn-courses-hero-note">
                Practical learning · Applied projects · Progress tracking
              </span>
            </div>
          </div>

          <div className="rn-courses-hero-visual">
            <div className="rn-hero-orbit rn-hero-orbit-one" />
            <div className="rn-hero-orbit rn-hero-orbit-two" />

            <div className="rn-hero-learning-card">
              <span>LEARN</span>
              <strong>Build useful skills.</strong>
              <small>AI · Data · Business · Digital</small>
            </div>

            <div className="rn-hero-floating-card rn-hero-floating-one">
              <strong>AI</strong>
              <span>Practical tools</span>
            </div>

            <div className="rn-hero-floating-card rn-hero-floating-two">
              <strong>DATA</strong>
              <span>Better decisions</span>
            </div>
          </div>
        </div>
      </section>

      <section
        id="course-catalogue"
        className="rn-course-catalogue section"
      >
        <div className="container">
          <div className="rn-course-catalogue-heading">
            <div>
              <span className="rn-eyebrow">COURSE CATALOGUE</span>
              <h2>Choose a skill and start learning.</h2>
            </div>

            <p>
              Explore the available RuffNeck Learn courses.
            </p>
          </div>

          {!courses.length ? (
            <div className="rn-empty-state">
              <div className="rn-empty-icon">◎</div>

              <strong>No published courses yet.</strong>

              <p>
                New practical courses will appear here when they are
                published.
              </p>
            </div>
          ) : (
            <div className="rn-course-catalogue-grid">
              {courses.map((course) => {
                const visual = getCourseVisual(course);
                const duration = formatDuration(course.duration_minutes);

                return (
                  <article
                    key={course.id}
                    className="rn-course-catalogue-card"
                  >
                    <Link
                      href={`/courses/${course.slug}`}
                      className="rn-course-art-link"
                      aria-label={`View ${course.title}`}
                    >
                      {course.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={course.thumbnail_url}
                          alt=""
                          className="rn-course-art-image"
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

                    <div className="rn-course-catalogue-body">
                      <div className="rn-course-catalogue-meta">
                        <span className="rn-course-category">
                          {course.category || visual.label}
                        </span>

                        {course.is_free ? (
                          <span className="badge badge-free">
                            Free
                          </span>
                        ) : (
                          <span className="badge">
                            ₦{course.price_ngn.toLocaleString()}
                          </span>
                        )}
                      </div>

                      <h3>
                        <Link href={`/courses/${course.slug}`}>
                          {course.title}
                        </Link>
                      </h3>

                      <p>
                        {course.short_description ||
                          "Build practical skills through structured learning and applied exercises."}
                      </p>

                      <div className="rn-course-catalogue-footer">
                        <div className="rn-course-catalogue-details">
                          {course.level ? (
                            <span>
                              <strong>Level</strong>
                              {course.level}
                            </span>
                          ) : null}

                          {duration ? (
                            <span>
                              <strong>Duration</strong>
                              {duration}
                            </span>
                          ) : null}
                        </div>

                        <Link
                          href={`/courses/${course.slug}`}
                          className="rn-course-view-link"
                        >
                          View course →
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}