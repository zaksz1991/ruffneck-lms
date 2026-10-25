"use client";

import { useState } from "react";

type Props = {
  /** CSS selector for the actual certificate sheet, not the whole page. */
  targetSelector?: string;
  /** Safe filename stem; certificate number is preferred. */
  filename?: string;
  /** Revoked certificates should not offer export. */
  disabled?: boolean;
};

function waitForImage(image: HTMLImageElement): Promise<void> {
  if (image.complete && image.naturalWidth > 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const finish = () => {
      image.removeEventListener("load", onLoad);
      image.removeEventListener("error", onError);
    };
    const onLoad = () => { finish(); resolve(); };
    const onError = () => { finish(); reject(new Error(`An image could not be loaded: ${image.currentSrc || image.src}`)); };
    image.addEventListener("load", onLoad, { once: true });
    image.addEventListener("error", onError, { once: true });
  });
}

function safeFilename(value: string): string {
  return value.trim().replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "ruffneck-learn-certificate";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default function CertificateExportActions({
  targetSelector = ".certificate-paper, .mc-paper, .rn-certificate-document",
  filename = "ruffneck-learn-certificate",
  disabled = false,
}: Props) {
  const [busy, setBusy] = useState<"jpg" | "pdf" | null>(null);
  const [message, setMessage] = useState("");

  async function exportJpg() {
    if (disabled || busy) return;
    setBusy("jpg");
    setMessage("");
    try {
      const target = document.querySelector<HTMLElement>(targetSelector);
      if (!target) throw new Error("The certificate sheet could not be found. Refresh the page and try again.");

      if ("fonts" in document) await document.fonts.ready;
      const images = Array.from(target.querySelectorAll("img"));
      await Promise.all(images.map(waitForImage));

      // Dynamic import keeps the server-rendered certificate route free of DOM-only code.
      const moduleName = "html2canvas";
      const loaded = await import(/* webpackChunkName: "certificate-export" */ moduleName) as {
        default?: (element: HTMLElement, options: Record<string, unknown>) => Promise<HTMLCanvasElement>;
      };
      const render = loaded.default;
      if (!render) throw new Error("The image-export module did not load. Please try Print / Save as PDF instead.");

      const canvas = await render(target, {
        backgroundColor: "#fffefa",
        scale: Math.min(3, Math.max(2, window.devicePixelRatio || 1)),
        useCORS: true,
        allowTaint: false,
        logging: false,
        imageTimeout: 15000,
        width: target.scrollWidth,
        height: target.scrollHeight,
        windowWidth: Math.max(document.documentElement.clientWidth, target.scrollWidth),
        windowHeight: Math.max(document.documentElement.clientHeight, target.scrollHeight),
        onclone: (clonedDocument: Document) => {
          const clonedTarget = clonedDocument.querySelector<HTMLElement>(targetSelector);
          if (clonedTarget) {
            clonedTarget.style.width = `${target.scrollWidth}px`;
            clonedTarget.style.height = `${target.scrollHeight}px`;
            clonedTarget.style.maxWidth = "none";
            clonedTarget.style.aspectRatio = "auto";
            clonedTarget.style.overflow = "hidden";
          }
          clonedDocument.querySelectorAll(".no-print, .certificate-toolbar, .mc-toolbar").forEach((node) => {
            (node as HTMLElement).style.display = "none";
          });
        },
      });

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => result ? resolve(result) : reject(new Error("The browser could not create the JPG file.")), "image/jpeg", 0.96);
      });
      if (blob.size < 1000) throw new Error("The generated image is empty. Check that certificate images are loaded and try again.");
      downloadBlob(blob, `${safeFilename(filename)}.jpg`);
      setMessage("JPG downloaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "JPG export failed. Try Print / Save as PDF.");
    } finally {
      setBusy(null);
    }
  }

  function printPdf() {
    if (disabled || busy) return;
    setMessage("In the print dialog, choose Save as PDF, Landscape, and A4.");
    window.print();
  }

  return (
    <div className="certificate-export-actions no-print" aria-label="Certificate downloads">
      <button type="button" onClick={exportJpg} disabled={disabled || busy !== null}>
        {busy === "jpg" ? "Preparing JPG…" : "Download JPG"}
      </button>
      <button type="button" onClick={printPdf} disabled={disabled || busy !== null}>
        Download PDF
      </button>
      <span role="status" aria-live="polite">{message}</span>
      <style jsx>{`
        .certificate-export-actions { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        button { min-height:40px; padding:9px 14px; border:1px solid #d8dee8; border-radius:7px; background:#fff; color:#0b1e3a; font:700 13px/1.2 Arial,sans-serif; cursor:pointer; }
        button:disabled { opacity:.65; cursor:wait; }
        [role="status"] { flex-basis:100%; color:#536176; font:12px/1.4 Arial,sans-serif; }
        @media print { .certificate-export-actions { display:none !important; } }
      `}</style>
    </div>
  );
}
