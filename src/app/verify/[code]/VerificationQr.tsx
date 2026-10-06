"use client";

import { QRCodeSVG } from "qrcode.react";

type VerificationQrProps = {
  value: string;
  title?: string;
  subtitle?: string;
};

export default function VerificationQr({
  value,
  title = "Scan to verify",
  subtitle = "Scan this code to open the official RuffNeck Learn verification record.",
}: VerificationQrProps) {
  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.75rem",
        padding: "1rem",
        border:
          "1px solid var(--border, #e2e8f0)",
        borderRadius: 12,
        background: "#ffffff",
      }}
    >
      <QRCodeSVG
        value={value}
        size={180}
        level="M"
        includeMargin
      />

      <strong>{title}</strong>

      <span
        className="muted"
        style={{
          fontSize: "0.8rem",
          textAlign: "center",
          maxWidth: 220,
        }}
      >
        {subtitle}
      </span>
    </div>
  );
}