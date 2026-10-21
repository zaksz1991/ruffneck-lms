"use client";

import { useEffect, useRef, useState } from "react";

const IMAGE_WAIT_TIMEOUT_MS = 8000;

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
      image.naturalWidth > 0 ? resolve() : reject(new Error("A certificate image has no dimensions."));
    };
    const onError = () => {
      cleanup();
      reject(new Error("A certificate image did not load."));
    };

    timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("A certificate image timed out."));
    }, IMAGE_WAIT_TIMEOUT_MS);
    image.addEventListener("load", onLoad, { once: true });
    image.addEventListener("error", onError, { once: true });
  });
}

export default function CertificatePrintButton() {
  const [printing, setPrinting] = useState(false);
  const [message, setMessage] = useState("");
  const finishTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (finishTimer.current !== null) {
        window.clearTimeout(finishTimer.current);
      }
    };
  }, []);

  function finishPrinting() {
    setPrinting(false);
    if (finishTimer.current !== null) {
      window.clearTimeout(finishTimer.current);
      finishTimer.current = null;
    }
    window.removeEventListener("afterprint", finishPrinting);
  }

  async function handlePrint() {
    if (printing) return;

    const certificate = document.querySelector<HTMLElement>(".certificate-paper");
    if (!certificate) {
      setMessage("Certificate not found. Reload the certificate page and try again.");
      return;
    }

    setPrinting(true);
    setMessage("Preparing the certificate for printing…");

    try {
      if ("fonts" in document && document.fonts?.ready) {
        await document.fonts.ready;
      }

      // Let all loaded artwork decode before opening the browser print dialog.
      // A failed remote artwork request should not prevent a user from printing
      // the rest of the certificate; the route's print stylesheet keeps the page
      // scoped to .certificate-paper.
      const images = Array.from(certificate.querySelectorAll("img"));
      const imageResults = await Promise.allSettled(images.map(waitForImage));
      const failedImages = imageResults.filter((result) => result.status === "rejected").length;

      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

      if (failedImages > 0) {
        setMessage("Printing the certificate. One or more decorative images did not load; reload the page if a logo or QR code is missing.");
      } else {
        setMessage("Opening print settings… Choose A4, Landscape, and enable background graphics for best results.");
      }

      window.addEventListener("afterprint", finishPrinting, { once: true });
      window.print();
      // Some mobile browsers do not consistently fire afterprint.
      finishTimer.current = window.setTimeout(finishPrinting, 2000);
    } catch (cause) {
      console.error("Certificate print preparation failed:", cause);
      setMessage("The certificate could not be prepared for printing. Reload the page and try again.");
      finishPrinting();
    }
  }

  return (
    <div>
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
        {printing ? "Preparing Certificate…" : "Print / Save PDF"}
      </button>
      {message ? (
        <p
          role="status"
          aria-live="polite"
          style={{ maxWidth: 340, margin: "8px 0 0", color: "#526174", fontSize: 12, lineHeight: 1.5 }}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
