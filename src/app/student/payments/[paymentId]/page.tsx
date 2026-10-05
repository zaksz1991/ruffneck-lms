import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
  created_at: string;
  updated_at: string;
  verified_at: string | null;
};

type Course = {
  id: string;
  title: string;
  slug: string;
};

type PageProps = {
  params: Promise<{
    paymentId: string;
  }>;
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

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusLabel(
  status: Payment["status"]
) {
  switch (status) {
    case "successful":
      return "Successful";
    case "pending":
      return "Pending";
    case "initiated":
      return "Payment Started";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

function statusClass(
  status: Payment["status"]
) {
  switch (status) {
    case "successful":
      return "rn-payment-status rn-payment-status-successful";
    case "failed":
    case "cancelled":
      return "rn-payment-status rn-payment-status-failed";
    default:
      return "rn-payment-status rn-payment-status-pending";
  }
}

export default async function StudentPaymentDetailsPage({
  params,
}: PageProps) {
  const { paymentId } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?next=/student/payments/${paymentId}`
    );
  }

  const { data: paymentData } = await supabase
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
        created_at,
        updated_at,
        verified_at
      `
    )
    .eq("id", paymentId)
    .eq("student_id", user.id)
    .maybeSingle();

  if (!paymentData) {
    notFound();
  }

  const payment =
    paymentData as Payment;

  const { data: courseData } = await supabase
    .from("courses")
    .select("id, title, slug")
    .eq("id", payment.course_id)
    .maybeSingle();

  const course =
    courseData as Course | null;

  const isSuccessful =
    payment.status === "successful";

  const isPayable =
    payment.status === "initiated" ||
    payment.status === "pending";

  return (
    <main className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="eyebrow">
            Payment History
          </p>

          <h1>
            Payment Details
          </h1>

          <p>
            Transaction reference:{" "}
            <strong>{payment.tx_ref}</strong>
          </p>
        </div>

        <div className="admin-page-actions">
          <Link
            href="/student/payments"
            className="btn btn-secondary"
          >
            Back to Payments
          </Link>

          {course ? (
            <Link
              href={`/courses/${course.slug}`}
              className="btn btn-primary"
            >
              View Course
            </Link>
          ) : null}
        </div>
      </div>

      <section className="admin-stats">
        <div className="admin-stat">
          <span>Amount</span>
          <strong>
            {formatMoney(
              payment.amount,
              payment.currency
            )}
          </strong>
        </div>

        <div className="admin-stat">
          <span>Status</span>
          <strong>
            {statusLabel(payment.status)}
          </strong>
        </div>

        <div className="admin-stat">
          <span>Transaction ID</span>
          <strong>
            {payment.flutterwave_transaction_id ??
              "—"}
          </strong>
        </div>
      </section>

      <section className="admin-card">
        <div className="admin-card-header">
          <div>
            <h2>
              Transaction Information
            </h2>

            <p>
              Details recorded for this payment.
            </p>
          </div>

          <span
            className={statusClass(
              payment.status
            )}
          >
            {statusLabel(payment.status)}
          </span>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <tbody>
              <tr>
                <th>Course</th>
                <td>
                  {course?.title ??
                    payment.course_slug}
                </td>
              </tr>

              <tr>
                <th>Amount</th>
                <td>
                  {formatMoney(
                    payment.amount,
                    payment.currency
                  )}
                </td>
              </tr>

              <tr>
                <th>Currency</th>
                <td>
                  {payment.currency}
                </td>
              </tr>

              <tr>
                <th>Payment Reference</th>
                <td>
                  <code>
                    {payment.tx_ref}
                  </code>
                </td>
              </tr>

              <tr>
                <th>Flutterwave Transaction ID</th>
                <td>
                  {payment.flutterwave_transaction_id ??
                    "Not available"}
                </td>
              </tr>

              <tr>
                <th>Created</th>
                <td>
                  {formatDate(
                    payment.created_at
                  )}
                </td>
              </tr>

              <tr>
                <th>Last Updated</th>
                <td>
                  {formatDate(
                    payment.updated_at
                  )}
                </td>
              </tr>

              <tr>
                <th>Verified</th>
                <td>
                  {formatDate(
                    payment.verified_at
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {isSuccessful ? (
        <section className="admin-card">
          <h2>
            Payment Confirmed
          </h2>

          <p>
            Your payment has been verified and
            your course access has been activated.
          </p>

          {course ? (
            <Link
              href={`/courses/${course.slug}`}
              className="btn btn-primary"
            >
              Start Learning
            </Link>
          ) : null}
        </section>
      ) : null}

      {isPayable &&
      payment.checkout_url ? (
        <section className="admin-card">
          <h2>
            Payment Awaiting Completion
          </h2>

          <p>
            This transaction has not yet been
            confirmed. You can continue the
            Flutterwave checkout below.
          </p>

          <a
            href={payment.checkout_url}
            className="btn btn-primary"
          >
            Continue Payment
          </a>
        </section>
      ) : null}

      {payment.status === "failed" ||
      payment.status === "cancelled" ? (
        <section className="admin-card">
          <h2>
            Payment Not Completed
          </h2>

          <p>
            This transaction was not completed.
            Return to the course page to start a
            new payment.
          </p>

          {course ? (
            <Link
              href={`/courses/${course.slug}`}
              className="btn btn-primary"
            >
              Return to Course
            </Link>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}