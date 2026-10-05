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
  currency: string,
) {
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency || "NGN",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency || "NGN"} ${amount.toLocaleString()}`;
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(
  status: Payment["status"],
) {
  switch (status) {
    case "successful":
      return "Successful";
    case "pending":
      return "Pending";
    case "initiated":
      return "Payment started";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

function statusClass(
  status: Payment["status"],
) {
  return `rn-payment-status rn-payment-status-${status}`;
}

export default async function StudentPaymentsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/student/payments");
  }

  const {
    data: paymentData,
    error: paymentError,
  } = await supabase
    .from("course_payments")
    .select(
      [
        "id",
        "course_id",
        "course_slug",
        "tx_ref",
        "flutterwave_transaction_id",
        "amount",
        "currency",
        "status",
        "created_at",
        "verified_at",
      ].join(", "),
    )
    .eq("student_id", user.id)
    .order("created_at", {
      ascending: false,
    });

  if (paymentError) {
    throw new Error(paymentError.message);
  }

  const payments =
    (paymentData ?? []) as unknown as Payment[];

  const courseIds = [
    ...new Set(
      payments.map(
        (payment) => payment.course_id,
      ),
    ),
  ];

  const {
    data: courseData,
    error: courseError,
  } =
    courseIds.length > 0
      ? await supabase
          .from("courses")
          .select("id, title, slug")
          .in("id", courseIds)
      : {
          data: [],
          error: null,
        };

  if (courseError) {
    throw new Error(courseError.message);
  }

  const courses =
    (courseData ?? []) as unknown as Course[];

  const courseMap = new Map(
    courses.map((course) => [
      course.id,
      course,
    ]),
  );

  const successfulCount =
    payments.filter(
      (payment) =>
        payment.status === "successful",
    ).length;

  const pendingCount =
    payments.filter(
      (payment) =>
        payment.status === "pending" ||
        payment.status === "initiated",
    ).length;

  const totalPaid = payments
    .filter(
      (payment) =>
        payment.status === "successful",
    )
    .reduce(
      (total, payment) =>
        total + Number(payment.amount || 0),
      0,
    );

  return (
    <main className="container admin-page">
      <div className="admin-page-header">
        <div>
          <p className="eyebrow">
            MY ACCOUNT
          </p>

          <h1>Payment History</h1>

          <p>
            View your course purchases,
            Flutterwave references, and payment
            status.
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
        <article className="admin-stat-card">
          <span>Total Paid</span>

          <strong>
            {formatMoney(
              totalPaid,
              "NGN",
            )}
          </strong>
        </article>

        <article className="admin-stat-card">
          <span>Successful</span>

          <strong>
            {successfulCount}
          </strong>
        </article>

        <article className="admin-stat-card">
          <span>Pending</span>

          <strong>
            {pendingCount}
          </strong>
        </article>

        <article className="admin-stat-card">
          <span>Transactions</span>

          <strong>
            {payments.length}
          </strong>
        </article>
      </section>

      <section className="admin-card">
        <div className="admin-card-header">
          <div>
            <h2>Transactions</h2>

            <p>
              Your Flutterwave course payment
              records.
            </p>
          </div>
        </div>

        {payments.length === 0 ? (
          <div className="admin-empty-state">
            <h3>No payments yet</h3>

            <p>
              Your course purchases will appear
              here after you make a payment.
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
                  <th>Flutterwave ID</th>
                  <th>Status</th>
                  <th>Paid / Created</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {payments.map((payment) => {
                  const course =
                    courseMap.get(
                      payment.course_id,
                    );

                  return (
                    <tr key={payment.id}>
                      <td>
                        <strong>
                          {course?.title ||
                            payment.course_slug}
                        </strong>

                        <small>
                          {payment.course_slug}
                        </small>
                      </td>

                      <td>
                        {formatMoney(
                          payment.amount,
                          payment.currency,
                        )}
                      </td>

                      <td>
                        <code>
                          {payment.tx_ref}
                        </code>
                      </td>

                      <td>
                        {payment.flutterwave_transaction_id ??
                          "—"}
                      </td>

                      <td>
                        <span
                          className={statusClass(
                            payment.status,
                          )}
                        >
                          {statusLabel(
                            payment.status,
                          )}
                        </span>
                      </td>

                      <td>
                        {formatDate(
                          payment.verified_at ||
                            payment.created_at,
                        )}
                      </td>

                      <td>
                        {payment.status ===
                        "successful" ? (
                          <Link
                            href={`/courses/${payment.course_slug}`}
                            className="btn btn-secondary"
                          >
                            View Course
                          </Link>
                        ) : payment.status ===
                            "pending" ||
                          payment.status ===
                            "initiated" ? (
                          <span className="admin-muted">
                            Awaiting confirmation
                          </span>
                        ) : (
                          <Link
                            href={`/courses/${payment.course_slug}`}
                            className="btn btn-secondary"
                          >
                            View Course
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}