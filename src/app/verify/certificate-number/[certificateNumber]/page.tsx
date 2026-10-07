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

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://ruffneck-lms.vercel.app"
  ).replace(/\/$/, "");
}

function buildVerificationUrl(
  certificateNumber: string
) {
  return `${getBaseUrl()}/verify/certificate-number/${encodeURIComponent(
    certificateNumber
  )}`;
}

function buildOpenGraphImageUrl(
  certificateNumber: string
) {
  return `${getBaseUrl()}/verify/certificate-number/${encodeURIComponent(
    certificateNumber
  )}/opengraph-image`;
}

function buildQrCodeUrl(
  verificationUrl: string
) {
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
  }).format(date);
}

async function getCertificate(
  certificateNumber: string
) {
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
    .eq(
      "certificate_number",
      certificateNumber
    )
    .maybeSingle();

  if (error) {
    console.error(
      "Public certificate lookup failed:",
      error
    );

    throw new Error(
      "Unable to verify certificate."
    );
  }

  return data as unknown as Certificate | null;
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
    decodeURIComponent(certificateNumber).trim();

  const certificate = await getCertificate(
    normalizedCertificateNumber
  );

  if (!certificate) {
    return {
      title:
        "Certificate Not Found | RuffNeck Learn",
      description:
        "The requested RuffNeck Learn certificate could not be found.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const verificationUrl =
    buildVerificationUrl(
      certificate.certificate_number
    );

  const imageUrl =
    buildOpenGraphImageUrl(
      certificate.certificate_number
    );

  const statusText = certificate.is_revoked
    ? "This RuffNeck Learn certificate has been revoked."
    : "This RuffNeck Learn certificate is available for public verification.";

  const description =
    `Official verification of the RuffNeck Learn certificate awarded to ${certificate.holder_name} for completing ${certificate.course_title}. ${statusText}`;

  return {
    metadataBase: new URL(getBaseUrl()),

    title:
      "RuffNeck Learn | Certificate Verification",

    description,

    alternates: {
      canonical: verificationUrl,
    },

    robots: {
      index: true,
      follow: true,
    },

    openGraph: {
      title:
        "RuffNeck Learn | Certificate Verification",

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
          alt:
            `RuffNeck Learn certificate verification for ${certificate.holder_name}`,
        },
      ],
    },

    twitter: {
      card: "summary_large_image",

      title:
        "RuffNeck Learn | Certificate Verification",

      description,

      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt:
            `RuffNeck Learn certificate verification for ${certificate.holder_name}`,
        },
      ],
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
    decodeURIComponent(certificateNumber).trim();

  if (!normalizedCertificateNumber) {
    notFound();
  }

  const certificate = await getCertificate(
    normalizedCertificateNumber
  );

  if (!certificate) {
    notFound();
  }

  const verificationUrl =
    buildVerificationUrl(
      certificate.certificate_number
    );

  const qrCodeUrl =
    buildQrCodeUrl(verificationUrl);

  const isVerified =
    !certificate.is_revoked;

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
              />

              <div>
                <strong>RuffNeck Learn</strong>

                <span>
                  AI • Digital Transformation •
                  Business Solutions
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
          >
            <div className="rn-public-verification-status">
              <span
                className="rn-public-verification-status-dot"
                aria-hidden="true"
              />

              {isVerified
                ? "VERIFIED CREDENTIAL"
                : "REVOKED CREDENTIAL"}
            </div>

            <h1>
              Certificate Verification
            </h1>

            <p className="rn-public-verification-intro">
              {isVerified
                ? "This certificate is an official RuffNeck Learn credential and can be independently verified."
                : "This certificate is no longer valid for verification."}
            </p>

            <div className="rn-public-verification-credential">
              <div className="rn-public-verification-recipient">
                <span>Certificate awarded to</span>

                <strong>
                  {certificate.holder_name}
                </strong>
              </div>

              <div className="rn-public-verification-course">
                <span>Completed course</span>

                <strong>
                  {certificate.course_title}
                </strong>
              </div>
            </div>

            <div className="rn-public-verification-details">
              <div>
                <span>
                  Certificate Number
                </span>

                <strong>
                  {certificate.certificate_number}
                </strong>
              </div>

              <div>
                <span>Date Issued</span>

                <strong>
                  {formatDate(
                    certificate.issued_at
                  )}
                </strong>
              </div>

              <div>
                <span>Assessment</span>

                <strong>
                  {certificate.assessment_score ??
                    "—"}
                  {certificate.assessment_score !==
                    null &&
                  certificate.assessment_score !==
                    undefined
                    ? "%"
                    : ""}
                </strong>
              </div>

              <div>
                <span>Capstone</span>

                <strong>
                  {certificate.capstone_score ??
                    "—"}
                  {certificate.capstone_score !==
                    null &&
                  certificate.capstone_score !==
                    undefined
                    ? "/100"
                    : ""}
                </strong>
              </div>
            </div>

            {certificate.is_revoked &&
            certificate.revoked_reason ? (
              <div
                className="rn-public-verification-revoked"
                role="alert"
              >
                <strong>
                  Certificate revoked
                </strong>

                <span>
                  {certificate.revoked_reason}
                </span>
              </div>
            ) : null}

            {isVerified ? (
              <div className="rn-public-verification-auth">
                <div className="rn-public-verification-qr">
                  <img
                    src={qrCodeUrl}
                    alt={`QR code for verifying certificate ${certificate.certificate_number}`}
                    width={220}
                    height={220}
                  />
                </div>

                <div className="rn-public-verification-auth-copy">
                  <span>
                    OFFICIAL VERIFICATION
                  </span>

                  <strong>
                    Scan to verify
                  </strong>

                  <p>
                    Scan this QR code to return
                    to the official RuffNeck Learn
                    certificate verification page.
                  </p>

                  <code>
                    {verificationUrl}
                  </code>
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
            <strong>
              RuffNeck Entertainment
            </strong>

            <span>
              Practical professional learning
              &amp; digital skills
            </span>

            <span>
              Certificate verification service
            </span>
          </footer>
        </div>
      </div>
    </main>
  );
}