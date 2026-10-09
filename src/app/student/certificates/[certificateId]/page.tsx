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

type PageProps = {
  params: Promise<{ certificateId: string }>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function formatScore(value: number | null) {
  return value == null ? "Not recorded" : `${value}%`;
}

function getVerificationUrl(certificateNumber: string) {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://ruffneck-lms.vercel.app";

  return `${baseUrl.replace(/\/$/, "")}/verify/certificate-number/${encodeURIComponent(
    certificateNumber
  )}`;
}

function getQrUrl(verificationUrl: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&format=png&margin=4&data=${encodeURIComponent(
    verificationUrl
  )}`;
}

export default async function CertificatePage({ params }: PageProps) {
  const { certificateId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?next=/student/certificates/${encodeURIComponent(certificateId)}`
    );
  }

  const { data, error } = await supabase
    .from("course_certificates")
    .select(
      "id, certificate_number, holder_name, course_title, issued_at, assessment_score, capstone_score, is_revoked, revoked_reason"
    )
    .eq("id", certificateId)
    .eq("student_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Certificate retrieval failed:", error);
    throw new Error("Unable to load this certificate.");
  }

  if (!data) {
    notFound();
  }

  const certificate = data as Certificate;
  const revoked = certificate.is_revoked;
  const issuedDate = formatDate(certificate.issued_at);
  const verificationUrl = getVerificationUrl(
    certificate.certificate_number
  );
  const qrUrl = getQrUrl(verificationUrl);

  return (
    <main className="certificate-page">
      <style>{`
        .certificate-page {
          --navy: #0b1e3a;
          --navy-light: #18385e;
          --gold: #c79a43;
          --gold-light: #ead6a5;
          --ink: #24334a;
          --muted: #64748b;
          min-height: 100vh;
          padding: 26px 20px 42px;
          color: var(--ink);
          background: #f0f3f7;
          font-family: Arial, Helvetica, sans-serif;
        }

        .certificate-toolbar {
          width: min(1180px, 100%);
          margin: 0 auto 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .certificate-toolbar-group {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .certificate-toolbar a,
        .certificate-toolbar button {
          min-height: 42px;
          padding: 10px 15px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #d4dce7;
          border-radius: 7px;
          background: #fff;
          color: var(--navy);
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
        }

        .certificate-toolbar a:hover {
          border-color: var(--gold);
        }

        .certificate-toolbar .certificate-primary-action {
          background: var(--navy);
          color: white;
          border-color: var(--navy);
        }

        .certificate-paper {
          position: relative;
          isolation: isolate;
          width: min(1180px, 100%);
          aspect-ratio: 297 / 210;
          margin: 0 auto;
          overflow: hidden;
          background: #fffefa;
          box-shadow: 0 16px 45px rgba(11, 30, 58, 0.16);
          container-type: inline-size;
        }

        /*
          Keep the background, border, watermark, and content in
          separate positive stacking layers. No negative z-index.
        */
        .certificate-border {
          position: absolute;
          z-index: 0;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: fill;
          opacity: 1;
          pointer-events: none;
        }

        .certificate-paper-background {
          position: absolute;
          z-index: 0;
          inset: 2%;
          background: rgba(255, 254, 250, 0.88);
          pointer-events: none;
        }

        .certificate-watermark {
          position: absolute;
          z-index: 1;
          top: 48%;
          left: 48%;
          width: 43%;
          height: 64%;
          transform: translate(-50%, -50%);
          object-fit: contain;
          opacity: 0.10;
          pointer-events: none;
        }

        .certificate-layout {
          position: absolute;
          z-index: 2;
          inset: 5.5% 5% 6%;
          display: grid;
          grid-template-columns: 18% minmax(0, 1fr) 18%;
          grid-template-rows: 21% minmax(0, 1fr) 23%;
          column-gap: 2%;
          min-width: 0;
        }

        .certificate-header {
          grid-column: 1 / 3;
          grid-row: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2.5%;
          min-width: 0;
          padding: 0 1%;
        }

        .certificate-logo {
          display: block;
          width: 22%;
          max-width: 165px;
          max-height: 92%;
          object-fit: contain;
          flex-shrink: 0;
        }

        .certificate-brand {
          min-width: 0;
          text-align: center;
        }

        .certificate-brand-name {
          margin: 0;
          color: var(--navy);
          font-size: clamp(20px, 3.15cqw, 38px);
          font-weight: 900;
          line-height: 1;
          letter-spacing: 0.11em;
          white-space: nowrap;
        }

        .certificate-brand-learn {
          margin-top: 4px;
          color: #a77824;
          font-size: clamp(10px, 1.25cqw, 15px);
          font-weight: 800;
          letter-spacing: 0.45em;
        }

        .certificate-brand-rule {
          height: 2px;
          width: 82%;
          margin: 7px auto 6px;
          background: linear-gradient(
            90deg,
            transparent,
            var(--gold),
            transparent
          );
        }

        .certificate-tagline {
          color: #536176;
          font-size: clamp(6px, 0.75cqw, 9px);
          font-weight: 700;
          letter-spacing: 0.09em;
          white-space: nowrap;
        }

        .certificate-left-seal {
          grid-column: 1;
          grid-row: 2;
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 0;
          padding: 5%;
        }

        .certificate-medal {
          width: 100%;
          max-height: 85%;
          object-fit: contain;
        }

        .certificate-main {
          grid-column: 2;
          grid-row: 2;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          min-width: 0;
          padding: 0 1%;
          text-align: center;
        }

        .certificate-kicker {
          margin: 0 0 4px;
          color: #a77824;
          font-size: clamp(7px, 0.8cqw, 10px);
          font-weight: 800;
          letter-spacing: 0.2em;
          text-transform: uppercase;
        }

        .certificate-title {
          margin: 0;
          color: var(--navy);
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(27px, 4.1cqw, 49px);
          font-weight: 700;
          line-height: 1;
          letter-spacing: 0.045em;
          white-space: nowrap;
        }

        .certificate-title-subtitle {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin: 7px 0 12px;
          color: #a77824;
          font-size: clamp(8px, 1.05cqw, 13px);
          font-weight: 800;
          letter-spacing: 0.3em;
          white-space: nowrap;
        }

        .certificate-title-subtitle::before,
        .certificate-title-subtitle::after {
          content: "";
          width: 35px;
          height: 1px;
          background: var(--gold);
        }

        .certificate-recipient-intro {
          margin: 0 0 3px;
          color: #48566c;
          font-size: clamp(8px, 0.83cqw, 10px);
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .certificate-recipient {
          max-width: 100%;
          margin: 0;
          color: var(--navy);
          font-family: "Brush Script MT", "Segoe Script", cursive;
          font-size: clamp(29px, 4.1cqw, 49px);
          font-weight: 500;
          line-height: 1.15;
          overflow-wrap: anywhere;
        }

        .certificate-recipient-rule {
          width: 90%;
          height: 1px;
          margin: 7px 0 8px;
          background: linear-gradient(
            90deg,
            transparent,
            var(--gold),
            transparent
          );
        }

        .certificate-recognition {
          max-width: 95%;
          margin: 0 0 6px;
          color: #48566c;
          font-size: clamp(7px, 0.78cqw, 9px);
          line-height: 1.45;
        }

        .certificate-course-title {
          max-width: 100%;
          margin: 0;
          color: var(--navy);
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(12px, 1.55cqw, 19px);
          font-weight: 800;
          line-height: 1.2;
          text-transform: uppercase;
          overflow-wrap: anywhere;
        }

        .certificate-course-label {
          margin-top: 4px;
          color: #a77824;
          font-size: clamp(7px, 0.78cqw, 9px);
          font-weight: 800;
          letter-spacing: 0.22em;
        }

        .certificate-achievement {
          max-width: 95%;
          margin: 7px 0 0;
          color: #59677a;
          font-size: clamp(7px, 0.72cqw, 9px);
          line-height: 1.4;
        }

        .certificate-right-panel {
          grid-column: 3;
          grid-row: 1 / 3;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-width: 0;
          padding: 9% 4% 3%;
          border-left: 1px solid rgba(199, 154, 67, 0.85);
          text-align: center;
        }

        .certificate-qr-frame {
          display: flex;
          align-items: center;
          justify-content: center;
          width: min(76%, 104px);
          aspect-ratio: 1;
          padding: 4px;
          border: 1px solid var(--gold);
          background: white;
        }

        .certificate-qr {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .certificate-verify-heading {
          margin: 7px 0 3px;
          color: var(--navy);
          font-size: clamp(7px, 0.72cqw, 9px);
          font-weight: 900;
          letter-spacing: 0.05em;
        }

        .certificate-verify-copy {
          margin: 0;
          color: var(--muted);
          font-size: clamp(6px, 0.62cqw, 8px);
          line-height: 1.4;
        }

        .certificate-number-label {
          width: 100%;
          margin-top: 9px;
          padding: 5px 3px;
          background: var(--navy);
          color: white;
          font-size: clamp(6px, 0.61cqw, 8px);
          font-weight: 800;
          letter-spacing: 0.06em;
        }

        .certificate-number {
          margin: 5px 0 0;
          color: var(--navy);
          font-size: clamp(7px, 0.73cqw, 9px);
          font-weight: 800;
          overflow-wrap: anywhere;
        }

        .certificate-record-divider {
          width: 100%;
          height: 1px;
          margin: 8px 0 6px;
          background: var(--gold-light);
        }

        .certificate-record-heading {
          width: 100%;
          margin: 0 0 5px;
          color: var(--navy);
          font-size: clamp(6px, 0.65cqw, 8px);
          font-weight: 900;
          letter-spacing: 0.08em;
          text-align: left;
        }

        .certificate-record-row {
          width: 100%;
          display: flex;
          align-items: flex-start;
          gap: 5px;
          margin: 4px 0;
          text-align: left;
        }

        .certificate-record-icon {
          flex: 0 0 15px;
          color: #b17c22;
          font-size: 12px;
          font-weight: 900;
          text-align: center;
        }

        .certificate-record-copy {
          min-width: 0;
          color: #5c6b80;
          font-size: clamp(6px, 0.59cqw, 7px);
          line-height: 1.35;
          overflow-wrap: anywhere;
        }

        .certificate-record-copy strong {
          display: block;
          color: var(--navy);
          font-size: clamp(6px, 0.65cqw, 8px);
        }

        .certificate-footer {
          grid-column: 1 / 4;
          grid-row: 3;
          display: grid;
          grid-template-columns: 1fr 1.1fr 1fr;
          align-items: end;
          gap: 2%;
          min-width: 0;
          padding: 0 1% 1%;
        }

        .certificate-signature {
          min-width: 0;
          text-align: center;
        }

        .certificate-signature-image {
          display: block;
          width: 62%;
          height: 30px;
          margin: 0 auto;
          object-fit: contain;
          object-position: center bottom;
        }

        .certificate-signature-space {
          height: 30px;
        }

        .certificate-signature-line {
          width: 92%;
          height: 1px;
          margin: 0 auto 4px;
          background: var(--gold);
        }

        .certificate-signature-name {
          margin: 0;
          color: var(--navy);
          font-size: clamp(7px, 0.73cqw, 9px);
          font-weight: 900;
        }

        .certificate-signature-role {
          margin: 3px 0 0;
          color: #9b722c;
          font-size: clamp(6px, 0.61cqw, 7px);
          line-height: 1.3;
        }

        .certificate-official-seals {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5%;
          min-width: 0;
        }

        .certificate-official-seal {
          display: block;
          width: 27%;
          max-width: 76px;
          max-height: 72px;
          object-fit: contain;
        }

        .certificate-revoked-overlay {
          position: absolute;
          z-index: 5;
          top: 44%;
          left: 50%;
          width: 72%;
          transform: translate(-50%, -50%) rotate(-7deg);
          padding: 10px;
          border: 4px solid #a51d2d;
          background: rgba(255, 255, 255, 0.96);
          color: #a51d2d;
          font-size: clamp(22px, 4cqw, 46px);
          font-weight: 900;
          letter-spacing: 0.14em;
          text-align: center;
        }

        .certificate-revoked-reason {
          position: absolute;
          z-index: 6;
          top: 56%;
          left: 50%;
          width: 65%;
          transform: translateX(-50%);
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.97);
          color: #84202b;
          font-size: 11px;
          text-align: center;
        }

        .certificate-revoked-notice {
          width: min(1180px, 100%);
          margin: 14px auto 0;
          padding: 12px 15px;
          border: 1px solid #efb4ba;
          border-radius: 7px;
          background: #fff4f4;
          color: #8b1d2b;
          font-size: 13px;
          line-height: 1.5;
        }

        .certificate-verification-component {
          display: flex;
          justify-content: center;
          margin: 16px auto 0;
        }

        .certificate-after-paper {
          width: min(1180px, 100%);
          margin: 16px auto 0;
          color: #66758a;
          font-size: 12px;
          line-height: 1.7;
          text-align: center;
        }

        .certificate-after-paper a {
          color: var(--navy);
          font-weight: 700;
          text-underline-offset: 3px;
        }

        @media (max-width: 700px) {
          .certificate-page {
            padding: 12px 8px 25px;
          }

          .certificate-paper {
            aspect-ratio: auto;
            min-height: 0;
          }

          .certificate-border {
            object-fit: fill;
          }

          .certificate-layout {
            position: relative;
            inset: auto;
            display: flex;
            flex-direction: column;
            gap: 17px;
            padding: 9% 8%;
          }

          .certificate-header {
            justify-content: center;
            padding: 8px 0;
            gap: 12px;
          }

          .certificate-logo {
            width: 25%;
            max-width: 100px;
          }

          .certificate-brand-name {
            font-size: clamp(18px, 5vw, 28px);
          }

          .certificate-brand-learn {
            font-size: 10px;
          }

          .certificate-tagline {
            font-size: 7px;
            white-space: normal;
          }

          .certificate-left-seal {
            display: none;
          }

          .certificate-main {
            padding: 15px 0;
          }

          .certificate-title {
            font-size: clamp(27px, 7vw, 42px);
            white-space: normal;
          }

          .certificate-title-subtitle {
            font-size: 10px;
          }

          .certificate-recipient {
            font-size: clamp(30px, 8vw, 46px);
          }

          .certificate-recognition {
            font-size: 11px;
          }

          .certificate-course-title {
            font-size: clamp(15px, 4.3vw, 23px);
          }

          .certificate-achievement {
            font-size: 10px;
          }

          .certificate-right-panel {
            border-left: 0;
            border-top: 1px solid var(--gold);
            padding: 18px 6% 10px;
          }

          .certificate-qr-frame {
            width: 110px;
          }

          .certificate-verify-heading {
            font-size: 10px;
          }

          .certificate-verify-copy {
            font-size: 9px;
          }

          .certificate-number-label {
            max-width: 280px;
            font-size: 9px;
          }

          .certificate-number {
            font-size: 11px;
          }

          .certificate-record-heading {
            font-size: 9px;
          }

          .certificate-record-row {
            max-width: 280px;
          }

          .certificate-record-copy,
          .certificate-record-copy strong {
            font-size: 10px;
          }

          .certificate-footer {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px 10px;
            padding-top: 10px;
          }

          .certificate-official-seals {
            grid-column: 1 / 3;
            grid-row: 1;
            padding-bottom: 8px;
          }

          .certificate-official-seal {
            width: 24%;
            max-height: 70px;
          }

          .certificate-signature-name {
            font-size: 9px;
          }

          .certificate-signature-role {
            font-size: 8px;
          }

          .certificate-revoked-overlay {
            font-size: 24px;
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
            min-height: 0 !important;
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

          .certificate-paper,
          .certificate-paper * {
            visibility: visible !important;
          }

          .certificate-page {
            position: static !important;
            width: 297mm !important;
            height: 210mm !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            background: #fff !important;
          }

          .certificate-toolbar,
          .certificate-verification-component,
          .certificate-after-paper,
          .certificate-revoked-notice {
            display: none !important;
          }

          .certificate-paper {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 297mm !important;
            height: 210mm !important;
            min-height: 0 !important;
            max-height: 210mm !important;
            aspect-ratio: auto !important;
            margin: 0 !important;
            overflow: hidden !important;
            box-shadow: none !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            page-break-before: avoid !important;
            page-break-after: avoid !important;
          }

          .certificate-border {
            z-index: 0 !important;
          }

          .certificate-paper-background {
            z-index: 0 !important;
          }

          .certificate-watermark {
            z-index: 1 !important;
            opacity: 0.10 !important;
          }

          .certificate-layout {
            position: absolute !important;
            inset: 5.5% 5% 6% !important;
            display: grid !important;
            grid-template-columns: 18% minmax(0, 1fr) 18% !important;
            grid-template-rows: 21% minmax(0, 1fr) 23% !important;
            column-gap: 2% !important;
            gap: initial !important;
            padding: 0 !important;
          }

          .certificate-header {
            grid-column: 1 / 3 !important;
            grid-row: 1 !important;
            display: flex !important;
          }

          .certificate-left-seal {
            display: flex !important;
            grid-column: 1 !important;
            grid-row: 2 !important;
          }

          .certificate-main {
            grid-column: 2 !important;
            grid-row: 2 !important;
            padding: 0 1% !important;
          }

          .certificate-title {
            font-size: 4.1cqw !important;
            white-space: nowrap !important;
          }

          .certificate-recipient {
            font-size: 4.1cqw !important;
          }

          .certificate-course-title {
            font-size: 1.55cqw !important;
          }

          .certificate-right-panel {
            grid-column: 3 !important;
            grid-row: 1 / 3 !important;
            border-left: 1px solid rgba(199, 154, 67, 0.85) !important;
            border-top: 0 !important;
            padding: 9% 4% 3% !important;
          }

          .certificate-footer {
            grid-column: 1 / 4 !important;
            grid-row: 3 !important;
            display: grid !important;
            grid-template-columns: 1fr 1.1fr 1fr !important;
            gap: 2% !important;
            padding: 0 1% 1% !important;
          }

          .certificate-official-seals {
            grid-column: auto !important;
            grid-row: auto !important;
          }

          .certificate-official-seal {
            width: 27% !important;
            max-width: 76px !important;
            max-height: 72px !important;
          }

          .certificate-revoked-overlay {
            font-size: 4cqw !important;
          }
        }
      `}</style>

      <div className="certificate-toolbar">
        <div className="certificate-toolbar-group">
          <Link href="/student/certificates">
            ← My Certificates
          </Link>
        </div>

        <div className="certificate-toolbar-group">
          {!revoked && (
            <Link
              className="certificate-primary-action"
              href={`/verify/certificate-number/${encodeURIComponent(
                certificate.certificate_number
              )}`}
              target="_blank"
              rel="noreferrer"
            >
              Verify Certificate
            </Link>
          )}

          {!revoked && <CertificatePrintButton />}
        </div>
      </div>

      <article
        className="certificate-paper"
        aria-label="Certificate of completion"
      >
        <img
          className="certificate-border"
          src="/brand/ruffneck-border-background.png"
          alt=""
          aria-hidden="true"
        />

        <div className="certificate-paper-background" />

        <img
          className="certificate-watermark"
          src="/brand/transparent-ruffneck-background.png"
          alt=""
          aria-hidden="true"
        />

        <div className="certificate-layout">
          <header className="certificate-header">
            <img
              className="certificate-logo"
              src="/brand/ruffneck-logo.png"
              alt="RuffNeck Entertainment logo"
            />

            <div className="certificate-brand">
              <h1 className="certificate-brand-name">
                RUFFNECK
              </h1>

              <div className="certificate-brand-learn">
                LEARN
              </div>

              <div className="certificate-brand-rule" />

              <div className="certificate-tagline">
                AI · DIGITAL TRANSFORMATION · BUSINESS SOLUTIONS
              </div>
            </div>
          </header>

          <aside className="certificate-left-seal">
            {!revoked && (
              <img
                className="certificate-medal"
                src="/brand/ruffneck-certificate-seal.png"
                alt="RuffNeck certificate seal"
              />
            )}
          </aside>

          <section className="certificate-main">
            <p className="certificate-kicker">
              RuffNeck Learn · Professional Development
            </p>

            <h2 className="certificate-title">
              CERTIFICATE
            </h2>

            <div className="certificate-title-subtitle">
              OF COMPLETION
            </div>

            <p className="certificate-recipient-intro">
              This certificate is proudly presented to
            </p>

            <p className="certificate-recipient">
              {certificate.holder_name}
            </p>

            <div className="certificate-recipient-rule" />

            <p className="certificate-recognition">
              for successfully completing the learning requirements
              for the following course:
            </p>

            <h3 className="certificate-course-title">
              {certificate.course_title}
            </h3>

            <div className="certificate-course-label">
              COURSE COMPLETION
            </div>

            <p className="certificate-achievement">
              Awarded in recognition of demonstrated learning,
              professional development, and commitment to practical skills.
            </p>
          </section>

          <aside className="certificate-right-panel">
            {!revoked ? (
              <>
                <div className="certificate-qr-frame">
                  <img
                    className="certificate-qr"
                    src={qrUrl}
                    alt="QR code for certificate verification"
                  />
                </div>

                <p className="certificate-verify-heading">
                  VERIFY CREDENTIAL
                </p>

                <p className="certificate-verify-copy">
                  Scan the code to access the official verification record.
                </p>
              </>
            ) : (
              <>
                <div className="certificate-qr-frame">
                  <span
                    style={{
                      color: "#a51d2d",
                      fontWeight: 900,
                      fontSize: 12,
                    }}
                  >
                    REVOKED
                  </span>
                </div>

                <p className="certificate-verify-heading">
                  INVALID CREDENTIAL
                </p>

                <p className="certificate-verify-copy">
                  This certificate has been revoked.
                </p>
              </>
            )}

            <div className="certificate-number-label">
              CERTIFICATE NUMBER
            </div>

            <p className="certificate-number">
              {certificate.certificate_number}
            </p>

            <div className="certificate-record-divider" />

            <p className="certificate-record-heading">
              CERTIFICATE RECORD
            </p>

            <div className="certificate-record-row">
              <span className="certificate-record-icon">D</span>
              <div className="certificate-record-copy">
                <strong>Date issued</strong>
                {issuedDate}
              </div>
            </div>

            <div className="certificate-record-row">
              <span className="certificate-record-icon">A</span>
              <div className="certificate-record-copy">
                <strong>Assessment score</strong>
                {formatScore(certificate.assessment_score)}
              </div>
            </div>

            <div className="certificate-record-row">
              <span className="certificate-record-icon">C</span>
              <div className="certificate-record-copy">
                <strong>Capstone score</strong>
                {formatScore(certificate.capstone_score)}
              </div>
            </div>
          </aside>

          <footer className="certificate-footer">
            <div className="certificate-signature">
              {!revoked && (
                <img
                  className="certificate-signature-image"
                  src="/brand/founder-signature.png"
                  alt="Authorised signature"
                />
              )}

              <div className="certificate-signature-line" />

              <p className="certificate-signature-name">
                RUFFNECK LEARN
              </p>

              <p className="certificate-signature-role">
                LEARNING & PROFESSIONAL DEVELOPMENT
              </p>
            </div>

            <div className="certificate-official-seals">
              {!revoked && (
                <>
                  <img
                    className="certificate-official-seal"
                    src="/brand/ruffneck-certificate-seal.png"
                    alt="Certificate seal"
                  />

                  <img
                    className="certificate-official-seal"
                    src="/brand/ruffneck-company-stamp.png"
                    alt="Company stamp"
                  />

                  <img
                    className="certificate-official-seal"
                    src="/brand/ruffneck-security-stamp.png"
                    alt="Security stamp"
                  />
                </>
              )}
            </div>

            <div className="certificate-signature">
              <div className="certificate-signature-space" />

              <div className="certificate-signature-line" />

              <p className="certificate-signature-name">
                AUTHORISED CERTIFICATION
              </p>

              <p className="certificate-signature-role">
                RUFFNECK LEARN · {issuedDate}
              </p>
            </div>
          </footer>
        </div>

        {revoked && (
          <>
            <div className="certificate-revoked-overlay">
              REVOKED
            </div>

            {certificate.revoked_reason && (
              <div className="certificate-revoked-reason">
                Reason: {certificate.revoked_reason}
              </div>
            )}
          </>
        )}
      </article>

      {revoked && (
        <div className="certificate-revoked-notice">
          <strong>This certificate has been revoked.</strong>{" "}
          It must not be presented as a valid credential.
          {certificate.revoked_reason
            ? ` Reason: ${certificate.revoked_reason}`
            : ""}
        </div>
      )}

      {!revoked && (
        <div className="certificate-verification-component">
          <CertificateVerificationLink
            certificateNumber={certificate.certificate_number}
          />
        </div>
      )}

      <div className="certificate-after-paper">
        <p>
          Keep your certificate number for future verification.
          Certificate authenticity can be checked through RuffNeck Learn.
        </p>

        <p>
          <Link href="/student/certificates">
            All Certificates
          </Link>
          {" · "}
          <Link href="/courses">
            Browse Courses
          </Link>
        </p>
      </div>
    </main>
  );
}