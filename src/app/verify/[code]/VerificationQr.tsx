"use client";

import { QRCodeSVG } from "qrcode.react";

type VerificationQrProps = {
  value: string;
  title?: string;
  subtitle?: string;
  size?: number;
};

export default function VerificationQr({
  value,
  title = "Scan to verify",
  subtitle = "Scan this code to open the official RuffNeck Learn verification record.",
  size = 180,
}: VerificationQrProps) {
  const verificationUrl = value.trim();

  const safeSize =
    Number.isFinite(size)
      ? Math.min(320, Math.max(120, Math.round(size)))
      : 180;

  return (
    <section
      aria-label="Skill Passport QR verification"
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.75rem",
        width: "fit-content",
        maxWidth: "100%",
        padding: "1.25rem",
        border: "1px solid var(--border, #e2e8f0)",
        borderRadius: 14,
        background: "#ffffff",
        boxShadow: "0 4px 18px rgba(11, 30, 58, 0.06)",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0.5rem",
          background: "#ffffff",
          borderRadius: 8,
          boxSizing: "border-box",
        }}
      >
        {verificationUrl ? (
          <QRCodeSVG
            value={verificationUrl}
            size={safeSize}
            level="Q"
            includeMargin
            title="RuffNeck Learn Skill Passport verification QR code"
            role="img"
            aria-label="Scan to open the public Skill Passport verification page"
            bgColor="#ffffff"
            fgColor="#0b1e3a"
            style={{
              display: "block",
              width: `min(${safeSize}px, 100%)`,
              height: "auto",
              maxWidth: "100%",
            }}
          />
        ) : (
          <div
            role="status"
            className="muted"
            style={{
              width: safeSize,
              maxWidth: "100%",
              minHeight: safeSize,
              display: "grid",
              placeItems: "center",
              padding: "1rem",
              border: "1px dashed #cbd5e1",
              borderRadius: 8,
              textAlign: "center",
              fontSize: "0.875rem",
              boxSizing: "border-box",
            }}
          >
            Verification link is unavailable.
          </div>
        )}
      </div>

      <strong
        style={{
          color: "#0b1e3a",
          fontSize: "1rem",
          textAlign: "center",
        }}
      >
        {title}
      </strong>

      <p
        className="muted"
        style={{
          maxWidth: 240,
          margin: 0,
          fontSize: "0.82rem",
          lineHeight: 1.6,
          textAlign: "center",
        }}
      >
        {subtitle}
      </p>

      <span
        style={{
          color: "#087f9b",
          fontSize: "0.72rem",
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        RuffNeck Learn
      </span>
    </section>
  );
}