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

  return `https://api.qrserver.com/v1/create-qr-code/?size=400x400&format=png&margin=8&data=${encodeURIComponent(
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
    <main className="rn-cert">
      <style>{`
        .rn-cert {
          --navy: #132b49;
          --ink: #24364b;
          --gold: #b18a45;
          --muted: #697789;

          min-height: 100vh;
          padding: 28px 22px 44px;
          color: var(--ink);
          background: #f2f4f7;
        }

        .rn-cert *,
        .rn-cert *::before,
        .rn-cert *::after {
          box-sizing: border-box;
        }

        .rn-cert .cert-shell {
          width: 100%;
          max-width: 1400px;
          margin: 0 auto;
        }

        .rn-cert .cert-toolbar,
        .rn-cert .cert-actions,
        .rn-cert .cert-bottom-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
        }

        .rn-cert .cert-toolbar {
          margin-bottom: 20px;
        }

        .rn-cert .cert-actions {
          justify-content: flex-end;
        }

        .rn-cert .cert-back {
          color: var(--navy);
          font-size: 14px;
          font-weight: 750;
          text-decoration: none;
        }

        .rn-cert .cert-paper {
          position: relative;
          isolation: isolate;
          width: 100%;
          aspect-ratio: 297 / 210;
          overflow: hidden;
          color: var(--ink);
          background: #fffefa;
          border: 1px solid #d5c08e;
          box-shadow: 0 18px 55px rgba(19, 43, 73, 0.1);
        }

        /*
         * The border image remains visible around the perimeter.
         * A white interior layer prevents the artwork from
         * overwhelming the text.
         */

        .rn-cert .cert-border {
          position: absolute;
          z-index: 0;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: fill;
          pointer-events: none;
        }

        .rn-cert .cert-interior {
          position: absolute;
          z-index: 1;
          inset: 4.5%;
          background: rgba(255, 254, 250, 0.93);
          border: 1px solid rgba(177, 138, 69, 0.35);
          pointer-events: none;
        }

        /*
         * Use the transparent RuffNeck artwork as the central
         * watermark, rather than as a full-page background.
         */

        .rn-cert .cert-watermark {
          position: absolute;
          z-index: 2;
          top: 27%;
          left: 29%;
          width: 42%;
          height: 44%;
          object-fit: contain;
          opacity: 0.075;
          pointer-events: none;
        }

        .rn-cert .cert-content {
          position: absolute;
          z-index: 3;
          inset: 8% 9%;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr) auto;
          min-width: 0;
          min-height: 0;
        }

        .rn-cert .cert-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 22px;
          padding-bottom: 2%;
          border-bottom: 1px solid rgba(177, 138, 69, 0.65);
        }

        .rn-cert .cert-brand {
          display: flex;
          align-items: center;
          gap: 18px;
          min-width: 0;
        }

        .rn-cert .cert-logo {
          display: block;
          width: clamp(150px, 19vw, 245px);
          max-height: 76px;
          height: auto;
          object-fit: contain;
          flex: 0 1 auto;
        }

        .rn-cert .cert-brand-copy {
          min-width: 0;
        }

        .rn-cert .cert-brand-name {
          margin: 0;
          color: var(--navy);
          font-size: clamp(16px, 1.5vw, 23px);
          font-weight: 900;
          letter-spacing: 0.12em;
          line-height: 1.2;
        }

        .rn-cert .cert-tagline {
          margin-top: 6px;
          color: #82662f;
          font-size: clamp(8px, 0.7vw, 10px);
          font-weight: 750;
          letter-spacing: 0.06em;
          line-height: 1.4;
          text-transform: uppercase;
        }

        .rn-cert .cert-classification {
          flex: 0 0 auto;
          padding-left: 16px;
          border-left: 2px solid var(--gold);
          text-align: right;
        }

        .rn-cert .cert-classification strong {
          display: block;
          color: var(--navy);
          font-size: clamp(8px, 0.75vw, 11px);
          letter-spacing: 0.1em;
          line-height: 1.5;
          text-transform: uppercase;
        }

        .rn-cert .cert-classification span {
          display: block;
          margin-top: 4px;
          color: var(--muted);
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(9px, 0.75vw, 11px);
          font-style: italic;
        }

        .rn-cert .cert-main {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 22%;
          align-items: center;
          gap: 5%;
          min-width: 0;
          min-height: 0;
          padding: 2.5% 0;
        }

        .rn-cert .cert-copy {
          min-width: 0;
        }

        .rn-cert .cert-eyebrow {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 0 0 9px;
          color: #8b692f;
          font-size: clamp(8px, 0.75vw, 11px);
          font-weight: 900;
          letter-spacing: 0.2em;
          text-transform: uppercase;
        }

        .rn-cert .cert-eyebrow::before {
          width: 27px;
          height: 2px;
          background: var(--gold);
          content: "";
          flex: 0 0 auto;
        }

        .rn-cert .cert-title {
          margin: 0;
          color: var(--navy);
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(31px, 3.2vw, 47px);
          font-weight: 500;
          letter-spacing: -0.035em;
          line-height: 1.04;
        }

        .rn-cert .cert-presented {
          margin: 2.5% 0 0.6%;
          color: var(--muted);
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(11px, 0.95vw, 14px);
          font-style: italic;
        }

        .rn-cert .cert-recipient {
          margin: 0;
          color: #173b60;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(30px, 3.5vw, 52px);
          font-weight: 700;
          letter-spacing: -0.025em;
          line-height: 1.08;
          overflow-wrap: anywhere;
          text-wrap: balance;
        }

        .rn-cert .cert-recipient-rule {
          width: 45%;
          height: 2px;
          margin-top: 1.5%;
          background: linear-gradient(
            90deg,
            var(--gold),
            rgba(177, 138, 69, 0.1)
          );
        }

        .rn-cert .cert-completion {
          margin: 1.6% 0 0.5%;
          color: #586779;
          font-size: clamp(9px, 0.83vw, 12px);
          line-height: 1.45;
        }

        .rn-cert .cert-course {
          margin: 0;
          color: var(--navy);
          font-size: clamp(15px, 1.5vw, 22px);
          font-weight: 850;
          line-height: 1.25;
          overflow-wrap: anywhere;
          text-wrap: balance;
        }

        .rn-cert .cert-record {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 16px;
          align-self: stretch;
          min-width: 0;
          padding: 5% 0 5% 12%;
          border-left: 1px solid rgba(177, 138, 69, 0.65);
        }

        .rn-cert .cert-record-heading {
          margin: 0;
          color: #8b692f;
          font-size: clamp(8px, 0.7vw, 10px);
          font-weight: 900;
          letter-spacing: 0.13em;
          line-height: 1.4;
          text-transform: uppercase;
        }

        .rn-cert .cert-record-label {
          display: block;
          margin-bottom: 4px;
          color: var(--muted);
          font-size: clamp(8px, 0.67vw, 10px);
          line-height: 1.3;
        }

        .rn-cert .cert-record-value {
          display: block;
          color: var(--navy);
          font-size: clamp(11px, 0.95vw, 14px);
          font-weight: 850;
          line-height: 1.3;
          overflow-wrap: anywhere;
        }

        .rn-cert .cert-record-rule {
          width: 30px;
          height: 2px;
          background: var(--gold);
        }

        .rn-cert .cert-revoked {
          display: inline-block;
          margin-top: 10px;
          padding: 6px 10px;
          border: 1px solid #b91c1c;
          background: #fff1f2;
          color: #991b1b;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.12em;
        }

        .rn-cert .cert-footer {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
          align-items: center;
          gap: 18px;
          min-width: 0;
          padding-top: 2%;
          border-top: 1px solid rgba(177, 138, 69, 0.65);
        }

        .rn-cert .cert-signatory {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          min-width: 0;
        }

        .rn-cert .cert-signature {
          display: block;
          width: auto;
          max-width: 145px;
          height: 34px;
          object-fit: contain;
          object-position: left bottom;
        }

        .rn-cert .cert-signature-line {
          width: 100%;
          max-width: 180px;
          margin: 3px 0 5px;
          border-top: 1px solid #a18a5e;
        }

        .rn-cert .cert-signatory-name {
          color: var(--navy);
          font-size: clamp(9px, 0.8vw, 12px);
          font-weight: 900;
          line-height: 1.3;
        }

        .rn-cert .cert-signatory-role {
          margin-top: 3px;
          color: var(--muted);
          font-size: clamp(7px, 0.62vw, 9px);
          line-height: 1.35;
        }

        .rn-cert .cert-seals {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
        }

        .rn-cert .cert-seal {
          display: block;
          width: clamp(45px, 5vw, 70px);
          height: clamp(45px, 5vw, 70px);
          object-fit: contain;
        }

        .rn-cert .cert-stamp {
          display: block;
          width: clamp(40px, 4.3vw, 60px);
          height: clamp(40px, 4.3vw, 60px);
          object-fit: contain;
        }

        .rn-cert .cert-verification {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          min-width: 0;
        }

        .rn-cert .cert-qr {
          display: block;
          flex: 0 0 auto;
          width: clamp(55px, 5.5vw, 76px);
          height: clamp(55px, 5.5vw, 76px);
          padding: 3px;
          border: 1px solid #d1b477;
          background: #fff;
          object-fit: contain;
        }

        .rn-cert .cert-verify-copy {
          min-width: 0;
        }

        .rn-cert .cert-verify-title {
          display: block;
          margin-bottom: 4px;
          color: var(--navy);
          font-size: clamp(8px, 0.7vw, 10px);
          font-weight: 900;
          letter-spacing: 0.07em;
        }

        .rn-cert .cert-verify-description {
          margin: 0;
          color: var(--muted);
          font-size: clamp(7px, 0.6vw, 9px);
          line-height: 1.4;
        }

        .rn-cert .cert-number {
          margin-top: 5px;
          color: #82662f;
          font-size: clamp(7px, 0.6vw, 9px);
          font-weight: 850;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }

        .rn-cert .cert-revoked-note {
          margin-top: 12px;
          padding: 12px 14px;
          border: 1px solid #fecaca;
          background: #fff1f2;
          color: #991b1b;
          font-size: 13px;
          line-height: 1.5;
        }

        .rn-cert .cert-bottom-actions {
          margin-top: 20px;
        }

        @media screen and (max-width: 760px) {
          .rn-cert {
            padding: 16px 10px 28px;
          }

          .rn-cert .cert-toolbar {
            align-items: flex-start;
          }

          .rn-cert .cert-actions {
            justify-content: flex-start;
          }

          .rn-cert .cert-paper {
            aspect-ratio: auto;
          }

          .rn-cert .cert-border {
            object-fit: cover;
          }

          .rn-cert .cert-interior {
            inset: 12px;
          }

          .rn-cert .cert-watermark {
            top: 34%;
            left: 15%;
            width: 70%;
            height: 28%;
            opacity: 0.055;
          }

          .rn-cert .cert-content {
            position: relative;
            inset: auto;
            display: flex;
            flex-direction: column;
            gap: 24px;
            padding: 30px 8%;
          }

          .rn-cert .cert-header {
            flex-direction: column;
            gap: 15px;
            padding-bottom: 18px;
          }

          .rn-cert .cert-brand {
            flex-direction: column;
            gap: 10px;
            width: 100%;
          }

          .rn-cert .cert-logo {
            width: min(100%, 220px);
            max-height: 80px;
            object-position: center;
          }

          .rn-cert .cert-brand-copy {
            text-align: center;
          }

          .rn-cert .cert-brand-name {
            font-size: 19px;
          }

          .rn-cert .cert-tagline {
            font-size: 9px;
          }

          .rn-cert .cert-classification {
            padding: 0;
            border: 0;
            text-align: center;
          }

          .rn-cert .cert-classification strong {
            font-size: 10px;
          }

          .rn-cert .cert-classification span {
            font-size: 10px;
          }

          .rn-cert .cert-main {
            display: flex;
            flex-direction: column;
            align-items: stretch;
            gap: 24px;
            padding: 0;
          }

          .rn-cert .cert-eyebrow {
            font-size: 9px;
          }

          .rn-cert .cert-title {
            font-size: clamp(29px, 8vw, 41px);
          }

          .rn-cert .cert-presented {
            margin-top: 18px;
            font-size: 12px;
          }

          .rn-cert .cert-recipient {
            font-size: clamp(29px, 8vw, 42px);
          }

          .rn-cert .cert-completion {
            margin-top: 15px;
            font-size: 11px;
          }

          .rn-cert .cert-course {
            font-size: clamp(17px, 5vw, 25px);
          }

          .rn-cert .cert-record {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 17px 12px;
            padding: 20px 0;
            border-top: 1px solid rgba(177, 138, 69, 0.65);
            border-right: 0;
            border-bottom: 1px solid rgba(177, 138, 69, 0.65);
            border-left: 0;
          }

          .rn-cert .cert-record-heading {
            grid-column: 1 / -1;
            font-size: 10px;
          }

          .rn-cert .cert-record-label {
            font-size: 10px;
          }

          .rn-cert .cert-record-value {
            font-size: 13px;
          }

          .rn-cert .cert-footer {
            grid-template-columns: minmax(0, 1fr);
            gap: 22px;
            padding-top: 22px;
          }

          .rn-cert .cert-signatory {
            align-items: center;
            text-align: center;
          }

          .rn-cert .cert-signature-line {
            margin-right: auto;
            margin-left: auto;
          }

          .rn-cert .cert-seals {
            gap: 12px;
          }

          .rn-cert .cert-seal {
            width: 64px;
            height: 64px;
          }

          .rn-cert .cert-stamp {
            width: 56px;
            height: 56px;
          }

          .rn-cert .cert-verification {
            justify-content: center;
          }

          .rn-cert .cert-qr {
            width: 76px;
            height: 76px;
          }

          .rn-cert .cert-verify-title {
            font-size: 10px;
          }

          .rn-cert .cert-verify-description,
          .rn-cert .cert-number {
            font-size: 9px;
          }

          .rn-cert .cert-bottom-actions {
            justify-content: flex-start;
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

          .rn-cert,
          .rn-cert * {
            visibility: visible !important;
          }

          .rn-cert {
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

          .rn-cert .cert-shell {
            width: 297mm !important;
            max-width: none !important;
            height: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .rn-cert .cert-toolbar,
          .rn-cert .cert-bottom-actions,
          .rn-cert .no-print {
            display: none !important;
          }

          .rn-cert .cert-paper {
            position: relative !important;
            width: 297mm !important;
            height: 210mm !important;
            max-height: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            aspect-ratio: auto !important;
            overflow: hidden !important;
            border: 0 !important;
            box-shadow: none !important;
            break-before: avoid-page !important;
            break-after: avoid-page !important;
            break-inside: avoid-page !important;
            page-break-before: avoid !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
          }

          .rn-cert .cert-border {
            position: absolute !important;
            z-index: 0 !important;
            inset: 0 !important;
            width: 297mm !important;
            height: 210mm !important;
            object-fit: fill !important;
            opacity: 1 !important;
          }

          .rn-cert .cert-interior {
            position: absolute !important;
            z-index: 1 !important;
            inset: 4.5% !important;
            background: rgba(255, 254, 250, 0.93) !important;
            border: 1px solid rgba(177, 138, 69, 0.35) !important;
          }

          .rn-cert .cert-watermark {
            position: absolute !important;
            z-index: 2 !important;
            top: 27% !important;
            left: 29% !important;
            width: 42% !important;
            height: 44% !important;
            opacity: 0.075 !important;
          }

          .rn-cert .cert-content {
            position: absolute !important;
            z-index: 3 !important;
            inset: 16mm 21mm !important;
            display: grid !important;
            grid-template-rows: 24mm minmax(0, 1fr) 31mm !important;
            width: auto !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            gap: 0 !important;
            overflow: hidden !important;
          }

          .rn-cert .cert-header {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 5mm !important;
            padding-bottom: 3mm !important;
          }

          .rn-cert .cert-brand {
            flex-direction: row !important;
            gap: 5mm !important;
          }

          .rn-cert .cert-logo {
            width: 46mm !important;
            max-width: 46mm !important;
            height: 17mm !important;
            max-height: 17mm !important;
            object-fit: contain !important;
          }

          .rn-cert .cert-brand-name {
            font-size: 15pt !important;
            line-height: 1.1 !important;
          }

          .rn-cert .cert-tagline {
            margin-top: 1.3mm !important;
            font-size: 6.5pt !important;
            line-height: 1.25 !important;
          }

          .rn-cert .cert-classification {
            padding-left: 4mm !important;
            border-left: 0.5mm solid var(--gold) !important;
            text-align: right !important;
          }

          .rn-cert .cert-classification strong,
          .rn-cert .cert-classification span {
            font-size: 7pt !important;
            line-height: 1.3 !important;
          }

          .rn-cert .cert-classification span {
            margin-top: 1mm !important;
          }

          .rn-cert .cert-main {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) 48mm !important;
            align-items: center !important;
            gap: 8mm !important;
            min-height: 0 !important;
            padding: 3mm 0 !important;
            overflow: hidden !important;
          }

          .rn-cert .cert-copy {
            min-width: 0 !important;
            max-height: 100% !important;
            overflow: hidden !important;
          }

          .rn-cert .cert-eyebrow {
            gap: 2mm !important;
            margin: 0 0 2mm !important;
            font-size: 7pt !important;
            line-height: 1.2 !important;
          }

          .rn-cert .cert-eyebrow::before {
            width: 6mm !important;
            height: 0.5mm !important;
          }

          .rn-cert .cert-title {
            font-size: 27pt !important;
            line-height: 1.04 !important;
          }

          .rn-cert .cert-presented {
            margin: 2.5mm 0 1mm !important;
            font-size: 9pt !important;
            line-height: 1.2 !important;
          }

          .rn-cert .cert-recipient {
            font-size: 32pt !important;
            line-height: 1.08 !important;
          }

          .rn-cert .cert-recipient-rule {
            width: 58mm !important;
            height: 0.5mm !important;
            margin-top: 2mm !important;
          }

          .rn-cert .cert-completion {
            margin: 2mm 0 1mm !important;
            font-size: 8pt !important;
            line-height: 1.2 !important;
          }

          .rn-cert .cert-course {
            font-size: 14pt !important;
            line-height: 1.2 !important;
          }

          .rn-cert .cert-revoked {
            margin-top: 2mm !important;
            padding: 1mm 3mm !important;
            font-size: 7pt !important;
          }

          .rn-cert .cert-record {
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            gap: 3mm !important;
            padding: 3mm 0 3mm 5mm !important;
            border-top: 0 !important;
            border-right: 0 !important;
            border-bottom: 0 !important;
            border-left: 0.3mm solid rgba(177, 138, 69, 0.65) !important;
            overflow: hidden !important;
          }

          .rn-cert .cert-record-heading {
            font-size: 6.5pt !important;
          }

          .rn-cert .cert-record-label {
            margin-bottom: 0.8mm !important;
            font-size: 7pt !important;
          }

          .rn-cert .cert-record-value {
            font-size: 9pt !important;
            line-height: 1.25 !important;
          }

          .rn-cert .cert-record-rule {
            width: 8mm !important;
            height: 0.5mm !important;
          }

          .rn-cert .cert-footer {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) !important;
            align-items: center !important;
            gap: 4mm !important;
            padding-top: 2.5mm !important;
            overflow: hidden !important;
          }

          .rn-cert .cert-signatory {
            align-items: flex-start !important;
            text-align: left !important;
          }

          .rn-cert .cert-signature {
            max-width: 36mm !important;
            height: 8mm !important;
            object-position: left bottom !important;
          }

          .rn-cert .cert-signature-line {
            width: 48mm !important;
            max-width: 48mm !important;
            margin: 0.8mm 0 1mm !important;
          }

          .rn-cert .cert-signatory-name {
            font-size: 8pt !important;
          }

          .rn-cert .cert-signatory-role {
            font-size: 6.5pt !important;
          }

          .rn-cert .cert-seals {
            gap: 2mm !important;
          }

          .rn-cert .cert-seal {
            width: 17mm !important;
            height: 17mm !important;
          }

          .rn-cert .cert-stamp {
            width: 15mm !important;
            height: 15mm !important;
          }

          .rn-cert .cert-verification {
            gap: 2mm !important;
          }

          .rn-cert .cert-qr {
            width: 17mm !important;
            height: 17mm !important;
            padding: 0.6mm !important;
          }

          .rn-cert .cert-verify-title {
            margin-bottom: 0.8mm !important;
            font-size: 6.5pt !important;
          }

          .rn-cert .cert-verify-description {
            font-size: 6pt !important;
            line-height: 1.25 !important;
          }

          .rn-cert .cert-number {
            margin-top: 1mm !important;
            font-size: 5.5pt !important;
            line-height: 1.2 !important;
          }

          .rn-cert .cert-revoked-note {
            margin-top: 2mm !important;
            padding: 2mm !important;
            font-size: 8pt !important;
          }

          .rn-cert img {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <div className="cert-shell">
        <nav className="cert-toolbar no-print" aria-label="Certificate actions">
          <Link href="/student/certificates" className="cert-back">
            ← My Certificates
          </Link>

          <div className="cert-actions">
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
          className="cert-paper"
          aria-label="RuffNeck Learn certificate of completion"
        >
          <img
            src="/brand/ruffneck-border-background.png"
            alt=""
            aria-hidden="true"
            className="cert-border"
          />

          <div className="cert-interior" aria-hidden="true" />

          <img
            src="/brand/transparent-ruffneck-background.png"
            alt=""
            aria-hidden="true"
            className="cert-watermark"
          />

          <div className="cert-content">
            <header className="cert-header">
              <div className="cert-brand">
                <img
                  src="/brand/ruffneck-logo.png"
                  alt="RuffNeck Entertainment"
                  className="cert-logo"
                />

                <div className="cert-brand-copy">
                  <p className="cert-brand-name">RUFFNECK LEARN</p>
                  <div className="cert-tagline">
                    AI • Digital Transformation • Business Solutions
                  </div>
                </div>
              </div>

              <div className="cert-classification">
                <strong>Professional Credential</strong>
                <span>Certificate of Achievement</span>
              </div>
            </header>

            <section className="cert-main">
              <div className="cert-copy">
                <p className="cert-eyebrow">Learning Achievement</p>

                <h1 className="cert-title">
                  Certificate
                  <br />
                  of Completion
                </h1>

                {isRevoked && (
                  <div className="cert-revoked" role="alert">
                    REVOKED
                  </div>
                )}

                <p className="cert-presented">
                  This certificate is awarded to
                </p>

                <h2 className="cert-recipient">{certificate.holder_name}</h2>

                <div className="cert-recipient-rule" aria-hidden="true" />

                <p className="cert-completion">
                  In recognition of successfully completing
                </p>

                <h3 className="cert-course">{certificate.course_title}</h3>
              </div>

              <aside className="cert-record">
                <p className="cert-record-heading">Credential Record</p>

                <div>
                  <span className="cert-record-label">Date issued</span>
                  <strong className="cert-record-value">
                    {formatDate(certificate.issued_at)}
                  </strong>
                </div>

                <div className="cert-record-rule" aria-hidden="true" />

                <div>
                  <span className="cert-record-label">Assessment score</span>
                  <strong className="cert-record-value">
                    {certificate.assessment_score == null
                      ? "—"
                      : `${certificate.assessment_score}%`}
                  </strong>
                </div>

                <div>
                  <span className="cert-record-label">Capstone score</span>
                  <strong className="cert-record-value">
                    {certificate.capstone_score == null
                      ? "—"
                      : `${certificate.capstone_score}/100`}
                  </strong>
                </div>
              </aside>
            </section>

            {!isRevoked ? (
              <footer className="cert-footer">
                <div className="cert-signatory">
                  <img
                    src="/brand/founder-signature.png"
                    alt="Hassan Zakariya signature"
                    className="cert-signature"
                  />

                  <div className="cert-signature-line" aria-hidden="true" />

                  <strong className="cert-signatory-name">
                    Hassan Zakariya
                  </strong>

                  <span className="cert-signatory-role">
                    Founder &amp; CEO · RuffNeck Entertainment
                  </span>
                </div>

                <div className="cert-seals">
                  <img
                    src="/brand/ruffneck-certificate-seal.png"
                    alt="RuffNeck certificate seal"
                    className="cert-seal"
                  />

                  <img
                    src="/brand/ruffneck-company-stamp.png"
                    alt="RuffNeck company stamp"
                    className="cert-stamp"
                  />

                  <img
                    src="/brand/ruffneck-security-stamp.png"
                    alt="RuffNeck security stamp"
                    className="cert-stamp"
                  />
                </div>

                <div className="cert-verification">
                  <img
                    src={qrCodeUrl(certificate.certificate_number)}
                    alt={`QR code for certificate ${certificate.certificate_number}`}
                    width={400}
                    height={400}
                    className="cert-qr"
                  />

                  <div className="cert-verify-copy">
                    <strong className="cert-verify-title">
                      VERIFY CREDENTIAL
                    </strong>

                    <p className="cert-verify-description">
                      Scan to check the
                      <br />
                      official certificate record.
                    </p>

                    <div className="cert-number">
                      No. {certificate.certificate_number}
                    </div>
                  </div>
                </div>
              </footer>
            ) : (
              <div className="cert-revoked-note" role="alert">
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

        <div className="cert-bottom-actions no-print">
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