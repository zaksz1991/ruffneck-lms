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

export default async function StudentCoursesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      "/login?next=/student/courses"
    );
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
        (enrollment) => enrollment.course_id
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

  const completedCount =
    enrollments.filter(
      (enrollment) =>
        enrollment.enrollment_status ===
        "completed"
    ).length;

  return (
    <main className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="eyebrow">
            RuffNeck Learn
          </p>

          <h1>
            My Courses
          </h1>

          <p>
            Access the courses you are enrolled
            in.
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
          <span>Courses</span>
          <strong>
            {enrollments.length}
          </strong>
        </div>

        <div className="admin-stat">
          <span>Active</span>
          <strong>
            {enrollments.filter(
              (enrollment) =>
                enrollment.enrollment_status ===
                "active"
            ).length}
          </strong>
        </div>

        <div className="admin-stat">
          <span>Completed</span>
          <strong>
            {completedCount}
          </strong>
        </div>
      </section>

      {enrollments.length === 0 ? (
        <section className="admin-card">
          <div className="admin-empty">
            <h2>
              No enrolled courses
            </h2>

            <p>
              Your enrolled courses will appear
              here after you register or complete
              a course payment.
            </p>

            <Link
              href="/courses"
              className="btn btn-primary"
            >
              Browse Courses
            </Link>
          </div>
        </section>
      ) : (
        <section className="admin-card">
          <div className="admin-card-header">
            <div>
              <h2>
                Enrolled Courses
              </h2>

              <p>
                Your available learning content.
              </p>
            </div>
          </div>

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
                      return null;
                    }

                    const completed =
                      enrollment.enrollment_status ===
                      "completed";

                    return (
                      <tr
                        key={enrollment.id}
                      >
                        <td>
                          <strong>
                            {course.title}
                          </strong>

                          {course.short_description ? (
                            <div>
                              <small>
                                {
                                  course.short_description
                                }
                              </small>
                            </div>
                          ) : null}
                        </td>

                        <td>
                          {course.level ||
                            "—"}
                        </td>

                        <td>
                          {course.duration_minutes
                            ? `${Math.round(
                                course.duration_minutes /
                                  60
                              )} hrs`
                            : "—"}
                        </td>

                        <td>
                          <span
                            className={
                              completed
                                ? "rn-payment-status rn-payment-status-successful"
                                : "rn-payment-status rn-payment-status-pending"
                            }
                          >
                            {completed
                              ? "Completed"
                              : "Active"}
                          </span>
                        </td>

                        <td>
                          {new Date(
                            enrollment.enrolled_at
                          ).toLocaleDateString(
                            "en-NG"
                          )}
                        </td>

                        <td>
                          <Link
                            href={`/courses/${course.slug}`}
                            className="btn btn-secondary"
                          >
                            Open Course
                          </Link>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}