import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CertificatePrintButton from "@/components/CertificatePrintButton";
import CertificateVerificationLink from "@/components/CertificateVerificationLink";

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

  return `${baseUrl.replace(
    /\/$/,
    ""
  )}/verify/certificate-number/${encodeURIComponent(
    certificateNumber
  )}`;
}

function buildQrCodeUrl(verificationUrl: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&format=png&margin=12&data=${encodeURIComponent(
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

  const verificationUrl =
    `/verify/certificate-number/${encodeURIComponent(
      certificate.certificate_number
    )}`;

  const fullVerificationUrl = buildVerificationUrl(
    certificate.certificate_number
  );

  const qrCodeUrl = buildQrCodeUrl(
    fullVerificationUrl
  );

  return (
    <main className="rn-certificate-view-page rn-certificate-single-page">
      <style>{`
        /*
         * Certificate-only print rules.
         * These rules do not alter the global site stylesheet.
         */

        @page {
          size: A4 landscape;
          margin: 0;
        }

        @media print {
          html,
          body {
            width: 297mm !important;
            height: 210mm !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body * {
            visibility: hidden !important;
          }

          .rn-certificate-single-page,
          .rn-certificate-single-page * {
            visibility: visible !important;
          }

          .rn-certificate-single-page {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 297mm !important;
            height: 210mm !important;
            min-height: 0 !important;
            max-height: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            background: #ffffff !important;
          }

          .rn-certificate-single-page > .container {
            width: 297mm !important;
            max-width: none !important;
            height: 210mm !important;
            min-height: 0 !important;
            max-height: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
          }

          .rn-certificate-single-page .no-print,
          .rn-certificate-single-page
            .rn-certificate-view-actions,
          .rn-certificate-single-page
            .rn-certificate-bottom-actions {
            display: none !important;
          }

          .rn-certificate-single-page
            .rn-certificate-document {
            position: relative !important;
            display: block !important;
            width: 297mm !important;
            height: 210mm !important;
            min-width: 0 !important;
            min-height: 0 !important;
            max-width: none !important;
            max-height: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            page-break-before: avoid !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
            break-before: avoid-page !important;
            break-after: avoid-page !important;
            break-inside: avoid-page !important;
            background: #ffffff !important;
          }

          .rn-certificate-single-page
            .rn-certificate-border {
            position: absolute !important;
            inset: 0 !important;
            display: block !important;
            width: 297mm !important;
            height: 210mm !important;
            min-height: 0 !important;
            max-height: 210mm !important;
            margin: 0 !important;
            padding: 5mm !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
            break-inside: avoid-page !important;
          }

          .rn-certificate-single-page
            .rn-certificate-watermark,
          .rn-certificate-single-page
            .rn-certificate-security-pattern {
            position: absolute !important;
            inset: 0 !important;
            pointer-events: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .rn-certificate-single-page
            .rn-certificate-inner {
            position: relative !important;
            display: flex !important;
            flex-direction: column !important;
            width: 100% !important;
            height: 100% !important;
            min-height: 0 !important;
            max-height: 100% !important;
            margin: 0 !important;
            padding: 2mm 5mm !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            gap: 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid-page !important;
          }

          .rn-certificate-single-page
            .rn-certificate-header {
            flex: 0 0 auto !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 1mm !important;
            margin: 0 !important;
            padding: 0 !important;
            text-align: center !important;
          }

          .rn-certificate-single-page
            .rn-certificate-logo {
            display: block !important;
            width: auto !important;
            height: 17mm !important;
            max-width: 48mm !important;
            max-height: 17mm !important;
            object-fit: contain !important;
            margin: 0 auto !important;
          }

          .rn-certificate-single-page
            .rn-certificate-learn-name {
            margin: 0 !important;
            font-size: 12pt !important;
            line-height: 1.1 !important;
          }

          .rn-certificate-single-page
            .rn-certificate-tagline {
            margin: 0 !important;
            font-size: 7pt !important;
            line-height: 1.2 !important;
          }

          .rn-certificate-single-page
            .rn-certificate-header-accent {
            margin: 1mm 0 !important;
          }

          .rn-certificate-single-page
            .rn-certificate-main {
            flex: 1 1 auto !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 1mm 0 !important;
            text-align: center !important;
            gap: 1mm !important;
            overflow: hidden !important;
          }

          .rn-certificate-single-page
            .rn-certificate-eyebrow {
            margin: 0 !important;
            font-size: 8pt !important;
            line-height: 1.2 !important;
          }

          .rn-certificate-single-page
            .rn-certificate-main h1 {
            margin: 0 !important;
            font-size: 23pt !important;
            line-height: 1.12 !important;
            break-after: avoid !important;
          }

          .rn-certificate-single-page
            .rn-certificate-presented,
          .rn-certificate-single-page
            .rn-certificate-completion-text {
            margin: 0 !important;
            font-size: 9pt !important;
            line-height: 1.25 !important;
          }

          .rn-certificate-single-page
            .rn-certificate-main h2 {
            max-width: 100% !important;
            margin: 1mm 0 !important;
            font-size: 25pt !important;
            line-height: 1.12 !important;
            overflow-wrap: anywhere !important;
            break-after: avoid !important;
          }

          .rn-certificate-single-page
            .rn-certificate-name-rule {
            margin: 0 !important;
          }

          .rn-certificate-single-page
            .rn-certificate-main h3 {
            max-width: 100% !important;
            margin: 1mm 0 0 !important;
            font-size: 15pt !important;
            line-height: 1.2 !important;
            overflow-wrap: anywhere !important;
            break-before: avoid !important;
          }

          .rn-certificate-single-page
            .rn-certificate-credential-strip {
            flex: 0 0 auto !important;
            display: grid !important;
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            gap: 3mm !important;
            width: 100% !important;
            margin: 1mm 0 !important;
            padding: 2mm 0 !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            break-inside: avoid-page !important;
          }

          .rn-certificate-single-page
            .rn-certificate-credential {
            min-width: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            text-align: center !important;
          }

          .rn-certificate-single-page
            .rn-certificate-credential span {
            display: block !important;
            margin: 0 0 1mm !important;
            font-size: 7pt !important;
            line-height: 1.2 !important;
          }

          .rn-certificate-single-page
            .rn-certificate-credential strong {
            display: block !important;
            font-size: 8pt !important;
            line-height: 1.2 !important;
            overflow-wrap: anywhere !important;
          }

          .rn-certificate-single-page
            .rn-certificate-number {
            flex: 0 0 auto !important;
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: center !important;
            flex-wrap: wrap !important;
            gap: 2mm !important;
            margin: 1mm 0 !important;
            padding: 0 !important;
            font-size: 8pt !important;
            line-height: 1.2 !important;
            page-break-inside: avoid !important;
            break-inside: avoid-page !important;
          }

          .rn-certificate-single-page
            .rn-certificate-authentication {
            flex: 0 0 auto !important;
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 4mm !important;
            min-height: 0 !important;
            margin: 1mm 0 !important;
            padding: 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid-page !important;
          }

          .rn-certificate-single-page
            .rn-certificate-qr-panel {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            gap: 3mm !important;
            min-width: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .rn-certificate-single-page
            .rn-certificate-qr-frame {
            flex: 0 0 auto !important;
            width: 25mm !important;
            height: 25mm !important;
            min-width: 25mm !important;
            min-height: 25mm !important;
            margin: 0 !important;
            padding: 1mm !important;
            box-sizing: border-box !important;
          }

          .rn-certificate-single-page
            .rn-certificate-qr-image {
            display: block !important;
            width: 100% !important;
            height: 100% !important;
            max-width: none !important;
            max-height: none !important;
            object-fit: contain !important;
          }

          .rn-certificate-single-page
            .rn-certificate-qr-copy {
            display: flex !important;
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 1mm !important;
            min-width: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .rn-certificate-single-page
            .rn-certificate-qr-copy strong {
            font-size: 8pt !important;
            line-height: 1.2 !important;
          }

          .rn-certificate-single-page
            .rn-certificate-qr-copy span,
          .rn-certificate-single-page
            .rn-certificate-qr-copy small {
            font-size: 7pt !important;
            line-height: 1.2 !important;
            overflow-wrap: anywhere !important;
          }

          .rn-certificate-single-page
            .rn-certificate-authentication-branding {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: flex-end !important;
            gap: 4mm !important;
            min-width: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .rn-certificate-single-page
            .rn-certificate-seal {
            display: block !important;
            width: 25mm !important;
            height: 25mm !important;
            max-width: 25mm !important;
            max-height: 25mm !important;
            object-fit: contain !important;
          }

          .rn-certificate-single-page
            .rn-certificate-security-stamp {
            display: block !important;
            width: 22mm !important;
            height: 22mm !important;
            max-width: 22mm !important;
            max-height: 22mm !important;
            object-fit: contain !important;
          }

          .rn-certificate-single-page
            .rn-certificate-footer {
            flex: 0 0 auto !important;
            display: grid !important;
            grid-template-columns: 1fr 1fr 1fr !important;
            align-items: end !important;
            gap: 4mm !important;
            width: 100% !important;
            min-height: 0 !important;
            margin: 1mm 0 0 !important;
            padding: 2mm 0 0 !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            break-inside: avoid-page !important;
          }

          .rn-certificate-single-page
            .rn-certificate-signatory,
          .rn-certificate-single-page
            .rn-certificate-institution,
          .rn-certificate-single-page
            .rn-certificate-footer-meta {
            min-width: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .rn-certificate-single-page
            .rn-certificate-signatory {
            text-align: left !important;
          }

          .rn-certificate-single-page
            .rn-certificate-signature-wrap {
            height: 12mm !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .rn-certificate-single-page
            .rn-certificate-signature-image {
            display: block !important;
            width: auto !important;
            height: 11mm !important;
            max-width: 48mm !important;
            max-height: 11mm !important;
            object-fit: contain !important;
            object-position: left bottom !important;
          }

          .rn-certificate-single-page
            .rn-certificate-signature-line {
            margin: 0 0 1mm !important;
          }

          .rn-certificate-single-page
            .rn-certificate-signatory strong {
            display: block !important;
            font-size: 9pt !important;
            line-height: 1.2 !important;
          }

          .rn-certificate-single-page
            .rn-certificate-signatory span {
            display: block !important;
            font-size: 7pt !important;
            line-height: 1.2 !important;
          }

          .rn-certificate-single-page
            .rn-certificate-institution {
            text-align: center !important;
          }

          .rn-certificate-single-page
            .rn-certificate-company-stamp {
            display: block !important;
            width: 18mm !important;
            height: 18mm !important;
            max-width: 18mm !important;
            max-height: 18mm !important;
            margin: 0 auto 1mm !important;
            object-fit: contain !important;
          }

          .rn-certificate-single-page
            .rn-certificate-institution-copy strong,
          .rn-certificate-single-page
            .rn-certificate-institution-copy span {
            display: block !important;
            font-size: 7pt !important;
            line-height: 1.2 !important;
            overflow-wrap: anywhere !important;
          }

          .rn-certificate-single-page
            .rn-certificate-footer-meta {
            display: flex !important;
            flex-direction: column !important;
            align-items: flex-end !important;
            gap: 1mm !important;
            text-align: right !important;
          }

          .rn-certificate-single-page
            .rn-certificate-footer-meta strong,
          .rn-certificate-single-page
            .rn-certificate-footer-meta span {
            font-size: 7pt !important;
            line-height: 1.2 !important;
            overflow-wrap: anywhere !important;
          }

          .rn-certificate-single-page
            .rn-certificate-revoked {
            flex: 0 0 auto !important;
            margin: 1mm 0 !important;
            font-size: 10pt !important;
            line-height: 1.2 !important;
          }

          .rn-certificate-single-page
            .rn-certificate-revoked-note {
            flex: 0 0 auto !important;
            margin: 1mm 0 !important;
            font-size: 8pt !important;
            line-height: 1.2 !important;
          }

          .rn-certificate-single-page
            img {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <div className="container">
        <div className="rn-certificate-view-actions no-print">
          <Link
            href="/student/certificates"
            className="rn-learning-back"
          >
            ← My Certificates
          </Link>

          <div className="rn-certificate-action-group">
            <Link
              href={verificationUrl}
              className="rn-button rn-button-secondary"
            >
              Verify Certificate
            </Link>

            {!certificate.is_revoked ? (
              <CertificatePrintButton />
            ) : null}
          </div>
        </div>

        <article
          className={`rn-certificate-document certificate-print-area ${
            certificate.is_revoked ? "is-revoked" : ""
          }`}
        >
          <div className="rn-certificate-border">
            <div
              className="rn-certificate-watermark"
              aria-hidden="true"
            />

            <div
              className="rn-certificate-security-pattern"
              aria-hidden="true"
            />

            <div className="rn-certificate-inner">
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

                <div
                  className="rn-certificate-header-accent"
                  aria-hidden="true"
                >
                  <span />
                  <span />
                  <span />
                </div>
              </header>

              {certificate.is_revoked ? (
                <div
                  className="rn-certificate-revoked"
                  role="alert"
                >
                  REVOKED
                </div>
              ) : null}

              <section className="rn-certificate-main">
                <div className="rn-certificate-eyebrow">
                  CERTIFICATE OF COMPLETION
                </div>

                <h1>Certificate of Completion</h1>

                <p className="rn-certificate-presented">
                  This Certificate is Proudly Presented to
                </p>

                <h2>{certificate.holder_name}</h2>

                <div
                  className="rn-certificate-name-rule"
                  aria-hidden="true"
                >
                  <span />
                </div>

                <p className="rn-certificate-completion-text">
                  For successfully completing the
                </p>

                <h3>{certificate.course_title}</h3>
              </section>

              <section
                className="rn-certificate-credential-strip"
                aria-label="Certificate credentials"
              >
                <div className="rn-certificate-credential">
                  <span>Credential</span>
                  <strong>Course Completion</strong>
                </div>

                <div className="rn-certificate-credential">
                  <span>Date Issued</span>
                  <strong>
                    {formatDate(certificate.issued_at)}
                  </strong>
                </div>

                <div className="rn-certificate-credential">
                  <span>Assessment</span>
                  <strong>
                    {certificate.assessment_score ?? "—"}%
                  </strong>
                </div>

                <div className="rn-certificate-credential">
                  <span>Capstone</span>
                  <strong>
                    {certificate.capstone_score ?? "—"}/100
                  </strong>
                </div>
              </section>

              <div className="rn-certificate-number">
                <span>Certificate No.</span>

                <strong>
                  {certificate.certificate_number}
                </strong>
              </div>

              {!certificate.is_revoked ? (
                <section
                  className="rn-certificate-authentication"
                  aria-label="Certificate authentication"
                >
                  <div className="rn-certificate-qr-panel">
                    <div className="rn-certificate-qr-frame">
                      <img
                        src={qrCodeUrl}
                        alt={`QR code for verifying certificate ${certificate.certificate_number}`}
                        width={220}
                        height={220}
                        className="rn-certificate-qr-image"
                      />
                    </div>

                    <div className="rn-certificate-qr-copy">
                      <strong>SCAN TO VERIFY</strong>

                      <span>
                        Official RuffNeck Learn verification
                      </span>

                      <small>
                        {certificate.certificate_number}
                      </small>
                    </div>
                  </div>

                  <div className="rn-certificate-authentication-branding">
                    <img
                      src="/brand/ruffneck-certificate-seal.png"
                      alt="RuffNeck Learn Certificate Seal"
                      className="rn-certificate-seal"
                    />

                    <img
                      src="/brand/ruffneck-security-stamp.png"
                      alt="RuffNeck security verification stamp"
                      className="rn-certificate-security-stamp"
                    />
                  </div>
                </section>
              ) : null}

              {certificate.is_revoked &&
              certificate.revoked_reason ? (
                <div className="rn-certificate-revoked-note">
                  {certificate.revoked_reason}
                </div>
              ) : null}

              <footer className="rn-certificate-footer">
                <div className="rn-certificate-signatory">
                  <div className="rn-certificate-signature-wrap">
                    <img
                      src="/brand/founder-signature.png"
                      alt="Hassan Zakariya signature"
                      className="rn-certificate-signature-image"
                    />
                  </div>

                  <div
                    className="rn-certificate-signature-line"
                    aria-hidden="true"
                  />

                  <strong>Hassan Zakariya</strong>

                  <span>Founder &amp; CEO</span>

                  <span>RuffNeck Entertainment</span>
                </div>

                <div className="rn-certificate-institution">
                  <img
                    src="/brand/ruffneck-company-stamp.png"
                    alt="RuffNeck Entertainment company stamp"
                    className="rn-certificate-company-stamp"
                  />

                  <div className="rn-certificate-institution-copy">
                    <strong>RuffNeck Entertainment</strong>

                    <span>
                      Professional Learning &amp; Digital Skills
                    </span>
                  </div>
                </div>

                <div className="rn-certificate-footer-meta">
                  <strong>
                    {certificate.certificate_number}
                  </strong>

                  <span>
                    Issued {formatDate(certificate.issued_at)}
                  </span>

                  <span>RUFFNECK LEARN</span>
                </div>
              </footer>
            </div>
          </div>
        </article>

        {!certificate.is_revoked ? (
          <div className="no-print">
            <CertificateVerificationLink
              certificateNumber={
                certificate.certificate_number
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