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
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function buildVerificationUrl(certificateNumber: string) {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://ruffneck-lms.vercel.app";

  return `${baseUrl.replace(/\/$/, "")}/verify/certificate-number/${encodeURIComponent(
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
  params: Promise<{ certificateId: string }>;
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
    console.error("Certificate lookup failed:", certificateError);
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

  const qrCodeUrl = buildQrCodeUrl(fullVerificationUrl);

  return (
    <main className="rn-cert-page">
      <style>{`
        .rn-cert-page {
          --cert-navy: #0b1e3a;
          --cert-gold: #c49a43;
          --cert-ink: #25334a;
          --cert-muted: #657287;
          color: var(--cert-ink);
          padding: 28px 18px 44px;
          background: #f1f4f8;
        }

        .rn-cert-page *,
        .rn-cert-page *::before,
        .rn-cert-page *::after {
          box-sizing: border-box;
        }

        .rn-cert-container {
          width: 100%;
          max-width: 1180px;
          margin: 0 auto;
        }

        .rn-cert-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          margin: 0 0 22px;
        }

        .rn-cert-action-group {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px;
        }

        .rn-cert-back {
          color: var(--cert-navy);
          font-weight: 700;
          text-decoration: none;
        }

        .rn-cert-back:hover {
          text-decoration: underline;
        }

        .rn-cert-button {
          display: inline-flex;
          justify-content: center;
          align-items: center;
          min-height: 42px;
          padding: 10px 16px;
          border: 1px solid #d5dce6;
          border-radius: 8px;
          background: #fff;
          color: var(--cert-navy);
          font-size: 14px;
          font-weight: 700;
          text-decoration: none;
          cursor: pointer;
        }

        .rn-cert-button-primary {
          border-color: var(--cert-navy);
          background: var(--cert-navy);
          color: #fff;
        }

        .rn-cert-sheet {
          position: relative;
          isolation: isolate;
          display: flex;
          flex-direction: column;
          width: 100%;
          aspect-ratio: 297 / 210;
          min-height: 0;
          padding: 2.7%;
          overflow: hidden;
          background: #fff;
          border: 1px solid #e0e4eb;
          box-shadow: 0 18px 55px rgba(11, 30, 58, 0.12);
          color: var(--cert-ink);
          font-family: Georgia, "Times New Roman", serif;
        }

        .rn-cert-sheet::before {
          position: absolute;
          z-index: -1;
          content: "";
          inset: 1.5%;
          border: 1px solid var(--cert-gold);
          pointer-events: none;
        }

        .rn-cert-sheet::after {
          position: absolute;
          z-index: -1;
          content: "";
          inset: 2.1%;
          border: 1px solid rgba(11, 30, 58, 0.18);
          pointer-events: none;
        }

        .rn-cert-watermark {
          position: absolute;
          z-index: -1;
          inset: 0;
          background:
            radial-gradient(
              ellipse at center,
              rgba(196, 154, 67, 0.075),
              transparent 60%
            );
          pointer-events: none;
        }

        .rn-cert-header {
          flex: 0 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          line-height: 1.1;
        }

        .rn-cert-logo {
          display: block;
          width: auto;
          height: 10.5%;
          max-width: 19%;
          object-fit: contain;
          margin-bottom: 0.3%;
        }

        .rn-cert-brand {
          color: var(--cert-navy);
          font-family: Arial, Helvetica, sans-serif;
          font-size: clamp(10px, 1.35vw, 17px);
          font-weight: 900;
          letter-spacing: 0.22em;
        }

        .rn-cert-tagline {
          margin-top: 3px;
          color: #697487;
          font-family: Arial, Helvetica, sans-serif;
          font-size: clamp(6px, 0.65vw, 9px);
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .rn-cert-rule {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          width: 26%;
          margin: 0.8% auto 0;
        }

        .rn-cert-rule span {
          display: block;
          height: 2px;
          flex: 1;
          background: var(--cert-gold);
        }

        .rn-cert-rule span:nth-child(2) {
          flex: 0 0 9px;
          height: 9px;
          transform: rotate(45deg);
        }

        .rn-cert-main {
          flex: 1 1 auto;
          min-height: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 1.1% 4% 0.7%;
        }

        .rn-cert-eyebrow {
          margin: 0 0 0.5%;
          color: var(--cert-gold);
          font-family: Arial, Helvetica, sans-serif;
          font-size: clamp(7px, 0.85vw, 11px);
          font-weight: 800;
          letter-spacing: 0.25em;
        }

        .rn-cert-main h1 {
          margin: 0;
          color: var(--cert-navy);
          font-size: clamp(19px, 3.1vw, 43px);
          font-weight: 500;
          line-height: 1.05;
          letter-spacing: 0.015em;
        }

        .rn-cert-presented {
          margin: 1.2% 0 0.3%;
          color: #657287;
          font-family: Arial, Helvetica, sans-serif;
          font-size: clamp(8px, 0.95vw, 12px);
        }

        .rn-cert-holder {
          max-width: 100%;
          margin: 0;
          color: var(--cert-navy);
          font-size: clamp(22px, 3.3vw, 46px);
          font-weight: 700;
          line-height: 1.1;
          overflow-wrap: anywhere;
        }

        .rn-cert-name-rule {
          width: 40%;
          height: 1px;
          margin: 0.8% 0;
          background: linear-gradient(
            90deg,
            transparent,
            var(--cert-gold),
            transparent
          );
        }

        .rn-cert-completion {
          margin: 0;
          color: #657287;
          font-family: Arial, Helvetica, sans-serif;
          font-size: clamp(8px, 0.95vw, 12px);
        }

        .rn-cert-course {
          max-width: 100%;
          margin: 0.5% 0 0;
          color: var(--cert-navy);
          font-size: clamp(13px, 1.7vw, 23px);
          font-weight: 700;
          line-height: 1.2;
          overflow-wrap: anywhere;
        }

        .rn-cert-revoked {
          flex: 0 0 auto;
          align-self: center;
          margin: 5px 0;
          padding: 5px 14px;
          border: 2px solid #b42318;
          color: #b42318;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.15em;
        }

        .rn-cert-revoked-note {
          flex: 0 0 auto;
          margin: 4px 0;
          color: #b42318;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 10px;
          text-align: center;
          overflow-wrap: anywhere;
        }

        .rn-cert-credentials {
          flex: 0 0 auto;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          border-top: 1px solid #e1e5eb;
          border-bottom: 1px solid #e1e5eb;
          margin: 0.7% 0 0;
          padding: 0.7% 0;
        }

        .rn-cert-credential {
          min-width: 0;
          padding: 0 8px;
          text-align: center;
          border-right: 1px solid #e1e5eb;
        }

        .rn-cert-credential:last-child {
          border-right: 0;
        }

        .rn-cert-credential span {
          display: block;
          margin-bottom: 4px;
          color: #738095;
          font-family: Arial, Helvetica, sans-serif;
          font-size: clamp(6px, 0.7vw, 9px);
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .rn-cert-credential strong {
          display: block;
          color: var(--cert-navy);
          font-family: Arial, Helvetica, sans-serif;
          font-size: clamp(7px, 0.85vw, 11px);
          line-height: 1.2;
          overflow-wrap: anywhere;
        }

        .rn-cert-number {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-wrap: wrap;
          gap: 7px;
          margin: 0.65% 0 0;
          color: #657287;
          font-family: Arial, Helvetica, sans-serif;
          font-size: clamp(7px, 0.75vw, 10px);
        }

        .rn-cert-number strong {
          color: var(--cert-navy);
          letter-spacing: 0.07em;
          overflow-wrap: anywhere;
        }

        .rn-cert-bottom {
          flex: 0 0 auto;
          display: grid;
          grid-template-columns: 1fr 1.15fr 1fr;
          align-items: end;
          gap: 2.5%;
          min-height: 0;
          margin-top: 1%;
          padding-top: 0.7%;
          border-top: 1px solid rgba(196, 154, 67, 0.7);
          font-family: Arial, Helvetica, sans-serif;
        }

        .rn-cert-signatory,
        .rn-cert-institution,
        .rn-cert-verification {
          min-width: 0;
          text-align: center;
        }

        .rn-cert-signature {
          display: block;
          width: auto;
          height: 30px;
          max-width: 100%;
          object-fit: contain;
          object-position: center bottom;
          margin: 0 auto;
        }

        .rn-cert-signature-line {
          width: 88%;
          height: 1px;
          margin: 2px auto 5px;
          background: #aeb6c2;
        }

        .rn-cert-signatory strong,
        .rn-cert-institution strong {
          display: block;
          color: var(--cert-navy);
          font-size: clamp(7px, 0.8vw, 11px);
          line-height: 1.2;
        }

        .rn-cert-signatory span,
        .rn-cert-institution span,
        .rn-cert-verification span {
          display: block;
          margin-top: 3px;
          color: #657287;
          font-size: clamp(6px, 0.65vw, 9px);
          line-height: 1.2;
          overflow-wrap: anywhere;
        }

        .rn-cert-stamps {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-bottom: 3px;
        }

        .rn-cert-company-stamp {
          display: block;
          width: 39px;
          height: 39px;
          object-fit: contain;
        }

        .rn-cert-seal {
          display: block;
          width: 43px;
          height: 43px;
          object-fit: contain;
        }

        .rn-cert-security-stamp {
          display: block;
          width: 35px;
          height: 35px;
          object-fit: contain;
        }

        .rn-cert-qr-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          text-align: left;
        }

        .rn-cert-qr {
          display: block;
          flex: 0 0 auto;
          width: 48px;
          height: 48px;
          object-fit: contain;
          background: #fff;
        }

        .rn-cert-qr-copy {
          min-width: 0;
        }

        .rn-cert-qr-copy strong {
          display: block;
          color: var(--cert-navy);
          font-size: clamp(7px, 0.75vw, 10px);
          line-height: 1.2;
        }

        .rn-cert-qr-copy span {
          display: block;
          margin-top: 3px;
          color: #657287;
          font-size: clamp(6px, 0.6vw, 8px);
          line-height: 1.2;
          overflow-wrap: anywhere;
        }

        .rn-cert-footer-meta {
          margin-top: 4px;
          color: #657287;
          font-size: clamp(6px, 0.6vw, 8px);
          line-height: 1.3;
          overflow-wrap: anywhere;
        }

        .rn-cert-footer-meta strong {
          color: var(--cert-navy);
        }

        .rn-cert-extra-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 22px;
        }

        .rn-cert-page img {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        @media (max-width: 680px) {
          .rn-cert-page {
            padding: 18px 8px 30px;
          }

          .rn-cert-sheet {
            aspect-ratio: auto;
            min-height: 600px;
            padding: 24px 18px;
          }

          .rn-cert-sheet::before {
            inset: 8px;
          }

          .rn-cert-sheet::after {
            inset: 13px;
          }

          .rn-cert-logo {
            height: 54px;
            max-width: 55%;
            margin-bottom: 8px;
          }

          .rn-cert-brand {
            font-size: 13px;
          }

          .rn-cert-tagline {
            font-size: 7px;
            letter-spacing: 0.05em;
          }

          .rn-cert-main {
            padding: 26px 2px 18px;
          }

          .rn-cert-main h1 {
            font-size: 25px;
          }

          .rn-cert-holder {
            font-size: 28px;
          }

          .rn-cert-course {
            font-size: 17px;
          }

          .rn-cert-credentials {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            row-gap: 14px;
            padding: 14px 0;
          }

          .rn-cert-credential:nth-child(2) {
            border-right: 0;
          }

          .rn-cert-bottom {
            grid-template-columns: 1fr 1fr;
            row-gap: 20px;
            margin-top: 18px;
            padding-top: 14px;
          }

          .rn-cert-verification {
            grid-column: 1 / -1;
          }

          .rn-cert-actions {
            align-items: stretch;
          }

          .rn-cert-action-group {
            width: 100%;
          }

          .rn-cert-button {
            flex: 1;
          }
        }

        @page {
          size: A4 landscape;
          margin: 0;
        }

        @media print {
          html,
          body {
            width: 297mm !important;
            height: 210mm !important;
            min-width: 297mm !important;
            min-height: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            background: #fff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body * {
            visibility: hidden !important;
          }

          .rn-cert-page,
          .rn-cert-page * {
            visibility: visible !important;
          }

          .rn-cert-page {
            position: fixed !important;
            inset: 0 auto auto 0 !important;
            display: block !important;
            width: 297mm !important;
            height: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            background: #fff !important;
          }

          .rn-cert-container {
            display: block !important;
            width: 297mm !important;
            max-width: none !important;
            height: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .rn-cert-actions,
          .rn-cert-extra-actions,
          .no-print,
          .rn-certificate-view-actions,
          .rn-certificate-bottom-actions {
            display: none !important;
          }

          .rn-cert-sheet {
            position: relative !important;
            display: flex !important;
            flex-direction: column !important;
            width: 297mm !important;
            height: 210mm !important;
            min-height: 0 !important;
            max-height: 210mm !important;
            aspect-ratio: auto !important;
            margin: 0 !important;
            padding: 7mm !important;
            overflow: hidden !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            box-sizing: border-box !important;
            break-before: avoid-page !important;
            break-after: avoid-page !important;
            break-inside: avoid-page !important;
            page-break-before: avoid !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .rn-cert-sheet::before {
            inset: 4mm !important;
            border-width: 0.4mm !important;
          }

          .rn-cert-sheet::after {
            inset: 6mm !important;
            border-width: 0.2mm !important;
          }

          .rn-cert-header {
            flex: 0 0 22mm !important;
            height: 22mm !important;
            min-height: 22mm !important;
          }

          .rn-cert-logo {
            height: 11mm !important;
            max-height: 11mm !important;
            max-width: 43mm !important;
            margin-bottom: 0.5mm !important;
          }

          .rn-cert-brand {
            font-size: 11pt !important;
            letter-spacing: 0.2em !important;
          }

          .rn-cert-tagline {
            margin-top: 1mm !important;
            font-size: 6pt !important;
            letter-spacing: 0.1em !important;
          }

          .rn-cert-rule {
            margin-top: 1mm !important;
            width: 25% !important;
          }

          .rn-cert-main {
            flex: 1 1 auto !important;
            min-height: 0 !important;
            padding: 2mm 12mm !important;
            justify-content: center !important;
          }

          .rn-cert-eyebrow {
            margin-bottom: 1.5mm !important;
            font-size: 8pt !important;
            letter-spacing: 0.24em !important;
          }

          .rn-cert-main h1 {
            font-size: 27pt !important;
            line-height: 1.05 !important;
          }

          .rn-cert-presented {
            margin: 3mm 0 1mm !important;
            font-size: 9pt !important;
          }

          .rn-cert-holder {
            font-size: 30pt !important;
            line-height: 1.05 !important;
          }

          .rn-cert-name-rule {
            margin: 2mm 0 !important;
            width: 38% !important;
          }

          .rn-cert-completion {
            font-size: 9pt !important;
          }

          .rn-cert-course {
            margin-top: 1.5mm !important;
            font-size: 16pt !important;
            line-height: 1.15 !important;
          }

          .rn-cert-revoked {
            margin: 1mm 0 !important;
            padding: 1mm 4mm !important;
            font-size: 8pt !important;
          }

          .rn-cert-revoked-note {
            margin: 1mm 0 !important;
            font-size: 7pt !important;
          }

          .rn-cert-credentials {
            flex: 0 0 15mm !important;
            min-height: 15mm !important;
            margin: 0 !important;
            padding: 2mm 0 !important;
          }

          .rn-cert-credential {
            padding: 0 3mm !important;
          }

          .rn-cert-credential span {
            margin-bottom: 1mm !important;
            font-size: 6.5pt !important;
          }

          .rn-cert-credential strong {
            font-size: 8pt !important;
          }

          .rn-cert-number {
            flex: 0 0 auto !important;
            margin: 1.5mm 0 0 !important;
            gap: 2mm !important;
            font-size: 7pt !important;
          }

          .rn-cert-bottom {
            flex: 0 0 31mm !important;
            height: 31mm !important;
            min-height: 31mm !important;
            margin-top: 2mm !important;
            padding-top: 2mm !important;
            gap: 3mm !important;
          }

          .rn-cert-signature {
            height: 9mm !important;
            max-height: 9mm !important;
          }

          .rn-cert-signature-line {
            margin: 0.5mm auto 1mm !important;
          }

          .rn-cert-signatory strong,
          .rn-cert-institution strong {
            font-size: 7.5pt !important;
          }

          .rn-cert-signatory span,
          .rn-cert-institution span {
            margin-top: 0.7mm !important;
            font-size: 6.5pt !important;
          }

          .rn-cert-stamps {
            gap: 2mm !important;
            margin-bottom: 0.5mm !important;
          }

          .rn-cert-company-stamp {
            width: 13mm !important;
            height: 13mm !important;
          }

          .rn-cert-seal {
            width: 14mm !important;
            height: 14mm !important;
          }

          .rn-cert-security-stamp {
            width: 11mm !important;
            height: 11mm !important;
          }

          .rn-cert-qr-row {
            gap: 2mm !important;
          }

          .rn-cert-qr {
            width: 14mm !important;
            height: 14mm !important;
          }

          .rn-cert-qr-copy strong {
            font-size: 7pt !important;
          }

          .rn-cert-qr-copy span {
            margin-top: 1mm !important;
            font-size: 6pt !important;
          }

          .rn-cert-footer-meta {
            margin-top: 1mm !important;
            font-size: 6pt !important;
          }

          .rn-cert-page img {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <div className="rn-cert-container">
        <div className="rn-cert-actions">
          <Link href="/student/certificates" className="rn-cert-back">
            ← My Certificates
          </Link>

          <div className="rn-cert-action-group">
            <Link
              href={verificationUrl}
              className="rn-cert-button"
            >
              Verify Certificate
            </Link>

            {!certificate.is_revoked ? (
              <CertificatePrintButton />
            ) : null}
          </div>
        </div>

        <article className="rn-cert-sheet">
          <div className="rn-cert-watermark" aria-hidden="true" />

          <header className="rn-cert-header">
            <img
              src="/brand/ruffneck-logo.png"
              alt="RuffNeck Entertainment"
              className="rn-cert-logo"
            />

            <div className="rn-cert-brand">RUFFNECK LEARN</div>

            <div className="rn-cert-tagline">
              AI • Digital Transformation • Business Solutions
            </div>

            <div className="rn-cert-rule" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </header>

          {certificate.is_revoked ? (
            <div className="rn-cert-revoked" role="alert">
              REVOKED
            </div>
          ) : null}

          <section className="rn-cert-main">
            <div className="rn-cert-eyebrow">
              OFFICIAL PROFESSIONAL CREDENTIAL
            </div>

            <h1>Certificate of Completion</h1>

            <p className="rn-cert-presented">
              This certificate is proudly presented to
            </p>

            <h2 className="rn-cert-holder">
              {certificate.holder_name}
            </h2>

            <div className="rn-cert-name-rule" aria-hidden="true" />

            <p className="rn-cert-completion">
              For successfully completing the course
            </p>

            <h3 className="rn-cert-course">
              {certificate.course_title}
            </h3>
          </section>

          <section
            className="rn-cert-credentials"
            aria-label="Certificate credentials"
          >
            <div className="rn-cert-credential">
              <span>Credential</span>
              <strong>Course Completion</strong>
            </div>

            <div className="rn-cert-credential">
              <span>Date Issued</span>
              <strong>{formatDate(certificate.issued_at)}</strong>
            </div>

            <div className="rn-cert-credential">
              <span>Assessment</span>
              <strong>
                {certificate.assessment_score ?? "—"}%
              </strong>
            </div>

            <div className="rn-cert-credential">
              <span>Capstone</span>
              <strong>
                {certificate.capstone_score ?? "—"}/100
              </strong>
            </div>
          </section>

          <div className="rn-cert-number">
            <span>Certificate Number</span>
            <strong>{certificate.certificate_number}</strong>
          </div>

          {certificate.is_revoked && certificate.revoked_reason ? (
            <div className="rn-cert-revoked-note">
              Reason: {certificate.revoked_reason}
            </div>
          ) : null}

          <footer className="rn-cert-bottom">
            <div className="rn-cert-signatory">
              <img
                src="/brand/founder-signature.png"
                alt="Hassan Zakariya signature"
                className="rn-cert-signature"
              />

              <div
                className="rn-cert-signature-line"
                aria-hidden="true"
              />

              <strong>Hassan Zakariya</strong>
              <span>Founder &amp; CEO</span>
              <span>RuffNeck Entertainment</span>
            </div>

            <div className="rn-cert-institution">
              <div className="rn-cert-stamps">
                <img
                  src="/brand/ruffneck-company-stamp.png"
                  alt="RuffNeck Entertainment company stamp"
                  className="rn-cert-company-stamp"
                />

                <img
                  src="/brand/ruffneck-certificate-seal.png"
                  alt="RuffNeck Learn certificate seal"
                  className="rn-cert-seal"
                />

                <img
                  src="/brand/ruffneck-security-stamp.png"
                  alt="RuffNeck security stamp"
                  className="rn-cert-security-stamp"
                />
              </div>

              <strong>RuffNeck Entertainment</strong>
              <span>Professional Learning &amp; Digital Skills</span>
            </div>

            <div className="rn-cert-verification">
              {!certificate.is_revoked ? (
                <div className="rn-cert-qr-row">
                  <img
                    src={qrCodeUrl}
                    alt={`QR code for certificate ${certificate.certificate_number}`}
                    width={150}
                    height={150}
                    className="rn-cert-qr"
                  />

                  <div className="rn-cert-qr-copy">
                    <strong>SCAN TO VERIFY</strong>
                    <span>Official certificate verification</span>
                  </div>
                </div>
              ) : (
                <div className="rn-cert-footer-meta">
                  This certificate has been revoked.
                </div>
              )}

              <div className="rn-cert-footer-meta">
                <strong>{certificate.certificate_number}</strong>
                <br />
                Issued {formatDate(certificate.issued_at)}
                <br />
                RUFFNECK LEARN
              </div>
            </div>
          </footer>
        </article>

        {!certificate.is_revoked ? (
          <div style={{ marginTop: 20 }}>
            <CertificateVerificationLink
              certificateNumber={certificate.certificate_number}
            />
          </div>
        ) : null}

        <div className="rn-cert-extra-actions">
          <Link
            href="/student/certificates"
            className="rn-cert-button"
          >
            All Certificates
          </Link>

          <Link href="/courses" className="rn-cert-button">
            Browse Courses
          </Link>
        </div>
      </div>
    </main>
  );
}