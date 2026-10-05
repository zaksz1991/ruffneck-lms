import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";

type Certificate = {
  certificate_number: string;
  holder_name: string;
  course_title: string;
  is_revoked: boolean;
};

function buildVerificationUrl(
  certificateNumber: string
) {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://ruffneck-lms.vercel.app";

  return `${baseUrl.replace(
    /\/$/,
    ""
  )}/verify/${encodeURIComponent(
    certificateNumber
  )}`;
}

function buildQrCodeUrl(
  verificationUrl: string
) {
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
    decodeURIComponent(
      certificateNumber
    ).trim();

  if (!normalizedCertificateNumber) {
    return {
      title:
        "Certificate Verification | RuffNeck Learn",
      description:
        "Verify a RuffNeck Learn certificate.",
    };
  }

  const admin = createAdminClient();

  const { data } = await admin
    .from("course_certificates")
    .select(
      "certificate_number, holder_name, course_title, is_revoked"
    )
    .eq(
      "certificate_number",
      normalizedCertificateNumber
    )
    .maybeSingle();

  const certificate =
    data as Certificate | null;

  if (!certificate) {
    return {
      title: `Certificate ${normalizedCertificateNumber} | RuffNeck Learn`,
      description:
        "Verify a RuffNeck Learn certificate.",
      openGraph: {
        title: `Certificate ${normalizedCertificateNumber} | RuffNeck Learn`,
        description:
          "Verify a RuffNeck Learn certificate.",
        type: "website",
        siteName: "RuffNeck Learn",
      },
      twitter: {
        card: "summary",
        title: `Certificate ${normalizedCertificateNumber} | RuffNeck Learn`,
        description:
          "Verify a RuffNeck Learn certificate.",
      },
    };
  }

  const status = certificate.is_revoked
    ? "Revoked"
    : "Verified";

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

export default async function CertificateVerificationPage({
  params,
}: {
  params: Promise<{
    certificateNumber: string;
  }>;
}) {
  const { certificateNumber } = await params;

  const normalizedCertificateNumber =
    decodeURIComponent(
      certificateNumber
    ).trim();

  if (!normalizedCertificateNumber) {
    notFound();
  }

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

  const certificate = data as {
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
              fontSize: "clamp(30px, 5vw, 46px)",
              lineHeight: 1.1,
            }}
          >
            Certificate Verification
          </h1>

          <p
            style={{
              margin:
                "14px auto 0",
              maxWidth: 680,
              lineHeight: 1.7,
              color:
                "var(--muted, #64748b)",
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
            padding: "clamp(24px, 5vw, 48px)",
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
                textTransform:
                  "uppercase",
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
                margin:
                  "18px 0 0",
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
                  wordBreak:
                    "break-word",
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

              <strong>
                {issuedDate}
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
                  color:
                    "var(--cyan)",
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
                  wordBreak:
                    "break-all",
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
                background:
                  "#ffffff",
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
            justifyContent:
              "center",
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