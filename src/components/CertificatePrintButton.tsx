"use client";

export default function CertificatePrintButton() {
  function handlePrint() {
    window.print();
  }

  return (
    <button
      type="button"
      className="rn-button rn-button-primary"
      onClick={handlePrint}
      aria-label="Print or save certificate as PDF"
    >
      Print / Save PDF
    </button>
  );
}