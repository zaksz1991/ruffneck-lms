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

type RawDiscount = {
  id?: string;
  code?: string;
  discount_type?: string | null;
  discount_value?: number | null;
};

type RawCourse = {
  id?: string;
  title?: string | null;
  slug?: string | null;
};

type RawPayment = {
  id?: string;
  tx_ref?: string | null;
  flutterwave_transaction_id?: number | null;
  status?: string | null;
};

type RawStudent = {
  id?: string;
  display_name?: string | null;
  full_name?: string | null;
  email?: string | null;
};

type RawRedemption = {
  id?: string;
  discount_code_id?: string;
  student_id?: string;
  course_id?: string;
  payment_id?: string | null;
  amount_before_discount?: number | null;
  discount_amount?: number | null;
  amount_paid?: number | null;
  created_at?: string;
  course_discount_codes?:
    | RawDiscount
    | RawDiscount[]
    | null;
  courses?: RawCourse | RawCourse[] | null;
  course_payments?:
    | RawPayment
    | RawPayment[]
    | null;
  profiles: RawStudent | RawStudent[] | null;
};

type RawReportResponse = {
  redemptions?: RawRedemption[];
  summary?: ReportResponse["summary"];
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

function firstObject<T>(
  value: T | T[] | null | undefined
): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value)
    ? value[0] ?? null
    : value;
}

function studentDisplayName(
  student: RawStudent | null
) {
  if (!student) {
    return "Unknown student";
  }

  return (
    student.display_name?.trim() ||
    student.full_name?.trim() ||
    student.email?.trim() ||
    "Unknown student"
  );
}

function normaliseRedemption(
  row: RawRedemption
): Redemption {
  const discount = firstObject(
    row.course_discount_codes
  );

  const course = firstObject(
    row.courses
  );

  const payment = firstObject(
    row.course_payments
  );

  const student = firstObject(
    row.profiles
  );

  return {
    id: row.id ?? crypto.randomUUID(),
    createdAt:
      row.created_at ??
      new Date().toISOString(),
    code: discount?.code ?? "Unknown code",
    discountType:
      discount?.discount_type ?? null,
    discountValue:
      discount?.discount_value ?? null,
    courseId:
      row.course_id ??
      course?.id ??
      "",
    courseTitle:
      course?.title?.trim() ||
      "Unknown course",
    courseSlug:
      course?.slug ?? null,
    studentId:
      row.student_id ??
      student?.id ??
      "",
    studentName:
      studentDisplayName(student),
    paymentId:
      row.payment_id ??
      payment?.id ??
      null,
    txRef:
      payment?.tx_ref ?? null,
    flutterwaveTransactionId:
      payment?.flutterwave_transaction_id ??
      null,
    paymentStatus:
      payment?.status ?? null,
    amountBeforeDiscount:
      Number(
        row.amount_before_discount ?? 0
      ),
    discountAmount:
      Number(
        row.discount_amount ?? 0
      ),
    amountPaid:
      Number(row.amount_paid ?? 0),
  };
}

export default function DiscountRedemptionReport() {
  const [rows, setRows] = useState<
    Redemption[]
  >([]);

  const [summary, setSummary] =
    useState<ReportResponse["summary"]>();

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [selectedCode, setSelectedCode] =
    useState<string | null>(null);

  const [selectedCourse, setSelectedCourse] =
    useState<string | null>(null);

  async function loadReport() {
    setLoading(true);
    setError(null);

    try {
      const params =
        new URLSearchParams(
          window.location.search
        );

      const codeId =
        params.get("codeId")?.trim() || null;

      const courseId =
        params.get("courseId")?.trim() || null;

      setSelectedCode(codeId);
      setSelectedCourse(courseId);

      const query = new URLSearchParams();

      if (codeId) {
        query.set("codeId", codeId);
      }

      if (courseId) {
        query.set("courseId", courseId);
      }

      const queryString =
        query.toString();

      const endpoint =
        queryString
          ? `/api/admin/discounts/redemptions?${queryString}`
          : "/api/admin/discounts/redemptions";

      const response = await fetch(
        endpoint,
        {
          cache: "no-store",
        }
      );

      const data =
        (await response.json()) as RawReportResponse;

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to load redemption report."
        );
      }

      const normalisedRows = (
        data.redemptions ?? []
      ).map(normaliseRedemption);

      setRows(normalisedRows);
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
        <p>
          Loading discount redemption report...
        </p>
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

  const hasFilter =
    Boolean(selectedCode) ||
    Boolean(selectedCourse);

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

      {hasFilter ? (
        <section className="admin-card">
          <div className="rn-discount-report-heading">
            <div>
              <p>
                Filtered discount report
              </p>

              <h2>
                Filtered Redemptions
              </h2>
            </div>

            <a
              className="btn"
              href="/admin/discounts/redemptions"
            >
              View All Redemptions
            </a>
          </div>
        </section>
      ) : null}

      {!rows.length ? (
        <section className="admin-card">
          <h2>
            No discount redemptions yet
          </h2>

          <p>
            Discount usage will appear here
            after students successfully redeem
            codes.
          </p>
        </section>
      ) : (
        <section className="admin-card">
          <div className="admin-card-header">
            <div>
              <h2>
                Redemption History
              </h2>

              <p>
                {rows.length} redemption
                {rows.length === 1
                  ? ""
                  : "s"}
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
                    {formatDate(
                      row.createdAt
                    )}
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

                {row.discountType ? (
                  <div className="rn-discount-report-reference">
                    <span>
                      Discount type
                    </span>

                    <code>
                      {row.discountType}
                      {row.discountValue !==
                      null
                        ? ` · ${row.discountValue}`
                        : ""}
                    </code>
                  </div>
                ) : null}

                {row.txRef ? (
                  <div className="rn-discount-report-reference">
                    <span>
                      Transaction reference
                    </span>

                    <code>
                      {row.txRef}
                    </code>
                  </div>
                ) : null}

                {row.flutterwaveTransactionId ? (
                  <div className="rn-discount-report-reference">
                    <span>
                      Flutterwave transaction ID
                    </span>

                    <code>
                      {
                        row.flutterwaveTransactionId
                      }
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