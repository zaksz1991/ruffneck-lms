"use client";

export default function PrintVerificationButton() {
  function handlePrint() {
    window.print();
  }

  return (
    <button
      type="button"
      className="rn-button rn-button-primary"
      onClick={handlePrint}
    >
      Print / Save as PDF
    </button>
  );
}