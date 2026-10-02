import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();

  const { data: courses } = await supabase
    .from("courses")
    .select(
      "id, title, slug, short_description, category, is_free, level"
    )
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(6);

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

      <section className="section">
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

          {!courses?.length ? (
            <div className="rn-empty-state">
              <div className="rn-empty-icon">▦</div>
              <strong>No published courses yet</strong>
              <p>New courses will appear here when they are published.</p>
            </div>
          ) : (
            <div className="grid">
              {courses.map((course) => (
                <article key={course.id} className="card rn-course-card">
                  <div className="thumb rn-course-thumb">
                    <span className="rn-thumb-mark">RN</span>

                    <span>
                      {course.category || "Digital Skills"}
                    </span>
                  </div>

                  <div className="card-body">
                    <div className="rn-course-meta">
                      {course.is_free ? (
                        <span className="badge badge-free">Free</span>
                      ) : (
                        <span className="badge">{course.level}</span>
                      )}

                      <span>{course.level}</span>
                    </div>

                    <h3>{course.title}</h3>

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
                <span>Founder & CEO · RuffNeck Entertainment</span>
              </div>

              <p>
                Hassan Zakariya is an IT & Operations Administration Specialist,
                AI Technical Content Writer, and Certified AI Fluency
                Professional with experience across IT operations, logistics,
                data systems, AI, digital business support, and professional
                training.
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
