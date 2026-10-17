import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PracticalLabKitManager from "./PracticalLabKitManager";

export const dynamic = "force-dynamic";

type Course = { id: string; title: string; instructor_id: string | null };
type StarterResource = {
  title: string;
  description: string;
  filename: string;
  content: string;
  url: string;
};
type RubricCriterion = {
  criterion: string;
  points: number;
  description: string;
};
type PracticalLab = {
  id: string;
  course_id: string;
  title: string;
  category: string | null;
  difficulty: string | null;
  summary: string | null;
  instructions: string;
  deliverable: string | null;
  is_published: boolean;
  practice_steps: string[] | null;
  starter_resources: StarterResource[] | null;
  assessment_rubric: RubricCriterion[] | null;
};

export default async function PracticalLabsKitPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login?next=/admin/practical-labs");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return <main className="page"><div className="container"><section className="card"><h1>Practical Lab Kit Manager</h1><p className="alert error">Unable to verify account permissions. Reload the page or contact an administrator.</p></section></div></main>;
  }
  if (profile?.role !== "admin" && profile?.role !== "instructor") redirect("/student/labs");

  let courseQuery = supabase
    .from("courses")
    .select("id, title, instructor_id")
    .order("title", { ascending: true });
  if (profile.role === "instructor") courseQuery = courseQuery.eq("instructor_id", user.id);
  const { data: courseData, error: courseError } = await courseQuery;

  if (courseError) {
    return <main className="page"><div className="container"><section className="card"><h1>Practical Lab Kit Manager</h1><p className="alert error">Unable to load your courses: {courseError.message}</p></section></div></main>;
  }

  const courses = (courseData ?? []) as Course[];
  const courseIds = courses.map((course) => course.id);
  let labs: PracticalLab[] = [];

  if (courseIds.length > 0) {
    const { data: labData, error: labError } = await supabase
      .from("practical_labs")
      .select("id, course_id, title, category, difficulty, summary, instructions, deliverable, is_published, practice_steps, starter_resources, assessment_rubric")
      .in("course_id", courseIds)
      .order("sort_order", { ascending: true });

    if (labError) {
      return <main className="page"><div className="container"><section className="card"><h1>Practical Lab Kit Manager</h1><p className="alert error">Unable to load Lab Kit fields. Apply the Practical Lab Kit SQL migration in Supabase first, then reload this page. Details: {labError.message}</p></section></div></main>;
    }
    labs = (labData ?? []) as PracticalLab[];
  }

  return (
    <main className="page">
      <div className="container stack">
        <div className="page-header">
          <div>
            <p className="eyebrow">RuffNeck Learn</p>
            <h1>Practical Lab Kit Manager</h1>
            <p className="muted">Add hands-on steps, starter files and consistent assessment criteria to existing practical labs.</p>
          </div>
          <div className="actions">
            <Link href="/admin/labs" className="button secondary">Review submissions</Link>
            <Link href="/student/labs" className="button secondary">Student view</Link>
            <Link href="/admin/lms" className="button secondary">Back to LMS</Link>
          </div>
        </div>
        <PracticalLabKitManager courses={courses.map((course) => ({ id: course.id, title: course.title }))} initialLabs={labs} />
      </div>
    </main>
  );
}
