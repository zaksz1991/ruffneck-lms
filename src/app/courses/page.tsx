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
};

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
      ].join(", ")
    )
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error) {
    console.error("Failed to load courses:", error);
  }

  const courses: Course[] =
    (data ?? []) as unknown as Course[];

  return (
    <main className="rn-courses-page">
      <section className="rn-courses-hero">
        <div className="container">
          <div className="rn-courses-hero-content">
            <span className="rn-eyebrow">
              RUFFNECK LEARN
            </span>

            <h1>
              Practical skills for work, business and the
              digital economy.
            </h1>

            <p>
              Learn practical AI, data, business, marketing,
              operations and digital skills through structured
              courses built for real-world application.
            </p>

            <div className="rn-courses-hero-actions">
              <Link
                href="#course-catalogue"
                className="rn-button rn-button-primary"
              >
                Explore courses
              </Link>

              <span className="rn-courses-hero-note">
                Practical learning · Applied projects ·
                Progress tracking
              </span>
            </div>
          </div>

          <div className="rn-courses-hero-summary">
            <strong>RuffNeck Learn</strong>

            <p>
              Structured professional learning from
              RuffNeck Entertainment.
            </p>

            <div className="rn-courses-hero-summary-items">
              <span>AI</span>
              <span>Data</span>
              <span>Business</span>
              <span>Digital Skills</span>
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
              <span className="rn-eyebrow">
                COURSE CATALOGUE
              </span>

              <h2>
                Choose a skill and start learning.
              </h2>
            </div>

            <p>
              Explore the available RuffNeck Learn courses.
            </p>
          </div>

          {!courses.length ? (
            <div className="rn-empty-state">
              <strong>
                No published courses yet.
              </strong>

              <p>
                New practical courses will appear here when
                they are published.
              </p>
            </div>
          ) : (
            <div className="rn-course-catalogue-grid">
              {courses.map((course) => {
                const duration = formatDuration(
                  course.duration_minutes
                );

                return (
                  <article
                    key={course.id}
                    className="rn-course-catalogue-card"
                  >
                    <div className="rn-course-catalogue-body">
                      <div className="rn-course-catalogue-meta">
                        {course.category ? (
                          <span className="rn-course-category">
                            {course.category}
                          </span>
                        ) : (
                          <span className="rn-course-category">
                            Professional Skills
                          </span>
                        )}

                        {course.is_free ? (
                          <span className="badge badge-free">
                            Free
                          </span>
                        ) : (
                          <span className="badge">
                            ₦
                            {course.price_ngn.toLocaleString()}
                          </span>
                        )}
                      </div>

                      <h3>
                        <Link
                          href={`/courses/${course.slug}`}
                        >
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