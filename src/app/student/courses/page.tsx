import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CertificateIssueButton from "@/components/CertificateIssueButton";

type Enrollment = {
  id: string;
  course_id: string;
  enrollment_status: string | null;
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

type LessonProgress = {
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
  completed_at: string | null;
};

type Certificate = {
  id: string;
  student_id: string;
  course_id: string;
  certificate_number: string;
  is_revoked: boolean;
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

type CourseRow = {
  enrollment: Enrollment;
  course: Course;
  lessons: CurriculumLesson[];
  completedCount: number;
  totalLessons: number;
  progressPercent: number;
  nextLesson: CurriculumLesson | null;
  assessment: {
    completed: boolean;
    attemptId: string | null;
    percentage: number | null;
  };
  certificate: {
    status: "not_issued" | "valid" | "revoked";
    id: string | null;
    number: string | null;
  };
  capstone: {
    available: boolean;
    approved: boolean;
  };
};

function calculateAssessmentPercentage(
  attempt: AssessmentAttempt,
) {
  if (
    typeof attempt.earned_points === "number" &&
    typeof attempt.total_points === "number" &&
    attempt.total_points > 0
  ) {
    return Math.round(
      (attempt.earned_points / attempt.total_points) * 100,
    );
  }

  if (typeof attempt.score === "number") {
    return Math.round(attempt.score);
  }

  return null;
}

export default async function StudentCoursesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/student/courses");
  }

  /*
   * IMPORTANT:
   * Do not select created_at here.
   * The actual enrollment schema used by the course-detail
   * page contains the fields below.
   */
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

    return (
      <main className="container rn-student-courses-page">
        <section className="rn-student-page-header">
          <span className="rn-eyebrow">
            MY LEARNING
          </span>

          <h1>My Courses</h1>

          <p>
            Your enrolled courses could not be loaded
            because the enrollment data is temporarily
            unavailable.
          </p>
        </section>

        <section className="rn-student-message rn-student-message-error">
          <h2>Learning data unavailable</h2>

          <p>
            Your account has not been removed. The
            dashboard could not retrieve your current
            enrollment information.
          </p>

          <Link
            href="/courses"
            className="rn-button rn-button-primary"
          >
            Browse Courses
          </Link>
        </section>
      </main>
    );
  }

  const enrollments =
    (enrollmentData ?? []) as Enrollment[];

  if (enrollments.length === 0) {
    return (
      <main className="container rn-student-courses-page">
        <section className="rn-student-page-header">
          <span className="rn-eyebrow">
            MY LEARNING
          </span>

          <h1>My Courses</h1>

          <p>
            Track your lessons, assessments,
            practical work and certificates.
          </p>
        </section>

        <section className="rn-student-empty">
          <div className="rn-empty-icon">+</div>

          <h2>No courses yet</h2>

          <p>
            You are not currently enrolled in any
            courses.
          </p>

          <Link
            href="/courses"
            className="rn-button rn-button-primary"
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
        (enrollment) => enrollment.course_id,
      ),
    ),
  );

  const [
    coursesResult,
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

    /*
     * IMPORTANT:
     * These are the real course_curriculum columns used
     * elsewhere in RuffNeck Learn.
     */
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
      .order("section_sort")
      .order("lesson_sort"),

    supabase
      .from("lesson_progress")
      .select(
        "lesson_id, course_id, completed",
      )
      .eq("student_id", user.id)
      .in("course_id", courseIds),

    supabase
      .from("assessment_attempts")
      .select(
        "id, course_id, score, total_points, earned_points, total_questions, completed_at",
      )
      .eq("student_id", user.id)
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
      .eq("student_id", user.id)
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

  if (coursesResult.error) {
    console.error(
      "Student courses: courses query failed:",
      coursesResult.error,
    );
  }

  if (curriculumResult.error) {
    console.error(
      "Student courses: curriculum query failed:",
      curriculumResult.error,
    );
  }

  if (progressResult.error) {
    console.error(
      "Student courses: lesson progress query failed:",
      progressResult.error,
    );
  }

  if (assessmentResult.error) {
    console.error(
      "Student courses: assessment query failed:",
      assessmentResult.error,
    );
  }

  if (certificateResult.error) {
    console.error(
      "Student courses: certificate query failed:",
      certificateResult.error,
    );
  }

  if (projectResult.error) {
    console.error(
      "Student courses: project query failed:",
      projectResult.error,
    );
  }

  if (coursesResult.error) {
    return (
      <main className="container rn-student-courses-page">
        <section className="rn-student-page-header">
          <span className="rn-eyebrow">
            MY LEARNING
          </span>

          <h1>My Courses</h1>

          <p>
            Your enrollment exists, but course
            information could not be loaded.
          </p>
        </section>

        <section className="rn-student-message rn-student-message-error">
          <h2>Course information unavailable</h2>

          <p>
            Please return to the course catalogue.
          </p>

          <Link
            href="/courses"
            className="rn-button rn-button-primary"
          >
            Browse Courses
          </Link>
        </section>
      </main>
    );
  }

  const courses =
    (coursesResult.data ?? []) as Course[];

  const curriculum =
    (curriculumResult.data ??
      []) as CurriculumLesson[];

  const lessonProgress =
    (progressResult.data ??
      []) as LessonProgress[];

  const assessmentAttempts =
    (assessmentResult.data ??
      []) as AssessmentAttempt[];

  const certificates =
    (certificateResult.data ??
      []) as Certificate[];

  const capstoneProjects =
    (projectResult.data ??
      []) as CourseProject[];

  const capstoneProjectIds =
    capstoneProjects.map(
      (project) => project.id,
    );

  let submissions: ProjectSubmission[] =
    [];

  if (capstoneProjectIds.length > 0) {
    const {
      data,
      error,
    } = await supabase
      .from("project_submissions")
      .select(
        "id, project_id, student_id, status, score",
      )
      .eq("student_id", user.id)
      .in(
        "project_id",
        capstoneProjectIds,
      );

    if (error) {
      console.error(
        "Student courses: project submissions query failed:",
        error,
      );
    } else {
      submissions =
        (data ?? []) as ProjectSubmission[];
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

  const completedLessonIdsByCourse =
    new Map<string, Set<string>>();

  for (const progress of lessonProgress) {
    if (!progress.completed) {
      continue;
    }

    const existing =
      completedLessonIdsByCourse.get(
        progress.course_id,
      ) ?? new Set<string>();

    existing.add(progress.lesson_id);

    completedLessonIdsByCourse.set(
      progress.course_id,
      existing,
    );
  }

  const latestAssessmentByCourse =
    new Map<
      string,
      AssessmentAttempt
    >();

  for (const attempt of assessmentAttempts) {
    if (
      !latestAssessmentByCourse.has(
        attempt.course_id,
      )
    ) {
      latestAssessmentByCourse.set(
        attempt.course_id,
        attempt,
      );
    }
  }

  const certificateByCourse =
    new Map<string, Certificate>();

  for (const certificate of certificates) {
    certificateByCourse.set(
      certificate.course_id,
      certificate,
    );
  }

  const capstoneByCourse =
    new Map<string, CourseProject[]>();

  for (const project of capstoneProjects) {
    const existing =
      capstoneByCourse.get(
        project.course_id,
      ) ?? [];

    existing.push(project);

    capstoneByCourse.set(
      project.course_id,
      existing,
    );
  }

  const rows: CourseRow[] =
    enrollments
      .map((enrollment) => {
        const course =
          courseMap.get(
            enrollment.course_id,
          );

        if (!course) {
          return null;
        }

        const lessons =
          lessonsByCourse.get(
            course.id,
          ) ?? [];

        const completedIds =
          completedLessonIdsByCourse.get(
            course.id,
          ) ?? new Set<string>();

        const completedCount =
          lessons.filter((lesson) =>
            completedIds.has(
              lesson.lesson_id,
            ),
          ).length;

        const totalLessons =
          lessons.length;

        const calculatedProgress =
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

        const progressPercent =
          Math.min(
            100,
            Math.max(
              0,
              calculatedProgress,
            ),
          );

        const nextLesson =
          lessons.find(
            (lesson) =>
              !completedIds.has(
                lesson.lesson_id,
              ),
          ) ?? null;

        const attempt =
          latestAssessmentByCourse.get(
            course.id,
          ) ?? null;

        const assessmentPercentage =
          attempt
            ? calculateAssessmentPercentage(
                attempt,
              )
            : null;

        const certificate =
          certificateByCourse.get(
            course.id,
          );

        const projects =
          capstoneByCourse.get(
            course.id,
          ) ?? [];

        const approved =
          projects.some(
            (project) =>
              submissions.some(
                (submission) =>
                  submission.project_id ===
                    project.id &&
                  submission.status ===
                    "approved",
              ),
          );

        return {
          enrollment,
          course,
          lessons,
          completedCount,
          totalLessons,
          progressPercent,
          nextLesson,
          assessment: {
            completed: Boolean(attempt),
            attemptId:
              attempt?.id ?? null,
            percentage:
              assessmentPercentage,
          },
          certificate: certificate
            ? {
                status:
                  certificate.is_revoked
                    ? "revoked"
                    : "valid",
                id: certificate.id,
                number:
                  certificate.certificate_number,
              }
            : {
                status: "not_issued",
                id: null,
                number: null,
              },
          capstone: {
            available:
              projects.length > 0,
            approved,
          },
        };
      })
      .filter(
        (
          row,
        ): row is CourseRow =>
          row !== null,
      );

  const activeCount =
    rows.filter(
      (row) =>
        row.enrollment
          .enrollment_status ===
        "active",
    ).length;

  const completedCount =
    rows.filter(
      (row) =>
        row.progressPercent >= 100 ||
        row.enrollment
          .enrollment_status ===
          "completed",
    ).length;

  return (
    <main className="container rn-student-courses-page">
      <section className="rn-student-page-header">
        <span className="rn-eyebrow">
          MY LEARNING
        </span>

        <h1>My Courses</h1>

        <p>
          Track your lessons, resume learning,
          monitor assessments, and manage your
          certificates.
        </p>
      </section>

      <section className="rn-course-dashboard-stats">
        <div className="rn-course-stat-card">
          <strong>
            {rows.length}
          </strong>
          <span>Enrolled Courses</span>
        </div>

        <div className="rn-course-stat-card">
          <strong>
            {activeCount}
          </strong>
          <span>Active Learning</span>
        </div>

        <div className="rn-course-stat-card">
          <strong>
            {completedCount}
          </strong>
          <span>Completed</span>
        </div>
      </section>

      <section className="rn-student-course-list">
        {rows.map((row) => {
          const {
            course,
            enrollment,
            lessons,
            completedCount,
            totalLessons,
            progressPercent,
            nextLesson,
            assessment,
            certificate,
            capstone,
          } = row;

          const certificateEligible =
            totalLessons > 0 &&
            completedCount ===
              totalLessons &&
            assessment.completed &&
            assessment.percentage !== null &&
            assessment.percentage >= 70 &&
            capstone.available &&
            capstone.approved;

          const continueHref =
            nextLesson
              ? `/learn/${course.slug}/${nextLesson.lesson_slug}`
              : `/courses/${course.slug}`;

          const continueLabel =
            nextLesson
              ? progressPercent > 0
                ? "Continue Learning"
                : "Start Learning"
              : "Review Course";

          return (
            <article
              key={enrollment.id}
              className="rn-student-course-card"
            >
              <div className="rn-student-course-card-top">
                <div className="rn-student-course-title">
                  <span className="rn-course-level">
                    {course.level ||
                      "Professional"}
                  </span>

                  <h2>
                    {course.title}
                  </h2>

                  {course.short_description ? (
                    <p>
                      {
                        course.short_description
                      }
                    </p>
                  ) : null}
                </div>

                <span className="rn-enrollment-badge">
                  {
                    enrollment.enrollment_status
                  }
                </span>
              </div>

              <div className="rn-student-course-meta">
                {course.level ? (
                  <span>
                    Level:{" "}
                    {course.level}
                  </span>
                ) : null}

                {course.duration_minutes ? (
                  <span>
                    {course.duration_minutes >=
                    60
                      ? `${Math.round(
                          (course.duration_minutes /
                            60) *
                            10,
                        ) / 10} hours`
                      : `${course.duration_minutes} min`}
                  </span>
                ) : null}

                <span>
                  {completedCount} of{" "}
                  {totalLessons} lessons
                </span>
              </div>

              <div className="rn-learning-progress">
                <div className="rn-learning-progress-heading">
                  <strong>
                    Lesson Progress
                  </strong>

                  <span>
                    {progressPercent}%
                  </span>
                </div>

                <div className="rn-learning-progress-track">
                  <div
                    className="rn-learning-progress-fill"
                    style={{
                      width: `${progressPercent}%`,
                    }}
                  />
                </div>
              </div>

              <div className="rn-course-dashboard-grid">
                <div className="rn-course-dashboard-panel">
                  <span className="rn-panel-label">
                    COURSE ASSESSMENT
                  </span>

                  <strong>
                    {assessment.completed
                      ? assessment.percentage !==
                        null
                        ? `${assessment.percentage}%`
                        : "Completed"
                      : "Not started"}
                  </strong>

                  <p>
                    {assessment.completed
                      ? "Latest assessment attempt recorded."
                      : "Complete the course assessment when ready."}
                  </p>

                  <div className="rn-panel-actions">
                    <Link
                      href={
                        `/student/assessment?course=${encodeURIComponent(
                          course.slug,
                        )}`
                      }
                      className="rn-button rn-button-secondary"
                    >
                      {assessment.completed
                        ? "Retake Assessment"
                        : "Start Assessment"}
                    </Link>

                    {assessment.attemptId ? (
                      <Link
                        href={`/student/assessment/results/${encodeURIComponent(
                          assessment.attemptId,
                        )}`}
                        className="rn-text-button"
                      >
                        View Result
                      </Link>
                    ) : null}
                  </div>
                </div>

                <div className="rn-course-dashboard-panel">
                  <span className="rn-panel-label">
                    CERTIFICATE
                  </span>

                  <strong>
                    {certificate.status ===
                    "valid"
                      ? "Issued"
                      : certificate.status ===
                          "revoked"
                        ? "Revoked"
                        : "Not issued"}
                  </strong>

                  <p>
                    {certificate.status ===
                    "valid"
                      ? certificate.number
                        ? `Certificate ${certificate.number}`
                        : "Certificate available."
                      : certificateEligible
                        ? "All certificate requirements are complete."
                        : "Complete lessons, pass the assessment and receive capstone approval."}
                  </p>

                  {certificate.id ? (
                    <Link
                      href={`/student/certificates/${encodeURIComponent(
                        certificate.id,
                      )}`}
                      className="rn-button rn-button-secondary"
                    >
                      View Certificate
                    </Link>
                  ) : certificateEligible ? (
                    <CertificateIssueButton
                      courseId={
                        course.id
                      }
                    />
                  ) : null}
                </div>
              </div>

              <div className="rn-student-course-actions">
                <Link
                  href={continueHref}
                  className="rn-button rn-button-primary"
                >
                  {continueLabel}
                </Link>

                <Link
                  href={`/courses/${course.slug}`}
                  className="rn-button rn-button-secondary"
                >
                  Course Details
                </Link>

                {lessons.length > 0 ? (
                  <span className="rn-course-lesson-summary">
                    {lessons.length} published{" "}
                    {lessons.length === 1
                      ? "lesson"
                      : "lessons"}
                  </span>
                ) : null}
              </div>
            </article>
          );
        })}
      </section>

      <section className="rn-student-catalog-cta">
        <div>
          <span className="rn-eyebrow">
            KEEP BUILDING
          </span>

          <h2>
            Continue developing practical
            professional skills.
          </h2>

          <p>
            Explore more RuffNeck Learn courses
            covering AI, productivity, business,
            education, data and digital work.
          </p>
        </div>

        <Link
          href="/courses"
          className="rn-button rn-button-primary"
        >
          Browse Courses
        </Link>
      </section>
    </main>
  );
}