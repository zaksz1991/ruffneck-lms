import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EnrollButton from "@/components/EnrollButton";

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

type Course = {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  thumbnail_url: string | null;
  category: string | null;
  level: "beginner" | "intermediate" | "advanced";
  price_ngn: number;
  is_free: boolean;
  duration_minutes: number | null;
  learning_outcomes: string[] | null;
  target_audience: string | null;
};

type SectionGroup = {
  id: string;
  title: string;
  sortOrder: number;
  lessons: CurriculumRow[];
};

function formatLevel(level: string) {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

function formatDuration(minutes: number) {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  if (remaining === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${remaining} min`;
}

function formatHours(minutes: number) {
  const hours = minutes / 60;

  if (hours < 1) {
    return `${Math.max(1, Math.round(minutes))} min`;
  }

  return `${Math.round(hours * 10) / 10} hours`;
}

function getCourseVisual(course: Course) {
  const value =
    `${course.slug} ${course.title} ${course.category ?? ""}`.toLowerCase();

  /*
   * Specific categories come first so words such as
   * "digital" do not accidentally match "ai".
   */

  if (
    value.includes("marketing") ||
    value.includes("content") ||
    value.includes("social media") ||
    value.includes("digital marketing")
  ) {
    return {
      className: "course-art course-art-marketing",
      icon: "◈",
      label: "Digital Marketing",
    };
  }

  if (
    value.includes("data") ||
    value.includes("excel") ||
    value.includes("power-bi") ||
    value.includes("power bi") ||
    value.includes("analytics")
  ) {
    return {
      className: "course-art course-art-data",
      icon: "▥",
      label: "Data & Analytics",
    };
  }

  if (
    value.includes("business") ||
    value.includes("entrepreneur") ||
    value.includes("startup")
  ) {
    return {
      className: "course-art course-art-business",
      icon: "◆",
      label: "Business",
    };
  }

  if (
    value.includes("operation") ||
    value.includes("logistics") ||
    value.includes("inventory") ||
    value.includes("warehouse")
  ) {
    return {
      className: "course-art course-art-operations",
      icon: "▦",
      label: "Operations",
    };
  }

  if (
    value.includes("teacher") ||
    value.includes("teaching") ||
    value.includes("education")
  ) {
    return {
      className: "course-art course-art-education",
      icon: "◇",
      label: "Education",
    };
  }

  if (
    value.includes("productivity") ||
    value.includes("digital skills") ||
    value.includes("office")
  ) {
    return {
      className: "course-art course-art-productivity",
      icon: "◫",
      label: "Productivity",
    };
  }

  const hasAi =
    /\bai\b/.test(value) ||
    value.includes("artificial intelligence") ||
    value.includes("automation") ||
    value.includes("prompt engineering");

  if (hasAi) {
    return {
      className: "course-art course-art-ai",
      icon: "✦",
      label: "AI & Technology",
    };
  }

  return {
    className: "course-art course-art-default",
    icon: "R",
    label: course.category || "Professional Skills",
  };
}

function getCourseFocus(slug: string) {
  switch (slug) {
    case "ai-literacy":
      return {
        eyebrow: "PRACTICAL AI FOUNDATIONS",
        title:
          "Build confident, responsible AI skills for real workplace tasks.",
        description:
          "Move from AI fundamentals to practical workplace workflows, prompting, research, documentation, operations and responsible AI use.",
      };

    case "advanced-ai-productivity":
      return {
        eyebrow: "ADVANCED AI SYSTEMS",
        title:
          "Design advanced AI workflows, automation systems and intelligent business processes.",
        description:
          "Go beyond basic prompting into workflow architecture, automation, tool-using AI, quality control and an end-to-end business automation capstone.",
      };

    case "data-analysis-excel-power-bi":
      return {
        eyebrow: "BUSINESS DATA & BI",
        title:
          "Turn operational data into analysis, dashboards and decision-ready business intelligence.",
        description:
          "Develop practical Excel, Power Query and Power BI capabilities through realistic business analysis, reporting and dashboard projects.",
      };

    case "digital-marketing-ai-content":
      return {
        eyebrow: "DIGITAL MARKETING",
        title:
          "Build practical marketing systems that connect content, customers, leads and measurable business outcomes.",
        description:
          "Learn strategy, customer research, content production, AI-assisted marketing, social campaigns, conversion and performance reporting.",
      };

    case "effective-teacher":
      return {
        eyebrow: "TEACHER PROFESSIONAL DEVELOPMENT",
        title:
          "Plan better lessons, teach with clarity, manage learning environments and measure learner progress.",
        description:
          "A practical professional development pathway covering lesson planning, instructional delivery, classroom management, assessment, digital teaching and a complete teaching portfolio.",
      };

    default:
      return {
        eyebrow: "RUFFNECK LEARN COURSE",
        title: "Build practical professional skills.",
        description:
          "Develop practical knowledge through structured lessons, exercises, real-world scenarios and applied projects.",
      };
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const supabase = await createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("title, short_description, seo_title, seo_description")
    .eq("slug", slug)
    .maybeSingle();

  if (!course) {
    return {
      title: "Course | RuffNeck Learn",
    };
  }

  return {
    title:
      course.seo_title ||
      `${course.title} | RuffNeck Learn`,
    description:
      course.seo_description ||
      course.short_description ||
      `Learn ${course.title} with RuffNeck Learn.`,
  };
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: courseData } = await supabase
    .from("courses")
    .select(
      [
        "id",
        "title",
        "slug",
        "short_description",
        "description",
        "thumbnail_url",
        "category",
        "level",
        "price_ngn",
        "is_free",
        "duration_minutes",
        "learning_outcomes",
        "target_audience",
      ].join(", ")
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  const course = courseData as Course | null;

  if (!course) {
    notFound();
  }

  const typedCourse = course;

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
    .eq("course_id", typedCourse.id)
    .eq("is_published", true)
    .order("section_sort")
    .order("lesson_sort");

  const curriculumRows =
    (curriculum as CurriculumRow[] | null) || [];

  const { data: enrollment } = user
    ? await supabase
        .from("enrollments")
        .select(
          "id, progress_percent, enrollment_status, payment_status"
        )
        .eq("student_id", user.id)
        .eq("course_id", typedCourse.id)
        .maybeSingle()
    : { data: null };

  const { data: completedProgress } = user
    ? await supabase
        .from("lesson_progress")
        .select("lesson_id")
        .eq("student_id", user.id)
        .eq("course_id", typedCourse.id)
        .eq("completed", true)
    : { data: [] };

  const completedLessonIds = new Set(
    (completedProgress || []).map(
      (row: { lesson_id: string }) => row.lesson_id
    )
  );

  const totalLessons = curriculumRows.length;

  const calculatedMinutes = curriculumRows.reduce(
    (total, lesson) =>
      total + (lesson.duration_minutes || 0),
    0
  );

  const totalMinutes =
    calculatedMinutes > 0
      ? calculatedMinutes
      : typedCourse.duration_minutes || 0;

  const totalCompleted = completedLessonIds.size;

  const progressPercent =
    enrollment?.progress_percent ??
    (totalLessons > 0
      ? Math.round(
          (totalCompleted / totalLessons) * 100
        )
      : 0);

  const sectionsMap = new Map<
    string,
    SectionGroup
  >();

  for (const lesson of curriculumRows) {
    const existing = sectionsMap.get(
      lesson.section_id
    );

    if (existing) {
      existing.lessons.push(lesson);
    } else {
      sectionsMap.set(lesson.section_id, {
        id: lesson.section_id,
        title: lesson.section_title,
        sortOrder: lesson.section_sort,
        lessons: [lesson],
      });
    }
  }

  const sections = Array.from(
    sectionsMap.values()
  ).sort((a, b) => a.sortOrder - b.sortOrder);

  const firstLesson = curriculumRows[0] || null;

  const previewCount = curriculumRows.filter(
    (lesson) => lesson.is_preview
  ).length;

  const outcomes =
    typedCourse.learning_outcomes?.filter(Boolean) || [];

  const focus = getCourseFocus(
    typedCourse.slug
  );

  const visual = getCourseVisual(typedCourse);

  return (
    <main className="rn-course-experience">
      <div className="container">
        <Link
          href="/courses"
          className="rn-course-back-link"
        >
          ← All courses
        </Link>

        <section className="rn-course-hero">
          <div className="rn-course-hero-copy">
            <span className="rn-eyebrow">
              {focus.eyebrow}
            </span>

            <div className="rn-course-meta-row">
              <span>
                {formatLevel(typedCourse.level)}
              </span>

              {typedCourse.category ? (
                <span>
                  {typedCourse.category}
                </span>
              ) : null}

              {typedCourse.is_free ? (
                <span>Free</span>
              ) : (
                <span>
                  ₦
                  {typedCourse.price_ngn.toLocaleString()}
                </span>
              )}
            </div>

            <h1>{typedCourse.title}</h1>

            <h2>{focus.title}</h2>

            <p className="rn-course-lead">
              {typedCourse.short_description ||
                focus.description}
            </p>

            {typedCourse.description ? (
              <div
                className="rn-course-description"
                dangerouslySetInnerHTML={{
                  __html: typedCourse.description,
                }}
              />
            ) : null}

            <div className="rn-course-stat-grid">
              <div>
                <strong>{sections.length}</strong>
                <span>Modules</span>
              </div>

              <div>
                <strong>{totalLessons}</strong>
                <span>Lessons</span>
              </div>

              <div>
                <strong>
                  {formatHours(totalMinutes)}
                </strong>
                <span>Estimated learning</span>
              </div>

              <div>
                <strong>{previewCount}</strong>
                <span>Preview lessons</span>
              </div>
            </div>

            <div className="rn-course-hero-actions">
              {enrollment && firstLesson ? (
                <Link
                  href={`/learn/${typedCourse.slug}/${firstLesson.lesson_slug}`}
                  className="rn-button rn-button-primary"
                >
                  {progressPercent > 0
                    ? "Continue Course"
                    : "Start Course"}
                </Link>
              ) : user && typedCourse.is_free ? (
                <EnrollButton
                  courseId={typedCourse.id}
                  courseSlug={typedCourse.slug}
                  firstLessonSlug={
                    firstLesson?.lesson_slug || null
                  }
                  courseTitle={typedCourse.title}
                  className="rn-button rn-button-primary"
                  label="Enroll Free"
                />
              ) : (
                <Link
                  href={`/login?next=/courses/${typedCourse.slug}`}
                  className="rn-button rn-button-primary"
                >
                  Log in to enroll
                </Link>
              )}

              <Link
                href="/student/dashboard"
                className="rn-button rn-button-secondary"
              >
                My Learning
              </Link>
            </div>

            {enrollment ? (
              <div className="rn-course-progress-box">
                <div className="rn-course-progress-header">
                  <span>Your progress</span>

                  <strong>
                    {progressPercent}%
                  </strong>
                </div>

                <div className="rn-course-progress-track">
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

                <small>
                  {totalCompleted} of{" "}
                  {totalLessons} lessons completed
                </small>
              </div>
            ) : null}
          </div>

          <div className="rn-course-hero-visual">
            {typedCourse.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={typedCourse.thumbnail_url}
                alt={typedCourse.title}
              />
            ) : (
              <div
                className={`rn-course-visual-fallback ${visual.className}`}
              >
                <div className="course-art-grid" />

                <div className="course-art-glow" />

                <div className="course-art-content">
                  <span className="course-art-icon">
                    {visual.icon}
                  </span>

                  <span className="course-art-label">
                    {visual.label}
                  </span>
                </div>

                <div className="course-art-decoration course-art-decoration-one" />
                <div className="course-art-decoration course-art-decoration-two" />
                <div className="course-art-decoration course-art-decoration-three" />
              </div>
            )}

            <div className="rn-course-visual-overlay">
              <span>
                {formatLevel(typedCourse.level)}
              </span>

              <strong>
                {totalLessons} lessons
              </strong>
            </div>
          </div>
        </section>

        <section className="rn-course-section-block">
          <div className="rn-course-section-heading">
            <span className="rn-eyebrow">
              LEARNING OUTCOMES
            </span>

            <h2>What you will be able to do</h2>

            <p>
              The course is structured around
              practical professional outcomes, not
              theory alone.
            </p>
          </div>

          {outcomes.length > 0 ? (
            <div className="rn-outcomes-grid">
              {outcomes.map((outcome) => (
                <article
                  key={outcome}
                  className="rn-outcome-card"
                >
                  <span className="rn-outcome-number">
                    ✓
                  </span>

                  <p>{outcome}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="rn-course-info-panel">
              <p>
                {focus.description}
              </p>
            </div>
          )}
        </section>

        <section className="rn-course-section-block">
          <div className="rn-course-section-heading">
            <span className="rn-eyebrow">
              PRACTICAL LEARNING
            </span>

            <h2>Built around application</h2>

            <p>
              RuffNeck Learn courses combine
              structured instruction with realistic
              work situations and applied projects.
            </p>
          </div>

          <div className="rn-practical-grid">
            <article className="rn-practical-card">
              <span>01</span>

              <h3>Real-world scenarios</h3>

              <p>
                Apply concepts to realistic workplace,
                business, education and operational
                situations.
              </p>
            </article>

            <article className="rn-practical-card">
              <span>02</span>

              <h3>Case studies</h3>

              <p>
                Analyse practical problems, identify
                risks and develop structured solutions.
              </p>
            </article>

            <article className="rn-practical-card">
              <span>03</span>

              <h3>Samples & exercises</h3>

              <p>
                Work with examples, templates,
                checklists and guided practical tasks.
              </p>
            </article>

            <article className="rn-practical-card">
              <span>04</span>

              <h3>Capstone projects</h3>

              <p>
                Finish with an applied project that
                demonstrates what you can actually do.
              </p>
            </article>
          </div>
        </section>

        <section className="rn-course-section-block">
          <div className="rn-course-section-heading">
            <span className="rn-eyebrow">
              CURRICULUM
            </span>

            <h2>Course modules and lessons</h2>

            <p>
              {sections.length} modules ·{" "}
              {totalLessons} lessons ·{" "}
              {formatHours(totalMinutes)} estimated
              learning
            </p>
          </div>

          <div className="rn-curriculum-list">
            {sections.map((section, index) => (
              <details
                key={section.id}
                className="rn-curriculum-module"
                open={index === 0}
              >
                <summary>
                  <div className="rn-curriculum-summary-main">
                    <span className="rn-module-number">
                      {String(index + 1).padStart(
                        2,
                        "0"
                      )}
                    </span>

                    <div>
                      <h3>{section.title}</h3>

                      <p>
                        {section.lessons.length}{" "}
                        {section.lessons.length === 1
                          ? "lesson"
                          : "lessons"}
                      </p>
                    </div>
                  </div>

                  <span className="rn-curriculum-chevron">
                    +
                  </span>
                </summary>

                <div className="rn-curriculum-lessons">
                  {section.lessons.map(
                    (lesson, lessonIndex) => {
                      const completed =
                        completedLessonIds.has(
                          lesson.lesson_id
                        );

                      return (
                        <div
                          key={lesson.lesson_id}
                          className={`rn-curriculum-lesson ${
                            completed
                              ? "is-completed"
                              : ""
                          }`}
                        >
                          <div className="rn-lesson-index">
                            {completed
                              ? "✓"
                              : String(
                                  lessonIndex + 1
                                ).padStart(
                                  2,
                                  "0"
                                )}
                          </div>

                          <div className="rn-lesson-main">
                            <Link
                              href={`/learn/${typedCourse.slug}/${lesson.lesson_slug}`}
                              className="rn-lesson-title"
                            >
                              {lesson.lesson_title}
                            </Link>

                            <div className="rn-lesson-meta">
                              {lesson.is_preview ? (
                                <span>
                                  Preview
                                </span>
                              ) : null}

                              {lesson.duration_minutes ||
                              lesson.duration_seconds ? (
                                <span>
                                  {lesson.duration_minutes
                                    ? formatDuration(
                                        lesson.duration_minutes
                                      )
                                    : `${Math.ceil(
                                        (lesson.duration_seconds ||
                                          0) / 60
                                      )} min`}
                                </span>
                              ) : null}

                              {completed ? (
                                <span>
                                  Completed
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <Link
                            href={`/learn/${typedCourse.slug}/${lesson.lesson_slug}`}
                            className="rn-lesson-open"
                          >
                            View
                          </Link>
                        </div>
                      );
                    }
                  )}
                </div>
              </details>
            ))}
          </div>
        </section>

        <section className="rn-course-bottom-grid">
          <article className="rn-course-info-panel">
            <span className="rn-eyebrow">
              WHO IT IS FOR
            </span>

            <h2>Target audience</h2>

            <p>
              {typedCourse.target_audience ||
                "Professionals, students, entrepreneurs and learners who want practical digital skills."}
            </p>
          </article>

          <article className="rn-course-info-panel">
            <span className="rn-eyebrow">
              COURSE FORMAT
            </span>

            <h2>Self-paced learning</h2>

            <p>
              Work through the modules at your own
              pace, practise the concepts and return to
              completed lessons whenever you need them.
            </p>

            <div className="rn-course-format-list">
              <span>✓ Structured modules</span>
              <span>✓ Practical exercises</span>
              <span>✓ Applied projects</span>
              <span>✓ Progress tracking</span>
            </div>
          </article>
        </section>

        {firstLesson ? (
          <section className="rn-course-final-cta">
            <div>
              <span className="rn-eyebrow">
                START LEARNING
              </span>

              <h2>
                Ready to build practical skills?
              </h2>

              <p>
                Start with the first module and work
                through the curriculum step by step.
              </p>
            </div>

            <div>
              {enrollment ? (
                <Link
                  href={`/learn/${typedCourse.slug}/${firstLesson.lesson_slug}`}
                  className="rn-button rn-button-primary"
                >
                  {progressPercent > 0
                    ? "Continue Learning"
                    : "Start Learning"}
                </Link>
              ) : user &&
                typedCourse.is_free ? (
                <EnrollButton
                  courseId={typedCourse.id}
                  courseSlug={typedCourse.slug}
                  firstLessonSlug={
                    firstLesson.lesson_slug
                  }
                  courseTitle={typedCourse.title}
                  className="rn-button rn-button-primary"
                  label="Enroll Free"
                />
              ) : (
                <Link
                  href={`/login?next=/courses/${typedCourse.slug}`}
                  className="rn-button rn-button-primary"
                >
                  Log in to enroll
                </Link>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}