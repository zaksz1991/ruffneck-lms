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
  enrollment_status: "active" | "completed" | "cancelled";
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

const PAGE_STYLES = `
  .rn-certificates-page {
    --cert-navy: #0b1e3a;
    --cert-cyan: #00b4d8;
    --cert-gold: #fbbf24;
    --cert-muted: #718096;
    --cert-border: #e3eaf2;
    padding: 28px 0 60px;
    color: #1d2b40;
  }

  .rn-certificates-page *,
  .rn-certificates-page *::before,
  .rn-certificates-page *::after {
    box-sizing: border-box;
  }

  .rn-certificates-page a {
    text-decoration: none;
  }

  .rn-certificates-page .rn-certificates-header {
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 210px;
    padding: 34px;
    margin-bottom: 27px;
    border-radius: 21px;
    background: linear-gradient(125deg, #0b1e3a, #123b61 68%, #07566c);
    color: white;
  }

  .rn-certificates-page .rn-certificates-header::after {
    content: "";
    position: absolute;
    top: -110px;
    right: -55px;
    width: 260px;
    height: 260px;
    border: 1px solid rgba(255,255,255,.16);
    border-radius: 50%;
    box-shadow:
      0 0 0 30px rgba(255,255,255,.035),
      0 0 0 65px rgba(255,255,255,.025);
    pointer-events: none;
  }

  .rn-certificates-page .rn-certificates-header > div {
    position: relative;
    z-index: 1;
    max-width: 680px;
  }

  .rn-certificates-page .rn-learning-back {
    display: inline-flex;
    margin-bottom: 23px;
    color: #c7eaf4;
    font-size: 12px;
    font-weight: 750;
  }

  .rn-certificates-page .rn-learning-back:hover {
    color: white;
  }

  .rn-certificates-page .rn-eyebrow {
    display: block;
    margin-bottom: 10px;
    color: #0788a5;
    font-size: 10px;
    font-weight: 850;
    letter-spacing: 1.8px;
    line-height: 1.6;
  }

  .rn-certificates-page .rn-certificates-header .rn-eyebrow {
    color: #67e8f9;
  }

  .rn-certificates-page .rn-certificates-header h1 {
    margin: 0;
    color: #fff;
    font-size: clamp(31px, 4vw, 43px);
    font-weight: 850;
    letter-spacing: -1.3px;
    line-height: 1.15;
  }

  .rn-certificates-page .rn-certificates-header p {
    max-width: 570px;
    margin: 13px 0 0;
    color: #d4e3f2;
    font-size: 14px;
    line-height: 1.8;
  }

  .rn-certificates-page .rn-certificate-claim-section,
  .rn-certificates-page .rn-certificate-list-section {
    padding: 27px;
    margin-bottom: 25px;
    border: 1px solid var(--cert-border);
    border-radius: 18px;
    background: #fff;
    box-shadow: 0 4px 18px rgba(11,30,58,.035);
  }

  .rn-certificates-page .rn-certificate-claim-section {
    border-color: #bcebd0;
    background: linear-gradient(145deg, #f4fff8, #fff 75%);
  }

  .rn-certificates-page .rn-certificate-claim-section h2,
  .rn-certificates-page .rn-certificates-section-heading h2 {
    margin: 0;
    color: var(--cert-navy);
    font-size: 23px;
    font-weight: 850;
    letter-spacing: -.5px;
    line-height: 1.35;
  }

  .rn-certificates-page .rn-certificate-claim-section > div > p {
    max-width: 650px;
    margin: 9px 0 0;
    color: var(--cert-muted);
    font-size: 13px;
    line-height: 1.8;
  }

  .rn-certificates-page .rn-certificate-claim-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 15px;
    margin-top: 22px;
  }

  .rn-certificates-page .rn-certificate-claim-card {
    min-width: 0;
    padding: 21px;
    border: 1px solid #d9eee1;
    border-radius: 13px;
    background: rgba(255,255,255,.9);
  }

  .rn-certificates-page .rn-certificate-claim-card > span {
    display: inline-flex;
    padding: 6px 9px;
    border-radius: 6px;
    background: #e8f9ee;
    color: #177342;
    font-size: 9px;
    font-weight: 850;
    letter-spacing: .6px;
  }

  .rn-certificates-page .rn-certificate-claim-card h3 {
    margin: 15px 0 8px;
    color: var(--cert-navy);
    font-size: 18px;
    font-weight: 850;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .rn-certificates-page .rn-certificate-claim-card p {
    margin: 0 0 17px;
    color: var(--cert-muted);
    font-size: 12px;
    line-height: 1.8;
  }

  .rn-certificates-page .rn-certificates-section-heading {
    margin-bottom: 22px;
  }

  .rn-certificates-page .rn-certificate-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px;
  }

  .rn-certificates-page .rn-certificate-card {
    position: relative;
    display: flex;
    min-width: 0;
    flex-direction: column;
    overflow: hidden;
    padding: 23px;
    border: 1px solid var(--cert-border);
    border-radius: 15px;
    background: #fff;
    transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease;
  }

  .rn-certificates-page .rn-certificate-card::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 4px;
    background: linear-gradient(90deg, #00b4d8, #67e8f9, #fbbf24);
  }

  .rn-certificates-page .rn-certificate-card:hover {
    transform: translateY(-2px);
    border-color: #b4e8f0;
    box-shadow: 0 10px 26px rgba(11,30,58,.07);
  }

  .rn-certificates-page .rn-certificate-card h3 {
    margin: 9px 0;
    color: var(--cert-navy);
    font-size: 20px;
    font-weight: 850;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .rn-certificates-page .rn-certificate-card > p {
    margin: 0 0 17px;
    color: #718096;
    font-size: 11px;
    font-weight: 750;
    letter-spacing: .25px;
    overflow-wrap: anywhere;
  }

  .rn-certificates-page .rn-certificate-card-meta {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 9px;
    margin-bottom: 18px;
  }

  .rn-certificates-page .rn-certificate-card-meta span {
    display: block;
    min-width: 0;
    padding: 11px;
    border: 1px solid #edf1f6;
    border-radius: 9px;
    background: #f9fbfe;
    color: #52627a;
    font-size: 11px;
    line-height: 1.65;
    overflow-wrap: anywhere;
  }

  .rn-certificates-page .rn-certificate-card-meta span:first-child {
    grid-column: 1 / -1;
  }

  .rn-certificates-page .rn-certificate-card .rn-project-status {
    display: inline-flex;
    align-self: flex-start;
    padding: 7px 10px;
    margin-bottom: 14px;
    border: 1px solid #f0c6c6;
    border-radius: 7px;
    background: #fff1f1;
    color: #a22b2b;
    font-size: 11px;
    font-weight: 850;
  }

  .rn-certificates-page .rn-button {
    display: inline-flex;
    min-height: 42px;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 15px;
    border: 1px solid #dbe4ef;
    border-radius: 9px;
    background: #fff;
    color: #20334d;
    font-size: 12px;
    font-weight: 800;
    line-height: 1.5;
    text-align: center;
    cursor: pointer;
    transition: transform .18s ease, box-shadow .18s ease;
  }

  .rn-certificates-page .rn-button:hover {
    transform: translateY(-1px);
    box-shadow: 0 5px 15px rgba(11,30,58,.1);
  }

  .rn-certificates-page .rn-button-primary {
    border-color: #00b4d8;
    background: #00b4d8;
    color: #08243a;
  }

  .rn-certificates-page .rn-certificate-card > div:last-child {
    margin-top: auto;
  }

  .rn-certificates-page .rn-project-empty {
    padding: 42px 22px;
    border: 1px dashed #cad6e5;
    border-radius: 14px;
    background: #fafcff;
    text-align: center;
  }

  .rn-certificates-page .rn-project-empty h2 {
    margin: 0;
    color: var(--cert-navy);
    font-size: 21px;
    font-weight: 850;
  }

  .rn-certificates-page .rn-project-empty p {
    max-width: 520px;
    margin: 11px auto 20px;
    color: var(--cert-muted);
    font-size: 13px;
    line-height: 1.85;
  }

  @media (max-width: 760px) {
    .rn-certificates-page .rn-certificates-header {
      min-height: auto;
      padding: 27px 22px;
      border-radius: 16px;
    }

    .rn-certificates-page .rn-certificate-claim-section,
    .rn-certificates-page .rn-certificate-list-section {
      padding: 21px 16px;
    }

    .rn-certificates-page .rn-certificate-grid,
    .rn-certificates-page .rn-certificate-claim-grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @media (max-width: 420px) {
    .rn-certificates-page {
      padding-top: 15px;
    }

    .rn-certificates-page .rn-certificates-header h1 {
      font-size: 31px;
    }

    .rn-certificates-page .rn-certificate-card {
      padding: 19px 15px;
    }

    .rn-certificates-page .rn-certificate-card-meta {
      grid-template-columns: minmax(0, 1fr);
    }

    .rn-certificates-page .rn-certificate-card-meta span:first-child {
      grid-column: auto;
    }
  }
`;

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "long",
  }).format(date);
}

function assessmentPercentage(attempt: AssessmentAttempt | null) {
  if (!attempt) {
    return null;
  }

  if (
    attempt.total_points !== null &&
    attempt.total_points > 0 &&
    attempt.earned_points !== null
  ) {
    return Math.round(
      (attempt.earned_points / attempt.total_points) * 100,
    );
  }

  if (
    attempt.total_questions !== null &&
    attempt.total_questions > 0 &&
    attempt.score !== null
  ) {
    return Math.round(
      (attempt.score / attempt.total_questions) * 100,
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
      ].join(", "),
    )
    .eq("student_id", user.id)
    .order("issued_at", { ascending: false });

  if (certificateError) {
    console.error(
      "Student certificates lookup failed:",
      certificateError,
    );
  }

  const certificates =
    (certificateData ?? []) as unknown as Certificate[];

  const {
    data: enrollmentData,
    error: enrollmentError,
  } = await supabase
    .from("enrollments")
    .select("course_id, enrollment_status, payment_status")
    .eq("student_id", user.id)
    .eq("enrollment_status", "completed");

  if (enrollmentError) {
    console.error(
      "Completed enrollment lookup failed:",
      enrollmentError,
    );
  }

  const completedEnrollments =
    (enrollmentData ?? []) as unknown as Enrollment[];

  const certificateCourseIds = new Set(
    certificates.map((item) => item.course_id),
  );

  const eligibleEnrollmentCourseIds = [
    ...new Set(
      completedEnrollments
        .filter(
          (enrollment) =>
            enrollment.payment_status === "paid" ||
            enrollment.payment_status === "free",
        )
        .map((enrollment) => enrollment.course_id),
    ),
  ];

  const uncategorizedCourseIds =
    eligibleEnrollmentCourseIds.filter(
      (courseId) => !certificateCourseIds.has(courseId),
    );

  const { data: courseData, error: courseError } =
    uncategorizedCourseIds.length > 0
      ? await supabase
          .from("courses")
          .select("id, title, is_free")
          .eq("status", "published")
          .in("id", uncategorizedCourseIds)
      : { data: [], error: null };

  if (courseError) {
    console.error(
      "Certificate candidate course lookup failed:",
      courseError,
    );
  }

  const courses = (courseData ?? []) as unknown as Course[];

  const validCertificateCourses = courses.filter((course) => {
    const enrollment = completedEnrollments.find(
      (item) => item.course_id === course.id,
    );

    if (!enrollment) {
      return false;
    }

    if (course.is_free) {
      return enrollment.payment_status === "free";
    }

    return enrollment.payment_status === "paid";
  });

  const candidateCourseIds = validCertificateCourses.map(
    (course) => course.id,
  );

  let curriculum: CurriculumItem[] = [];
  let lessonProgress: LessonProgress[] = [];
  let assessmentAttempts: AssessmentAttempt[] = [];
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
        .in("course_id", candidateCourseIds)
        .eq("is_published", true),

      supabase
        .from("lesson_progress")
        .select("course_id, lesson_id, completed")
        .eq("student_id", user.id)
        .in("course_id", candidateCourseIds),

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
          ].join(", "),
        )
        .eq("student_id", user.id)
        .in("course_id", candidateCourseIds)
        .not("completed_at", "is", null)
        .order("created_at", { ascending: false }),

      supabase
        .from("course_projects")
        .select("id, course_id, project_type, is_published")
        .in("course_id", candidateCourseIds)
        .eq("project_type", "capstone")
        .eq("is_published", true),
    ]);

    if (curriculumResult.error) {
      console.error(
        "Certificate curriculum lookup failed:",
        curriculumResult.error,
      );
    }

    if (lessonProgressResult.error) {
      console.error(
        "Certificate lesson progress lookup failed:",
        lessonProgressResult.error,
      );
    }

    if (assessmentResult.error) {
      console.error(
        "Certificate assessment lookup failed:",
        assessmentResult.error,
      );
    }

    if (projectResult.error) {
      console.error(
        "Certificate capstone lookup failed:",
        projectResult.error,
      );
    }

    curriculum =
      (curriculumResult.data ?? []) as unknown as CurriculumItem[];

    lessonProgress =
      (lessonProgressResult.data ?? []) as unknown as LessonProgress[];

    assessmentAttempts =
      (assessmentResult.data ?? []) as unknown as AssessmentAttempt[];

    projects = (projectResult.data ?? []) as unknown as CourseProject[];

    const capstoneProjectIds = projects.map((project) => project.id);

    if (capstoneProjectIds.length > 0) {
      const {
        data: submissionData,
        error: submissionError,
      } = await supabase
        .from("project_submissions")
        .select("id, project_id, student_id, status, score")
        .eq("student_id", user.id)
        .in("project_id", capstoneProjectIds);

      if (submissionError) {
        console.error(
          "Certificate capstone submission lookup failed:",
          submissionError,
        );
      }

      submissions =
        (submissionData ?? []) as unknown as ProjectSubmission[];
    }
  }

  const certificateCandidates: CertificateCandidate[] =
    validCertificateCourses.map((course) => {
      const courseCurriculum = curriculum.filter(
        (item) => item.course_id === course.id,
      );

      const completedLessonIds = new Set(
        lessonProgress
          .filter(
            (item) =>
              item.course_id === course.id && item.completed,
          )
          .map((item) => item.lesson_id),
      );

      const lessonsComplete =
        courseCurriculum.length > 0 &&
        courseCurriculum.every((item) =>
          completedLessonIds.has(item.lesson_id),
        );

      const latestAssessment =
        assessmentAttempts.find(
          (attempt) => attempt.course_id === course.id,
        ) ?? null;

      const assessmentScore =
        assessmentPercentage(latestAssessment);

      const assessmentComplete = latestAssessment !== null;

      const assessmentPassed =
        assessmentScore !== null && assessmentScore >= 70;

      const courseProjects = projects.filter(
        (project) => project.course_id === course.id,
      );

      const capstoneAvailable = courseProjects.length > 0;

      const capstoneProjectIds = new Set(
        courseProjects.map((project) => project.id),
      );

      const capstoneApproved = submissions.some(
        (submission) =>
          capstoneProjectIds.has(submission.project_id) &&
          submission.status === "approved",
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

  const eligibleCandidates = certificateCandidates.filter(
    (candidate) => candidate.eligible,
  );

  return (
    <main className="rn-certificates-page">
      <style>{PAGE_STYLES}</style>

      <div className="container">
        <header className="rn-certificates-header">
          <div>
            <Link
              href="/student/dashboard"
              className="rn-learning-back"
            >
              ← Dashboard
            </Link>

            <span className="rn-eyebrow">
              RUFFNECK ENTERTAINMENT · LEARNING
            </span>

            <h1>My Certificates</h1>

            <p>
              Access your course credentials, view certificate details,
              print your achievements and verify certificates online.
            </p>
          </div>
        </header>

        {eligibleCandidates.length > 0 && (
          <section className="rn-certificate-claim-section">
            <div>
              <span className="rn-eyebrow">
                CERTIFICATE ELIGIBILITY
              </span>

              <h2>Certificates ready to claim</h2>

              <p>
                These courses have satisfied the lesson, assessment and
                approved capstone requirements.
              </p>
            </div>

            <div className="rn-certificate-claim-grid">
              {eligibleCandidates.map((candidate) => (
                <article
                  key={candidate.course.id}
                  className="rn-certificate-claim-card"
                >
                  <span>ELIGIBLE FOR CERTIFICATE</span>

                  <h3>{candidate.course.title}</h3>

                  <p>
                    Published lessons completed, assessment passed at 70%
                    or higher, and capstone approved.
                  </p>

                  <CertificateIssueButton
                    courseId={candidate.course.id}
                  />
                </article>
              ))}
            </div>
          </section>
        )}

        {certificateCandidates.length > 0 &&
          eligibleCandidates.length === 0 &&
          certificates.length === 0 && (
            <section className="rn-certificate-claim-section">
              <div>
                <span className="rn-eyebrow">
                  CERTIFICATE PROGRESS
                </span>

                <h2>No certificate is ready to claim</h2>

                <p>
                  Complete all published lessons, pass the assessment
                  with at least 70%, and receive approval for the
                  published capstone to qualify for a certificate.
                </p>
              </div>
            </section>
          )}

        <section className="rn-certificate-list-section">
          <div className="rn-certificates-section-heading">
            <span className="rn-eyebrow">YOUR CREDENTIALS</span>
            <h2>Issued certificates</h2>
          </div>

          {certificates.length === 0 ? (
            <article className="rn-project-empty">
              <h2>No certificates yet</h2>

              <p>
                Your issued certificates will appear here. Complete a
                course, pass its assessment and receive capstone approval
                to become eligible.
              </p>

              <Link
                href="/courses"
                className="rn-button rn-button-primary"
              >
                Explore Courses →
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

                  <h3>{certificate.course_title}</h3>

                  <p>{certificate.certificate_number}</p>

                  <div className="rn-certificate-card-meta">
                    <span>
                      Issued: {formatDate(certificate.issued_at)}
                    </span>

                    <span>
                      Assessment:{" "}
                      {certificate.assessment_score ?? "—"}%
                    </span>

                    <span>
                      Capstone: {certificate.capstone_score ?? "—"}/100
                    </span>
                  </div>

                  {certificate.is_revoked ? (
                    <>
                      <div className="rn-project-status status-revision_required">
                        Revoked
                      </div>

                      <CertificateVerification
                        certificateId={certificate.id}
                        certificateNumber={
                          certificate.certificate_number
                        }
                        isRevoked
                      />
                    </>
                  ) : (
                    <>
                      <div>
                        <Link
                          href={`/student/certificates/${certificate.id}`}
                          className="rn-button rn-button-primary"
                        >
                          View Certificate →
                        </Link>
                      </div>

                      <CertificateVerification
                        certificateId={certificate.id}
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