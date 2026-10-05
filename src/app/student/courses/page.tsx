import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Enrollment = {
  id: string;
  course_id: string;
  enrollment_status: string;
  payment_status: string;
  progress_percent: number | null;
  created_at: string;
};

type Course = {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  level: string | null;
  duration_minutes: number | null;
};

type CurriculumLesson = {
  course_id: string;
  lesson_id: string;
  lesson_slug: string;
  lesson_title: string;
  lesson_sort_order: number;
  is_published: boolean;
};

type LessonProgress = {
  student_id: string;
  lesson_id: string;
  course_id: string;
  completed: boolean;
};

type AssessmentAttempt = {
  id: string;
  course_id: string | null;
  assessment_type: string;
  score_percent: number | null;
  level: string | null;
  started_at: string;
  completed_at: string | null;
};

type CourseAssessment = {
  status:
    | "not_started"
    | "in_progress"
    | "completed";
  score_percent: number | null;
};

export default async function StudentCoursesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/student/courses");
  }

  const { data: enrollmentData, error: enrollmentError } =
    await supabase
      .from("enrollments")
      .select(
        "id, course_id, enrollment_status, payment_status, progress_percent, created_at"
      )
      .eq("student_id", user.id)
      .in("enrollment_status", [
        "active",
        "completed",
      ])
      .order("created_at", {
        ascending: false,
      });

  if (enrollmentError) {
    throw new Error(enrollmentError.message);
  }

  const enrollments =
    (enrollmentData ?? []) as Enrollment[];

  if (enrollments.length === 0) {
    return (
      <main className="container">
        <section className="page-header">
          <h1>My Courses</h1>

          <p>
            Your enrolled courses and learning progress
            will appear here.
          </p>
        </section>

        <section className="card">
          <h2>No courses yet</h2>

          <p>
            You are not currently enrolled in any
            courses.
          </p>

          <Link
            href="/courses"
            className="button primary"
          >
            Browse Courses
          </Link>
        </section>
      </main>
    );
  }

  const courseIds = Array.from(
    new Set(
      enrollments.map(
        (enrollment) => enrollment.course_id
      )
    )
  );

  const [
    courseResult,
    curriculumResult,
    progressResult,
    assessmentResult,
  ] = await Promise.all([
    supabase
      .from("courses")
      .select(
        "id, title, slug, short_description, level, duration_minutes"
      )
      .in("id", courseIds),

    supabase
      .from("course_curriculum")
      .select(
        "course_id, lesson_id, lesson_slug, lesson_title, lesson_sort_order, is_published"
      )
      .in("course_id", courseIds)
      .eq("is_published", true)
      .order("lesson_sort_order", {
        ascending: true,
      }),

    supabase
      .from("lesson_progress")
      .select(
        "student_id, lesson_id, course_id, completed"
      )
      .eq("student_id", user.id)
      .in("course_id", courseIds),

    supabase
      .from("assessment_attempts")
      .select(
        "id, course_id, assessment_type, score_percent, level, started_at, completed_at"
      )
      .eq("student_id", user.id)
      .eq(
        "assessment_type",
        "course_assessment"
      )
      .in("course_id", courseIds)
      .order("started_at", {
        ascending: false,
      }),
  ]);

  if (courseResult.error) {
    throw new Error(courseResult.error.message);
  }

  if (curriculumResult.error) {
    throw new Error(
      curriculumResult.error.message
    );
  }

  if (progressResult.error) {
    throw new Error(
      progressResult.error.message
    );
  }

  if (assessmentResult.error) {
    throw new Error(
      assessmentResult.error.message
    );
  }

  const courses =
    (courseResult.data ?? []) as Course[];

  const curriculum =
    (curriculumResult.data ??
      []) as CurriculumLesson[];

  const lessonProgress =
    (progressResult.data ??
      []) as LessonProgress[];

  const assessmentAttempts =
    (assessmentResult.data ??
      []) as AssessmentAttempt[];

  const courseMap = new Map(
    courses.map((course) => [
      course.id,
      course,
    ])
  );

  const lessonsByCourse = new Map<
    string,
    CurriculumLesson[]
  >();

  for (const lesson of curriculum) {
    const existing =
      lessonsByCourse.get(
        lesson.course_id
      ) ?? [];

    existing.push(lesson);

    lessonsByCourse.set(
      lesson.course_id,
      existing
    );
  }

  const completedLessonIds = new Set(
    lessonProgress
      .filter(
        (progress) => progress.completed
      )
      .map(
        (progress) => progress.lesson_id
      )
  );

  const assessmentByCourse =
    new Map<string, CourseAssessment>();

  for (const attempt of assessmentAttempts) {
    if (!attempt.course_id) {
      continue;
    }

    if (
      assessmentByCourse.has(
        attempt.course_id
      )
    ) {
      continue;
    }

    assessmentByCourse.set(
      attempt.course_id,
      {
        status: attempt.completed_at
          ? "completed"
          : "in_progress",
        score_percent:
          attempt.score_percent,
      }
    );
  }

  const courseRows = enrollments
    .map((enrollment) => {
      const course = courseMap.get(
        enrollment.course_id
      );

      if (!course) {
        return null;
      }

      const lessons =
        lessonsByCourse.get(
          course.id
        ) ?? [];

      const completedCount =
        lessons.filter((lesson) =>
          completedLessonIds.has(
            lesson.lesson_id
          )
        ).length;

      const totalLessons =
        lessons.length;

      const allLessonsCompleted =
        totalLessons > 0 &&
        completedCount === totalLessons;

      const lessonPercent =
        totalLessons > 0
          ? Math.round(
              (completedCount /
                totalLessons) *
                100
            )
          : Number(
              enrollment.progress_percent ??
                0
            );

      const nextLesson =
        lessons.find(
          (lesson) =>
            !completedLessonIds.has(
              lesson.lesson_id
            )
        ) ?? null;

      const assessment =
        assessmentByCourse.get(
          course.id
        ) ?? {
          status: "not_started" as const,
          score_percent: null,
        };

      return {
        enrollment,
        course,
        lessons,
        completedCount,
        totalLessons,
        allLessonsCompleted,
        lessonPercent: Math.min(
          100,
          Math.max(0, lessonPercent)
        ),
        nextLesson,
        assessment,
      };
    })
    .filter(
      (
        row
      ): row is NonNullable<typeof row> =>
        row !== null
    );

  const activeCourses =
    courseRows.filter(
      (row) =>
        row.enrollment.enrollment_status ===
        "active"
    );

  const completedCourses =
    courseRows.filter(
      (row) =>
        row.enrollment.enrollment_status ===
          "completed" ||
        row.allLessonsCompleted
    );

  return (
    <main className="container">
      <section className="page-header">
        <h1>My Courses</h1>

        <p>
          Track your lessons, resume learning, and
          monitor course assessments.
        </p>
      </section>

      <section className="stats-grid">
        <div className="card">
          <strong>
            {courseRows.length}
          </strong>

          <span>Enrolled Courses</span>
        </div>

        <div className="card">
          <strong>
            {activeCourses.length}
          </strong>

          <span>Active Learning</span>
        </div>

        <div className="card">
          <strong>
            {completedCourses.length}
          </strong>

          <span>Completed</span>
        </div>
      </section>

      <section className="stack">
        {courseRows.map((row) => {
          const {
            course,
            enrollment,
            completedCount,
            totalLessons,
            allLessonsCompleted,
            lessonPercent,
            nextLesson,
            assessment,
          } = row;

          const courseAssessmentLabel =
            assessment.status ===
            "completed"
              ? "Completed"
              : assessment.status ===
                  "in_progress"
                ? "In progress"
                : "Not started";

          const assessmentScore =
            assessment.score_percent !==
            null
              ? `${Math.round(
                  Number(
                    assessment.score_percent
                  )
                )}%`
              : null;

          const primaryHref =
            !allLessonsCompleted &&
            nextLesson
              ? `/learn/${course.slug}/${nextLesson.lesson_slug}`
              : `/courses/${course.slug}`;

          const primaryLabel =
            !allLessonsCompleted &&
            nextLesson
              ? "Continue Learning"
              : "Review Course";

          const assessmentLabel =
            assessment.status ===
            "completed"
              ? "View Assessment"
              : assessment.status ===
                  "in_progress"
                ? "Continue Assessment"
                : "Start Assessment";

          const assessmentHref =
            `/student/assessment?course=${encodeURIComponent(
              course.slug
            )}`;

          return (
            <article
              key={enrollment.id}
              className="card"
            >
              <div className="course-card-header">
                <div>
                  <h2>{course.title}</h2>

                  {course.short_description ? (
                    <p>
                      {
                        course.short_description
                      }
                    </p>
                  ) : null}
                </div>

                <span className="status-badge">
                  {
                    enrollment.enrollment_status
                  }
                </span>
              </div>

              <div className="course-meta">
                {course.level ? (
                  <span>
                    Level: {course.level}
                  </span>
                ) : null}

                {course.duration_minutes ? (
                  <span>
                    Duration:{" "}
                    {
                      course.duration_minutes
                    }{" "}
                    min
                  </span>
                ) : null}

                <span>
                  {completedCount} of{" "}
                  {totalLessons} lessons
                </span>
              </div>

              <div className="progress-section">
                <div className="progress-header">
                  <strong>
                    Lesson Progress
                  </strong>

                  <span>
                    {lessonPercent}%
                  </span>
                </div>

                <div
                  className="progress-bar"
                  aria-label={`Lesson progress: ${lessonPercent}%`}
                >
                  <div
                    className="progress-fill"
                    style={{
                      width: `${lessonPercent}%`,
                    }}
                  />
                </div>
              </div>

              <div className="assessment-progress">
                <div>
                  <strong>
                    Course Assessment
                  </strong>

                  <p>
                    {
                      courseAssessmentLabel
                    }

                    {assessmentScore
                      ? ` · Score: ${assessmentScore}`
                      : ""}
                  </p>
                </div>

                <Link
                  href={assessmentHref}
                  className="button secondary"
                >
                  {assessmentLabel}
                </Link>
              </div>

              <div className="course-card-actions">
                <Link
                  href={primaryHref}
                  className="button primary"
                >
                  {primaryLabel}
                </Link>

                <Link
                  href={`/courses/${course.slug}`}
                  className="button secondary"
                >
                  Course Details
                </Link>
              </div>
            </article>
          );
        })}
      </section>

      <section className="card">
        <h2>Need another course?</h2>

        <p>
          Browse the RuffNeck Learn catalog to
          continue building practical
          professional skills.
        </p>

        <Link
          href="/courses"
          className="button secondary"
        >
          Browse Courses
        </Link>
      </section>
    </main>
  );
}