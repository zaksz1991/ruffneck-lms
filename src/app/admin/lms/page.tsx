import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminLmsEditor from "./AdminLmsEditor";

export default async function AdminLmsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/lms");
  }

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
    .select("*")
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
          Signed in as {profile.email} ({profile.role}).
        </p>

        <div className="grid" style={{ marginBottom: 24 }}>
          <div className="panel">
            <div className="muted">Courses</div>
            <strong style={{ fontSize: "1.5rem" }}>
              {courses?.length ?? 0}
            </strong>
          </div>

          <div className="panel">
            <div className="muted">Students</div>
            <strong style={{ fontSize: "1.5rem" }}>
              {studentCount ?? 0}
            </strong>
          </div>

          <div className="panel">
            <div className="muted">Enrollments</div>
            <strong style={{ fontSize: "1.5rem" }}>
              {enrollCount ?? 0}
            </strong>
          </div>
        </div>

        <AdminLmsEditor
          initialCourses={courses ?? []}
          userId={user.id}
          role={profile.role}
        />
      </div>
    </section>
  );
}