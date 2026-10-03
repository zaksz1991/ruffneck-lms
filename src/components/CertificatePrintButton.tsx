"use client";

export default function CertificatePrintButton() {
  return (
    <button
      type="button"
      className="rn-button rn-button-primary"
      onClick={() => window.print()}
    >
      Print / Save PDF
    </button>
  );
}