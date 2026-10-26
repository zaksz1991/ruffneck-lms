"use client";

export default function PrintVerificationButton() {
  function handlePrint() {
    if (typeof window === "undefined") {
      return;
    }

    window.print();
  }

  return (
    <>
      <button
        type="button"
        className="rn-button rn-button-primary rn-print-trigger"
        onClick={handlePrint}
        aria-label="Print Skill Passport verification or save it as a PDF"
      >
        Print / Save as PDF
      </button>

      <style jsx global>{`
        @page {
          size: auto;
          margin: 12mm;
        }

        @media print {
          html,
          body {
            width: 100% !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .page-shell {
            width: 100% !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          .rn-verification-actions {
            display: none !important;
          }

          .rn-verification-print-area {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            color: #0b1e3a !important;
            background: #ffffff !important;
          }

          .rn-verification-print-area .card {
            box-shadow: none !important;
            background: #ffffff !important;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .rn-verification-print-area h1,
          .rn-verification-print-area h2,
          .rn-verification-print-area h3 {
            break-after: avoid;
            page-break-after: avoid;
          }

          .rn-verification-print-area article {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .rn-verification-print-area .muted {
            color: #475569 !important;
          }

          .rn-verification-print-area a {
            color: inherit !important;
            text-decoration: none !important;
          }

          .rn-verification-print-area img,
          .rn-verification-print-area svg {
            max-width: 100% !important;
          }

          .rn-print-trigger {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}