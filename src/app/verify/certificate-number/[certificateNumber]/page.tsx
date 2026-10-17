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

const SITE_URL = "https://ruffneck-lms.vercel.app";

function buildVerificationUrl(certificateNumber: string) {
  return `${SITE_URL}/verify/certificate-number/${encodeURIComponent(
    certificateNumber
  )}`;
}

function buildOpenGraphImageUrl(certificateNumber: string) {
  return `${buildVerificationUrl(certificateNumber)}/opengraph-image`;
}

function buildQrCodeUrl(verificationUrl: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&format=png&margin=8&data=${encodeURIComponent(
    verificationUrl
  )}`;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Lagos",
  }).format(date);
}

function normalizeCertificateNumber(value: string) {
  return value.trim();
}

async function getCertificate(
  certificateNumber: string
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
      ].join(", ")
    )
    .eq("certificate_number", certificateNumber)
    .maybeSingle();

  if (error) {
    console.error("Public certificate lookup failed:", error.message);
    throw new Error("Unable to verify certificate.");
  }

  if (!data) {
    return null;
  }

  return data as unknown as Certificate;
}

async function getVerificationRecord(
  certificateId: string
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
      error.message
    );

    throw new Error("Unable to verify certificate.");
  }

  if (!data || data.length !== 1) {
    return null;
  }

  return data[0] as VerificationRecord;
}

function isVerificationRecordValid(
  record: VerificationRecord | null
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
  certificate: Certificate
) {
  if (certificate.is_revoked) {
    return {
      isVerified: false,
      status: "revoked" as const,
    };
  }

  const record = await getVerificationRecord(certificate.id);

  if (!isVerificationRecordValid(record)) {
    return {
      isVerified: false,
      status: "inactive" as const,
    };
  }

  return {
    isVerified: true,
    status: "verified" as const,
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
    normalizedCertificateNumber
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
    certificate.certificate_number
  );

  const imageUrl = buildOpenGraphImageUrl(
    certificate.certificate_number
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
    normalizedCertificateNumber
  );

  if (!certificate) {
    notFound();
  }

  const verification = await getVerificationStatus(certificate);

  const verificationUrl = buildVerificationUrl(
    certificate.certificate_number
  );

  const qrCodeUrl = buildQrCodeUrl(verificationUrl);

  const isVerified = verification.isVerified;
  const isRevoked = verification.status === "revoked";
  const isInactive = verification.status === "inactive";

  return (
    <main className="rn-public-verification-page">
      <div className="container">
        <div className="rn-public-verification-shell">
          <header className="rn-public-verification-header">
            <Link
              href="/"
              className="rn-public-verification-brand"
            >
              <img
                src="/brand/ruffneck-logo.png"
                alt="RuffNeck Entertainment"
                className="rn-public-verification-logo"
                width={52}
                height={52}
              />

              <div>
                <strong>RuffNeck Learn</strong>

                <span>
                  AI • Digital Transformation • Business Solutions
                </span>
              </div>
            </Link>
          </header>

          <section
            className={`rn-public-verification-card ${
              isVerified
                ? "is-verified"
                : "is-revoked"
            }`}
            aria-labelledby="certificate-verification-title"
          >
            <div
              className="rn-public-verification-status"
              role="status"
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

            <h1 id="certificate-verification-title">
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
                  {certificate.assessment_score ?? "—"}
                  {certificate.assessment_score !== null
                    ? "%"
                    : ""}
                </strong>
              </div>

              <div>
                <span>Capstone</span>

                <strong>
                  {certificate.capstone_score ?? "—"}
                  {certificate.capstone_score !== null
                    ? "/100"
                    : ""}
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
                className="rn-public-verification-revoked"
                role="alert"
              >
                <strong>Verification unavailable</strong>

                <span>
                  Contact RuffNeck Learn support to confirm the
                  status of this certificate.
                </span>
              </div>
            ) : null}

            {isVerified ? (
              <div className="rn-public-verification-auth">
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

                  <strong>Scan to verify</strong>

                  <p>
                    Scan this QR code to return to the official
                    RuffNeck Learn certificate verification page.
                  </p>

                  <code>{verificationUrl}</code>
                </div>
              </div>
            ) : null}

            <div className="rn-public-verification-actions">
              <Link
                href="/courses"
                className="rn-button rn-button-primary"
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