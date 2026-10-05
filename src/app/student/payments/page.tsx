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
  created_at: string;
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

export default async function StudentPaymentsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      "/login?next=/student/payments"
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
        created_at,
        verified_at
      `
    )
    .eq("student_id", user.id)
    .order("created_at", {
      ascending: false,
    });

  const payments =
    (paymentData ?? []) as Payment[];

  const courseIds = Array.from(
    new Set(
      payments.map(
        (payment) => payment.course_id
      )
    )
  );

  let courses: Course[] = [];

  if (courseIds.length > 0) {
    const { data: courseData } =
      await supabase
        .from("courses")
        .select("id, title, slug")
        .in("id", courseIds);

    courses =
      (courseData ?? []) as Course[];
  }

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

  const pendingPayments =
    payments.filter(
      (payment) =>
        payment.status === "pending" ||
        payment.status === "initiated"
    );

  const totalPaid =
    successfulPayments.reduce(
      (total, payment) =>
        total + Number(payment.amount),
      0
    );

  return (
    <main className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="eyebrow">
            Student Account
          </p>

          <h1>
            Payment History
          </h1>

          <p>
            View your RuffNeck Learn course
            payments and transaction records.
          </p>
        </div>

        <div className="admin-page-actions">
          <Link
            href="/student"
            className="btn btn-secondary"
          >
            My Learning
          </Link>

          <Link
            href="/courses"
            className="btn btn-primary"
          >
            Browse Courses
          </Link>
        </div>
      </div>

      <section className="admin-stats">
        <div className="admin-stat">
          <span>Total Paid</span>
          <strong>
            {formatMoney(
              totalPaid,
              "NGN"
            )}
          </strong>
        </div>

        <div className="admin-stat">
          <span>Successful</span>
          <strong>
            {successfulPayments.length}
          </strong>
        </div>

        <div className="admin-stat">
          <span>Pending</span>
          <strong>
            {pendingPayments.length}
          </strong>
        </div>

        <div className="admin-stat">
          <span>Transactions</span>
          <strong>
            {payments.length}
          </strong>
        </div>
      </section>

      <section className="admin-card">
        <div className="admin-card-header">
          <div>
            <h2>
              Transactions
            </h2>

            <p>
              Your complete payment history.
            </p>
          </div>
        </div>

        {payments.length === 0 ? (
          <div className="admin-empty">
            <h3>
              No payments yet
            </h3>

            <p>
              Your course payment records will
              appear here after you start a
              transaction.
            </p>

            <Link
              href="/courses"
              className="btn btn-primary"
            >
              Browse Courses
            </Link>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Amount</th>
                  <th>Reference</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {payments.map(
                  (payment) => {
                    const course =
                      courseMap.get(
                        payment.course_id
                      );

                    return (
                      <tr
                        key={payment.id}
                      >
                        <td>
                          <strong>
                            {course?.title ??
                              payment.course_slug}
                          </strong>
                        </td>

                        <td>
                          {formatMoney(
                            payment.amount,
                            payment.currency
                          )}
                        </td>

                        <td>
                          <code>
                            {payment.tx_ref}
                          </code>
                        </td>

                        <td>
                          <span
                            className={statusClass(
                              payment.status
                            )}
                          >
                            {statusLabel(
                              payment.status
                            )}
                          </span>
                        </td>

                        <td>
                          {formatDate(
                            payment.created_at
                          )}
                        </td>

                        <td>
                          <Link
                            href={`/student/payments/${payment.id}`}
                            className="btn btn-secondary"
                          >
                            View Details
                          </Link>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}