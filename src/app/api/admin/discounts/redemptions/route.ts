import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (
    profile?.role !== "admin" &&
    profile?.role !== "instructor"
  ) {
    return null;
  }

  return {
    userId: user.id,
    role: profile.role,
  };
}

export async function GET(request: Request) {
  try {
    const access = await requireAdmin();

    if (!access) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const admin = createAdminClient();
    const { searchParams } = new URL(request.url);

    const codeId = searchParams.get("codeId");
    const courseId = searchParams.get("courseId");

    let query = admin
      .from("course_discount_redemptions")
      .select(
        `
          id,
          discount_code_id,
          student_id,
          course_id,
          payment_id,
          amount_before_discount,
          discount_amount,
          amount_paid,
          created_at
        `
      )
      .order("created_at", {
        ascending: false,
      });

    if (codeId) {
      query = query.eq(
        "discount_code_id",
        codeId
      );
    }

    if (courseId) {
      query = query.eq(
        "course_id",
        courseId
      );
    }

    const {
      data: redemptions,
      error,
    } = await query;

    if (error) {
      console.error(
        "Discount redemption query error:",
        error
      );

      return NextResponse.json(
        {
          error:
            "Unable to load discount redemptions.",
        },
        { status: 500 }
      );
    }

    const rows = redemptions ?? [];

    if (!rows.length) {
      return NextResponse.json({
        redemptions: [],
        summary: {
          redemptions: 0,
          originalAmount: 0,
          discountAmount: 0,
          amountPaid: 0,
        },
      });
    }

    const discountIds = [
      ...new Set(
        rows.map(
          (row) => row.discount_code_id
        )
      ),
    ];

    const courseIds = [
      ...new Set(
        rows.map(
          (row) => row.course_id
        )
      ),
    ];

    const studentIds = [
      ...new Set(
        rows.map(
          (row) => row.student_id
        )
      ),
    ];

    const paymentIds = [
      ...new Set(
        rows
          .map((row) => row.payment_id)
          .filter(Boolean)
      ),
    ];

    const [
      discountResult,
      courseResult,
      profileResult,
      paymentResult,
    ] = await Promise.all([
      admin
        .from("course_discount_codes")
        .select(
          "id, code, discount_type, discount_value"
        )
        .in("id", discountIds),

      admin
        .from("courses")
        .select("id, title, slug")
        .in("id", courseIds),

      admin
        .from("profiles")
        .select("id, display_name, full_name, email")
        .in("id", studentIds),

      paymentIds.length
        ? admin
            .from("course_payments")
            .select(
              "id, tx_ref, flutterwave_transaction_id, status"
            )
            .in("id", paymentIds)
        : Promise.resolve({
            data: [],
            error: null,
          }),
    ]);

    if (discountResult.error) {
      console.error(
        "Discount lookup error:",
        discountResult.error
      );
    }

    if (courseResult.error) {
      console.error(
        "Course lookup error:",
        courseResult.error
      );
    }

    if (profileResult.error) {
      console.error(
        "Student lookup error:",
        profileResult.error
      );
    }

    if (paymentResult.error) {
      console.error(
        "Payment lookup error:",
        paymentResult.error
      );
    }

    const discounts = new Map(
      (discountResult.data ?? []).map(
        (item) => [item.id, item]
      )
    );

    const courses = new Map(
      (courseResult.data ?? []).map(
        (item) => [item.id, item]
      )
    );

    const students = new Map(
      (profileResult.data ?? []).map(
        (item) => [item.id, item]
      )
    );

    const payments = new Map(
      (paymentResult.data ?? []).map(
        (item) => [item.id, item]
      )
    );

    const result = rows.map((row) => {
      const discount =
        discounts.get(row.discount_code_id);

      const course =
        courses.get(row.course_id);

      const student =
        students.get(row.student_id);

      const payment = row.payment_id
        ? payments.get(row.payment_id)
        : null;

      return {
        id: row.id,
        createdAt: row.created_at,

        code: discount?.code ?? "Unknown",
        discountType:
          discount?.discount_type ?? null,
        discountValue:
          discount?.discount_value ?? null,

        courseId: row.course_id,
        courseTitle:
          course?.title ?? "Unknown course",
        courseSlug:
          course?.slug ?? null,

        studentId: row.student_id,
        studentName:
          student?.display_name ??
          student?.full_name ??
          student?.email ??
          "Student",

        paymentId: row.payment_id,
        txRef: payment?.tx_ref ?? null,
        flutterwaveTransactionId:
          payment?.flutterwave_transaction_id ??
          null,
        paymentStatus:
          payment?.status ?? null,

        amountBeforeDiscount:
          row.amount_before_discount,
        discountAmount:
          row.discount_amount,
        amountPaid:
          row.amount_paid,
      };
    });

    const summary = result.reduce(
      (totals, row) => {
        totals.redemptions += 1;
        totals.originalAmount +=
          row.amountBeforeDiscount;
        totals.discountAmount +=
          row.discountAmount;
        totals.amountPaid +=
          row.amountPaid;

        return totals;
      },
      {
        redemptions: 0,
        originalAmount: 0,
        discountAmount: 0,
        amountPaid: 0,
      }
    );

    return NextResponse.json({
      redemptions: result,
      summary,
    });
  } catch (error) {
    console.error(
      "Discount redemption API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to load discount redemption data.",
      },
      { status: 500 }
    );
  }
}