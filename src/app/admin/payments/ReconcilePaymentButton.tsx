"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  paymentId: string;
};

export default function ReconcilePaymentButton({
  paymentId,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function reconcile() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        "/api/admin/payments/reconcile",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            payment_id: paymentId,
          }),
        }
      );

      const result = (await response.json()) as {
        success?: boolean;
        reconciled?: boolean;
        already_reconciled?: boolean;
        status?: string;
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        setMessage(
          result.error ||
            "Payment reconciliation failed."
        );
        return;
      }

      setMessage(
        result.message ||
          "Payment reconciliation completed."
      );

      router.refresh();
    } catch {
      setMessage(
        "Unable to reconcile this payment."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rn-payment-reconcile">
      <button
        type="button"
        className="btn btn-secondary"
        onClick={reconcile}
        disabled={loading}
      >
        {loading
          ? "Checking..."
          : "Reconcile"}
      </button>

      {message ? (
        <small className="rn-payment-reconcile-message">
          {message}
        </small>
      ) : null}
    </div>
  );
}