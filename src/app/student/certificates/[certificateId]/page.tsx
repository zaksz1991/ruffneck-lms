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

function buildVerificationUrl(
  verificationCode: string
) {
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

function buildQrCodeUrl(
  verificationUrl: string
) {
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

  const normalizedCertificateId =
    certificateId.trim();

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

    throw new Error(
      "Unable to load certificate."
    );
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
      .eq(
        "certificate_id",
        certificate.id
      )
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

  const verificationUrl =
    verification
      ? buildVerificationUrl(
          verification.verification_code
        )
      : null;

  const qrCodeUrl =
    verificationUrl
      ? buildQrCodeUrl(verificationUrl)
      : null;

  const verificationIsValid =
    Boolean(
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
            <div className="rn-certificate-inner">
              <header className="rn-certificate-header">
                <div className="rn-certificate-brand">
                  <img
                    src="/brand/ruffneck-logo.png"
                    alt="RuffNeck Entertainment"
                    className="rn-certificate-logo"
                  />

                  <div className="rn-certificate-brand-text">
                    <strong>
                      RuffNeck Learn
                    </strong>

                    <span>
                      Professional Learning &amp;
                      Digital Skills
                    </span>
                  </div>
                </div>

                <div className="rn-certificate-header-rule" />
              </header>

              {certificate.is_revoked ? (
                <div
                  className="rn-certificate-revoked"
                  role="alert"
                >
                  REVOKED
                </div>
              ) : (
                <p className="rn-certificate-eyebrow">
                  CERTIFICATE OF COMPLETION
                </p>
              )}

              <section className="rn-certificate-main">
                <h1>
                  Certificate of Completion
                </h1>

                <p className="rn-certificate-presented">
                  This certificate is proudly
                  presented to
                </p>

                <h2>
                  {certificate.holder_name}
                </h2>

                <div className="rn-certificate-name-line" />

                <p className="rn-certificate-completion-text">
                  for successfully completing the
                  RuffNeck Learn professional course
                </p>

                <h3>
                  {certificate.course_title}
                </h3>
              </section>

              <div className="rn-certificate-divider" />

              <section
                className="rn-certificate-details"
                aria-label="Certificate details"
              >
                <div className="rn-certificate-detail">
                  <span>
                    Certificate Number
                  </span>

                  <strong>
                    {certificate.certificate_number}
                  </strong>
                </div>

                <div className="rn-certificate-detail">
                  <span>
                    Date Issued
                  </span>

                  <strong>
                    {formatDate(
                      certificate.issued_at
                    )}
                  </strong>
                </div>

                <div className="rn-certificate-detail">
                  <span>
                    Assessment
                  </span>

                  <strong>
                    {certificate.assessment_score ??
                      "—"}
                    %
                  </strong>
                </div>

                <div className="rn-certificate-detail">
                  <span>
                    Capstone
                  </span>

                  <strong>
                    {certificate.capstone_score ??
                      "—"}
                    /100
                  </strong>
                </div>
              </section>

              {!certificate.is_revoked &&
              verification &&
              verificationUrl &&
              qrCodeUrl ? (
                <>
                  <div className="rn-certificate-divider" />

                  <section className="rn-certificate-verification">
                    <div className="rn-certificate-qr">
                      <img
                        src={qrCodeUrl}
                        alt={`QR code for verifying certificate ${certificate.certificate_number}`}
                        width={180}
                        height={180}
                      />
                    </div>

                    <div className="rn-certificate-verification-content">
                      <span className="rn-certificate-section-label">
                        DIGITAL VERIFICATION
                      </span>

                      <h4>
                        Verify this certificate
                      </h4>

                      <p>
                        Scan the QR code to open
                        the official RuffNeck Learn
                        verification record.
                      </p>

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

                      {!verificationIsValid ? (
                        <p className="rn-certificate-verification-warning">
                          Verification is currently
                          inactive or expired.
                        </p>
                      ) : null}
                    </div>
                  </section>
                </>
              ) : null}

              {certificate.is_revoked &&
              certificate.revoked_reason ? (
                <div className="rn-certificate-revoked-note">
                  {certificate.revoked_reason}
                </div>
              ) : null}

              <footer className="rn-certificate-footer">
                <div className="rn-certificate-signature">
                  <span className="rn-certificate-signature-line" />
                  <strong>
                    RuffNeck Entertainment
                  </strong>
                  <span>
                    RuffNeck Learn
                  </span>
                </div>

                <div className="rn-certificate-footer-center">
                  <span>
                    Professional Learning
                  </span>

                  <span>
                    &amp; Digital Skills
                  </span>
                </div>

                <div className="rn-certificate-footer-meta">
                  <strong>
                    {certificate.certificate_number}
                  </strong>

                  <span>
                    Issued {formatDate(
                      certificate.issued_at
                    )}
                  </span>
                </div>
              </footer>
            </div>
          </div>
        </article>

        {!certificate.is_revoked ? (
          <div className="no-print">
            <CertificateVerification
              certificateId={
                certificate.id
              }
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