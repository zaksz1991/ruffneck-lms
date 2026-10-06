import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CertificateIssueButton from "@/components/CertificateIssueButton";
import CertificateVerification from "./CertificateVerification";

type Certificate = {
  id: string;
  certificate_number: string;
  course_id: string;
  course_title: string;
  issued_at: string;
  is_revoked: boolean;
  assessment_score: number | null;
  capstone_score: number | null;
};

type Enrollment = {
  course_id: string;
  enrollment_status:
    | "active"
    | "completed"
    | "cancelled";
  payment_status:
    | "pending"
    | "paid"
    | "failed"
    | "refunded"
    | "free"
    | null;
};

type Course = {
  id: string;
  title: string;
  is_free: boolean;
};

type CurriculumItem = {
  course_id: string;
  lesson_id: string;
};

type LessonProgress = {
  course_id: string;
  lesson_id: string;
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
  created_at: string;
};

type CourseProject = {
  id: string;
  course_id: string;
  project_type: string;
  is_published: boolean;
};

type ProjectSubmission = {
  id: string;
  project_id: string;
  student_id: string;
  status: string;
  score: number | null;
};

type CertificateCandidate = {
  course: Course;
  lessonsComplete: boolean;
  assessmentComplete: boolean;
  assessmentPassed: boolean;
  capstoneAvailable: boolean;
  capstoneApproved: boolean;
  eligible: boolean;
};

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "long",
  }).format(date);
}

function assessmentPercentage(
  attempt: AssessmentAttempt | null
) {
  if (!attempt) {
    return null;
  }

  if (
    attempt.total_points !== null &&
    attempt.total_points > 0 &&
    attempt.earned_points !== null
  ) {
    return Math.round(
      (attempt.earned_points /
        attempt.total_points) *
        100
    );
  }

  if (
    attempt.total_questions !== null &&
    attempt.total_questions > 0 &&
    attempt.score !== null
  ) {
    return Math.round(
      (attempt.score /
        attempt.total_questions) *
        100
    );
  }

  if (attempt.score !== null) {
    return Math.round(attempt.score);
  }

  return null;
}

export default async function StudentCertificatesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/student/certificates");
  }

  const {
    data: certificateData,
    error: certificateError,
  } = await supabase
    .from("course_certificates")
    .select(
      [
        "id",
        "certificate_number",
        "course_id",
        "course_title",
        "issued_at",
        "is_revoked",
        "assessment_score",
        "capstone_score",
      ].join(", ")
    )
    .eq("student_id", user.id)
    .order("issued_at", {
      ascending: false,
    });

  if (certificateError) {
    console.error(
      "Student certificates lookup failed:",
      certificateError
    );
  }

  const certificates =
    (certificateData ?? []) as unknown as Certificate[];

  const {
    data: enrollmentData,
    error: enrollmentError,
  } = await supabase
    .from("enrollments")
    .select(
      "course_id, enrollment_status, payment_status"
    )
    .eq("student_id", user.id)
    .eq("enrollment_status", "completed");

  if (enrollmentError) {
    console.error(
      "Completed enrollment lookup failed:",
      enrollmentError
    );
  }

  const completedEnrollments =
    (enrollmentData ?? []) as unknown as Enrollment[];

  const certificateCourseIds = new Set(
    certificates.map(
      (item) => item.course_id
    )
  );

  const eligibleEnrollmentCourseIds = [
    ...new Set(
      completedEnrollments
        .filter(
          (enrollment) =>
            enrollment.payment_status === "paid" ||
            enrollment.payment_status === "free"
        )
        .map(
          (enrollment) => enrollment.course_id
        )
    ),
  ];

  const uncategorizedCourseIds =
    eligibleEnrollmentCourseIds.filter(
      (courseId) =>
        !certificateCourseIds.has(courseId)
    );

  const {
    data: courseData,
    error: courseError,
  } =
    uncategorizedCourseIds.length > 0
      ? await supabase
          .from("courses")
          .select("id, title, is_free")
          .eq("status", "published")
          .in(
            "id",
            uncategorizedCourseIds
          )
      : {
          data: [],
          error: null,
        };

  if (courseError) {
    console.error(
      "Certificate candidate course lookup failed:",
      courseError
    );
  }

  const courses =
    (courseData ?? []) as unknown as Course[];

  const validCertificateCourses =
    courses.filter((course) => {
      const enrollment =
        completedEnrollments.find(
          (item) =>
            item.course_id === course.id
        );

      if (!enrollment) {
        return false;
      }

      if (course.is_free) {
        return (
          enrollment.payment_status === "free"
        );
      }

      return (
        enrollment.payment_status === "paid"
      );
    });

  const candidateCourseIds =
    validCertificateCourses.map(
      (course) => course.id
    );

  let curriculum: CurriculumItem[] = [];
  let lessonProgress: LessonProgress[] = [];
  let assessmentAttempts: AssessmentAttempt[] =
    [];
  let projects: CourseProject[] = [];
  let submissions: ProjectSubmission[] = [];

  if (candidateCourseIds.length > 0) {
    const [
      curriculumResult,
      lessonProgressResult,
      assessmentResult,
      projectResult,
    ] = await Promise.all([
      supabase
        .from("course_curriculum")
        .select("course_id, lesson_id")
        .in(
          "course_id",
          candidateCourseIds
        )
        .eq("is_published", true),

      supabase
        .from("lesson_progress")
        .select(
          "course_id, lesson_id, completed"
        )
        .eq("student_id", user.id)
        .in(
          "course_id",
          candidateCourseIds
        ),

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
            "completed_at",
            "created_at",
          ].join(", ")
        )
        .eq("student_id", user.id)
        .in(
          "course_id",
          candidateCourseIds
        )
        .not("completed_at", "is", null)
        .order("created_at", {
          ascending: false,
        }),

      supabase
        .from("course_projects")
        .select(
          "id, course_id, project_type, is_published"
        )
        .in(
          "course_id",
          candidateCourseIds
        )
        .eq("project_type", "capstone")
        .eq("is_published", true),
    ]);

    if (curriculumResult.error) {
      console.error(
        "Certificate curriculum lookup failed:",
        curriculumResult.error
      );
    }

    if (lessonProgressResult.error) {
      console.error(
        "Certificate lesson progress lookup failed:",
        lessonProgressResult.error
      );
    }

    if (assessmentResult.error) {
      console.error(
        "Certificate assessment lookup failed:",
        assessmentResult.error
      );
    }

    if (projectResult.error) {
      console.error(
        "Certificate capstone lookup failed:",
        projectResult.error
      );
    }

    curriculum =
      (curriculumResult.data ??
        []) as unknown as CurriculumItem[];

    lessonProgress =
      (lessonProgressResult.data ??
        []) as unknown as LessonProgress[];

    assessmentAttempts =
      (assessmentResult.data ??
        []) as unknown as AssessmentAttempt[];

    projects =
      (projectResult.data ??
        []) as unknown as CourseProject[];

    const capstoneProjectIds = projects.map(
      (project) => project.id
    );

    if (capstoneProjectIds.length > 0) {
      const {
        data: submissionData,
        error: submissionError,
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

      if (submissionError) {
        console.error(
          "Certificate capstone submission lookup failed:",
          submissionError
        );
      }

      submissions =
        (submissionData ??
          []) as unknown as ProjectSubmission[];
    }
  }

  const certificateCandidates: CertificateCandidate[] =
    validCertificateCourses.map((course) => {
      const courseCurriculum =
        curriculum.filter(
          (item) =>
            item.course_id === course.id
        );

      const completedLessonIds = new Set(
        lessonProgress
          .filter(
            (item) =>
              item.course_id === course.id &&
              item.completed
          )
          .map((item) => item.lesson_id)
      );

      const lessonsComplete =
        courseCurriculum.length > 0 &&
        courseCurriculum.every((item) =>
          completedLessonIds.has(
            item.lesson_id
          )
        );

      const latestAssessment =
        assessmentAttempts.find(
          (attempt) =>
            attempt.course_id === course.id
        ) ?? null;

      const assessmentScore =
        assessmentPercentage(
          latestAssessment
        );

      const assessmentComplete =
        latestAssessment !== null;

      const assessmentPassed =
        assessmentScore !== null &&
        assessmentScore >= 70;

      const courseProjects =
        projects.filter(
          (project) =>
            project.course_id === course.id
        );

      const capstoneAvailable =
        courseProjects.length > 0;

      const capstoneProjectIds =
        new Set(
          courseProjects.map(
            (project) => project.id
          )
        );

      const capstoneApproved =
        submissions.some(
          (submission) =>
            capstoneProjectIds.has(
              submission.project_id
            ) &&
            submission.status === "approved"
        );

      const eligible =
        lessonsComplete &&
        assessmentComplete &&
        assessmentPassed &&
        capstoneAvailable &&
        capstoneApproved;

      return {
        course,
        lessonsComplete,
        assessmentComplete,
        assessmentPassed,
        capstoneAvailable,
        capstoneApproved,
        eligible,
      };
    });

  const eligibleCandidates =
    certificateCandidates.filter(
      (candidate) => candidate.eligible
    );

  return (
    <main className="rn-certificates-page">
      <div className="container">
        <div className="rn-certificates-header">
          <div>
            <Link
              href="/student/dashboard"
              className="rn-learning-back"
            >
              ← Dashboard
            </Link>

            <span className="rn-eyebrow">
              CREDENTIALS
            </span>

            <h1>My Certificates</h1>

            <p>
              View, print and publicly verify your
              RuffNeck Learn course certificates.
            </p>
          </div>
        </div>

        {eligibleCandidates.length > 0 ? (
          <section className="rn-certificate-claim-section">
            <div>
              <span className="rn-eyebrow">
                CERTIFICATE ELIGIBILITY
              </span>

              <h2>
                Certificates ready to claim
              </h2>

              <p>
                These courses have satisfied the
                lesson, assessment and approved
                capstone requirements.
              </p>
            </div>

            <div className="rn-certificate-claim-grid">
              {eligibleCandidates.map(
                (candidate) => (
                  <article
                    key={candidate.course.id}
                    className="rn-certificate-claim-card"
                  >
                    <span>
                      ELIGIBLE FOR CERTIFICATE
                    </span>

                    <h3>
                      {candidate.course.title}
                    </h3>

                    <p>
                      Lessons completed,
                      assessment passed at 70% or
                      higher, and capstone
                      approved.
                    </p>

                    <CertificateIssueButton
                      courseId={
                        candidate.course.id
                      }
                    />
                  </article>
                )
              )}
            </div>
          </section>
        ) : null}

        {certificateCandidates.length > 0 &&
        eligibleCandidates.length === 0 &&
        certificates.length === 0 ? (
          <section className="rn-certificate-claim-section">
            <div>
              <span className="rn-eyebrow">
                CERTIFICATE PROGRESS
              </span>

              <h2>
                No certificate is ready to claim
              </h2>

              <p>
                Completed course status alone does
                not issue a certificate. Each
                certificate requires all published
                lessons, a passing assessment of at
                least 70%, and an approved capstone.
              </p>
            </div>
          </section>
        ) : null}

        <section className="rn-certificate-list-section">
          <div className="rn-certificates-section-heading">
            <span className="rn-eyebrow">
              CERTIFICATES
            </span>

            <h2>Issued credentials</h2>
          </div>

          {certificates.length === 0 ? (
            <article className="rn-project-empty">
              <h2>No certificates yet</h2>

              <p>
                Complete a RuffNeck Learn course,
                pass its assessment with at least
                70%, and receive approval for its
                published capstone to become
                eligible for a certificate.
              </p>

              <Link
                href="/courses"
                className="rn-button rn-button-primary"
              >
                Explore Courses
              </Link>
            </article>
          ) : (
            <div className="rn-certificate-grid">
              {certificates.map((certificate) => (
                <article
                  key={certificate.id}
                  className="rn-certificate-card"
                >
                  <span className="rn-eyebrow">
                    CERTIFICATE OF COMPLETION
                  </span>

                  <h3>
                    {certificate.course_title}
                  </h3>

                  <p>
                    {certificate.certificate_number}
                  </p>

                  <div className="rn-certificate-card-meta">
                    <span>
                      Issued:{" "}
                      {formatDate(
                        certificate.issued_at
                      )}
                    </span>

                    <span>
                      Assessment:{" "}
                      {certificate.assessment_score ??
                        "—"}
                      %
                    </span>

                    <span>
                      Capstone:{" "}
                      {certificate.capstone_score ??
                        "—"}
                      /100
                    </span>
                  </div>

                  {certificate.is_revoked ? (
                    <>
                      <div className="rn-project-status status-revision_required">
                        Revoked
                      </div>

                      <CertificateVerification
                        certificateId={
                          certificate.id
                        }
                        certificateNumber={
                          certificate.certificate_number
                        }
                        isRevoked
                      />
                    </>
                  ) : (
                    <>
                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          flexWrap: "wrap",
                        }}
                      >
                        <Link
                          href={`/student/certificates/${certificate.id}`}
                          className="rn-button rn-button-primary"
                        >
                          View Certificate
                        </Link>
                      </div>

                      <CertificateVerification
                        certificateId={
                          certificate.id
                        }
                        certificateNumber={
                          certificate.certificate_number
                        }
                      />
                    </>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}