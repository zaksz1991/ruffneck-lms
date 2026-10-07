import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CertificatePrintButton from "@/components/CertificatePrintButton";
import CertificateVerification from "../CertificateVerification";

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

type CertificateVerificationRecord = {
  id: string;
  certificate_id: string;
  verification_code: string;
  is_active: boolean;
  expires_at: string | null;
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

function buildVerificationUrl(verificationCode: string) {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://ruffneck-lms.vercel.app";

  return `${baseUrl.replace(
    /\/$/,
    ""
  )}/verify/certificate/${encodeURIComponent(
    verificationCode
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

  let verification:
    | CertificateVerificationRecord
    | null = null;

  if (!certificate.is_revoked) {
    const {
      data: verificationData,
      error: verificationError,
    } = await supabase
      .from("certificate_verifications")
      .select(
        [
          "id",
          "certificate_id",
          "verification_code",
          "is_active",
          "expires_at",
        ].join(", ")
      )
      .eq("certificate_id", certificate.id)
      .maybeSingle();

    if (verificationError) {
      console.error(
        "Certificate verification lookup failed:",
        verificationError
      );
    } else {
      verification =
        verificationData as CertificateVerificationRecord | null;
    }
  }

  const verificationUrl = verification
    ? buildVerificationUrl(
        verification.verification_code
      )
    : null;

  const qrCodeUrl = verificationUrl
    ? buildQrCodeUrl(verificationUrl)
    : null;

  const verificationIsValid = Boolean(
    verification &&
      verification.is_active &&
      (!verification.expires_at ||
        new Date(
          verification.expires_at
        ).getTime() > Date.now())
  );

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
            <div className="rn-certificate-security-pattern" />

            <div className="rn-certificate-inner">
              {/* BRAND HEADER */}
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

                <div className="rn-certificate-header-accent">
                  <span />
                  <span />
                  <span />
                </div>
              </header>

              {/* MAIN TITLE — ONLY ONE CERTIFICATE OF COMPLETION */}
              {certificate.is_revoked ? (
                <div
                  className="rn-certificate-revoked"
                  role="alert"
                >
                  REVOKED
                </div>
              ) : null}

              <section className="rn-certificate-main">
                <h1>
                  Certificate of Completion
                </h1>

                <p className="rn-certificate-presented">
                  This Certificate is Proudly Presented to
                </p>

                <h2>
                  {certificate.holder_name}
                </h2>

                <div className="rn-certificate-name-rule">
                  <span />
                </div>

                <p className="rn-certificate-completion-text">
                  For successfully completing the
                </p>

                <h3>
                  {certificate.course_title}
                </h3>
              </section>

              {/* CREDENTIAL INFORMATION */}
              <section
                className="rn-certificate-credential-strip"
                aria-label="Certificate credentials"
              >
                <div className="rn-certificate-credential">
                  <span>Credential</span>
                  <strong>
                    Course Completion
                  </strong>
                </div>

                <div className="rn-certificate-credential">
                  <span>Date Issued</span>
                  <strong>
                    {formatDate(
                      certificate.issued_at
                    )}
                  </strong>
                </div>

                <div className="rn-certificate-credential">
                  <span>Assessment</span>
                  <strong>
                    {certificate.assessment_score ??
                      "—"}
                    %
                  </strong>
                </div>

                <div className="rn-certificate-credential">
                  <span>Capstone</span>
                  <strong>
                    {certificate.capstone_score ??
                      "—"}
                    /100
                  </strong>
                </div>
              </section>

              <div className="rn-certificate-number">
                <span>
                  Certificate No.
                </span>

                <strong>
                  {certificate.certificate_number}
                </strong>
              </div>

              {/* AUTHENTICATION */}
              <section className="rn-certificate-authentication">
                <div className="rn-certificate-verification-panel">
                  {qrCodeUrl ? (
                    <div className="rn-certificate-qr-frame">
                      <img
                        src={qrCodeUrl}
                        alt={`QR code for verifying certificate ${certificate.certificate_number}`}
                        width={150}
                        height={150}
                      />
                    </div>
                  ) : (
                    <div className="rn-certificate-qr-placeholder">
                      <span>
                        DIGITAL
                      </span>
                      <strong>
                        CREDENTIAL
                      </strong>
                    </div>
                  )}

                  <div className="rn-certificate-verification-copy">
                    <span className="rn-certificate-section-label">
                      DIGITAL CREDENTIAL
                    </span>

                    <h4>
                      Official Verification
                    </h4>

                    <p>
                      Scan the QR code to access
                      the official RuffNeck Learn
                      certificate verification record.
                    </p>

                    {verification ? (
                      <>
                        <div className="rn-certificate-verification-code">
                          <span>
                            Verification Code
                          </span>

                          <strong>
                            {
                              verification.verification_code
                            }
                          </strong>
                        </div>

                        <span
                          className={`rn-certificate-validity ${
                            verificationIsValid
                              ? "is-valid"
                              : "is-invalid"
                          }`}
                        >
                          <span className="rn-certificate-validity-dot" />

                          {verificationIsValid
                            ? "Official credential verification available"
                            : "Verification inactive or expired"}
                        </span>
                      </>
                    ) : (
                      <span className="rn-certificate-validity is-valid">
                        <span className="rn-certificate-validity-dot" />
                        RuffNeck Learn credential
                      </span>
                    )}
                  </div>
                </div>

                {/* SEALS ARE NOW INDEPENDENT OF VERIFICATION */}
                <div className="rn-certificate-seal-panel">
                  <img
                    src="/brand/ruffneck-certificate-seal.png"
                    alt="RuffNeck Learn Certificate Seal"
                    className="rn-certificate-seal"
                  />

                  <img
                    src="/brand/ruffneck-security-stamp.png"
                    alt=""
                    aria-hidden="true"
                    className="rn-certificate-security-stamp"
                  />
                </div>
              </section>

              {certificate.is_revoked &&
              certificate.revoked_reason ? (
                <div className="rn-certificate-revoked-note">
                  {certificate.revoked_reason}
                </div>
              ) : null}

              {/* ISSUER / FOOTER */}
              <footer className="rn-certificate-footer">
                <div className="rn-certificate-signatory">
                  <div className="rn-certificate-signature-wrap">
                    <img
                      src="/brand/founder-signature.png"
                      alt="Hassan Zakariya signature"
                      className="rn-certificate-signature-image"
                    />
                  </div>

                  <div className="rn-certificate-signature-line" />

                  <strong>
                    Hassan Zakariya
                  </strong>

                  <span>
                    Founder &amp; CEO
                  </span>

                  <span>
                    RuffNeck Entertainment
                  </span>
                </div>

                <div className="rn-certificate-institution">
                  <img
                    src="/brand/ruffneck-company-stamp.png"
                    alt=""
                    aria-hidden="true"
                    className="rn-certificate-company-stamp"
                  />

                  <div>
                    <strong>
                      RuffNeck Entertainment
                    </strong>

                    <span>
                      Professional Learning &amp;
                      Digital Skills
                    </span>
                  </div>
                </div>

                <div className="rn-certificate-footer-meta">
                  <strong>
                    {certificate.certificate_number}
                  </strong>

                  <span>
                    Issued{" "}
                    {formatDate(
                      certificate.issued_at
                    )}
                  </span>

                  <span>
                    RUFFNECK LEARN
                  </span>
                </div>
              </footer>
            </div>
          </div>
        </article>

        {!certificate.is_revoked ? (
          <div className="no-print">
            <CertificateVerification
              certificateId={certificate.id}
              certificateNumber={
                certificate.certificate_number
              }
              isRevoked={
                certificate.is_revoked
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