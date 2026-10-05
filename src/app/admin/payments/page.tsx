import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Profile = {
  role:
    | "admin"
    | "instructor"
    | "student";
  email: string | null;
};

type PaymentRecord = {
  id: string;
  student_id: string;
  course_id: string;
  course_slug: string;
  tx_ref: string;
  flutterwave_transaction_id:
    number | null;
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

type StudentLookup = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type CourseLookup = {
  id: string;
  title: string;
};

function formatDate(
  value: string | null
) {
  if (!value) {
    return "—";
  }

  return new Date(
    value
  ).toLocaleString(
    "en-NG",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function formatAmount(
  amount: number,
  currency: string
) {
  try {
    return new Intl.NumberFormat(
      "en-NG",
      {
        style: "currency",
        currency:
          currency || "NGN",
        maximumFractionDigits: 0,
      }
    ).format(amount);
  } catch {
    return `₦${amount.toLocaleString(
      "en-NG"
    )}`;
  }
}

function statusLabel(
  status: PaymentRecord["status"]
) {
  switch (status) {
    case "successful":
      return "Successful";

    case "pending":
      return "Pending";

    case "failed":
      return "Failed";

    case "cancelled":
      return "Cancelled";

    default:
      return "Initiated";
  }
}

function statusClass(
  status: PaymentRecord["status"]
) {
  switch (status) {
    case "successful":
      return "rn-payment-status-success";

    case "pending":
      return "rn-payment-status-pending";

    case "failed":
      return "rn-payment-status-failed";

    case "cancelled":
      return "rn-payment-status-cancelled";

    default:
      return "rn-payment-status-initiated";
  }
}

export default async function AdminPaymentsPage() {
  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect(
      "/login?next=/admin/payments"
    );
  }

  const {
    data: profileData,
    error: profileError,
  } =
    await supabase
      .from("profiles")
      .select("role, email")
      .eq(
        "id",
        user.id
      )
      .maybeSingle();

  if (profileError) {
    throw new Error(
      "Unable to verify admin access."
    );
  }

  const profile =
    profileData as Profile | null;

  if (
    !profile ||
    (profile.role !==
      "admin" &&
      profile.role !==
        "instructor")
  ) {
    redirect(
      "/student/dashboard"
    );
  }

  let assignedCourseIds:
    | string[]
    | null = null;

  if (
    profile.role ===
    "instructor"
  ) {
    const {
      data: instructorCourses,
      error:
        instructorCoursesError,
    } =
      await supabase
        .from("courses")
        .select("id")
        .eq(
          "instructor_id",
          user.id
        );

    if (
      instructorCoursesError
    ) {
      throw new Error(
        "Unable to load instructor courses."
      );
    }

    assignedCourseIds =
      (instructorCourses ??
        []).map(
        (course) =>
          course.id
      );

    if (
      assignedCourseIds.length ===
      0
    ) {
      assignedCourseIds = [];
    }
  }

  let paymentsQuery =
    supabase
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

  if (
    profile.role ===
      "instructor" &&
    assignedCourseIds
  ) {
    if (
      assignedCourseIds.length ===
      0
    ) {
      paymentsQuery =
        paymentsQuery.eq(
          "course_id",
          "00000000-0000-0000-0000-000000000000"
        );
    } else {
      paymentsQuery =
        paymentsQuery.in(
          "course_id",
          assignedCourseIds
        );
    }
  }

  const {
    data: paymentData,
    error: paymentError,
  } =
    await paymentsQuery;

  if (paymentError) {
    console.error(
      "Admin payment lookup failed:",
      paymentError
    );

    throw new Error(
      "Unable to load payment records."
    );
  }

  const payments =
    (paymentData ??
      []) as unknown as PaymentRecord[];

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

  const {
    data: studentsData,
    error: studentsError,
  } =
    studentIds.length > 0
      ? await supabase
          .from("profiles")
          .select(
            "id, full_name, email"
          )
          .in(
            "id",
            studentIds
          )
      : {
          data: [],
          error: null,
        };

  if (studentsError) {
    throw new Error(
      "Unable to load payment students."
    );
  }

  const {
    data: coursesData,
    error: coursesError,
  } =
    courseIds.length > 0
      ? await supabase
          .from("courses")
          .select(
            "id, title"
          )
          .in(
            "id",
            courseIds
          )
      : {
          data: [],
          error: null,
        };

  if (coursesError) {
    throw new Error(
      "Unable to load payment courses."
    );
  }

  const studentMap =
    new Map(
      (
        (studentsData ??
          []) as unknown as StudentLookup[]
      ).map(
        (student) => [
          student.id,
          student,
        ]
      )
    );

  const courseMap =
    new Map(
      (
        (coursesData ??
          []) as unknown as CourseLookup[]
      ).map(
        (course) => [
          course.id,
          course,
        ]
      )
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
      (
        total,
        payment
      ) =>
        total +
        payment.amount,
      0
    );

  return (
    <section className="section">
      <div
        className="container rn-dashboard-shell"
      >
        <div
          className="rn-admin-heading"
        >
          <div>
            <div className="rn-brand-kicker">
              RuffNeck Learn
            </div>

            <h2>
              Payment Management
            </h2>

            <p className="muted">
              Flutterwave course
              payments and enrollment
              transactions.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/admin/lms"
              className="btn btn-ghost"
            >
              LMS Admin
            </Link>

            <Link
              href="/admin/ai-drafts"
              className="btn btn-ghost"
            >
              AI Drafts
            </Link>

            <Link
              href="/admin/assessments"
              className="btn btn-ghost"
            >
              Assessments
            </Link>

            <Link
              href="/admin/projects"
              className="btn btn-ghost"
            >
              Capstones
            </Link>
          </div>
        </div>

        <div className="rn-admin-stats">
          <div className="rn-admin-stat">
            <span className="rn-admin-stat-icon">
              ₦
            </span>

            <span>
              <span className="muted">
                Collected
              </span>

              <strong>
                ₦
                {totalCollected.toLocaleString(
                  "en-NG"
                )}
              </strong>
            </span>
          </div>

          <div className="rn-admin-stat">
            <span className="rn-admin-stat-icon">
              ✓
            </span>

            <span>
              <span className="muted">
                Successful
              </span>

              <strong>
                {
                  successfulPayments.length
                }
              </strong>
            </span>
          </div>

          <div className="rn-admin-stat">
            <span className="rn-admin-stat-icon">
              …
            </span>

            <span>
              <span className="muted">
                Pending
              </span>

              <strong>
                {
                  pendingPayments.length
                }
              </strong>
            </span>
          </div>

          <div className="rn-admin-stat">
            <span className="rn-admin-stat-icon">
              !
            </span>

            <span>
              <span className="muted">
                Failed / Cancelled
              </span>

              <strong>
                {
                  failedPayments.length
                }
              </strong>
            </span>
          </div>
        </div>

        <section className="rn-admin-list-panel">
          <div className="rn-admin-list-header">
            <div>
              <div className="rn-brand-kicker">
                Transactions
              </div>

              <h3>
                Flutterwave Payments
              </h3>

              <p className="muted">
                {payments.length} payment
                {payments.length ===
                1
                  ? ""
                  : "s"}{" "}
                recorded.
              </p>
            </div>
          </div>

          {payments.length ===
          0 ? (
            <div className="rn-empty-state">
              <div className="rn-empty-icon">
                ₦
              </div>

              <strong>
                No payments yet
              </strong>

              <p>
                Course payment
                transactions will
                appear here after
                students begin
                purchasing paid
                courses.
              </p>
            </div>
          ) : (
            <div className="rn-table-wrap">
              <table className="rn-admin-table">
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
                      Flutterwave
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
                  </tr>
                </thead>

                <tbody>
                  {payments.map(
                    (payment) => {
                      const student =
                        studentMap.get(
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
                                "Unnamed student"}
                            </strong>

                            {student?.email ? (
                              <span className="rn-table-subtext">
                                {
                                  student.email
                                }
                              </span>
                            ) : null}
                          </td>

                          <td>
                            <strong>
                              {course?.title ||
                                payment.course_slug}
                            </strong>

                            <span className="rn-table-subtext">
                              {
                                payment.course_slug
                              }
                            </span>
                          </td>

                          <td>
                            <strong>
                              {formatAmount(
                                payment.amount,
                                payment.currency
                              )}
                            </strong>
                          </td>

                          <td>
                            <span className="rn-table-subtext">
                              tx_ref
                            </span>

                            <code
                              style={{
                                display:
                                  "block",
                                marginTop:
                                  3,
                                fontSize:
                                  "0.72rem",
                                wordBreak:
                                  "break-all",
                              }}
                            >
                              {
                                payment.tx_ref
                              }
                            </code>

                            {payment.flutterwave_transaction_id ? (
                              <span className="rn-table-subtext">
                                ID:{" "}
                                {
                                  payment.flutterwave_transaction_id
                                }
                              </span>
                            ) : null}
                          </td>

                          <td>
                            <span
                              className={`rn-payment-status ${statusClass(
                                payment.status
                              )}`}
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
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}