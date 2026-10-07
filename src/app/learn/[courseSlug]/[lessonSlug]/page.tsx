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
  is_free: boolean;
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

type PracticalApplication = {
  title: string;
  introduction: string;
  steps: {
    number: string;
    title: string;
    description: string;
  }[];
  deliverable: string;
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
  if (!level) {
    return null;
  }

  return level.charAt(0).toUpperCase() + level.slice(1);
}

function getResourceLabel(type: Resource["resource_type"]) {
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

function getResourceTypeLabel(type: Resource["resource_type"]) {
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

function makeTablesResponsive(html: string) {
  if (!html || !/<table[\s>]/i.test(html)) {
    return html;
  }

  return html.replace(
    /<table\b([^>]*)>([\s\S]*?)<\/table>/gi,
    (_match, attributes, tableContent) => {
      return `
        <div class="rn-learning-table-wrap" role="region" aria-label="Scrollable lesson table" tabindex="0">
          <table${attributes}>${tableContent}</table>
        </div>
      `;
    }
  );
}

function getPracticalApplication(
  lessonTitle: string,
  courseTitle: string,
  category: string | null
): PracticalApplication {
  const text = `${lessonTitle} ${courseTitle} ${
    category ?? ""
  }`.toLowerCase();

  if (
    text.includes("prompt") ||
    text.includes("prompt engineering")
  ) {
    return {
      title:
        "Build and test a professional prompt",
      introduction:
        "Turn the lesson into a usable prompt for a real professional task. Focus on clarity, context, instructions, and the quality of the resulting output.",
      steps: [
        {
          number: "01",
          title: "Choose a real task",
          description:
            "Select a task you actually perform, such as drafting an email, summarising a report, analysing information, or preparing a document.",
        },
        {
          number: "02",
          title: "Build the prompt",
          description:
            "Create a structured prompt that gives the AI clear context, instructions, constraints, and the desired output format.",
        },
        {
          number: "03",
          title: "Test and improve",
          description:
            "Run the prompt, review the result, identify weaknesses, and revise the prompt until the output is useful and professionally appropriate.",
        },
      ],
      deliverable:
        "Save your final prompt and one example of the improved output.",
    };
  }

  if (
    text.includes("generative ai") ||
    text.includes("generative artificial intelligence") ||
    text.includes("what is ai") ||
    text.includes("ai foundations") ||
    text.includes("ai foundation")
  ) {
    return {
      title:
        "Apply AI foundations to a workplace task",
      introduction:
        "Connect the concept to an actual professional situation and determine where AI can assist without replacing appropriate human judgement.",
      steps: [
        {
          number: "01",
          title: "Identify a task",
          description:
            "Choose one recurring task from your work, study, business, teaching, administration, or personal productivity.",
        },
        {
          number: "02",
          title: "Apply AI assistance",
          description:
            "Use an appropriate AI tool to assist with the task. Give clear instructions and avoid submitting confidential or sensitive information.",
        },
        {
          number: "03",
          title: "Evaluate the result",
          description:
            "Check the output for accuracy, relevance, missing information, privacy concerns, and whether it genuinely improves the task.",
        },
      ],
      deliverable:
        "Record the task, the AI-assisted result, and one improvement you would make before using the result professionally.",
    };
  }

  if (
    text.includes("safety") ||
    text.includes("ethics") ||
    text.includes("responsible ai") ||
    text.includes("privacy")
  ) {
    return {
      title:
        "Apply responsible AI controls",
      introduction:
        "Use the lesson to identify risks in a realistic AI-assisted workflow and establish practical controls before using the workflow professionally.",
      steps: [
        {
          number: "01",
          title: "Identify the risk",
          description:
            "Choose an AI task and identify possible privacy, accuracy, bias, security, confidentiality, or misuse risks.",
        },
        {
          number: "02",
          title: "Apply safeguards",
          description:
            "Decide what information can be shared, what must be removed, and where human review is required.",
        },
        {
          number: "03",
          title: "Review the workflow",
          description:
            "Check whether the process produces a useful result while maintaining appropriate professional and ethical controls.",
        },
      ],
      deliverable:
        "Create a short AI safety checklist for the task you selected.",
    };
  }

  if (
    text.includes("excel") ||
    text.includes("spreadsheet") ||
    text.includes("power bi") ||
    text.includes("data analysis") ||
    text.includes("data analytics")
  ) {
    return {
      title:
        "Apply the technique to real data",
      introduction:
        "Use the lesson concept on a realistic dataset so that the skill becomes something you can apply in an actual workplace or business situation.",
      steps: [
        {
          number: "01",
          title: "Prepare the data",
          description:
            "Choose a suitable dataset and check its structure, completeness, consistency, and relevant fields.",
        },
        {
          number: "02",
          title: "Perform the analysis",
          description:
            "Apply the technique from this lesson to calculate, organise, analyse, visualise, or interpret the information.",
        },
        {
          number: "03",
          title: "Interpret the result",
          description:
            "Review the output and explain what it means for a manager, colleague, customer, business, or other intended audience.",
        },
      ],
      deliverable:
        "Produce one useful analysis, calculation, table, chart, or insight based on the lesson.",
    };
  }

  if (
    text.includes("digital marketing") ||
    text.includes("marketing") ||
    text.includes("social media") ||
    text.includes("content creation") ||
    text.includes("content marketing")
  ) {
    return {
      title:
        "Apply the concept to a marketing campaign",
      introduction:
        "Use the lesson to create one practical component of a professional digital marketing activity.",
      steps: [
        {
          number: "01",
          title: "Define the objective",
          description:
            "Choose a realistic marketing objective and identify the audience you want the activity to reach.",
        },
        {
          number: "02",
          title: "Create the marketing asset",
          description:
            "Apply the lesson to produce an appropriate post, message, campaign element, content idea, audience definition, or marketing workflow.",
        },
        {
          number: "03",
          title: "Review effectiveness",
          description:
            "Check whether the result is clear, relevant to the audience, aligned with the objective, and suitable for publication.",
        },
      ],
      deliverable:
        "Create one campaign-ready marketing asset and briefly explain its intended audience and objective.",
    };
  }

  if (
    text.includes("teacher") ||
    text.includes("teaching") ||
    text.includes("education") ||
    text.includes("classroom") ||
    text.includes("lesson plan")
  ) {
    return {
      title:
        "Apply the concept to a teaching situation",
      introduction:
        "Translate the lesson into a practical teaching activity that could be used with learners in a real educational environment.",
      steps: [
        {
          number: "01",
          title: "Choose a teaching situation",
          description:
            "Select a real topic, learner group, classroom challenge, or teaching objective relevant to your context.",
        },
        {
          number: "02",
          title: "Apply the technique",
          description:
            "Use the method from this lesson to design, improve, deliver, or assess the selected teaching activity.",
        },
        {
          number: "03",
          title: "Review the outcome",
          description:
            "Consider whether the activity supports the learning objective and identify what you would improve next time.",
        },
      ],
      deliverable:
        "Create one practical teaching resource, activity, plan, or assessment aligned with the lesson.",
    };
  }

  if (
    text.includes("record") ||
    text.includes("records management") ||
    text.includes("information management") ||
    text.includes("document management")
  ) {
    return {
      title:
        "Apply the concept to records management",
      introduction:
        "Use the lesson to improve how a real organisation creates, captures, classifies, stores, retrieves, protects, or disposes of information.",
      steps: [
        {
          number: "01",
          title: "Identify a record",
          description:
            "Choose a realistic business, administrative, financial, personnel, customer, or operational record.",
        },
        {
          number: "02",
          title: "Apply the method",
          description:
            "Use the lesson's records or information-management principle to classify, organise, process, protect, or retrieve the record.",
        },
        {
          number: "03",
          title: "Review the process",
          description:
            "Check whether the information is accurate, accessible, appropriately protected, and managed according to its purpose.",
        },
      ],
      deliverable:
        "Produce a simple record-management example, classification, workflow, register, or control based on the lesson.",
    };
  }

  if (
    text.includes("automation") ||
    text.includes("workflow") ||
    text.includes("productivity") ||
    text.includes("office") ||
    text.includes("business operations")
  ) {
    return {
      title:
        "Improve a real professional workflow",
      introduction:
        "Identify a repetitive or inefficient task and apply the lesson to make the workflow clearer, faster, more consistent, or easier to manage.",
      steps: [
        {
          number: "01",
          title: "Map the current task",
          description:
            "Write down the main steps currently required to complete the task and identify where time or effort is being lost.",
        },
        {
          number: "02",
          title: "Apply the lesson",
          description:
            "Use the technique from this lesson to improve, simplify, automate, organise, or standardise the workflow.",
        },
        {
          number: "03",
          title: "Review the improvement",
          description:
            "Compare the original and improved workflow and identify the practical benefit, remaining risks, and next improvement.",
        },
      ],
      deliverable:
        "Create a simple before-and-after workflow showing how the lesson improved the task.",
    };
  }

  return {
    title:
      `Apply ${lessonTitle} to a real situation`,
    introduction:
      "Connect the lesson to an actual professional, business, educational, or personal situation so that the concept becomes a usable skill.",
    steps: [
      {
        number: "01",
        title: "Identify the concept",
        description:
          "Select the most important concept, method, process, or skill from this lesson.",
      },
      {
        number: "02",
        title: "Apply it to a real situation",
        description:
          "Choose a realistic task and use the lesson's concept to produce a practical result.",
      },
      {
        number: "03",
        title: "Review your result",
        description:
          "Check the result for accuracy, usefulness, completeness, and areas that could be improved.",
      },
    ],
    deliverable:
      "Create one practical example demonstrating how you applied the lesson.",
  };
}

function isActiveEnrollment(
  enrollment: Enrollment | null
) {
  if (!enrollment) {
    return false;
  }

  if (!enrollment.enrollment_status) {
    return true;
  }

  return (
    enrollment.enrollment_status === "active" ||
    enrollment.enrollment_status === "completed"
  );
}

function hasPaidAccess(
  course: Course,
  enrollment: Enrollment | null
) {
  if (!isActiveEnrollment(enrollment)) {
    return false;
  }

  if (course.is_free) {
    return true;
  }

  return enrollment?.payment_status === "paid";
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

  const {
    data: courseData,
    error: courseError,
  } = await supabase
    .from("courses")
    .select(
      "id, title, slug, category, level, is_free"
    )
    .eq("slug", courseSlug)
    .eq("status", "published")
    .maybeSingle();

  if (courseError) {
    console.error(
      "Failed to load course:",
      courseError
    );

    throw new Error(
      "Unable to load the course."
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

  const hasCourseAccess =
    hasPaidAccess(course, enrollment);

  const {
    data: curriculumData,
    error: curriculumError,
  } = await supabase
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

    throw new Error(
      "Unable to load the course curriculum."
    );
  }

  const curriculum =
    (curriculumData ?? []) as unknown as CurriculumRow[];

  const curriculumLessonIds = new Set(
    curriculum.map(
      (row) => row.lesson_id
    )
  );

  const curriculumLessonSlugs = new Set(
    curriculum.map(
      (row) => row.lesson_slug
    )
  );

  const {
    data: lessonData,
    error: lessonError,
  } = await supabase
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

    throw new Error(
      "Unable to load the lesson."
    );
  }

  const lesson =
    lessonData as unknown as Lesson | null;

  if (!lesson) {
    notFound();
  }

  if (
    !curriculumLessonIds.has(lesson.id) ||
    !curriculumLessonSlugs.has(lesson.slug)
  ) {
    notFound();
  }

  if (!lesson.is_preview && !hasCourseAccess) {
    redirect(`/courses/${courseSlug}`);
  }

  const { data: completedProgressData } =
    hasCourseAccess
      ? await supabase
          .from("lesson_progress")
          .select("lesson_id")
          .eq("student_id", user.id)
          .eq("course_id", course.id)
          .eq("completed", true)
      : { data: [] };

  const completedProgress =
    (completedProgressData ?? []) as {
      lesson_id: string;
    }[];

  const completedLessonIds = new Set(
    completedProgress
      .map((row) => row.lesson_id)
      .filter((lessonId) =>
        curriculumLessonIds.has(
          lessonId
        )
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

  const currentIndex =
    curriculum.findIndex(
      (row) =>
        row.lesson_id === lesson.id &&
        row.lesson_slug === lesson.slug
    );

  if (currentIndex === -1) {
    notFound();
  }

  const lessonNumber =
    currentIndex + 1;

  const previousLesson =
    currentIndex > 0
      ? curriculum[currentIndex - 1]
      : null;

  const nextLesson =
    currentIndex <
    curriculum.length - 1
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
    (resourcesData ?? []) as unknown as Resource[];

  const sectionTitle =
    curriculum[currentIndex]?.section_title ||
    course.category ||
    "Course lesson";

  const totalDuration = formatDuration(
    lesson.duration_minutes,
    null
  );

  const rawLessonContent =
    removeDuplicateLeadingHeading(
      lesson.content_html,
      lesson.title
    );

  const lessonContent =
    makeTablesResponsive(
      rawLessonContent
    );

  const practicalApplication =
    getPracticalApplication(
      lesson.title,
      course.title,
      course.category
    );

  const progressLabel =
    totalLessons > 0
      ? `${totalCompleted} of ${totalLessons} lessons completed`
      : "Course progress";

  return (
    <main className="rn-learning-shell">
      <div className="container">
        <div className="rn-learning-topbar">
          <div className="rn-learning-topbar-copy">
            <Link
              href={`/courses/${course.slug}`}
              className="rn-learning-back"
            >
              ←{" "}
              <span className="rn-learning-back-title">
                {course.title}
              </span>
            </Link>

            <div className="rn-learning-breadcrumb">
              <span>{sectionTitle}</span>
              <span aria-hidden="true">
                ·
              </span>
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

        <div
          className="rn-learning-progress-track"
          aria-label={`Course progress: ${courseProgress}%`}
        >
          <div
            style={{
              width: `${courseProgress}%`,
              maxWidth: "100%",
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
                      aria-current={
                        active
                          ? "page"
                          : undefined
                      }
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
                material, complete the practical
                task, then mark the lesson
                complete.
              </p>
            </header>

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
                    Use the video together with
                    the written lesson material.
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

            <section className="rn-learning-material">
              <div className="rn-learning-section-heading">
                <span className="rn-eyebrow">
                  LESSON MATERIAL
                </span>

                <p>
                  Read through the material
                  carefully before completing the
                  practical application.
                </p>
              </div>

              <div
                className="rn-learning-article"
                dangerouslySetInnerHTML={{
                  __html: lessonContent,
                }}
              />
            </section>

            <section className="rn-learning-practice-panel">
              <div className="rn-learning-practice-intro">
                <span className="rn-eyebrow">
                  PRACTICAL APPLICATION
                </span>

                <h2>
                  {practicalApplication.title}
                </h2>

                <p>
                  {practicalApplication.introduction}
                </p>
              </div>

              <div className="rn-learning-practice-grid">
                {practicalApplication.steps.map(
                  (step) => (
                    <article
                      key={step.number}
                      className="rn-learning-practice-step"
                    >
                      <span className="rn-practice-number">
                        {step.number}
                      </span>

                      <section className="rn-practice-step-content">
                        <h3>{step.title}</h3>

                        <p>
                          {step.description}
                        </p>
                      </section>
                    </article>
                  )
                )}
              </div>

              <div className="rn-learning-practice-deliverable">
                <span>
                  LEARNER DELIVERABLE
                </span>

                <p>
                  {practicalApplication.deliverable}
                </p>
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

                  <p>
                    Supporting material you can
                    open while studying this
                    lesson.
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

                        <span className="rn-resource-copy">
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

            {hasCourseAccess ? (
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
                    Continue with the full
                    course
                  </h2>

                  <p>
                    This is a preview lesson.
                    View the full course to see
                    the complete curriculum and
                    enrollment options.
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

            <nav
              className="rn-learning-navigation"
              aria-label="Lesson navigation"
            >
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