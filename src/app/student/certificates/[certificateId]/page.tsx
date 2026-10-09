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
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&format=png&margin=8&data=${encodeURIComponent(
    verificationUrl
  )}`;
}

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ certificateId: string }>;
}) {
  const { certificateId } = await params;

  if (!certificateId?.trim()) {
    notFound();
  }

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
    console.error("Certificate lookup failed:", error);
    throw new Error("Unable to load certificate.");
  }

  const certificate = data as Certificate | null;

  if (!certificate) {
    notFound();
  }

  const verificationPath = `/verify/certificate-number/${encodeURIComponent(
    certificate.certificate_number
  )}`;

  const verificationUrl = buildVerificationUrl(
    certificate.certificate_number
  );

  const qrCodeUrl = buildQrCodeUrl(verificationUrl);

  return (
    <main className="rn-modern-cert-page">
      <style>{`
        .rn-modern-cert-page {
          --rn-navy: #0b1e3a;
          --rn-navy-light: #18365d;
          --rn-gold: #c7a052;
          --rn-gold-light: #e6cf95;
          --rn-ink: #26354a;
          --rn-muted: #68778c;
          min-height: 100vh;
          padding: 28px 20px 48px;
          background: #edf1f6;
          color: var(--rn-ink);
          font-family: Arial, Helvetica, sans-serif;
        }

        .rn-modern-cert-page *,
        .rn-modern-cert-page *::before,
        .rn-modern-cert-page *::after {
          box-sizing: border-box;
        }

        .rn-modern-cert-container {
          width: 100%;
          max-width: 1250px;
          margin: 0 auto;
        }

        .rn-modern-cert-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 14px;
          margin-bottom: 22px;
        }

        .rn-modern-cert-back {
          color: var(--rn-navy);
          font-size: 14px;
          font-weight: 700;
          text-decoration: none;
        }

        .rn-modern-cert-back:hover {
          text-decoration: underline;
        }

        .rn-modern-cert-toolbar-actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 10px;
        }

        .rn-modern-cert-button {
          display: inline-flex;
          min-height: 43px;
          align-items: center;
          justify-content: center;
          padding: 11px 17px;
          border: 1px solid #d4dce7;
          border-radius: 8px;
          background: #fff;
          color: var(--rn-navy);
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
          cursor: pointer;
          transition: background 150ms ease, transform 150ms ease;
        }

        .rn-modern-cert-button:hover {
          background: #f5f7fa;
          transform: translateY(-1px);
        }

        .rn-modern-cert-button-primary {
          border-color: var(--rn-navy);
          background: var(--rn-navy);
          color: #fff;
        }

        .rn-modern-cert-button-primary:hover {
          background: var(--rn-navy-light);
        }

        .rn-modern-cert-sheet {
          position: relative;
          isolation: isolate;
          display: flex;
          flex-direction: column;
          width: 100%;
          aspect-ratio: 297 / 210;
          min-width: 0;
          padding: 3.8% 5.2% 3.2%;
          overflow: hidden;
          background: #fff;
          color: var(--rn-ink);
          box-shadow: 0 22px 65px rgba(11, 30, 58, 0.15);
        }

        .rn-modern-cert-border-art {
          position: absolute;
          z-index: -2;
          inset: 0;
          display: block;
          width: 100%;
          height: 100%;
          object-fit: fill;
          pointer-events: none;
        }

        .rn-modern-cert-tint {
          position: absolute;
          z-index: -1;
          inset: 4.5%;
          background:
            radial-gradient(
              ellipse at 50% 48%,
              rgba(255, 255, 255, 0.96) 0%,
              rgba(255, 255, 255, 0.93) 58%,
              rgba(255, 255, 255, 0.78) 100%
            );
          pointer-events: none;
        }

        .rn-modern-cert-topline {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 0.5%;
          color: var(--rn-gold);
          font-size: clamp(7px, 0.72vw, 10px);
          font-weight: 800;
          letter-spacing: 0.3em;
          text-align: center;
          text-transform: uppercase;
        }

        .rn-modern-cert-topline::before,
        .rn-modern-cert-topline::after {
          content: "";
          display: block;
          width: 9%;
          height: 1px;
          background: var(--rn-gold);
        }

        .rn-modern-cert-brand {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          text-align: center;
        }

        .rn-modern-cert-logo {
          display: block;
          width: auto;
          height: clamp(46px, 7.2vw, 88px);
          max-width: 38%;
          object-fit: contain;
          object-position: center;
          margin: 0 auto 0.45%;
        }

        .rn-modern-cert-brand-name {
          margin: 0;
          color: var(--rn-navy);
          font-size: clamp(10px, 1.15vw, 15px);
          font-weight: 900;
          letter-spacing: 0.24em;
        }

        .rn-modern-cert-tagline {
          margin-top: 4px;
          color: #65738a;
          font-size: clamp(6px, 0.62vw, 8px);
          font-weight: 600;
          letter-spacing: 0.13em;
          text-transform: uppercase;
        }

        .rn-modern-cert-gold-rule {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          width: 24%;
          margin: 0.7% auto 0;
        }

        .rn-modern-cert-gold-rule span {
          display: block;
          flex: 1;
          height: 1px;
          background: var(--rn-gold);
        }

        .rn-modern-cert-gold-rule span:nth-child(2) {
          flex: 0 0 8px;
          height: 8px;
          transform: rotate(45deg);
          background: var(--rn-gold);
        }

        .rn-modern-cert-content {
          flex: 1 1 auto;
          min-height: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          padding: 0.7% 3% 0.5%;
          text-align: center;
        }

        .rn-modern-cert-kicker {
          margin: 0 0 0.6%;
          color: #a47b2c;
          font-size: clamp(7px, 0.78vw, 10px);
          font-weight: 800;
          letter-spacing: 0.28em;
          text-transform: uppercase;
        }

        .rn-modern-cert-title {
          margin: 0;
          color: var(--rn-navy);
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(24px, 3.25vw, 43px);
          font-weight: 500;
          letter-spacing: -0.025em;
          line-height: 1.06;
        }

        .rn-modern-cert-presented {
          margin: 1.15% 0 0.35%;
          color: var(--rn-muted);
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(9px, 0.92vw, 12px);
          font-style: italic;
        }

        .rn-modern-cert-holder {
          max-width: 100%;
          margin: 0;
          color: var(--rn-navy);
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(27px, 3.7vw, 49px);
          font-weight: 700;
          line-height: 1.08;
          overflow-wrap: anywhere;
        }

        .rn-modern-cert-holder-rule {
          width: 36%;
          height: 2px;
          margin: 0.85% auto;
          background: linear-gradient(
            90deg,
            transparent,
            var(--rn-gold),
            transparent
          );
        }

        .rn-modern-cert-completion {
          margin: 0;
          color: var(--rn-muted);
          font-size: clamp(8px, 0.82vw, 11px);
        }

        .rn-modern-cert-course {
          max-width: 100%;
          margin: 0.45% 0 0;
          color: var(--rn-navy-light);
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(14px, 1.75vw, 23px);
          font-weight: 700;
          line-height: 1.18;
          overflow-wrap: anywhere;
        }

        .rn-modern-cert-revoked {
          flex: 0 0 auto;
          align-self: center;
          margin: 3px 0;
          padding: 4px 12px;
          border: 2px solid #b42318;
          color: #b42318;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.16em;
        }

        .rn-modern-cert-revoked-reason {
          flex: 0 0 auto;
          margin: 3px 0;
          color: #b42318;
          font-size: 9px;
          text-align: center;
          overflow-wrap: anywhere;
        }

        .rn-modern-cert-metrics {
          flex: 0 0 auto;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          margin: 0.4% 0 0;
          padding: 0.7% 0;
          border-top: 1px solid rgba(196, 160, 82, 0.8);
          border-bottom: 1px solid rgba(196, 160, 82, 0.8);
          background: rgba(255, 255, 255, 0.65);
        }

        .rn-modern-cert-metric {
          min-width: 0;
          padding: 0 8px;
          text-align: center;
          border-right: 1px solid rgba(11, 30, 58, 0.13);
        }

        .rn-modern-cert-metric:last-child {
          border-right: 0;
        }

        .rn-modern-cert-metric-label {
          display: block;
          margin-bottom: 4px;
          color: #68778c;
          font-size: clamp(6px, 0.63vw, 8px);
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .rn-modern-cert-metric-value {
          display: block;
          color: var(--rn-navy);
          font-size: clamp(8px, 0.82vw, 11px);
          font-weight: 800;
          line-height: 1.2;
          overflow-wrap: anywhere;
        }

        .rn-modern-cert-number {
          flex: 0 0 auto;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          gap: 7px;
          margin: 0.6% 0 0;
          color: #68778c;
          font-size: clamp(6px, 0.65vw, 9px);
          letter-spacing: 0.04em;
        }

        .rn-modern-cert-number strong {
          color: var(--rn-navy);
          font-size: inherit;
          letter-spacing: 0.09em;
          overflow-wrap: anywhere;
        }

        .rn-modern-cert-footer {
          flex: 0 0 auto;
          display: grid;
          grid-template-columns: 1fr 1.05fr 1fr;
          align-items: end;
          gap: 2.5%;
          min-height: 0;
          margin-top: 0.75%;
          padding-top: 0.7%;
          border-top: 1px solid rgba(196, 160, 82, 0.7);
        }

        .rn-modern-cert-signatory,
        .rn-modern-cert-institution,
        .rn-modern-cert-verification {
          min-width: 0;
          text-align: center;
        }

        .rn-modern-cert-signature {
          display: block;
          width: auto;
          height: clamp(25px, 3vw, 38px);
          max-width: 90%;
          object-fit: contain;
          object-position: center bottom;
          margin: 0 auto;
        }

        .rn-modern-cert-signature-line {
          width: 85%;
          height: 1px;
          margin: 2px auto 4px;
          background: #aeb6c2;
        }

        .rn-modern-cert-signatory strong,
        .rn-modern-cert-institution strong {
          display: block;
          color: var(--rn-navy);
          font-size: clamp(7px, 0.72vw, 10px);
          line-height: 1.2;
        }

        .rn-modern-cert-signatory > span,
        .rn-modern-cert-institution > span {
          display: block;
          margin-top: 3px;
          color: #68778c;
          font-size: clamp(6px, 0.59vw, 8px);
          line-height: 1.2;
          overflow-wrap: anywhere;
        }

        .rn-modern-cert-stamps {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          margin-bottom: 3px;
        }

        .rn-modern-cert-company-stamp {
          display: block;
          width: clamp(29px, 3.2vw, 42px);
          height: clamp(29px, 3.2vw, 42px);
          object-fit: contain;
        }

        .rn-modern-cert-seal {
          display: block;
          width: clamp(34px, 3.7vw, 48px);
          height: clamp(34px, 3.7vw, 48px);
          object-fit: contain;
        }

        .rn-modern-cert-security-stamp {
          display: block;
          width: clamp(27px, 3vw, 38px);
          height: clamp(27px, 3vw, 38px);
          object-fit: contain;
        }

        .rn-modern-cert-qr-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          text-align: left;
        }

        .rn-modern-cert-qr {
          display: block;
          flex: 0 0 auto;
          width: clamp(42px, 4.3vw, 56px);
          height: clamp(42px, 4.3vw, 56px);
          object-fit: contain;
          background: #fff;
        }

        .rn-modern-cert-qr-copy {
          min-width: 0;
        }

        .rn-modern-cert-qr-copy strong {
          display: block;
          color: var(--rn-navy);
          font-size: clamp(7px, 0.66vw, 9px);
          line-height: 1.2;
        }

        .rn-modern-cert-qr-copy span {
          display: block;
          margin-top: 4px;
          color: #68778c;
          font-size: clamp(6px, 0.55vw, 8px);
          line-height: 1.25;
          overflow-wrap: anywhere;
        }

        .rn-modern-cert-footer-meta {
          margin-top: 4px;
          color: #68778c;
          font-size: clamp(6px, 0.55vw, 8px);
          line-height: 1.35;
          overflow-wrap: anywhere;
        }

        .rn-modern-cert-footer-meta strong {
          color: var(--rn-navy);
        }

        .rn-modern-cert-secondary-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 20px;
        }

        .rn-modern-cert-page img {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        @media (max-width: 700px) {
          .rn-modern-cert-page {
            padding: 16px 8px 28px;
          }

          .rn-modern-cert-toolbar {
            align-items: stretch;
          }

          .rn-modern-cert-toolbar-actions {
            width: 100%;
          }

          .rn-modern-cert-toolbar-actions .rn-modern-cert-button {
            flex: 1;
          }

          .rn-modern-cert-sheet {
            aspect-ratio: auto;
            min-height: 690px;
            padding: 35px 23px 28px;
          }

          .rn-modern-cert-border-art {
            object-fit: fill;
          }

          .rn-modern-cert-tint {
            inset: 5%;
            background: rgba(255, 255, 255, 0.92);
          }

          .rn-modern-cert-topline {
            font-size: 8px;
            letter-spacing: 0.16em;
          }

          .rn-modern-cert-logo {
            height: 72px;
            max-width: 65%;
            margin-bottom: 8px;
          }

          .rn-modern-cert-brand-name {
            font-size: 14px;
          }

          .rn-modern-cert-tagline {
            max-width: 95%;
            font-size: 7px;
            letter-spacing: 0.05em;
          }

          .rn-modern-cert-gold-rule {
            margin-top: 10px;
          }

          .rn-modern-cert-content {
            padding: 30px 0 22px;
          }

          .rn-modern-cert-kicker {
            font-size: 8px;
            line-height: 1.5;
          }

          .rn-modern-cert-title {
            font-size: 29px;
          }

          .rn-modern-cert-presented {
            margin-top: 20px;
          }

          .rn-modern-cert-holder {
            font-size: 31px;
          }

          .rn-modern-cert-completion {
            line-height: 1.5;
          }

          .rn-modern-cert-course {
            margin-top: 8px;
            font-size: 18px;
          }

          .rn-modern-cert-metrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            row-gap: 13px;
            padding: 14px 0;
          }

          .rn-modern-cert-metric:nth-child(2) {
            border-right: 0;
          }

          .rn-modern-cert-metric-label {
            font-size: 7px;
          }

          .rn-modern-cert-metric-value {
            font-size: 10px;
          }

          .rn-modern-cert-number {
            margin-top: 12px;
            line-height: 1.5;
          }

          .rn-modern-cert-footer {
            grid-template-columns: 1fr 1fr;
            row-gap: 20px;
            margin-top: 16px;
            padding-top: 15px;
          }

          .rn-modern-cert-verification {
            grid-column: 1 / -1;
          }

          .rn-modern-cert-signatory strong,
          .rn-modern-cert-institution strong {
            font-size: 9px;
          }

          .rn-modern-cert-signatory > span,
          .rn-modern-cert-institution > span {
            font-size: 8px;
          }

          .rn-modern-cert-qr-row {
            justify-content: center;
          }

          .rn-modern-cert-qr {
            width: 58px;
            height: 58px;
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

          .rn-modern-cert-page,
          .rn-modern-cert-page * {
            visibility: visible !important;
          }

          .rn-modern-cert-page {
            position: fixed !important;
            inset: 0 auto auto 0 !important;
            display: block !important;
            width: 297mm !important;
            height: 210mm !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            background: #fff !important;
          }

          .rn-modern-cert-container {
            display: block !important;
            width: 297mm !important;
            max-width: none !important;
            height: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .rn-modern-cert-toolbar,
          .rn-modern-cert-secondary-actions,
          .no-print {
            display: none !important;
          }

          .rn-modern-cert-sheet {
            position: relative !important;
            display: flex !important;
            flex-direction: column !important;
            width: 297mm !important;
            height: 210mm !important;
            min-height: 0 !important;
            max-height: 210mm !important;
            aspect-ratio: auto !important;
            margin: 0 !important;
            padding: 7mm 13mm 6mm !important;
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

          .rn-modern-cert-border-art {
            position: absolute !important;
            inset: 0 !important;
            display: block !important;
            width: 100% !important;
            height: 100% !important;
            object-fit: fill !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .rn-modern-cert-tint {
            inset: 4.5% !important;
            background: rgba(255, 255, 255, 0.78) !important;
          }

          .rn-modern-cert-topline {
            flex: 0 0 4mm !important;
            margin: 0 0 0.5mm !important;
            font-size: 6.5pt !important;
            letter-spacing: 0.28em !important;
          }

          .rn-modern-cert-brand {
            flex: 0 0 25mm !important;
            height: 25mm !important;
            min-height: 25mm !important;
          }

          .rn-modern-cert-logo {
            width: auto !important;
            height: 17mm !important;
            max-height: 17mm !important;
            max-width: 68mm !important;
            margin: 0 auto 1mm !important;
            object-fit: contain !important;
          }

          .rn-modern-cert-brand-name {
            font-size: 10pt !important;
            letter-spacing: 0.22em !important;
          }

          .rn-modern-cert-tagline {
            margin-top: 1mm !important;
            font-size: 5.5pt !important;
            letter-spacing: 0.1em !important;
          }

          .rn-modern-cert-gold-rule {
            margin-top: 1mm !important;
          }

          .rn-modern-cert-content {
            flex: 1 1 auto !important;
            min-height: 0 !important;
            padding: 1mm 10mm 1mm !important;
            justify-content: center !important;
          }

          .rn-modern-cert-kicker {
            margin-bottom: 1mm !important;
            font-size: 7pt !important;
            letter-spacing: 0.25em !important;
          }

          .rn-modern-cert-title {
            font-size: 25pt !important;
            line-height: 1.05 !important;
          }

          .rn-modern-cert-presented {
            margin: 2mm 0 0.8mm !important;
            font-size: 8.5pt !important;
          }

          .rn-modern-cert-holder {
            font-size: 29pt !important;
            line-height: 1.05 !important;
          }

          .rn-modern-cert-holder-rule {
            margin: 1.5mm auto !important;
          }

          .rn-modern-cert-completion {
            font-size: 8pt !important;
          }

          .rn-modern-cert-course {
            margin-top: 1mm !important;
            font-size: 15pt !important;
            line-height: 1.1 !important;
          }

          .rn-modern-cert-revoked {
            margin: 0.5mm 0 !important;
            padding: 1mm 4mm !important;
            font-size: 7pt !important;
          }

          .rn-modern-cert-revoked-reason {
            margin: 0.5mm 0 !important;
            font-size: 6.5pt !important;
          }

          .rn-modern-cert-metrics {
            flex: 0 0 13mm !important;
            min-height: 13mm !important;
            margin: 0 !important;
            padding: 1.5mm 0 !important;
            background: rgba(255, 255, 255, 0.72) !important;
          }

          .rn-modern-cert-metric {
            padding: 0 3mm !important;
          }

          .rn-modern-cert-metric-label {
            margin-bottom: 1mm !important;
            font-size: 6pt !important;
          }

          .rn-modern-cert-metric-value {
            font-size: 7.5pt !important;
          }

          .rn-modern-cert-number {
            flex: 0 0 auto !important;
            margin: 1mm 0 0 !important;
            gap: 2mm !important;
            font-size: 6.5pt !important;
          }

          .rn-modern-cert-footer {
            flex: 0 0 29mm !important;
            height: 29mm !important;
            min-height: 29mm !important;
            margin-top: 1.5mm !important;
            padding-top: 1.5mm !important;
            gap: 3mm !important;
          }

          .rn-modern-cert-signature {
            height: 8mm !important;
            max-height: 8mm !important;
          }

          .rn-modern-cert-signature-line {
            margin: 0.5mm auto 1mm !important;
          }

          .rn-modern-cert-signatory strong,
          .rn-modern-cert-institution strong {
            font-size: 7pt !important;
          }

          .rn-modern-cert-signatory > span,
          .rn-modern-cert-institution > span {
            margin-top: 0.5mm !important;
            font-size: 6pt !important;
          }

          .rn-modern-cert-stamps {
            gap: 2mm !important;
            margin-bottom: 0.5mm !important;
          }

          .rn-modern-cert-company-stamp {
            width: 11mm !important;
            height: 11mm !important;
          }

          .rn-modern-cert-seal {
            width: 12mm !important;
            height: 12mm !important;
          }

          .rn-modern-cert-security-stamp {
            width: 10mm !important;
            height: 10mm !important;
          }

          .rn-modern-cert-qr-row {
            gap: 2mm !important;
          }

          .rn-modern-cert-qr {
            width: 13mm !important;
            height: 13mm !important;
          }

          .rn-modern-cert-qr-copy strong {
            font-size: 6.5pt !important;
          }

          .rn-modern-cert-qr-copy span {
            margin-top: 0.7mm !important;
            font-size: 5.5pt !important;
          }

          .rn-modern-cert-footer-meta {
            margin-top: 0.8mm !important;
            font-size: 5.5pt !important;
          }

          .rn-modern-cert-page img {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <div className="rn-modern-cert-container">
        <div className="rn-modern-cert-toolbar">
          <Link
            href="/student/certificates"
            className="rn-modern-cert-back"
          >
            ← My Certificates
          </Link>

          <div className="rn-modern-cert-toolbar-actions">
            <Link
              href={verificationPath}
              className="rn-modern-cert-button"
            >
              Verify Certificate
            </Link>

            {!certificate.is_revoked && (
              <CertificatePrintButton />
            )}
          </div>
        </div>

        <article className="rn-modern-cert-sheet">
          <img
            src="/brand/ruffneck-border-background.png"
            alt=""
            aria-hidden="true"
            className="rn-modern-cert-border-art"
          />

          <div
            className="rn-modern-cert-tint"
            aria-hidden="true"
          />

          <div className="rn-modern-cert-topline">
            Official learning credential
          </div>

          <header className="rn-modern-cert-brand">
            <img
              src="/brand/ruffneck-logo.png"
              alt="RuffNeck Entertainment"
              className="rn-modern-cert-logo"
            />

            <p className="rn-modern-cert-brand-name">
              RUFFNECK LEARN
            </p>

            <div className="rn-modern-cert-tagline">
              AI • Digital Transformation • Business Solutions
            </div>

            <div
              className="rn-modern-cert-gold-rule"
              aria-hidden="true"
            >
              <span />
              <span />
              <span />
            </div>
          </header>

          {certificate.is_revoked && (
            <div className="rn-modern-cert-revoked" role="alert">
              REVOKED
            </div>
          )}

          <section className="rn-modern-cert-content">
            <p className="rn-modern-cert-kicker">
              Certificate of Achievement
            </p>

            <h1 className="rn-modern-cert-title">
              Certificate of Completion
            </h1>

            <p className="rn-modern-cert-presented">
              This certificate is proudly presented to
            </p>

            <h2 className="rn-modern-cert-holder">
              {certificate.holder_name}
            </h2>

            <div
              className="rn-modern-cert-holder-rule"
              aria-hidden="true"
            />

            <p className="rn-modern-cert-completion">
              For successfully completing the professional course
            </p>

            <h3 className="rn-modern-cert-course">
              {certificate.course_title}
            </h3>
          </section>

          <section
            className="rn-modern-cert-metrics"
            aria-label="Certificate details"
          >
            <div className="rn-modern-cert-metric">
              <span className="rn-modern-cert-metric-label">
                Credential
              </span>
              <strong className="rn-modern-cert-metric-value">
                Course Completion
              </strong>
            </div>

            <div className="rn-modern-cert-metric">
              <span className="rn-modern-cert-metric-label">
                Date Issued
              </span>
              <strong className="rn-modern-cert-metric-value">
                {formatDate(certificate.issued_at)}
              </strong>
            </div>

            <div className="rn-modern-cert-metric">
              <span className="rn-modern-cert-metric-label">
                Assessment Score
              </span>
              <strong className="rn-modern-cert-metric-value">
                {certificate.assessment_score ?? "—"}%
              </strong>
            </div>

            <div className="rn-modern-cert-metric">
              <span className="rn-modern-cert-metric-label">
                Capstone Score
              </span>
              <strong className="rn-modern-cert-metric-value">
                {certificate.capstone_score ?? "—"}/100
              </strong>
            </div>
          </section>

          <div className="rn-modern-cert-number">
            <span>Certificate ID</span>
            <strong>{certificate.certificate_number}</strong>
          </div>

          {certificate.is_revoked && certificate.revoked_reason && (
            <p className="rn-modern-cert-revoked-reason">
              Reason: {certificate.revoked_reason}
            </p>
          )}

          <footer className="rn-modern-cert-footer">
            <div className="rn-modern-cert-signatory">
              <img
                src="/brand/founder-signature.png"
                alt="Hassan Zakariya signature"
                className="rn-modern-cert-signature"
              />

              <div
                className="rn-modern-cert-signature-line"
                aria-hidden="true"
              />

              <strong>Hassan Zakariya</strong>
              <span>Founder &amp; CEO</span>
              <span>RuffNeck Entertainment</span>
            </div>

            <div className="rn-modern-cert-institution">
              <div className="rn-modern-cert-stamps">
                <img
                  src="/brand/ruffneck-company-stamp.png"
                  alt="RuffNeck company stamp"
                  className="rn-modern-cert-company-stamp"
                />

                <img
                  src="/brand/ruffneck-certificate-seal.png"
                  alt="RuffNeck certificate seal"
                  className="rn-modern-cert-seal"
                />

                <img
                  src="/brand/ruffneck-security-stamp.png"
                  alt="RuffNeck security stamp"
                  className="rn-modern-cert-security-stamp"
                />
              </div>

              <strong>RuffNeck Entertainment</strong>
              <span>Professional Learning &amp; Digital Skills</span>
            </div>

            <div className="rn-modern-cert-verification">
              {!certificate.is_revoked ? (
                <div className="rn-modern-cert-qr-row">
                  <img
                    src={qrCodeUrl}
                    alt={`QR code for certificate ${certificate.certificate_number}`}
                    width={150}
                    height={150}
                    className="rn-modern-cert-qr"
                  />

                  <div className="rn-modern-cert-qr-copy">
                    <strong>SCAN TO VERIFY</strong>
                    <span>
                      Scan the QR code to check certificate authenticity.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="rn-modern-cert-footer-meta">
                  This certificate has been revoked.
                </div>
              )}

              <div className="rn-modern-cert-footer-meta">
                <strong>{certificate.certificate_number}</strong>
                <br />
                Issued {formatDate(certificate.issued_at)}
                <br />
                RUFFNECK LEARN
              </div>
            </div>
          </footer>
        </article>

        {!certificate.is_revoked && (
          <div style={{ marginTop: 20 }}>
            <CertificateVerificationLink
              certificateNumber={certificate.certificate_number}
            />
          </div>
        )}

        <div className="rn-modern-cert-secondary-actions">
          <Link
            href="/student/certificates"
            className="rn-modern-cert-button"
          >
            All Certificates
          </Link>

          <Link
            href="/courses"
            className="rn-modern-cert-button"
          >
            Browse Courses
          </Link>
        </div>
      </div>
    </main>
  );
}