"use client";

import { useState } from "react";
import { toCanvas } from "html-to-image";

const IMAGE_WAIT_TIMEOUT_MS = 15000;

type ExportStatus = "idle" | "working" | "success" | "error";

function waitForImage(image: HTMLImageElement): Promise<void> {
  if (image.complete) {
    return image.naturalWidth > 0
      ? Promise.resolve()
      : Promise.reject(new Error(`Certificate image failed to load: ${image.currentSrc || image.src}`));
  }

  return new Promise<void>((resolve, reject) => {
    let timeoutId = 0;

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      image.removeEventListener("load", onLoad);
      image.removeEventListener("error", onError);
    };

    const onLoad = () => {
      cleanup();
      if (image.naturalWidth > 0) resolve();
      else reject(new Error("A certificate image loaded without usable dimensions."));
    };

    const onError = () => {
      cleanup();
      reject(new Error(`Certificate image failed to load: ${image.currentSrc || image.src}`));
    };

    timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("A certificate image timed out while loading."));
    }, IMAGE_WAIT_TIMEOUT_MS);

    image.addEventListener("load", onLoad, { once: true });
    image.addEventListener("error", onError, { once: true });
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // Explicitly request JPEG. canvas.toBlob() defaults to PNG when no MIME type
    // is supplied, which previously produced PNG bytes named with a .jpg suffix.
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.size === 0) {
          reject(new Error("The browser could not create a certificate image."));
          return;
        }
        if (blob.type !== "image/jpeg") {
          reject(new Error(`The browser returned ${blob.type || "an unknown image format"} instead of JPEG.`));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.rel = "noopener";
  link.style.position = "absolute";
  link.style.left = "-10000px";
  document.body.appendChild(link);

  try {
    link.click();
  } finally {
    link.remove();
    // Allow browsers time to start the download before releasing the URL.
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
  }
}

export default function CertificateJpgButton() {
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [message, setMessage] = useState("");

  async function downloadJpg() {
    if (status === "working") return;

    const certificate = document.querySelector<HTMLElement>(".certificate-paper");
    if (!certificate) {
      setStatus("error");
      setMessage("Certificate not found. Reload the certificate page and try again.");
      return;
    }

    if (certificate.offsetWidth < 1 || certificate.offsetHeight < 1) {
      setStatus("error");
      setMessage("The certificate is not visible yet. Reload the page and try again.");
      return;
    }

    setStatus("working");
    setMessage("Preparing a print-quality JPEG…");

    try {
      if ("fonts" in document && document.fonts?.ready) {
        await document.fonts.ready;
      }

      const images = Array.from(certificate.querySelectorAll("img"));
      await Promise.all(images.map(waitForImage));

      // Wait for the browser to finish painting after fonts and image decoding.
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

      const canvas = await toCanvas(certificate, {
        pixelRatio: 3,
        backgroundColor: "#fffefa",
        cacheBust: true,
        width: certificate.offsetWidth,
        height: certificate.offsetHeight,
      });

      const blob = await canvasToJpeg(canvas, 0.96);
      downloadBlob(blob, "ruffneck-certificate.jpg");

      setStatus("success");
      setMessage("JPEG downloaded. Open ruffneck-certificate.jpg and print it in landscape orientation.");
    } catch (cause) {
      console.error("Certificate JPEG export failed:", cause);
      setStatus("error");
      setMessage(
        "The JPG could not be created because some certificate artwork did not load or could not be captured. Reload the certificate page, wait for the QR code and logos to appear, then try again. Use Print / Save PDF if the image still fails.",
      );
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={downloadJpg}
        disabled={status === "working"}
        className="certificate-action-button"
        aria-busy={status === "working"}
      >
        {status === "working" ? "Creating JPG…" : "Download JPG"}
      </button>
      {message ? (
        <p
          role={status === "error" ? "alert" : "status"}
          aria-live="polite"
          style={{
            maxWidth: 340,
            margin: "8px 0 0",
            color: status === "error" ? "#a51d2d" : status === "success" ? "#166534" : "#526174",
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
