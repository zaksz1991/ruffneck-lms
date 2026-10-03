import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CompleteLessonButton } from "@/components/CompleteLessonButton";

type Course = {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  level: string | null;
  thumbnail_url: string | null;
};

type Lesson = {
  id: string;
  course_id: string;
  title: string;
  slug: string;
  content_html: string | null;
  video_url: string | null;
  duration_minutes: number | null;
  is_preview: boolean;
  is_published: boolean;
};

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

type LessonProgress = {
  completed: boolean;
  watched_seconds: number | null;
  last_position_seconds: number | null;
};

type Resource = {
  id: string;
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
    return `${minutes} min`;
  }

  if (seconds && seconds > 0) {
    return `${Math.ceil(seconds / 60)} min`;
  }

  return null;
}

function formatLevel(level: string | null) {
  if (!level) return null;

  return level.charAt(0).toUpperCase() + level.slice(1);
}

function getResourceLabel(
  type: Resource["resource_type"]
) {
  switch (type) {
    case "pdf":
      return "Open PDF";
    case "audio":
      return "Listen to audio";
    case "link":
      return "Open resource";
    default:
      return "Open file";
  }
}

function getResourceIcon(
  type: Resource["resource_type"]
) {
  switch (type) {
    case "pdf":
      return "PDF";
    case "audio":
      return "AUDIO";
    case "link":
      return "LINK";
    default:
      return "FILE";
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

  const { data: courseData, error: courseError } =
    await supabase
      .from("courses")
      .select(
        "id, title, slug, category, level, thumbnail_url"
      )
      .eq("slug", courseSlug)
      .maybeSingle();

  if (courseError) {
    console.error(
      "Failed to load course:",
      courseError
    );
  }

  const course =
    courseData as unknown as Course | null;

  if (!course) {
    notFound();
  }

  const { data: enrollmentData } =
    await supabase
      .from("enrollments")
      .select(
        "id, progress_percent, enrollment_status, payment_status"
      )
      .eq("student_id", user.id)
      .eq("course_id", course.id)
      .maybeSingle();

  const enrollment = enrollmentData as unknown as
    | {
        id: string;
        progress_percent: number | null;
        enrollment_status: string | null;
        payment_status: string | null;
      }
    | null;

  const { data: lessonData, error: lessonError } =
    await supabase
      .from("lessons")
      .select(
        "id, course_id, title, slug, content_html, video_url, duration_minutes, is_preview, is_published"
      )
      .eq("course_id", course.id)
      .eq("slug", lessonSlug)
      .eq("is_published", true)
      .maybeSingle();

  if (lessonError) {
    console.error(
      "Failed to load lesson:",
      lessonError
    );
  }

  const lesson =
    lessonData as unknown as Lesson | null;

  if (!lesson) {
    if (!enrollment) {
      redirect(`/courses/${courseSlug}`);
    }

    notFound();
  }

  if (!lesson.is_preview && !enrollment) {
    redirect(`/courses/${courseSlug}`);
  }

  const { data: curriculumData } =
    await supabase
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

  const curriculum =
    (curriculumData as unknown as CurriculumRow[]) ||
    [];

  /*
   * Calculate course progress directly from completed
   * lessons. Do not trust the potentially stale
   * enrollment.progress_percent value.
   */
  const { data: completedProgressData } =
    enrollment
      ? await supabase
          .from("lesson_progress")
          .select("lesson_id")
          .eq("student_id", user.id)
          .eq("course_id", course.id)
          .eq("completed", true)
      : { data: [] };

  const completedProgress =
    (completedProgressData as unknown as {
      lesson_id: string;
    }[]) || [];

  const completedLessonIds = new Set(
    completedProgress.map(
      (row) => row.lesson_id
    )
  );

  const totalLessons = curriculum.length;
  const totalCompleted =
    completedLessonIds.size;

  const courseProgress =
    totalLessons > 0
      ? Math.min(
          100,
          Math.round(
            (totalCompleted / totalLessons) * 100
          )
        )
      : 0;

  const currentIndex = curriculum.findIndex(
    (row) =>
      row.lesson_id === lesson.id ||
      row.lesson_slug === lesson.slug
  );

  const previousLesson =
    currentIndex > 0
      ? curriculum[currentIndex - 1]
      : null;

  const nextLesson =
    currentIndex >= 0 &&
    currentIndex < curriculum.length - 1
      ? curriculum[currentIndex + 1]
      : null;

  const currentCompleted =
    completedLessonIds.has(lesson.id);

  const { data: resourcesData } =
    await supabase
      .from("lesson_resources")
      .select(
        "id, title, resource_type, url, sort_order"
      )
      .eq("lesson_id", lesson.id)
      .order("sort_order")
      .order("created_at");

  const resources =
    (resourcesData as unknown as Resource[]) ||
    [];

  const sectionTitle =
    currentIndex >= 0
      ? curriculum[currentIndex]?.section_title
      : course.category || "Course lesson";

  const lessonNumber =
    currentIndex >= 0
      ? currentIndex + 1
      : 1;

  const totalDuration = formatDuration(
    lesson.duration_minutes,
    null
  );

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
              <span>{sectionTitle}</span>
              <span>·</span>
              <span>
                Lesson {lessonNumber} of{" "}
                {totalLessons}
              </span>
            </div>
          </div>

          <div className="rn-learning-progress-summary">
            <span>Course progress</span>
            <strong>{courseProgress}%</strong>

            {lesson.is_preview ? (
              <span className="rn-preview-pill">
                Preview
              </span>
            ) : null}
          </div>
        </div>

        <div className="rn-learning-progress-track">
          <div
            style={{
              width: `${courseProgress}%`,
            }}
          />
        </div>

        <div className="rn-learning-layout">
          <aside className="rn-learning-sidebar">
            <div className="rn-learning-sidebar-header">
              <span className="rn-eyebrow">
                CURRICULUM
              </span>

              <h2>Course lessons</h2>
            </div>

            <div className="rn-learning-sidebar-list">
              {curriculum.map(
                (row, index) => {
                  const completed =
                    completedLessonIds.has(
                      row.lesson_id
                    );

                  const active =
                    row.lesson_slug ===
                    lesson.slug;

                  return (
                    <Link
                      key={row.lesson_id}
                      href={`/learn/${course.slug}/${row.lesson_slug}`}
                      className={`rn-learning-sidebar-item ${
                        active
                          ? "is-active"
                          : ""
                      }`}
                    >
                      <span className="rn-learning-sidebar-number">
                        {completed
                          ? "✓"
                          : String(
                              index + 1
                            ).padStart(
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

                          {row.is_preview
                            ? " · Preview"
                            : ""}
                        </small>
                      </span>
                    </Link>
                  );
                }
              )}
            </div>

            <Link
              href={`/courses/${course.slug}`}
              className="rn-learning-course-link"
            >
              View full course →
            </Link>
          </aside>

          <article className="rn-learning-content">
            <header className="rn-learning-content-header">
              <div className="rn-course-meta-row">
                <span className="badge">
                  {lesson.is_preview
                    ? "Preview"
                    : "Course lesson"}
                </span>

                {formatLevel(course.level) ? (
                  <span>
                    {formatLevel(course.level)}
                  </span>
                ) : null}

                {totalDuration ? (
                  <span>{totalDuration}</span>
                ) : null}
              </div>

              <span className="rn-eyebrow">
                {sectionTitle}
              </span>

              <h1>{lesson.title}</h1>

              <p className="rn-learning-intro">
                Lesson {lessonNumber} of{" "}
                {totalLessons}
              </p>
            </header>

            {lesson.video_url ? (
              <div className="rn-learning-video">
                <div>
                  <span className="rn-eyebrow">
                    VIDEO LESSON
                  </span>

                  <h2>
                    Watch the lesson video
                  </h2>

                  <p>
                    Review the video before
                    completing this lesson.
                  </p>
                </div>

                <a
                  href={lesson.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rn-button rn-button-primary"
                >
                  Watch video
                </a>
              </div>
            ) : null}

            <div
              className="rn-learning-article"
              dangerouslySetInnerHTML={{
                __html:
                  lesson.content_html ||
                  "<p>No lesson content is available yet.</p>",
              }}
            />

            <section className="rn-learning-practice-panel">
              <div>
                <span className="rn-eyebrow">
                  PRACTICAL APPLICATION
                </span>

                <h2>Apply what you learned</h2>

                <p>
                  Review the lesson concepts and
                  apply them to a realistic
                  professional situation before
                  moving to the next lesson.
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

            {resources.length > 0 ? (
              <section className="rn-learning-resources">
                <div className="rn-learning-section-heading">
                  <span className="rn-eyebrow">
                    LEARNING RESOURCES
                  </span>

                  <h2>
                    Resources for this lesson
                  </h2>
                </div>

                <div className="rn-resource-list">
                  {resources.map(
                    (resource) => (
                      <a
                        key={resource.id}
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rn-resource-item"
                      >
                        <span className="rn-resource-icon">
                          {getResourceIcon(
                            resource.resource_type
                          )}
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
              <section
                className={
                  currentCompleted
                    ? "rn-learning-completion"
                    : "rn-learning-completion"
                }
              >
                <div>
                  <span className="rn-eyebrow">
                    LESSON STATUS
                  </span>

                  <h2>
                    {currentCompleted
                      ? "Lesson completed"
                      : "Ready to complete this lesson?"}
                  </h2>

                  <p>
                    {currentCompleted
                      ? "You have already completed this lesson. Continue to the next lesson or review the material."
                      : "Mark this lesson complete after reviewing the material and completing the practical work."}
                  </p>
                </div>

                {currentCompleted ? (
                  <span className="rn-learning-completed-badge">
                    ✓ Completed
                  </span>
                ) : (
                  <CompleteLessonButton
                    lessonId={lesson.id}
                    courseId={course.id}
                    studentId={user.id}
                  />
                )}
              </section>
            ) : lesson.is_preview ? (
              <section className="rn-learning-preview-cta">
                <div>
                  <span className="rn-eyebrow">
                    PREVIEW LESSON
                  </span>

                  <h2>
                    Continue with the full course
                  </h2>

                  <p>
                    This is a preview lesson.
                    Enroll to unlock the remaining
                    course content and track your
                    learning progress.
                  </p>
                </div>

                <Link
                  href={`/courses/${course.slug}`}
                  className="rn-button rn-button-primary"
                >
                  View course
                </Link>
              </section>
            ) : null}

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
                <Link
                  href={`/courses/${course.slug}`}
                  className="rn-learning-nav-card"
                >
                  <span>← Course</span>

                  <strong>
                    Back to course
                  </strong>
                </Link>
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
                  <span>Course complete</span>

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