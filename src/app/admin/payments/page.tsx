import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ReconcilePaymentButton from "./ReconcilePaymentButton";

type Payment = {
  id: string;
  student_id: string;
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

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type Course = {
  id: string;
  title: string;
  slug: string;
  instructor_id: string | null;
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

function formatDate(
  value: string | null
) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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
      return "Initiated";
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
  return `rn-payment-status rn-payment-status-${status}`;
}

export default async function AdminPaymentsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      "/login?next=/admin/payments"
    );
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    redirect("/");
  }

  const role = profile.role as string;

  if (
    role !== "admin" &&
    role !== "instructor"
  ) {
    redirect("/");
  }

  const admin = createAdminClient();

  let paymentQuery = admin
    .from("course_payments")
    .select(
      [
        "id",
        "student_id",
        "course_id",
        "course_slug",
        "tx_ref",
        "flutterwave_transaction_id",
        "amount",
        "currency",
        "status",
        "checkout_url",
        "created_at",
        "updated_at",
        "verified_at",
      ].join(", ")
    )
    .order("created_at", {
      ascending: false,
    });

  if (role === "instructor") {
    const {
      data: assignedCourses,
      error: assignedCoursesError,
    } = await admin
      .from("courses")
      .select(
        "id, title, slug, instructor_id"
      )
      .eq("instructor_id", user.id);

    if (assignedCoursesError) {
      throw new Error(
        assignedCoursesError.message
      );
    }

    const assignedCourseIds =
      (assignedCourses ?? []).map(
        (course) => course.id
      );

    if (assignedCourseIds.length === 0) {
      return (
        <main className="container admin-page">
          <div className="admin-page-header">
            <div>
              <p className="eyebrow">
                Payments
              </p>

              <h1>
                Course Payments
              </h1>

              <p>
                No courses are currently
                assigned to you.
              </p>
            </div>

            <div className="admin-page-actions">
              <Link
                href="/admin/lms"
                className="btn btn-secondary"
              >
                LMS Admin
              </Link>
            </div>
          </div>
        </main>
      );
    }

    paymentQuery = paymentQuery.in(
      "course_id",
      assignedCourseIds
    );
  }

  const {
    data: paymentData,
    error: paymentsError,
  } = await paymentQuery;

  if (paymentsError) {
    throw new Error(
      paymentsError.message
    );
  }

  const payments =
    (paymentData ??
      []) as unknown as Payment[];

  const studentIds = [
    ...new Set(
      payments.map(
        (payment) =>
          payment.student_id
      )
    ),
  ];

  const courseIds = [
    ...new Set(
      payments.map(
        (payment) =>
          payment.course_id
      )
    ),
  ];

  const [
    profilesResult,
    coursesResult,
  ] = await Promise.all([
    studentIds.length
      ? admin
          .from("profiles")
          .select(
            "id, full_name, email"
          )
          .in("id", studentIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),

    courseIds.length
      ? admin
          .from("courses")
          .select(
            "id, title, slug, instructor_id"
          )
          .in("id", courseIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),
  ]);

  if (profilesResult.error) {
    throw new Error(
      profilesResult.error.message
    );
  }

  if (coursesResult.error) {
    throw new Error(
      coursesResult.error.message
    );
  }

  const profiles =
    (profilesResult.data ??
      []) as unknown as Profile[];

  const courses =
    (coursesResult.data ??
      []) as unknown as Course[];

  const profileMap = new Map(
    profiles.map((profile) => [
      profile.id,
      profile,
    ])
  );

  const courseMap = new Map(
    courses.map((course) => [
      course.id,
      course,
    ])
  );

  const successfulPayments =
    payments.filter(
      (payment) =>
        payment.status ===
        "successful"
    );

  const pendingPayments =
    payments.filter(
      (payment) =>
        payment.status ===
          "pending" ||
        payment.status ===
          "initiated"
    );

  const failedPayments =
    payments.filter(
      (payment) =>
        payment.status ===
          "failed" ||
        payment.status ===
          "cancelled"
    );

  const totalCollected =
    successfulPayments.reduce(
      (sum, payment) =>
        sum + payment.amount,
      0
    );

  return (
    <main className="container admin-page">
      <div className="admin-page-header">
        <div>
          <p className="eyebrow">
            Administration
          </p>

          <h1>
            Course Payments
          </h1>

          <p>
            Monitor Flutterwave transactions,
            reconcile pending payments, and
            track paid-course access.
          </p>
        </div>

        <div className="admin-page-actions">
          <Link
            href="/admin/lms"
            className="btn btn-secondary"
          >
            LMS Admin
          </Link>

          <Link
            href="/admin/ai-drafts"
            className="btn btn-secondary"
          >
            AI Drafts
          </Link>

          <Link
            href="/admin/assessments"
            className="btn btn-secondary"
          >
            Assessments
          </Link>

          <Link
            href="/admin/capstones"
            className="btn btn-secondary"
          >
            Capstones
          </Link>
        </div>
      </div>

      <section className="admin-stats">
        <article className="admin-stat-card">
          <span>
            Collected
          </span>

          <strong>
            {formatMoney(
              totalCollected,
              "NGN"
            )}
          </strong>
        </article>

        <article className="admin-stat-card">
          <span>
            Successful
          </span>

          <strong>
            {successfulPayments.length}
          </strong>
        </article>

        <article className="admin-stat-card">
          <span>
            Pending
          </span>

          <strong>
            {pendingPayments.length}
          </strong>
        </article>

        <article className="admin-stat-card">
          <span>
            Failed / Cancelled
          </span>

          <strong>
            {failedPayments.length}
          </strong>
        </article>
      </section>

      <section className="admin-card">
        <div className="admin-card-header">
          <div>
            <h2>
              Transactions
            </h2>

            <p>
              {payments.length} payment
              {payments.length === 1
                ? ""
                : "s"} recorded.
            </p>
          </div>
        </div>

        {payments.length === 0 ? (
          <div className="admin-empty-state">
            <h3>
              No payments yet
            </h3>

            <p>
              Flutterwave course transactions
              will appear here after students
              begin purchasing paid courses.
            </p>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>
                    Student
                  </th>

                  <th>
                    Course
                  </th>

                  <th>
                    Amount
                  </th>

                  <th>
                    Reference
                  </th>

                  <th>
                    Flutterwave ID
                  </th>

                  <th>
                    Status
                  </th>

                  <th>
                    Created
                  </th>

                  <th>
                    Verified
                  </th>

                  <th>
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {payments.map(
                  (payment) => {
                    const student =
                      profileMap.get(
                        payment.student_id
                      );

                    const course =
                      courseMap.get(
                        payment.course_id
                      );

                    return (
                      <tr
                        key={
                          payment.id
                        }
                      >
                        <td>
                          <strong>
                            {student?.full_name ||
                              "Student"}
                          </strong>

                          {student?.email ? (
                            <small>
                              {
                                student.email
                              }
                            </small>
                          ) : null}
                        </td>

                        <td>
                          <strong>
                            {course?.title ||
                              payment.course_slug}
                          </strong>

                          <small>
                            {
                              payment.course_slug
                            }
                          </small>
                        </td>

                        <td>
                          {formatMoney(
                            payment.amount,
                            payment.currency
                          )}
                        </td>

                        <td>
                          <code>
                            {
                              payment.tx_ref
                            }
                          </code>
                        </td>

                        <td>
                          {payment.flutterwave_transaction_id ??
                            "—"}
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
                          {formatDate(
                            payment.verified_at
                          )}
                        </td>

                        <td>
                          {payment.status ===
                              "pending" ||
                          payment.status ===
                              "initiated" ? (
                            <ReconcilePaymentButton
                              paymentId={
                                payment.id
                              }
                            />
                          ) : (
                            <span className="admin-muted">
                              —
                            </span>
                          )}
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