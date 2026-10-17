import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdvancedProjectStudio from "@/components/student/AdvancedProjectStudio";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ labId: string }> };
type Enrollment = { enrollment_status: string | null; payment_status: string | null };
type LabRow = {
  id: string; course_id: string; slug: string; title: string; summary: string | null;
  instructions: string | null; deliverable: string | null; practice_steps: unknown;
  assessment_rubric: unknown; is_published: boolean;
};
type WorkspaceRow = { id: string; project_type: string; project_title: string; project_json: unknown; reflection: string | null; updated_at: string };
type SubmissionRow = { id: string; status: string; score: number | null; feedback: string | null; answer_text: string | null; updated_at: string | null };
type Criterion = { criterion: string; points: number; description?: string };
const STUDIO_SLUGS = [
  "multi-file-website-studio-ai", "multi-file-website-studio-marketing",
  "digital-publishing-studio-ai", "digital-publishing-studio-marketing",
];
function readStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}
function readRubric(value: unknown): Criterion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): Criterion[] => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const points = Number(row.points);
    if (typeof row.criterion !== "string" || !row.criterion.trim() || !Number.isFinite(points) || points < 0 || points > 100) return [];
    return [{ criterion: row.criterion, points, description: typeof row.description === "string" ? row.description : "" }];
  });
}
function readProject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const files = Array.isArray(row.files) ? row.files.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const file = item as Record<string, unknown>;
    return typeof file.path === "string" && typeof file.content === "string" ? [{ path: file.path, content: file.content }] : [];
  }) : [];
  const rawMeta = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? row.metadata as Record<string, unknown> : {};
  const metadata: Record<string, string> = {};
  for (const key of ["publicationType", "title", "subtitle", "byline", "slug", "category", "excerpt", "seoTitle", "metaDescription", "publishDate", "tags"]) {
    const raw = rawMeta[key];
    metadata[key] = Array.isArray(raw) ? raw.filter((part) => typeof part === "string").join(", ") : typeof raw === "string" ? raw : "";
  }
  return { files, metadata };
}

export default async function AdvancedProjectStudioPage({ params }: RouteParams) {
  const { labId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(labId)) redirect("/student/labs/advanced-studio");
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect(`/login?next=${encodeURIComponent(`/student/labs/advanced-studio/${labId}`)}`);

  const { data: labData, error: labError } = await supabase
    .from("practical_labs")
    .select("id, course_id, slug, title, summary, instructions, deliverable, practice_steps, assessment_rubric, is_published")
    .eq("id", labId)
    .eq("is_published", true)
    .in("slug", STUDIO_SLUGS)
    .maybeSingle();
  if (labError) {
    console.error("Advanced Project Studio lab query failed:", labError);
    throw new Error("Unable to load this studio. Confirm the Advanced Project Studio migration has been applied.");
  }
  const lab = labData as LabRow | null;
  if (!lab) redirect("/student/labs/advanced-studio");

  const { data: enrollmentData, error: enrollmentError } = await supabase
    .from("enrollments")
    .select("enrollment_status, payment_status")
    .eq("student_id", user.id)
    .eq("course_id", lab.course_id)
    .maybeSingle();
  if (enrollmentError) {
    console.error("Advanced Project Studio enrollment check failed:", enrollmentError);
    throw new Error("Unable to verify your course enrolment.");
  }
  const enrollment = enrollmentData as Enrollment | null;
  if (!enrollment || !["active", "completed"].includes(enrollment.enrollment_status ?? "") || !["free", "paid"].includes(enrollment.payment_status ?? "")) {
    redirect("/student/labs");
  }

  const [{ data: workspaceData, error: workspaceError }, { data: submissionData, error: submissionError }, { data: courseData }] = await Promise.all([
    supabase.from("lab_project_workspaces").select("id, project_type, project_title, project_json, reflection, updated_at").eq("lab_id", lab.id).eq("student_id", user.id).maybeSingle(),
    supabase.from("lab_submissions").select("id, status, score, feedback, answer_text, updated_at").eq("lab_id", lab.id).eq("student_id", user.id).maybeSingle(),
    supabase.from("courses").select("title").eq("id", lab.course_id).maybeSingle(),
  ]);
  if (workspaceError) {
    console.error("Advanced Project Studio workspace lookup failed:", workspaceError);
    throw new Error("Unable to load your saved project. The workspace migration may not be installed.");
  }
  if (submissionError) {
    console.error("Advanced Project Studio submission lookup failed:", submissionError);
    throw new Error("Unable to load your submission status.");
  }
  const workspace = workspaceData as WorkspaceRow | null;
  const submission = submissionData as SubmissionRow | null;
  const track = lab.slug.startsWith("digital-publishing-studio-") ? "digital_publishing" : "web_development";
  const initialProject = workspace ? readProject(workspace.project_json) : null;
  return (
    <main className="section">
      <div className="container" style={{ maxWidth: 1480 }}>
        <AdvancedProjectStudio
          labId={lab.id}
          track={track}
          labTitle={lab.title}
          courseTitle={courseData?.title ?? "Enrolled course"}
          summary={lab.summary ?? "Build a useful project and prepare it for review."}
          instructions={lab.instructions ?? "Follow the task brief and complete the required deliverable."}
          deliverable={lab.deliverable ?? "Submit the complete project and reflection."}
          practiceSteps={readStrings(lab.practice_steps)}
          rubric={readRubric(lab.assessment_rubric)}
          initialProject={initialProject}
          initialReflection={workspace?.reflection ?? ""}
          initialStatus={submission?.status ?? "new"}
          initialScore={submission?.score ?? null}
          initialFeedback={submission?.feedback ?? null}
          updatedAt={workspace?.updated_at ?? submission?.updated_at ?? null}
        />
        <div style={{ marginTop: 14 }}><Link href="/student/labs/advanced-studio" className="btn btn-ghost">Switch studio track</Link></div>
      </div>
    </main>
  );
}
