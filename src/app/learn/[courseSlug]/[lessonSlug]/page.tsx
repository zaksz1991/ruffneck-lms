import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CompleteLessonButton } from "@/components/CompleteLessonButton";

type Resource = {
  id: string;
  title: string;
  resource_type: "file" | "link" | "pdf" | "audio";
  url: string;
  sort_order: number;
};

export default async function LessonPage({
  params,
}: {
  params: Promise<{
    courseSlug: string;
    lessonSlug: string;
  }>;
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
    .select("completed, watched_seconds, last_position_seconds")
    .eq("student_id", user.id)
    .eq("lesson_id", lesson.id)
    .maybeSingle();

  const { data: resources } = await supabase
    .from("lesson_resources")
    .select(
      "id, title, resource_type, url, sort_order"
    )
    .eq("lesson_id", lesson.id)
    .order("sort_order")
    .order("created_at");

  const typedResources = (resources || []) as Resource[];

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

                  {row.is_preview
                    ? " · Preview"
                    : ""}
                </Link>
              )
            )}
          </aside>

          <article className="lesson-content">
            <div className="lesson-heading">
              <div>
                <span className="badge">
                  {lesson.is_preview
                    ? "Preview"
                    : "Course lesson"}
                </span>

                <h1>{lesson.title}</h1>
              </div>

              {lesson.duration_minutes > 0 && (
                <span className="lesson-duration">
                  {lesson.duration_minutes} min
                </span>
              )}
            </div>

            {lesson.video_url && (
              <div className="lesson-video-card">
                <div>
                  <strong>Lesson video</strong>
                  <p className="muted">
                    Watch the lesson video before completing
                    this lesson.
                  </p>
                </div>

                <a
                  href={lesson.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                >
                  Watch video
                </a>
              </div>
            )}

            <div
              className="lesson-html"
              dangerouslySetInnerHTML={{
                __html:
                  lesson.content_html ||
                  "<p>No content yet.</p>",
              }}
            />

            {typedResources.length > 0 && (
              <section className="resource-center">
                <div className="resource-heading">
                  <div>
                    <span className="badge">
                      Learning resources
                    </span>

                    <h2>Resources for this lesson</h2>

                    <p className="muted">
                      Download, read or open supporting
                      materials for this lesson.
                    </p>
                  </div>

                  <span className="resource-count">
                    {typedResources.length}{" "}
                    {typedResources.length === 1
                      ? "resource"
                      : "resources"}
                  </span>
                </div>

                <div className="resource-grid">
                  {typedResources.map((resource) => {
                    const icon =
                      resource.resource_type === "pdf"
                        ? "PDF"
                        : resource.resource_type === "audio"
                        ? "AUDIO"
                        : resource.resource_type === "link"
                        ? "LINK"
                        : "FILE";

                    return (
                      <a
                        key={resource.id}
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="resource-card"
                      >
                        <div className="resource-icon">
                          {icon}
                        </div>

                        <div className="resource-body">
                          <strong>
                            {resource.title}
                          </strong>

                          <span>
                            {resource.resource_type ===
                            "pdf"
                              ? "Open PDF"
                              : resource.resource_type ===
                                "audio"
                              ? "Listen to audio"
                              : resource.resource_type ===
                                "link"
                              ? "Open resource"
                              : "Open file"}
                          </span>
                        </div>

                        <span className="resource-arrow">
                          →
                        </span>
                      </a>
                    );
                  })}
                </div>
              </section>
            )}

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