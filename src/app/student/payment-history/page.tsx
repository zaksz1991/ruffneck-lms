import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Payment = {
  id: string;
  course_id: string;
  course_slug: string;
  tx_ref: string;
  flutterwave_transaction_id: number | null;
  amount: number;
  currency: string;
  status:
    | "initiated"
    | "pending"
    | "successful"
    | "failed"
    | "cancelled";
  checkout_url: string | null;
  original_amount: number | null;
  discount_code_id: string | null;
  discount_amount: number;
  created_at: string;
  updated_at: string;
  verified_at: string | null;
};

type Course = {
  id: string;
  title: string;
  slug: string;
};

function formatMoney(
  amount: number,
  currency: string
) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: currency || "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(status: Payment["status"]) {
  switch (status) {
    case "successful":
      return "Successful";
    case "pending":
      return "Pending";
    case "initiated":
      return "Initiated";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

function statusClass(status: Payment["status"]) {
  switch (status) {
    case "successful":
      return "rn-payment-status rn-payment-status-success";
    case "pending":
    case "initiated":
      return "rn-payment-status rn-payment-status-pending";
    case "failed":
    case "cancelled":
      return "rn-payment-status rn-payment-status-failed";
    default:
      return "rn-payment-status";
  }
}

export default async function PaymentHistoryPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      "/login?next=/student/payment-history"
    );
  }

  const { data: paymentRows, error } =
    await supabase
      .from("course_payments")
      .select(
        `
          id,
          course_id,
          course_slug,
          tx_ref,
          flutterwave_transaction_id,
          amount,
          currency,
          status,
          checkout_url,
          original_amount,
          discount_code_id,
          discount_amount,
          created_at,
          updated_at,
          verified_at
        `
      )
      .eq("student_id", user.id)
      .order("created_at", {
        ascending: false,
      });

  if (error) {
    throw new Error(error.message);
  }

  const payments =
    (paymentRows ?? []) as Payment[];

  const courseIds = [
    ...new Set(
      payments.map(
        (payment) => payment.course_id
      )
    ),
  ];

  const { data: courseRows } =
    courseIds.length
      ? await supabase
          .from("courses")
          .select("id, title, slug")
          .in("id", courseIds)
      : {
          data: [],
        };

  const courses =
    (courseRows ?? []) as Course[];

  const courseMap = new Map(
    courses.map((course) => [
      course.id,
      course,
    ])
  );

  const successfulPayments =
    payments.filter(
      (payment) =>
        payment.status === "successful"
    );

  const totalPaid =
    successfulPayments.reduce(
      (total, payment) =>
        total + payment.amount,
      0
    );

  const totalDiscount =
    successfulPayments.reduce(
      (total, payment) =>
        total +
        (payment.discount_amount || 0),
      0
    );

  return (
    <main className="container">
      <section className="rn-dashboard-shell">
        <div className="rn-dashboard-header">
          <div>
            <div className="rn-eyebrow">
              RUFFNECK LEARN
            </div>

            <h1>Payment History</h1>

            <p className="rn-dashboard-intro">
              View your course payments,
              transaction references, discounts,
              and payment status.
            </p>
          </div>

          <div className="rn-dashboard-header-actions">
            <Link
              href="/student/dashboard"
              className="rn-button rn-button-secondary"
            >
              Dashboard
            </Link>

            <Link
              href="/courses"
              className="rn-button rn-button-primary"
            >
              Browse Courses
            </Link>
          </div>
        </div>

        <section className="rn-dashboard-stats">
          <article className="rn-dashboard-stat">
            <span className="rn-dashboard-stat-label">
              Transactions
            </span>

            <strong>{payments.length}</strong>

            <small>
              Payment records
            </small>
          </article>

          <article className="rn-dashboard-stat">
            <span className="rn-dashboard-stat-label">
              Successful
            </span>

            <strong>
              {successfulPayments.length}
            </strong>

            <small>
              Completed payments
            </small>
          </article>

          <article className="rn-dashboard-stat">
            <span className="rn-dashboard-stat-label">
              Total paid
            </span>

            <strong>
              {formatMoney(
                totalPaid,
                "NGN"
              )}
            </strong>

            <small>
              Successful transactions
            </small>
          </article>

          <article className="rn-dashboard-stat">
            <span className="rn-dashboard-stat-label">
              Discounts
            </span>

            <strong>
              {formatMoney(
                totalDiscount,
                "NGN"
              )}
            </strong>

            <small>
              Savings from discount codes
            </small>
          </article>
        </section>

        <section className="rn-dashboard-card">
          <div className="rn-dashboard-card-header">
            <div>
              <span className="rn-eyebrow">
                TRANSACTIONS
              </span>

              <h2>
                Your Payment History
              </h2>
            </div>
          </div>

          {payments.length === 0 ? (
            <div className="rn-dashboard-empty">
              <h3>No payment history yet</h3>

              <p>
                Payments for paid RuffNeck Learn
                courses will appear here after
                you begin a transaction.
              </p>

              <Link
                href="/courses"
                className="rn-button rn-button-primary"
              >
                Browse Courses
              </Link>
            </div>
          ) : (
            <div className="rn-payment-history-list">
              {payments.map((payment) => {
                const course =
                  courseMap.get(
                    payment.course_id
                  );

                const courseTitle =
                  course?.title ||
                  payment.course_slug;

                const hasDiscount =
                  payment.discount_amount > 0;

                return (
                  <article
                    key={payment.id}
                    className="rn-payment-history-item"
                  >
                    <div className="rn-payment-history-main">
                      <div>
                        <span className="rn-eyebrow">
                          COURSE PAYMENT
                        </span>

                        <h3>
                          {courseTitle}
                        </h3>

                        <p>
                          {formatDate(
                            payment.created_at
                          )}
                        </p>
                      </div>

                      <span
                        className={statusClass(
                          payment.status
                        )}
                      >
                        {statusLabel(
                          payment.status
                        )}
                      </span>
                    </div>

                    <div className="rn-payment-history-details">
                      <div>
                        <span>
                          Amount paid
                        </span>

                        <strong>
                          {formatMoney(
                            payment.amount,
                            payment.currency
                          )}
                        </strong>
                      </div>

                      {hasDiscount ? (
                        <div>
                          <span>
                            Discount
                          </span>

                          <strong>
                            -
                            {formatMoney(
                              payment.discount_amount,
                              payment.currency
                            )}
                          </strong>
                        </div>
                      ) : null}

                      {payment.original_amount &&
                      payment.original_amount >
                        payment.amount ? (
                        <div>
                          <span>
                            Original price
                          </span>

                          <strong>
                            {formatMoney(
                              payment.original_amount,
                              payment.currency
                            )}
                          </strong>
                        </div>
                      ) : null}

                      <div>
                        <span>
                          Transaction reference
                        </span>

                        <strong>
                          {payment.tx_ref}
                        </strong>
                      </div>

                      {payment.flutterwave_transaction_id ? (
                        <div>
                          <span>
                            Flutterwave ID
                          </span>

                          <strong>
                            {
                              payment.flutterwave_transaction_id
                            }
                          </strong>
                        </div>
                      ) : null}

                      {payment.verified_at ? (
                        <div>
                          <span>
                            Verified
                          </span>

                          <strong>
                            {formatDate(
                              payment.verified_at
                            )}
                          </strong>
                        </div>
                      ) : null}
                    </div>

                    <div className="rn-payment-history-actions">
                      {course ? (
                        <Link
                          href={`/courses/${course.slug}`}
                          className="rn-button rn-button-secondary"
                        >
                          View Course
                        </Link>
                      ) : null}

                      {payment.status ===
                        "pending" ||
                      payment.status ===
                        "initiated" ? (
                        payment.checkout_url ? (
                          <a
                            href={
                              payment.checkout_url
                            }
                            className="rn-button rn-button-primary"
                          >
                            Continue Payment
                          </a>
                        ) : null
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}