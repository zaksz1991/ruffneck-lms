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
        <div
          className="rn-certificate-view-actions no-print"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
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
            <div className="rn-certificate-brand">
              <img
                src="/brand/ruffneck-logo.png"
                alt="RuffNeck Entertainment"
                className="rn-certificate-logo"
              />

              <strong>
                RuffNeck Learn
              </strong>
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

            <h1>
              Certificate of Completion
            </h1>

            <p className="rn-certificate-presented">
              This certificate is presented to
            </p>

            <h2>
              {certificate.holder_name}
            </h2>

            <p className="rn-certificate-completion-text">
              for successfully completing the
              RuffNeck Learn course
            </p>

            <h3>
              {certificate.course_title}
            </h3>

            <div className="rn-certificate-divider" />

            <div className="rn-certificate-details">
              <div>
                <span>
                  Certificate Number
                </span>

                <strong>
                  {certificate.certificate_number}
                </strong>
              </div>

              <div>
                <span>
                  Date Issued
                </span>

                <strong>
                  {formatDate(
                    certificate.issued_at
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Assessment
                </span>

                <strong>
                  {certificate.assessment_score ??
                    "—"}
                  %
                </strong>
              </div>

              <div>
                <span>
                  Capstone
                </span>

                <strong>
                  {certificate.capstone_score ??
                    "—"}
                  /100
                </strong>
              </div>
            </div>

            {!certificate.is_revoked &&
            verification &&
            verificationUrl &&
            qrCodeUrl ? (
              <>
                <div className="rn-certificate-divider" />

                <div
                  className="rn-certificate-verification"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent:
                      "center",
                    gap: 24,
                    flexWrap: "wrap",
                    marginTop: 24,
                    padding: 20,
                    border:
                      "1px solid rgba(11, 30, 58, 0.12)",
                    borderRadius: 12,
                    background:
                      "#f8fafc",
                  }}
                >
                  <div
                    style={{
                      flex:
                        "0 0 auto",
                      width: 220,
                      textAlign:
                        "center",
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
                        maxWidth:
                          "100%",
                        margin:
                          "0 auto",
                        background:
                          "#ffffff",
                        border:
                          "1px solid #e5e7eb",
                      }}
                    />
                  </div>

                  <div
                    style={{
                      flex:
                        "1 1 280px",
                      minWidth: 240,
                    }}
                  >
                    <span className="rn-eyebrow">
                      DIGITAL VERIFICATION
                    </span>

                    <h4
                      style={{
                        margin:
                          "8px 0 10px",
                        fontSize: 20,
                        color:
                          "#0b1e3a",
                      }}
                    >
                      Scan to verify this
                      certificate
                    </h4>

                    <p
                      style={{
                        margin: 0,
                        lineHeight: 1.6,
                        color:
                          "#475569",
                      }}
                    >
                      Scan the QR code
                      with a phone camera
                      to open the official
                      RuffNeck Learn
                      certificate
                      verification record.
                    </p>

                    <p
                      style={{
                        marginTop: 12,
                        marginBottom: 0,
                        fontSize: 13,
                        lineHeight: 1.5,
                        color:
                          "#64748b",
                        overflowWrap:
                          "anywhere",
                      }}
                    >
                      Verification code:{" "}
                      <strong>
                        {
                          verification.verification_code
                        }
                      </strong>
                    </p>

                    <p
                      style={{
                        marginTop: 8,
                        marginBottom: 0,
                        fontSize: 12,
                        lineHeight: 1.5,
                        color:
                          "#64748b",
                        overflowWrap:
                          "anywhere",
                      }}
                    >
                      {verificationUrl}
                    </p>

                    {!verificationIsValid ? (
                      <p
                        style={{
                          marginTop: 10,
                          marginBottom: 0,
                          fontSize: 13,
                          fontWeight: 700,
                          color:
                            "#b45309",
                        }}
                      >
                        Verification is
                        currently inactive
                        or expired.
                      </p>
                    ) : null}
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
              <span>
                RuffNeck Entertainment
              </span>

              <span>
                Practical professional learning
              </span>
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

        <div
          className="rn-assessment-actions no-print"
          style={{
            marginTop: 24,
          }}
        >
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