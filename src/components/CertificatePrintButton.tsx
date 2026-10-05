"use client";

import { useState } from "react";

export default function CertificatePrintButton() {
  const [printing, setPrinting] = useState(false);

  function handlePrint() {
    setPrinting(true);

    window.setTimeout(() => {
      window.print();

      window.setTimeout(() => {
        setPrinting(false);
      }, 1000);
    }, 100);
  }

  return (
    <>
      <button
        type="button"
        onClick={handlePrint}
        disabled={printing}
        className="rn-button rn-button-primary"
        style={{
          minWidth: 170,
          justifyContent: "center",
          opacity: printing ? 0.7 : 1,
          cursor: printing ? "wait" : "pointer",
        }}
      >
        {printing ? "Preparing Certificate..." : "Print / Save PDF"}
      </button>

      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 0;
          }

          html,
          body {
            width: 297mm;
            height: 210mm;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          body * {
            visibility: hidden !important;
          }

          .certificate-print-area,
          .certificate-print-area * {
            visibility: visible !important;
          }

          .certificate-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 297mm !important;
            min-height: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            box-shadow: none !important;
            border: none !important;
          }

          .certificate-print-area button,
          .certificate-print-area a,
          .certificate-print-area .no-print {
            display: none !important;
          }

          .no-print,
          nav,
          header,
          footer {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}