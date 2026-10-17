import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import HtmlCssLabStudio from "@/components/student/HtmlCssLabStudio";

export const dynamic = "force-dynamic";

type EnrollmentRow = {
  course_id: string;
  enrollment_status: string | null;
  payment_status: string | null;
};

type CourseRow = { id: string; title: string };

type LabRow = {
  id: string;
  course_id: string;
  slug: string;
  title: string;
  summary: string;
  instructions: string;
  deliverable: string;
  estimated_minutes: number | null;
  practice_steps: unknown;
  assessment_rubric: unknown;
};

type SubmissionRow = {
  id: string;
  status: string;
  score: number | null;
  feedback: string | null;
  answer_text: string | null;
  updated_at: string | null;
};

type RubricCriterion = {
  criterion: string;
  points: number;
  description?: string;
};

const STUDIO_SLUGS = [
  "html-css-website-studio-marketing",
  "html-css-website-studio-ai",
];

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function readRubric(value: unknown): RubricCriterion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): RubricCriterion[] => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    if (typeof row.criterion !== "string" || !row.criterion.trim()) return [];
    const points = Number(row.points);
    if (!Number.isFinite(points) || points < 0 || points > 100) return [];
    return [{
      criterion: row.criterion,
      points,
      description: typeof row.description === "string" ? row.description : "",
    }];
  });
}

export default async function HtmlCssStudioPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login?next=/student/labs/html-css-studio");
  }

  const { data: enrollmentData, error: enrollmentError } = await supabase
    .from("enrollments")
    .select("course_id, enrollment_status, payment_status")
    .eq("student_id", user.id);

  if (enrollmentError) {
    console.error("HTML/CSS Studio enrollment lookup failed:", enrollmentError);
    throw new Error("Unable to verify your course enrollment.");
  }

  const eligibleEnrollments = ((enrollmentData ?? []) as EnrollmentRow[]).filter((row) =>
    ["active", "completed"].includes(row.enrollment_status ?? "") &&
    ["free", "paid"].includes(row.payment_status ?? ""),
  );
  const eligibleCourseIds = [...new Set(eligibleEnrollments.map((row) => row.course_id))];

  if (eligibleCourseIds.length === 0) {
    redirect("/student/labs");
  }

  const { data: labData, error: labError } = await supabase
    .from("practical_labs")
    .select("id, course_id, slug, title, summary, instructions, deliverable, estimated_minutes, practice_steps, assessment_rubric")
    .in("course_id", eligibleCourseIds)
    .in("slug", STUDIO_SLUGS)
    .eq("is_published", true);

  if (labError) {
    console.error("HTML/CSS Studio lab lookup failed:", labError);
    throw new Error("Unable to load the HTML/CSS practical lab.");
  }

  const labs = (labData ?? []) as unknown as LabRow[];
  if (labs.length === 0) {
    return (
      <main className="section">
        <div className="container">
          <div style={{ maxWidth: 720, margin: "0 auto", padding: 28, border: "1px solid var(--border, #dbe4ef)", borderRadius: 16, background: "var(--surface, #fff)" }}>
            <p className="rn-brand-kicker">RUFFNECK LEARN · ADVANCED PRACTICE</p>
            <h1>HTML &amp; CSS Website Studio</h1>
            <p>The studio practical has not been added to a published course you are enrolled in. Return to Practical Labs or contact the teaching team.</p>
            <Link href="/student/labs" className="btn btn-primary">Return to Practical Labs</Link>
          </div>
        </div>
      </main>
    );
  }

  const { data: courseData, error: courseError } = await supabase
    .from("courses")
    .select("id, title")
    .in("id", [...new Set(labs.map((lab) => lab.course_id))]);

  if (courseError) {
    console.error("HTML/CSS Studio course lookup failed:", courseError);
  }

  const courses = (courseData ?? []) as CourseRow[];
  const courseMap = new Map(courses.map((course) => [course.id, course.title]));
  // Prefer the digital-marketing version when a learner is enrolled in both relevant courses.
  const selectedLab = [...labs].sort((a, b) => {
    const titleA = courseMap.get(a.course_id) ?? "";
    const titleB = courseMap.get(b.course_id) ?? "";
    const rank = (title: string) => title.includes("Digital Marketing") ? 0 : 1;
    return rank(titleA) - rank(titleB);
  })[0];

  if (!selectedLab || !/^html-css-website-studio-(ai|marketing)$/.test(selectedLab.slug)) {
    redirect("/student/labs");
  }

  const { data: submissionData, error: submissionError } = await supabase
    .from("lab_submissions")
    .select("id, status, score, feedback, answer_text, updated_at")
    .eq("lab_id", selectedLab.id)
    .eq("student_id", user.id)
    .maybeSingle();

  if (submissionError) {
    console.error("HTML/CSS Studio submission lookup failed:", submissionError);
    throw new Error("Unable to load your saved HTML/CSS project.");
  }

  const submission = (submissionData ?? null) as unknown as SubmissionRow | null;

  return (
    <main className="section">
      <div className="container">
        <HtmlCssLabStudio
          labId={selectedLab.id}
          labTitle={selectedLab.title}
          courseTitle={courseMap.get(selectedLab.course_id) ?? "Your enrolled course"}
          summary={selectedLab.summary}
          instructions={selectedLab.instructions}
          deliverable={selectedLab.deliverable}
          practiceSteps={readStringArray(selectedLab.practice_steps)}
          assessmentRubric={readRubric(selectedLab.assessment_rubric)}
          initialSubmission={submission}
        />
      </div>
    </main>
  );
}
