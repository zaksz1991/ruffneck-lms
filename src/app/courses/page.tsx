import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function CoursesPage() {
  const supabase = await createClient();
  const { data: courses } = await supabase
    .from("courses")
    .select(
      "id, title, slug, short_description, category, level, is_free, price_ngn, duration_minutes"
    )
    .eq("status", "published")
    .order("published_at", { ascending: false });

  return (
    <section className="section">
      <div className="container">
        <h2>Course catalogue</h2>
        <p className="muted" style={{ marginBottom: 20 }}>
          Free and paid practical training. Phase 1 supports free enrollment.
        </p>
        {!courses?.length ? (
          <p className="muted">No published courses yet.</p>
        ) : (
          <div className="grid">
            {courses.map((c) => (
              <article key={c.id} className="card">
                <div className="thumb">🎓</div>
                <div className="card-body">
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {c.is_free ? (
                      <span className="badge badge-free">Free</span>
                    ) : (
                      <span className="badge">₦{c.price_ngn.toLocaleString()}</span>
                    )}
                    {c.category && <span className="badge">{c.category}</span>}
                  </div>
                  <h3>{c.title}</h3>
                  <p>{c.short_description}</p>
                  <Link href={`/courses/${c.slug}`} className="btn btn-navy">
                    View details
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
