import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Enrollment = {
  id: string;
  course_id: string;
  status: string;
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
    .select("id, course_id, status, enrolled_at")
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

    courses = (courseData ?? []) as Course[];
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
        enrollment.status === "active" ||
        enrollment.status === "completed"
    );

  const completedCount =
    enrollments.filter(
      (enrollment) =>
        enrollment.status === "completed"
    ).length;

  return (
    <main className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="eyebrow">
            RuffNeck Learn
          </p>

          <h1>
            My Learning
          </h1>

          <p>
            {profile?.full_name
              ? `Welcome back, ${profile.full_name}.`
              : "Manage your learning and course access."}
          </p>
        </div>

        <div className="admin-page-actions">
          <Link
            href="/courses"
            className="btn btn-primary"
          >
            Browse Courses
          </Link>

          <Link
            href="/student/payments"
            className="btn btn-secondary"
          >
            Payment History
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
              My Courses
            </h2>

            <p>
              Courses you have enrolled in.
            </p>
          </div>
        </div>

        {enrollments.length === 0 ? (
          <div className="admin-empty">
            <h3>
              No courses yet
            </h3>

            <p>
              Browse the course catalog and
              enroll in a course to start learning.
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
                {enrollments.map(
                  (enrollment) => {
                    const course =
                      courseMap.get(
                        enrollment.course_id
                      );

                    if (!course) {
                      return null;
                    }

                    const isCompleted =
                      enrollment.status ===
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
                              isCompleted
                                ? "rn-payment-status rn-payment-status-successful"
                                : "rn-payment-status rn-payment-status-pending"
                            }
                          >
                            {isCompleted
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
                            View Course
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

      <section className="admin-card">
        <div className="admin-card-header">
          <div>
            <h2>
              Student Tools
            </h2>

            <p>
              Access the learning tools available
              to your account.
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