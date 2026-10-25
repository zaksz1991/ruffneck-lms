"use client";

import { useEffect, useRef, useState } from "react";
import { toCanvas } from "html-to-image";
import { QRCodeSVG } from "qrcode.react";

type ExportStatus = "idle" | "working" | "success" | "error";
const IMAGE_WAIT_TIMEOUT_MS = 15000;
const QR_SIZE = 240;

function getVerificationValue(): string {
  const image = document.querySelector<HTMLImageElement>(
    ".certificate-paper .certificate-qr",
  );
  if (!image) return "";

  try {
    const source = new URL(image.currentSrc || image.src, window.location.href);
    return source.searchParams.get("data")?.trim() ?? "";
  } catch {
    return "";
  }
}

function waitForImage(image: HTMLImageElement): Promise<void> {
  if (image.complete) {
    return image.naturalWidth > 0
      ? Promise.resolve()
      : Promise.reject(new Error("A certificate image did not load."));
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
      image.naturalWidth > 0
        ? resolve()
        : reject(new Error("A certificate image loaded without usable dimensions."));
    };
    const onError = () => {
      cleanup();
      reject(new Error("A certificate image failed to load."));
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
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.size === 0) {
          reject(new Error("The browser could not create a certificate image."));
          return;
        }
        if (blob.type !== "image/jpeg") {
          reject(
            new Error(
              `The browser returned ${blob.type || "an unknown format"} instead of JPEG.`,
            ),
          );
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

function getCertificateFilename(certificate: HTMLElement): string {
  const code = certificate
    .querySelector(".certificate-number")
    ?.textContent?.trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return code
    ? `ruffneck-certificate-${code}.jpg`
    : "ruffneck-certificate.jpg";
}

function triggerDownload(blobUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  link.rel = "noopener";
  link.style.position = "absolute";
  link.style.left = "-10000px";
  link.style.top = "0";
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
  }
}

export default function CertificateJpgButton() {
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [message, setMessage] = useState("");
  const [verificationValue, setVerificationValue] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [downloadFilename, setDownloadFilename] = useState("ruffneck-certificate.jpg");
  const qrSvgRef = useRef<HTMLDivElement>(null);
  const objectUrlRef = useRef("");

  useEffect(() => {
    setVerificationValue(getVerificationValue());
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

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
    if (!verificationValue) {
      setStatus("error");
      setMessage("The certificate verification QR code is not ready. Reload the page and try again.");
      return;
    }

    const originalQr = certificate.querySelector<HTMLImageElement>(".certificate-qr");
    const renderedQr = qrSvgRef.current?.querySelector<SVGSVGElement>("svg");
    if (!originalQr || !renderedQr) {
      setStatus("error");
      setMessage("The local verification QR code is not ready. Reload the page and try again.");
      return;
    }

    setStatus("working");
    setMessage("Preparing a print-quality JPEG…");
    let replacementQr: SVGSVGElement | null = null;

    try {
      // The certificate page normally uses a third-party QR image. Such images can
      // taint or block DOM-to-canvas export. Replace it temporarily with a local SVG.
      replacementQr = renderedQr.cloneNode(true) as SVGSVGElement;
      replacementQr.setAttribute("class", "certificate-qr");
      replacementQr.setAttribute("width", String(QR_SIZE));
      replacementQr.setAttribute("height", String(QR_SIZE));
      replacementQr.style.display = "block";
      replacementQr.style.width = "100%";
      replacementQr.style.height = "100%";
      originalQr.replaceWith(replacementQr);

      if ("fonts" in document && document.fonts?.ready) {
        await document.fonts.ready;
      }

      const images = Array.from(certificate.querySelectorAll("img"));
      await Promise.all(images.map(waitForImage));
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );

      const canvas = await toCanvas(certificate, {
        pixelRatio: 3,
        backgroundColor: "#fffefa",
        cacheBust: true,
        width: certificate.offsetWidth,
        height: certificate.offsetHeight,
      });
      const blob = await canvasToJpeg(canvas, 0.96);
      const filename = getCertificateFilename(certificate);
      const nextUrl = URL.createObjectURL(blob);

      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = nextUrl;
      setDownloadUrl(nextUrl);
      setDownloadFilename(filename);

      // This immediate download works in browsers that allow an async-generated
      // Blob download. A visible ordinary download link below is retained as a
      // fallback for Safari/mobile browsers that ignore programmatic clicks.
      triggerDownload(nextUrl, filename);
      setStatus("success");
      setMessage("JPG created. If the download did not start automatically, use the download link below.");
    } catch (cause) {
      console.error("Certificate JPEG export failed:", cause);
      setStatus("error");
      setMessage(
        "The JPG could not be created because certificate artwork failed to load or could not be captured. Reload the certificate page and try again. Print / Save PDF remains available as a fallback.",
      );
    } finally {
      // Restore the page's original verification QR after rasterization.
      if (replacementQr?.parentNode) replacementQr.replaceWith(originalQr);
    }
  }

  return (
    <div>
      {verificationValue ? (
        <div
          ref={qrSvgRef}
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "-10000px",
            top: 0,
            width: QR_SIZE,
            height: QR_SIZE,
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          <QRCodeSVG
            value={verificationValue}
            size={QR_SIZE}
            level="H"
            marginSize={4}
            bgColor="#ffffff"
            fgColor="#000000"
          />
        </div>
      ) : null}

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

      {status === "success" && downloadUrl ? (
        <p style={{ maxWidth: 340, margin: "8px 0 0", fontSize: 13, lineHeight: 1.5 }}>
          <a
            href={downloadUrl}
            download={downloadFilename}
            style={{ color: "#0b1e3a", fontWeight: 800, textDecoration: "underline" }}
          >
            Download JPG file
          </a>
        </p>
      ) : null}
    </div>
  );
}
