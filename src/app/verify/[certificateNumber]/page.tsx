import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{
    certificateNumber: string;
  }>;
}) {
  const { certificateNumber } = await params;

  const normalizedCertificateNumber =
    decodeURIComponent(certificateNumber).trim();

  if (!normalizedCertificateNumber) {
    return {
      title: "Certificate Verification | RuffNeck Learn",
      description: "Verify a RuffNeck Learn certificate.",
    };
  }

  const admin = createAdminClient();

  const { data: certificate } = await admin
    .from("course_certificates")
    .select(
      [
        "certificate_number",
        "holder_name",
        "course_title",
        "is_revoked",
      ].join(", ")
    )
    .eq("certificate_number", normalizedCertificateNumber)
    .maybeSingle();

  if (!certificate) {
    return {
      title: `Certificate ${normalizedCertificateNumber} | RuffNeck Learn`,
      description: "Verify a RuffNeck Learn certificate.",
      openGraph: {
        title: `Certificate ${normalizedCertificateNumber} | RuffNeck Learn`,
        description: "Verify a RuffNeck Learn certificate.",
        type: "website",
        siteName: "RuffNeck Learn",
      },
      twitter: {
        card: "summary",
        title: `Certificate ${normalizedCertificateNumber} | RuffNeck Learn`,
        description: "Verify a RuffNeck Learn certificate.",
      },
    };
  }

  const status = certificate.is_revoked ? "Revoked" : "Verified";

  const title = `${certificate.holder_name} — ${certificate.course_title}`;

  const description =
    `${status} RuffNeck Learn certificate ` +
    `${certificate.certificate_number}. ` +
    "Official certificate verification by RuffNeck Entertainment.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "RuffNeck Learn",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{
    certificateNumber: string;
  }>;
}) {
  const { certificateNumber } = await params;

  const normalizedCertificateNumber =
    decodeURIComponent(certificateNumber).trim();

  if (!normalizedCertificateNumber) {
    notFound();
  }

  const admin = createAdminClient();

  const {
    data: certificateData,
    error: certificateError,
  } = await admin
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
    .eq("certificate_number", normalizedCertificateNumber)
    .maybeSingle();

  if (certificateError) {
    console.error(
      "Public certificate verification failed:",
      certificateError
    );

    return (
      <main className="container">
        <section className="rn-empty-state">
          <span className="rn-eyebrow">
            CERTIFICATE VERIFICATION
          </span>

          <h1>Verification unavailable</h1>

          <p>
            The certificate verification service could not complete this
            request.
          </p>

          <Link
            href="/"
            className="rn-button rn-button-primary"
          >
            RuffNeck Learn
          </Link>
        </section>
      </main>
    );
  }

  const certificate = certificateData as Certificate | null;

  if (!certificate) {
    return (
      <main className="container">
        <section className="rn-empty-state">
          <span className="rn-eyebrow">
            CERTIFICATE VERIFICATION
          </span>

          <h1>Certificate not found</h1>

          <p>
            No RuffNeck Learn certificate matches certificate number:
          </p>

          <strong>{normalizedCertificateNumber}</strong>

          <div
            className="rn-assessment-actions"
            style={{
              marginTop: 24,
            }}
          >
            <Link
              href="/"
              className="rn-button rn-button-primary"
            >
              RuffNeck Learn
            </Link>

            <Link
              href="/courses"
              className="rn-button rn-button-secondary"
            >
              View Courses
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const verificationUrl = buildVerificationUrl(
    certificate.certificate_number
  );

  const qrCodeUrl = buildQrCodeUrl(verificationUrl);

  return (
    <main className="rn-certificate-view-page">
      <div className="container">
        <section
          className={`rn-certificate-document ${
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
                CERTIFICATE REVOKED
              </div>
            ) : (
              <span className="rn-eyebrow">
                VERIFIED CREDENTIAL
              </span>
            )}

            <h1>Certificate Verification</h1>

            {!certificate.is_revoked ? (
              <p className="rn-certificate-presented">
                This credential has been verified against the RuffNeck Learn
                certificate record.
              </p>
            ) : (
              <p className="rn-certificate-presented">
                This certificate is no longer valid.
              </p>
            )}

            <h2>{certificate.holder_name}</h2>

            <p className="rn-certificate-completion-text">
              Successfully completed the RuffNeck Learn course
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
                <span>Issuer</span>

                <strong>RuffNeck Entertainment</strong>
              </div>

              <div>
                <span>Status</span>

                <strong>
                  {certificate.is_revoked ? "Revoked" : "Valid"}
                </strong>
              </div>
            </div>

            {!certificate.is_revoked ? (
              <>
                <div className="rn-certificate-divider" />

                <div
                  className="rn-certificate-details"
                  aria-label="Certificate performance"
                >
                  <div>
                    <span>Assessment Score</span>

                    <strong>
                      {certificate.assessment_score !== null
                        ? `${certificate.assessment_score}%`
                        : "—"}
                    </strong>
                  </div>

                  <div>
                    <span>Capstone Score</span>

                    <strong>
                      {certificate.capstone_score !== null
                        ? `${certificate.capstone_score}/100`
                        : "—"}
                    </strong>
                  </div>

                  <div>
                    <span>Credential Type</span>

                    <strong>Course Completion</strong>
                  </div>

                  <div>
                    <span>Verification</span>

                    <strong>Official Registry</strong>
                  </div>
                </div>

                <div className="rn-certificate-divider" />

                <div
                  className="rn-certificate-verification"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 24,
                    flexWrap: "wrap",
                    marginTop: 24,
                    padding: 20,
                    border: "1px solid rgba(11, 30, 58, 0.12)",
                    borderRadius: 12,
                    background: "#f8fafc",
                  }}
                >
                  <div
                    style={{
                      flex: "0 0 auto",
                      width: 220,
                      textAlign: "center",
                    }}
                  >
                    <img
                      src={qrCodeUrl}
                      alt={`QR code for verifying certificate ${certificate.certificate_number}`}
                      width={220}
                      height={220}
                      style={{
                        display: "block",
                        width: 220,
                        height: 220,
                        maxWidth: "100%",
                        margin: "0 auto",
                        background: "#ffffff",
                        border: "1px solid #e5e7eb",
                      }}
                    />
                  </div>

                  <div
                    style={{
                      flex: "1 1 280px",
                      minWidth: 240,
                    }}
                  >
                    <span className="rn-eyebrow">
                      DIGITAL VERIFICATION
                    </span>

                    <h4
                      style={{
                        margin: "8px 0 10px",
                        fontSize: 20,
                        color: "#0b1e3a",
                      }}
                    >
                      Scan to verify this certificate
                    </h4>

                    <p
                      style={{
                        margin: 0,
                        lineHeight: 1.6,
                        color: "#475569",
                      }}
                    >
                      Scan the QR code with a phone camera to open the
                      official RuffNeck Learn verification record for this
                      certificate.
                    </p>

                    <p
                      style={{
                        marginTop: 12,
                        marginBottom: 0,
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: "#64748b",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {verificationUrl}
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
        </section>

        <div
          className="rn-assessment-actions"
          style={{
            marginTop: 24,
          }}
        >
          <Link
            href="/courses"
            className="rn-button rn-button-secondary"
          >
            Browse Courses
          </Link>

          <Link
            href="/"
            className="rn-button rn-button-secondary"
          >
            RuffNeck Learn
          </Link>
        </div>
      </div>
    </main>
  );
}