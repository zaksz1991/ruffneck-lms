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

/**
 * Canonical public certificate verification URL.
 *
 * This must remain consistent with:
 * /src/app/verify/certificate-number/[certificateNumber]/page.tsx
 */
function buildVerificationUrl(certificateNumber: string) {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://ruffneck-lms.vercel.app";

  return `${baseUrl.replace(
    /\/$/,
    ""
  )}/verify/certificate-number/${encodeURIComponent(
    certificateNumber
  )}`;
}

function buildQrCodeUrl(verificationUrl: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&format=png&margin=12&data=${encodeURIComponent(
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

  const {
    data: certificateData,
    error: certificateError,
  } = await supabase
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

  /**
   * Canonical verification path.
   *
   * Do not use /verify/{certificateNumber}.
   */
  const verificationUrl = `/verify/certificate-number/${encodeURIComponent(
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

          <div className="rn-certificate-action-group">
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
            <div
              className="rn-certificate-watermark"
              aria-hidden="true"
            />

            <div
              className="rn-certificate-security-pattern"
              aria-hidden="true"
            />

            <div className="rn-certificate-inner">
              <header className="rn-certificate-header">
                <img
                  src="/brand/ruffneck-logo.png"
                  alt="RuffNeck Entertainment"
                  className="rn-certificate-logo"
                />

                <div className="rn-certificate-learn-name">
                  RUFFNECK LEARN
                </div>

                <div className="rn-certificate-tagline">
                  AI • Digital Transformation • Business Solutions
                </div>

                <div
                  className="rn-certificate-header-accent"
                  aria-hidden="true"
                >
                  <span />
                  <span />
                  <span />
                </div>
              </header>

              {certificate.is_revoked ? (
                <div
                  className="rn-certificate-revoked"
                  role="alert"
                >
                  REVOKED
                </div>
              ) : null}

              <section className="rn-certificate-main">
                <div className="rn-certificate-eyebrow">
                  CERTIFICATE OF COMPLETION
                </div>

                <h1>Certificate of Completion</h1>

                <p className="rn-certificate-presented">
                  This Certificate is Proudly Presented to
                </p>

                <h2>{certificate.holder_name}</h2>

                <div
                  className="rn-certificate-name-rule"
                  aria-hidden="true"
                >
                  <span />
                </div>

                <p className="rn-certificate-completion-text">
                  For successfully completing the
                </p>

                <h3>{certificate.course_title}</h3>
              </section>

              <section
                className="rn-certificate-credential-strip"
                aria-label="Certificate credentials"
              >
                <div className="rn-certificate-credential">
                  <span>Credential</span>
                  <strong>Course Completion</strong>
                </div>

                <div className="rn-certificate-credential">
                  <span>Date Issued</span>
                  <strong>
                    {formatDate(certificate.issued_at)}
                  </strong>
                </div>

                <div className="rn-certificate-credential">
                  <span>Assessment</span>
                  <strong>
                    {certificate.assessment_score ?? "—"}%
                  </strong>
                </div>

                <div className="rn-certificate-credential">
                  <span>Capstone</span>
                  <strong>
                    {certificate.capstone_score ?? "—"}/100
                  </strong>
                </div>
              </section>

              <div className="rn-certificate-number">
                <span>Certificate No.</span>

                <strong>
                  {certificate.certificate_number}
                </strong>
              </div>

              {!certificate.is_revoked ? (
                <section
                  className="rn-certificate-authentication"
                  aria-label="Certificate authentication"
                >
                  <div className="rn-certificate-qr-panel">
                    <div className="rn-certificate-qr-frame">
                      <img
                        src={qrCodeUrl}
                        alt={`QR code for verifying certificate ${certificate.certificate_number}`}
                        width={220}
                        height={220}
                        className="rn-certificate-qr-image"
                      />
                    </div>

                    <div className="rn-certificate-qr-copy">
                      <strong>SCAN TO VERIFY</strong>

                      <span>
                        Official RuffNeck Learn verification
                      </span>

                      <small>
                        {certificate.certificate_number}
                      </small>
                    </div>
                  </div>

                  <div className="rn-certificate-authentication-branding">
                    <img
                      src="/brand/ruffneck-certificate-seal.png"
                      alt="RuffNeck Learn Certificate Seal"
                      className="rn-certificate-seal"
                    />

                    <img
                      src="/brand/ruffneck-security-stamp.png"
                      alt="RuffNeck security verification stamp"
                      className="rn-certificate-security-stamp"
                    />
                  </div>
                </section>
              ) : null}

              {certificate.is_revoked &&
              certificate.revoked_reason ? (
                <div className="rn-certificate-revoked-note">
                  {certificate.revoked_reason}
                </div>
              ) : null}

              <footer className="rn-certificate-footer">
                <div className="rn-certificate-signatory">
                  <div className="rn-certificate-signature-wrap">
                    <img
                      src="/brand/founder-signature.png"
                      alt="Hassan Zakariya signature"
                      className="rn-certificate-signature-image"
                    />
                  </div>

                  <div
                    className="rn-certificate-signature-line"
                    aria-hidden="true"
                  />

                  <strong>Hassan Zakariya</strong>

                  <span>Founder &amp; CEO</span>

                  <span>RuffNeck Entertainment</span>
                </div>

                <div className="rn-certificate-institution">
                  <img
                    src="/brand/ruffneck-company-stamp.png"
                    alt="RuffNeck Entertainment company stamp"
                    className="rn-certificate-company-stamp"
                  />

                  <div className="rn-certificate-institution-copy">
                    <strong>RuffNeck Entertainment</strong>

                    <span>
                      Professional Learning &amp; Digital Skills
                    </span>
                  </div>
                </div>

                <div className="rn-certificate-footer-meta">
                  <strong>
                    {certificate.certificate_number}
                  </strong>

                  <span>
                    Issued{" "}
                    {formatDate(certificate.issued_at)}
                  </span>

                  <span>RUFFNECK LEARN</span>
                </div>
              </footer>
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

        <div className="rn-assessment-actions rn-certificate-bottom-actions no-print">
          <Link
            href="/student/certificates"
            className="rn-button rn-button-secondary"
          >
            All Certificates
          </Link>

          <Link
            href="/courses"
            className="rn-button rn-button-secondary"
          >
            Browse Courses
          </Link>
        </div>
      </div>
    </main>
  );
}