import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, slug, short_description, category, is_free, level")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(6);

  return (
    <>
      <section className="hero">
        <div className="container">
          <h1>Learn AI & digital skills that work in Nigeria</h1>
          <p>
            Practical courses from RuffNeck Entertainment — for founders, freelancers,
            and professionals who want usable skills, not theory only.
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
      </section>

      <section className="section">
        <div className="container">
          <h2>Featured courses</h2>
          {!courses?.length ? (
            <p className="muted">No published courses yet.</p>
          ) : (
            <div className="grid">
              {courses.map((c) => (
                <article key={c.id} className="card">
                  <div className="thumb">📘</div>
                  <div className="card-body">
                    <div>
                      {c.is_free ? (
                        <span className="badge badge-free">Free</span>
                      ) : (
                        <span className="badge">{c.level}</span>
                      )}
                    </div>
                    <h3>{c.title}</h3>
                    <p>{c.short_description}</p>
                    <Link href={`/courses/${c.slug}`} className="btn btn-navy">
                      View course
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
