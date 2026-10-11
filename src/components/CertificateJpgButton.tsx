"use client";

import { useState } from "react";
import { toJpeg } from "html-to-image";

export default function CertificateJpgButton() {
  const [loading, setLoading] = useState(false);

  async function downloadJpg() {
    const certificate = document.querySelector<HTMLElement>(
      ".certificate-paper"
    );

    if (!certificate) {
      alert("Certificate not found.");
      return;
    }

    try {
      setLoading(true);

      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      const images = Array.from(certificate.querySelectorAll("img"));

      await Promise.all(
        images.map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) {
                resolve();
                return;
              }

              img.onload = () => resolve();
              img.onerror = () => resolve();
            })
        )
      );

      const dataUrl = await toJpeg(certificate, {
        quality: 1,
        pixelRatio: 3,
        backgroundColor: "#fffefa",
        cacheBust: true,
        width: certificate.offsetWidth,
        height: certificate.offsetHeight,
      });

      const link = document.createElement("a");
      link.download = "ruffneck-certificate.jpg";
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Certificate JPG export failed:", error);
      alert("Could not create the JPG. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={downloadJpg}
      disabled={loading}
      className="certificate-action-button"
    >
      {loading ? "Creating JPG..." : "Download JPG"}
    </button>
  );
}