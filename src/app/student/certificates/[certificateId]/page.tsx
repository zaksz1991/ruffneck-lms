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
    <main className="rn-premium-certificate-page">
      <style>{`
        .rn-premium-certificate-page {
          --rn-ink: #10233f;
          --rn-navy: #0b1e3a;
          --rn-gold: #b68a35;
          --rn-gold-light: #e4c77e;
          --rn-muted: #64748b;
          padding: 32px 20px 48px;
          color: var(--rn-ink);
        }

        .rn-premium-certificate-page * {
          box-sizing: border-box;
        }

        .rn-premium-certificate-page .rn-cert-shell {
          width: 100%;
          max-width: 1180px;
          margin: 0 auto;
        }

        .rn-premium-certificate-page .rn-cert-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 14px;
          margin: 0 0 22px;
        }

        .rn-premium-certificate-page .rn-cert-back {
          color: var(--rn-ink);
          text-decoration: none;
          font-weight: 650;
          font-size: 14px;
        }

        .rn-premium-certificate-page .rn-cert-back:hover {
          color: var(--rn-gold);
        }

        .rn-premium-certificate-page .rn-cert-toolbar-actions {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
        }

        .rn-premium-certificate-page .rn-cert-toolbar-actions a,
        .rn-premium-certificate-page .rn-cert-toolbar-actions button {
          min-height: 42px;
        }

        .rn-premium-certificate-page .rn-cert-paper {
          position: relative;
          isolation: isolate;
          width: 100%;
          aspect-ratio: 297 / 210;
          overflow: hidden;
          background: #fffdf7;
          box-shadow: 0 22px 65px rgba(15, 35, 64, 0.16);
          border: 1px solid #d6bd7d;
          color: var(--rn-ink);
        }

        .rn-premium-certificate-page .rn-cert-border-art {
          position: absolute;
          z-index: -2;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: fill;
          pointer-events: none;
        }

        .rn-premium-certificate-page .rn-cert-paper-tint {
          position: absolute;
          z-index: -1;
          inset: 3.4%;
          background: rgba(255, 253, 247, 0.68);
          pointer-events: none;
        }

        .rn-premium-certificate-page .rn-cert-inner {
          position: absolute;
          inset: 5.5% 7%;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr) auto auto;
          min-width: 0;
          min-height: 0;
          text-align: center;
        }

        .rn-premium-certificate-page .rn-cert-brand {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          min-width: 0;
          padding-bottom: 1.2%;
          border-bottom: 1px solid rgba(182, 138, 53, 0.6);
        }

        .rn-premium-certificate-page .rn-cert-logo {
          display: block;
          width: clamp(150px, 19%, 230px);
          height: auto;
          max-height: 74px;
          object-fit: contain;
          flex: 0 1 auto;
        }

        .rn-premium-certificate-page .rn-cert-brand-copy {
          min-width: 0;
          text-align: left;
        }

        .rn-premium-certificate-page .rn-cert-brand-name {
          margin: 0;
          color: var(--rn-navy);
          font-size: clamp(15px, 1.55vw, 23px);
          font-weight: 850;
          letter-spacing: 0.13em;
          line-height: 1.15;
        }

        .rn-premium-certificate-page .rn-cert-brand-tagline {
          margin-top: 6px;
          color: #6b5a35;
          font-size: clamp(8px, 0.75vw, 11px);
          font-weight: 700;
          letter-spacing: 0.12em;
          line-height: 1.35;
          text-transform: uppercase;
        }

        .rn-premium-certificate-page .rn-cert-main {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-width: 0;
          min-height: 0;
          padding: 1.3% 0 1%;
        }

        .rn-premium-certificate-page .rn-cert-kicker {
          margin: 0 0 0.6%;
          color: #8b6a2d;
          font-size: clamp(9px, 0.78vw, 12px);
          font-weight: 800;
          letter-spacing: 0.28em;
          line-height: 1.3;
          text-transform: uppercase;
        }

        .rn-premium-certificate-page .rn-cert-title {
          margin: 0;
          color: var(--rn-navy);
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(25px, 3.05vw, 45px);
          font-weight: 500;
          letter-spacing: 0.025em;
          line-height: 1.1;
        }

        .rn-premium-certificate-page .rn-cert-presented {
          margin: 1.3% 0 0.3%;
          color: #475569;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(11px, 1vw, 15px);
          font-style: italic;
          line-height: 1.3;
        }

        .rn-premium-certificate-page .rn-cert-recipient {
          width: 100%;
          max-width: 95%;
          margin: 0;
          color: #102b4e;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(25px, 3.45vw, 51px);
          font-weight: 700;
          line-height: 1.12;
          overflow-wrap: anywhere;
          text-wrap: balance;
        }

        .rn-premium-certificate-page .rn-cert-recipient-rule {
          width: 35%;
          max-width: 300px;
          height: 2px;
          margin: 1% auto 0;
          background: linear-gradient(
            90deg,
            transparent,
            var(--rn-gold),
            transparent
          );
        }

        .rn-premium-certificate-page .rn-cert-completion-copy {
          margin: 1% 0 0.3%;
          color: #475569;
          font-size: clamp(10px, 0.88vw, 13px);
          line-height: 1.35;
        }

        .rn-premium-certificate-page .rn-cert-course {
          width: 100%;
          max-width: 88%;
          margin: 0;
          color: var(--rn-navy);
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(16px, 1.8vw, 27px);
          font-weight: 700;
          line-height: 1.2;
          overflow-wrap: anywhere;
          text-wrap: balance;
        }

        .rn-premium-certificate-page .rn-cert-revoked {
          display: inline-block;
          margin-top: 8px;
          padding: 5px 14px;
          border: 1px solid #b91c1c;
          color: #b91c1c;
          background: rgba(255, 255, 255, 0.92);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.2em;
        }

        .rn-premium-certificate-page .rn-cert-metrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          margin: 0 0 1.4%;
          border-top: 1px solid rgba(182, 138, 53, 0.65);
          border-bottom: 1px solid rgba(182, 138, 53, 0.65);
          background: rgba(255, 255, 255, 0.45);
        }

        .rn-premium-certificate-page .rn-cert-metric {
          min-width: 0;
          padding: 9px 8px;
        }

        .rn-premium-certificate-page .rn-cert-metric + .rn-cert-metric {
          border-left: 1px solid rgba(182, 138, 53, 0.35);
        }

        .rn-premium-certificate-page .rn-cert-metric-label {
          display: block;
          margin-bottom: 5px;
          color: #74603b;
          font-size: clamp(8px, 0.65vw, 10px);
          font-weight: 800;
          letter-spacing: 0.1em;
          line-height: 1.2;
          text-transform: uppercase;
        }

        .rn-premium-certificate-page .rn-cert-metric-value {
          display: block;
          color: var(--rn-navy);
          font-size: clamp(10px, 0.9vw, 13px);
          font-weight: 800;
          line-height: 1.25;
          overflow-wrap: anywhere;
        }

        .rn-premium-certificate-page .rn-cert-authentication {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
          align-items: center;
          gap: 16px;
          min-width: 0;
          padding-top: 1%;
        }

        .rn-premium-certificate-page .rn-cert-signatory {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
          min-width: 0;
          text-align: left;
        }

        .rn-premium-certificate-page .rn-cert-signature {
          display: block;
          width: auto;
          max-width: 150px;
          height: 38px;
          object-fit: contain;
          object-position: left bottom;
        }

        .rn-premium-certificate-page .rn-cert-signature-rule {
          width: 100%;
          max-width: 200px;
          margin: 3px 0 5px;
          border-top: 1px solid #8c774f;
        }

        .rn-premium-certificate-page .rn-cert-signatory-name {
          color: var(--rn-navy);
          font-size: clamp(10px, 0.9vw, 13px);
          font-weight: 850;
          line-height: 1.25;
        }

        .rn-premium-certificate-page .rn-cert-signatory-role {
          margin-top: 3px;
          color: #64748b;
          font-size: clamp(8px, 0.68vw, 10px);
          line-height: 1.3;
        }

        .rn-premium-certificate-page .rn-cert-official-seals {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }

        .rn-premium-certificate-page .rn-cert-seal {
          display: block;
          width: clamp(45px, 5.6vw, 78px);
          height: clamp(45px, 5.6vw, 78px);
          object-fit: contain;
        }

        .rn-premium-certificate-page .rn-cert-company-stamp {
          display: block;
          width: clamp(42px, 4.7vw, 65px);
          height: clamp(42px, 4.7vw, 65px);
          object-fit: contain;
        }

        .rn-premium-certificate-page .rn-cert-verify {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          min-width: 0;
          text-align: left;
        }

        .rn-premium-certificate-page .rn-cert-qr {
          display: block;
          width: clamp(55px, 6vw, 82px);
          height: clamp(55px, 6vw, 82px);
          padding: 3px;
          border: 1px solid #d8c18a;
          background: #fff;
          object-fit: contain;
          flex: 0 0 auto;
        }

        .rn-premium-certificate-page .rn-cert-verify-copy {
          min-width: 0;
        }

        .rn-premium-certificate-page .rn-cert-verify-heading {
          display: block;
          margin-bottom: 4px;
          color: var(--rn-navy);
          font-size: clamp(8px, 0.7vw, 10px);
          font-weight: 900;
          letter-spacing: 0.08em;
          line-height: 1.2;
        }

        .rn-premium-certificate-page .rn-cert-verify-copy span {
          display: block;
          color: #64748b;
          font-size: clamp(7px, 0.62vw, 9px);
          line-height: 1.35;
          overflow-wrap: anywhere;
        }

        .rn-premium-certificate-page .rn-cert-number {
          margin-top: 5px;
          color: #6b5a35;
          font-size: clamp(7px, 0.62vw, 9px);
          font-weight: 800;
          letter-spacing: 0.025em;
          line-height: 1.3;
          overflow-wrap: anywhere;
        }

        .rn-premium-certificate-page .rn-cert-revoked-note {
          margin: 10px 0;
          padding: 10px 14px;
          border: 1px solid #fecaca;
          background: #fff1f2;
          color: #991b1b;
          font-size: 13px;
        }

        .rn-premium-certificate-page .rn-cert-bottom-actions {
          display: flex;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 20px;
        }

        @media (max-width: 760px) {
          .rn-premium-certificate-page {
            padding: 20px 12px 36px;
          }

          .rn-premium-certificate-page .rn-cert-paper {
            aspect-ratio: auto;
            min-height: 760px;
          }

          .rn-premium-certificate-page .rn-cert-inner {
            position: relative;
            inset: auto;
            min-height: 760px;
            padding: 34px 7%;
            display: flex;
            flex-direction: column;
            gap: 20px;
          }

          .rn-premium-certificate-page .rn-cert-brand {
            flex-direction: column;
            gap: 10px;
            padding-bottom: 18px;
          }

          .rn-premium-certificate-page .rn-cert-logo {
            width: 190px;
            max-height: 76px;
          }

          .rn-premium-certificate-page .rn-cert-brand-copy {
            text-align: center;
          }

          .rn-premium-certificate-page .rn-cert-brand-name {
            font-size: 19px;
          }

          .rn-premium-certificate-page .rn-cert-brand-tagline {
            font-size: 9px;
          }

          .rn-premium-certificate-page .rn-cert-main {
            gap: 8px;
            padding: 8px 0;
          }

          .rn-premium-certificate-page .rn-cert-kicker {
            font-size: 9px;
            letter-spacing: 0.16em;
          }

          .rn-premium-certificate-page .rn-cert-title {
            font-size: clamp(24px, 7vw, 36px);
          }

          .rn-premium-certificate-page .rn-cert-presented {
            margin-top: 8px;
          }

          .rn-premium-certificate-page .rn-cert-recipient {
            max-width: 100%;
            font-size: clamp(25px, 7vw, 40px);
          }

          .rn-premium-certificate-page .rn-cert-course {
            max-width: 100%;
            font-size: clamp(17px, 4.5vw, 24px);
          }

          .rn-premium-certificate-page .rn-cert-metrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .rn-premium-certificate-page .rn-cert-metric {
            padding: 12px 7px;
          }

          .rn-premium-certificate-page .rn-cert-metric:nth-child(3) {
            border-left: 0;
            border-top: 1px solid rgba(182, 138, 53, 0.35);
          }

          .rn-premium-certificate-page .rn-cert-metric:nth-child(4) {
            border-top: 1px solid rgba(182, 138, 53, 0.35);
          }

          .rn-premium-certificate-page .rn-cert-metric-label {
            font-size: 9px;
          }

          .rn-premium-certificate-page .rn-cert-metric-value {
            font-size: 12px;
          }

          .rn-premium-certificate-page .rn-cert-authentication {
            grid-template-columns: 1fr;
            gap: 18px;
            padding-top: 8px;
          }

          .rn-premium-certificate-page .rn-cert-signatory {
            align-items: center;
            text-align: center;
          }

          .rn-premium-certificate-page .rn-cert-signature-rule {
            margin-left: auto;
            margin-right: auto;
          }

          .rn-premium-certificate-page .rn-cert-official-seals {
            order: 2;
          }

          .rn-premium-certificate-page .rn-cert-verify {
            justify-content: center;
          }

          .rn-premium-certificate-page .rn-cert-qr {
            width: 72px;
            height: 72px;
          }

          .rn-premium-certificate-page .rn-cert-verify-heading {
            font-size: 10px;
          }

          .rn-premium-certificate-page .rn-cert-verify-copy span,
          .rn-premium-certificate-page .rn-cert-number {
            font-size: 9px;
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

          .rn-premium-certificate-page,
          .rn-premium-certificate-page * {
            visibility: visible !important;
          }

          .rn-premium-certificate-page {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 297mm !important;
            height: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            background: #fff !important;
          }

          .rn-premium-certificate-page .rn-cert-shell {
            width: 297mm !important;
            max-width: none !important;
            height: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .rn-premium-certificate-page .no-print,
          .rn-premium-certificate-page .rn-cert-toolbar,
          .rn-premium-certificate-page .rn-cert-bottom-actions {
            display: none !important;
          }

          .rn-premium-certificate-page .rn-cert-paper {
            position: relative !important;
            display: block !important;
            width: 297mm !important;
            height: 210mm !important;
            min-height: 0 !important;
            max-height: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            aspect-ratio: auto !important;
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
          }

          .rn-premium-certificate-page .rn-cert-border-art {
            display: block !important;
            position: absolute !important;
            inset: 0 !important;
            width: 297mm !important;
            height: 210mm !important;
            object-fit: fill !important;
          }

          .rn-premium-certificate-page .rn-cert-paper-tint {
            position: absolute !important;
            inset: 3.4% !important;
            background: rgba(255, 253, 247, 0.68) !important;
          }

          .rn-premium-certificate-page .rn-cert-inner {
            position: absolute !important;
            inset: 11mm 20mm !important;
            display: grid !important;
            grid-template-rows: auto minmax(0, 1fr) auto auto !important;
            width: auto !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            padding: 0 !important;
            gap: 0 !important;
            overflow: visible !important;
          }

          .rn-premium-certificate-page .rn-cert-brand {
            display: flex !important;
            flex-direction: row !important;
            justify-content: center !important;
            gap: 7mm !important;
            padding-bottom: 2.5mm !important;
          }

          .rn-premium-certificate-page .rn-cert-logo {
            display: block !important;
            width: 48mm !important;
            max-width: 48mm !important;
            height: 18mm !important;
            max-height: 18mm !important;
            object-fit: contain !important;
          }

          .rn-premium-certificate-page .rn-cert-brand-copy {
            text-align: left !important;
          }

          .rn-premium-certificate-page .rn-cert-brand-name {
            font-size: 17pt !important;
            line-height: 1.15 !important;
          }

          .rn-premium-certificate-page .rn-cert-brand-tagline {
            margin-top: 1.5mm !important;
            font-size: 7pt !important;
            line-height: 1.2 !important;
          }

          .rn-premium-certificate-page .rn-cert-main {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            min-height: 0 !important;
            padding: 2mm 0 !important;
            gap: 1.2mm !important;
            overflow: visible !important;
          }

          .rn-premium-certificate-page .rn-cert-kicker {
            margin: 0 0 1mm !important;
            font-size: 8pt !important;
            letter-spacing: 0.24em !important;
            line-height: 1.15 !important;
          }

          .rn-premium-certificate-page .rn-cert-title {
            margin: 0 !important;
            font-size: 27pt !important;
            line-height: 1.1 !important;
          }

          .rn-premium-certificate-page .rn-cert-presented {
            margin: 2mm 0 0.5mm !important;
            font-size: 10pt !important;
            line-height: 1.15 !important;
          }

          .rn-premium-certificate-page .rn-cert-recipient {
            max-width: 95% !important;
            margin: 0 !important;
            font-size: 35pt !important;
            line-height: 1.08 !important;
            overflow-wrap: anywhere !important;
          }

          .rn-premium-certificate-page .rn-cert-recipient-rule {
            width: 80mm !important;
            max-width: 80mm !important;
            height: 0.5mm !important;
            margin: 2mm auto 0 !important;
          }

          .rn-premium-certificate-page .rn-cert-completion-copy {
            margin: 1.5mm 0 0.5mm !important;
            font-size: 9pt !important;
            line-height: 1.15 !important;
          }

          .rn-premium-certificate-page .rn-cert-course {
            max-width: 90% !important;
            margin: 0 !important;
            font-size: 17pt !important;
            line-height: 1.15 !important;
            overflow-wrap: anywhere !important;
          }

          .rn-premium-certificate-page .rn-cert-revoked {
            margin-top: 2mm !important;
            padding: 1mm 4mm !important;
            font-size: 8pt !important;
          }

          .rn-premium-certificate-page .rn-cert-metrics {
            display: grid !important;
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            margin: 0 0 2mm !important;
          }

          .rn-premium-certificate-page .rn-cert-metric {
            min-width: 0 !important;
            padding: 2mm 2mm !important;
          }

          .rn-premium-certificate-page .rn-cert-metric-label {
            margin-bottom: 1mm !important;
            font-size: 7pt !important;
            line-height: 1.1 !important;
          }

          .rn-premium-certificate-page .rn-cert-metric-value {
            font-size: 9pt !important;
            line-height: 1.15 !important;
          }

          .rn-premium-certificate-page .rn-cert-authentication {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) !important;
            align-items: center !important;
            gap: 4mm !important;
            min-height: 0 !important;
            padding-top: 1.5mm !important;
          }

          .rn-premium-certificate-page .rn-cert-signatory {
            display: flex !important;
            align-items: flex-start !important;
            text-align: left !important;
          }

          .rn-premium-certificate-page .rn-cert-signature {
            display: block !important;
            width: auto !important;
            max-width: 40mm !important;
            height: 10mm !important;
            object-fit: contain !important;
            object-position: left bottom !important;
          }

          .rn-premium-certificate-page .rn-cert-signature-rule {
            width: 55mm !important;
            max-width: 55mm !important;
            margin: 1mm 0 !important;
            border-top: 0.3mm solid #8c774f !important;
          }

          .rn-premium-certificate-page .rn-cert-signatory-name {
            font-size: 9pt !important;
            line-height: 1.1 !important;
          }

          .rn-premium-certificate-page .rn-cert-signatory-role {
            margin-top: 0.5mm !important;
            font-size: 7pt !important;
            line-height: 1.15 !important;
          }

          .rn-premium-certificate-page .rn-cert-official-seals {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 3mm !important;
          }

          .rn-premium-certificate-page .rn-cert-seal {
            display: block !important;
            width: 19mm !important;
            height: 19mm !important;
            object-fit: contain !important;
          }

          .rn-premium-certificate-page .rn-cert-company-stamp {
            display: block !important;
            width: 17mm !important;
            height: 17mm !important;
            object-fit: contain !important;
          }

          .rn-premium-certificate-page .rn-cert-verify {
            display: flex !important;
            align-items: center !important;
            justify-content: flex-end !important;
            gap: 2.5mm !important;
            min-width: 0 !important;
          }

          .rn-premium-certificate-page .rn-cert-qr {
            display: block !important;
            width: 19mm !important;
            height: 19mm !important;
            padding: 0.7mm !important;
            object-fit: contain !important;
          }

          .rn-premium-certificate-page .rn-cert-verify-heading {
            margin-bottom: 1mm !important;
            font-size: 7pt !important;
            line-height: 1.1 !important;
          }

          .rn-premium-certificate-page .rn-cert-verify-copy span {
            font-size: 6.5pt !important;
            line-height: 1.15 !important;
          }

          .rn-premium-certificate-page .rn-cert-number {
            margin-top: 1mm !important;
            font-size: 6pt !important;
            line-height: 1.15 !important;
          }

          .rn-premium-certificate-page .rn-cert-revoked-note {
            margin: 1mm 0 !important;
            padding: 1.5mm 2mm !important;
            font-size: 8pt !important;
          }

          .rn-premium-certificate-page img {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <div className="rn-cert-shell">
        <div className="rn-cert-toolbar no-print">
          <Link
            href="/student/certificates"
            className="rn-cert-back"
          >
            ← My Certificates
          </Link>

          <div className="rn-cert-toolbar-actions">
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
          className={`rn-cert-paper ${
            certificate.is_revoked ? "is-revoked" : ""
          }`}
          aria-label="RuffNeck Learn certificate"
        >
          <img
            src="/brand/ruffneck-border-background.png"
            alt=""
            aria-hidden="true"
            className="rn-cert-border-art"
          />

          <div className="rn-cert-paper-tint" aria-hidden="true" />

          <div className="rn-cert-inner">
            <header className="rn-cert-brand">
              <img
                src="/brand/ruffneck-logo.png"
                alt="RuffNeck Entertainment"
                className="rn-cert-logo"
              />

              <div className="rn-cert-brand-copy">
                <p className="rn-cert-brand-name">
                  RUFFNECK LEARN
                </p>
                <div className="rn-cert-brand-tagline">
                  AI • Digital Transformation • Business Solutions
                </div>
              </div>
            </header>

            <section className="rn-cert-main">
              <p className="rn-cert-kicker">
                Professional Learning Credential
              </p>

              <h1 className="rn-cert-title">
                Certificate of Completion
              </h1>

              {certificate.is_revoked ? (
                <div className="rn-cert-revoked" role="alert">
                  REVOKED
                </div>
              ) : null}

              <p className="rn-cert-presented">
                This certificate is proudly presented to
              </p>

              <h2 className="rn-cert-recipient">
                {certificate.holder_name}
              </h2>

              <div
                className="rn-cert-recipient-rule"
                aria-hidden="true"
              />

              <p className="rn-cert-completion-copy">
                For successfully completing the course
              </p>

              <h3 className="rn-cert-course">
                {certificate.course_title}
              </h3>
            </section>

            <section
              className="rn-cert-metrics"
              aria-label="Certificate details"
            >
              <div className="rn-cert-metric">
                <span className="rn-cert-metric-label">
                  Credential
                </span>
                <strong className="rn-cert-metric-value">
                  Course Completion
                </strong>
              </div>

              <div className="rn-cert-metric">
                <span className="rn-cert-metric-label">
                  Date Issued
                </span>
                <strong className="rn-cert-metric-value">
                  {formatDate(certificate.issued_at)}
                </strong>
              </div>

              <div className="rn-cert-metric">
                <span className="rn-cert-metric-label">
                  Assessment Score
                </span>
                <strong className="rn-cert-metric-value">
                  {certificate.assessment_score ?? "—"}%
                </strong>
              </div>

              <div className="rn-cert-metric">
                <span className="rn-cert-metric-label">
                  Capstone Score
                </span>
                <strong className="rn-cert-metric-value">
                  {certificate.capstone_score ?? "—"}/100
                </strong>
              </div>
            </section>

            {!certificate.is_revoked ? (
              <section
                className="rn-cert-authentication"
                aria-label="Certificate authentication"
              >
                <div className="rn-cert-signatory">
                  <img
                    src="/brand/founder-signature.png"
                    alt="Hassan Zakariya signature"
                    className="rn-cert-signature"
                  />

                  <div
                    className="rn-cert-signature-rule"
                    aria-hidden="true"
                  />

                  <strong className="rn-cert-signatory-name">
                    Hassan Zakariya
                  </strong>

                  <span className="rn-cert-signatory-role">
                    Founder &amp; CEO · RuffNeck Entertainment
                  </span>
                </div>

                <div className="rn-cert-official-seals">
                  <img
                    src="/brand/ruffneck-certificate-seal.png"
                    alt="RuffNeck Learn certificate seal"
                    className="rn-cert-seal"
                  />

                  <img
                    src="/brand/ruffneck-company-stamp.png"
                    alt="RuffNeck Entertainment company stamp"
                    className="rn-cert-company-stamp"
                  />

                  <img
                    src="/brand/ruffneck-security-stamp.png"
                    alt="RuffNeck security stamp"
                    className="rn-cert-company-stamp"
                  />
                </div>

                <div className="rn-cert-verify">
                  <img
                    src={qrCodeUrl}
                    alt={`QR code to verify certificate ${certificate.certificate_number}`}
                    width={180}
                    height={180}
                    className="rn-cert-qr"
                  />

                  <div className="rn-cert-verify-copy">
                    <strong className="rn-cert-verify-heading">
                      SCAN TO VERIFY
                    </strong>

                    <span>
                      Official RuffNeck Learn verification
                    </span>

                    <div className="rn-cert-number">
                      No. {certificate.certificate_number}
                    </div>
                  </div>
                </div>
              </section>
            ) : (
              <div className="rn-cert-revoked-note" role="alert">
                {certificate.revoked_reason ||
                  "This certificate has been revoked and is no longer valid."}
              </div>
            )}
          </div>
        </article>

        {!certificate.is_revoked ? (
          <div className="no-print" style={{ marginTop: 18 }}>
            <CertificateVerificationLink
              certificateNumber={certificate.certificate_number}
            />
          </div>
        ) : null}

        <div className="rn-cert-bottom-actions no-print">
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