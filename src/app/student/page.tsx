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
};

export default async function StudentDashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/student");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  const { data: enrollmentData } = await supabase
    .from("enrollments")
    .select(
      "id, course_id, enrollment_status, payment_status, enrolled_at"
    )
    .eq("student_id", user.id)
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
    const { data: courseData } = await supabase
      .from("courses")
      .select("id, title, slug")
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

  const activeEnrollments =
    enrollments.filter(
      (enrollment) =>
        enrollment.enrollment_status ===
          "active" ||
        enrollment.enrollment_status ===
          "completed"
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
            Learning Dashboard
          </h1>

          <p>
            {profile?.full_name
              ? `Welcome back, ${profile.full_name}.`
              : "Manage your learning and course access."}
          </p>
        </div>

        <div className="admin-page-actions">
          <Link
            href="/student/courses"
            className="btn btn-primary"
          >
            My Courses
          </Link>

          <Link
            href="/courses"
            className="btn btn-secondary"
          >
            Browse Courses
          </Link>
        </div>
      </div>

      <section className="admin-stats">
        <div className="admin-stat">
          <span>Enrolled Courses</span>
          <strong>
            {enrollments.length}
          </strong>
        </div>

        <div className="admin-stat">
          <span>Active Learning</span>
          <strong>
            {activeEnrollments.length}
          </strong>
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
            <h2>
              Continue Learning
            </h2>

            <p>
              Open one of your enrolled courses.
            </p>
          </div>

          <Link
            href="/student/courses"
            className="btn btn-secondary"
          >
            View All Courses
          </Link>
        </div>

        {activeEnrollments.length === 0 ? (
          <div className="admin-empty">
            <h3>
              No active courses
            </h3>

            <p>
              Enroll in a course to start learning.
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
                  <th>Status</th>
                  <th>Enrolled</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {activeEnrollments
                  .slice(0, 5)
                  .map((enrollment) => {
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
                  })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-card">
        <div className="admin-card-header">
          <div>
            <h2>
              Learning Tools
            </h2>

            <p>
              Tools available from your student
              account.
            </p>
          </div>
        </div>

        <div className="admin-page-actions">
          <Link
            href="/student/scan"
            className="btn btn-secondary"
          >
            Scan & Learn
          </Link>

          <Link
            href="/student/ai-drafts"
            className="btn btn-secondary"
          >
            My AI Drafts
          </Link>

          <Link
            href="/student/payments"
            className="btn btn-secondary"
          >
            Payment History
          </Link>
        </div>
      </section>
    </main>
  );
}