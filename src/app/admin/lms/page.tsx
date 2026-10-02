import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLmsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/lms");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || (profile.role !== "admin" && profile.role !== "instructor")) {
    redirect("/student/dashboard");
  }

  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, slug, status, is_free, price_ngn, created_at")
    .order("created_at", { ascending: false });

  const { count: studentCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "student");

  const { count: enrollCount } = await supabase
    .from("enrollments")
    .select("*", { count: "exact", head: true });

  return (
    <section className="section">
      <div className="container">
        <h2>LMS Admin</h2>
        <p className="muted">
          Signed in as {profile.email} ({profile.role}). Phase 1: view courses and
          stats. Full course editor UI can expand next.
        </p>

        <div className="grid" style={{ marginBottom: 24 }}>
          <div className="panel">
            <div className="muted">Courses</div>
            <strong style={{ fontSize: "1.5rem" }}>{courses?.length ?? 0}</strong>
          </div>
          <div className="panel">
            <div className="muted">Students</div>
            <strong style={{ fontSize: "1.5rem" }}>{studentCount ?? 0}</strong>
          </div>
          <div className="panel">
            <div className="muted">Enrollments</div>
            <strong style={{ fontSize: "1.5rem" }}>{enrollCount ?? 0}</strong>
          </div>
        </div>

        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Courses</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.92rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "8px 4px" }}>Title</th>
                <th style={{ padding: "8px 4px" }}>Status</th>
                <th style={{ padding: "8px 4px" }}>Price</th>
                <th style={{ padding: "8px 4px" }}></th>
              </tr>
            </thead>
            <tbody>
              {courses?.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 4px" }}>{c.title}</td>
                  <td style={{ padding: "10px 4px" }}>
                    <span className="badge">{c.status}</span>
                  </td>
                  <td style={{ padding: "10px 4px" }}>
                    {c.is_free ? "Free" : `₦${c.price_ngn}`}
                  </td>
                  <td style={{ padding: "10px 4px" }}>
                    {c.status === "published" && (
                      <Link href={`/courses/${c.slug}`}>View</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted" style={{ marginTop: 16 }}>
            To add or edit lessons for now, use the Supabase Table Editor, or ask for
            the full admin course editor in the next build step.
          </p>
        </div>
      </div>
    </section>
  );
}
