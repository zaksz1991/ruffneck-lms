"use client";

import { useState } from "react";
import { toBlob } from "html-to-image";

const IMAGE_WAIT_TIMEOUT_MS = 12000;

function waitForImage(image: HTMLImageElement): Promise<void> {
  if (image.complete) {
    return image.naturalWidth > 0
      ? Promise.resolve()
      : Promise.reject(new Error("A certificate image did not load."));
  }

  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("A certificate image timed out while loading."));
    }, IMAGE_WAIT_TIMEOUT_MS);

    const cleanup = () => {
      window.clearTimeout(timeout);
      image.removeEventListener("load", onLoad);
      image.removeEventListener("error", onError);
    };

    const onLoad = () => {
      cleanup();
      if (image.naturalWidth > 0) resolve();
      else reject(new Error("A certificate image did not load."));
    };

    const onError = () => {
      cleanup();
      reject(new Error("A certificate image did not load."));
    };

    image.addEventListener("load", onLoad, { once: true });
    image.addEventListener("error", onError, { once: true });
  });
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.rel = "noopener";
  link.style.position = "absolute";
  link.style.left = "-10000px";
  document.body.appendChild(link);

  try {
    // A Blob URL avoids the very large base64 data URLs produced by toJpeg.
    link.click();
  } finally {
    link.remove();
    // Give browsers time to begin the download before releasing the Blob URL.
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  }
}

export default function CertificateJpgButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function downloadJpg() {
    const certificate = document.querySelector<HTMLElement>(
      ".certificate-paper"
    );

    if (!certificate) {
      setError(true);
      setMessage("Certificate not found. Reload the certificate page and try again.");
      return;
    }

    if (certificate.offsetWidth < 1 || certificate.offsetHeight < 1) {
      setError(true);
      setMessage("The certificate is not ready to export. Reload the page and try again.");
      return;
    }

    setLoading(true);
    setError(false);
    setMessage("Preparing certificate image…");

    try {
      if ("fonts" in document && document.fonts?.ready) {
        await document.fonts.ready;
      }

      const images = Array.from(certificate.querySelectorAll("img"));
      await Promise.all(images.map(waitForImage));

      // Use Blob output instead of a base64 data URL for more reliable downloads
      // and lower memory use, especially for high-resolution certificates.
      const blob = await toBlob(certificate, {
        quality: 0.96,
        pixelRatio: 2,
        backgroundColor: "#fffefa",
        cacheBust: true,
        width: certificate.offsetWidth,
        height: certificate.offsetHeight,
      });

      if (!(blob instanceof Blob) || blob.size === 0) {
        throw new Error("The certificate image was empty.");
      }

      const filename = "ruffneck-certificate.jpg";
      triggerBlobDownload(blob, filename);
      setMessage("JPG download started. Check your Downloads folder.");
    } catch (cause) {
      console.error("Certificate JPG export failed:", cause);
      setError(true);
      setMessage(
        "Could not create the JPG. Check that certificate artwork has loaded, then try again. You can use Print / Save PDF as a fallback."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={downloadJpg}
        disabled={loading}
        className="certificate-action-button"
        aria-busy={loading}
      >
        {loading ? "Creating JPG…" : "Download JPG"}
      </button>
      {message ? (
        <p
          role={error ? "alert" : "status"}
          aria-live="polite"
          style={{
            maxWidth: 320,
            margin: "8px 0 0",
            color: error ? "#a51d2d" : "#526174",
            fontSize: 12,
            lineHeight: 1.45,
          }}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
