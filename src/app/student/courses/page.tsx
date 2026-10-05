import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Enrollment = {
  id: string;
  course_id: string;
  enrollment_status: string | null;
  payment_status: string | null;
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
  lesson_slug: string;
  lesson_title: string;
  lesson_sort_order: number;
  is_published: boolean;
};

type CourseSummary = Course & {
  enrollment_status: string | null;
  payment_status: string | null;
  enrolled_at: string;
  lesson_count: number;
  first_lesson_slug: string | null;
  first_lesson_title: string | null;
};

export default async function StudentCoursesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/student/courses");
  }

  const { data: enrollmentData } = await supabase
    .from("enrollments")
    .select(
      `
        id,
        course_id,
        enrollment_status,
        payment_status,
        created_at
      `
    )
    .eq("student_id", user.id)
    .in("enrollment_status", ["active", "completed"])
    .order("created_at", {
      ascending: false,
    });

  const enrollments =
    (enrollmentData ?? []) as Enrollment[];

  const courseIds = Array.from(
    new Set(
      enrollments.map(
        (enrollment) => enrollment.course_id
      )
    )
  );

  let courses: Course[] = [];

  if (courseIds.length > 0) {
    const { data: courseData } = await supabase
      .from("courses")
      .select(
        `
          id,
          title,
          slug,
          short_description,
          level,
          duration_minutes
        `
      )
      .in("id", courseIds);

    courses = (courseData ?? []) as Course[];
  }

  let curriculum: CurriculumLesson[] = [];

  if (courseIds.length > 0) {
    const { data: curriculumData } =
      await supabase
        .from("course_curriculum")
        .select(
          `
            course_id,
            lesson_slug,
            lesson_title,
            lesson_sort_order,
            is_published
          `
        )
        .in("course_id", courseIds)
        .eq("is_published", true)
        .order("lesson_sort_order", {
          ascending: true,
        });

    curriculum =
      (curriculumData ?? []) as CurriculumLesson[];
  }

  const courseMap = new Map(
    courses.map((course) => [
      course.id,
      course,
    ])
  );

  const curriculumByCourse = new Map<
    string,
    CurriculumLesson[]
  >();

  for (const lesson of curriculum) {
    const existing =
      curriculumByCourse.get(
        lesson.course_id
      ) ?? [];

    existing.push(lesson);

    curriculumByCourse.set(
      lesson.course_id,
      existing
    );
  }

  const summaries: CourseSummary[] =
    enrollments
      .map((enrollment) => {
        const course = courseMap.get(
          enrollment.course_id
        );

        if (!course) {
          return null;
        }

        const lessons =
          curriculumByCourse.get(
            course.id
          ) ?? [];

        const firstLesson =
          lessons[0] ?? null;

        return {
          ...course,
          enrollment_status:
            enrollment.enrollment_status,
          payment_status:
            enrollment.payment_status,
          enrolled_at:
            enrollment.created_at,
          lesson_count:
            lessons.length,
          first_lesson_slug:
            firstLesson?.lesson_slug ?? null,
          first_lesson_title:
            firstLesson?.lesson_title ?? null,
        };
      })
      .filter(
        (
          course
        ): course is CourseSummary =>
          course !== null
      );

  const activeCourses = summaries.filter(
    (course) =>
      course.enrollment_status === "active"
  );

  const completedCourses = summaries.filter(
    (course) =>
      course.enrollment_status === "completed"
  );

  const formatDuration = (
    minutes: number | null
  ) => {
    if (!minutes || minutes <= 0) {
      return "—";
    }

    const hours = Math.floor(
      minutes / 60
    );
    const remainingMinutes =
      minutes % 60;

    if (hours === 0) {
      return `${remainingMinutes} min`;
    }

    if (remainingMinutes === 0) {
      return `${hours} hr`;
    }

    return `${hours} hr ${remainingMinutes} min`;
  };

  const formatLevel = (
    level: string | null
  ) => {
    if (!level) {
      return "—";
    }

    return (
      level.charAt(0).toUpperCase() +
      level.slice(1)
    );
  };

  return (
    <main className="container">
      <section className="page-header">
        <div>
          <h1>My Courses</h1>

          <p>
            Access your enrolled courses and
            continue learning.
          </p>
        </div>

        <div className="page-actions">
          <Link
            href="/courses"
            className="button"
          >
            Browse Courses
          </Link>

          <Link
            href="/student"
            className="button secondary"
          >
            Dashboard
          </Link>
        </div>
      </section>

      <section className="stats-grid">
        <article className="stat-card">
          <span>Courses</span>
          <strong>
            {summaries.length}
          </strong>
        </article>

        <article className="stat-card">
          <span>Active</span>
          <strong>
            {activeCourses.length}
          </strong>
        </article>

        <article className="stat-card">
          <span>Completed</span>
          <strong>
            {completedCourses.length}
          </strong>
        </article>
      </section>

      {summaries.length === 0 ? (
        <section className="card empty-state">
          <h2>No enrolled courses</h2>

          <p>
            You have not enrolled in any
            courses yet.
          </p>

          <Link
            href="/courses"
            className="button"
          >
            Browse Courses
          </Link>
        </section>
      ) : (
        <section className="card">
          <div className="section-heading">
            <div>
              <h2>Your Learning</h2>

              <p>
                Continue an active course or
                review a completed course.
              </p>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Level</th>
                  <th>Lessons</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {summaries.map((course) => {
                  const isCompleted =
                    course.enrollment_status ===
                    "completed";

                  const lessonUrl =
                    course.first_lesson_slug
                      ? `/learn/${course.slug}/${course.first_lesson_slug}`
                      : `/courses/${course.slug}`;

                  return (
                    <tr
                      key={course.id}
                    >
                      <td>
                        <strong>
                          {course.title}
                        </strong>

                        {course.short_description ? (
                          <div className="muted">
                            {
                              course.short_description
                            }
                          </div>
                        ) : null}

                        {course.first_lesson_title &&
                        !isCompleted ? (
                          <div className="muted">
                            Next:
                            {" "}
                            {
                              course.first_lesson_title
                            }
                          </div>
                        ) : null}
                      </td>

                      <td>
                        {formatLevel(
                          course.level
                        )}
                      </td>

                      <td>
                        {course.lesson_count}
                      </td>

                      <td>
                        {formatDuration(
                          course.duration_minutes
                        )}
                      </td>

                      <td>
                        <span
                          className={`status ${
                            isCompleted
                              ? "status-success"
                              : "status-active"
                          }`}
                        >
                          {isCompleted
                            ? "Completed"
                            : "Active"}
                        </span>
                      </td>

                      <td>
                        <Link
                          href={
                            isCompleted
                              ? `/courses/${course.slug}`
                              : lessonUrl
                          }
                          className="button small"
                        >
                          {isCompleted
                            ? "View Course"
                            : "Continue Learning"}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}