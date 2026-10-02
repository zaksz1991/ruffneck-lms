import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function StudentDashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/student/dashboard");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", user.id)
    .maybeSingle();

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select(
      `
      id,
      progress_percent,
      enrollment_status,
      course_id,
      courses (
        id,
        title,
        slug,
        short_description,
        is_free
      )
    `
    )
    .eq("student_id", user.id)
    .order("enrolled_at", { ascending: false });

  return (
    <section className="section">
      <div className="container">
        <h2>My learning</h2>

        <p className="muted">
          Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}. Track your
          courses and continue where you left off.
        </p>

        {!enrollments?.length ? (
          <div className="panel">
            <p style={{ margin: "0 0 12px" }}>
              You are not enrolled in any course yet.
            </p>

            <Link href="/courses" className="btn btn-primary">
              Browse courses
            </Link>
          </div>
        ) : (
          <div className="grid">
            {enrollments.map((e) => {
              const c = e.courses;

              if (!c) return null;

              return (
                <article key={e.id} className="card">
                  <div className="card-body">
                    <span className="badge">
                      {e.enrollment_status === "completed"
                        ? "Completed"
                        : "In progress"}
                    </span>

                    <h3>{c.title}</h3>

                    <p>{c.short_description}</p>

                    <div
                      className="progress"
                      aria-label={`${e.progress_percent}% complete`}
                    >
                      <span style={{ width: `${e.progress_percent}%` }} />
                    </div>

                    <p className="muted">
                      {e.progress_percent}% complete
                    </p>

                    <Link
                      href={`/courses/${c.slug}`}
                      className="btn btn-navy"
                    >
                      {e.progress_percent > 0 ? "Continue" : "Start"}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}