import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Enrollment = { course_id: string; enrollment_status: string | null; payment_status: string | null };
type Lab = { id: string; course_id: string; slug: string; title: string; summary: string; category: string | null; difficulty: string | null; estimated_minutes: number | null };
type Course = { id: string; title: string };
const SLUGS = [
  "multi-file-website-studio-ai",
  "multi-file-website-studio-marketing",
  "digital-publishing-studio-ai",
  "digital-publishing-studio-marketing",
];

export default async function AdvancedStudioPickerPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login?next=/student/labs/advanced-studio");

  const { data: enrollmentData, error: enrollmentError } = await supabase
    .from("enrollments")
    .select("course_id, enrollment_status, payment_status")
    .eq("student_id", user.id);
  if (enrollmentError) {
    console.error("Advanced Studio enrollment lookup failed:", enrollmentError);
    throw new Error("Unable to verify your course enrolment.");
  }
  const eligible = ((enrollmentData ?? []) as Enrollment[]).filter((row) =>
    ["active", "completed"].includes(row.enrollment_status ?? "") &&
    ["free", "paid"].includes(row.payment_status ?? ""),
  );
  const courseIds = [...new Set(eligible.map((row) => row.course_id))];
  if (!courseIds.length) redirect("/student/labs");

  const { data: labData, error: labError } = await supabase
    .from("practical_labs")
    .select("id, course_id, slug, title, summary, category, difficulty, estimated_minutes")
    .in("course_id", courseIds)
    .in("slug", SLUGS)
    .eq("is_published", true)
    .order("title", { ascending: true });
  if (labError) {
    console.error("Advanced Studio labs lookup failed:", labError);
    throw new Error("Unable to load the advanced studio tracks.");
  }
  const labs = (labData ?? []) as Lab[];
  const eligibleStudioCourseIds = [...new Set(labs.map((lab) => lab.course_id))];
  const { data: courseData, error: courseError } = eligibleStudioCourseIds.length
    ? await supabase
        .from("courses")
        .select("id, title")
        .in("id", eligibleStudioCourseIds)
    : { data: [], error: null };
  if (courseError) console.error("Advanced Studio course title lookup failed:", courseError);
  const courses = (courseData ?? []) as Course[];
  const courseMap = new Map(courses.map((course) => [course.id, course.title]));
  const webLabs = labs.filter((lab) => lab.slug.startsWith("multi-file-website-studio-"));
  const publishingLabs = labs.filter((lab) => lab.slug.startsWith("digital-publishing-studio-"));
  const tracks = [
    {
      id: "web-development",
      eyebrow: "BUILD · TEST · EXPORT",
      title: "Multi-file Website Builder",
      description: "Build a real small website with linked HTML pages, shared CSS, local image assets, responsive preview, diagnostics and a downloadable project ZIP.",
      outcome: "index.html · about.html · contact.html · css/styles.css · assets/",
      category: "Web Development",
      labs: webLabs,
    },
    {
      id: "digital-publishing",
      eyebrow: "WRITE · EDIT · PREPARE TO PUBLISH",
      title: "Digital Publishing & Editorial Studio",
      description: "Create a blog article, newsletter, eBook chapter, press release or editorial feature with metadata, SEO fields, structured content, editorial checks and an export-ready publication package.",
      outcome: "publication.md · publication.html · publication.css · metadata.json",
      category: "Publishing & Editorial",
      labs: publishingLabs,
    },
  ];

  return (
    <main className="section">
      <div className="container" style={{ maxWidth: 1160 }}>
        <Link href="/student/labs" className="btn btn-ghost">← All practical labs</Link>
        <header style={{ padding: "28px 0 22px" }}>
          <p className="rn-brand-kicker">RUFFNECK LEARN · PROJECT-BASED PRACTICE</p>
          <h1>Advanced Project Studio</h1>
          <p className="muted" style={{ maxWidth: 820, lineHeight: 1.75 }}>
            The lab is not limited to web development. Choose a studio based on the work you want to produce: a multi-page website or a digital publication. Other practical labs continue to cover AI, data and office tools, education, marketing and business operations.
          </p>
        </header>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
          {tracks.map((track) => (
            <section key={track.id} style={{ display: "flex", flexDirection: "column", gap: 12, border: "1px solid var(--border, #dbe4ef)", borderRadius: 18, background: "var(--surface, #fff)", padding: 24, minWidth: 0 }}>
              <p className="rn-brand-kicker" style={{ margin: 0 }}>{track.eyebrow}</p>
              <h2 style={{ margin: 0, lineHeight: 1.2 }}>{track.title}</h2>
              <p style={{ lineHeight: 1.7 }}>{track.description}</p>
              <div style={{ padding: 13, borderRadius: 10, background: "var(--background, #f5f8fc)", border: "1px solid var(--border, #e1e7ef)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: ".8rem", overflowWrap: "anywhere" }}>{track.outcome}</div>
              {track.labs.length ? (
                <div style={{ display: "grid", gap: 9, marginTop: "auto" }}>
                  <strong>{track.category}</strong>
                  {track.labs.map((lab) => (
                    <Link key={lab.id} href={`/student/labs/advanced-studio/${lab.id}`} className="btn btn-primary" style={{ justifyContent: "space-between", gap: 12, whiteSpace: "normal", textAlign: "left" }}>
                      <span>{courseMap.get(lab.course_id) ?? "Enrolled course"} · {lab.title}</span><span aria-hidden="true">→</span>
                    </Link>
                  ))}
                </div>
              ) : <p className="muted" style={{ marginTop: "auto" }}>This track is not yet published in an eligible course you are enrolled in.</p>}
            </section>
          ))}
        </div>
        <section style={{ marginTop: 22, borderTop: "1px solid var(--border, #dbe4ef)", paddingTop: 20 }}>
          <h2>More than web development</h2>
          <p className="muted" style={{ maxWidth: 900, lineHeight: 1.75 }}>
            RuffNeck Learn's task-based Practical Labs can also train students in AI prompt design and verification, spreadsheet analysis, teaching materials, digital campaigns, editorial planning and business workflows. The two project studios provide specialised workspaces; they do not replace those other learning paths.
          </p>
        </section>
      </div>
    </main>
  );
}
