"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const IMAGE_WAIT_TIMEOUT_MS = 8000;
const FONT_WAIT_TIMEOUT_MS = 5000;
const PRINT_FALLBACK_TIMEOUT_MS = 60000;

type ImageWaitResult = {
  loaded: boolean;
};

function waitForImage(
  image: HTMLImageElement,
): Promise<ImageWaitResult> {
  if (image.complete) {
    if (image.naturalWidth === 0) {
      return Promise.resolve({ loaded: false });
    }

    // Dimensions are available, but decoding may still be pending.
    if (typeof image.decode === "function") {
      return image
        .decode()
        .then(() => ({ loaded: true }))
        .catch(() => ({
          // Some browsers reject decode() for otherwise usable images.
          loaded: image.naturalWidth > 0,
        }));
    }

    return Promise.resolve({ loaded: true });
  }

  return new Promise<ImageWaitResult>((resolve) => {
    let settled = false;
    let timeoutId = 0;

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      image.removeEventListener("load", onLoad);
      image.removeEventListener("error", onError);
    };

    const finish = (loaded: boolean) => {
      if (settled) return;

      settled = true;
      cleanup();

      resolve({
        loaded: loaded && image.naturalWidth > 0,
      });
    };

    const onLoad = () => {
      if (typeof image.decode === "function") {
        image
          .decode()
          .then(() => finish(true))
          .catch(() => finish(image.naturalWidth > 0));
      } else {
        finish(true);
      }
    };

    const onError = () => finish(false);

    timeoutId = window.setTimeout(() => {
      finish(image.complete && image.naturalWidth > 0);
    }, IMAGE_WAIT_TIMEOUT_MS);

    image.addEventListener("load", onLoad, { once: true });
    image.addEventListener("error", onError, { once: true });

    // The image could finish loading immediately before the listeners
    // were attached.
    if (image.complete) {
      finish(image.naturalWidth > 0);
    }
  });
}

async function waitForFonts(): Promise<void> {
  if (!("fonts" in document) || !document.fonts?.ready) {
    return;
  }

  let timeoutId = 0;

  try {
    await Promise.race([
      document.fonts.ready.then(() => undefined),
      new Promise<void>((resolve) => {
        timeoutId = window.setTimeout(
          resolve,
          FONT_WAIT_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function waitForLayout(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

export default function CertificatePrintButton() {
  const [printing, setPrinting] = useState(false);
  const [message, setMessage] = useState("");

  const finishTimer = useRef<number | null>(null);
  const printingRef = useRef(false);
  const mountedRef = useRef(false);

  const clearFinishTimer = useCallback(() => {
    if (finishTimer.current !== null) {
      window.clearTimeout(finishTimer.current);
      finishTimer.current = null;
    }
  }, []);

  const finishPrinting = useCallback(() => {
    printingRef.current = false;

    if (mountedRef.current) {
      setPrinting(false);
    }

    clearFinishTimer();

    window.removeEventListener(
      "afterprint",
      finishPrinting,
    );
  }, [clearFinishTimer]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      clearFinishTimer();

      window.removeEventListener(
        "afterprint",
        finishPrinting,
      );
    };
  }, [clearFinishTimer, finishPrinting]);

  async function handlePrint() {
    if (printingRef.current) return;

    const certificate =
      document.querySelector<HTMLElement>(
        ".certificate-paper",
      );

    if (!certificate) {
      setMessage(
        "Certificate not found. Reload the certificate page and try again.",
      );
      return;
    }

    if (
      certificate.offsetWidth < 1 ||
      certificate.offsetHeight < 1
    ) {
      setMessage(
        "The certificate is not visible yet. Wait for the page to finish loading and try again.",
      );
      return;
    }

    printingRef.current = true;
    setPrinting(true);
    setMessage("Preparing certificate artwork for printing…");

    try {
      await waitForFonts();

      const images = Array.from(
        certificate.querySelectorAll<HTMLImageElement>("img"),
      );

      const imageResults = await Promise.all(
        images.map(waitForImage),
      );

      const failedImages = imageResults.filter(
        (result) => !result.loaded,
      ).length;

      await waitForLayout();

      // Keep the print action scoped to the existing certificate page.
      // The page's @media print styles control the A4 landscape layout.
      window.addEventListener(
        "afterprint",
        finishPrinting,
        { once: true },
      );

      // Fallback for mobile browsers that fail to dispatch afterprint.
      // A short timer could reset the button while the print dialog is open.
      clearFinishTimer();

      finishTimer.current = window.setTimeout(
        finishPrinting,
        PRINT_FALLBACK_TIMEOUT_MS,
      );

      setMessage(
        failedImages > 0
          ? "Opening print settings. Some artwork did not load; check the preview before saving."
          : "Opening print settings. Choose A4, Landscape, and enable background graphics when available.",
      );

      await waitForLayout();

      window.print();
    } catch (cause) {
      console.error(
        "Certificate print preparation failed:",
        cause,
      );

      setMessage(
        "The certificate could not be prepared for printing. Reload the page and try again.",
      );

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
        aria-busy={printing}
        style={{
          minWidth: 170,
          minHeight: 42,
          justifyContent: "center",
          opacity: printing ? 0.7 : 1,
          cursor: printing ? "wait" : "pointer",
        }}
      >
        {printing
          ? "Preparing Certificate…"
          : "Print / Save PDF"}
      </button>

      {message ? (
        <p
          role="status"
          aria-live="polite"
          style={{
            maxWidth: 340,
            margin: "8px 0 0",
            color: "#526174",
            fontSize: 12,
            lineHeight: 1.6,
            overflowWrap: "anywhere",
          }}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}