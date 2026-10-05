import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CertificatePrintButton from "@/components/CertificatePrintButton";
import CertificateVerificationLink from "@/components/CertificateVerificationLink";

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
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "long",
  }).format(date);
}

function buildVerificationUrl(certificateNumber: string) {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://ruffneck-lms.vercel.app";

  return `${baseUrl.replace(/\/$/, "")}/verify/${encodeURIComponent(
    certificateNumber
  )}`;
}

function buildQrCodeUrl(verificationUrl: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(
    verificationUrl
  )}`;
}

export default async function CertificatePage({
  params,
}: {
  params: Promise<{
    certificateId: string;
  }>;
}) {
  const { certificateId } = await params;

  const normalizedCertificateId = certificateId.trim();

  if (!normalizedCertificateId) {
    notFound();
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?next=/student/certificates/${encodeURIComponent(
        normalizedCertificateId
      )}`
    );
  }

  const { data: certificateData, error: certificateError } =
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
      .eq("id", normalizedCertificateId)
      .eq("student_id", user.id)
      .maybeSingle();

  if (certificateError) {
    console.error(
      "Certificate lookup failed:",
      certificateError
    );

    throw new Error("Unable to load certificate.");
  }

  const certificate =
    certificateData as unknown as Certificate | null;

  if (!certificate) {
    notFound();
  }

  const verificationUrl = `/verify/${encodeURIComponent(
    certificate.certificate_number
  )}`;

  const fullVerificationUrl = buildVerificationUrl(
    certificate.certificate_number
  );

  const qrCodeUrl = buildQrCodeUrl(fullVerificationUrl);

  return (
    <main className="rn-certificate-view-page">
      <div className="container">
        <div className="rn-certificate-view-actions no-print">
          <Link
            href="/student/certificates"
            className="rn-learning-back"
          >
            ← My Certificates
          </Link>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <Link
              href={verificationUrl}
              className="rn-button rn-button-secondary"
            >
              Verify Certificate
            </Link>

            {!certificate.is_revoked ? (
              <CertificatePrintButton />
            ) : null}
          </div>
        </div>

        <article
          className={`rn-certificate-document certificate-print-area ${
            certificate.is_revoked ? "is-revoked" : ""
          }`}
        >
          <div className="rn-certificate-border">
            <div className="rn-certificate-brand">
              <span aria-hidden="true">RN</span>

              <strong>RuffNeck Learn</strong>
            </div>

            {certificate.is_revoked ? (
              <div
                className="rn-certificate-revoked"
                role="alert"
              >
                REVOKED
              </div>
            ) : (
              <span className="rn-eyebrow">
                CERTIFICATE OF COMPLETION
              </span>
            )}

            <h1>Certificate of Completion</h1>

            <p className="rn-certificate-presented">
              This certificate is presented to
            </p>

            <h2>{certificate.holder_name}</h2>

            <p className="rn-certificate-completion-text">
              for successfully completing the RuffNeck Learn
              course
            </p>

            <h3>{certificate.course_title}</h3>

            <div className="rn-certificate-divider" />

            <div className="rn-certificate-details">
              <div>
                <span>Certificate Number</span>

                <strong>
                  {certificate.certificate_number}
                </strong>
              </div>

              <div>
                <span>Date Issued</span>

                <strong>
                  {formatDate(certificate.issued_at)}
                </strong>
              </div>

              <div>
                <span>Assessment</span>

                <strong>
                  {certificate.assessment_score ?? "—"}%
                </strong>
              </div>

              <div>
                <span>Capstone</span>

                <strong>
                  {certificate.capstone_score ?? "—"}/100
                </strong>
              </div>
            </div>

            {!certificate.is_revoked ? (
              <>
                <div className="rn-certificate-divider" />

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 20,
                    flexWrap: "wrap",
                    marginTop: 20,
                    padding: 16,
                    border: "1px solid rgba(11, 30, 58, 0.12)",
                    borderRadius: 10,
                    background: "#f8fafc",
                  }}
                >
                  <div
                    style={{
                      flex: "0 0 auto",
                      textAlign: "center",
                    }}
                  >
                    <img
                      src={qrCodeUrl}
                      alt={`QR code for verifying certificate ${certificate.certificate_number}`}
                      width={150}
                      height={150}
                      style={{
                        display: "block",
                        width: 150,
                        height: 150,
                        background: "#ffffff",
                        border: "1px solid #e5e7eb",
                      }}
                    />
                  </div>

                  <div
                    style={{
                      flex: "1 1 280px",
                      minWidth: 220,
                    }}
                  >
                    <span className="rn-eyebrow">
                      DIGITAL VERIFICATION
                    </span>

                    <h4
                      style={{
                        margin: "6px 0 8px",
                        fontSize: 17,
                        color: "#0b1e3a",
                      }}
                    >
                      Scan to verify this certificate
                    </h4>

                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: "#475569",
                      }}
                    >
                      Scan this QR code to open the official RuffNeck Learn
                      verification record.
                    </p>
                  </div>
                </div>
              </>
            ) : null}

            {certificate.is_revoked &&
            certificate.revoked_reason ? (
              <div className="rn-certificate-revoked-note">
                {certificate.revoked_reason}
              </div>
            ) : null}

            <div className="rn-certificate-footer">
              <span>RuffNeck Entertainment</span>

              <span>
                Practical professional learning
              </span>
            </div>
          </div>
        </article>

        {!certificate.is_revoked ? (
          <div className="no-print">
            <CertificateVerificationLink
              certificateNumber={
                certificate.certificate_number
              }
            />
          </div>
        ) : null}
      </div>
    </main>
  );
}