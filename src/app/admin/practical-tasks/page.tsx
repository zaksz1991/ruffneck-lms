import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PracticalTaskManager from "./PracticalTaskManager";

type Course = {
  id: string;
  title: string;
  slug: string;
  instructor_id: string | null;
};

export default async function PracticalTasksPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/practical-tasks");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role;

  if (role !== "admin" && role !== "instructor") {
    redirect("/");
  }

  let query = supabase
    .from("courses")
    .select("id,title,slug,instructor_id")
    .order("title", { ascending: true });

  if (role === "instructor") {
    query = query.eq("instructor_id", user.id);
  }

  const { data: courses, error } = await query;

  if (error) {
    return (
      <main className="page">
        <div className="container stack">
          <div className="card">
            <h1>Practical Workbench</h1>
            <p className="alert error">
              Unable to load courses: {error.message}
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="container stack">
        <div className="page-header">
          <div>
            <p className="eyebrow">RuffNeck Learn</p>

            <h1>Practical Workbench</h1>

            <p className="muted">
              Create and manage real-world practical tasks that learners
              complete between lessons and capstone projects.
            </p>
          </div>

          <div className="actions">
            <Link
              href="/admin/lms"
              className="button secondary"
            >
              Back to LMS
            </Link>

            <Link
              href="/student/practical-work"
              className="button secondary"
            >
              Student Workbench
            </Link>
          </div>
        </div>

        <div className="card">
          <PracticalTaskManager
            courses={(courses ?? []) as Course[]}
          />
        </div>
      </div>
    </main>
  );
}