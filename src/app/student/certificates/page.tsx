import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CertificateIssueButton from "@/components/CertificateIssueButton";

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
};

type Course = {
  id: string;
  title: string;
};

export default async function StudentCertificatesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      "/login?next=/student/certificates"
    );
  }

  const { data: certificateData } =
    await supabase
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

  const certificates =
    (certificateData as unknown as Certificate[]) ||
    [];

  const { data: enrollmentData } =
    await supabase
      .from("enrollments")
      .select(
        "course_id, enrollment_status"
      )
      .eq("student_id", user.id)
      .eq("enrollment_status", "completed");

  const completedEnrollments =
    (enrollmentData as unknown as Enrollment[]) ||
    [];

  const completedCourseIds =
    completedEnrollments.map(
      (item) => item.course_id
    );

  const certificateCourseIds =
    new Set(
      certificates.map(
        (item) => item.course_id
      )
    );

  const claimableCourseIds =
    completedCourseIds.filter(
      (courseId) =>
        !certificateCourseIds.has(
          courseId
        )
    );

  const { data: claimableCourseData } =
    claimableCourseIds.length > 0
      ? await supabase
          .from("courses")
          .select("id, title")
          .in(
            "id",
            claimableCourseIds
          )
      : { data: [] };

  const claimableCourses =
    (claimableCourseData as unknown as Course[]) ||
    [];

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
              View and access your RuffNeck Learn
              course certificates.
            </p>
          </div>
        </div>

        {claimableCourses.length > 0 ? (
          <section className="rn-certificate-claim-section">
            <div>
              <span className="rn-eyebrow">
                COMPLETED COURSES
              </span>

              <h2>
                Certificates available
              </h2>

              <p>
                These courses are recorded as
                completed. Complete the certificate
                requirements to generate the
                corresponding credential.
              </p>
            </div>

            <div className="rn-certificate-claim-grid">
              {claimableCourses.map(
                (course) => (
                  <article
                    key={course.id}
                    className="rn-certificate-claim-card"
                  >
                    <span>
                      COURSE COMPLETED
                    </span>

                    <h3>
                      {course.title}
                    </h3>

                    <CertificateIssueButton
                      courseId={course.id}
                    />
                  </article>
                )
              )}
            </div>
          </section>
        ) : null}

        <section className="rn-certificate-list-section">
          <div className="rn-certificates-section-heading">
            <span className="rn-eyebrow">
              CERTIFICATES
            </span>

            <h2>
              Issued credentials
            </h2>
          </div>

          {certificates.length === 0 ? (
            <article className="rn-project-empty">
              <h2>
                No certificates yet
              </h2>

              <p>
                Complete a RuffNeck Learn course,
                its assessment and approved capstone
                to become eligible for a certificate.
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
              {certificates.map(
                (certificate) => (
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
                      <div className="rn-project-status status-revision_required">
                        Revoked
                      </div>
                    ) : (
                      <Link
                        href={`/student/certificates/${certificate.id}`}
                        className="rn-button rn-button-primary"
                      >
                        View Certificate
                      </Link>
                    )}
                  </article>
                )
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}