import Image from "next/image";
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
};

export default async function HomePage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("courses")
    .select(
      "id, title, slug, short_description, category, is_free, level"
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
              <Image
                src="/brand/ruffneck-learn-banner.png"
                alt="RuffNeck Learn"
                width={1200}
                height={675}
                priority
                className="rn-learn-banner"
              />

              <div className="rn-hero-brand-copy">
                <strong>RuffNeck Learn</strong>

                <p>
                  Practical AI literacy, digital skills, productivity, and
                  professional learning.
                </p>

                <span>by RuffNeck Entertainment</span>
              </div>
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
              <strong>No published courses yet</strong>

              <p>
                New courses will appear here when they are published.
              </p>
            </div>
          ) : (
            <div className="rn-featured-course-grid">
              {courses.map((course) => (
                <article
                  key={course.id}
                  className="card rn-featured-course-card"
                >
                  <div className="card-body rn-featured-course-body">
                    <div className="rn-course-meta">
                      {course.is_free ? (
                        <span className="badge badge-free">Free</span>
                      ) : (
                        <span className="badge">Premium</span>
                      )}

                      {course.level ? (
                        <span>{course.level}</span>
                      ) : null}

                      {course.category ? (
                        <span>{course.category}</span>
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
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rn-founder-section">
        <div className="container">
          <div className="rn-founder-card">
            <div className="rn-founder-image">
              <Image
                src="/brand/founder.png"
                alt="Hassan Zakariya, Founder and CEO of RuffNeck Entertainment"
                width={600}
                height={600}
                className="rn-founder-photo"
              />
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
                  rel="noopener noreferrer"
                  className="btn btn-navy"
                >
                  RuffNeck Entertainment →
                </a>

                <a
                  href="https://www.linkedin.com/in/hassanzakariya"
                  target="_blank"
                  rel="noopener noreferrer"
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