import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CompleteLessonButton } from "@/components/CompleteLessonButton";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ courseSlug: string; lessonSlug: string }>;
}) {
  const { courseSlug, lessonSlug } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/learn/${courseSlug}/${lessonSlug}`);
  }

  const { data: course } = await supabase
    .from("courses")
    .select("id, title, slug")
    .eq("slug", courseSlug)
    .maybeSingle();

  if (!course) {
    notFound();
  }

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, progress_percent")
    .eq("student_id", user.id)
    .eq("course_id", course.id)
    .maybeSingle();

  const { data: lesson } = await supabase
    .from("lessons")
    .select("*")
    .eq("course_id", course.id)
    .eq("slug", lessonSlug)
    .maybeSingle();

  // Preview lessons may load without enrollment via RLS.
  if (!lesson) {
    if (!enrollment) {
      redirect(`/courses/${courseSlug}`);
    }

    notFound();
  }

  if (!lesson.is_preview && !enrollment) {
    redirect(`/courses/${courseSlug}`);
  }

  const { data: curriculum } = await supabase
    .from("course_curriculum")
    .select("*")
    .eq("course_id", course.id)
    .order("section_sort")
    .order("lesson_sort");

  const { data: progress } = await supabase
    .from("lesson_progress")
    .select("completed")
    .eq("student_id", user.id)
    .eq("lesson_id", lesson.id)
    .maybeSingle();

  /*
   * Record a learning activity whenever an enrolled learner
   * opens a lesson.
   *
   * This is intentionally non-blocking. If activity logging
   * fails, the lesson itself still loads normally.
   */
  if (enrollment) {
    const { error: activityError } = await supabase
      .from("learning_activity")
      .insert({
        student_id: user.id,
        course_id: course.id,
        lesson_id: lesson.id,
        activity_type: "lesson_viewed",
        metadata: {
          lesson_slug: lesson.slug,
        },
      });

    if (activityError) {
      console.error(
        "Lesson activity logging failed:",
        activityError
      );
    }
  }

  return (
    <section className="section">
      <div className="container">
        <p className="muted">
          <Link href={`/courses/${course.slug}`}>
            {course.title}
          </Link>

          {enrollment &&
            ` · ${enrollment.progress_percent}% complete`}
        </p>

        <div className="lesson-layout">
          <aside className="sidebar">
            <strong
              style={{
                display: "block",
                marginBottom: 8,
              }}
            >
              Lessons
            </strong>

            {curriculum?.map(
              (row: {
                lesson_id: string;
                lesson_title: string;
                lesson_slug: string;
                is_preview: boolean;
              }) => (
                <Link
                  key={row.lesson_id}
                  href={`/learn/${course.slug}/${row.lesson_slug}`}
                  className={
                    row.lesson_slug === lessonSlug
                      ? "active"
                      : ""
                  }
                >
                  {row.lesson_title}
                  {row.is_preview ? " · Preview" : ""}
                </Link>
              )
            )}
          </aside>

          <article className="lesson-content">
            <h1>{lesson.title}</h1>

            {lesson.video_url && (
              <p>
                <a
                  href={lesson.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open video
                </a>
              </p>
            )}

            <div
              dangerouslySetInnerHTML={{
                __html:
                  lesson.content_html ||
                  "<p>No content yet.</p>",
              }}
            />

            {enrollment && (
              <div style={{ marginTop: 24 }}>
                {progress?.completed ? (
                  <div className="success">
                    Lesson marked complete
                  </div>
                ) : (
                  <CompleteLessonButton
                    lessonId={lesson.id}
                    courseId={course.id}
                    studentId={user.id}
                  />
                )}
              </div>
            )}

            {!enrollment && lesson.is_preview && (
              <p
                className="muted"
                style={{ marginTop: 20 }}
              >
                This is a free preview.{" "}
                <Link href={`/courses/${course.slug}`}>
                  Enroll
                </Link>{" "}
                to unlock the full course.
              </p>
            )}
          </article>
        </div>
      </div>
    </section>
  );
}