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

  if (!certificateId?.trim()) {
    notFound();
  }

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

  if (!data) {
    notFound();
  }

  const certificate = data as Certificate;
  const isRevoked = Boolean(certificate.is_revoked);

  return (
    <main className="rn-certificate-page">
      <style>{`
        .rn-certificate-page {
          --cert-navy: #102541;
          --cert-deep: #09172b;
          --cert-gold: #c39a4c;
          --cert-gold-dark: #8a682c;
          --cert-ink: #1a2b40;
          --cert-muted: #647286;
          --cert-paper: #fffdf8;

          min-height: 100vh;
          padding: 30px 24px 48px;
          color: var(--cert-ink);
          background:
            radial-gradient(
              ellipse at 50% 0%,
              rgba(195, 154, 76, 0.08),
              transparent 48%
            ),
            #f0f3f7;
        }

        .rn-certificate-page *,
        .rn-certificate-page *::before,
        .rn-certificate-page *::after {
          box-sizing: border-box;
        }

        .rn-certificate-page .cert-shell {
          width: 100%;
          max-width: 1440px;
          margin: 0 auto;
        }

        .rn-certificate-page .cert-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 22px;
        }

        .rn-certificate-page .cert-back {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          color: var(--cert-navy);
          font-size: 14px;
          font-weight: 750;
          text-decoration: none;
        }

        .rn-certificate-page .cert-back:hover {
          color: var(--cert-gold-dark);
        }

        .rn-certificate-page .cert-actions {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
        }

        .rn-certificate-page .cert-paper {
          position: relative;
          isolation: isolate;
          width: 100%;
          aspect-ratio: 297 / 210;
          overflow: hidden;
          background: var(--cert-paper);
          color: var(--cert-ink);
          border: 1px solid #c6a15d;
          box-shadow:
            0 30px 80px rgba(9, 23, 43, 0.15),
            0 4px 12px rgba(9, 23, 43, 0.06);
        }

        /*
         * Keep the original RuffNeck border artwork visible.
         * The paper and content layers do not cover it with an
         * opaque wash.
         */

        .rn-certificate-page .cert-border-art {
          position: absolute;
          z-index: 0;
          inset: 0;
          display: block;
          width: 100%;
          height: 100%;
          object-fit: fill;
          pointer-events: none;
        }

        .rn-certificate-page .cert-inner-frame {
          position: absolute;
          z-index: 1;
          inset: 5.2%;
          border: 1px solid rgba(179, 139, 63, 0.48);
          pointer-events: none;
        }

        .rn-certificate-page .cert-watermark {
          position: absolute;
          z-index: 1;
          top: 28%;
          left: 34%;
          width: 32%;
          height: 40%;
          object-fit: contain;
          opacity: 0.045;
          pointer-events: none;
        }

        .rn-certificate-page .cert-content {
          position: absolute;
          z-index: 2;
          inset: 8% 9%;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr) auto;
          min-width: 0;
          min-height: 0;
        }

        /* Brand header */

        .rn-certificate-page .cert-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          min-width: 0;
          padding-bottom: 2.2%;
          border-bottom: 1px solid rgba(179, 139, 63, 0.78);
        }

        .rn-certificate-page .cert-brand {
          display: flex;
          align-items: center;
          gap: 22px;
          min-width: 0;
        }

        .rn-certificate-page .cert-logo {
          display: block;
          flex: 0 1 auto;
          width: clamp(150px, 20vw, 265px);
          height: auto;
          max-height: 82px;
          object-fit: contain;
          object-position: left center;
        }

        .rn-certificate-page .cert-brand-copy {
          min-width: 0;
        }

        .rn-certificate-page .cert-brand-name {
          margin: 0;
          color: var(--cert-navy);
          font-size: clamp(17px, 1.65vw, 25px);
          font-weight: 900;
          letter-spacing: 0.13em;
          line-height: 1.15;
        }

        .rn-certificate-page .cert-tagline {
          margin-top: 7px;
          color: var(--cert-gold-dark);
          font-size: clamp(8px, 0.72vw, 11px);
          font-weight: 800;
          letter-spacing: 0.09em;
          line-height: 1.5;
          text-transform: uppercase;
        }

        .rn-certificate-page .cert-header-mark {
          flex: 0 0 auto;
          padding-left: 20px;
          border-left: 2px solid var(--cert-gold);
          text-align: right;
        }

        .rn-certificate-page .cert-header-mark strong {
          display: block;
          color: var(--cert-navy);
          font-size: clamp(9px, 0.8vw, 12px);
          font-weight: 900;
          letter-spacing: 0.12em;
          line-height: 1.5;
          text-transform: uppercase;
        }

        .rn-certificate-page .cert-header-mark span {
          display: block;
          margin-top: 5px;
          color: var(--cert-muted);
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(9px, 0.8vw, 12px);
          font-style: italic;
        }

        /* Main certificate */

        .rn-certificate-page .cert-main {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 23%;
          align-items: center;
          gap: 5%;
          min-width: 0;
          min-height: 0;
          padding: 2.5% 0;
        }

        .rn-certificate-page .cert-main-copy {
          min-width: 0;
        }

        .rn-certificate-page .cert-eyebrow {
          display: flex;
          align-items: center;
          gap: 11px;
          margin: 0 0 10px;
          color: var(--cert-gold-dark);
          font-size: clamp(9px, 0.8vw, 12px);
          font-weight: 900;
          letter-spacing: 0.23em;
          line-height: 1.4;
          text-transform: uppercase;
        }

        .rn-certificate-page .cert-eyebrow::before {
          width: 30px;
          height: 2px;
          flex: 0 0 auto;
          background: var(--cert-gold);
          content: "";
        }

        .rn-certificate-page .cert-title {
          margin: 0;
          color: var(--cert-navy);
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(31px, 3.35vw, 50px);
          font-weight: 500;
          letter-spacing: -0.045em;
          line-height: 1.02;
          text-wrap: balance;
        }

        .rn-certificate-page .cert-presented {
          margin: 2.5% 0 0.5%;
          color: var(--cert-muted);
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(11px, 1vw, 15px);
          font-style: italic;
          line-height: 1.4;
        }

        .rn-certificate-page .cert-recipient {
          max-width: 100%;
          margin: 0;
          color: #173c63;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(30px, 3.7vw, 55px);
          font-weight: 700;
          letter-spacing: -0.035em;
          line-height: 1.06;
          overflow-wrap: anywhere;
          text-wrap: balance;
        }

        .rn-certificate-page .cert-recipient-rule {
          width: 48%;
          max-width: 280px;
          height: 2px;
          margin-top: 1.6%;
          background: linear-gradient(
            90deg,
            var(--cert-gold),
            rgba(195, 154, 76, 0.08)
          );
        }

        .rn-certificate-page .cert-completion {
          margin: 1.6% 0 0.5%;
          color: #58677a;
          font-size: clamp(10px, 0.85vw, 13px);
          line-height: 1.5;
        }

        .rn-certificate-page .cert-course {
          max-width: 100%;
          margin: 0;
          color: var(--cert-navy);
          font-size: clamp(15px, 1.55vw, 23px);
          font-weight: 850;
          line-height: 1.28;
          overflow-wrap: anywhere;
          text-wrap: pretty;
        }

        .rn-certificate-page .cert-revoked-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-top: 12px;
          padding: 7px 12px;
          border: 1px solid #b91c1c;
          background: #fff1f2;
          color: #991b1b;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.16em;
        }

        /* Credential details */

        .rn-certificate-page .cert-record {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 17px;
          align-self: stretch;
          min-width: 0;
          padding: 5% 0 5% 12%;
          border-left: 1px solid rgba(179, 139, 63, 0.7);
        }

        .rn-certificate-page .cert-record-heading {
          margin: 0;
          color: var(--cert-gold-dark);
          font-size: clamp(8px, 0.72vw, 11px);
          font-weight: 900;
          letter-spacing: 0.15em;
          line-height: 1.5;
          text-transform: uppercase;
        }

        .rn-certificate-page .cert-record-item {
          min-width: 0;
        }

        .rn-certificate-page .cert-record-label {
          display: block;
          margin-bottom: 5px;
          color: var(--cert-muted);
          font-size: clamp(8px, 0.7vw, 10px);
          font-weight: 650;
          line-height: 1.35;
        }

        .rn-certificate-page .cert-record-value {
          display: block;
          color: var(--cert-navy);
          font-size: clamp(11px, 1vw, 15px);
          font-weight: 850;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }

        .rn-certificate-page .cert-record-rule {
          width: 32px;
          height: 2px;
          background: var(--cert-gold);
        }

        /* Authentication footer */

        .rn-certificate-page .cert-footer {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
          align-items: center;
          gap: 20px;
          min-width: 0;
          padding-top: 2%;
          border-top: 1px solid rgba(179, 139, 63, 0.78);
        }

        .rn-certificate-page .cert-signatory {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
          min-width: 0;
        }

        .rn-certificate-page .cert-signature {
          display: block;
          width: auto;
          max-width: 160px;
          height: 37px;
          object-fit: contain;
          object-position: left bottom;
        }

        .rn-certificate-page .cert-signature-line {
          width: 100%;
          max-width: 185px;
          margin: 4px 0 5px;
          border-top: 1px solid #9c8457;
        }

        .rn-certificate-page .cert-signatory-name {
          color: var(--cert-navy);
          font-size: clamp(10px, 0.85vw, 13px);
          font-weight: 900;
          line-height: 1.35;
        }

        .rn-certificate-page .cert-signatory-role {
          margin-top: 3px;
          color: var(--cert-muted);
          font-size: clamp(8px, 0.67vw, 10px);
          line-height: 1.4;
        }

        .rn-certificate-page .cert-authenticity {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }

        .rn-certificate-page .cert-seal {
          display: block;
          width: clamp(48px, 5.4vw, 76px);
          height: clamp(48px, 5.4vw, 76px);
          object-fit: contain;
        }

        .rn-certificate-page .cert-stamp {
          display: block;
          width: clamp(42px, 4.7vw, 65px);
          height: clamp(42px, 4.7vw, 65px);
          object-fit: contain;
        }

        .rn-certificate-page .cert-verification {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 11px;
          min-width: 0;
        }

        .rn-certificate-page .cert-qr {
          display: block;
          flex: 0 0 auto;
          width: clamp(58px, 5.9vw, 82px);
          height: clamp(58px, 5.9vw, 82px);
          padding: 3px;
          border: 1px solid #c5a15d;
          background: #fff;
          object-fit: contain;
        }

        .rn-certificate-page .cert-verify-copy {
          min-width: 0;
        }

        .rn-certificate-page .cert-verify-title {
          display: block;
          margin-bottom: 5px;
          color: var(--cert-navy);
          font-size: clamp(8px, 0.74vw, 11px);
          font-weight: 900;
          letter-spacing: 0.09em;
          line-height: 1.35;
        }

        .rn-certificate-page .cert-verify-description {
          margin: 0;
          color: var(--cert-muted);
          font-size: clamp(7px, 0.64vw, 9px);
          line-height: 1.45;
        }

        .rn-certificate-page .cert-number {
          margin-top: 6px;
          color: var(--cert-gold-dark);
          font-size: clamp(7px, 0.64vw, 9px);
          font-weight: 900;
          line-height: 1.4;
          overflow-wrap: anywhere;
        }

        .rn-certificate-page .cert-revoked-note {
          margin-top: 12px;
          padding: 13px 16px;
          border: 1px solid #fecaca;
          background: #fff1f2;
          color: #991b1b;
          font-size: 13px;
          line-height: 1.5;
        }

        .rn-certificate-page .cert-bottom-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 22px;
        }

        /* Mobile screen layout */

        @media screen and (max-width: 760px) {
          .rn-certificate-page {
            padding: 16px 10px 30px;
          }

          .rn-certificate-page .cert-toolbar {
            align-items: flex-start;
            margin-bottom: 16px;
          }

          .rn-certificate-page .cert-actions {
            width: 100%;
          }

          .rn-certificate-page .cert-paper {
            aspect-ratio: auto;
            min-height: 0;
          }

          .rn-certificate-page .cert-border-art {
            object-fit: cover;
          }

          .rn-certificate-page .cert-inner-frame {
            inset: 10px;
          }

          .rn-certificate-page .cert-content {
            position: relative;
            inset: auto;
            display: flex;
            flex-direction: column;
            gap: 25px;
            padding: 34px 8%;
          }

          .rn-certificate-page .cert-header {
            flex-direction: column;
            gap: 16px;
            padding-bottom: 20px;
          }

          .rn-certificate-page .cert-brand {
            flex-direction: column;
            gap: 12px;
            width: 100%;
          }

          .rn-certificate-page .cert-logo {
            width: min(100%, 230px);
            max-height: 90px;
            object-position: center;
          }

          .rn-certificate-page .cert-brand-copy {
            text-align: center;
          }

          .rn-certificate-page .cert-brand-name {
            font-size: 20px;
          }

          .rn-certificate-page .cert-tagline {
            font-size: 9px;
          }

          .rn-certificate-page .cert-header-mark {
            padding: 0;
            border: 0;
            text-align: center;
          }

          .rn-certificate-page .cert-header-mark strong {
            font-size: 10px;
          }

          .rn-certificate-page .cert-header-mark span {
            font-size: 11px;
          }

          .rn-certificate-page .cert-main {
            display: flex;
            flex-direction: column;
            align-items: stretch;
            gap: 24px;
            padding: 0;
          }

          .rn-certificate-page .cert-eyebrow {
            font-size: 9px;
          }

          .rn-certificate-page .cert-title {
            font-size: clamp(29px, 8vw, 43px);
          }

          .rn-certificate-page .cert-presented {
            margin-top: 19px;
            font-size: 12px;
          }

          .rn-certificate-page .cert-recipient {
            font-size: clamp(29px, 8vw, 43px);
          }

          .rn-certificate-page .cert-completion {
            margin-top: 16px;
            font-size: 11px;
          }

          .rn-certificate-page .cert-course {
            font-size: clamp(17px, 5vw, 25px);
          }

          .rn-certificate-page .cert-record {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 18px 14px;
            padding: 20px 0;
            border-top: 1px solid rgba(179, 139, 63, 0.7);
            border-right: 0;
            border-bottom: 1px solid rgba(179, 139, 63, 0.7);
            border-left: 0;
          }

          .rn-certificate-page .cert-record-heading {
            grid-column: 1 / -1;
            font-size: 10px;
          }

          .rn-certificate-page .cert-record-label {
            font-size: 10px;
          }

          .rn-certificate-page .cert-record-value {
            font-size: 13px;
          }

          .rn-certificate-page .cert-footer {
            grid-template-columns: minmax(0, 1fr);
            gap: 22px;
            padding-top: 22px;
          }

          .rn-certificate-page .cert-signatory {
            align-items: center;
            text-align: center;
          }

          .rn-certificate-page .cert-signature {
            max-width: 180px;
            object-position: center bottom;
          }

          .rn-certificate-page .cert-signature-line {
            margin-right: auto;
            margin-left: auto;
          }

          .rn-certificate-page .cert-authenticity {
            gap: 14px;
          }

          .rn-certificate-page .cert-seal {
            width: 66px;
            height: 66px;
          }

          .rn-certificate-page .cert-stamp {
            width: 58px;
            height: 58px;
          }

          .rn-certificate-page .cert-verification {
            justify-content: center;
          }

          .rn-certificate-page .cert-qr {
            width: 76px;
            height: 76px;
          }

          .rn-certificate-page .cert-verify-title {
            font-size: 10px;
          }

          .rn-certificate-page .cert-verify-description,
          .rn-certificate-page .cert-number {
            font-size: 9px;
          }

          .rn-certificate-page .cert-bottom-actions {
            justify-content: flex-start;
          }
        }

        /* A4 landscape print layout */

        @page {
          size: A4 landscape;
          margin: 0;
        }

        @media print {
          html,
          body {
            width: 297mm !important;
            height: 210mm !important;
            min-width: 0 !important;
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

          .rn-certificate-page,
          .rn-certificate-page * {
            visibility: visible !important;
          }

          .rn-certificate-page {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 297mm !important;
            height: 210mm !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            background: #ffffff !important;
          }

          .rn-certificate-page .cert-shell {
            width: 297mm !important;
            max-width: none !important;
            height: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .rn-certificate-page .cert-toolbar,
          .rn-certificate-page .cert-bottom-actions,
          .rn-certificate-page .no-print {
            display: none !important;
          }

          .rn-certificate-page .cert-paper {
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
            break-before: avoid-page !important;
            break-after: avoid-page !important;
            break-inside: avoid-page !important;
            page-break-before: avoid !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
          }

          .rn-certificate-page .cert-border-art {
            position: absolute !important;
            z-index: 0 !important;
            inset: 0 !important;
            display: block !important;
            width: 297mm !important;
            height: 210mm !important;
            object-fit: fill !important;
            opacity: 1 !important;
          }

          .rn-certificate-page .cert-inner-frame {
            position: absolute !important;
            z-index: 1 !important;
            inset: 5.2% !important;
            border: 1px solid rgba(179, 139, 63, 0.48) !important;
          }

          .rn-certificate-page .cert-watermark {
            position: absolute !important;
            z-index: 1 !important;
            top: 28% !important;
            left: 34% !important;
            width: 32% !important;
            height: 40% !important;
            opacity: 0.045 !important;
          }

          .rn-certificate-page .cert-content {
            position: absolute !important;
            z-index: 2 !important;
            inset: 16mm 21mm !important;
            display: grid !important;
            grid-template-rows: 24mm minmax(0, 1fr) 31mm !important;
            width: auto !important;
            height: auto !important;
            min-width: 0 !important;
            min-height: 0 !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 0 !important;
            gap: 0 !important;
            overflow: hidden !important;
          }

          .rn-certificate-page .cert-header {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 5mm !important;
            min-height: 0 !important;
            padding-bottom: 3mm !important;
          }

          .rn-certificate-page .cert-brand {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            gap: 5mm !important;
            min-width: 0 !important;
          }

          .rn-certificate-page .cert-logo {
            flex: 0 1 auto !important;
            width: 48mm !important;
            max-width: 48mm !important;
            height: 18mm !important;
            max-height: 18mm !important;
            object-fit: contain !important;
            object-position: left center !important;
          }

          .rn-certificate-page .cert-brand-name {
            font-size: 15pt !important;
            line-height: 1.1 !important;
          }

          .rn-certificate-page .cert-tagline {
            margin-top: 1.3mm !important;
            font-size: 6.5pt !important;
            line-height: 1.25 !important;
          }

          .rn-certificate-page .cert-header-mark {
            padding-left: 4mm !important;
            border-left: 0.5mm solid var(--cert-gold) !important;
            text-align: right !important;
          }

          .rn-certificate-page .cert-header-mark strong {
            font-size: 7pt !important;
            line-height: 1.35 !important;
          }

          .rn-certificate-page .cert-header-mark span {
            margin-top: 1mm !important;
            font-size: 7pt !important;
            line-height: 1.3 !important;
          }

          .rn-certificate-page .cert-main {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) 48mm !important;
            align-items: center !important;
            gap: 8mm !important;
            min-width: 0 !important;
            min-height: 0 !important;
            padding: 3mm 0 !important;
            overflow: hidden !important;
          }

          .rn-certificate-page .cert-main-copy {
            min-width: 0 !important;
            max-height: 100% !important;
            overflow: hidden !important;
          }

          .rn-certificate-page .cert-eyebrow {
            gap: 2mm !important;
            margin: 0 0 2mm !important;
            font-size: 7pt !important;
            letter-spacing: 0.19em !important;
            line-height: 1.2 !important;
          }

          .rn-certificate-page .cert-eyebrow::before {
            width: 6mm !important;
            height: 0.5mm !important;
          }

          .rn-certificate-page .cert-title {
            margin: 0 !important;
            font-size: 27pt !important;
            line-height: 1.04 !important;
          }

          .rn-certificate-page .cert-presented {
            margin: 2.5mm 0 1mm !important;
            font-size: 9pt !important;
            line-height: 1.2 !important;
          }

          .rn-certificate-page .cert-recipient {
            margin: 0 !important;
            font-size: 32pt !important;
            line-height: 1.08 !important;
            overflow-wrap: anywhere !important;
          }

          .rn-certificate-page .cert-recipient-rule {
            width: 58mm !important;
            height: 0.5mm !important;
            margin-top: 2mm !important;
          }

          .rn-certificate-page .cert-completion {
            margin: 2mm 0 1mm !important;
            font-size: 8pt !important;
            line-height: 1.2 !important;
          }

          .rn-certificate-page .cert-course {
            margin: 0 !important;
            font-size: 14pt !important;
            line-height: 1.2 !important;
            overflow-wrap: anywhere !important;
          }

          .rn-certificate-page .cert-revoked-badge {
            margin-top: 2mm !important;
            padding: 1mm 3mm !important;
            font-size: 7pt !important;
          }

          .rn-certificate-page .cert-record {
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            gap: 3mm !important;
            align-self: stretch !important;
            min-width: 0 !important;
            min-height: 0 !important;
            padding: 3mm 0 3mm 5mm !important;
            border-top: 0 !important;
            border-right: 0 !important;
            border-bottom: 0 !important;
            border-left: 0.3mm solid rgba(179, 139, 63, 0.7) !important;
            overflow: hidden !important;
          }

          .rn-certificate-page .cert-record-heading {
            margin: 0 0 0.5mm !important;
            font-size: 6.5pt !important;
            line-height: 1.25 !important;
          }

          .rn-certificate-page .cert-record-label {
            margin-bottom: 0.8mm !important;
            font-size: 7pt !important;
            line-height: 1.2 !important;
          }

          .rn-certificate-page .cert-record-value {
            font-size: 9pt !important;
            line-height: 1.25 !important;
          }

          .rn-certificate-page .cert-record-rule {
            width: 8mm !important;
            height: 0.5mm !important;
          }

          .rn-certificate-page .cert-footer {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) !important;
            align-items: center !important;
            gap: 4mm !important;
            min-width: 0 !important;
            min-height: 0 !important;
            padding-top: 2.5mm !important;
            overflow: hidden !important;
          }

          .rn-certificate-page .cert-signatory {
            display: flex !important;
            flex-direction: column !important;
            align-items: flex-start !important;
            justify-content: center !important;
            min-width: 0 !important;
            text-align: left !important;
          }

          .rn-certificate-page .cert-signature {
            width: auto !important;
            max-width: 36mm !important;
            height: 8mm !important;
            object-fit: contain !important;
            object-position: left bottom !important;
          }

          .rn-certificate-page .cert-signature-line {
            width: 48mm !important;
            max-width: 48mm !important;
            margin: 0.8mm 0 1mm !important;
            border-top: 0.3mm solid #9c8457 !important;
          }

          .rn-certificate-page .cert-signatory-name {
            font-size: 8pt !important;
            line-height: 1.2 !important;
          }

          .rn-certificate-page .cert-signatory-role {
            margin-top: 0.5mm !important;
            font-size: 6.5pt !important;
            line-height: 1.2 !important;
          }

          .rn-certificate-page .cert-authenticity {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 2mm !important;
          }

          .rn-certificate-page .cert-seal {
            width: 17mm !important;
            height: 17mm !important;
          }

          .rn-certificate-page .cert-stamp {
            width: 15mm !important;
            height: 15mm !important;
          }

          .rn-certificate-page .cert-verification {
            display: flex !important;
            align-items: center !important;
            justify-content: flex-end !important;
            gap: 2mm !important;
            min-width: 0 !important;
          }

          .rn-certificate-page .cert-qr {
            width: 17mm !important;
            height: 17mm !important;
            padding: 0.6mm !important;
          }

          .rn-certificate-page .cert-verify-title {
            margin-bottom: 0.8mm !important;
            font-size: 6.5pt !important;
            line-height: 1.2 !important;
          }

          .rn-certificate-page .cert-verify-description {
            font-size: 6pt !important;
            line-height: 1.25 !important;
          }

          .rn-certificate-page .cert-number {
            margin-top: 1mm !important;
            font-size: 5.5pt !important;
            line-height: 1.2 !important;
          }

          .rn-certificate-page .cert-revoked-note {
            margin-top: 2mm !important;
            padding: 2mm !important;
            font-size: 8pt !important;
            line-height: 1.3 !important;
          }

          .rn-certificate-page img {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <div className="cert-shell">
        <nav className="cert-toolbar no-print" aria-label="Certificate actions">
          <Link href="/student/certificates" className="cert-back">
            <span aria-hidden="true">←</span>
            <span>My Certificates</span>
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
            className="cert-border-art"
          />

          <div className="cert-inner-frame" aria-hidden="true" />

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

              <div className="cert-header-mark">
                <strong>Professional Credential</strong>
                <span>Certificate of Achievement</span>
              </div>
            </header>

            <section className="cert-main">
              <div className="cert-main-copy">
                <p className="cert-eyebrow">Learning Achievement</p>

                <h1 className="cert-title">
                  Certificate
                  <br />
                  of Completion
                </h1>

                {isRevoked && (
                  <div className="cert-revoked-badge" role="alert">
                    CERTIFICATE REVOKED
                  </div>
                )}

                <p className="cert-presented">
                  This certificate is awarded to
                </p>

                <h2 className="cert-recipient">
                  {certificate.holder_name}
                </h2>

                <div
                  className="cert-recipient-rule"
                  aria-hidden="true"
                />

                <p className="cert-completion">
                  In recognition of successfully completing
                </p>

                <h3 className="cert-course">{certificate.course_title}</h3>
              </div>

              <aside className="cert-record" aria-label="Credential record">
                <p className="cert-record-heading">Credential Record</p>

                <div className="cert-record-item">
                  <span className="cert-record-label">Date issued</span>
                  <strong className="cert-record-value">
                    {formatDate(certificate.issued_at)}
                  </strong>
                </div>

                <div className="cert-record-rule" aria-hidden="true" />

                <div className="cert-record-item">
                  <span className="cert-record-label">
                    Assessment score
                  </span>
                  <strong className="cert-record-value">
                    {certificate.assessment_score == null
                      ? "—"
                      : `${certificate.assessment_score}%`}
                  </strong>
                </div>

                <div className="cert-record-item">
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

                  <div
                    className="cert-signature-line"
                    aria-hidden="true"
                  />

                  <strong className="cert-signatory-name">
                    Hassan Zakariya
                  </strong>

                  <span className="cert-signatory-role">
                    Founder &amp; CEO · RuffNeck Entertainment
                  </span>
                </div>

                <div className="cert-authenticity" aria-label="Official seals">
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