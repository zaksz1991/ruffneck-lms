"use client";

import { QRCodeSVG } from "qrcode.react";

type VerificationQrProps = {
  value: string;
};

export default function VerificationQr({
  value,
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

      <strong>
        Scan to verify
      </strong>

      <span
        className="muted"
        style={{
          fontSize: "0.8rem",
          textAlign: "center",
          maxWidth: 180,
        }}
      >
        Scan this code to open the public
        RuffNeck Learn Skill Passport.
      </span>
    </div>
  );
}