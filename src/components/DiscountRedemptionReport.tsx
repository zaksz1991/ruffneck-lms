"use client";

import { useEffect, useState } from "react";

type Redemption = {
  id: string;
  createdAt: string;
  code: string;
  discountType: string | null;
  discountValue: number | null;
  courseId: string;
  courseTitle: string;
  courseSlug: string | null;
  studentId: string;
  studentName: string;
  paymentId: string | null;
  txRef: string | null;
  flutterwaveTransactionId: number | null;
  paymentStatus: string | null;
  amountBeforeDiscount: number;
  discountAmount: number;
  amountPaid: number;
};

type ReportResponse = {
  redemptions?: Redemption[];
  summary?: {
    redemptions: number;
    originalAmount: number;
    discountAmount: number;
    amountPaid: number;
  };
  error?: string;
};

function formatNaira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function DiscountRedemptionReport() {
  const [rows, setRows] = useState<Redemption[]>([]);
  const [summary, setSummary] =
    useState<ReportResponse["summary"]>(undefined);

  const [loading, setLoading] = useState(true);
  const [error, setError] =
    useState<string | null>(null);

  async function loadReport() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        "/api/admin/discounts/redemptions",
        {
          cache: "no-store",
        }
      );

      const data =
        (await response.json()) as ReportResponse;

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to load redemption report."
        );
      }

      setRows(data.redemptions ?? []);
      setSummary(data.summary);
    } catch (reportError) {
      setError(
        reportError instanceof Error
          ? reportError.message
          : "Unable to load redemption report."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReport();
  }, []);

  if (loading) {
    return (
      <section className="admin-card">
        <p>Loading discount redemption report...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="admin-card">
        <p className="rn-enroll-error">
          {error}
        </p>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void loadReport()}
        >
          Retry
        </button>
      </section>
    );
  }

  return (
    <div className="rn-discount-report">
      <section className="rn-discount-report-summary">
        <div className="admin-card">
          <span>Redemptions</span>
          <strong>
            {summary?.redemptions ?? 0}
          </strong>
        </div>

        <div className="admin-card">
          <span>Original Value</span>
          <strong>
            {formatNaira(
              summary?.originalAmount ?? 0
            )}
          </strong>
        </div>

        <div className="admin-card">
          <span>Total Discount</span>
          <strong>
            {formatNaira(
              summary?.discountAmount ?? 0
            )}
          </strong>
        </div>

        <div className="admin-card">
          <span>Revenue Collected</span>
          <strong>
            {formatNaira(
              summary?.amountPaid ?? 0
            )}
          </strong>
        </div>
      </section>

      {!rows.length ? (
        <section className="admin-card">
          <h2>No discount redemptions yet</h2>
          <p>
            Discount usage will appear here after
            students successfully redeem codes.
          </p>
        </section>
      ) : (
        <section className="admin-card">
          <div className="admin-card-header">
            <div>
              <h2>Redemption History</h2>
              <p>
                {rows.length} redemption
                {rows.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <div className="rn-discount-report-list">
            {rows.map((row) => (
              <article
                key={row.id}
                className="rn-discount-report-item"
              >
                <div className="rn-discount-report-heading">
                  <div>
                    <strong>
                      {row.code}
                    </strong>

                    <h3>
                      {row.courseTitle}
                    </h3>

                    <p>
                      {row.studentName}
                    </p>
                  </div>

                  <span className="rn-discount-report-date">
                    {formatDate(row.createdAt)}
                  </span>
                </div>

                <div className="rn-discount-report-values">
                  <div>
                    <span>Original</span>
                    <strong>
                      {formatNaira(
                        row.amountBeforeDiscount
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Discount</span>
                    <strong>
                      -
                      {formatNaira(
                        row.discountAmount
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Paid</span>
                    <strong>
                      {formatNaira(
                        row.amountPaid
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Payment</span>
                    <strong>
                      {row.paymentStatus ??
                        "Direct enrollment"}
                    </strong>
                  </div>
                </div>

                {row.txRef ? (
                  <div className="rn-discount-report-reference">
                    <span>Transaction reference</span>
                    <code>
                      {row.txRef}
                    </code>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}