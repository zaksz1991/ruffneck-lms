import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminLmsEditor, {
  type Course,
} from "./AdminLmsEditor";

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

  const { data: profileData, error: profileError } =
    await supabase
      .from("profiles")
      .select("role, full_name, email")
      .eq("id", user.id)
      .maybeSingle();

  if (profileError) {
    console.error(
      "Admin LMS profile lookup failed:",
      profileError
    );

    throw new Error(
      "Unable to verify admin access."
    );
  }

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

  const requestedView =
    params.view || "courses";

  const view =
    requestedView === "students" ||
    requestedView === "enrollments" ||
    requestedView === "courses"
      ? requestedView
      : "courses";

  /*
   * Admins can manage all courses.
   * Instructors can manage only courses assigned to them.
   *
   * The same ownership boundary used by the hardened
   * project-review API is applied here.
   */
  let coursesQuery = supabase
    .from("courses")
    .select("*")
    .order("created_at", {
      ascending: false,
    });

  if (profile.role === "instructor") {
    coursesQuery = coursesQuery.eq(
      "instructor_id",
      user.id
    );
  }

  const {
    data: courseData,
    error: courseError,
  } = await coursesQuery;

  if (courseError) {
    console.error(
      "Admin LMS course lookup failed:",
      courseError
    );

    throw new Error(
      "Unable to load courses."
    );
  }

  /*
   * AdminLmsEditor owns the canonical Course type.
   * The explicit unknown bridge protects this server
   * component from Supabase's inferred response type
   * while preserving the editor's full Course shape.
   */
  const courses =
    (courseData ?? []) as unknown as Course[];

  const courseIds = courses.map(
    (course) => course.id
  );

  /*
   * Student and enrollment counts remain global
   * only for admins. Instructors receive counts
   * scoped to their assigned courses.
   */
  const studentCountResult =
    await supabase
      .from("profiles")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("role", "student");

  const studentCount =
    studentCountResult.count ?? 0;

  let enrollCount = 0;

  if (profile.role === "admin") {
    const result =
      await supabase
        .from("enrollments")
        .select("*", {
          count: "exact",
          head: true,
        });

    enrollCount = result.count ?? 0;
  } else if (courseIds.length > 0) {
    const result =
      await supabase
        .from("enrollments")
        .select("*", {
          count: "exact",
          head: true,
        })
        .in("course_id", courseIds);

    enrollCount = result.count ?? 0;
  }

  /*
   * Only published projects belonging to courses
   * the current user can manage are counted.
   */
  let projectCount = 0;
  let pendingProjectCount = 0;

  if (courseIds.length > 0) {
    const {
      data: projectData,
      error: projectError,
    } = await supabase
      .from("course_projects")
      .select("id, course_id")
      .in("course_id", courseIds)
      .eq("is_published", true);

    if (projectError) {
      console.error(
        "Admin LMS project lookup failed:",
        projectError
      );

      throw new Error(
        "Unable to load project statistics."
      );
    }

    const projects =
      (projectData as unknown as {
        id: string;
        course_id: string;
      }[]) || [];

    projectCount = projects.length;

    const projectIds = projects.map(
      (project) => project.id
    );

    if (projectIds.length > 0) {
      const {
        count,
        error: pendingError,
      } = await supabase
        .from("project_submissions")
        .select("*", {
          count: "exact",
          head: true,
        })
        .in("project_id", projectIds)
        .in("status", [
          "submitted",
          "under_review",
        ]);

      if (pendingError) {
        console.error(
          "Pending project count failed:",
          pendingError
        );
      }

      pendingProjectCount =
        count ?? 0;
    }
  }

  let students: Student[] = [];
  let enrollments: Enrollment[] = [];

  if (
    profile.role === "admin" &&
    view === "students"
  ) {
    const {
      data,
      error,
    } = await supabase
      .from("profiles")
      .select(
        "id, full_name, email, phone, created_at"
      )
      .eq("role", "student")
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(
        "Admin student lookup failed:",
        error
      );

      throw new Error(
        "Unable to load students."
      );
    }

    students =
      (data as unknown as Student[]) || [];
  }

  if (
    profile.role === "admin" &&
    view === "enrollments"
  ) {
    const {
      data,
      error,
    } = await supabase
      .from("enrollments")
      .select(
        "id, student_id, course_id, payment_status, enrollment_status, progress_percent, enrolled_at"
      )
      .order("enrolled_at", {
        ascending: false,
      });

    if (error) {
      console.error(
        "Admin enrollment lookup failed:",
        error
      );

      throw new Error(
        "Unable to load enrollments."
      );
    }

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

  const enrollmentCourseIds = [
    ...new Set(
      enrollments.map(
        (item) => item.course_id
      )
    ),
  ];

  const {
    data: enrollmentStudents,
    error: enrollmentStudentsError,
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
      : {
          data: [],
          error: null,
        };

  if (enrollmentStudentsError) {
    console.error(
      "Enrollment student lookup failed:",
      enrollmentStudentsError
    );

    throw new Error(
      "Unable to load enrollment students."
    );
  }

  const {
    data: enrollmentCourses,
    error: enrollmentCoursesError,
  } =
    profile.role === "admin" &&
    view === "enrollments" &&
    enrollmentCourseIds.length > 0
      ? await supabase
          .from("courses")
          .select("id, title")
          .in(
            "id",
            enrollmentCourseIds
          )
      : {
          data: [],
          error: null,
        };

  if (enrollmentCoursesError) {
    console.error(
      "Enrollment course lookup failed:",
      enrollmentCoursesError
    );

    throw new Error(
      "Unable to load enrollment courses."
    );
  }

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
              href="/admin/ai-drafts"
              className="btn btn-primary"
            >
              AI Drafts
            </Link>

            <Link
              href="/admin/projects"
              className="btn btn-primary"
            >
              Projects & Capstones
              {pendingProjectCount > 0
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
                {courses.length}
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
                  {studentCount}
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
                  {studentCount}
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
                  {enrollCount}
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
                  {enrollCount}
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
                {projectCount}
              </strong>

              <small
                style={{
                  display: "block",
                  marginTop: 3,
                  fontSize: "0.72rem",
                }}
              >
                {pendingProjectCount}{" "}
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

            {enrollments.length === 0 ? (
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
            initialCourses={courses}
            userId={user.id}
            role={profile.role}
          />
        ) : null}
      </div>
    </section>
  );
}