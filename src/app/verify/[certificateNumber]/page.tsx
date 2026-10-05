import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";

type Certificate = {
  id: string;
  certificate_number: string;
  holder_name: string;
  course_title: string;
  issued_at: string;
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{
    certificateNumber: string;
  }>;
}) {
  const {
    certificateNumber,
  } = await params;

  return {
    title: `Certificate ${certificateNumber} | RuffNeck Learn`,
    description:
      "Verify a RuffNeck Learn certificate.",
  };
}

export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{
    certificateNumber: string;
  }>;
}) {
  const {
    certificateNumber,
  } = await params;

  const normalizedCertificateNumber =
    decodeURIComponent(
      certificateNumber
    ).trim();

  if (!normalizedCertificateNumber) {
    notFound();
  }

  const admin =
    createAdminClient();

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
        "is_revoked",
        "revoked_reason",
      ].join(", ")
    )
    .eq(
      "certificate_number",
      normalizedCertificateNumber
    )
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

          <h1>
            Verification unavailable
          </h1>

          <p>
            The certificate verification
            service could not complete this
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

  const certificate =
    certificateData as Certificate | null;

  if (!certificate) {
    return (
      <main className="container">
        <section className="rn-empty-state">
          <span className="rn-eyebrow">
            CERTIFICATE VERIFICATION
          </span>

          <h1>
            Certificate not found
          </h1>

          <p>
            No RuffNeck Learn certificate
            matches certificate number:
          </p>

          <strong>
            {normalizedCertificateNumber}
          </strong>

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

  return (
    <main className="rn-certificate-view-page">
      <div className="container">
        <section
          className={`rn-certificate-document ${
            certificate.is_revoked
              ? "is-revoked"
              : ""
          }`}
        >
          <div className="rn-certificate-border">
            <div className="rn-certificate-brand">
              <span aria-hidden="true">
                RN
              </span>

              <strong>
                RuffNeck Learn
              </strong>
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

            <h1>
              Certificate Verification
            </h1>

            {!certificate.is_revoked ? (
              <p className="rn-certificate-presented">
                This credential has been
                verified against the RuffNeck
                Learn certificate record.
              </p>
            ) : (
              <p className="rn-certificate-presented">
                This certificate is no longer
                valid.
              </p>
            )}

            <h2>
              {certificate.holder_name}
            </h2>

            <p className="rn-certificate-completion-text">
              Successfully completed the
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
                  {
                    certificate.certificate_number
                  }
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
                  Issuer
                </span>

                <strong>
                  RuffNeck Entertainment
                </strong>
              </div>

              <div>
                <span>
                  Status
                </span>

                <strong>
                  {certificate.is_revoked
                    ? "Revoked"
                    : "Valid"}
                </strong>
              </div>
            </div>

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