import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CompleteLessonButton } from "@/components/CompleteLessonButton";

type CurriculumRow = {
  lesson_id: string;
  course_id: string;
  section_id: string;
  section_title: string;
  section_sort: number;
  lesson_title: string;
  lesson_slug: string;
  lesson_sort: number;
  duration_minutes: number | null;
  duration_seconds: number | null;
  is_preview: boolean;
  is_published: boolean;
};

type Resource = {
  id: string;
  lesson_id: string;
  title: string;
  resource_type: "file" | "link" | "pdf" | "audio";
  url: string;
  sort_order: number;
};

function formatDuration(
  minutes: number | null,
  seconds: number | null
) {
  if (minutes && minutes > 0) {
    if (minutes < 60) {
      return `${minutes} min`;
    }

    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;

    return remaining
      ? `${hours} hr ${remaining} min`
      : `${hours} hr`;
  }

  if (seconds && seconds > 0) {
    const totalMinutes = Math.ceil(seconds / 60);

    if (totalMinutes < 60) {
      return `${totalMinutes} min`;
    }

    const hours = Math.floor(totalMinutes / 60);
    const remaining = totalMinutes % 60;

    return remaining
      ? `${hours} hr ${remaining} min`
      : `${hours} hr`;
  }

  return null;
}

function getResourceLabel(
  type: Resource["resource_type"]
) {
  switch (type) {
    case "pdf":
      return "PDF";
    case "audio":
      return "Audio";
    case "file":
      return "File";
    default:
      return "Link";
  }
}

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
    redirect(
      `/login?next=/learn/${courseSlug}/${lessonSlug}`
    );
  }

  const { data: course } = await supabase
    .from("courses")
    .select(
      "id, title, slug, level, category, status"
    )
    .eq("slug", courseSlug)
    .maybeSingle();

  if (!course || course.status !== "published") {
    notFound();
  }

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select(
      "id, progress_percent, enrollment_status"
    )
    .eq("student_id", user.id)
    .eq("course_id", course.id)
    .maybeSingle();

  const { data: lesson } = await supabase
    .from("lessons")
    .select(
      [
        "id",
        "course_id",
        "section_id",
        "title",
        "slug",
        "content_html",
        "video_url",
        "duration_minutes",
        "duration_seconds",
        "sort_order",
        "is_preview",
        "is_published",
      ].join(", ")
    )
    .eq("course_id", course.id)
    .eq("slug", lessonSlug)
    .maybeSingle();

  if (!lesson) {
    notFound();
  }

  if (
    !lesson.is_published &&
    !enrollment
  ) {
    redirect(`/courses/${courseSlug}`);
  }

  if (!lesson.is_preview && !enrollment) {
    redirect(`/courses/${courseSlug}`);
  }

  const { data: curriculum } = await supabase
    .from("course_curriculum")
    .select(
      [
        "lesson_id",
        "course_id",
        "section_id",
        "section_title",
        "section_sort",
        "lesson_title",
        "lesson_slug",
        "lesson_sort",
        "duration_minutes",
        "duration_seconds",
        "is_preview",
        "is_published",
      ].join(", ")
    )
    .eq("course_id", course.id)
    .eq("is_published", true)
    .order("section_sort")
    .order("lesson_sort");

  const rows =
    (curriculum as CurriculumRow[] | null) || [];

  const currentIndex = rows.findIndex(
    (row) => row.lesson_id === lesson.id
  );

  const previousLesson =
    currentIndex > 0
      ? rows[currentIndex - 1]
      : null;

  const nextLesson =
    currentIndex >= 0 &&
    currentIndex < rows.length - 1
      ? rows[currentIndex + 1]
      : null;

  const currentLessonNumber =
    currentIndex >= 0 ? currentIndex + 1 : 1;

  const totalLessons = rows.length;

  const { data: progress } = await supabase
    .from("lesson_progress")
    .select(
      "completed, watched_seconds, last_position_seconds, last_accessed_at"
    )
    .eq("student_id", user.id)
    .eq("lesson_id", lesson.id)
    .maybeSingle();

  const completed = Boolean(progress?.completed);

  const { count: completedCount } =
    await supabase
      .from("lesson_progress")
      .select(
        "lesson_id",
        {
          count: "exact",
          head: true,
        }
      )
      .eq("student_id", user.id)
      .eq("course_id", course.id)
      .eq("completed", true);

  const progressPercent =
    enrollment?.progress_percent ??
    (totalLessons > 0
      ? Math.round(
          ((completedCount || 0) /
            totalLessons) *
            100
        )
      : 0);

  const { data: resources } = await supabase
    .from("lesson_resources")
    .select(
      [
        "id",
        "lesson_id",
        "title",
        "resource_type",
        "url",
        "sort_order",
      ].join(", ")
    )
    .eq("lesson_id", lesson.id)
    .order("sort_order");

  const lessonResources =
    (resources as Resource[] | null) || [];

  /*
   * Record lesson viewing activity for enrolled
   * learners. This remains non-blocking.
   */
  if (enrollment) {
    const { error: activityError } =
      await supabase
        .from("learning_activity")
        .insert({
          student_id: user.id,
          course_id: course.id,
          lesson_id: lesson.id,
          activity_type: "lesson_viewed",
          metadata: {
            lesson_slug: lesson.slug,
            section_id: lesson.section_id,
          },
        });

    if (activityError) {
      console.error(
        "Lesson activity logging failed:",
        activityError
      );
    }
  }

  const currentModule =
    rows.find(
      (row) => row.lesson_id === lesson.id
    )?.section_title ||
    "Course Module";

  return (
    <main className="rn-learning-shell">
      <div className="container">
        <div className="rn-learning-topbar">
          <div>
            <Link
              href={`/courses/${course.slug}`}
              className="rn-learning-back"
            >
              ← {course.title}
            </Link>

            <div className="rn-learning-breadcrumb">
              <span>{currentModule}</span>
              <span>·</span>
              <span>
                Lesson {currentLessonNumber} of{" "}
                {totalLessons}
              </span>
            </div>
          </div>

          {enrollment ? (
            <div className="rn-learning-progress-summary">
              <span>Course progress</span>
              <strong>
                {progressPercent}%
              </strong>
            </div>
          ) : (
            <span className="rn-preview-pill">
              Free Preview
            </span>
          )}
        </div>

        {enrollment ? (
          <div className="rn-learning-progress-track">
            <div
              style={{
                width: `${Math.min(
                  100,
                  Math.max(
                    0,
                    progressPercent
                  )
                )}%`,
              }}
            />
          </div>
        ) : null}

        <div className="rn-learning-layout">
          <aside className="rn-learning-sidebar">
            <div className="rn-learning-sidebar-header">
              <span className="rn-eyebrow">
                CURRICULUM
              </span>

              <h2>Course lessons</h2>
            </div>

            <div className="rn-learning-sidebar-list">
              {rows.map((row, index) => (
                <Link
                  key={row.lesson_id}
                  href={`/learn/${course.slug}/${row.lesson_slug}`}
                  className={`rn-learning-sidebar-item ${
                    row.lesson_id === lesson.id
                      ? "is-active"
                      : ""
                  }`}
                >
                  <span className="rn-learning-sidebar-number">
                    {row.lesson_id === lesson.id
                      ? "•"
                      : String(index + 1).padStart(
                          2,
                          "0"
                        )}
                  </span>

                  <span className="rn-learning-sidebar-copy">
                    <strong>
                      {row.lesson_title}
                    </strong>

                    <small>
                      {row.section_title}
                    </small>
                  </span>
                </Link>
              ))}
            </div>

            <Link
              href={`/courses/${course.slug}`}
              className="rn-learning-course-link"
            >
              View full course
            </Link>
          </aside>

          <article className="rn-learning-content">
            <header className="rn-learning-content-header">
              <div className="rn-course-meta-row">
                <span>
                  {course.category ||
                    "Professional Learning"}
                </span>

                <span>
                  {course.level
                    .charAt(0)
                    .toUpperCase() +
                    course.level.slice(1)}
                </span>

                {lesson.is_preview ? (
                  <span>Preview</span>
                ) : null}

                {formatDuration(
                  lesson.duration_minutes,
                  lesson.duration_seconds
                ) ? (
                  <span>
                    {formatDuration(
                      lesson.duration_minutes,
                      lesson.duration_seconds
                    )}
                  </span>
                ) : null}
              </div>

              <span className="rn-eyebrow">
                {currentModule}
              </span>

              <h1>{lesson.title}</h1>

              <p className="rn-learning-intro">
                Lesson {currentLessonNumber} of{" "}
                {totalLessons}
                {completed
                  ? " · Completed"
                  : ""}
              </p>
            </header>

            {lesson.video_url ? (
              <section className="rn-learning-video">
                <div>
                  <span className="rn-eyebrow">
                    VIDEO
                  </span>

                  <h2>Lesson video</h2>

                  <p>
                    Open the lesson video in a new
                    tab.
                  </p>
                </div>

                <a
                  href={lesson.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rn-button rn-button-primary"
                >
                  Open Video
                </a>
              </section>
            ) : null}

            <section className="rn-learning-article">
              <div
                dangerouslySetInnerHTML={{
                  __html:
                    lesson.content_html ||
                    "<p>Lesson content is being prepared.</p>",
                }}
              />
            </section>

            <section className="rn-learning-practice-panel">
              <div>
                <span className="rn-eyebrow">
                  PRACTICAL APPLICATION
                </span>

                <h2>
                  Apply what you learned
                </h2>

                <p>
                  Review the concepts in this lesson
                  and apply them to a realistic
                  professional situation before moving
                  to the next lesson.
                </p>
              </div>

              <div className="rn-learning-practice-grid">
                <div>
                  <strong>01</strong>
                  <span>
                    Identify the key concept
                  </span>
                </div>

                <div>
                  <strong>02</strong>
                  <span>
                    Apply it to a real scenario
                  </span>
                </div>

                <div>
                  <strong>03</strong>
                  <span>
                    Review your result
                  </span>
                </div>
              </div>
            </section>

            {lessonResources.length > 0 ? (
              <section className="rn-learning-resources">
                <div className="rn-learning-section-heading">
                  <span className="rn-eyebrow">
                    RESOURCES
                  </span>

                  <h2>
                    Lesson resources
                  </h2>
                </div>

                <div className="rn-resource-list">
                  {lessonResources.map(
                    (resource) => (
                      <a
                        key={resource.id}
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rn-resource-item"
                      >
                        <span className="rn-resource-icon">
                          ↗
                        </span>

                        <span>
                          <strong>
                            {resource.title}
                          </strong>

                          <small>
                            {getResourceLabel(
                              resource.resource_type
                            )}
                          </small>
                        </span>

                        <span className="rn-resource-arrow">
                          →
                        </span>
                      </a>
                    )
                  )}
                </div>
              </section>
            ) : null}

            {enrollment ? (
              <section className="rn-learning-completion">
                <div>
                  <span className="rn-eyebrow">
                    LESSON STATUS
                  </span>

                  <h2>
                    {completed
                      ? "Lesson completed"
                      : "Ready to complete this lesson?"}
                  </h2>

                  <p>
                    {completed
                      ? "Your progress has been saved. Continue to the next lesson or review the course curriculum."
                      : "Mark this lesson complete after reviewing the material and completing the practical work."}
                  </p>
                </div>

                {!completed ? (
                  <CompleteLessonButton
                    lessonId={lesson.id}
                    courseId={course.id}
                    studentId={user.id}
                  />
                ) : (
                  <div className="rn-learning-completed-badge">
                    ✓ Completed
                  </div>
                )}
              </section>
            ) : (
              <section className="rn-learning-preview-cta">
                <div>
                  <span className="rn-eyebrow">
                    COURSE PREVIEW
                  </span>

                  <h2>
                    Continue learning with the
                    complete course
                  </h2>

                  <p>
                    This lesson is available as a free
                    preview. Enroll from the course page
                    to access the full learning path.
                  </p>
                </div>

                <Link
                  href={`/courses/${course.slug}`}
                  className="rn-button rn-button-primary"
                >
                  View Course
                </Link>
              </section>
            )}

            <nav className="rn-learning-navigation">
              {previousLesson ? (
                <Link
                  href={`/learn/${course.slug}/${previousLesson.lesson_slug}`}
                  className="rn-learning-nav-card"
                >
                  <span>← Previous</span>

                  <strong>
                    {previousLesson.lesson_title}
                  </strong>
                </Link>
              ) : (
                <div />
              )}

              {nextLesson ? (
                <Link
                  href={`/learn/${course.slug}/${nextLesson.lesson_slug}`}
                  className="rn-learning-nav-card is-next"
                >
                  <span>Next lesson →</span>

                  <strong>
                    {nextLesson.lesson_title}
                  </strong>
                </Link>
              ) : (
                <Link
                  href={`/courses/${course.slug}`}
                  className="rn-learning-nav-card is-next"
                >
                  <span>Course complete →</span>

                  <strong>
                    Return to course
                  </strong>
                </Link>
              )}
            </nav>
          </article>
        </div>
      </div>
    </main>
  );
}