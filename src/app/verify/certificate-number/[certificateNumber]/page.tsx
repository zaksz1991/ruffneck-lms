import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

type CertificateMetadata = {
  certificate_number: string;
  holder_name: string;
  course_title: string;
  is_revoked: boolean;
};

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

function buildVerificationUrl(certificateNumber: string) {
  return `${getBaseUrl()}/verify/certificate-number/${encodeURIComponent(
    certificateNumber
  )}`;
}

function buildQrCodeUrl(verificationUrl: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(
    verificationUrl
  )}`;
}

function buildSocialImageUrl(certificateNumber: string) {
  return `${getBaseUrl()}/verify/certificate-number/${encodeURIComponent(
    certificateNumber
  )}/opengraph-image`;
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

  const baseUrl = getBaseUrl();

  if (!normalizedCertificateNumber) {
    return {
      metadataBase: new URL(baseUrl),
      title: "RuffNeck Learn | Certificate Verification",
      description:
        "Official verification of a RuffNeck Learn professional learning certificate.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("course_certificates")
    .select(
      "certificate_number, holder_name, course_title, is_revoked"
    )
    .eq(
      "certificate_number",
      normalizedCertificateNumber
    )
    .maybeSingle();

  if (error) {
    console.error(
      "Certificate metadata lookup failed:",
      error
    );
  }

  const certificate =
    data as unknown as CertificateMetadata | null;

  if (!certificate) {
    const title =
      "RuffNeck Learn | Certificate Verification";

    const description =
      "Verify an official RuffNeck Learn certificate issued by RuffNeck Entertainment.";

    const canonicalUrl = buildVerificationUrl(
      normalizedCertificateNumber
    );

    return {
      metadataBase: new URL(baseUrl),
      title: {
        absolute: title,
      },
      description,
      alternates: {
        canonical: canonicalUrl,
      },
      robots: {
        index: false,
        follow: false,
      },
      openGraph: {
        title,
        description,
        url: canonicalUrl,
        type: "website",
        siteName: "RuffNeck Learn",
        locale: "en_NG",
        images: [
          {
            url: `${baseUrl}/brand/ruffneck-logo.png`,
            width: 1200,
            height: 630,
            alt: "RuffNeck Learn Certificate Verification",
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [`${baseUrl}/brand/ruffneck-logo.png`],
      },
    };
  }

  const status = certificate.is_revoked
    ? "Revoked"
    : "Verified";

  /*
   * Keep the social/share title professional.
   *
   * LinkedIn was previously displaying:
   * "ruffneckhassan — AI Literacy for Nigerian Professionals"
   *
   * That happened because the previous title was generated directly
   * from holder_name and course_title.
   */
  const title =
    "RuffNeck Learn | Certificate Verification";

  const description = certificate.is_revoked
    ? `This RuffNeck Learn certificate for ${certificate.holder_name} has been revoked.`
    : `Official verification of the RuffNeck Learn certificate awarded to ${certificate.holder_name} for completing ${certificate.course_title}.`;

  const canonicalUrl = buildVerificationUrl(
    certificate.certificate_number
  );

  const socialImageUrl = buildSocialImageUrl(
    certificate.certificate_number
  );

  return {
    metadataBase: new URL(baseUrl),

    title: {
      absolute: title,
    },

    description,

    alternates: {
      canonical: canonicalUrl,
    },

    robots: {
      index: true,
      follow: true,
    },

    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "website",
      siteName: "RuffNeck Learn",
      locale: "en_NG",
      images: [
        {
          url: socialImageUrl,
          width: 1200,
          height: 630,
          alt: `RuffNeck Learn certificate verification for ${certificate.holder_name}`,
        },
      ],
    },

    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [socialImageUrl],
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

  const admin = createAdminClient();

  const {
    data,
    error,
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
    .eq(
      "certificate_number",
      normalizedCertificateNumber
    )
    .maybeSingle();

  if (error) {
    console.error(
      "Certificate verification lookup failed:",
      error
    );

    throw new Error(
      "Unable to verify certificate."
    );
  }

  if (!data) {
    notFound();
  }

  const certificate =
    data as unknown as Certificate;

  const verificationUrl =
    buildVerificationUrl(
      certificate.certificate_number
    );

  const qrCodeUrl =
    buildQrCodeUrl(verificationUrl);

  const issuedDate = new Date(
    certificate.issued_at
  ).toLocaleDateString("en-NG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main
      className="container"
      style={{
        paddingTop: 48,
        paddingBottom: 64,
      }}
    >
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            textAlign: "center",
            marginBottom: 32,
          }}
        >
          <img
            src="/brand/ruffneck-logo.png"
            alt="RuffNeck Entertainment"
            style={{
              display: "block",
              width: 220,
              maxWidth: "80%",
              height: "auto",
              margin: "0 auto 20px",
            }}
          />

          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "var(--cyan)",
              marginBottom: 10,
            }}
          >
            RuffNeck Learn
          </div>

          <h1
            style={{
              margin: 0,
              fontSize:
                "clamp(30px, 5vw, 46px)",
              lineHeight: 1.1,
            }}
          >
            Certificate Verification
          </h1>

          <p
            style={{
              margin: "14px auto 0",
              maxWidth: 680,
              lineHeight: 1.7,
              color: "var(--muted, #64748b)",
            }}
          >
            This page provides official
            verification for a RuffNeck Learn
            professional learning certificate.
          </p>
        </div>

        <section
          style={{
            border:
              "1px solid var(--border)",
            borderRadius: 16,
            background:
              "var(--surface, #ffffff)",
            padding:
              "clamp(24px, 5vw, 48px)",
            boxShadow:
              "0 12px 35px rgba(11, 30, 58, 0.08)",
          }}
        >
          <div
            style={{
              textAlign: "center",
              borderBottom:
                "1px solid var(--border)",
              paddingBottom: 28,
              marginBottom: 28,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                color:
                  "var(--muted, #64748b)",
                marginBottom: 12,
              }}
            >
              Certificate holder
            </div>

            <h2
              style={{
                margin: 0,
                fontSize:
                  "clamp(26px, 4vw, 40px)",
                lineHeight: 1.2,
              }}
            >
              {certificate.holder_name}
            </h2>

            <p
              style={{
                margin: "18px 0 0",
                fontSize:
                  "clamp(18px, 2.5vw, 24px)",
                fontWeight: 600,
                lineHeight: 1.4,
              }}
            >
              {certificate.course_title}
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 16,
              marginBottom: 28,
            }}
          >
            <div
              style={{
                padding: 18,
                border:
                  "1px solid var(--border)",
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform:
                    "uppercase",
                  letterSpacing: 1,
                  color:
                    "var(--muted, #64748b)",
                  marginBottom: 7,
                }}
              >
                Certificate number
              </div>

              <strong
                style={{
                  wordBreak: "break-word",
                }}
              >
                {certificate.certificate_number}
              </strong>
            </div>

            <div
              style={{
                padding: 18,
                border:
                  "1px solid var(--border)",
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform:
                    "uppercase",
                  letterSpacing: 1,
                  color:
                    "var(--muted, #64748b)",
                  marginBottom: 7,
                }}
              >
                Issued
              </div>

              <strong>{issuedDate}</strong>
            </div>

            <div
              style={{
                padding: 18,
                border:
                  "1px solid var(--border)",
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform:
                    "uppercase",
                  letterSpacing: 1,
                  color:
                    "var(--muted, #64748b)",
                  marginBottom: 7,
                }}
              >
                Assessment
              </div>

              <strong>
                {certificate.assessment_score ??
                  "—"}
                {certificate.assessment_score !==
                null
                  ? "%"
                  : ""}
              </strong>
            </div>

            <div
              style={{
                padding: 18,
                border:
                  "1px solid var(--border)",
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform:
                    "uppercase",
                  letterSpacing: 1,
                  color:
                    "var(--muted, #64748b)",
                  marginBottom: 7,
                }}
              >
                Capstone
              </div>

              <strong>
                {certificate.capstone_score ??
                  "—"}
                {certificate.capstone_score !==
                null
                  ? "/100"
                  : ""}
              </strong>
            </div>
          </div>

          <div
            style={{
              padding: 20,
              borderRadius: 10,
              border: certificate.is_revoked
                ? "1px solid #fecaca"
                : "1px solid #bbf7d0",
              background:
                certificate.is_revoked
                  ? "#fef2f2"
                  : "#f0fdf4",
              marginBottom: 30,
            }}
          >
            <strong
              style={{
                display: "block",
                marginBottom: 7,
              }}
            >
              {certificate.is_revoked
                ? "Certificate revoked"
                : "Certificate verified"}
            </strong>

            <p
              style={{
                margin: 0,
                lineHeight: 1.6,
              }}
            >
              {certificate.is_revoked
                ? certificate.revoked_reason ||
                  "This certificate is no longer valid."
                : "This certificate is an official RuffNeck Learn credential issued by RuffNeck Entertainment."}
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(0, 1fr) auto",
              gap: 28,
              alignItems: "center",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 1,
                  textTransform:
                    "uppercase",
                  color: "var(--cyan)",
                  marginBottom: 10,
                }}
              >
                Official verification
              </div>

              <p
                style={{
                  margin: 0,
                  lineHeight: 1.7,
                  fontSize: 14,
                }}
              >
                Scan the QR code or use the
                verification address below to
                confirm this certificate.
              </p>

              <div
                style={{
                  marginTop: 16,
                  padding: 12,
                  border:
                    "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 13,
                  lineHeight: 1.5,
                  wordBreak: "break-all",
                }}
              >
                {verificationUrl}
              </div>
            </div>

            <div
              style={{
                width: 220,
                height: 220,
                padding: 8,
                border:
                  "1px solid var(--border)",
                borderRadius: 10,
                background: "#ffffff",
              }}
            >
              <img
                src={qrCodeUrl}
                alt={`QR code for verifying certificate ${certificate.certificate_number}`}
                width={204}
                height={204}
                style={{
                  display: "block",
                  width: "100%",
                  height: "100%",
                }}
              />
            </div>
          </div>

          <div
            style={{
              marginTop: 32,
              paddingTop: 22,
              borderTop:
                "1px solid var(--border)",
              textAlign: "center",
              fontSize: 13,
              color:
                "var(--muted, #64748b)",
              lineHeight: 1.6,
            }}
          >
            RuffNeck Learn · RuffNeck
            Entertainment
          </div>
        </section>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 12,
            flexWrap: "wrap",
            marginTop: 28,
          }}
        >
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
      </div>
    </main>
  );
}