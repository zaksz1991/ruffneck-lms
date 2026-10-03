import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CertificatePrintButton from "@/components/CertificatePrintButton";

type Certificate = {
  id: string;
  certificate_number: string;
  holder_name: string;
  course_title: string;
  issued_at: string;
  assessment_score: number | null;
  capstone_score: number | null;
  is_revoked: boolean;
  revoked_reason: string | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(
    "en-NG",
    {
      dateStyle: "long",
    }
  ).format(new Date(value));
}

export default async function CertificatePage({
  params,
}: {
  params: Promise<{
    certificateId: string;
  }>;
}) {
  const { certificateId } =
    await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?next=/student/certificates/${certificateId}`
    );
  }

  const { data: certificateData } =
    await supabase
      .from("course_certificates")
      .select(
        [
          "id",
          "certificate_number",
          "holder_name",
          "course_title",
          "issued_at",
          "assessment_score",
          "capstone_score",
          "is_revoked",
          "revoked_reason",
        ].join(", ")
      )
      .eq("id", certificateId)
      .eq("student_id", user.id)
      .maybeSingle();

  const certificate =
    certificateData as unknown as Certificate | null;

  if (!certificate) {
    notFound();
  }

  return (
    <main className="rn-certificate-view-page">
      <div className="container">
        <div className="rn-certificate-view-actions">
          <Link
            href="/student/certificates"
            className="rn-learning-back"
          >
            ← My Certificates
          </Link>

          {!certificate.is_revoked ? (
            <CertificatePrintButton />
          ) : null}
        </div>

        <article
          className={`rn-certificate-document ${
            certificate.is_revoked
              ? "is-revoked"
              : ""
          }`}
        >
          <div className="rn-certificate-border">
            <div className="rn-certificate-brand">
              <span>RN</span>

              <strong>
                RuffNeck Learn
              </strong>
            </div>

            {certificate.is_revoked ? (
              <div className="rn-certificate-revoked">
                REVOKED
              </div>
            ) : (
              <span className="rn-eyebrow">
                CERTIFICATE OF COMPLETION
              </span>
            )}

            <h1>
              Certificate of Completion
            </h1>

            <p className="rn-certificate-presented">
              This certificate is presented to
            </p>

            <h2>
              {certificate.holder_name}
            </h2>

            <p className="rn-certificate-completion-text">
              for successfully completing the
              RuffNeck Learn course
            </p>

            <h3>
              {certificate.course_title}
            </h3>

            <div className="rn-certificate-divider" />

            <div className="rn-certificate-details">
              <div>
                <span>
                  Certificate Number
                </span>

                <strong>
                  {
                    certificate.certificate_number
                  }
                </strong>
              </div>

              <div>
                <span>
                  Date Issued
                </span>

                <strong>
                  {formatDate(
                    certificate.issued_at
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Assessment
                </span>

                <strong>
                  {certificate.assessment_score ??
                    "—"}
                  %
                </strong>
              </div>

              <div>
                <span>
                  Capstone
                </span>

                <strong>
                  {certificate.capstone_score ??
                    "—"}
                  /100
                </strong>
              </div>
            </div>

            {certificate.is_revoked &&
            certificate.revoked_reason ? (
              <div className="rn-certificate-revoked-note">
                {certificate.revoked_reason}
              </div>
            ) : null}

            <div className="rn-certificate-footer">
              <span>
                RuffNeck Entertainment
              </span>

              <span>
                Practical professional learning
              </span>
            </div>
          </div>
        </article>
      </div>
    </main>
  );
}