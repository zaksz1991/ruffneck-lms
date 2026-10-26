"use client";

import { useEffect, useRef, useState } from "react";
import { toCanvas } from "html-to-image";
import { QRCodeSVG } from "qrcode.react";

type ExportStatus = "idle" | "working" | "success" | "error";

const IMAGE_WAIT_TIMEOUT_MS = 15000;
const QR_SIZE = 240;

type RemovedImage = {
  image: HTMLImageElement;
  parent: Node;
  nextSibling: Node | null;
  index: number;
};

function getVerificationValue(): string {
  // Prefer the actual verification link rendered on the certificate page.
  const verificationLink =
    document.querySelector<HTMLAnchorElement>(
      '.certificate-toolbar a[href*="/verify/certificate-number/"]',
    );

  if (verificationLink?.href) {
    try {
      const url = new URL(
        verificationLink.href,
        window.location.origin,
      );

      if (url.pathname.includes("/verify/certificate-number/")) {
        return url.href;
      }
    } catch {
      // Continue to the certificate-number fallback.
    }
  }

  // The QR image may now be a data URL, so its original query parameters
  // cannot be used to recover the verification address.
  const certificateNumber = document
    .querySelector(".certificate-paper .certificate-number")
    ?.textContent?.trim();

  if (certificateNumber) {
    return `${window.location.origin}/verify/certificate-number/${encodeURIComponent(
      certificateNumber,
    )}`;
  }

  // Support the previous QR-server image format as a final fallback.
  const image = document.querySelector<HTMLImageElement>(
    ".certificate-paper .certificate-qr",
  );

  if (image) {
    try {
      const source = new URL(
        image.currentSrc || image.src,
        window.location.href,
      );

      const data = source.searchParams.get("data")?.trim();

      if (data) {
        return data;
      }
    } catch {
      // No usable QR source.
    }
  }

  return "";
}

function waitForImage(image: HTMLImageElement): Promise<void> {
  if (image.complete) {
    return image.naturalWidth > 0
      ? Promise.resolve()
      : Promise.reject(
          new Error("An image failed to load."),
        );
  }

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let timeoutId = 0;

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      image.removeEventListener("load", onLoad);
      image.removeEventListener("error", onError);
    };

    const finish = (success: boolean) => {
      if (settled) return;

      settled = true;
      cleanup();

      if (success && image.naturalWidth > 0) {
        resolve();
      } else {
        reject(new Error("An image failed to load correctly."));
      }
    };

    const onLoad = () => finish(true);
    const onError = () => finish(false);

    timeoutId = window.setTimeout(() => {
      finish(false);
    }, IMAGE_WAIT_TIMEOUT_MS);

    image.addEventListener("load", onLoad, { once: true });
    image.addEventListener("error", onError, { once: true });

    // Handle an image that completed between the initial check and
    // listener registration.
    if (image.complete) {
      finish(image.naturalWidth > 0);
    }
  });
}

function canvasToJpeg(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.size === 0) {
          reject(
            new Error(
              "The browser could not create the certificate image.",
            ),
          );
          return;
        }

        if (blob.type !== "image/jpeg") {
          reject(
            new Error(
              `The browser returned ${
                blob.type || "an unknown image format"
              } instead of JPEG.`,
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

function getCertificateFilename(
  certificate: HTMLElement,
): string {
  const code = certificate
    .querySelector(".certificate-number")
    ?.textContent?.trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return code
    ? `ruffneck-certificate-${code}.jpg`
    : "ruffneck-certificate.jpg";
}

function triggerDownload(
  blobUrl: string,
  filename: string,
): boolean {
  const link = document.createElement("a");

  link.href = blobUrl;
  link.download = filename;
  link.rel = "noopener";
  link.style.position = "fixed";
  link.style.left = "-10000px";
  link.style.top = "0";

  document.body.appendChild(link);

  try {
    link.click();
    return true;
  } catch (error) {
    console.error(
      "Automatic certificate download could not start:",
      error,
    );

    return false;
  } finally {
    link.remove();
  }
}

function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

export default function CertificateJpgButton() {
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [message, setMessage] = useState("");
  const [verificationValue, setVerificationValue] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [downloadFilename, setDownloadFilename] = useState(
    "ruffneck-certificate.jpg",
  );

  const qrSvgRef = useRef<HTMLDivElement>(null);
  const objectUrlRef = useRef("");
  const busyRef = useRef(false);

  useEffect(() => {
    setVerificationValue(getVerificationValue());

    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = "";
      }
    };
  }, []);

  async function downloadJpg() {
    if (busyRef.current) return;

    const certificate =
      document.querySelector<HTMLElement>(
        ".certificate-paper",
      );

    if (!certificate) {
      setStatus("error");
      setMessage(
        "Certificate not found. Reload the certificate page and try again.",
      );
      return;
    }

    if (
      certificate.offsetWidth < 1 ||
      certificate.offsetHeight < 1
    ) {
      setStatus("error");
      setMessage(
        "The certificate is not visible yet. Try again after the page finishes loading.",
      );
      return;
    }

    // Resolve the URL again when the user clicks. This also handles cases
    // where the component's initial effect ran before the certificate DOM
    // was ready.
    const verification =
      verificationValue || getVerificationValue();

    if (!verification) {
      setStatus("error");
      setMessage(
        "Could not find the certificate verification link. Reload the page and try again.",
      );
      return;
    }

    const qrHolder =
      certificate.querySelector<HTMLElement>(
        ".certificate-qr-frame",
      );

    const renderedQr =
      qrSvgRef.current?.querySelector<SVGSVGElement>(
        "svg",
      );

    if (!qrHolder || !renderedQr) {
      setVerificationValue(verification);
      setStatus("error");
      setMessage(
        "The verification QR code is still being prepared. Click Download JPG again in a moment.",
      );
      return;
    }

    busyRef.current = true;
    setStatus("working");
    setMessage("Preparing your certificate image…");

    let replacementQr: SVGSVGElement | null = null;
    let originalQrNode: Element | null = null;
    let originalQrParent: Node | null = null;
    let originalQrNextSibling: Node | null = null;
    const removedImages: RemovedImage[] = [];

    try {
      /*
       * Replace the QR inside the certificate temporarily with a local SVG.
       * This avoids depending on a remote QR image during canvas export.
       * The fallback text is replaced too if no QR image was available.
       */
      replacementQr = renderedQr.cloneNode(
        true,
      ) as SVGSVGElement;

      replacementQr.setAttribute(
        "class",
        "certificate-qr",
      );
      replacementQr.setAttribute(
        "width",
        String(QR_SIZE),
      );
      replacementQr.setAttribute(
        "height",
        String(QR_SIZE),
      );

      replacementQr.style.display = "block";
      replacementQr.style.width = "100%";
      replacementQr.style.height = "100%";

      originalQrNode =
        qrHolder.querySelector(
          ".certificate-qr, .certificate-qr-fallback",
        );

      if (originalQrNode) {
        originalQrParent = originalQrNode.parentNode;
        originalQrNextSibling = originalQrNode.nextSibling;
        originalQrNode.replaceWith(replacementQr);
      } else {
        qrHolder.appendChild(replacementQr);
      }

      if ("fonts" in document && document.fonts?.ready) {
        await document.fonts.ready;
      }

      /*
       * A failed logo, watermark, or stamp should not automatically block
       * the whole JPEG export. Wait for each image, then temporarily remove
       * failed artwork while preserving enough information to restore it.
       */
      const images = Array.from(
        certificate.querySelectorAll<HTMLImageElement>("img"),
      );

      const imageRecords = images.map((image, index) => ({
        image,
        index,
        parent: image.parentNode,
        nextSibling: image.nextSibling,
      }));

      const imageResults = await Promise.all(
        imageRecords.map(async (record) => {
          try {
            await waitForImage(record.image);
            return {
              record,
              loaded: true,
            };
          } catch {
            return {
              record,
              loaded: false,
            };
          }
        }),
      );

      for (const result of imageResults) {
        if (
          result.loaded ||
          !result.record.parent ||
          result.record.image.parentNode !== result.record.parent
        ) {
          continue;
        }

        removedImages.push({
          image: result.record.image,
          parent: result.record.parent,
          nextSibling: result.record.nextSibling,
          index: result.record.index,
        });

        result.record.image.remove();
      }

      await waitForNextFrame();

      const width = certificate.offsetWidth;
      const height = certificate.offsetHeight;

      if (width < 1 || height < 1) {
        throw new Error(
          "The certificate layout has no usable dimensions.",
        );
      }

      const pixelRatio = Math.min(
        3,
        Math.max(2, window.devicePixelRatio || 2),
      );

      const canvas = await toCanvas(certificate, {
        pixelRatio,
        backgroundColor: "#fffefa",
        cacheBust: true,
        width,
        height,
      });

      const blob = await canvasToJpeg(canvas, 0.96);
      const filename = getCertificateFilename(certificate);
      const nextUrl = URL.createObjectURL(blob);

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }

      objectUrlRef.current = nextUrl;

      setDownloadUrl(nextUrl);
      setDownloadFilename(filename);
      setStatus("success");
      setMessage(
        "JPG created. If the download does not start automatically, use the download link below.",
      );

      // The visible download link below remains available for browsers,
      // particularly mobile Safari, that restrict programmatic downloads.
      triggerDownload(nextUrl, filename);
    } catch (cause) {
      console.error(
        "Certificate JPEG export failed:",
        cause,
      );

      const detail =
        cause instanceof Error
          ? cause.message
          : "An unknown export error occurred.";

      setStatus("error");
      setMessage(
        `The JPG could not be created. ${detail} Try again, or use Print / Save PDF as a fallback.`,
      );
    } finally {
      // Restore removed decorative images in reverse document order.
      // This also preserves the original order of adjacent elements.
      removedImages.sort((a, b) => b.index - a.index);

      for (const record of removedImages) {
        try {
          if (
            record.nextSibling &&
            record.nextSibling.parentNode === record.parent
          ) {
            record.parent.insertBefore(
              record.image,
              record.nextSibling,
            );
          } else {
            record.parent.appendChild(record.image);
          }
        } catch (error) {
          console.error(
            "Could not restore a certificate image:",
            error,
          );
        }
      }

      // Restore the original QR image or fallback text.
      if (replacementQr) {
        replacementQr.remove();
      }

      if (originalQrNode && originalQrParent) {
        try {
          if (
            originalQrNextSibling &&
            originalQrNextSibling.parentNode === originalQrParent
          ) {
            originalQrParent.insertBefore(
              originalQrNode,
              originalQrNextSibling,
            );
          } else {
            originalQrParent.appendChild(originalQrNode);
          }
        } catch (error) {
          console.error(
            "Could not restore the original certificate QR element:",
            error,
          );
        }
      }

      busyRef.current = false;
    }
  }

  return (
    <div>
      {verificationValue ? (
        <div
          ref={qrSvgRef}
          aria-hidden="true"
          style={{
            position: "fixed",
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
        {status === "working"
          ? "Creating JPG…"
          : "Download JPG"}
      </button>

      {message ? (
        <p
          role={status === "error" ? "alert" : "status"}
          aria-live="polite"
          style={{
            maxWidth: 340,
            margin: "8px 0 0",
            color:
              status === "error"
                ? "#a51d2d"
                : status === "success"
                  ? "#166534"
                  : "#526174",
            fontSize: 12,
            lineHeight: 1.6,
            overflowWrap: "anywhere",
          }}
        >
          {message}
        </p>
      ) : null}

      {status === "success" && downloadUrl ? (
        <p
          style={{
            maxWidth: 340,
            margin: "8px 0 0",
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          <a
            href={downloadUrl}
            download={downloadFilename}
            style={{
              color: "#0b1e3a",
              fontWeight: 800,
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            Download JPG file
          </a>
        </p>
      ) : null}
    </div>
  );
}