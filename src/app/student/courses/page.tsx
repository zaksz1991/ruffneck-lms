import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CertificateIssueButton from "@/components/CertificateIssueButton";

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
  status:
    | "not_issued"
    | "valid"
    | "revoked";
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
    certificateResult,
    projectResult,
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
        "id, course_id, score, total_points, earned_points, total_questions, time_spent_seconds, completed_at"
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
        "id, student_id, course_id, certificate_number, is_revoked"
      )
      .eq("student_id", user.id)
      .in("course_id", courseIds),

    supabase
      .from("course_projects")
      .select(
        "id, course_id, project_type, is_published"
      )
      .in("course_id", courseIds)
      .eq("project_type", "capstone")
      .eq("is_published", true),
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

  if (certificateResult.error) {
    throw new Error(
      certificateResult.error.message
    );
  }

  if (projectResult.error) {
    throw new Error(
      projectResult.error.message
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

  const certificates =
    (certificateResult.data ??
      []) as Certificate[];

  const capstoneProjects =
    (projectResult.data ??
      []) as CourseProject[];

  const capstoneProjectIds =
    capstoneProjects.map(
      (project) => project.id
    );

  let submissionData: ProjectSubmission[] =
    [];

  if (capstoneProjectIds.length > 0) {
    const {
      data,
      error,
    } = await supabase
      .from("project_submissions")
      .select(
        "id, project_id, student_id, status, score"
      )
      .eq("student_id", user.id)
      .in(
        "project_id",
        capstoneProjectIds
      );

    if (error) {
      throw new Error(error.message);
    }

    submissionData =
      (data ?? []) as ProjectSubmission[];
  }

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

  /*
   * assessment_attempts contains completed submissions.
   * Because the query is ordered newest first, the first
   * attempt encountered for a course is the latest one.
   */
  const assessmentByCourse =
    new Map<string, CourseAssessment>();

  for (const attempt of assessmentAttempts) {
    if (
      assessmentByCourse.has(
        attempt.course_id
      )
    ) {
      continue;
    }

    let percentage: number | null = null;

    if (
      typeof attempt.earned_points ===
        "number" &&
      typeof attempt.total_points ===
        "number" &&
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
        attempt.score
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
      }
    );
  }

  const capstoneByCourse =
    new Map<string, CourseCapstone>();

  for (const project of capstoneProjects) {
    const existing =
      capstoneByCourse.get(
        project.course_id
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
            "approved"
      );

    if (approvedSubmission) {
      existing.approved_submission =
        true;
    }

    capstoneByCourse.set(
      project.course_id,
      existing
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
          attempt_id: null,
          score: null,
          total_questions: null,
          completed_at: null,
          percentage: null,
        };

      const certificate =
        certificateByCourse.get(
          course.id
        ) ?? {
          status: "not_issued" as const,
          certificate_id: null,
          certificate_number: null,
        };

      const capstone =
        capstoneByCourse.get(
          course.id
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
          Math.max(0, lessonPercent)
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
          Track your lessons, resume learning, monitor
          assessments, and manage your certificates.
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
            certificate,
            certificateEligibility,
          } = row;

          const courseAssessmentLabel =
            assessment.status ===
            "completed"
              ? "Completed"
              : "Not started";

          const assessmentScore =
            assessment.percentage !== null
              ? `${assessment.percentage}%`
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
              ? "Retake Assessment"
              : "Start Assessment";

          const assessmentHref =
            `/student/assessment?course=${encodeURIComponent(
              course.slug
            )}`;

          const resultHref =
            assessment.attempt_id
              ? `/student/assessment/results/${encodeURIComponent(
                  assessment.attempt_id
                )}`
              : null;

          const certificateLabel =
            certificate.status ===
            "valid"
              ? "View Certificate"
              : certificate.status ===
                  "revoked"
                ? "View Revoked Certificate"
                : "Certificate Not Issued";

          const certificateHref =
            certificate.certificate_id
              ? `/student/certificates/${encodeURIComponent(
                  certificate.certificate_id
                )}`
              : null;

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
                      ? ` · Latest score: ${assessmentScore}`
                      : ""}
                  </p>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  {resultHref ? (
                    <Link
                      href={resultHref}
                      className="button secondary"
                    >
                      View Latest Result
                    </Link>
                  ) : null}

                  <Link
                    href={assessmentHref}
                    className="button secondary"
                  >
                    {assessmentLabel}
                  </Link>
                </div>
              </div>

              <div
                style={{
                  padding: "16px 0",
                  borderTop:
                    "1px solid var(--border)",
                  borderBottom:
                    "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems:
                      "flex-start",
                    justifyContent:
                      "space-between",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <strong>
                      Certificate
                    </strong>

                    <p
                      style={{
                        margin:
                          "5px 0 0",
                        color:
                          "var(--muted)",
                      }}
                    >
                      {certificate.status ===
                      "valid"
                        ? "Certificate issued and valid."
                        : certificate.status ===
                            "revoked"
                          ? "Certificate issued but currently revoked."
                          : certificateEligibility.eligible
                            ? "You have completed all certificate requirements."
                            : "Certificate requirements are not yet complete."}
                    </p>

                    {certificate.certificate_number ? (
                      <small
                        style={{
                          display:
                            "block",
                          marginTop: 5,
                          color:
                            "var(--muted)",
                        }}
                      >
                        Certificate No:{" "}
                        {
                          certificate.certificate_number
                        }
                      </small>
                    ) : null}
                  </div>

                  {certificateHref ? (
                    <Link
                      href={
                        certificateHref
                      }
                      className="button secondary"
                    >
                      {certificateLabel}
                    </Link>
                  ) : certificateEligibility.eligible ? (
                    <CertificateIssueButton
                      courseId={
                        course.id
                      }
                    />
                  ) : null}
                </div>

                {certificate.status ===
                  "not_issued" &&
                !certificateEligibility.eligible ? (
                  <div
                    style={{
                      marginTop: 14,
                      display: "grid",
                      gap: 7,
                    }}
                  >
                    <small
                      style={{
                        color:
                          certificateEligibility.lessons_complete
                            ? "var(--muted)"
                            : "#b45309",
                      }}
                    >
                      {certificateEligibility.lessons_complete
                        ? "✓ All published lessons completed"
                        : "○ Complete all published lessons"}
                    </small>

                    <small
                      style={{
                        color:
                          certificateEligibility.assessment_passed
                            ? "var(--muted)"
                            : "#b45309",
                      }}
                    >
                      {certificateEligibility.assessment_complete
                        ? certificateEligibility.assessment_passed
                          ? "✓ Assessment passed with at least 70%"
                          : "○ Assessment score must be at least 70%"
                        : "○ Complete the course assessment with at least 70%"}
                    </small>

                    <small
                      style={{
                        color:
                          certificateEligibility.capstone_available &&
                          certificateEligibility.capstone_approved
                            ? "var(--muted)"
                            : "#b45309",
                      }}
                    >
                      {certificateEligibility.capstone_available
                        ? certificateEligibility.capstone_approved
                          ? "✓ Capstone project approved"
                          : "○ Submit the capstone project and receive approval"
                        : "○ Capstone project is not yet available"}
                    </small>
                  </div>
                ) : null}
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