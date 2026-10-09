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
  if (value === null || value === undefined) {
    return "Not recorded";
  }

  return `${value}%`;
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
  const verificationUrl = getVerificationUrl(
    certificate.certificate_number
  );
  const qrUrl = getQrUrl(verificationUrl);
  const issuedDate = formatDate(certificate.issued_at);
  const revoked = certificate.is_revoked;

  return (
    <main className="certificate-page">
      <style>{`
        :root {
          --cert-navy: #071a35;
          --cert-navy-2: #102c52;
          --cert-gold: #c18a25;
          --cert-gold-light: #e7c66f;
          --cert-ink: #152541;
          --cert-muted: #66758b;
          --cert-paper: #fffefa;
        }

        .certificate-page {
          min-height: 100vh;
          padding: 28px 22px 48px;
          background:
            radial-gradient(ellipse at 10% 0%, rgba(193,138,37,.08), transparent 32%),
            #f1f4f8;
          color: var(--cert-ink);
          font-family: Arial, Helvetica, sans-serif;
        }

        .certificate-toolbar {
          width: min(1200px, 100%);
          margin: 0 auto 22px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .certificate-toolbar-left,
        .certificate-toolbar-right {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .certificate-toolbar a,
        .certificate-toolbar button {
          min-height: 42px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px solid #d8e0ea;
          border-radius: 8px;
          padding: 10px 15px;
          background: white;
          color: var(--cert-navy);
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
          cursor: pointer;
        }

        .certificate-toolbar a:hover,
        .certificate-toolbar button:hover {
          border-color: var(--cert-gold);
          background: #fffdf7;
        }

        .certificate-toolbar .toolbar-primary {
          border-color: var(--cert-navy);
          background: var(--cert-navy);
          color: white;
        }

        .certificate-toolbar .toolbar-primary:hover {
          background: var(--cert-navy-2);
        }

        .certificate-paper {
          position: relative;
          isolation: isolate;
          width: min(1200px, 100%);
          aspect-ratio: 297 / 210;
          min-height: 570px;
          margin: 0 auto;
          overflow: hidden;
          background: var(--cert-paper);
          box-shadow: 0 22px 65px rgba(7,26,53,.16);
          color: var(--cert-ink);
          container-type: inline-size;
        }

        .certificate-paper::before {
          content: "";
          position: absolute;
          z-index: -2;
          inset: 0;
          background:
            radial-gradient(ellipse at 50% 45%, rgba(255,255,255,.2), rgba(255,254,250,.96) 65%),
            #fffefa;
        }

        .certificate-border-art {
          position: absolute;
          z-index: 5;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: fill;
          pointer-events: none;
          opacity: .92;
        }

        .certificate-watermark {
          position: absolute;
          z-index: -1;
          left: 50%;
          top: 48%;
          width: 47%;
          height: 65%;
          transform: translate(-50%, -50%);
          object-fit: contain;
          opacity: .075;
          pointer-events: none;
          filter: saturate(.75);
        }

        .certificate-content {
          position: absolute;
          z-index: 2;
          inset: 4.6% 4.4% 5.8%;
          display: grid;
          grid-template-columns: 19% 1fr 19%;
          grid-template-rows: 20% 1fr 23%;
          column-gap: 2.2%;
          min-width: 0;
        }

        .certificate-header {
          grid-column: 1 / 3;
          grid-row: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2.4%;
          min-width: 0;
          padding: 0 1%;
        }

        .certificate-logo {
          width: 20%;
          max-width: 180px;
          max-height: 100%;
          object-fit: contain;
          flex-shrink: 0;
        }

        .certificate-brand-copy {
          min-width: 0;
          text-align: left;
        }

        .certificate-brand-name {
          margin: 0;
          color: var(--cert-navy);
          font-size: clamp(20px, 3.3cqw, 43px);
          font-weight: 900;
          line-height: .98;
          letter-spacing: .055em;
          white-space: nowrap;
        }

        .certificate-brand-subtitle {
          margin-top: 5px;
          color: #214d85;
          font-size: clamp(9px, 1.25cqw, 15px);
          font-weight: 800;
          letter-spacing: .42em;
          text-align: center;
        }

        .certificate-brand-rule {
          width: 70%;
          height: 2px;
          margin: 8px auto 6px;
          background: linear-gradient(90deg, transparent, var(--cert-gold), transparent);
        }

        .certificate-tagline {
          color: #526176;
          font-size: clamp(6px, .77cqw, 9px);
          font-weight: 700;
          letter-spacing: .13em;
          text-align: center;
          white-space: nowrap;
        }

        .certificate-medal-column {
          grid-column: 1;
          grid-row: 2;
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 0;
          padding: 2%;
        }

        .certificate-medal {
          width: 100%;
          max-height: 88%;
          object-fit: contain;
          filter: drop-shadow(0 7px 5px rgba(7,26,53,.15));
        }

        .certificate-main {
          grid-column: 2;
          grid-row: 2;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-width: 0;
          padding: 0 1%;
          text-align: center;
        }

        .certificate-overline {
          margin: 0 0 2px;
          color: var(--cert-gold);
          font-size: clamp(7px, .8cqw, 10px);
          font-weight: 800;
          letter-spacing: .28em;
          text-transform: uppercase;
        }

        .certificate-title {
          margin: 0;
          color: var(--cert-navy);
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(25px, 4.25cqw, 54px);
          font-weight: 700;
          line-height: .98;
          letter-spacing: .065em;
          white-space: nowrap;
        }

        .certificate-title-subtitle {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          width: 100%;
          margin: 6px 0 10px;
          color: #a87519;
          font-size: clamp(9px, 1.25cqw, 15px);
          font-weight: 800;
          letter-spacing: .36em;
          white-space: nowrap;
        }

        .certificate-title-subtitle::before,
        .certificate-title-subtitle::after {
          content: "";
          height: 1px;
          width: 13%;
          background: var(--cert-gold);
        }

        .certificate-this-is {
          margin: 0 0 2px;
          color: #364a68;
          font-size: clamp(7px, .83cqw, 10px);
          font-weight: 800;
          letter-spacing: .23em;
          text-transform: uppercase;
        }

        .certificate-recipient {
          max-width: 100%;
          margin: 0;
          color: var(--cert-navy);
          font-family: "Brush Script MT", "Segoe Script", cursive;
          font-size: clamp(29px, 4.35cqw, 55px);
          font-weight: 500;
          line-height: 1.1;
          overflow-wrap: anywhere;
        }

        .certificate-recipient-rule {
          width: 92%;
          height: 1px;
          margin: 7px 0 8px;
          background: linear-gradient(90deg, transparent, var(--cert-gold), transparent);
        }

        .certificate-recognition {
          margin: 0 0 5px;
          color: #344761;
          font-size: clamp(7px, .84cqw, 10px);
          line-height: 1.45;
        }

        .certificate-course-title {
          max-width: 100%;
          margin: 0;
          color: var(--cert-navy);
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(12px, 1.65cqw, 21px);
          font-weight: 800;
          line-height: 1.18;
          text-transform: uppercase;
          overflow-wrap: anywhere;
        }

        .certificate-course-label {
          margin-top: 3px;
          color: #a87519;
          font-size: clamp(7px, .9cqw, 11px);
          font-weight: 800;
          letter-spacing: .35em;
        }

        .certificate-achievement {
          max-width: 95%;
          margin: 7px 0 0;
          color: #485a70;
          font-size: clamp(7px, .78cqw, 9px);
          line-height: 1.45;
        }

        .certificate-details {
          grid-column: 3;
          grid-row: 1 / 3;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-width: 0;
          padding: 9% 4% 5%;
          border-left: 1px solid rgba(193,138,37,.75);
          text-align: center;
        }

        .certificate-qr-frame {
          display: flex;
          align-items: center;
          justify-content: center;
          width: min(74%, 115px);
          aspect-ratio: 1;
          padding: 5px;
          border: 1px solid var(--cert-gold);
          background: white;
        }

        .certificate-qr {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .certificate-verify-title {
          margin: 8px 0 3px;
          color: var(--cert-navy);
          font-size: clamp(7px, .8cqw, 10px);
          font-weight: 900;
          letter-spacing: .08em;
        }

        .certificate-verify-copy {
          margin: 0;
          color: #617087;
          font-size: clamp(6px, .68cqw, 8px);
          line-height: 1.35;
          overflow-wrap: anywhere;
        }

        .certificate-number-label {
          width: 100%;
          margin-top: 10px;
          padding: 5px 3px;
          background: var(--cert-navy);
          color: white;
          font-size: clamp(6px, .68cqw, 8px);
          font-weight: 800;
          letter-spacing: .08em;
        }

        .certificate-number {
          margin: 5px 0 0;
          color: var(--cert-navy);
          font-size: clamp(7px, .86cqw, 10px);
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .certificate-detail-divider {
          width: 100%;
          height: 1px;
          margin: 9px 0 7px;
          background: rgba(193,138,37,.7);
        }

        .certificate-record-heading {
          width: 100%;
          margin: 0 0 6px;
          color: var(--cert-navy);
          font-size: clamp(6px, .7cqw, 9px);
          font-weight: 900;
          letter-spacing: .1em;
          text-align: left;
        }

        .certificate-record-row {
          width: 100%;
          display: flex;
          align-items: flex-start;
          gap: 7px;
          margin: 3px 0;
          text-align: left;
        }

        .certificate-record-symbol {
          width: 17px;
          flex: 0 0 17px;
          color: var(--cert-gold);
          font-size: 15px;
          line-height: 1;
          text-align: center;
        }

        .certificate-record-copy {
          min-width: 0;
          color: #647187;
          font-size: clamp(6px, .65cqw, 8px);
          line-height: 1.35;
          overflow-wrap: anywhere;
        }

        .certificate-record-copy strong {
          display: block;
          color: var(--cert-navy);
          font-size: clamp(6px, .7cqw, 9px);
        }

        .certificate-bottom {
          grid-column: 1 / 4;
          grid-row: 3;
          display: grid;
          grid-template-columns: 1fr 1.15fr 1fr;
          align-items: end;
          gap: 2%;
          min-width: 0;
          padding: 0 1% 1%;
        }

        .certificate-signature-block {
          min-width: 0;
          text-align: center;
        }

        .certificate-signature-image {
          display: block;
          width: 65%;
          height: 32px;
          margin: 0 auto -1px;
          object-fit: contain;
          object-position: center bottom;
        }

        .certificate-signature-line {
          width: 94%;
          height: 1px;
          margin: 0 auto 4px;
          background: var(--cert-gold);
        }

        .certificate-signature-name {
          margin: 0;
          color: var(--cert-navy);
          font-size: clamp(7px, .82cqw, 10px);
          font-weight: 900;
          letter-spacing: .03em;
        }

        .certificate-signature-role {
          margin: 3px 0 0;
          color: #a87519;
          font-size: clamp(6px, .67cqw, 8px);
          line-height: 1.35;
          letter-spacing: .04em;
        }

        .certificate-seals {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5%;
          min-width: 0;
          padding-bottom: 2px;
        }

        .certificate-seal {
          width: 28%;
          max-width: 86px;
          max-height: 85px;
          object-fit: contain;
        }

        .certificate-stamp {
          position: absolute;
          z-index: 3;
          right: 5%;
          bottom: 16%;
          width: 7%;
          max-width: 80px;
          opacity: .88;
          object-fit: contain;
          pointer-events: none;
        }

        .certificate-revoked {
          position: absolute;
          z-index: 8;
          top: 43%;
          left: 50%;
          width: 70%;
          transform: translate(-50%, -50%) rotate(-8deg);
          padding: 12px 20px;
          border: 4px solid #a51d2d;
          background: rgba(255,255,255,.93);
          color: #a51d2d;
          font-size: clamp(22px, 4cqw, 48px);
          font-weight: 900;
          letter-spacing: .15em;
          text-align: center;
          text-transform: uppercase;
          pointer-events: none;
        }

        .certificate-revoked-reason {
          position: absolute;
          z-index: 9;
          left: 50%;
          top: 55%;
          width: 65%;
          transform: translateX(-50%);
          padding: 8px 12px;
          background: rgba(255,255,255,.94);
          color: #84202b;
          font-size: clamp(8px, .95cqw, 12px);
          text-align: center;
        }

        .certificate-revoked-notice {
          width: min(1200px, 100%);
          margin: 14px auto 0;
          padding: 12px 16px;
          border: 1px solid #efb4ba;
          border-radius: 8px;
          background: #fff4f4;
          color: #8b1d2b;
          font-size: 13px;
          line-height: 1.5;
        }

        .certificate-after-paper {
          width: min(1200px, 100%);
          margin: 18px auto 0;
          color: #68768a;
          font-size: 12px;
          line-height: 1.6;
          text-align: center;
        }

        .certificate-after-paper a {
          color: var(--cert-navy);
          font-weight: 700;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .certificate-verification-component {
          display: flex;
          justify-content: center;
          margin: 14px auto 0;
        }

        @media (max-width: 760px) {
          .certificate-page {
            padding: 14px 10px 28px;
          }

          .certificate-toolbar {
            margin-bottom: 14px;
          }

          .certificate-toolbar a,
          .certificate-toolbar button {
            min-height: 38px;
            padding: 8px 10px;
            font-size: 12px;
          }

          .certificate-paper {
            aspect-ratio: auto;
            min-height: 0;
            overflow: hidden;
            padding-bottom: 0;
          }

          .certificate-border-art {
            object-fit: fill;
          }

          .certificate-content {
            position: relative;
            inset: auto;
            display: flex;
            flex-direction: column;
            gap: 18px;
            padding: 8% 7% 9%;
          }

          .certificate-header {
            display: flex;
            justify-content: center;
            gap: 12px;
            padding: 5px 0 10px;
          }

          .certificate-logo {
            width: 24%;
            max-width: 105px;
          }

          .certificate-brand-name {
            font-size: clamp(18px, 5.2vw, 28px);
          }

          .certificate-brand-subtitle {
            font-size: 10px;
            letter-spacing: .25em;
          }

          .certificate-brand-rule {
            margin: 6px auto 5px;
          }

          .certificate-tagline {
            font-size: 7px;
            white-space: normal;
          }

          .certificate-medal-column {
            display: none;
          }

          .certificate-main {
            order: 2;
            padding: 10px 0;
          }

          .certificate-overline {
            font-size: 9px;
          }

          .certificate-title {
            font-size: clamp(27px, 7.8vw, 43px);
            white-space: normal;
          }

          .certificate-title-subtitle {
            font-size: 11px;
            letter-spacing: .22em;
          }

          .certificate-this-is {
            margin-top: 5px;
            font-size: 9px;
          }

          .certificate-recipient {
            font-size: clamp(31px, 8vw, 45px);
          }

          .certificate-recognition {
            font-size: 11px;
          }

          .certificate-course-title {
            font-size: clamp(16px, 4.5vw, 23px);
          }

          .certificate-course-label {
            font-size: 10px;
          }

          .certificate-achievement {
            font-size: 10px;
          }

          .certificate-details {
            order: 3;
            border-left: 0;
            border-top: 1px solid rgba(193,138,37,.75);
            padding: 18px 4% 10px;
          }

          .certificate-qr-frame {
            width: 100px;
          }

          .certificate-verify-title {
            font-size: 10px;
          }

          .certificate-verify-copy {
            font-size: 9px;
          }

          .certificate-number-label {
            max-width: 270px;
            font-size: 9px;
          }

          .certificate-number {
            font-size: 11px;
          }

          .certificate-record-heading {
            font-size: 9px;
          }

          .certificate-record-row {
            max-width: 270px;
          }

          .certificate-record-copy,
          .certificate-record-copy strong {
            font-size: 10px;
          }

          .certificate-bottom {
            order: 4;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 18px 10px;
            padding-top: 12px;
          }

          .certificate-signature-image {
            height: 30px;
          }

          .certificate-signature-name {
            font-size: 9px;
          }

          .certificate-signature-role {
            font-size: 8px;
          }

          .certificate-seals {
            grid-column: 1 / 3;
            grid-row: 1;
            padding-bottom: 12px;
          }

          .certificate-seal {
            width: 24%;
            max-height: 75px;
          }

          .certificate-stamp {
            display: none;
          }

          .certificate-revoked {
            position: absolute;
            top: 50%;
            font-size: 25px;
          }

          .certificate-revoked-reason {
            top: 57%;
            font-size: 10px;
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
            background: white !important;
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
            background: white !important;
          }

          .certificate-toolbar,
          .certificate-after-paper,
          .certificate-verification-component,
          .certificate-revoked-notice {
            display: none !important;
          }

          .certificate-paper {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            display: block !important;
            width: 297mm !important;
            height: 210mm !important;
            min-height: 0 !important;
            max-height: 210mm !important;
            aspect-ratio: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            box-shadow: none !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
            page-break-before: avoid !important;
          }

          .certificate-content {
            position: absolute !important;
            inset: 4.6% 4.4% 5.8% !important;
            display: grid !important;
            grid-template-columns: 19% 1fr 19% !important;
            grid-template-rows: 20% 1fr 23% !important;
            column-gap: 2.2% !important;
            gap: initial !important;
            padding: 0 !important;
          }

          .certificate-header {
            grid-column: 1 / 3 !important;
            grid-row: 1 !important;
            display: flex !important;
            padding: 0 1% !important;
          }

          .certificate-logo {
            width: 20% !important;
            max-width: 180px !important;
          }

          .certificate-brand-name {
            font-size: 3.3cqw !important;
          }

          .certificate-brand-subtitle {
            font-size: 1.25cqw !important;
          }

          .certificate-tagline {
            font-size: .77cqw !important;
          }

          .certificate-medal-column {
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
            font-size: 4.25cqw !important;
            white-space: nowrap !important;
          }

          .certificate-recipient {
            font-size: 4.35cqw !important;
          }

          .certificate-course-title {
            font-size: 1.65cqw !important;
          }

          .certificate-details {
            grid-column: 3 !important;
            grid-row: 1 / 3 !important;
            border-left: 1px solid rgba(193,138,37,.75) !important;
            border-top: 0 !important;
            padding: 9% 4% 5% !important;
          }

          .certificate-qr-frame {
            width: min(74%, 115px) !important;
          }

          .certificate-verify-title {
            font-size: .8cqw !important;
          }

          .certificate-verify-copy {
            font-size: .68cqw !important;
          }

          .certificate-number-label {
            font-size: .68cqw !important;
          }

          .certificate-number {
            font-size: .86cqw !important;
          }

          .certificate-record-heading {
            font-size: .7cqw !important;
          }

          .certificate-record-copy {
            font-size: .65cqw !important;
          }

          .certificate-record-copy strong {
            font-size: .7cqw !important;
          }

          .certificate-bottom {
            grid-column: 1 / 4 !important;
            grid-row: 3 !important;
            display: grid !important;
            grid-template-columns: 1fr 1.15fr 1fr !important;
            gap: 2% !important;
            padding: 0 1% 1% !important;
          }

          .certificate-seals {
            grid-column: auto !important;
            grid-row: auto !important;
          }

          .certificate-seal {
            width: 28% !important;
            max-width: 86px !important;
            max-height: 85px !important;
          }

          .certificate-signature-image {
            height: 32px !important;
          }

          .certificate-stamp {
            display: block !important;
          }

          .certificate-watermark {
            opacity: .075 !important;
          }

          .certificate-border-art {
            opacity: .92 !important;
          }

          .certificate-revoked {
            font-size: 4cqw !important;
          }
        }
      `}</style>

      <div className="certificate-toolbar">
        <div className="certificate-toolbar-left">
          <Link href="/student/certificates">
            ← My Certificates
          </Link>
        </div>

        <div className="certificate-toolbar-right">
          {!revoked && (
            <Link
              className="toolbar-primary"
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
          className="certificate-border-art"
          src="/brand/ruffneck-border-background.png"
          alt=""
          aria-hidden="true"
        />

        <img
          className="certificate-watermark"
          src="/brand/transparent-ruffneck-background.png"
          alt=""
          aria-hidden="true"
        />

        <div className="certificate-content">
          <header className="certificate-header">
            <img
              className="certificate-logo"
              src="/brand/ruffneck-logo.png"
              alt="RuffNeck Entertainment"
            />

            <div className="certificate-brand-copy">
              <h1 className="certificate-brand-name">
                RUFFNECK
              </h1>

              <div className="certificate-brand-subtitle">
                LEARN
              </div>

              <div className="certificate-brand-rule" />

              <div className="certificate-tagline">
                AI · DIGITAL TRANSFORMATION · BUSINESS SOLUTIONS
              </div>
            </div>
          </header>

          <aside className="certificate-medal-column">
            <img
              className="certificate-medal"
              src="/brand/ruffneck-certificate-seal.png"
              alt="RuffNeck certificate seal"
            />
          </aside>

          <section className="certificate-main">
            <p className="certificate-overline">
              RuffNeck Learn · Professional Development
            </p>

            <h2 className="certificate-title">
              CERTIFICATE
            </h2>

            <div className="certificate-title-subtitle">
              OF COMPLETION
            </div>

            <p className="certificate-this-is">
              This is to certify that
            </p>

            <p className="certificate-recipient">
              {certificate.holder_name}
            </p>

            <div className="certificate-recipient-rule" />

            <p className="certificate-recognition">
              has successfully completed the learning requirements for
              the following course and is recognized for this achievement.
            </p>

            <h3 className="certificate-course-title">
              {certificate.course_title}
            </h3>

            <div className="certificate-course-label">
              COURSE COMPLETION
            </div>

            <p className="certificate-achievement">
              Awarded in recognition of demonstrated learning,
              professional development, and commitment to practical
              skills.
            </p>
          </section>

          <aside className="certificate-details">
            {!revoked ? (
              <>
                <div className="certificate-qr-frame">
                  <img
                    className="certificate-qr"
                    src={qrUrl}
                    alt="Scan to verify this certificate"
                  />
                </div>

                <p className="certificate-verify-title">
                  VERIFY CREDENTIAL
                </p>

                <p className="certificate-verify-copy">
                  Scan to view the official certificate record.
                </p>
              </>
            ) : (
              <>
                <div className="certificate-qr-frame">
                  <span
                    style={{
                      color: "#a51d2d",
                      fontSize: 12,
                      fontWeight: 800,
                      textAlign: "center",
                    }}
                  >
                    NOT VALID
                  </span>
                </div>

                <p className="certificate-verify-title">
                  CREDENTIAL REVOKED
                </p>

                <p className="certificate-verify-copy">
                  This certificate is no longer valid.
                </p>
              </>
            )}

            <div className="certificate-number-label">
              CERTIFICATE NUMBER
            </div>

            <p className="certificate-number">
              {certificate.certificate_number}
            </p>

            <div className="certificate-detail-divider" />

            <p className="certificate-record-heading">
              CREDENTIAL RECORD
            </p>

            <div className="certificate-record-row">
              <span
                className="certificate-record-symbol"
                aria-hidden="true"
              >
                ◷
              </span>

              <div className="certificate-record-copy">
                <strong>Date issued</strong>
                {issuedDate}
              </div>
            </div>

            <div className="certificate-record-row">
              <span
                className="certificate-record-symbol"
                aria-hidden="true"
              >
                ✓
              </span>

              <div className="certificate-record-copy">
                <strong>Assessment score</strong>
                {formatScore(certificate.assessment_score)}
              </div>
            </div>

            <div className="certificate-record-row">
              <span
                className="certificate-record-symbol"
                aria-hidden="true"
              >
                ★
              </span>

              <div className="certificate-record-copy">
                <strong>Capstone score</strong>
                {formatScore(certificate.capstone_score)}
              </div>
            </div>
          </aside>

          <footer className="certificate-bottom">
            <div className="certificate-signature-block">
              {!revoked && (
                <img
                  className="certificate-signature-image"
                  src="/brand/founder-signature.png"
                  alt=""
                  aria-hidden="true"
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

            <div className="certificate-seals">
              {!revoked && (
                <>
                  <img
                    className="certificate-seal"
                    src="/brand/ruffneck-certificate-seal.png"
                    alt="Certificate seal"
                  />

                  <img
                    className="certificate-seal"
                    src="/brand/ruffneck-company-stamp.png"
                    alt="RuffNeck company stamp"
                  />

                  <img
                    className="certificate-seal"
                    src="/brand/ruffneck-security-stamp.png"
                    alt="Certificate security stamp"
                  />
                </>
              )}
            </div>

            <div className="certificate-signature-block">
              <div style={{ height: 32 }} />

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
            <div className="certificate-revoked">
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