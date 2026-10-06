import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CertificateIssueButton from "@/components/CertificateIssueButton";

type Enrollment = {
  id: string;
  course_id: string;
  enrollment_status: string;
  payment_status: string | null;
  progress_percent: number | null;
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
  lesson_id: string;
  course_id: string;
  section_id: string | null;
  section_title: string | null;
  section_sort: number | null;
  lesson_title: string;
  lesson_slug: string;
  lesson_sort: number | null;
  duration_minutes: number | null;
  duration_seconds: number | null;
  is_preview: boolean;
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
  course_id: string;
  score: number | null;
  total_points: number | null;
  earned_points: number | null;
  total_questions: number | null;
  time_spent_seconds: number | null;
  completed_at: string | null;
};

type CourseAssessment = {
  status: "not_started" | "completed";
  attempt_id: string | null;
  score: number | null;
  total_questions: number | null;
  completed_at: string | null;
  percentage: number | null;
};

type Certificate = {
  id: string;
  student_id: string;
  course_id: string;
  certificate_number: string;
  is_revoked: boolean;
};

type CourseCertificate = {
  status: "not_issued" | "valid" | "revoked";
  certificate_id: string | null;
  certificate_number: string | null;
};

type CourseProject = {
  id: string;
  course_id: string;
  project_type: string | null;
  is_published: boolean;
};

type ProjectSubmission = {
  id: string;
  project_id: string;
  student_id: string;
  status: string;
  score: number | null;
};

type CourseCapstone = {
  has_capstone: boolean;
  approved_submission: boolean;
};

type CertificateEligibility = {
  eligible: boolean;
  lessons_complete: boolean;
  assessment_complete: boolean;
  assessment_passed: boolean;
  capstone_available: boolean;
  capstone_approved: boolean;
};

export default async function StudentCoursesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/student/courses");
  }

  const {
    data: enrollmentData,
    error: enrollmentError,
  } = await supabase
    .from("enrollments")
    .select(
      "id, course_id, enrollment_status, payment_status, progress_percent",
    )
    .eq("student_id", user.id)
    .in("enrollment_status", ["active", "completed"]);

  if (enrollmentError) {
    console.error(
      "Student courses: enrollment query failed:",
      enrollmentError,
    );

    const {
      data: fallbackEnrollmentData,
      error: fallbackEnrollmentError,
    } = await supabase
      .from("enrollments")
      .select("id, course_id, enrollment_status")
      .eq("student_id", user.id)
      .in("enrollment_status", ["active", "completed"]);

    if (fallbackEnrollmentError) {
      console.error(
        "Student courses: enrollment fallback failed:",
        fallbackEnrollmentError,
      );

      return (
        <main className="container rn-dashboard-shell">
          <section className="rn-dashboard-header">
            <div>
              <span className="rn-eyebrow">
                RUFFNECK LEARN
              </span>

              <h1>My Courses</h1>

              <p className="rn-dashboard-intro">
                Your learning dashboard could not retrieve your
                enrollment information.
              </p>
            </div>
          </section>

          <section className="rn-dashboard-card">
            <span className="rn-eyebrow">
              TEMPORARILY UNAVAILABLE
            </span>

            <h2>Learning data unavailable</h2>

            <p className="rn-dashboard-card-text">
              Your account is still intact. Your enrolled courses
              could not be loaded at this time.
            </p>

            <div className="rn-dashboard-inline-actions">
              <Link
                href="/courses"
                className="rn-button rn-button-primary"
              >
                Browse Courses
              </Link>
            </div>
          </section>
        </main>
      );
    }

    const fallbackEnrollments =
      (fallbackEnrollmentData ?? []) as unknown as Array<{
        id: string;
        course_id: string;
        enrollment_status: string;
      }>;

    const normalizedFallbackEnrollments: Enrollment[] =
      fallbackEnrollments.map((row) => ({
        id: row.id,
        course_id: row.course_id,
        enrollment_status: row.enrollment_status,
        payment_status: null,
        progress_percent: null,
      }));

    if (normalizedFallbackEnrollments.length === 0) {
      return <EmptyCoursesPage />;
    }

    return renderCoursesPage(
      supabase,
      user.id,
      normalizedFallbackEnrollments,
      true,
    );
  }

  const enrollments =
    (enrollmentData ?? []) as unknown as Enrollment[];

  if (enrollments.length === 0) {
    return <EmptyCoursesPage />;
  }

  return renderCoursesPage(
    supabase,
    user.id,
    enrollments,
    false,
  );
}

function EmptyCoursesPage() {
  return (
    <main className="container rn-dashboard-shell">
      <section className="rn-dashboard-header">
        <div>
          <span className="rn-eyebrow">
            RUFFNECK LEARN
          </span>

          <h1>My Courses</h1>

          <p className="rn-dashboard-intro">
            Your enrolled courses, progress, assessments and
            certificates will appear here.
          </p>
        </div>

        <div className="rn-dashboard-header-actions">
          <Link
            href="/courses"
            className="rn-button rn-button-primary"
          >
            Browse Courses
          </Link>
        </div>
      </section>

      <section className="rn-empty-state">
        <span className="rn-eyebrow">
          MY LEARNING
        </span>

        <h2>No courses yet</h2>

        <p>
          You are not currently enrolled in any published
          courses. Explore the RuffNeck Learn catalogue to
          get started.
        </p>

        <Link
          href="/courses"
          className="rn-button rn-button-primary"
        >
          Explore Courses
        </Link>
      </section>
    </main>
  );
}

async function renderCoursesPage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  enrollments: Enrollment[],
  usedEnrollmentFallback: boolean,
) {
  const courseIds = Array.from(
    new Set(
      enrollments.map(
        (enrollment) => enrollment.course_id,
      ),
    ),
  );

  const [
    courseResult,
    curriculumResult,
    progressResult,
    assessmentResult,
    certificateResult,
    projectResult,
  ] = await Promise.all([
    supabase
      .from("courses")
      .select(
        "id, title, slug, short_description, level, duration_minutes",
      )
      .in("id", courseIds),

    supabase
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
        ].join(", "),
      )
      .in("course_id", courseIds)
      .eq("is_published", true)
      .order("section_sort", {
        ascending: true,
      })
      .order("lesson_sort", {
        ascending: true,
      }),

    supabase
      .from("lesson_progress")
      .select(
        "student_id, lesson_id, course_id, completed",
      )
      .eq("student_id", userId)
      .in("course_id", courseIds),

    supabase
      .from("assessment_attempts")
      .select(
        [
          "id",
          "course_id",
          "score",
          "total_points",
          "earned_points",
          "total_questions",
          "time_spent_seconds",
          "completed_at",
        ].join(", "),
      )
      .eq("student_id", userId)
      .in("course_id", courseIds)
      .not("completed_at", "is", null)
      .order("completed_at", {
        ascending: false,
      }),

    supabase
      .from("course_certificates")
      .select(
        "id, student_id, course_id, certificate_number, is_revoked",
      )
      .eq("student_id", userId)
      .in("course_id", courseIds),

    supabase
      .from("course_projects")
      .select(
        "id, course_id, project_type, is_published",
      )
      .in("course_id", courseIds)
      .eq("project_type", "capstone")
      .eq("is_published", true),
  ]);

  const dataWarnings: string[] = [];

  if (courseResult.error) {
    console.error(
      "Student courses: courses query failed:",
      courseResult.error,
    );
    dataWarnings.push("course information");
  }

  if (curriculumResult.error) {
    console.error(
      "Student courses: curriculum query failed:",
      curriculumResult.error,
    );
    dataWarnings.push("lesson curriculum");
  }

  if (progressResult.error) {
    console.error(
      "Student courses: lesson progress query failed:",
      progressResult.error,
    );
    dataWarnings.push("lesson progress");
  }

  if (assessmentResult.error) {
    console.error(
      "Student courses: assessment query failed:",
      assessmentResult.error,
    );
    dataWarnings.push("assessment history");
  }

  if (certificateResult.error) {
    console.error(
      "Student courses: certificate query failed:",
      certificateResult.error,
    );
    dataWarnings.push("certificate information");
  }

  if (projectResult.error) {
    console.error(
      "Student courses: project query failed:",
      projectResult.error,
    );
    dataWarnings.push("capstone information");
  }

  const courses =
    (courseResult.data ?? []) as unknown as Course[];

  const curriculum =
    (curriculumResult.data ?? []) as unknown as CurriculumLesson[];

  const lessonProgress =
    (progressResult.data ?? []) as unknown as LessonProgress[];

  const assessmentAttempts =
    (assessmentResult.data ?? []) as unknown as AssessmentAttempt[];

  const certificates =
    (certificateResult.data ?? []) as unknown as Certificate[];

  const capstoneProjects =
    (projectResult.data ?? []) as unknown as CourseProject[];

  if (courseResult.error) {
    return (
      <main className="container rn-dashboard-shell">
        <section className="rn-dashboard-header">
          <div>
            <span className="rn-eyebrow">
              RUFFNECK LEARN
            </span>

            <h1>My Courses</h1>

            <p className="rn-dashboard-intro">
              Track your lessons, resume learning, monitor
              assessments and manage your certificates.
            </p>
          </div>
        </section>

        <section className="rn-dashboard-card">
          <span className="rn-eyebrow">
            COURSE DATA
          </span>

          <h2>Course information unavailable</h2>

          <p className="rn-dashboard-card-text">
            Your enrollment was found, but the course catalogue
            could not be loaded at this time.
          </p>

          <div className="rn-dashboard-inline-actions">
            <Link
              href="/courses"
              className="rn-button rn-button-primary"
            >
              Browse Courses
            </Link>

            <Link
              href="/"
              className="rn-button rn-button-secondary"
            >
              Back to Home
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const capstoneProjectIds =
    capstoneProjects.map(
      (project) => project.id,
    );

  let submissionData: ProjectSubmission[] = [];

  if (capstoneProjectIds.length > 0) {
    const {
      data,
      error,
    } = await supabase
      .from("project_submissions")
      .select(
        "id, project_id, student_id, status, score",
      )
      .eq("student_id", userId)
      .in("project_id", capstoneProjectIds);

    if (error) {
      console.error(
        "Student courses: project submissions query failed:",
        error,
      );

      dataWarnings.push(
        "capstone submission status",
      );
    } else {
      submissionData =
        (data ?? []) as unknown as ProjectSubmission[];
    }
  }

  const courseMap = new Map(
    courses.map((course) => [
      course.id,
      course,
    ]),
  );

  const lessonsByCourse = new Map<
    string,
    CurriculumLesson[]
  >();

  for (const lesson of curriculum) {
    const existing =
      lessonsByCourse.get(
        lesson.course_id,
      ) ?? [];

    existing.push(lesson);

    lessonsByCourse.set(
      lesson.course_id,
      existing,
    );
  }

  const completedLessonIds = new Set(
    lessonProgress
      .filter(
        (progress) => progress.completed,
      )
      .map(
        (progress) => progress.lesson_id,
      ),
  );

  const assessmentByCourse =
    new Map<string, CourseAssessment>();

  for (const attempt of assessmentAttempts) {
    if (
      assessmentByCourse.has(
        attempt.course_id,
      )
    ) {
      continue;
    }

    let percentage: number | null = null;

    if (
      typeof attempt.earned_points === "number" &&
      typeof attempt.total_points === "number" &&
      attempt.total_points > 0
    ) {
      percentage =
        (attempt.earned_points /
          attempt.total_points) *
        100;
    } else if (
      typeof attempt.score === "number"
    ) {
      percentage = Number(
        attempt.score,
      );
    }

    assessmentByCourse.set(
      attempt.course_id,
      {
        status: "completed",
        attempt_id: attempt.id,
        score:
          typeof attempt.score === "number"
            ? attempt.score
            : null,
        total_questions:
          typeof attempt.total_questions ===
          "number"
            ? attempt.total_questions
            : null,
        completed_at:
          attempt.completed_at,
        percentage:
          percentage !== null
            ? Math.round(percentage)
            : null,
      },
    );
  }

  const capstoneByCourse =
    new Map<string, CourseCapstone>();

  for (const project of capstoneProjects) {
    const existing =
      capstoneByCourse.get(
        project.course_id,
      ) ?? {
        has_capstone: false,
        approved_submission: false,
      };

    existing.has_capstone = true;

    const approvedSubmission =
      submissionData.some(
        (submission) =>
          submission.project_id ===
            project.id &&
          submission.status ===
            "approved",
      );

    if (approvedSubmission) {
      existing.approved_submission = true;
    }

    capstoneByCourse.set(
      project.course_id,
      existing,
    );
  }

  const certificateByCourse =
    new Map<string, CourseCertificate>();

  for (const certificate of certificates) {
    certificateByCourse.set(
      certificate.course_id,
      {
        status: certificate.is_revoked
          ? "revoked"
          : "valid",
        certificate_id:
          certificate.id,
        certificate_number:
          certificate.certificate_number,
      },
    );
  }

  const courseRows = enrollments
    .map((enrollment) => {
      const course = courseMap.get(
        enrollment.course_id,
      );

      if (!course) {
        return null;
      }

      const lessons =
        lessonsByCourse.get(
          course.id,
        ) ?? [];

      const completedCount =
        lessons.filter((lesson) =>
          completedLessonIds.has(
            lesson.lesson_id,
          ),
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
                100,
            )
          : Number(
              enrollment.progress_percent ??
                0,
            );

      const nextLesson =
        lessons.find(
          (lesson) =>
            !completedLessonIds.has(
              lesson.lesson_id,
            ),
        ) ?? null;

      const assessment =
        assessmentByCourse.get(
          course.id,
        ) ?? {
          status: "not_started" as const,
          attempt_id: null,
          score: null,
          total_questions: null,
          completed_at: null,
          percentage: null,
        };

      const certificate =
        certificateByCourse.get(
          course.id,
        ) ?? {
          status: "not_issued" as const,
          certificate_id: null,
          certificate_number: null,
        };

      const capstone =
        capstoneByCourse.get(
          course.id,
        ) ?? {
          has_capstone: false,
          approved_submission: false,
        };

      const assessmentPassed =
        assessment.percentage !== null &&
        assessment.percentage >= 70;

      const certificateEligibility: CertificateEligibility =
        {
          eligible:
            allLessonsCompleted &&
            assessment.status ===
              "completed" &&
            assessmentPassed &&
            capstone.has_capstone &&
            capstone.approved_submission,

          lessons_complete:
            allLessonsCompleted,

          assessment_complete:
            assessment.status ===
            "completed",

          assessment_passed:
            assessmentPassed,

          capstone_available:
            capstone.has_capstone,

          capstone_approved:
            capstone.approved_submission,
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
          Math.max(0, lessonPercent),
        ),
        nextLesson,
        assessment,
        certificate,
        capstone,
        certificateEligibility,
      };
    })
    .filter(
      (
        row,
      ): row is NonNullable<typeof row> =>
        row !== null,
    );

  const activeCourses =
    courseRows.filter(
      (row) =>
        row.enrollment
          .enrollment_status ===
        "active",
    );

  const completedCourses =
    courseRows.filter(
      (row) =>
        row.enrollment
          .enrollment_status ===
          "completed" ||
        row.allLessonsCompleted,
    );

  return (
    <main className="container rn-dashboard-shell">
      <section className="rn-dashboard-header">
        <div>
          <span className="rn-eyebrow">
            RUFFNECK LEARN
          </span>

          <h1>My Courses</h1>

          <p className="rn-dashboard-intro">
            Track your lessons, resume learning, monitor
            assessments and manage your certificates.
          </p>
        </div>

        <div className="rn-dashboard-header-actions">
          <Link
            href="/courses"
            className="rn-button rn-button-primary"
          >
            Browse Courses
          </Link>

          <Link
            href="/student/certificates"
            className="rn-button rn-button-secondary"
          >
            Certificates
          </Link>
        </div>
      </section>

      {dataWarnings.length > 0 ? (
        <section className="rn-dashboard-card rn-dashboard-notice">
          <span className="rn-eyebrow">
            PARTIAL DATA
          </span>

          <h2>
            Some learning information could not be loaded
          </h2>

          <p className="rn-dashboard-card-text">
            Your courses remain available. Some secondary
            learning information may temporarily be unavailable.
          </p>
        </section>
      ) : null}

      {usedEnrollmentFallback ? (
        <section className="rn-dashboard-card rn-dashboard-notice">
          <p className="rn-dashboard-card-text">
            Your enrolled courses were loaded using a
            compatibility fallback.
          </p>
        </section>
      ) : null}

      <section className="rn-dashboard-stats">
        <article className="rn-dashboard-stat">
          <span className="rn-dashboard-stat-label">
            Enrolled
          </span>

          <strong>
            {courseRows.length}
          </strong>

          <small>
            Courses
          </small>
        </article>

        <article className="rn-dashboard-stat">
          <span className="rn-dashboard-stat-label">
            Active
          </span>

          <strong>
            {activeCourses.length}
          </strong>

          <small>
            Courses in progress
          </small>
        </article>

        <article className="rn-dashboard-stat">
          <span className="rn-dashboard-stat-label">
            Completed
          </span>

          <strong>
            {completedCourses.length}
          </strong>

          <small>
            Courses completed
          </small>
        </article>

        <article className="rn-dashboard-stat">
          <span className="rn-dashboard-stat-label">
            Lessons
          </span>

          <strong>
            {courseRows.reduce(
              (total, row) =>
                total + row.completedCount,
              0,
            )}
          </strong>

          <small>
            Completed lessons
          </small>
        </article>
      </section>

      <section className="rn-dashboard-section">
        <div className="rn-dashboard-section-header">
          <div>
            <span className="rn-eyebrow">
              MY LEARNING
            </span>

            <h2>Enrolled Courses</h2>

            <p>
              Continue your courses and track your progress.
            </p>
          </div>

          <Link
            href="/courses"
            className="rn-text-link"
          >
            Browse all courses
          </Link>
        </div>

        <div className="rn-course-grid">
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
              certificate,
              certificateEligibility,
            } = row;

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

            const assessmentHref =
              `/student/assessment?course=${encodeURIComponent(
                course.slug,
              )}`;

            const resultHref =
              assessment.attempt_id
                ? `/student/assessment/results/${encodeURIComponent(
                    assessment.attempt_id,
                  )}`
                : null;

            const certificateHref =
              certificate.certificate_id
                ? `/student/certificates/${encodeURIComponent(
                    certificate.certificate_id,
                  )}`
                : null;

            return (
              <article
                key={enrollment.id}
                className="rn-course-card"
              >
                <div className="rn-course-card-body">
                  <div className="rn-course-card-meta">
                    <span>
                      {course.level || "Professional"}
                    </span>

                    <span>
                      {enrollment.enrollment_status}
                    </span>

                    {course.duration_minutes ? (
                      <span>
                        {course.duration_minutes} min
                      </span>
                    ) : null}
                  </div>

                  <h3>
                    {course.title}
                  </h3>

                  {course.short_description ? (
                    <p>
                      {course.short_description}
                    </p>
                  ) : (
                    <p>
                      Continue learning and build practical
                      professional skills.
                    </p>
                  )}

                  <div className="rn-progress-block">
                    <div className="rn-progress-header">
                      <span>
                        Lesson Progress
                      </span>

                      <strong>
                        {lessonPercent}%
                      </strong>
                    </div>

                    <div className="rn-progress-track">
                      <div
                        className="rn-progress-fill"
                        style={{
                          width: `${lessonPercent}%`,
                        }}
                      />
                    </div>

                    <small>
                      {completedCount} of{" "}
                      {totalLessons} lessons completed
                    </small>
                  </div>

                  <div className="rn-course-card-details">
                    <div>
                      <span className="rn-eyebrow">
                        ASSESSMENT
                      </span>

                      <strong>
                        {assessment.status ===
                        "completed"
                          ? assessment.percentage !== null
                            ? `${assessment.percentage}%`
                            : "Completed"
                          : "Not started"}
                      </strong>
                    </div>

                    <div>
                      <span className="rn-eyebrow">
                        CERTIFICATE
                      </span>

                      <strong>
                        {certificate.status ===
                        "valid"
                          ? "Issued"
                          : certificateEligibility.eligible
                            ? "Ready"
                            : "In progress"}
                      </strong>
                    </div>
                  </div>

                  <div className="rn-course-card-footer">
                    <span>
                      {allLessonsCompleted
                        ? "Course complete"
                        : nextLesson
                          ? `Next: ${nextLesson.lesson_title}`
                          : "Continue learning"}
                    </span>

                    <Link
                      href={primaryHref}
                      className="rn-button rn-button-primary"
                    >
                      {primaryLabel}
                    </Link>
                  </div>
                </div>

                <div className="rn-course-card-actions">
                  <Link
                    href={assessmentHref}
                    className="rn-button rn-button-secondary"
                  >
                    {assessment.status ===
                    "completed"
                      ? "Retake Assessment"
                      : "Start Assessment"}
                  </Link>

                  {resultHref ? (
                    <Link
                      href={resultHref}
                      className="rn-button rn-button-secondary"
                    >
                      Latest Result
                    </Link>
                  ) : null}

                  {certificateHref ? (
                    <Link
                      href={certificateHref}
                      className="rn-button rn-button-secondary"
                    >
                      {certificate.status ===
                      "revoked"
                        ? "Revoked Certificate"
                        : "View Certificate"}
                    </Link>
                  ) : certificateEligibility.eligible ? (
                    <CertificateIssueButton
                      courseId={course.id}
                    />
                  ) : null}
                </div>

                {!certificateEligibility.eligible &&
                certificate.status ===
                  "not_issued" ? (
                  <div className="rn-course-requirements">
                    <span className="rn-eyebrow">
                      CERTIFICATE REQUIREMENTS
                    </span>

                    <div>
                      <span
                        className={
                          certificateEligibility.lessons_complete
                            ? "is-complete"
                            : ""
                        }
                      >
                        {certificateEligibility.lessons_complete
                          ? "✓"
                          : "○"}{" "}
                        Complete all published lessons
                      </span>

                      <span
                        className={
                          certificateEligibility.assessment_passed
                            ? "is-complete"
                            : ""
                        }
                      >
                        {certificateEligibility.assessment_passed
                          ? "✓"
                          : "○"}{" "}
                        Pass the assessment with at least 70%
                      </span>

                      <span
                        className={
                          certificateEligibility.capstone_approved
                            ? "is-complete"
                            : ""
                        }
                      >
                        {certificateEligibility.capstone_approved
                          ? "✓"
                          : "○"}{" "}
                        Receive capstone approval
                      </span>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className="rn-dashboard-section">
        <div className="rn-dashboard-section-header">
          <div>
            <span className="rn-eyebrow">
              CONTINUE BUILDING
            </span>

            <h2>Continue Learning</h2>

            <p>
              Explore additional courses and practical learning
              pathways.
            </p>
          </div>
        </div>

        <div className="rn-dashboard-actions-grid">
          <Link
            href="/courses"
            className="rn-dashboard-action"
          >
            <strong>
              Browse Courses
            </strong>

            <span>
              Explore practical AI, data, digital marketing,
              productivity and professional skills courses.
            </span>
          </Link>

          <Link
            href="/student/projects"
            className="rn-dashboard-action"
          >
            <strong>
              Projects & Capstones
            </strong>

            <span>
              Complete practical work and track project reviews.
            </span>
          </Link>

          <Link
            href="/student/skills"
            className="rn-dashboard-action"
          >
            <strong>
              Skill Passport
            </strong>

            <span>
              Review your measured skills, strengths and
              development areas.
            </span>
          </Link>

          <Link
            href="/student/certificates"
            className="rn-dashboard-action"
          >
            <strong>
              Certificates
            </strong>

            <span>
              View your RuffNeck Learn course credentials.
            </span>
          </Link>
        </div>
      </section>
    </main>
  );
}