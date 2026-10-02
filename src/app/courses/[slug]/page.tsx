import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EnrollButton } from "@/components/EnrollButton";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (!course) notFound();

  const { data: curriculum } = await supabase
    .from("course_curriculum")
    .select("*")
    .eq("course_id", course.id)
    .order("section_sort")
    .order("lesson_sort");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let enrollment = null;
  if (user) {
    const { data } = await supabase
      .from("enrollments")
      .select("*")
      .eq("student_id", user.id)
      .eq("course_id", course.id)
      .maybeSingle();
    enrollment = data;
  }

  const firstLesson = curriculum?.[0];

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 800 }}>
        <p className="muted">
          <Link href="/courses">← All courses</Link>
        </p>
        <h1 style={{ color: "var(--navy)", marginTop: 8 }}>{course.title}</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {course.is_free ? (
            <span className="badge badge-free">Free</span>
          ) : (
            <span className="badge">₦{course.price_ngn.toLocaleString()}</span>
          )}
          <span className="badge">{course.level}</span>
          {course.category && <span className="badge">{course.category}</span>}
        </div>
        <p style={{ fontSize: "1.05rem" }}>{course.short_description}</p>
        {course.description && (
          <div className="panel" style={{ marginTop: 16 }}>
            <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{course.description}</p>
          </div>
        )}

        {course.learning_outcomes?.length > 0 && (
          <div className="panel">
            <h3 style={{ marginTop: 0 }}>What you will learn</h3>
            <ul>
              {course.learning_outcomes.map((o: string) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Curriculum</h3>
          {!curriculum?.length ? (
            <p className="muted">Lessons coming soon.</p>
          ) : (
            <ol style={{ paddingLeft: 18, margin: 0 }}>
              {curriculum.map((row: {
                lesson_id: string;
                lesson_title: string;
                lesson_slug: string;
                is_preview: boolean;
              }) => (
                <li key={row.lesson_id} style={{ marginBottom: 6 }}>
                  {row.lesson_title}
                  {row.is_preview && (
                    <span className="badge" style={{ marginLeft: 8 }}>
                      Preview
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
          {enrollment ? (
            <Link
              href={
                firstLesson
                  ? `/learn/${course.slug}/${firstLesson.lesson_slug}`
                  : "/student/dashboard"
              }
              className="btn btn-primary"
            >
              {enrollment.progress_percent > 0 ? "Continue learning" : "Start course"}
            </Link>
          ) : course.is_free || course.price_ngn === 0 ? (
            user ? (
              <EnrollButton courseId={course.id} slug={course.slug} />
            ) : (
              <Link href={`/login?next=/courses/${course.slug}`} className="btn btn-primary">
                Log in to enroll free
              </Link>
            )
          ) : (
            <p className="muted">Paid enrollment comes in Phase 2 (Flutterwave).</p>
          )}
        </div>
      </div>
    </section>
  );
}
