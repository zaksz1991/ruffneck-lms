import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Enrollment = {
  id: string;
  course_id: string;
  enrollment_status: string;
  payment_status: string | null;
  enrolled_at: string;
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
  lesson_slug: string | null;
  lesson_title: string | null;
  lesson_sort_order: number | null;
  is_published: boolean | null;
};

function formatDuration(minutes: number | null) {
  if (!minutes || minutes <= 0) {
    return "—";
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0 && remainingMinutes > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${remainingMinutes}m`;
}

function statusLabel(status: string) {
  if (status === "completed") {
    return "Completed";
  }

  if (status === "active") {
    return "Active";
  }

  return status;
}

function statusClass(status: string) {
  if (status === "completed") {
    return "rn-payment-status rn-payment-status-successful";
  }

  return "rn-payment-status rn-payment-status-pending";
}

export default async function StudentCoursesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/student/courses");
  }

  const { data: enrollmentData } =
    await supabase
      .from("enrollments")
      .select(
        `
          id,
          course_id,
          enrollment_status,
          payment_status,
          enrolled_at
        `
      )
      .eq("student_id", user.id)
      .in("enrollment_status", [
        "active",
        "completed",
      ])
      .order("enrolled_at", {
        ascending: false,
      });

  const enrollments =
    (enrollmentData ?? []) as Enrollment[];

  const courseIds = Array.from(
    new Set(
      enrollments.map(
        (enrollment) =>
          enrollment.course_id
      )
    )
  );

  let courses: Course[] = [];

  if (courseIds.length > 0) {
    const { data: courseData } =
      await supabase
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

    courses =
      (courseData ?? []) as Course[];
  }

  const courseMap = new Map(
    courses.map((course) => [
      course.id,
      course,
    ])
  );

  /*
   * Load the published curriculum for the
   * enrolled courses.
   *
   * course_curriculum is the existing safe
   * curriculum view used by the public course
   * and lesson flow.
   */
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
      (curriculumData ??
        []) as CurriculumLesson[];
  }

  const firstLessonByCourse =
    new Map<string, CurriculumLesson>();

  for (const lesson of curriculum) {
    if (
      !lesson.lesson_slug ||
      firstLessonByCourse.has(
        lesson.course_id
      )
    ) {
      continue;
    }

    firstLessonByCourse.set(
      lesson.course_id,
      lesson
    );
  }

  const completedCount =
    enrollments.filter(
      (enrollment) =>
        enrollment.enrollment_status ===
        "completed"
    ).length;

  const activeCount =
    enrollments.filter(
      (enrollment) =>
        enrollment.enrollment_status ===
        "active"
    ).length;

  return (
    <main className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="eyebrow">
            Student Account
          </p>

          <h1>My Courses</h1>

          <p>
            Access the courses you are enrolled
            in and continue your learning.
          </p>
        </div>

        <div className="admin-page-actions">
          <Link
            href="/student"
            className="btn btn-secondary"
          >
            Dashboard
          </Link>

          <Link
            href="/courses"
            className="btn btn-primary"
          >
            Browse Courses
          </Link>
        </div>
      </div>

      <section className="admin-stats">
        <div className="admin-stat">
          <span>Total Courses</span>
          <strong>
            {enrollments.length}
          </strong>
        </div>

        <div className="admin-stat">
          <span>Active</span>
          <strong>{activeCount}</strong>
        </div>

        <div className="admin-stat">
          <span>Completed</span>
          <strong>
            {completedCount}
          </strong>
        </div>
      </section>

      <section className="admin-card">
        <div className="admin-card-header">
          <div>
            <h2>Enrolled Courses</h2>

            <p>
              Select a course to continue learning
              or review its curriculum.
            </p>
          </div>
        </div>

        {enrollments.length === 0 ? (
          <div className="admin-empty">
            <h3>
              You have no enrolled courses
            </h3>

            <p>
              Browse the RuffNeck Learn catalogue
              and enroll in a course to begin.
            </p>

            <Link
              href="/courses"
              className="btn btn-primary"
            >
              Browse Courses
            </Link>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Level</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Enrolled</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {enrollments.map(
                  (enrollment) => {
                    const course =
                      courseMap.get(
                        enrollment.course_id
                      );

                    if (!course) {
                      return (
                        <tr
                          key={enrollment.id}
                        >
                          <td colSpan={6}>
                            Course information is
                            currently unavailable.
                          </td>
                        </tr>
                      );
                    }

                    const firstLesson =
                      firstLessonByCourse.get(
                        enrollment.course_id
                      );

                    const isCompleted =
                      enrollment.enrollment_status ===
                      "completed";

                    const continueHref =
                      !isCompleted &&
                      firstLesson?.lesson_slug
                        ? `/learn/${course.slug}/${firstLesson.lesson_slug}`
                        : `/courses/${course.slug}`;

                    const actionLabel =
                      isCompleted
                        ? "View Course"
                        : firstLesson?.lesson_slug
                          ? "Continue Learning"
                          : "View Course";

                    return (
                      <tr
                        key={enrollment.id}
                      >
                        <td>
                          <div>
                            <strong>
                              {course.title}
                            </strong>

                            {course.short_description ? (
                              <p
                                style={{
                                  margin:
                                    "4px 0 0",
                                  maxWidth:
                                    "420px",
                                }}
                              >
                                {
                                  course.short_description
                                }
                              </p>
                            ) : null}
                          </div>
                        </td>

                        <td>
                          {course.level ??
                            "—"}
                        </td>

                        <td>
                          {formatDuration(
                            course.duration_minutes
                          )}
                        </td>

                        <td>
                          <span
                            className={statusClass(
                              enrollment.enrollment_status
                            )}
                          >
                            {statusLabel(
                              enrollment.enrollment_status
                            )}
                          </span>
                        </td>

                        <td>
                          {new Date(
                            enrollment.enrolled_at
                          ).toLocaleDateString(
                            "en-NG",
                            {
                              dateStyle:
                                "medium",
                            }
                          )}
                        </td>

                        <td>
                          <Link
                            href={
                              continueHref
                            }
                            className="btn btn-primary"
                          >
                            {actionLabel}
                          </Link>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}