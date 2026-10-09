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

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function verificationPath(certificateNumber: string) {
  return `/verify/certificate-number/${encodeURIComponent(
    certificateNumber
  )}`;
}

function qrCodeUrl(certificateNumber: string) {
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://ruffneck-lms.vercel.app"
  ).replace(/\/$/, "");

  const target = `${siteUrl}${verificationPath(certificateNumber)}`;

  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&format=png&margin=5&data=${encodeURIComponent(
    target
  )}`;
}

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ certificateId: string }>;
}) {
  const { certificateId } = await params;

  if (!certificateId?.trim()) notFound();

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?next=/student/certificates/${encodeURIComponent(
        certificateId
      )}`
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
    console.error("Certificate lookup failed:", error);
    throw new Error("Unable to load certificate.");
  }

  if (!data) notFound();

  const certificate = data as Certificate;
  const isRevoked = Boolean(certificate.is_revoked);

  return (
    <main className="modern-cert-page">
      <style>{`
        .modern-cert-page {
          --mc-navy: #102641;
          --mc-ink: #172b42;
          --mc-gold: #b78b3d;
          --mc-muted: #677586;
          padding: 28px 18px 44px;
          color: var(--mc-ink);
        }

        .modern-cert-page *,
        .modern-cert-page *::before,
        .modern-cert-page *::after {
          box-sizing: border-box;
        }

        .modern-cert-page .mc-shell {
          width: 100%;
          max-width: 1220px;
          margin: 0 auto;
        }

        .modern-cert-page .mc-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 20px;
        }

        .modern-cert-page .mc-back {
          color: var(--mc-ink);
          font-size: 14px;
          font-weight: 700;
          text-decoration: none;
        }

        .modern-cert-page .mc-back:hover {
          color: var(--mc-gold);
        }

        .modern-cert-page .mc-toolbar-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .modern-cert-page .mc-paper {
          position: relative;
          isolation: isolate;
          width: 100%;
          aspect-ratio: 297 / 210;
          overflow: hidden;
          background: #f9f7f0;
          color: var(--mc-ink);
          border: 1px solid #c9ac6c;
          box-shadow: 0 24px 70px rgba(16, 38, 65, 0.15);
        }

        .modern-cert-page .mc-border {
          position: absolute;
          z-index: -3;
          inset: 0;
          display: block;
          width: 100%;
          height: 100%;
          object-fit: fill;
          pointer-events: none;
        }

        .modern-cert-page .mc-paper-wash {
          position: absolute;
          z-index: -2;
          inset: 2.5%;
          background: rgba(250, 248, 241, 0.48);
          pointer-events: none;
        }

        .modern-cert-page .mc-watermark {
          position: absolute;
          z-index: -1;
          right: 7%;
          top: 26%;
          width: 27%;
          max-height: 44%;
          object-fit: contain;
          opacity: 0.045;
          pointer-events: none;
        }

        .modern-cert-page .mc-content {
          position: absolute;
          inset: 5.5% 7%;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr) auto;
          min-width: 0;
          min-height: 0;
        }

        /* Brand header */

        .modern-cert-page .mc-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding-bottom: 2.1%;
          border-bottom: 1px solid rgba(183, 139, 61, 0.72);
        }

        .modern-cert-page .mc-brand {
          display: flex;
          align-items: center;
          gap: 18px;
          min-width: 0;
        }

        .modern-cert-page .mc-logo {
          display: block;
          width: clamp(135px, 18%, 220px);
          height: auto;
          max-height: 70px;
          object-fit: contain;
          flex: 0 1 auto;
        }

        .modern-cert-page .mc-brand-copy {
          min-width: 0;
        }

        .modern-cert-page .mc-brand-name {
          margin: 0;
          color: var(--mc-navy);
          font-size: clamp(15px, 1.55vw, 22px);
          font-weight: 850;
          letter-spacing: 0.13em;
          line-height: 1.15;
        }

        .modern-cert-page .mc-tagline {
          margin-top: 6px;
          color: #77613a;
          font-size: clamp(7px, 0.68vw, 10px);
          font-weight: 750;
          letter-spacing: 0.08em;
          line-height: 1.4;
          text-transform: uppercase;
        }

        .modern-cert-page .mc-header-label {
          flex: 0 0 auto;
          padding-left: 18px;
          border-left: 2px solid var(--mc-gold);
          text-align: right;
        }

        .modern-cert-page .mc-header-label strong {
          display: block;
          color: var(--mc-navy);
          font-size: clamp(8px, 0.75vw, 11px);
          letter-spacing: 0.14em;
          line-height: 1.4;
          text-transform: uppercase;
        }

        .modern-cert-page .mc-header-label span {
          display: block;
          margin-top: 4px;
          color: var(--mc-muted);
          font-size: clamp(8px, 0.68vw, 10px);
        }

        /* Main certificate content */

        .modern-cert-page .mc-main {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 23%;
          align-items: center;
          gap: 4%;
          min-height: 0;
          padding: 2.2% 0;
        }

        .modern-cert-page .mc-copy {
          min-width: 0;
        }

        .modern-cert-page .mc-eyebrow {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 0 0 9px;
          color: #8a672d;
          font-size: clamp(8px, 0.75vw, 11px);
          font-weight: 850;
          letter-spacing: 0.22em;
          line-height: 1.35;
          text-transform: uppercase;
        }

        .modern-cert-page .mc-eyebrow::before {
          display: block;
          width: 25px;
          height: 2px;
          background: var(--mc-gold);
          content: "";
          flex: 0 0 auto;
        }

        .modern-cert-page .mc-title {
          margin: 0;
          color: var(--mc-navy);
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(27px, 3.2vw, 46px);
          font-weight: 500;
          letter-spacing: -0.035em;
          line-height: 1.05;
          text-wrap: balance;
        }

        .modern-cert-page .mc-presented {
          margin: 2.4% 0 0.6%;
          color: var(--mc-muted);
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(10px, 0.95vw, 14px);
          font-style: italic;
        }

        .modern-cert-page .mc-recipient {
          margin: 0;
          color: #173656;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(27px, 3.55vw, 52px);
          font-weight: 700;
          letter-spacing: -0.025em;
          line-height: 1.1;
          overflow-wrap: anywhere;
          text-wrap: balance;
        }

        .modern-cert-page .mc-recipient-underline {
          width: 44%;
          height: 2px;
          margin-top: 1.4%;
          background: linear-gradient(
            90deg,
            var(--mc-gold),
            rgba(183, 139, 61, 0.08)
          );
        }

        .modern-cert-page .mc-completion {
          margin: 1.5% 0 0.5%;
          color: #596779;
          font-size: clamp(9px, 0.83vw, 12px);
          line-height: 1.4;
        }

        .modern-cert-page .mc-course {
          margin: 0;
          color: var(--mc-navy);
          font-size: clamp(14px, 1.55vw, 23px);
          font-weight: 800;
          line-height: 1.22;
          overflow-wrap: anywhere;
          text-wrap: balance;
        }

        .modern-cert-page .mc-revoked {
          display: inline-block;
          margin-top: 10px;
          padding: 6px 12px;
          border: 1px solid #b91c1c;
          color: #991b1b;
          background: rgba(255, 255, 255, 0.92);
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.18em;
        }

        /* Credential summary */

        .modern-cert-page .mc-side {
          align-self: stretch;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 15px;
          min-width: 0;
          padding: 5% 0 5% 12%;
          border-left: 1px solid rgba(183, 139, 61, 0.62);
        }

        .modern-cert-page .mc-side-heading {
          margin: 0 0 3px;
          color: #8a672d;
          font-size: clamp(8px, 0.68vw, 10px);
          font-weight: 850;
          letter-spacing: 0.17em;
          line-height: 1.4;
          text-transform: uppercase;
        }

        .modern-cert-page .mc-fact {
          min-width: 0;
        }

        .modern-cert-page .mc-fact-label {
          display: block;
          margin-bottom: 5px;
          color: var(--mc-muted);
          font-size: clamp(8px, 0.68vw, 10px);
          font-weight: 650;
          line-height: 1.25;
        }

        .modern-cert-page .mc-fact-value {
          display: block;
          color: var(--mc-navy);
          font-size: clamp(11px, 1vw, 14px);
          font-weight: 850;
          line-height: 1.3;
          overflow-wrap: anywhere;
        }

        .modern-cert-page .mc-side-rule {
          width: 34px;
          height: 2px;
          background: var(--mc-gold);
        }

        /* Authentication footer */

        .modern-cert-page .mc-footer {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
          align-items: center;
          gap: 18px;
          min-width: 0;
          padding-top: 1.7%;
          border-top: 1px solid rgba(183, 139, 61, 0.72);
        }

        .modern-cert-page .mc-signatory {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
          min-width: 0;
        }

        .modern-cert-page .mc-signature {
          display: block;
          width: auto;
          max-width: 145px;
          height: 34px;
          object-fit: contain;
          object-position: left bottom;
        }

        .modern-cert-page .mc-signature-line {
          width: 100%;
          max-width: 180px;
          margin: 3px 0 5px;
          border-top: 1px solid #9b8458;
        }

        .modern-cert-page .mc-signatory-name {
          color: var(--mc-navy);
          font-size: clamp(9px, 0.82vw, 12px);
          font-weight: 850;
          line-height: 1.3;
        }

        .modern-cert-page .mc-signatory-role {
          margin-top: 3px;
          color: var(--mc-muted);
          font-size: clamp(7px, 0.62vw, 9px);
          line-height: 1.35;
        }

        .modern-cert-page .mc-seals {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
        }

        .modern-cert-page .mc-seal {
          display: block;
          width: clamp(43px, 5.1vw, 70px);
          height: clamp(43px, 5.1vw, 70px);
          object-fit: contain;
        }

        .modern-cert-page .mc-stamp {
          display: block;
          width: clamp(39px, 4.5vw, 61px);
          height: clamp(39px, 4.5vw, 61px);
          object-fit: contain;
        }

        .modern-cert-page .mc-verification {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          min-width: 0;
        }

        .modern-cert-page .mc-qr {
          display: block;
          flex: 0 0 auto;
          width: clamp(54px, 5.5vw, 76px);
          height: clamp(54px, 5.5vw, 76px);
          padding: 3px;
          border: 1px solid #c9ac6c;
          background: white;
          object-fit: contain;
        }

        .modern-cert-page .mc-verify-copy {
          min-width: 0;
        }

        .modern-cert-page .mc-verify-title {
          display: block;
          margin-bottom: 5px;
          color: var(--mc-navy);
          font-size: clamp(8px, 0.72vw, 10px);
          font-weight: 900;
          letter-spacing: 0.09em;
          line-height: 1.3;
        }

        .modern-cert-page .mc-verify-copy p {
          margin: 0;
          color: var(--mc-muted);
          font-size: clamp(7px, 0.62vw, 9px);
          line-height: 1.4;
          overflow-wrap: anywhere;
        }

        .modern-cert-page .mc-cert-number {
          margin-top: 6px;
          color: #72572c;
          font-size: clamp(7px, 0.62vw, 9px);
          font-weight: 850;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }

        .modern-cert-page .mc-revoked-note {
          margin: 12px 0 0;
          padding: 12px 14px;
          border: 1px solid #fecaca;
          background: #fff1f2;
          color: #991b1b;
          font-size: 13px;
        }

        .modern-cert-page .mc-bottom-actions {
          display: flex;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 20px;
        }

        /* Responsive on-screen view */

        @media (max-width: 760px) {
          .modern-cert-page {
            padding: 18px 10px 32px;
          }

          .modern-cert-page .mc-paper {
            aspect-ratio: auto;
            min-height: 0;
          }

          .modern-cert-page .mc-content {
            position: relative;
            inset: auto;
            display: flex;
            flex-direction: column;
            gap: 24px;
            padding: 30px 7%;
          }

          .modern-cert-page .mc-header {
            flex-direction: column;
            align-items: center;
            gap: 15px;
            padding-bottom: 18px;
          }

          .modern-cert-page .mc-brand {
            flex-direction: column;
            gap: 10px;
          }

          .modern-cert-page .mc-logo {
            width: 190px;
            max-height: 75px;
          }

          .modern-cert-page .mc-brand-copy {
            text-align: center;
          }

          .modern-cert-page .mc-brand-name {
            font-size: 19px;
          }

          .modern-cert-page .mc-tagline {
            font-size: 9px;
          }

          .modern-cert-page .mc-header-label {
            padding: 0;
            border: 0;
            text-align: center;
          }

          .modern-cert-page .mc-header-label strong {
            font-size: 10px;
          }

          .modern-cert-page .mc-header-label span {
            font-size: 10px;
          }

          .modern-cert-page .mc-main {
            display: flex;
            flex-direction: column;
            align-items: stretch;
            gap: 24px;
            padding: 0;
          }

          .modern-cert-page .mc-eyebrow {
            font-size: 9px;
          }

          .modern-cert-page .mc-title {
            font-size: clamp(28px, 8vw, 40px);
          }

          .modern-cert-page .mc-presented {
            margin-top: 18px;
            font-size: 12px;
          }

          .modern-cert-page .mc-recipient {
            font-size: clamp(28px, 8vw, 42px);
          }

          .modern-cert-page .mc-completion {
            margin-top: 15px;
            font-size: 11px;
          }

          .modern-cert-page .mc-course {
            font-size: clamp(17px, 5vw, 25px);
          }

          .modern-cert-page .mc-side {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 18px 12px;
            padding: 20px 0;
            border-top: 1px solid rgba(183, 139, 61, 0.62);
            border-bottom: 1px solid rgba(183, 139, 61, 0.62);
            border-left: 0;
          }

          .modern-cert-page .mc-side-heading {
            grid-column: 1 / -1;
            font-size: 10px;
          }

          .modern-cert-page .mc-fact-label {
            font-size: 10px;
          }

          .modern-cert-page .mc-fact-value {
            font-size: 13px;
          }

          .modern-cert-page .mc-footer {
            grid-template-columns: 1fr;
            gap: 22px;
            padding-top: 22px;
          }

          .modern-cert-page .mc-signatory {
            align-items: center;
            text-align: center;
          }

          .modern-cert-page .mc-signature-line {
            margin-left: auto;
            margin-right: auto;
          }

          .modern-cert-page .mc-seals {
            order: 2;
          }

          .modern-cert-page .mc-verification {
            justify-content: center;
          }

          .modern-cert-page .mc-qr {
            width: 76px;
            height: 76px;
          }

          .modern-cert-page .mc-verify-title {
            font-size: 10px;
          }

          .modern-cert-page .mc-verify-copy p,
          .modern-cert-page .mc-cert-number {
            font-size: 9px;
          }
        }

        /* One-page A4 landscape printing */

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
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body * {
            visibility: hidden !important;
          }

          .modern-cert-page,
          .modern-cert-page * {
            visibility: visible !important;
          }

          .modern-cert-page {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 297mm !important;
            height: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            background: white !important;
          }

          .modern-cert-page .mc-shell {
            width: 297mm !important;
            max-width: none !important;
            height: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .modern-cert-page .mc-toolbar,
          .modern-cert-page .mc-bottom-actions,
          .modern-cert-page .no-print {
            display: none !important;
          }

          .modern-cert-page .mc-paper {
            position: relative !important;
            width: 297mm !important;
            height: 210mm !important;
            min-height: 0 !important;
            max-height: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            aspect-ratio: auto !important;
            overflow: hidden !important;
            border: 0 !important;
            box-shadow: none !important;
            page-break-before: avoid !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
            break-before: avoid-page !important;
            break-after: avoid-page !important;
            break-inside: avoid-page !important;
          }

          .modern-cert-page .mc-border {
            position: absolute !important;
            inset: 0 !important;
            width: 297mm !important;
            height: 210mm !important;
            object-fit: fill !important;
          }

          .modern-cert-page .mc-paper-wash {
            position: absolute !important;
            inset: 2.5% !important;
            background: rgba(250, 248, 241, 0.48) !important;
          }

          .modern-cert-page .mc-watermark {
            position: absolute !important;
            right: 7% !important;
            top: 26% !important;
            width: 27% !important;
            max-height: 44% !important;
            opacity: 0.045 !important;
          }

          .modern-cert-page .mc-content {
            position: absolute !important;
            inset: 11mm 20mm !important;
            display: grid !important;
            grid-template-rows: auto minmax(0, 1fr) auto !important;
            width: auto !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            padding: 0 !important;
            gap: 0 !important;
            overflow: visible !important;
          }

          .modern-cert-page .mc-header {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 5mm !important;
            padding-bottom: 2.5mm !important;
          }

          .modern-cert-page .mc-brand {
            flex-direction: row !important;
            gap: 5mm !important;
          }

          .modern-cert-page .mc-logo {
            width: 44mm !important;
            max-width: 44mm !important;
            height: 16mm !important;
            max-height: 16mm !important;
            object-fit: contain !important;
          }

          .modern-cert-page .mc-brand-name {
            font-size: 15pt !important;
            line-height: 1.1 !important;
          }

          .modern-cert-page .mc-tagline {
            margin-top: 1.5mm !important;
            font-size: 6.5pt !important;
            line-height: 1.2 !important;
          }

          .modern-cert-page .mc-header-label {
            padding-left: 4mm !important;
            border-left: 0.5mm solid var(--mc-gold) !important;
            text-align: right !important;
          }

          .modern-cert-page .mc-header-label strong {
            font-size: 7pt !important;
          }

          .modern-cert-page .mc-header-label span {
            margin-top: 1mm !important;
            font-size: 7pt !important;
          }

          .modern-cert-page .mc-main {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) 52mm !important;
            align-items: center !important;
            gap: 8mm !important;
            min-height: 0 !important;
            padding: 3mm 0 !important;
            overflow: visible !important;
          }

          .modern-cert-page .mc-eyebrow {
            gap: 2mm !important;
            margin: 0 0 2mm !important;
            font-size: 7pt !important;
            letter-spacing: 0.2em !important;
            line-height: 1.15 !important;
          }

          .modern-cert-page .mc-eyebrow::before {
            width: 6mm !important;
            height: 0.5mm !important;
          }

          .modern-cert-page .mc-title {
            margin: 0 !important;
            font-size: 27pt !important;
            line-height: 1.06 !important;
          }

          .modern-cert-page .mc-presented {
            margin: 3mm 0 1mm !important;
            font-size: 9pt !important;
            line-height: 1.15 !important;
          }

          .modern-cert-page .mc-recipient {
            margin: 0 !important;
            font-size: 33pt !important;
            line-height: 1.08 !important;
          }

          .modern-cert-page .mc-recipient-underline {
            width: 65mm !important;
            height: 0.5mm !important;
            margin-top: 2mm !important;
          }

          .modern-cert-page .mc-completion {
            margin: 2mm 0 1mm !important;
            font-size: 8pt !important;
            line-height: 1.15 !important;
          }

          .modern-cert-page .mc-course {
            margin: 0 !important;
            font-size: 15pt !important;
            line-height: 1.15 !important;
          }

          .modern-cert-page .mc-revoked {
            margin-top: 2mm !important;
            padding: 1mm 3mm !important;
            font-size: 7pt !important;
          }

          .modern-cert-page .mc-side {
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            gap: 3mm !important;
            min-width: 0 !important;
            padding: 3mm 0 3mm 5mm !important;
            border-top: 0 !important;
            border-right: 0 !important;
            border-bottom: 0 !important;
            border-left: 0.3mm solid rgba(183, 139, 61, 0.72) !important;
          }

          .modern-cert-page .mc-side-heading {
            margin: 0 0 0.5mm !important;
            font-size: 6.5pt !important;
            line-height: 1.2 !important;
          }

          .modern-cert-page .mc-fact-label {
            margin-bottom: 0.8mm !important;
            font-size: 7pt !important;
            line-height: 1.15 !important;
          }

          .modern-cert-page .mc-fact-value {
            font-size: 9pt !important;
            line-height: 1.2 !important;
          }

          .modern-cert-page .mc-side-rule {
            width: 8mm !important;
            height: 0.5mm !important;
          }

          .modern-cert-page .mc-footer {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) !important;
            align-items: center !important;
            gap: 4mm !important;
            min-height: 0 !important;
            padding-top: 2.5mm !important;
          }

          .modern-cert-page .mc-signatory {
            display: flex !important;
            align-items: flex-start !important;
            text-align: left !important;
          }

          .modern-cert-page .mc-signature {
            width: auto !important;
            max-width: 36mm !important;
            height: 8mm !important;
            object-fit: contain !important;
            object-position: left bottom !important;
          }

          .modern-cert-page .mc-signature-line {
            width: 48mm !important;
            max-width: 48mm !important;
            margin: 0.8mm 0 1mm !important;
            border-top: 0.3mm solid #9b8458 !important;
          }

          .modern-cert-page .mc-signatory-name {
            font-size: 8pt !important;
            line-height: 1.15 !important;
          }

          .modern-cert-page .mc-signatory-role {
            margin-top: 0.5mm !important;
            font-size: 6.5pt !important;
            line-height: 1.2 !important;
          }

          .modern-cert-page .mc-seals {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 2mm !important;
          }

          .modern-cert-page .mc-seal {
            width: 17mm !important;
            height: 17mm !important;
          }

          .modern-cert-page .mc-stamp {
            width: 15mm !important;
            height: 15mm !important;
          }

          .modern-cert-page .mc-verification {
            display: flex !important;
            align-items: center !important;
            justify-content: flex-end !important;
            gap: 2mm !important;
            min-width: 0 !important;
          }

          .modern-cert-page .mc-qr {
            width: 17mm !important;
            height: 17mm !important;
            padding: 0.6mm !important;
          }

          .modern-cert-page .mc-verify-title {
            margin-bottom: 0.8mm !important;
            font-size: 6.5pt !important;
            line-height: 1.15 !important;
          }

          .modern-cert-page .mc-verify-copy p {
            font-size: 6pt !important;
            line-height: 1.2 !important;
          }

          .modern-cert-page .mc-cert-number {
            margin-top: 1mm !important;
            font-size: 5.5pt !important;
            line-height: 1.15 !important;
          }

          .modern-cert-page .mc-revoked-note {
            margin-top: 2mm !important;
            padding: 2mm !important;
            font-size: 8pt !important;
          }

          .modern-cert-page img {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <div className="mc-shell">
        <nav className="mc-toolbar no-print">
          <Link href="/student/certificates" className="mc-back">
            ← My Certificates
          </Link>

          <div className="mc-toolbar-actions">
            <Link
              href={verificationPath(certificate.certificate_number)}
              className="rn-button rn-button-secondary"
            >
              Verify Certificate
            </Link>

            {!isRevoked && <CertificatePrintButton />}
          </div>
        </nav>

        <article
          className="mc-paper"
          aria-label="RuffNeck Learn certificate of completion"
        >
          <img
            src="/brand/ruffneck-border-background.png"
            alt=""
            aria-hidden="true"
            className="mc-border"
          />

          <div className="mc-paper-wash" aria-hidden="true" />

          <img
            src="/brand/transparent-ruffneck-background.png"
            alt=""
            aria-hidden="true"
            className="mc-watermark"
          />

          <div className="mc-content">
            <header className="mc-header">
              <div className="mc-brand">
                <img
                  src="/brand/ruffneck-logo.png"
                  alt="RuffNeck Entertainment"
                  className="mc-logo"
                />

                <div className="mc-brand-copy">
                  <p className="mc-brand-name">RUFFNECK LEARN</p>
                  <div className="mc-tagline">
                    AI • Digital Transformation • Business Solutions
                  </div>
                </div>
              </div>

              <div className="mc-header-label">
                <strong>Professional Credential</strong>
                <span>Certificate of Achievement</span>
              </div>
            </header>

            <section className="mc-main">
              <div className="mc-copy">
                <p className="mc-eyebrow">
                  Learning achievement
                </p>

                <h1 className="mc-title">
                  Certificate
                  <br />
                  of Completion
                </h1>

                {isRevoked && (
                  <div className="mc-revoked" role="alert">
                    REVOKED
                  </div>
                )}

                <p className="mc-presented">
                  This certificate is awarded to
                </p>

                <h2 className="mc-recipient">
                  {certificate.holder_name}
                </h2>

                <div
                  className="mc-recipient-underline"
                  aria-hidden="true"
                />

                <p className="mc-completion">
                  In recognition of successfully completing
                </p>

                <h3 className="mc-course">
                  {certificate.course_title}
                </h3>
              </div>

              <aside className="mc-side">
                <p className="mc-side-heading">
                  Credential record
                </p>

                <div className="mc-fact">
                  <span className="mc-fact-label">
                    Date issued
                  </span>
                  <strong className="mc-fact-value">
                    {formatDate(certificate.issued_at)}
                  </strong>
                </div>

                <div className="mc-side-rule" aria-hidden="true" />

                <div className="mc-fact">
                  <span className="mc-fact-label">
                    Assessment score
                  </span>
                  <strong className="mc-fact-value">
                    {certificate.assessment_score == null
                      ? "—"
                      : `${certificate.assessment_score}%`}
                  </strong>
                </div>

                <div className="mc-fact">
                  <span className="mc-fact-label">
                    Capstone score
                  </span>
                  <strong className="mc-fact-value">
                    {certificate.capstone_score == null
                      ? "—"
                      : `${certificate.capstone_score}/100`}
                  </strong>
                </div>
              </aside>
            </section>

            {!isRevoked ? (
              <footer className="mc-footer">
                <div className="mc-signatory">
                  <img
                    src="/brand/founder-signature.png"
                    alt="Hassan Zakariya signature"
                    className="mc-signature"
                  />

                  <div
                    className="mc-signature-line"
                    aria-hidden="true"
                  />

                  <strong className="mc-signatory-name">
                    Hassan Zakariya
                  </strong>

                  <span className="mc-signatory-role">
                    Founder &amp; CEO · RuffNeck Entertainment
                  </span>
                </div>

                <div className="mc-seals">
                  <img
                    src="/brand/ruffneck-certificate-seal.png"
                    alt="Certificate seal"
                    className="mc-seal"
                  />

                  <img
                    src="/brand/ruffneck-company-stamp.png"
                    alt="Company stamp"
                    className="mc-stamp"
                  />

                  <img
                    src="/brand/ruffneck-security-stamp.png"
                    alt="Security stamp"
                    className="mc-stamp"
                  />
                </div>

                <div className="mc-verification">
                  <img
                    src={qrCodeUrl(certificate.certificate_number)}
                    alt={`QR code for certificate ${certificate.certificate_number}`}
                    width={180}
                    height={180}
                    className="mc-qr"
                  />

                  <div className="mc-verify-copy">
                    <strong className="mc-verify-title">
                      VERIFY CREDENTIAL
                    </strong>

                    <p>
                      Scan to check the
                      <br />
                      official certificate record.
                    </p>

                    <div className="mc-cert-number">
                      No. {certificate.certificate_number}
                    </div>
                  </div>
                </div>
              </footer>
            ) : (
              <div className="mc-revoked-note" role="alert">
                {certificate.revoked_reason ||
                  "This certificate has been revoked and is no longer valid."}
              </div>
            )}
          </div>
        </article>

        {!isRevoked && (
          <div className="no-print" style={{ marginTop: 18 }}>
            <CertificateVerificationLink
              certificateNumber={certificate.certificate_number}
            />
          </div>
        )}

        <div className="mc-bottom-actions no-print">
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