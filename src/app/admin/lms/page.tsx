import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminLmsEditor from "./AdminLmsEditor";

type AdminLmsPageProps = {
  searchParams: Promise<{
    view?: string;
  }>;
};

type Profile = {
  role: "admin" | "instructor" | "student";
  full_name: string | null;
  email: string | null;
};

type Student = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
};

type Enrollment = {
  id: string;
  student_id: string;
  course_id: string;
  payment_status: string;
  enrollment_status: string;
  progress_percent: number;
  enrolled_at: string;
};

type StudentLookup = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type CourseLookup = {
  id: string;
  title: string;
};

export default async function AdminLmsPage({
  searchParams,
}: AdminLmsPageProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/lms");
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role, full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const profile =
    profileData as unknown as Profile | null;

  if (
    !profile ||
    (profile.role !== "admin" &&
      profile.role !== "instructor")
  ) {
    redirect("/student/dashboard");
  }

  const params = await searchParams;
  const view = params.view || "courses";

  const { data: courses } = await supabase
    .from("courses")
    .select("*")
    .order("created_at", {
      ascending: false,
    });

  const { count: studentCount } =
    await supabase
      .from("profiles")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("role", "student");

  const { count: enrollCount } =
    await supabase
      .from("enrollments")
      .select("*", {
        count: "exact",
        head: true,
      });

  /*
   * Project / capstone statistics.
   *
   * course_projects is readable to published projects,
   * instructors managing their own courses, and admins.
   */
  const { count: projectCount } =
    await supabase
      .from("course_projects")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("is_published", true);

  const { count: pendingProjectCount } =
    await supabase
      .from("project_submissions")
      .select("*", {
        count: "exact",
        head: true,
      })
      .in("status", [
        "submitted",
        "under_review",
      ]);

  let students: Student[] = [];

  let enrollments: Enrollment[] = [];

  if (
    profile.role === "admin" &&
    view === "students"
  ) {
    const { data } = await supabase
      .from("profiles")
      .select(
        "id, full_name, email, phone, created_at"
      )
      .eq("role", "student")
      .order("created_at", {
        ascending: false,
      });

    students =
      (data as unknown as Student[]) || [];
  }

  if (
    profile.role === "admin" &&
    view === "enrollments"
  ) {
    const { data } = await supabase
      .from("enrollments")
      .select(
        "id, student_id, course_id, payment_status, enrollment_status, progress_percent, enrolled_at"
      )
      .order("enrolled_at", {
        ascending: false,
      });

    enrollments =
      (data as unknown as Enrollment[]) ||
      [];
  }

  const studentIds = [
    ...new Set(
      enrollments.map(
        (item) => item.student_id
      )
    ),
  ];

  const courseIds = [
    ...new Set(
      enrollments.map(
        (item) => item.course_id
      )
    ),
  ];

  const {
    data: enrollmentStudents,
  } =
    profile.role === "admin" &&
    view === "enrollments" &&
    studentIds.length > 0
      ? await supabase
          .from("profiles")
          .select(
            "id, full_name, email"
          )
          .in("id", studentIds)
      : { data: [] };

  const {
    data: enrollmentCourses,
  } =
    profile.role === "admin" &&
    view === "enrollments" &&
    courseIds.length > 0
      ? await supabase
          .from("courses")
          .select("id, title")
          .in("id", courseIds)
      : { data: [] };

  const studentMap = new Map(
    (
      (enrollmentStudents ||
        []) as unknown as StudentLookup[]
    ).map((student) => [
      student.id,
      student,
    ])
  );

  const courseMap = new Map(
    (
      (enrollmentCourses ||
        []) as unknown as CourseLookup[]
    ).map((course) => [
      course.id,
      course,
    ])
  );

  return (
    <section className="section">
      <div className="container">
        <div className="rn-admin-heading">
          <div>
            <div className="rn-brand-kicker">
              RuffNeck Learn
            </div>

            <h2>LMS Admin</h2>

            <p className="muted">
              Signed in as {profile.email} (
              {profile.role}).
            </p>
          </div>

          <div
            className="rn-admin-heading-actions"
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <Link
              href="/admin/projects"
              className="btn btn-primary"
            >
              Projects & Capstones
              {pendingProjectCount &&
              pendingProjectCount > 0
                ? ` (${pendingProjectCount})`
                : ""}
            </Link>
          </div>
        </div>

        <div className="rn-admin-stats">
          <Link
            href="/admin/lms?view=courses"
            className={`rn-admin-stat ${
              view === "courses"
                ? "active"
                : ""
            }`}
          >
            <span className="rn-admin-stat-icon">
              ▦
            </span>

            <span>
              <span className="muted">
                Courses
              </span>

              <strong>
                {courses?.length ?? 0}
              </strong>
            </span>
          </Link>

          {profile.role === "admin" ? (
            <Link
              href="/admin/lms?view=students"
              className={`rn-admin-stat ${
                view === "students"
                  ? "active"
                  : ""
              }`}
            >
              <span className="rn-admin-stat-icon">
                ◉
              </span>

              <span>
                <span className="muted">
                  Students
                </span>

                <strong>
                  {studentCount ?? 0}
                </strong>
              </span>
            </Link>
          ) : (
            <div className="rn-admin-stat">
              <span className="rn-admin-stat-icon">
                ◉
              </span>

              <span>
                <span className="muted">
                  Students
                </span>

                <strong>
                  {studentCount ?? 0}
                </strong>
              </span>
            </div>
          )}

          {profile.role === "admin" ? (
            <Link
              href="/admin/lms?view=enrollments"
              className={`rn-admin-stat ${
                view === "enrollments"
                  ? "active"
                  : ""
              }`}
            >
              <span className="rn-admin-stat-icon">
                ✓
              </span>

              <span>
                <span className="muted">
                  Enrollments
                </span>

                <strong>
                  {enrollCount ?? 0}
                </strong>
              </span>
            </Link>
          ) : (
            <div className="rn-admin-stat">
              <span className="rn-admin-stat-icon">
                ✓
              </span>

              <span>
                <span className="muted">
                  Enrollments
                </span>

                <strong>
                  {enrollCount ?? 0}
                </strong>
              </span>
            </div>
          )}

          <Link
            href="/admin/projects"
            className="rn-admin-stat"
          >
            <span className="rn-admin-stat-icon">
              ◆
            </span>

            <span>
              <span className="muted">
                Capstones
              </span>

              <strong>
                {projectCount ?? 0}
              </strong>

              <small
                style={{
                  display: "block",
                  marginTop: 3,
                  fontSize: "0.72rem",
                }}
              >
                {pendingProjectCount ?? 0}{" "}
                awaiting review
              </small>
            </span>
          </Link>
        </div>

        {view === "students" &&
        profile.role === "admin" ? (
          <section className="rn-admin-list-panel">
            <div className="rn-admin-list-header">
              <div>
                <div className="rn-brand-kicker">
                  User management
                </div>

                <h3>Students</h3>

                <p className="muted">
                  Registered student accounts on
                  RuffNeck Learn.
                </p>
              </div>

              <Link
                href="/admin/lms?view=courses"
                className="btn btn-ghost"
              >
                ← Back to courses
              </Link>
            </div>

            {students.length === 0 ? (
              <div className="rn-empty-state">
                <div className="rn-empty-icon">
                  ◉
                </div>

                <strong>
                  No students yet
                </strong>

                <p>
                  New student registrations
                  will appear here.
                </p>
              </div>
            ) : (
              <div className="rn-table-wrap">
                <table className="rn-admin-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>
                        Registered
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {students.map(
                      (student) => (
                        <tr
                          key={student.id}
                        >
                          <td>
                            <strong>
                              {student.full_name ||
                                "Unnamed student"}
                            </strong>
                          </td>

                          <td>
                            {student.email ||
                              "—"}
                          </td>

                          <td>
                            {student.phone ||
                              "—"}
                          </td>

                          <td>
                            {new Date(
                              student.created_at
                            ).toLocaleDateString(
                              "en-NG",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              }
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}

        {view === "enrollments" &&
        profile.role === "admin" ? (
          <section className="rn-admin-list-panel">
            <div className="rn-admin-list-header">
              <div>
                <div className="rn-brand-kicker">
                  Learning activity
                </div>

                <h3>Enrollments</h3>

                <p className="muted">
                  Student course enrollments,
                  payment status, and progress.
                </p>
              </div>

              <Link
                href="/admin/lms?view=courses"
                className="btn btn-ghost"
              >
                ← Back to courses
              </Link>
            </div>

            {enrollments.length ===
            0 ? (
              <div className="rn-empty-state">
                <div className="rn-empty-icon">
                  ✓
                </div>

                <strong>
                  No enrollments yet
                </strong>

                <p>
                  Student course enrollments
                  will appear here.
                </p>
              </div>
            ) : (
              <div className="rn-table-wrap">
                <table className="rn-admin-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Course</th>
                      <th>Payment</th>
                      <th>Status</th>
                      <th>Progress</th>
                      <th>Enrolled</th>
                    </tr>
                  </thead>

                  <tbody>
                    {enrollments.map(
                      (enrollment) => {
                        const student =
                          studentMap.get(
                            enrollment.student_id
                          );

                        const course =
                          courseMap.get(
                            enrollment.course_id
                          );

                        return (
                          <tr
                            key={
                              enrollment.id
                            }
                          >
                            <td>
                              <strong>
                                {student?.full_name ||
                                  "Unnamed student"}
                              </strong>

                              {student?.email ? (
                                <span className="rn-table-subtext">
                                  {
                                    student.email
                                  }
                                </span>
                              ) : null}
                            </td>

                            <td>
                              {course?.title ||
                                "Unknown course"}
                            </td>

                            <td>
                              <span className="rn-status-pill">
                                {
                                  enrollment.payment_status
                                }
                              </span>
                            </td>

                            <td>
                              <span className="rn-status-pill">
                                {
                                  enrollment.enrollment_status
                                }
                              </span>
                            </td>

                            <td>
                              <div className="rn-progress-cell">
                                <div className="rn-progress-track">
                                  <span
                                    style={{
                                      width: `${Math.min(
                                        100,
                                        Math.max(
                                          0,
                                          enrollment.progress_percent
                                        )
                                      )}%`,
                                    }}
                                  />
                                </div>

                                <span>
                                  {
                                    enrollment.progress_percent
                                  }
                                  %
                                </span>
                              </div>
                            </td>

                            <td>
                              {new Date(
                                enrollment.enrolled_at
                              ).toLocaleDateString(
                                "en-NG",
                                {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                }
                              )}
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
        ) : null}

        {view === "courses" ? (
          <AdminLmsEditor
            initialCourses={
              courses ?? []
            }
            userId={user.id}
            role={profile.role}
          />
        ) : null}
      </div>
    </section>
  );
}