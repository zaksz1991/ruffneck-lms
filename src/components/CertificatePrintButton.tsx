"use client";

import { useState } from "react";

export default function CertificatePrintButton() {
  const [printing, setPrinting] = useState(false);

  function handlePrint() {
    if (printing) {
      return;
    }

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
        {printing
          ? "Preparing Certificate..."
          : "Print / Save PDF"}
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

          .rn-certificate-document,
          .rn-certificate-document * {
            visibility: visible !important;
          }

          .rn-certificate-document {
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

          .rn-certificate-document
            .rn-certificate-verification {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .rn-certificate-document
            .rn-certificate-border {
            width: 100% !important;
            min-height: 210mm !important;
            box-sizing: border-box !important;
          }

          .rn-certificate-document
            .no-print,
          .rn-certificate-document
            button,
          .rn-certificate-document
            a {
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