"use client";

import { useState } from "react";

function waitForImage(image: HTMLImageElement, timeoutMs = 3500): Promise<void> {
  return new Promise((resolve) => {
    if (image.complete) {
      resolve();
      return;
    }

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeout);
      image.removeEventListener("load", finish);
      image.removeEventListener("error", finish);
      resolve();
    };

    const timeout = window.setTimeout(finish, timeoutMs);
    image.addEventListener("load", finish, { once: true });
    image.addEventListener("error", finish, { once: true });
  });
}

export default function CertificatePrintButton() {
  const [printing, setPrinting] = useState(false);

  async function handlePrint() {
    if (printing) return;

    const certificate = document.querySelector<HTMLElement>(".certificate-paper");
    if (!certificate) {
      window.alert("The certificate preview could not be found. Reload the page and try again.");
      return;
    }

    setPrinting(true);

    try {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      const images = Array.from(certificate.querySelectorAll<HTMLImageElement>("img"));
      await Promise.all(images.map((image) => waitForImage(image)));

      // Let layout and image dimensions settle before the browser opens print preview.
      await new Promise<void>((resolve) => window.setTimeout(resolve, 180));
      window.print();
    } catch (error) {
      console.error("Certificate print preparation failed:", error);
      window.print();
    } finally {
      window.setTimeout(() => setPrinting(false), 700);
    }
  }

  return (
    <div
      className="certificate-print-action"
      style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 5 }}
    >
      <button
        type="button"
        onClick={handlePrint}
        disabled={printing}
        className="certificate-primary-action"
        style={{
          minHeight: 42,
          minWidth: 190,
          padding: "10px 15px",
          border: "1px solid #0b1e3a",
          borderRadius: 7,
          background: "#0b1e3a",
          color: "#fff",
          fontSize: 13,
          fontWeight: 700,
          cursor: printing ? "wait" : "pointer",
          opacity: printing ? 0.7 : 1,
        }}
      >
        {printing ? "Preparing Certificate…" : "Print A4 Landscape / Save PDF"}
      </button>
      <span
        className="certificate-print-hint"
        style={{ color: "#64748b", fontSize: 11, lineHeight: 1.35, textAlign: "center" }}
      >
        Optimised for one A4 landscape page. If print preview says Portrait, select Landscape.
      </span>
    </div>
  );
}
