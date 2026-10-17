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
  category: string | null;
  level: "beginner" | "intermediate" | "advanced";
  price_ngn: number;
  is_free: boolean;
  duration_minutes: number | null;
  learning_outcomes: string[] | null;
  target_audience: string | null;
};

type Enrollment = {
  id: string;
  progress_percent: number | null;
  enrollment_status: string | null;
  payment_status: string | null;
};

type SectionGroup = {
  id: string;
  title: string;
  sortOrder: number;
  lessons: CurriculumRow[];
};

type PaymentState = "success" | "failed" | "pending" | null;

function formatLevel(level: string) {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

function formatDuration(minutes: number) {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  return remaining === 0
    ? `${hours} hr`
    : `${hours} hr ${remaining} min`;
}

function formatHours(minutes: number) {
  if (minutes <= 0) {
    return "Self-paced";
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.round((minutes / 60) * 10) / 10;

  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

function formatPrice(price: number) {
  return `₦${price.toLocaleString("en-NG")}`;
}

function getCourseFocus(slug: string) {
  switch (slug) {
    case "ai-literacy":
    case "ai-literacy-for-nigerian-professionals":
      return {
        eyebrow: "PRACTICAL AI FOUNDATIONS",
        title:
          "Build confident, responsible AI skills for real workplace tasks.",
        description:
          "Understand AI, evaluate its limitations, and apply AI tools to everyday professional work.",
      };

    case "advanced-ai-productivity":
      return {
        eyebrow: "ADVANCED AI SYSTEMS",
        title:
          "Design advanced AI workflows, automation systems and intelligent business processes.",
        description:
          "Move beyond basic prompting to structured workflows, repeatable systems, and measurable productivity.",
      };

    case "data-analysis-excel-power-bi":
      return {
        eyebrow: "BUSINESS DATA & BI",
        title:
          "Turn operational data into analysis, dashboards and decision-ready business intelligence.",
        description:
          "Develop practical data skills for reporting, analysis, visualization, and better business decisions.",
      };

    case "digital-marketing-ai-content":
    case "digital-marketing-ai-content-creation":
      return {
        eyebrow: "DIGITAL MARKETING",
        title:
          "Build practical marketing systems that connect content, customers, leads and measurable business outcomes.",
        description:
          "Learn to plan content, use AI responsibly, reach target audiences, and improve marketing performance.",
      };

    case "effective-teacher":
    case "becoming-an-effective-teacher":
      return {
        eyebrow: "TEACHER PROFESSIONAL DEVELOPMENT",
        title:
          "Plan better lessons, teach with clarity, manage learning environments and measure learner progress.",
        description:
          "Develop practical teaching strategies for lesson planning, classroom engagement, and learner assessment.",
      };

    default:
      return {
        eyebrow: "RUFFNECK LEARN COURSE",
        title: "Build practical professional skills.",
        description:
          "Learn through structured lessons, practical exercises, and applied professional tasks.",
      };
  }
}

function getPaymentMessage(
  payment: PaymentState,
  courseTitle: string
) {
  switch (payment) {
    case "success":
      return {
        type: "success" as const,
        title: "Payment successful",
        message: `Your payment for "${courseTitle}" was verified successfully. Your enrollment is now active.`,
      };

    case "pending":
      return {
        type: "pending" as const,
        title: "Payment processing",
        message:
          "Your payment is still being processed. Course access will be activated after the transaction is verified.",
      };

    case "failed":
      return {
        type: "failed" as const,
        title: "Payment was not completed",
        message:
          "The payment was cancelled, failed, or could not be verified. No paid-course access was granted.",
      };

    default:
      return null;
  }
}

function isActiveEnrollment(enrollment: Enrollment | null) {
  if (!enrollment) {
    return false;
  }

  const status = enrollment.enrollment_status?.toLowerCase();
  const paymentStatus = enrollment.payment_status?.toLowerCase();

  return (
    status === "active" ||
    status === "completed" ||
    paymentStatus === "successful" ||
    paymentStatus === "success"
  );
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
    title: course.seo_title || `${course.title} | RuffNeck Learn`,
    description:
      course.seo_description ||
      course.short_description ||
      `Learn ${course.title} with RuffNeck Learn.`,
  };
}

export default async function CourseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ payment?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;

  const paymentValue = query.payment?.trim().toLowerCase() || "";

  const payment: PaymentState =
    paymentValue === "success" ||
    paymentValue === "failed" ||
    paymentValue === "pending"
      ? paymentValue
      : null;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: courseData, error: courseError } = await supabase
    .from("courses")
    .select(
      [
        "id",
        "title",
        "slug",
        "short_description",
        "description",
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

  if (courseError) {
    console.error("Failed to load course:", courseError);
  }

  const course = courseData as Course | null;

  if (!course) {
    notFound();
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
    console.error("Failed to load course curriculum:", curriculumError);
  }

  const curriculumRows =
    (curriculumData as CurriculumRow[] | null) || [];

  const { data: enrollmentData, error: enrollmentError } = user
    ? await supabase
        .from("enrollments")
        .select(
          "id, progress_percent, enrollment_status, payment_status"
        )
        .eq("student_id", user.id)
        .eq("course_id", course.id)
        .maybeSingle()
    : { data: null, error: null };

  if (enrollmentError) {
    console.error("Failed to load enrollment:", enrollmentError);
  }

  const enrollment = enrollmentData as Enrollment | null;
  const enrolled = isActiveEnrollment(enrollment);

  const { data: completedProgressData, error: progressError } = user
    ? await supabase
        .from("lesson_progress")
        .select("lesson_id")
        .eq("student_id", user.id)
        .eq("course_id", course.id)
        .eq("completed", true)
    : { data: [], error: null };

  if (progressError) {
    console.error("Failed to load lesson progress:", progressError);
  }

  const completedLessonRows =
    (completedProgressData as { lesson_id: string }[] | null) || [];

  const publishedLessonIds = new Set(
    curriculumRows.map((row) => row.lesson_id)
  );

  const completedLessonIds = new Set(
    completedLessonRows
      .map((row) => row.lesson_id)
      .filter((lessonId) => publishedLessonIds.has(lessonId))
  );

  const totalLessons = curriculumRows.length;
  const totalCompleted = completedLessonIds.size;

  const progressPercent =
    totalLessons > 0
      ? Math.min(100, Math.round((totalCompleted / totalLessons) * 100))
      : 0;

  const courseCompleted =
    totalLessons > 0 && totalCompleted >= totalLessons;

  const nextIncompleteLesson =
    curriculumRows.find(
      (lesson) => !completedLessonIds.has(lesson.lesson_id)
    ) || null;

  const firstLesson = curriculumRows[0] || null;
  const continueLesson = nextIncompleteLesson || firstLesson;

  const calculatedMinutes = curriculumRows.reduce(
    (total, lesson) =>
      total + (lesson.duration_minutes || 0),
    0
  );

  const totalMinutes =
    calculatedMinutes > 0
      ? calculatedMinutes
      : course.duration_minutes || 0;

  const sectionsMap = new Map<string, SectionGroup>();

  for (const lesson of curriculumRows) {
    const existing = sectionsMap.get(lesson.section_id);

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

  const sections = Array.from(sectionsMap.values()).sort(
    (a, b) => a.sortOrder - b.sortOrder
  );

  const previewCount = curriculumRows.filter(
    (lesson) => lesson.is_preview
  ).length;

  const outcomes = course.learning_outcomes?.filter(Boolean) || [];
  const focus = getCourseFocus(course.slug);

  const continueHref = continueLesson
    ? `/learn/${course.slug}/${continueLesson.lesson_slug}`
    : `/courses/${course.slug}`;

  const assessmentHref = `/courses/${course.slug}/assessment`;

  const paymentMessage = getPaymentMessage(payment, course.title);

  const primaryAction = enrolled
    ? courseCompleted
      ? "assessment"
      : "continue"
    : user
      ? "enroll"
      : "login";

  return (
    <main className="rn-course-experience">
      <div className="container">
        <nav className="rn-course-breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <Link href="/courses">Courses</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{course.title}</span>
        </nav>

        {paymentMessage ? (
          <section
            className={`rn-payment-result rn-payment-result-${paymentMessage.type}`}
            role="status"
            aria-live="polite"
          >
            <div>
              <strong>{paymentMessage.title}</strong>
              <p>{paymentMessage.message}</p>
            </div>

            {payment === "failed" && !enrolled && !course.is_free ? (
              <EnrollButton
                courseId={course.id}
                courseSlug={course.slug}
                firstLessonSlug={firstLesson?.lesson_slug || null}
                courseTitle={course.title}
                className="rn-button rn-button-primary"
                label="Try Payment Again"
              />
            ) : null}

            {payment === "success" && enrolled && continueLesson ? (
              <Link
                href={courseCompleted ? assessmentHref : continueHref}
                className="rn-button rn-button-primary"
              >
                {courseCompleted ? "Take Final Assessment" : "Start Learning"}
              </Link>
            ) : null}
          </section>
        ) : null}

        <section className="rn-course-hero">
          <div className="rn-course-hero-copy">
            <span className="rn-eyebrow">{focus.eyebrow}</span>

            <div className="rn-course-meta-row">
              <span>{formatLevel(course.level)}</span>

              {course.category ? <span>{course.category}</span> : null}

              <span>{course.is_free ? "Free course" : "Paid course"}</span>
            </div>

            <h1>{course.title}</h1>
            <h2>{focus.title}</h2>

            <p className="rn-course-lead">
              {course.short_description ||
                focus.description ||
                "Build practical skills through structured learning and applied exercises."}
            </p>

            {course.description ? (
              <div
                className="rn-course-description"
                dangerouslySetInnerHTML={{
                  __html: course.description,
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
                <strong>{formatHours(totalMinutes)}</strong>
                <span>Learning time</span>
              </div>

              <div>
                <strong>{previewCount}</strong>
                <span>Preview lessons</span>
              </div>
            </div>

            {enrolled ? (
              <div className="rn-course-progress-box">
                <div className="rn-course-progress-header">
                  <span>Your learning progress</span>
                  <strong>{progressPercent}%</strong>
                </div>

                <div
                  className="rn-course-progress-track"
                  role="progressbar"
                  aria-label="Course completion"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progressPercent}
                >
                  <div style={{ width: `${progressPercent}%` }} />
                </div>

                <small>
                  {totalCompleted} of {totalLessons} lessons completed
                </small>

                {courseCompleted ? (
                  <p className="rn-course-completion-note">
                    All published lessons are complete. Your final assessment
                    is ready.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="rn-course-hero-actions">
              {primaryAction === "assessment" ? (
                <Link
                  href={assessmentHref}
                  className="rn-button rn-button-primary"
                >
                  Take Final Assessment
                </Link>
              ) : primaryAction === "continue" ? (
                <Link
                  href={continueHref}
                  className="rn-button rn-button-primary"
                >
                  {progressPercent > 0 ? "Continue Course" : "Start Course"}
                </Link>
              ) : primaryAction === "enroll" ? (
                <EnrollButton
                  courseId={course.id}
                  courseSlug={course.slug}
                  firstLessonSlug={firstLesson?.lesson_slug || null}
                  courseTitle={course.title}
                  className="rn-button rn-button-primary"
                  label={
                    course.is_free
                      ? "Enroll Free"
                      : `Enroll for ${formatPrice(course.price_ngn)}`
                  }
                />
              ) : (
                <Link
                  href={`/login?next=/courses/${course.slug}`}
                  className="rn-button rn-button-primary"
                >
                  Log in to enroll
                </Link>
              )}

              <Link
                href="/student/courses"
                className="rn-button rn-button-secondary"
              >
                My Learning
              </Link>
            </div>

            {!course.is_free ? (
              <p className="rn-course-price-note">
                Course fee: <strong>{formatPrice(course.price_ngn)}</strong>
                <span> · Secure payment through Flutterwave</span>
              </p>
            ) : (
              <p className="rn-course-price-note">
                No course fee. Sign in to enrol and track your progress.
              </p>
            )}
          </div>

          <aside className="rn-course-hero-aside">
            <div className="rn-course-preview-card">
              <div className="rn-course-preview-visual" aria-hidden="true">
                <span className="rn-course-preview-mark">RN</span>
                <span className="rn-course-preview-caption">
                  RUFFNECK LEARN
                </span>
              </div>

              <div className="rn-course-preview-content">
                <span className="rn-eyebrow">COURSE OVERVIEW</span>
                <h2>{course.title}</h2>

                <ul className="rn-course-includes">
                  <li>
                    <span aria-hidden="true">✓</span>
                    Structured learning modules
                  </li>
                  <li>
                    <span aria-hidden="true">✓</span>
                    {totalLessons} published lessons
                  </li>
                  <li>
                    <span aria-hidden="true">✓</span>
                    Self-paced access
                  </li>
                  <li>
                    <span aria-hidden="true">✓</span>
                    Learning progress tracking
                  </li>
                  <li>
                    <span aria-hidden="true">✓</span>
                    Practical learning activities
                  </li>
                </ul>

                <div className="rn-course-preview-price">
                  <span>{course.is_free ? "Course fee" : "Investment"}</span>
                  <strong>
                    {course.is_free ? "Free" : formatPrice(course.price_ngn)}
                  </strong>
                </div>

                {primaryAction === "assessment" ? (
                  <Link
                    href={assessmentHref}
                    className="rn-button rn-button-primary rn-button-full"
                  >
                    Take Final Assessment
                  </Link>
                ) : primaryAction === "continue" ? (
                  <Link
                    href={continueHref}
                    className="rn-button rn-button-primary rn-button-full"
                  >
                    Continue Learning
                  </Link>
                ) : primaryAction === "enroll" ? (
                  <EnrollButton
                    courseId={course.id}
                    courseSlug={course.slug}
                    firstLessonSlug={firstLesson?.lesson_slug || null}
                    courseTitle={course.title}
                    className="rn-button rn-button-primary rn-button-full"
                    label={
                      course.is_free
                        ? "Enroll Free"
                        : `Enroll for ${formatPrice(course.price_ngn)}`
                    }
                  />
                ) : (
                  <Link
                    href={`/login?next=/courses/${course.slug}`}
                    className="rn-button rn-button-primary rn-button-full"
                  >
                    Sign in to enroll
                  </Link>
                )}

                <p className="rn-course-secure-note">
                  Practical skills for professionals and businesses.
                </p>
              </div>
            </div>
          </aside>
        </section>

        <section className="rn-course-section-block">
          <div className="rn-course-section-heading">
            <span className="rn-eyebrow">LEARNING OUTCOMES</span>
            <h2>What you will be able to do</h2>
            <p>
              The course focuses on practical professional outcomes, not
              theory alone.
            </p>
          </div>

          {outcomes.length > 0 ? (
            <div className="rn-outcomes-grid">
              {outcomes.map((outcome, index) => (
                <article key={`${index}-${outcome}`} className="rn-outcome-card">
                  <span className="rn-outcome-number" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p>{outcome}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="rn-course-info-panel">
              <p>
                Build practical skills through structured lessons, exercises,
                and applied projects.
              </p>
            </div>
          )}
        </section>

        <section className="rn-course-section-block">
          <div className="rn-course-section-heading">
            <span className="rn-eyebrow">PRACTICAL LEARNING</span>
            <h2>Learn by applying what you know</h2>
            <p>
              Develop skills through realistic work situations and practical
              tasks.
            </p>
          </div>

          <div className="rn-practical-grid">
            <article className="rn-practical-card">
              <span>01</span>
              <h3>Real-world scenarios</h3>
              <p>
                Apply concepts to realistic workplace, business, education,
                and operational situations.
              </p>
            </article>

            <article className="rn-practical-card">
              <span>02</span>
              <h3>Case studies</h3>
              <p>
                Analyse practical problems, identify risks, and develop
                structured solutions.
              </p>
            </article>

            <article className="rn-practical-card">
              <span>03</span>
              <h3>Samples and exercises</h3>
              <p>
                Work with examples, templates, checklists, and guided practical
                tasks.
              </p>
            </article>

            <article className="rn-practical-card">
              <span>04</span>
              <h3>Applied projects</h3>
              <p>
                Demonstrate your learning through practical work and projects
                where provided.
              </p>
            </article>
          </div>
        </section>

        <section className="rn-course-section-block" id="curriculum">
          <div className="rn-course-section-heading">
            <span className="rn-eyebrow">COURSE CURRICULUM</span>
            <h2>Explore the modules</h2>
            <p>
              {sections.length} modules · {totalLessons} lessons ·{" "}
              {formatHours(totalMinutes)} estimated learning
            </p>
          </div>

          {sections.length > 0 ? (
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
                        {String(index + 1).padStart(2, "0")}
                      </span>

                      <div>
                        <h3>{section.title}</h3>
                        <p>
                          {section.lessons.length}{" "}
                          {section.lessons.length === 1 ? "lesson" : "lessons"}
                        </p>
                      </div>
                    </div>

                    <span className="rn-curriculum-chevron" aria-hidden="true">
                      +
                    </span>
                  </summary>

                  <div className="rn-curriculum-lessons">
                    {section.lessons.map((lesson, lessonIndex) => {
                      const completed = completedLessonIds.has(
                        lesson.lesson_id
                      );

                      const canOpenLesson =
                        enrolled || lesson.is_preview;

                      return (
                        <div
                          key={lesson.lesson_id}
                          className={`rn-curriculum-lesson ${
                            completed ? "is-completed" : ""
                          }`}
                        >
                          <div className="rn-lesson-index" aria-hidden="true">
                            {completed
                              ? "✓"
                              : String(lessonIndex + 1).padStart(2, "0")}
                          </div>

                          <div className="rn-lesson-main">
                            {canOpenLesson ? (
                              <Link
                                href={`/learn/${course.slug}/${lesson.lesson_slug}`}
                                className="rn-lesson-title"
                              >
                                {lesson.lesson_title}
                              </Link>
                            ) : (
                              <span className="rn-lesson-title">
                                {lesson.lesson_title}
                              </span>
                            )}

                            <div className="rn-lesson-meta">
                              {lesson.is_preview ? (
                                <span>Preview</span>
                              ) : null}

                              {lesson.duration_minutes ||
                              lesson.duration_seconds ? (
                                <span>
                                  {lesson.duration_minutes
                                    ? formatDuration(lesson.duration_minutes)
                                    : `${Math.ceil(
                                        (lesson.duration_seconds || 0) / 60
                                      )} min`}
                                </span>
                              ) : null}

                              {completed ? <span>Completed</span> : null}

                              {!canOpenLesson ? (
                                <span>Enrol to access</span>
                              ) : null}
                            </div>
                          </div>

                          {canOpenLesson ? (
                            <Link
                              href={`/learn/${course.slug}/${lesson.lesson_slug}`}
                              className="rn-lesson-open"
                              aria-label={`Open ${lesson.lesson_title}`}
                            >
                              Open
                            </Link>
                          ) : (
                            <span
                              className="rn-lesson-open rn-lesson-locked"
                              aria-label="Enrollment required"
                            >
                              Locked
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </details>
              ))}
            </div>
          ) : (
            <div className="rn-course-info-panel">
              <h3>Curriculum coming soon</h3>
              <p>
                The lesson curriculum for this course is being prepared.
                Check back for published lessons.
              </p>
            </div>
          )}
        </section>

        <section className="rn-course-bottom-grid">
          <article className="rn-course-info-panel">
            <span className="rn-eyebrow">WHO IT IS FOR</span>
            <h2>Target audience</h2>
            <p>
              {course.target_audience ||
                "Professionals, students, entrepreneurs, and learners who want practical digital skills."}
            </p>
          </article>

          <article className="rn-course-info-panel">
            <span className="rn-eyebrow">COURSE FORMAT</span>
            <h2>Self-paced learning</h2>
            <p>
              Work through the modules at your own pace, practise the concepts,
              and revisit completed lessons when needed.
            </p>

            <div className="rn-course-format-list">
              <span>✓ Structured modules</span>
              <span>✓ Practical exercises</span>
              <span>✓ Applied learning activities</span>
              <span>✓ Progress tracking</span>
            </div>
          </article>
        </section>

        <section className="rn-course-final-cta">
          <div>
            <span className="rn-eyebrow">
              {courseCompleted ? "ASSESSMENT READY" : "YOUR NEXT STEP"}
            </span>

            <h2>
              {courseCompleted
                ? "Your lessons are complete."
                : enrolled
                  ? "Continue building your skills."
                  : "Start building practical skills."}
            </h2>

            <p>
              {courseCompleted
                ? "Take the final assessment to record your performance."
                : enrolled && continueLesson
                  ? `Your next lesson is "${continueLesson.lesson_title}".`
                  : "Enroll to access the learning experience and track your progress."}
            </p>
          </div>

          <div className="rn-course-final-cta-actions">
            {primaryAction === "assessment" ? (
              <Link
                href={assessmentHref}
                className="rn-button rn-button-primary"
              >
                Take Final Assessment
              </Link>
            ) : primaryAction === "continue" ? (
              <Link
                href={continueHref}
                className="rn-button rn-button-primary"
              >
                Continue Learning
              </Link>
            ) : primaryAction === "enroll" ? (
              <EnrollButton
                courseId={course.id}
                courseSlug={course.slug}
                firstLessonSlug={firstLesson?.lesson_slug || null}
                courseTitle={course.title}
                className="rn-button rn-button-primary"
                label={
                  course.is_free
                    ? "Enroll Free"
                    : `Enroll for ${formatPrice(course.price_ngn)}`
                }
              />
            ) : (
              <Link
                href={`/login?next=/courses/${course.slug}`}
                className="rn-button rn-button-primary"
              >
                Log in to enroll
              </Link>
            )}

            <Link
              href="/courses"
              className="rn-button rn-button-secondary"
            >
              Explore Other Courses
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}