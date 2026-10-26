import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CertificatePrintButton from "@/components/CertificatePrintButton";
import CertificateVerificationLink from "@/components/CertificateVerificationLink";
import CertificateJpgButton from "@/components/CertificateJpgButton";

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
  params: Promise<{
    id?: string;
    certificateId?: string;
  }>;
};

function formatDate(value: string) {
  const date = new Date(value);

  if (!value || Number.isNaN(date.getTime())) {
    return "Date not recorded";
  }

  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatScore(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "Not recorded";
  }

  return `${Math.min(100, Math.max(0, Math.round(value)))}%`;
}

function getVerificationUrl(certificateNumber: string) {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://ruffneck-lms.vercel.app";

  return `${baseUrl.replace(/\/+$/, "")}/verify/certificate-number/${encodeURIComponent(
    certificateNumber,
  )}`;
}

function getQrUrl(verificationUrl: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&format=png&margin=4&data=${encodeURIComponent(
    verificationUrl,
  )}`;
}

/**
 * Fetch the QR image on the server and embed it in the page as a data URL.
 * This avoids relying on a remote QR image when the browser exports the
 * certificate to JPG or prints it.
 *
 * If the QR provider is unavailable, the page still loads and provides
 * the certificate's direct verification link.
 */
async function getQrDataUrl(
  verificationUrl: string,
): Promise<string | null> {
  try {
    const response = await fetch(getQrUrl(verificationUrl), {
      signal: AbortSignal.timeout(5000),
      cache: "force-cache",
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.toLowerCase().startsWith("image/")) {
      return null;
    }

    const image = await response.arrayBuffer();

    if (image.byteLength === 0 || image.byteLength > 1_000_000) {
      return null;
    }

    const base64 = Buffer.from(image).toString("base64");

    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error(
      "Certificate QR image could not be loaded:",
      error,
    );
    return null;
  }
}

const CERTIFICATE_STYLES = `
  .rn-certificate-page {
    --cert-navy: #0b1e3a;
    --cert-gold: #c79a43;
    --cert-gold-light: #ead6a5;
    --cert-ink: #24334a;
    --cert-muted: #64748b;

    min-height: 100vh;
    padding: 26px 20px 42px;
    background: #f0f3f7;
    color: var(--cert-ink);
    font-family: Arial, Helvetica, sans-serif;
  }

  .rn-certificate-page *,
  .rn-certificate-page *::before,
  .rn-certificate-page *::after {
    box-sizing: border-box;
  }

  .rn-certificate-page a {
    text-underline-offset: 3px;
  }

  .rn-certificate-page .certificate-toolbar {
    width: min(1180px, 100%);
    margin: 0 auto 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .rn-certificate-page .certificate-toolbar-group {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .rn-certificate-page .certificate-toolbar a,
  .rn-certificate-page .certificate-toolbar button {
    min-height: 42px;
    padding: 10px 15px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #d4dce7;
    border-radius: 8px;
    background: #fff;
    color: var(--cert-navy);
    font-size: 13px;
    font-weight: 700;
    line-height: 1.5;
    text-decoration: none;
    cursor: pointer;
  }

  .rn-certificate-page .certificate-toolbar a:hover,
  .rn-certificate-page .certificate-toolbar button:hover {
    border-color: var(--cert-gold);
  }

  .rn-certificate-page .certificate-toolbar button:disabled {
    opacity: .65;
    cursor: wait;
  }

  .rn-certificate-page .certificate-toolbar .certificate-primary-action {
    background: var(--cert-navy);
    color: #fff;
    border-color: var(--cert-navy);
  }

  .rn-certificate-page .certificate-toolbar a:focus-visible,
  .rn-certificate-page .certificate-toolbar button:focus-visible {
    outline: 3px solid rgba(0, 180, 216, .4);
    outline-offset: 3px;
  }

  .rn-certificate-page .certificate-paper {
    position: relative;
    isolation: isolate;
    width: min(1180px, 100%);
    aspect-ratio: 297 / 210;
    margin: 0 auto;
    overflow: hidden;
    background: #fffefa;
    box-shadow: 0 16px 45px rgba(11, 30, 58, .16);
    container-type: inline-size;
  }

  .rn-certificate-page .certificate-border {
    position: absolute;
    z-index: 0;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: fill;
    pointer-events: none;
  }

  .rn-certificate-page .certificate-paper-background {
    position: absolute;
    z-index: 0;
    inset: 2%;
    background: rgba(255, 254, 250, .88);
    pointer-events: none;
  }

  .rn-certificate-page .certificate-watermark {
    position: absolute;
    z-index: 1;
    top: 48%;
    left: 48%;
    width: 43%;
    height: 64%;
    transform: translate(-50%, -50%);
    object-fit: contain;
    opacity: .10;
    pointer-events: none;
  }

  .rn-certificate-page .certificate-layout {
    position: absolute;
    z-index: 2;
    inset: 5.5% 5% 6%;
    display: grid;
    grid-template-columns: 18% minmax(0, 1fr) 18%;
    grid-template-rows: 21% minmax(0, 1fr) 23%;
    column-gap: 2%;
    min-width: 0;
  }

  .rn-certificate-page .certificate-header {
    grid-column: 1 / 3;
    grid-row: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2.5%;
    min-width: 0;
    padding: 0 1%;
  }

  .rn-certificate-page .certificate-logo {
    display: block;
    width: 22%;
    max-width: 165px;
    max-height: 92%;
    object-fit: contain;
    flex-shrink: 0;
  }

  .rn-certificate-page .certificate-brand {
    min-width: 0;
    text-align: center;
  }

  .rn-certificate-page .certificate-brand-name {
    margin: 0;
    color: var(--cert-navy);
    font-size: clamp(20px, 3.15cqw, 38px);
    font-weight: 900;
    line-height: 1;
    letter-spacing: .11em;
    white-space: nowrap;
  }

  .rn-certificate-page .certificate-brand-learn {
    margin-top: 4px;
    color: #a77824;
    font-size: clamp(10px, 1.25cqw, 15px);
    font-weight: 800;
    letter-spacing: .45em;
  }

  .rn-certificate-page .certificate-brand-rule {
    width: 82%;
    height: 2px;
    margin: 7px auto 6px;
    background: linear-gradient(90deg, transparent, var(--cert-gold), transparent);
  }

  .rn-certificate-page .certificate-tagline {
    color: #536176;
    font-size: clamp(6px, .75cqw, 9px);
    font-weight: 700;
    letter-spacing: .09em;
    white-space: nowrap;
  }

  .rn-certificate-page .certificate-left-seal {
    grid-column: 1;
    grid-row: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    padding: 5%;
  }

  .rn-certificate-page .certificate-medal {
    width: 100%;
    max-height: 85%;
    object-fit: contain;
  }

  .rn-certificate-page .certificate-main {
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

  .rn-certificate-page .certificate-kicker {
    margin: 0 0 4px;
    color: #a77824;
    font-size: clamp(7px, .8cqw, 10px);
    font-weight: 800;
    letter-spacing: .2em;
    text-transform: uppercase;
  }

  .rn-certificate-page .certificate-title {
    margin: 0;
    color: var(--cert-navy);
    font-family: Georgia, "Times New Roman", serif;
    font-size: clamp(27px, 4.1cqw, 49px);
    font-weight: 700;
    line-height: 1;
    letter-spacing: .045em;
    white-space: nowrap;
  }

  .rn-certificate-page .certificate-title-subtitle {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    margin: 7px 0 12px;
    color: #a77824;
    font-size: clamp(8px, 1.05cqw, 13px);
    font-weight: 800;
    letter-spacing: .3em;
    white-space: nowrap;
  }

  .rn-certificate-page .certificate-title-subtitle::before,
  .rn-certificate-page .certificate-title-subtitle::after {
    content: "";
    width: 35px;
    height: 1px;
    background: var(--cert-gold);
  }

  .rn-certificate-page .certificate-recipient-intro {
    margin: 0 0 3px;
    color: #48566c;
    font-size: clamp(8px, .83cqw, 10px);
    letter-spacing: .1em;
    text-transform: uppercase;
  }

  .rn-certificate-page .certificate-recipient {
    max-width: 100%;
    margin: 0;
    color: var(--cert-navy);
    font-family: "Brush Script MT", "Segoe Script", cursive;
    font-size: clamp(29px, 4.1cqw, 49px);
    font-weight: 500;
    line-height: 1.15;
    overflow-wrap: anywhere;
  }

  .rn-certificate-page .certificate-recipient-rule {
    width: 90%;
    height: 1px;
    margin: 7px 0 8px;
    background: linear-gradient(90deg, transparent, var(--cert-gold), transparent);
  }

  .rn-certificate-page .certificate-recognition {
    max-width: 95%;
    margin: 0 0 6px;
    color: #48566c;
    font-size: clamp(7px, .78cqw, 9px);
    line-height: 1.45;
  }

  .rn-certificate-page .certificate-course-title {
    max-width: 100%;
    margin: 0;
    color: var(--cert-navy);
    font-family: Georgia, "Times New Roman", serif;
    font-size: clamp(12px, 1.55cqw, 19px);
    font-weight: 800;
    line-height: 1.2;
    text-transform: uppercase;
    overflow-wrap: anywhere;
  }

  .rn-certificate-page .certificate-course-label {
    margin-top: 4px;
    color: #a77824;
    font-size: clamp(7px, .78cqw, 9px);
    font-weight: 800;
    letter-spacing: .22em;
  }

  .rn-certificate-page .certificate-achievement {
    max-width: 95%;
    margin: 7px 0 0;
    color: #59677a;
    font-size: clamp(7px, .72cqw, 9px);
    line-height: 1.4;
  }

  .rn-certificate-page .certificate-right-panel {
    grid-column: 3;
    grid-row: 1 / 3;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-width: 0;
    padding: 9% 4% 3%;
    border-left: 1px solid rgba(199, 154, 67, .85);
    text-align: center;
  }

  .rn-certificate-page .certificate-qr-frame {
    display: flex;
    align-items: center;
    justify-content: center;
    width: min(76%, 104px);
    aspect-ratio: 1;
    padding: 4px;
    border: 1px solid var(--cert-gold);
    background: #fff;
  }

  .rn-certificate-page .certificate-qr {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .rn-certificate-page .certificate-qr-fallback {
    color: var(--cert-muted);
    font-size: clamp(6px, .65cqw, 8px);
    line-height: 1.4;
  }

  .rn-certificate-page .certificate-verify-heading {
    margin: 7px 0 3px;
    color: var(--cert-navy);
    font-size: clamp(7px, .72cqw, 9px);
    font-weight: 900;
    letter-spacing: .05em;
  }

  .rn-certificate-page .certificate-verify-copy {
    margin: 0;
    color: var(--cert-muted);
    font-size: clamp(6px, .62cqw, 8px);
    line-height: 1.4;
  }

  .rn-certificate-page .certificate-number-label {
    width: 100%;
    margin-top: 9px;
    padding: 5px 3px;
    background: var(--cert-navy);
    color: #fff;
    font-size: clamp(6px, .61cqw, 8px);
    font-weight: 800;
    letter-spacing: .06em;
  }

  .rn-certificate-page .certificate-number {
    margin: 5px 0 0;
    color: var(--cert-navy);
    font-size: clamp(7px, .73cqw, 9px);
    font-weight: 800;
    overflow-wrap: anywhere;
  }

  .rn-certificate-page .certificate-record-divider {
    width: 100%;
    height: 1px;
    margin: 8px 0 6px;
    background: var(--cert-gold-light);
  }

  .rn-certificate-page .certificate-record-heading {
    width: 100%;
    margin: 0 0 5px;
    color: var(--cert-navy);
    font-size: clamp(6px, .65cqw, 8px);
    font-weight: 900;
    letter-spacing: .08em;
    text-align: left;
  }

  .rn-certificate-page .certificate-record-row {
    width: 100%;
    display: flex;
    align-items: flex-start;
    gap: 5px;
    margin: 4px 0;
    text-align: left;
  }

  .rn-certificate-page .certificate-record-icon {
    flex: 0 0 15px;
    color: #b17c22;
    font-size: 12px;
    font-weight: 900;
    text-align: center;
  }

  .rn-certificate-page .certificate-record-copy {
    min-width: 0;
    color: #5c6b80;
    font-size: clamp(6px, .59cqw, 7px);
    line-height: 1.35;
    overflow-wrap: anywhere;
  }

  .rn-certificate-page .certificate-record-copy strong {
    display: block;
    color: var(--cert-navy);
    font-size: clamp(6px, .65cqw, 8px);
  }

  .rn-certificate-page .certificate-footer {
    grid-column: 1 / 4;
    grid-row: 3;
    display: grid;
    grid-template-columns: 1fr 1.1fr 1fr;
    align-items: end;
    gap: 2%;
    min-width: 0;
    padding: 0 1% 1%;
  }

  .rn-certificate-page .certificate-signature {
    min-width: 0;
    text-align: center;
  }

  .rn-certificate-page .certificate-signature-image {
    display: block;
    width: 62%;
    height: 30px;
    margin: 0 auto;
    object-fit: contain;
    object-position: center bottom;
  }

  .rn-certificate-page .certificate-signature-space {
    height: 30px;
  }

  .rn-certificate-page .certificate-signature-line {
    width: 92%;
    height: 1px;
    margin: 0 auto 4px;
    background: var(--cert-gold);
  }

  .rn-certificate-page .certificate-signature-name {
    margin: 0;
    color: var(--cert-navy);
    font-size: clamp(7px, .73cqw, 9px);
    font-weight: 900;
  }

  .rn-certificate-page .certificate-signature-role {
    margin: 3px 0 0;
    color: #9b722c;
    font-size: clamp(6px, .61cqw, 7px);
    line-height: 1.3;
  }

  .rn-certificate-page .certificate-official-seals {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5%;
    min-width: 0;
  }

  .rn-certificate-page .certificate-official-seal {
    display: block;
    width: 27%;
    max-width: 76px;
    max-height: 72px;
    object-fit: contain;
  }

  .rn-certificate-page .certificate-revoked-overlay {
    position: absolute;
    z-index: 5;
    top: 44%;
    left: 50%;
    width: 72%;
    transform: translate(-50%, -50%) rotate(-7deg);
    padding: 10px;
    border: 4px solid #a51d2d;
    background: rgba(255, 255, 255, .96);
    color: #a51d2d;
    font-size: clamp(22px, 4cqw, 46px);
    font-weight: 900;
    letter-spacing: .14em;
    text-align: center;
  }

  .rn-certificate-page .certificate-revoked-reason {
    position: absolute;
    z-index: 6;
    top: 56%;
    left: 50%;
    width: 65%;
    transform: translateX(-50%);
    padding: 8px 12px;
    background: rgba(255, 255, 255, .97);
    color: #84202b;
    font-size: 11px;
    text-align: center;
  }

  .rn-certificate-page .certificate-revoked-notice {
    width: min(1180px, 100%);
    margin: 14px auto 0;
    padding: 12px 15px;
    border: 1px solid #efb4ba;
    border-radius: 8px;
    background: #fff4f4;
    color: #8b1d2b;
    font-size: 13px;
    line-height: 1.6;
  }

  .rn-certificate-page .certificate-verification-component {
    display: flex;
    justify-content: center;
    margin: 16px auto 0;
  }

  .rn-certificate-page .certificate-after-paper {
    width: min(1180px, 100%);
    margin: 16px auto 0;
    color: #66758a;
    font-size: 12px;
    line-height: 1.7;
    text-align: center;
  }

  .rn-certificate-page .certificate-after-paper p {
    margin: 7px 0;
  }

  .rn-certificate-page .certificate-after-paper a {
    color: var(--cert-navy);
    font-weight: 700;
  }

  @media (max-width: 700px) {
    .rn-certificate-page {
      padding: 12px 8px 25px;
    }

    .rn-certificate-page .certificate-paper {
      width: 100%;
      aspect-ratio: 297 / 210;
    }

    .rn-certificate-page .certificate-layout {
      inset: 5.5% 5% 6%;
    }

    .rn-certificate-page .certificate-brand-name {
      font-size: clamp(9px, 3.15cqw, 38px);
    }

    .rn-certificate-page .certificate-brand-learn {
      font-size: clamp(5px, 1.25cqw, 15px);
    }

    .rn-certificate-page .certificate-brand-rule {
      margin: 4px auto;
    }

    .rn-certificate-page .certificate-tagline {
      font-size: clamp(3px, .75cqw, 9px);
    }

    .rn-certificate-page .certificate-title {
      font-size: clamp(11px, 4.1cqw, 49px);
    }

    .rn-certificate-page .certificate-title-subtitle {
      gap: 4px;
      margin: 3px 0 5px;
      font-size: clamp(4px, 1.05cqw, 13px);
    }

    .rn-certificate-page .certificate-title-subtitle::before,
    .rn-certificate-page .certificate-title-subtitle::after {
      width: 12px;
    }

    .rn-certificate-page .certificate-kicker,
    .rn-certificate-page .certificate-recipient-intro {
      font-size: clamp(4px, .83cqw, 10px);
    }

    .rn-certificate-page .certificate-recipient {
      font-size: clamp(11px, 4.1cqw, 49px);
    }

    .rn-certificate-page .certificate-recognition {
      font-size: clamp(4px, .78cqw, 9px);
    }

    .rn-certificate-page .certificate-course-title {
      font-size: clamp(6px, 1.55cqw, 19px);
    }

    .rn-certificate-page .certificate-course-label,
    .rn-certificate-page .certificate-achievement {
      font-size: clamp(4px, .72cqw, 9px);
    }

    .rn-certificate-page .certificate-right-panel {
      padding: 9% 4% 3%;
    }

    .rn-certificate-page .certificate-verify-heading,
    .rn-certificate-page .certificate-verify-copy,
    .rn-certificate-page .certificate-number-label,
    .rn-certificate-page .certificate-number,
    .rn-certificate-page .certificate-record-copy,
    .rn-certificate-page .certificate-record-copy strong,
    .rn-certificate-page .certificate-record-heading {
      overflow-wrap: anywhere;
    }

    .rn-certificate-page .certificate-verify-heading,
    .rn-certificate-page .certificate-record-copy strong,
    .rn-certificate-page .certificate-record-heading {
      font-size: clamp(4px, .65cqw, 8px);
    }

    .rn-certificate-page .certificate-verify-copy,
    .rn-certificate-page .certificate-number-label,
    .rn-certificate-page .certificate-record-copy {
      font-size: clamp(4px, .62cqw, 8px);
    }

    .rn-certificate-page .certificate-number {
      font-size: clamp(4px, .73cqw, 9px);
    }

    .rn-certificate-page .certificate-signature-image,
    .rn-certificate-page .certificate-signature-space {
      height: 20px;
    }

    .rn-certificate-page .certificate-signature-name {
      font-size: clamp(4px, .73cqw, 9px);
    }

    .rn-certificate-page .certificate-signature-role {
      font-size: clamp(3px, .61cqw, 7px);
    }

    .rn-certificate-page .certificate-official-seal {
      max-height: 72px;
    }

    .rn-certificate-page .certificate-toolbar {
      align-items: stretch;
    }

    .rn-certificate-page .certificate-toolbar-group {
      gap: 7px;
    }

    .rn-certificate-page .certificate-toolbar a,
    .rn-certificate-page .certificate-toolbar button {
      min-height: 40px;
      padding: 9px 11px;
      font-size: 12px;
    }
  }

  @media (max-width: 420px) {
    .rn-certificate-page .certificate-toolbar {
      flex-direction: column;
    }

    .rn-certificate-page .certificate-toolbar-group {
      width: 100%;
    }

    .rn-certificate-page .certificate-toolbar-group a,
    .rn-certificate-page .certificate-toolbar-group button {
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

    .rn-certificate-page .certificate-paper,
    .rn-certificate-page .certificate-paper * {
      visibility: visible !important;
    }

    .rn-certificate-page {
      position: static !important;
      width: 297mm !important;
      height: 210mm !important;
      min-height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
      background: #fff !important;
    }

    .rn-certificate-page .certificate-toolbar,
    .rn-certificate-page .certificate-verification-component,
    .rn-certificate-page .certificate-after-paper,
    .rn-certificate-page .certificate-revoked-notice {
      display: none !important;
    }

    .rn-certificate-page .certificate-paper {
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

    .rn-certificate-page .certificate-layout {
      position: absolute !important;
      inset: 5.5% 5% 6% !important;
      display: grid !important;
      grid-template-columns: 18% minmax(0, 1fr) 18% !important;
      grid-template-rows: 21% minmax(0, 1fr) 23% !important;
      column-gap: 2% !important;
      gap: 0 !important;
      padding: 0 !important;
    }

    .rn-certificate-page .certificate-header {
      grid-column: 1 / 3 !important;
      grid-row: 1 !important;
      display: flex !important;
    }

    .rn-certificate-page .certificate-left-seal {
      display: flex !important;
      grid-column: 1 !important;
      grid-row: 2 !important;
    }

    .rn-certificate-page .certificate-main {
      grid-column: 2 !important;
      grid-row: 2 !important;
      padding: 0 1% !important;
    }

    .rn-certificate-page .certificate-title {
      font-size: 4.1cqw !important;
      white-space: nowrap !important;
    }

    .rn-certificate-page .certificate-recipient {
      font-size: 4.1cqw !important;
    }

    .rn-certificate-page .certificate-course-title {
      font-size: 1.55cqw !important;
    }

    .rn-certificate-page .certificate-right-panel {
      grid-column: 3 !important;
      grid-row: 1 / 3 !important;
      border-left: 1px solid rgba(199, 154, 67, .85) !important;
      border-top: 0 !important;
      padding: 9% 4% 3% !important;
    }

    .rn-certificate-page .certificate-footer {
      grid-column: 1 / 4 !important;
      grid-row: 3 !important;
      display: grid !important;
      grid-template-columns: 1fr 1.1fr 1fr !important;
      gap: 2% !important;
      padding: 0 1% 1% !important;
    }

    .rn-certificate-page .certificate-official-seals {
      grid-column: auto !important;
      grid-row: auto !important;
    }

    .rn-certificate-page .certificate-official-seal {
      width: 27% !important;
      max-width: 76px !important;
      max-height: 72px !important;
    }

    .rn-certificate-page .certificate-revoked-overlay {
      font-size: 4cqw !important;
    }
  }
`;

export default async function CertificatePage({
  params,
}: PageProps) {
  const routeParams = await params;

  const certificateId =
    routeParams.id ?? routeParams.certificateId;

  if (!certificateId) {
    notFound();
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?next=/student/certificates/${encodeURIComponent(
        certificateId,
      )}`,
    );
  }

  const { data, error } = await supabase
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
      ].join(", "),
    )
    .eq("id", certificateId)
    .eq("student_id", user.id)
    .maybeSingle();

  if (error) {
    console.error(
      "Certificate retrieval failed:",
      error,
    );

    throw new Error(
      "Unable to load this certificate.",
    );
  }

  if (!data) {
    notFound();
  }

  /*
   * Fix for the reported TypeScript build error:
   * Supabase's generated types infer this selection as GenericStringError.
   * Cast through unknown before applying the page's Certificate shape.
   */
  const certificate =
    data as unknown as Certificate;

  const revoked = certificate.is_revoked;
  const issuedDate = formatDate(certificate.issued_at);

  const verificationUrl = getVerificationUrl(
    certificate.certificate_number,
  );

  const qrDataUrl = revoked
    ? null
    : await getQrDataUrl(verificationUrl);

  return (
    <main className="rn-certificate-page">
      <style>{CERTIFICATE_STYLES}</style>

      <div className="certificate-toolbar">
        <div className="certificate-toolbar-group">
          <Link href="/student/certificates">
            ← My Certificates
          </Link>
        </div>

        <div className="certificate-toolbar-group">
          {!revoked && (
            <>
              <Link
                className="certificate-primary-action"
                href={`/verify/certificate-number/${encodeURIComponent(
                  certificate.certificate_number,
                )}`}
                target="_blank"
                rel="noreferrer"
              >
                Verify Certificate
              </Link>

              <CertificatePrintButton />
              <CertificateJpgButton />
            </>
          )}
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
              for successfully completing the learning requirements for
              the following course:
            </p>

            <h3 className="certificate-course-title">
              {certificate.course_title}
            </h3>

            <div className="certificate-course-label">
              COURSE COMPLETION
            </div>

            <p className="certificate-achievement">
              Awarded in recognition of demonstrated learning, professional
              development, and commitment to practical skills.
            </p>
          </section>

          <aside className="certificate-right-panel">
            {!revoked ? (
              <>
                <div className="certificate-qr-frame">
                  {qrDataUrl ? (
                    <img
                      className="certificate-qr"
                      src={qrDataUrl}
                      alt="QR code for certificate verification"
                    />
                  ) : (
                    <span className="certificate-qr-fallback">
                      QR code unavailable. Use the verification link below.
                    </span>
                  )}
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
                LEARNING &amp; PROFESSIONAL DEVELOPMENT
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
          <strong>
            This certificate has been revoked.
          </strong>{" "}
          It must not be presented as a valid credential.
          {certificate.revoked_reason
            ? ` Reason: ${certificate.revoked_reason}`
            : ""}
        </div>
      )}

      {!revoked && (
        <>
          <div className="certificate-verification-component">
            <CertificateVerificationLink
              certificateNumber={certificate.certificate_number}
            />
          </div>

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

            {!qrDataUrl && (
              <p>
                The QR image could not be loaded. The certificate verification
                link remains available above.
              </p>
            )}
          </div>
        </>
      )}
    </main>
  );
}