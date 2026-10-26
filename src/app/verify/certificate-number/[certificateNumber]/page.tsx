import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

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

type VerificationRecord = {
  id: string;
  is_active: boolean;
  expires_at: string | null;
};

type VerificationStatus = {
  isVerified: boolean;
  status: "verified" | "revoked" | "inactive";
};

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://ruffneck-lms.vercel.app"
).replace(/\/+$/, "");

function buildVerificationUrl(certificateNumber: string) {
  return `${SITE_URL}/verify/certificate-number/${encodeURIComponent(
    certificateNumber,
  )}`;
}

function buildOpenGraphImageUrl(certificateNumber: string) {
  return `${buildVerificationUrl(certificateNumber)}/opengraph-image`;
}

function buildQrCodeUrl(verificationUrl: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&format=png&margin=8&data=${encodeURIComponent(
    verificationUrl,
  )}`;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (!value || Number.isNaN(date.getTime())) {
    return "Date not recorded";
  }

  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Lagos",
  }).format(date);
}

function formatAssessmentScore(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "Not recorded";
  }

  return `${Math.round(value)}%`;
}

function formatCapstoneScore(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "Not recorded";
  }

  return `${Math.round(value)}/100`;
}

function normalizeCertificateNumber(value: string) {
  return value.trim();
}

async function getCertificate(
  certificateNumber: string,
): Promise<Certificate | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
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
      ].join(", "),
    )
    .eq("certificate_number", certificateNumber)
    .maybeSingle();

  if (error) {
    console.error(
      "Public certificate lookup failed:",
      error.message,
    );

    throw new Error("Unable to verify certificate.");
  }

  if (!data) {
    return null;
  }

  return data as unknown as Certificate;
}

async function getVerificationRecord(
  certificateId: string,
): Promise<VerificationRecord | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("certificate_verifications")
    .select("id, is_active, expires_at")
    .eq("certificate_id", certificateId)
    .eq("is_active", true)
    .limit(2);

  if (error) {
    console.error(
      "Certificate verification record lookup failed:",
      error.message,
    );

    throw new Error("Unable to verify certificate.");
  }

  // Maintain the existing requirement for exactly one active record.
  if (!data || data.length !== 1) {
    return null;
  }

  return data[0] as VerificationRecord;
}

function isVerificationRecordValid(
  record: VerificationRecord | null,
) {
  if (!record || !record.is_active) {
    return false;
  }

  if (record.expires_at) {
    const expiryTime = new Date(record.expires_at).getTime();

    if (
      Number.isNaN(expiryTime) ||
      expiryTime <= Date.now()
    ) {
      return false;
    }
  }

  return true;
}

async function getVerificationStatus(
  certificate: Certificate,
): Promise<VerificationStatus> {
  if (certificate.is_revoked) {
    return {
      isVerified: false,
      status: "revoked",
    };
  }

  const record = await getVerificationRecord(certificate.id);

  if (!isVerificationRecordValid(record)) {
    return {
      isVerified: false,
      status: "inactive",
    };
  }

  return {
    isVerified: true,
    status: "verified",
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{
    certificateNumber: string;
  }>;
}): Promise<Metadata> {
  const { certificateNumber } = await params;

  const normalizedCertificateNumber =
    normalizeCertificateNumber(certificateNumber);

  if (!normalizedCertificateNumber) {
    return {
      title: "Certificate Not Found | RuffNeck Learn",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const certificate = await getCertificate(
    normalizedCertificateNumber,
  );

  if (!certificate) {
    return {
      title: "Certificate Not Found | RuffNeck Learn",
      description:
        "The requested RuffNeck Learn certificate could not be found.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const verification = await getVerificationStatus(certificate);

  const verificationUrl = buildVerificationUrl(
    certificate.certificate_number,
  );

  const imageUrl = buildOpenGraphImageUrl(
    certificate.certificate_number,
  );

  const title =
    verification.status === "verified"
      ? "Verified Certificate | RuffNeck Learn"
      : verification.status === "revoked"
        ? "Revoked Certificate | RuffNeck Learn"
        : "Certificate Verification Unavailable | RuffNeck Learn";

  const description =
    verification.status === "verified"
      ? `Official RuffNeck Learn certificate verification for ${certificate.holder_name}, awarded for completing ${certificate.course_title}.`
      : verification.status === "revoked"
        ? "This RuffNeck Learn certificate has been revoked and is no longer valid."
        : "The verification record for this RuffNeck Learn certificate is inactive or unavailable.";

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    alternates: {
      canonical: verificationUrl,
    },
    robots: {
      index: verification.isVerified,
      follow: true,
    },
    openGraph: {
      title,
      description,
      url: verificationUrl,
      siteName: "RuffNeck Learn",
      type: "website",
      locale: "en_NG",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: "RuffNeck Learn certificate verification",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

const PAGE_STYLES = `
  .rn-public-verification-page {
    --verify-navy: #0b1e3a;
    --verify-blue: #1264a3;
    --verify-cyan: #00b4d8;
    --verify-ink: #26364c;
    --verify-muted: #64748b;
    --verify-border: #e2e8f0;

    min-height: 100vh;
    padding: 35px 0 46px;
    background: #f3f6f9;
    color: var(--verify-ink);
  }

  .rn-public-verification-page *,
  .rn-public-verification-page *::before,
  .rn-public-verification-page *::after {
    box-sizing: border-box;
  }

  .rn-public-verification-page a {
    text-decoration: none;
  }

  .rn-public-verification-page .rn-public-verification-shell {
    width: min(100%, 1000px);
    margin: 0 auto;
  }

  .rn-public-verification-page .rn-public-verification-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 23px;
    padding: 18px 23px;
    border: 1px solid var(--verify-border);
    border-radius: 13px;
    background: #fff;
    box-shadow: 0 2px 9px rgba(11, 30, 58, .025);
  }

  .rn-public-verification-page .rn-public-verification-brand {
    display: inline-flex;
    min-width: 0;
    align-items: center;
    gap: 13px;
    color: var(--verify-navy);
    text-decoration: none;
  }

  .rn-public-verification-page .rn-public-verification-logo {
    display: block;
    width: 49px;
    height: 49px;
    flex: 0 0 49px;
    object-fit: contain;
  }

  .rn-public-verification-page .rn-public-verification-brand-copy {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 4px;
  }

  .rn-public-verification-page .rn-public-verification-brand strong {
    color: var(--verify-navy);
    font-size: 19px;
    font-weight: 850;
    letter-spacing: -.4px;
  }

  .rn-public-verification-page .rn-public-verification-brand span {
    color: var(--verify-muted);
    font-size: 10px;
    line-height: 1.6;
  }

  .rn-public-verification-page .rn-public-verification-public-label {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 8px 11px;
    border: 1px solid #dce8f6;
    border-radius: 8px;
    background: #f6faff;
    color: #315574;
    font-size: 11px;
    font-weight: 750;
    white-space: nowrap;
  }

  .rn-public-verification-page .rn-public-verification-public-label::before {
    content: "";
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--verify-cyan);
  }

  .rn-public-verification-page .rn-public-verification-card {
    overflow: hidden;
    border: 1px solid var(--verify-border);
    border-radius: 17px;
    background: #fff;
    box-shadow: 0 8px 30px rgba(11, 30, 58, .055);
  }

  .rn-public-verification-page .rn-public-verification-topline {
    height: 5px;
    background: linear-gradient(
      90deg,
      var(--verify-navy),
      var(--verify-blue),
      var(--verify-cyan)
    );
  }

  .rn-public-verification-page .rn-public-verification-content {
    padding: 32px;
  }

  .rn-public-verification-page .rn-public-verification-status {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    min-height: 32px;
    padding: 7px 11px;
    border: 1px solid transparent;
    border-radius: 7px;
    font-size: 10px;
    font-weight: 850;
    letter-spacing: .8px;
    line-height: 1.4;
  }

  .rn-public-verification-page .rn-public-verification-status-dot {
    width: 8px;
    height: 8px;
    flex: 0 0 8px;
    border-radius: 50%;
    background: currentColor;
  }

  .rn-public-verification-page .is-verified .rn-public-verification-status {
    border-color: #bce8ce;
    background: #effbf3;
    color: #187442;
  }

  .rn-public-verification-page .is-revoked .rn-public-verification-status {
    border-color: #f2c7cc;
    background: #fff1f2;
    color: #a32635;
  }

  .rn-public-verification-page .is-inactive .rn-public-verification-status {
    border-color: #f3dfb4;
    background: #fffaec;
    color: #8d5a06;
  }

  .rn-public-verification-page .rn-public-verification-heading {
    margin: 19px 0 9px;
    color: var(--verify-navy);
    font-size: clamp(27px, 4vw, 36px);
    font-weight: 850;
    letter-spacing: -1.1px;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .rn-public-verification-page .rn-public-verification-intro {
    max-width: 740px;
    margin: 0;
    color: var(--verify-muted);
    font-size: 14px;
    line-height: 1.85;
  }

  .rn-public-verification-page .rn-public-verification-credential {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr);
    gap: 15px;
    margin-top: 27px;
  }

  .rn-public-verification-page .rn-public-verification-recipient,
  .rn-public-verification-page .rn-public-verification-course {
    min-width: 0;
    padding: 20px;
    border: 1px solid #e6edf5;
    border-radius: 12px;
    background: #f8fafd;
  }

  .rn-public-verification-page .rn-public-verification-recipient {
    border-left: 4px solid var(--verify-cyan);
  }

  .rn-public-verification-page .rn-public-verification-course {
    border-left: 4px solid #9ab3d0;
  }

  .rn-public-verification-page .rn-public-verification-credential span,
  .rn-public-verification-page .rn-public-verification-details span {
    display: block;
    margin-bottom: 8px;
    color: var(--verify-muted);
    font-size: 11px;
    font-weight: 700;
    line-height: 1.6;
  }

  .rn-public-verification-page .rn-public-verification-credential strong {
    display: block;
    color: var(--verify-navy);
    font-size: 17px;
    font-weight: 850;
    line-height: 1.6;
    overflow-wrap: anywhere;
  }

  .rn-public-verification-page .rn-public-verification-details {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-top: 20px;
  }

  .rn-public-verification-page .rn-public-verification-details > div {
    min-width: 0;
    padding: 15px;
    border: 1px solid #e8edf4;
    border-radius: 10px;
    background: #fff;
  }

  .rn-public-verification-page .rn-public-verification-details strong {
    display: block;
    color: var(--verify-navy);
    font-size: 13px;
    font-weight: 800;
    line-height: 1.65;
    overflow-wrap: anywhere;
  }

  .rn-public-verification-page .rn-public-verification-revoked {
    display: flex;
    flex-direction: column;
    gap: 7px;
    margin-top: 20px;
    padding: 17px 18px;
    border: 1px solid #efc5c9;
    border-radius: 10px;
    background: #fff5f5;
    color: #84202b;
  }

  .rn-public-verification-page .rn-public-verification-revoked strong {
    font-size: 13px;
    font-weight: 850;
  }

  .rn-public-verification-page .rn-public-verification-revoked span {
    font-size: 12px;
    line-height: 1.75;
    overflow-wrap: anywhere;
  }

  .rn-public-verification-page .rn-public-verification-inactive {
    border-color: #efdfb7;
    background: #fffaf0;
    color: #815506;
  }

  .rn-public-verification-page .rn-public-verification-auth {
    display: grid;
    grid-template-columns: 170px minmax(0, 1fr);
    align-items: center;
    gap: 24px;
    margin-top: 24px;
    padding: 23px;
    border: 1px solid #dbe8f5;
    border-radius: 13px;
    background: linear-gradient(135deg, #f4f9ff, #fff 80%);
  }

  .rn-public-verification-page .rn-public-verification-qr {
    display: flex;
    width: 160px;
    aspect-ratio: 1;
    align-items: center;
    justify-content: center;
    padding: 8px;
    border: 1px solid #dce5ee;
    border-radius: 10px;
    background: #fff;
  }

  .rn-public-verification-page .rn-public-verification-qr img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .rn-public-verification-page .rn-public-verification-auth-copy {
    min-width: 0;
  }

  .rn-public-verification-page .rn-public-verification-auth-copy > span {
    display: block;
    margin-bottom: 8px;
    color: #087e9b;
    font-size: 10px;
    font-weight: 850;
    letter-spacing: 1.2px;
    line-height: 1.6;
  }

  .rn-public-verification-page .rn-public-verification-auth-copy > strong {
    display: block;
    color: var(--verify-navy);
    font-size: 21px;
    font-weight: 850;
    line-height: 1.4;
  }

  .rn-public-verification-page .rn-public-verification-auth-copy p {
    margin: 8px 0 12px;
    color: var(--verify-muted);
    font-size: 12px;
    line-height: 1.8;
  }

  .rn-public-verification-page .rn-public-verification-url {
    display: block;
    max-width: 100%;
    padding: 10px 12px;
    border: 1px solid #e2eaf4;
    border-radius: 8px;
    background: #fff;
    color: #315574;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 11px;
    line-height: 1.7;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  .rn-public-verification-page .rn-public-verification-qr-link {
    display: inline-flex;
    margin-top: 12px;
    color: #1264a3;
    font-size: 12px;
    font-weight: 800;
    line-height: 1.6;
  }

  .rn-public-verification-page .rn-public-verification-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 11px;
    margin-top: 27px;
    padding-top: 22px;
    border-top: 1px solid #e8edf4;
  }

  .rn-public-verification-page .rn-verification-button {
    display: inline-flex;
    min-height: 43px;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 11px 17px;
    border: 1px solid #d5dfeb;
    border-radius: 9px;
    background: #fff;
    color: #263b55;
    font-size: 12px;
    font-weight: 800;
    line-height: 1.5;
    text-align: center;
    transition: box-shadow .18s ease, transform .18s ease;
  }

  .rn-public-verification-page .rn-verification-button:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(11, 30, 58, .08);
  }

  .rn-public-verification-page .rn-verification-button-primary {
    border-color: var(--verify-navy);
    background: var(--verify-navy);
    color: #fff;
  }

  .rn-public-verification-page .rn-verification-button:focus-visible {
    outline: 3px solid rgba(0, 180, 216, .35);
    outline-offset: 3px;
  }

  .rn-public-verification-page .rn-public-verification-footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 18px;
    padding: 20px 5px 0;
    color: var(--verify-muted);
    font-size: 11px;
    line-height: 1.7;
  }

  .rn-public-verification-page .rn-public-verification-footer strong {
    color: var(--verify-navy);
    font-size: 12px;
    font-weight: 850;
  }

  .rn-public-verification-page .rn-public-verification-footer span {
    overflow-wrap: anywhere;
  }

  @media (max-width: 760px) {
    .rn-public-verification-page {
      padding: 17px 0 30px;
    }

    .rn-public-verification-page .rn-public-verification-header {
      padding: 15px;
    }

    .rn-public-verification-page .rn-public-verification-content {
      padding: 23px 20px;
    }

    .rn-public-verification-page .rn-public-verification-credential {
      grid-template-columns: minmax(0, 1fr);
      gap: 10px;
      margin-top: 22px;
    }

    .rn-public-verification-page .rn-public-verification-details {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .rn-public-verification-page .rn-public-verification-auth {
      grid-template-columns: minmax(0, 1fr);
      justify-items: start;
      gap: 17px;
      padding: 18px;
    }

    .rn-public-verification-page .rn-public-verification-qr {
      width: min(180px, 100%);
    }

    .rn-public-verification-page .rn-public-verification-footer {
      padding-right: 5px;
      padding-left: 5px;
    }
  }

  @media (max-width: 480px) {
    .rn-public-verification-page .rn-public-verification-header {
      align-items: flex-start;
      flex-direction: column;
      gap: 12px;
    }

    .rn-public-verification-page .rn-public-verification-brand strong {
      font-size: 17px;
    }

    .rn-public-verification-page .rn-public-verification-brand span {
      font-size: 9px;
    }

    .rn-public-verification-page .rn-public-verification-content {
      padding: 20px 15px;
    }

    .rn-public-verification-page .rn-public-verification-heading {
      font-size: 28px;
      letter-spacing: -.7px;
    }

    .rn-public-verification-page .rn-public-verification-intro {
      font-size: 13px;
    }

    .rn-public-verification-page .rn-public-verification-recipient,
    .rn-public-verification-page .rn-public-verification-course {
      padding: 16px;
    }

    .rn-public-verification-page .rn-public-verification-details {
      gap: 8px;
    }

    .rn-public-verification-page .rn-public-verification-details > div {
      padding: 12px 10px;
    }

    .rn-public-verification-page .rn-public-verification-actions {
      flex-direction: column;
      align-items: stretch;
    }

    .rn-public-verification-page .rn-verification-button {
      width: 100%;
    }

    .rn-public-verification-page .rn-public-verification-footer {
      flex-direction: column;
      align-items: flex-start;
      gap: 5px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .rn-public-verification-page *,
    .rn-public-verification-page *::before,
    .rn-public-verification-page *::after {
      transition-duration: .01ms !important;
    }
  }
`;

export default async function CertificateVerificationPage({
  params,
}: {
  params: Promise<{
    certificateNumber: string;
  }>;
}) {
  const { certificateNumber } = await params;

  const normalizedCertificateNumber =
    normalizeCertificateNumber(certificateNumber);

  if (!normalizedCertificateNumber) {
    notFound();
  }

  const certificate = await getCertificate(
    normalizedCertificateNumber,
  );

  if (!certificate) {
    notFound();
  }

  const verification = await getVerificationStatus(certificate);

  const verificationUrl = buildVerificationUrl(
    certificate.certificate_number,
  );

  const qrCodeUrl = buildQrCodeUrl(verificationUrl);

  const isVerified = verification.isVerified;
  const isRevoked = verification.status === "revoked";
  const isInactive = verification.status === "inactive";

  const statusClass = isVerified
    ? "is-verified"
    : isRevoked
      ? "is-revoked"
      : "is-inactive";

  return (
    <main className="rn-public-verification-page">
      <style>{PAGE_STYLES}</style>

      <div className="container">
        <div className="rn-public-verification-shell">
          <header className="rn-public-verification-header">
            <Link
              href="/"
              className="rn-public-verification-brand"
              aria-label="RuffNeck Learn homepage"
            >
              <img
                src="/brand/ruffneck-logo.png"
                alt=""
                className="rn-public-verification-logo"
                width={52}
                height={52}
              />

              <span className="rn-public-verification-brand-copy">
                <strong>RuffNeck Learn</strong>

                <span>
                  AI · Digital Transformation · Business Solutions
                </span>
              </span>
            </Link>

            <span className="rn-public-verification-public-label">
              Public verification
            </span>
          </header>

          <section
            className={`rn-public-verification-card ${statusClass}`}
            aria-labelledby="certificate-verification-title"
          >
            <div className="rn-public-verification-topline" />

            <div className="rn-public-verification-content">
              <div
                className="rn-public-verification-status"
                role="status"
                aria-live="polite"
              >
                <span
                  className="rn-public-verification-status-dot"
                  aria-hidden="true"
                />

                {isVerified
                  ? "VERIFIED CREDENTIAL"
                  : isRevoked
                    ? "REVOKED CREDENTIAL"
                    : "VERIFICATION UNAVAILABLE"}
              </div>

              <h1
                id="certificate-verification-title"
                className="rn-public-verification-heading"
              >
                Certificate Verification
              </h1>

              <p className="rn-public-verification-intro">
                {isVerified
                  ? "This certificate has an active verification record and is not marked as revoked in the RuffNeck Learn certificate system."
                  : isRevoked
                    ? "This certificate has been revoked and is no longer a valid RuffNeck Learn credential."
                    : "This certificate's verification record is inactive, missing, or expired. Its validity cannot currently be confirmed."}
              </p>

              <div className="rn-public-verification-credential">
                <div className="rn-public-verification-recipient">
                  <span>Certificate awarded to</span>

                  <strong>{certificate.holder_name}</strong>
                </div>

                <div className="rn-public-verification-course">
                  <span>Completed course</span>

                  <strong>{certificate.course_title}</strong>
                </div>
              </div>

              <div className="rn-public-verification-details">
                <div>
                  <span>Certificate Number</span>

                  <strong>{certificate.certificate_number}</strong>
                </div>

                <div>
                  <span>Date Issued</span>

                  <strong>{formatDate(certificate.issued_at)}</strong>
                </div>

                <div>
                  <span>Assessment</span>

                  <strong>
                    {formatAssessmentScore(certificate.assessment_score)}
                  </strong>
                </div>

                <div>
                  <span>Capstone</span>

                  <strong>
                    {formatCapstoneScore(certificate.capstone_score)}
                  </strong>
                </div>
              </div>

              {isRevoked && certificate.revoked_reason ? (
                <div
                  className="rn-public-verification-revoked"
                  role="alert"
                >
                  <strong>Certificate revoked</strong>

                  <span>{certificate.revoked_reason}</span>
                </div>
              ) : null}

              {isInactive ? (
                <div
                  className="rn-public-verification-revoked rn-public-verification-inactive"
                  role="alert"
                >
                  <strong>Verification unavailable</strong>

                  <span>
                    Contact RuffNeck Learn support to confirm the status
                    of this certificate. This result does not establish
                    whether the original award was legitimate.
                  </span>
                </div>
              ) : null}

              {isVerified ? (
                <section
                  className="rn-public-verification-auth"
                  aria-label="Official certificate verification"
                >
                  <div className="rn-public-verification-qr">
                    <img
                      src={qrCodeUrl}
                      alt={`QR code for certificate ${certificate.certificate_number}`}
                      width={220}
                      height={220}
                    />
                  </div>

                  <div className="rn-public-verification-auth-copy">
                    <span>OFFICIAL VERIFICATION</span>

                    <strong>Verify this credential</strong>

                    <p>
                      Scan the QR code to return to this official RuffNeck
                      Learn verification record. You can also open the
                      verification address directly.
                    </p>

                    <code className="rn-public-verification-url">
                      {verificationUrl}
                    </code>

                    <a
                      className="rn-public-verification-qr-link"
                      href={verificationUrl}
                    >
                      Open verification record →
                    </a>
                  </div>
                </section>
              ) : null}

              <div className="rn-public-verification-actions">
                <Link
                  href="/courses"
                  className="rn-verification-button rn-verification-button-primary"
                >
                  Browse Courses →
                </Link>

                <Link
                  href="/"
                  className="rn-verification-button"
                >
                  RuffNeck Learn Homepage
                </Link>
              </div>
            </div>
          </section>

          <footer className="rn-public-verification-footer">
            <strong>RuffNeck Entertainment</strong>

            <span>
              Practical professional learning &amp; digital skills
            </span>

            <span>Certificate verification service</span>
          </footer>
        </div>
      </div>
    </main>
  );
}