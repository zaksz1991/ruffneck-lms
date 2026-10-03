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

type Resource = {
  id: string;
  title: string;
  resource_type: "file" | "link" | "pdf" | "audio";
  url: string;
  sort_order: number;
};

type Enrollment = {
  id: string;
  progress_percent: number | null;
  enrollment_status: string | null;
  payment_status: string | null;
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

function getResourceTypeLabel(
  type: Resource["resource_type"]
) {
  switch (type) {
    case "pdf":
      return "PDF";
    case "audio":
      return "Audio";
    case "link":
      return "External link";
    default:
      return "File";
  }
}

/*
 * Removes a leading h1/h2/h3/etc. from lesson HTML
 * when that heading exactly matches the lesson title.
 *
 * This prevents:
 *
 * # Lesson Title
 * LESSON MATERIAL
 * # Lesson Title
 *
 * from appearing twice.
 */
function removeDuplicateLeadingHeading(
  html: string | null,
  title: string
) {
  if (!html) {
    return "<p>No lesson content is available yet.</p>";
  }

  const escapedTitle = title
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .trim();

  const duplicateHeadingPattern = new RegExp(
    `^\\s*<h[1-6][^>]*>\\s*${escapedTitle}\\s*</h[1-6]>\\s*`,
    "i"
  );

  return html.replace(
    duplicateHeadingPattern,
    ""
  );
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
        "id, title, slug, category, level"
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

  const enrollment =
    enrollmentData as unknown as Enrollment | null;

  const { data: lessonData, error: lessonError } =
    await supabase
      .from("lessons")
      .select(
        [
          "id",
          "course_id",
          "title",
          "slug",
          "content_html",
          "video_url",
          "duration_minutes",
          "is_preview",
          "is_published",
        ].join(", ")
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
    notFound();
  }

  if (!lesson.is_preview && !enrollment) {
    redirect(`/courses/${courseSlug}`);
  }

  const { data: curriculumData, error: curriculumError } =
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

  if (curriculumError) {
    console.error(
      "Failed to load curriculum:",
      curriculumError
    );
  }

  const curriculum =
    (curriculumData as unknown as CurriculumRow[]) ||
    [];

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

  const lessonNumber =
    currentIndex >= 0
      ? currentIndex + 1
      : 1;

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

  const courseComplete =
    totalLessons > 0 &&
    totalCompleted >= totalLessons;

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

  const totalDuration = formatDuration(
    lesson.duration_minutes,
    null
  );

  const lessonContent =
    removeDuplicateLeadingHeading(
      lesson.content_html,
      lesson.title
    );

  const progressLabel =
    totalLessons > 0
      ? `${totalCompleted} of ${totalLessons} lessons completed`
      : "Course progress";

  return (
    <main className="rn-learning-shell">
      <div className="container">
        {/* =================================================
            TOP BAR
            ================================================= */}

        <div className="rn-learning-topbar">
          <div className="rn-learning-topbar-copy">
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

        {/* =================================================
            LEARNING LAYOUT
            ================================================= */}

        <div className="rn-learning-layout">
          {/* =================================================
              SIDEBAR
              ================================================= */}

          <aside className="rn-learning-sidebar">
            <div className="rn-learning-sidebar-header">
              <span className="rn-eyebrow">
                CURRICULUM
              </span>

              <h2>Course lessons</h2>

              <p className="rn-learning-sidebar-progress">
                {progressLabel}
              </p>
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

          {/* =================================================
              CONTENT
              ================================================= */}

          <article className="rn-learning-content">
            <header className="rn-learning-content-header">
              <div className="rn-learning-label-row">
                <span className="rn-eyebrow">
                  {sectionTitle}
                </span>

                <span className="rn-learning-lesson-number">
                  Lesson {lessonNumber} of{" "}
                  {totalLessons}
                </span>
              </div>

              <div className="rn-course-meta-row">
                <span>
                  {lesson.is_preview
                    ? "Preview"
                    : "Course lesson"}
                </span>

                {formatLevel(course.level) ? (
                  <span>
                    {formatLevel(course.level)}
                  </span>
                ) : null}

                {course.category ? (
                  <span>{course.category}</span>
                ) : null}

                {totalDuration ? (
                  <span>{totalDuration}</span>
                ) : null}
              </div>

              <h1>{lesson.title}</h1>

              <p className="rn-learning-intro">
                Lesson {lessonNumber} of{" "}
                {totalLessons}. Work through the
                material, complete the practical task,
                then mark the lesson complete.
              </p>
            </header>

            {/* =================================================
                LESSON OVERVIEW
                ================================================= */}

            <section className="rn-learning-overview-panel">
              <div>
                <span className="rn-eyebrow">
                  LESSON OVERVIEW
                </span>

                <h2>
                  What you will work on
                </h2>
              </div>

              <div className="rn-learning-overview-grid">
                <div>
                  <strong>
                    {lessonNumber}
                  </strong>

                  <span>
                    Current lesson
                  </span>
                </div>

                <div>
                  <strong>
                    {totalLessons}
                  </strong>

                  <span>
                    Lessons in course
                  </span>
                </div>

                <div>
                  <strong>
                    {courseProgress}%
                  </strong>

                  <span>
                    Course completed
                  </span>
                </div>

                <div>
                  <strong>
                    {totalDuration ||
                      "Self-paced"}
                  </strong>

                  <span>
                    Lesson duration
                  </span>
                </div>
              </div>
            </section>

            {/* =================================================
                OPTIONAL VIDEO
                ================================================= */}

            {lesson.video_url ? (
              <section className="rn-learning-video">
                <div>
                  <span className="rn-eyebrow">
                    VIDEO LESSON
                  </span>

                  <h2>
                    Watch the lesson video
                  </h2>

                  <p>
                    Use the video together with the
                    written lesson material.
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
              </section>
            ) : null}

            {/* =================================================
                LESSON MATERIAL
                ================================================= */}

            <section className="rn-learning-material">
              <div className="rn-learning-section-heading">
                <span className="rn-eyebrow">
                  LESSON MATERIAL
                </span>

                <p>
                  Read through the material carefully
                  before completing the practical
                  application.
                </p>
              </div>

              <div
                className="rn-learning-article"
                dangerouslySetInnerHTML={{
                  __html: lessonContent,
                }}
              />
            </section>

            {/* =================================================
                PRACTICAL APPLICATION
                ================================================= */}

            <section className="rn-learning-practice-panel">
              <div>
                <span className="rn-eyebrow">
                  PRACTICAL APPLICATION
                </span>

                <h2>
                  Put the lesson into practice
                </h2>

                <p>
                  Before moving on, connect the lesson
                  to an actual professional situation.
                  The objective is to turn the concept
                  into something you can use.
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
                    Apply it to a real situation
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

            {/* =================================================
                RESOURCES
                ================================================= */}

            {resources.length > 0 ? (
              <section className="rn-learning-resources">
                <div className="rn-learning-section-heading">
                  <span className="rn-eyebrow">
                    LEARNING RESOURCES
                  </span>

                  <h2>
                    Resources for this lesson
                  </h2>

                  <p>
                    Supporting material you can open
                    while studying this lesson.
                  </p>
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
                          {getResourceTypeLabel(
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

            {/* =================================================
                COMPLETION
                ================================================= */}

            {enrollment ? (
              <section className="rn-learning-completion">
                <div>
                  <span className="rn-eyebrow">
                    LESSON STATUS
                  </span>

                  <h2>
                    {currentCompleted
                      ? "Lesson completed"
                      : "Complete this lesson"}
                  </h2>

                  <p>
                    {currentCompleted
                      ? "This lesson is already recorded as completed. You can review it or continue through the curriculum."
                      : "Review the lesson material and complete the practical work before marking this lesson complete."}
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
                    This is a preview lesson. View
                    the full course to see the complete
                    curriculum and enrollment options.
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

            {/* =================================================
                NAVIGATION
                ================================================= */}

            <nav className="rn-learning-navigation">
              {previousLesson ? (
                <Link
                  href={`/learn/${course.slug}/${previousLesson.lesson_slug}`}
                  className="rn-learning-nav-card"
                >
                  <span>
                    ← Previous lesson
                  </span>

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
                  <span>
                    Next lesson →
                  </span>

                  <strong>
                    {nextLesson.lesson_title}
                  </strong>
                </Link>
              ) : (
                <Link
                  href={`/courses/${course.slug}`}
                  className="rn-learning-nav-card is-next"
                >
                  <span>
                    {courseComplete
                      ? "Course complete"
                      : "End of curriculum"}
                  </span>

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