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

function buildQrCodeUrl(url: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&format=png&margin=8&data=${encodeURIComponent(
    url
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

  if (!certificate) notFound();

  const verificationPath =
    `/verify/certificate-number/${encodeURIComponent(
      certificate.certificate_number
    )}`;

  const qrCodeUrl = buildQrCodeUrl(
    buildVerificationUrl(certificate.certificate_number)
  );

  return (
    <main className="rn-executive-page">
      <style>{`
        .rn-executive-page {
          --navy: #0b1e3a;
          --navy-light: #17375e;
          --gold: #c6a052;
          --gold-light: #e7d3a2;
          --ink: #26364b;
          --muted: #6a788b;
          min-height: 100vh;
          padding: 28px 18px 45px;
          background: #edf1f6;
          color: var(--ink);
          font-family: Arial, Helvetica, sans-serif;
        }

        .rn-executive-page *,
        .rn-executive-page *::before,
        .rn-executive-page *::after {
          box-sizing: border-box;
        }

        .rn-executive-container {
          width: 100%;
          max-width: 1260px;
          margin: 0 auto;
        }

        .rn-executive-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 22px;
        }

        .rn-executive-back {
          color: var(--navy);
          font-size: 14px;
          font-weight: 700;
          text-decoration: none;
        }

        .rn-executive-back:hover {
          text-decoration: underline;
        }

        .rn-executive-actions {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
        }

        .rn-executive-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 42px;
          padding: 10px 16px;
          border: 1px solid #d4dce6;
          border-radius: 8px;
          background: #fff;
          color: var(--navy);
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
          cursor: pointer;
        }

        .rn-executive-button-primary {
          border-color: var(--navy);
          background: var(--navy);
          color: #fff;
        }

        .rn-executive-sheet {
          position: relative;
          isolation: isolate;
          display: grid;
          grid-template-columns: 28% minmax(0, 72%);
          width: 100%;
          aspect-ratio: 297 / 210;
          overflow: hidden;
          background: #fff;
          box-shadow: 0 22px 65px rgba(11, 30, 58, 0.16);
        }

        .rn-executive-background {
          position: absolute;
          z-index: -2;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: fill;
          pointer-events: none;
        }

        .rn-executive-overlay {
          position: absolute;
          z-index: -1;
          inset: 0;
          background: rgba(255, 255, 255, 0.69);
          pointer-events: none;
        }

        .rn-executive-rail {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 0;
          padding: 10% 9% 8%;
          overflow: hidden;
          background: linear-gradient(
            155deg,
            #0b1e3a 0%,
            #102a4d 56%,
            #17375e 100%
          );
          color: #fff;
          text-align: center;
        }

        .rn-executive-rail::before {
          position: absolute;
          content: "";
          inset: 9px;
          border: 1px solid rgba(231, 211, 162, 0.65);
          pointer-events: none;
        }

        .rn-executive-rail::after {
          position: absolute;
          content: "";
          top: 0;
          right: 0;
          bottom: 0;
          width: 4px;
          background: linear-gradient(
            180deg,
            #e7d3a2,
            #c6a052,
            #8f6c2d
          );
        }

        .rn-executive-rail-brand {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
        }

        .rn-executive-logo {
          display: block;
          width: 100%;
          max-width: 190px;
          height: auto;
          max-height: 100px;
          object-fit: contain;
          margin: 0 auto 8%;
        }

        .rn-executive-brand-name {
          margin: 0;
          color: #fff;
          font-size: clamp(9px, 1.1vw, 15px);
          font-weight: 900;
          letter-spacing: 0.18em;
          line-height: 1.5;
        }

        .rn-executive-brand-tagline {
          margin-top: 6px;
          color: #d2dbea;
          font-size: clamp(5px, 0.55vw, 8px);
          line-height: 1.7;
          letter-spacing: 0.07em;
        }

        .rn-executive-rail-divider {
          width: 55%;
          height: 2px;
          margin: 13% auto;
          background: linear-gradient(
            90deg,
            transparent,
            var(--gold-light),
            transparent
          );
        }

        .rn-executive-rail-caption {
          margin: 0;
          color: var(--gold-light);
          font-size: clamp(6px, 0.7vw, 9px);
          font-weight: 800;
          letter-spacing: 0.22em;
          line-height: 1.8;
          text-transform: uppercase;
        }

        .rn-executive-rail-description {
          margin: 8% 0 0;
          color: #fff;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(11px, 1.4vw, 19px);
          line-height: 1.55;
        }

        .rn-executive-rail-seal {
          display: block;
          width: clamp(45px, 7vw, 90px);
          height: clamp(45px, 7vw, 90px);
          margin: auto auto 8%;
          object-fit: contain;
        }

        .rn-executive-rail-bottom {
          margin-top: auto;
          padding-top: 12%;
          color: #d2dbea;
          font-size: clamp(5px, 0.55vw, 8px);
          line-height: 1.7;
          letter-spacing: 0.08em;
          overflow-wrap: anywhere;
        }

        .rn-executive-main {
          display: flex;
          flex-direction: column;
          min-width: 0;
          min-height: 0;
          padding: 4.7% 6% 3.4%;
        }

        .rn-executive-topline {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          color: #8b6b30;
          font-size: clamp(6px, 0.65vw, 9px);
          font-weight: 800;
          letter-spacing: 0.19em;
          text-transform: uppercase;
        }

        .rn-executive-topline-rule {
          width: 23%;
          height: 2px;
          flex: 0 0 auto;
          background: var(--gold);
        }

        .rn-executive-title {
          margin: 5% 0 0;
          color: var(--navy);
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(23px, 3.1vw, 43px);
          font-weight: 500;
          line-height: 1.08;
          letter-spacing: -0.035em;
        }

        .rn-executive-subtitle {
          margin: 2% 0 0;
          color: var(--muted);
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(8px, 0.9vw, 12px);
          font-style: italic;
        }

        .rn-executive-presented {
          margin: 4.5% 0 1%;
          color: var(--muted);
          font-size: clamp(7px, 0.75vw, 10px);
          letter-spacing: 0.04em;
        }

        .rn-executive-recipient {
          max-width: 100%;
          margin: 0;
          color: var(--navy);
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(25px, 3.5vw, 48px);
          font-weight: 700;
          line-height: 1.08;
          overflow-wrap: anywhere;
        }

        .rn-executive-recipient-rule {
          width: 46%;
          height: 2px;
          margin: 2.2% 0;
          background: linear-gradient(
            90deg,
            var(--gold),
            rgba(198, 160, 82, 0.05)
          );
        }

        .rn-executive-completion {
          margin: 0;
          color: var(--muted);
          font-size: clamp(7px, 0.72vw, 10px);
          line-height: 1.5;
        }

        .rn-executive-course {
          margin: 1.1% 0 0;
          color: var(--navy-light);
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(13px, 1.55vw, 21px);
          font-weight: 700;
          line-height: 1.25;
          overflow-wrap: anywhere;
        }

        .rn-executive-revoked {
          align-self: flex-start;
          margin-top: 7px;
          padding: 4px 9px;
          border: 2px solid #b42318;
          color: #b42318;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.13em;
        }

        .rn-executive-revoked-reason {
          margin: 4px 0;
          color: #b42318;
          font-size: 8px;
          overflow-wrap: anywhere;
        }

        .rn-executive-metrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          margin-top: auto;
          padding: 2.5% 0;
          border-top: 1px solid rgba(198, 160, 82, 0.8);
          border-bottom: 1px solid rgba(198, 160, 82, 0.8);
          background: rgba(255, 255, 255, 0.65);
        }

        .rn-executive-metric {
          min-width: 0;
          padding: 0 7px;
          border-right: 1px solid rgba(11, 30, 58, 0.15);
        }

        .rn-executive-metric:last-child {
          border-right: 0;
        }

        .rn-executive-metric-label {
          display: block;
          margin-bottom: 5px;
          color: var(--muted);
          font-size: clamp(5px, 0.57vw, 8px);
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .rn-executive-metric-value {
          display: block;
          color: var(--navy);
          font-size: clamp(7px, 0.75vw, 10px);
          font-weight: 800;
          line-height: 1.25;
          overflow-wrap: anywhere;
        }

        .rn-executive-number {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
          margin-top: 2%;
          color: var(--muted);
          font-size: clamp(6px, 0.58vw, 8px);
          line-height: 1.4;
        }

        .rn-executive-number strong {
          color: var(--navy);
          letter-spacing: 0.06em;
          overflow-wrap: anywhere;
        }

        .rn-executive-footer {
          display: grid;
          grid-template-columns: 1fr 1fr;
          align-items: end;
          gap: 4%;
          margin-top: 2.2%;
          padding-top: 2%;
          border-top: 1px solid rgba(11, 30, 58, 0.12);
        }

        .rn-executive-signature {
          min-width: 0;
        }

        .rn-executive-signature-image {
          display: block;
          width: auto;
          max-width: 75%;
          height: clamp(23px, 2.6vw, 35px);
          object-fit: contain;
          object-position: left bottom;
        }

        .rn-executive-signature-line {
          width: 75%;
          height: 1px;
          margin: 2px 0 5px;
          background: #9ba7b6;
        }

        .rn-executive-signature strong,
        .rn-executive-verification strong {
          display: block;
          color: var(--navy);
          font-size: clamp(7px, 0.68vw, 9px);
          line-height: 1.3;
        }

        .rn-executive-signature span {
          display: block;
          margin-top: 3px;
          color: var(--muted);
          font-size: clamp(6px, 0.55vw, 8px);
          line-height: 1.3;
        }

        .rn-executive-verification {
          min-width: 0;
        }

        .rn-executive-verification-row {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
        }

        .rn-executive-qr {
          display: block;
          flex: 0 0 auto;
          width: clamp(39px, 4.1vw, 54px);
          height: clamp(39px, 4.1vw, 54px);
          object-fit: contain;
          background: #fff;
        }

        .rn-executive-verify-copy {
          min-width: 0;
          text-align: left;
        }

        .rn-executive-verify-copy span {
          display: block;
          margin-top: 4px;
          color: var(--muted);
          font-size: clamp(5px, 0.5vw, 7px);
          line-height: 1.4;
        }

        .rn-executive-footer-meta {
          margin-top: 4px;
          color: var(--muted);
          font-size: clamp(5px, 0.5vw, 7px);
          line-height: 1.4;
          overflow-wrap: anywhere;
        }

        .rn-executive-footer-meta strong {
          display: inline;
          font-size: inherit;
        }

        .rn-executive-secondary-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 20px;
        }

        .rn-executive-page img {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        @media (max-width: 700px) {
          .rn-executive-page {
            padding: 16px 8px 28px;
          }

          .rn-executive-toolbar {
            align-items: stretch;
          }

          .rn-executive-actions {
            width: 100%;
          }

          .rn-executive-actions .rn-executive-button {
            flex: 1;
          }

          .rn-executive-sheet {
            display: flex;
            flex-direction: column;
            aspect-ratio: auto;
            min-height: 850px;
          }

          .rn-executive-rail {
            flex: 0 0 auto;
            min-height: 240px;
            padding: 28px 20px;
          }

          .rn-executive-logo {
            max-width: 180px;
            max-height: 85px;
            margin-bottom: 12px;
          }

          .rn-executive-brand-name {
            font-size: 13px;
          }

          .rn-executive-brand-tagline {
            font-size: 7px;
          }

          .rn-executive-rail-divider {
            margin: 14px auto;
          }

          .rn-executive-rail-caption {
            font-size: 8px;
          }

          .rn-executive-rail-description {
            margin-top: 10px;
            font-size: 16px;
          }

          .rn-executive-rail-seal {
            display: none;
          }

          .rn-executive-rail-bottom {
            margin-top: 18px;
            padding-top: 0;
            font-size: 7px;
          }

          .rn-executive-main {
            flex: 1;
            padding: 26px 23px 24px;
          }

          .rn-executive-topline {
            font-size: 7px;
            letter-spacing: 0.12em;
          }

          .rn-executive-title {
            margin-top: 25px;
            font-size: 29px;
          }

          .rn-executive-subtitle {
            margin-top: 9px;
            font-size: 11px;
          }

          .rn-executive-presented {
            margin-top: 28px;
            font-size: 9px;
          }

          .rn-executive-recipient {
            font-size: 32px;
          }

          .rn-executive-course {
            margin-top: 8px;
            font-size: 18px;
          }

          .rn-executive-metrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            row-gap: 14px;
            margin-top: 30px;
            padding: 16px 0;
          }

          .rn-executive-metric {
            padding: 0 9px;
          }

          .rn-executive-metric:nth-child(2) {
            border-right: 0;
          }

          .rn-executive-metric-label {
            font-size: 7px;
          }

          .rn-executive-metric-value {
            font-size: 10px;
          }

          .rn-executive-number {
            margin-top: 13px;
            font-size: 8px;
          }

          .rn-executive-footer {
            margin-top: 22px;
            padding-top: 15px;
            gap: 12px;
          }

          .rn-executive-signature strong,
          .rn-executive-verification strong {
            font-size: 9px;
          }

          .rn-executive-signature span {
            font-size: 8px;
          }

          .rn-executive-qr {
            width: 48px;
            height: 48px;
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

          .rn-executive-page,
          .rn-executive-page * {
            visibility: visible !important;
          }

          .rn-executive-page {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 297mm !important;
            height: 210mm !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            background: #fff !important;
          }

          .rn-executive-container {
            width: 297mm !important;
            max-width: none !important;
            height: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .rn-executive-toolbar,
          .rn-executive-secondary-actions,
          .no-print {
            display: none !important;
          }

          .rn-executive-sheet {
            display: grid !important;
            grid-template-columns: 28% minmax(0, 72%) !important;
            width: 297mm !important;
            height: 210mm !important;
            min-height: 0 !important;
            max-height: 210mm !important;
            aspect-ratio: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            box-shadow: none !important;
            border: 0 !important;
            break-before: avoid-page !important;
            break-after: avoid-page !important;
            break-inside: avoid-page !important;
            page-break-before: avoid !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
          }

          .rn-executive-background {
            display: block !important;
            width: 100% !important;
            height: 100% !important;
            object-fit: fill !important;
          }

          .rn-executive-overlay {
            background: rgba(255, 255, 255, 0.72) !important;
          }

          .rn-executive-rail {
            min-width: 0 !important;
            padding: 10mm 6mm 7mm !important;
            overflow: hidden !important;
            background: linear-gradient(
              155deg,
              #0b1e3a,
              #102a4d 56%,
              #17375e
            ) !important;
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }

          .rn-executive-rail::before {
            inset: 3mm !important;
          }

          .rn-executive-logo {
            width: 100% !important;
            max-width: 48mm !important;
            height: 22mm !important;
            max-height: 22mm !important;
            margin: 0 auto 3mm !important;
            object-fit: contain !important;
          }

          .rn-executive-brand-name {
            font-size: 9pt !important;
            letter-spacing: 0.15em !important;
          }

          .rn-executive-brand-tagline {
            margin-top: 1.5mm !important;
            font-size: 5pt !important;
          }

          .rn-executive-rail-divider {
            margin: 7mm auto !important;
          }

          .rn-executive-rail-caption {
            font-size: 6pt !important;
          }

          .rn-executive-rail-description {
            margin-top: 4mm !important;
            font-size: 13pt !important;
            line-height: 1.5 !important;
          }

          .rn-executive-rail-seal {
            width: 22mm !important;
            height: 22mm !important;
            margin-bottom: auto !important;
          }

          .rn-executive-rail-bottom {
            margin-top: auto !important;
            padding-top: 4mm !important;
            font-size: 5pt !important;
          }

          .rn-executive-main {
            min-height: 0 !important;
            padding: 9mm 12mm 6mm !important;
            overflow: hidden !important;
          }

          .rn-executive-topline {
            flex: 0 0 auto !important;
            font-size: 6pt !important;
            letter-spacing: 0.15em !important;
          }

          .rn-executive-title {
            margin-top: 8mm !important;
            font-size: 25pt !important;
            line-height: 1.05 !important;
          }

          .rn-executive-subtitle {
            margin-top: 2mm !important;
            font-size: 8pt !important;
          }

          .rn-executive-presented {
            margin-top: 8mm !important;
            margin-bottom: 1.5mm !important;
            font-size: 7pt !important;
          }

          .rn-executive-recipient {
            font-size: 29pt !important;
            line-height: 1.05 !important;
          }

          .rn-executive-recipient-rule {
            margin: 2mm 0 !important;
          }

          .rn-executive-completion {
            font-size: 7pt !important;
          }

          .rn-executive-course {
            margin-top: 1.5mm !important;
            font-size: 14pt !important;
            line-height: 1.15 !important;
          }

          .rn-executive-revoked {
            margin-top: 2mm !important;
            padding: 1mm 3mm !important;
            font-size: 7pt !important;
          }

          .rn-executive-revoked-reason {
            margin: 1mm 0 !important;
            font-size: 6pt !important;
          }

          .rn-executive-metrics {
            flex: 0 0 13mm !important;
            min-height: 13mm !important;
            margin-top: auto !important;
            padding: 1.5mm 0 !important;
            background: rgba(255, 255, 255, 0.72) !important;
          }

          .rn-executive-metric {
            padding: 0 2mm !important;
          }

          .rn-executive-metric-label {
            margin-bottom: 1mm !important;
            font-size: 5.5pt !important;
          }

          .rn-executive-metric-value {
            font-size: 7pt !important;
          }

          .rn-executive-number {
            flex: 0 0 auto !important;
            margin-top: 1.5mm !important;
            font-size: 6pt !important;
          }

          .rn-executive-footer {
            flex: 0 0 27mm !important;
            min-height: 27mm !important;
            max-height: 27mm !important;
            margin-top: 2mm !important;
            padding-top: 2mm !important;
            gap: 3mm !important;
          }

          .rn-executive-signature-image {
            height: 8mm !important;
            max-height: 8mm !important;
          }

          .rn-executive-signature-line {
            margin: 0.5mm 0 1mm !important;
          }

          .rn-executive-signature strong,
          .rn-executive-verification strong {
            font-size: 6.5pt !important;
          }

          .rn-executive-signature span {
            margin-top: 0.5mm !important;
            font-size: 5.5pt !important;
          }

          .rn-executive-verification-row {
            gap: 2mm !important;
          }

          .rn-executive-qr {
            width: 13mm !important;
            height: 13mm !important;
          }

          .rn-executive-verify-copy span {
            margin-top: 0.8mm !important;
            font-size: 5pt !important;
          }

          .rn-executive-footer-meta {
            margin-top: 0.8mm !important;
            font-size: 5pt !important;
          }

          .rn-executive-page img {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <div className="rn-executive-container">
        <div className="rn-executive-toolbar">
          <Link
            href="/student/certificates"
            className="rn-executive-back"
          >
            ← My Certificates
          </Link>

          <div className="rn-executive-actions">
            <Link
              href={verificationPath}
              className="rn-executive-button"
            >
              Verify Certificate
            </Link>

            {!certificate.is_revoked && (
              <CertificatePrintButton />
            )}
          </div>
        </div>

        <article className="rn-executive-sheet">
          <img
            src="/brand/ruffneck-border-background.png"
            alt=""
            aria-hidden="true"
            className="rn-executive-background"
          />

          <div
            className="rn-executive-overlay"
            aria-hidden="true"
          />

          <aside className="rn-executive-rail">
            <div className="rn-executive-rail-brand">
              <img
                src="/brand/ruffneck-logo.png"
                alt="RuffNeck Entertainment"
                className="rn-executive-logo"
              />

              <p className="rn-executive-brand-name">
                RUFFNECK LEARN
              </p>

              <div className="rn-executive-brand-tagline">
                AI • Digital Transformation
                <br />
                Business Solutions
              </div>
            </div>

            <div
              className="rn-executive-rail-divider"
              aria-hidden="true"
            />

            <p className="rn-executive-rail-caption">
              Professional
              <br />
              Learning Credential
            </p>

            <p className="rn-executive-rail-description">
              Skills.
              <br />
              Knowledge.
              <br />
              Achievement.
            </p>

            <img
              src="/brand/ruffneck-certificate-seal.png"
              alt="RuffNeck certificate seal"
              className="rn-executive-rail-seal"
            />

            <div className="rn-executive-rail-bottom">
              RUFFNECK ENTERTAINMENT
              <br />
              PROFESSIONAL LEARNING &amp; DIGITAL SKILLS
            </div>
          </aside>

          <section className="rn-executive-main">
            <div className="rn-executive-topline">
              <span>Official Certificate</span>
              <span
                className="rn-executive-topline-rule"
                aria-hidden="true"
              />
            </div>

            <h1 className="rn-executive-title">
              Certificate of
              <br />
              Completion
            </h1>

            <p className="rn-executive-subtitle">
              Awarded in recognition of successful course completion
            </p>

            {certificate.is_revoked && (
              <div className="rn-executive-revoked" role="alert">
                REVOKED
              </div>
            )}

            <p className="rn-executive-presented">
              THIS CERTIFICATE IS PRESENTED TO
            </p>

            <h2 className="rn-executive-recipient">
              {certificate.holder_name}
            </h2>

            <div
              className="rn-executive-recipient-rule"
              aria-hidden="true"
            />

            <p className="rn-executive-completion">
              For successfully completing the professional course
            </p>

            <h3 className="rn-executive-course">
              {certificate.course_title}
            </h3>

            {certificate.is_revoked &&
              certificate.revoked_reason && (
                <p className="rn-executive-revoked-reason">
                  Reason: {certificate.revoked_reason}
                </p>
              )}

            <section
              className="rn-executive-metrics"
              aria-label="Certificate details"
            >
              <div className="rn-executive-metric">
                <span className="rn-executive-metric-label">
                  Date Issued
                </span>
                <strong className="rn-executive-metric-value">
                  {formatDate(certificate.issued_at)}
                </strong>
              </div>

              <div className="rn-executive-metric">
                <span className="rn-executive-metric-label">
                  Assessment
                </span>
                <strong className="rn-executive-metric-value">
                  {certificate.assessment_score ?? "—"}%
                </strong>
              </div>

              <div className="rn-executive-metric">
                <span className="rn-executive-metric-label">
                  Capstone
                </span>
                <strong className="rn-executive-metric-value">
                  {certificate.capstone_score ?? "—"}/100
                </strong>
              </div>

              <div className="rn-executive-metric">
                <span className="rn-executive-metric-label">
                  Credential
                </span>
                <strong className="rn-executive-metric-value">
                  Completion
                </strong>
              </div>
            </section>

            <div className="rn-executive-number">
              <span>Certificate ID:</span>
              <strong>{certificate.certificate_number}</strong>
            </div>

            <footer className="rn-executive-footer">
              <div className="rn-executive-signature">
                <img
                  src="/brand/founder-signature.png"
                  alt="Hassan Zakariya signature"
                  className="rn-executive-signature-image"
                />

                <div
                  className="rn-executive-signature-line"
                  aria-hidden="true"
                />

                <strong>Hassan Zakariya</strong>
                <span>Founder &amp; CEO</span>
                <span>RuffNeck Entertainment</span>
              </div>

              <div className="rn-executive-verification">
                {!certificate.is_revoked && (
                  <div className="rn-executive-verification-row">
                    <img
                      src={qrCodeUrl}
                      alt={`QR code for certificate ${certificate.certificate_number}`}
                      width={150}
                      height={150}
                      className="rn-executive-qr"
                    />

                    <div className="rn-executive-verify-copy">
                      <strong>VERIFY ONLINE</strong>
                      <span>
                        Scan the QR code to verify authenticity.
                      </span>
                    </div>
                  </div>
                )}

                <div className="rn-executive-footer-meta">
                  <strong>
                    {certificate.certificate_number}
                  </strong>
                  <br />
                  Issued {formatDate(certificate.issued_at)}
                  <br />
                  RUFFNECK LEARN
                </div>
              </div>
            </footer>
          </section>
        </article>

        {!certificate.is_revoked && (
          <div style={{ marginTop: 20 }}>
            <CertificateVerificationLink
              certificateNumber={certificate.certificate_number}
            />
          </div>
        )}

        <div className="rn-executive-secondary-actions">
          <Link
            href="/student/certificates"
            className="rn-executive-button"
          >
            All Certificates
          </Link>

          <Link
            href="/courses"
            className="rn-executive-button"
          >
            Browse Courses
          </Link>
        </div>
      </div>
    </main>
  );
}