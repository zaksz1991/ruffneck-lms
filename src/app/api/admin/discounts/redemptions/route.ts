import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type UserRole = "admin" | "instructor" | "student";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {
      console.error(
        "Discount redemption profile lookup failed:",
        profileError
      );

      return NextResponse.json(
        { error: "Unable to verify account permissions." },
        { status: 500 }
      );
    }

    const role = profile?.role as UserRole | undefined;

    if (role !== "admin" && role !== "instructor") {
      return NextResponse.json(
        { error: "Forbidden." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const codeId = searchParams.get("codeId");
    const courseId = searchParams.get("courseId");

    const admin = createAdminClient();

    /*
     * Build the instructor's allowed course set first.
     * This is required because the service-role client bypasses RLS.
     */
    let allowedCourseIds: string[] | null = null;

    if (role === "instructor") {
      const { data: instructorCourses, error: coursesError } =
        await admin
          .from("courses")
          .select("id")
          .eq("instructor_id", user.id);

      if (coursesError) {
        console.error(
          "Instructor course lookup failed:",
          coursesError
        );

        return NextResponse.json(
          { error: "Unable to load instructor courses." },
          { status: 500 }
        );
      }

      allowedCourseIds =
        instructorCourses?.map((course) => course.id) ?? [];

      if (courseId && !allowedCourseIds.includes(courseId)) {
        return NextResponse.json(
          { error: "You do not have access to this course report." },
          { status: 403 }
        );
      }
    }

    /*
     * If a specific discount code was requested, verify that
     * the code itself belongs to an accessible course.
     */
    if (codeId) {
      const { data: discount, error: discountError } =
        await admin
          .from("course_discount_codes")
          .select("id, course_id")
          .eq("id", codeId)
          .maybeSingle();

      if (discountError) {
        console.error(
          "Discount lookup failed:",
          discountError
        );

        return NextResponse.json(
          { error: "Unable to verify discount code." },
          { status: 500 }
        );
      }

      if (!discount) {
        return NextResponse.json(
          { error: "Discount code not found." },
          { status: 404 }
        );
      }

      if (
        role === "instructor" &&
        discount.course_id &&
        !allowedCourseIds?.includes(discount.course_id)
      ) {
        return NextResponse.json(
          { error: "You do not have access to this discount report." },
          { status: 403 }
        );
      }

      /*
       * Site-wide discount codes have no course_id.
       * Instructors cannot view those reports because there is
       * no safe course ownership boundary.
       */
      if (
        role === "instructor" &&
        !discount.course_id
      ) {
        return NextResponse.json(
          { error: "You do not have access to this discount report." },
          { status: 403 }
        );
      }
    }

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
          created_at,
          course_discount_codes (
            id,
            code,
            discount_type,
            discount_value
          ),
          courses (
            id,
            title,
            slug
          ),
          course_payments (
            id,
            tx_ref,
            flutterwave_transaction_id,
            status
          )
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

    if (
      role === "instructor" &&
      allowedCourseIds
    ) {
      if (allowedCourseIds.length === 0) {
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

      query = query.in(
        "course_id",
        allowedCourseIds
      );
    }

    const {
      data: redemptions,
      error: redemptionsError,
    } = await query;

    if (redemptionsError) {
      console.error(
        "Discount redemption query failed:",
        redemptionsError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load discount redemptions.",
        },
        { status: 500 }
      );
    }

    const studentIds = [
      ...new Set(
        (redemptions ?? []).map(
          (redemption) =>
            redemption.student_id
        )
      ),
    ];

    let students: Array<{
      id: string;
      display_name: string | null;
      full_name: string | null;
      email: string | null;
    }> = [];

    if (studentIds.length > 0) {
      const {
        data: studentProfiles,
        error: studentsError,
      } = await admin
        .from("profiles")
        .select(
          "id, display_name, full_name, email"
        )
        .in("id", studentIds);

      if (studentsError) {
        console.error(
          "Student profile lookup failed:",
          studentsError
        );

        return NextResponse.json(
          {
            error:
              "Unable to load student information.",
          },
          { status: 500 }
        );
      }

      students = studentProfiles ?? [];
    }

    const studentMap = new Map(
      students.map((student) => [
        student.id,
        student,
      ])
    );

    const formatted = (redemptions ?? []).map(
      (redemption) => {
        const discount = Array.isArray(
          redemption.course_discount_codes
        )
          ? redemption.course_discount_codes[0]
          : redemption.course_discount_codes;

        const course = Array.isArray(
          redemption.courses
        )
          ? redemption.courses[0]
          : redemption.courses;

        const payment = Array.isArray(
          redemption.course_payments
        )
          ? redemption.course_payments[0]
          : redemption.course_payments;

        const student = studentMap.get(
          redemption.student_id
        );

        const studentName =
          student?.display_name ||
          student?.full_name ||
          student?.email ||
          redemption.student_id;

        return {
          id: redemption.id,
          createdAt: redemption.created_at,

          code: discount?.code ?? "Unknown",
          discountType:
            discount?.discount_type ?? null,
          discountValue:
            discount?.discount_value ?? null,

          courseId: redemption.course_id,
          courseTitle:
            course?.title ?? "Unknown course",
          courseSlug:
            course?.slug ?? null,

          studentId:
            redemption.student_id,
          studentName,

          paymentId:
            redemption.payment_id ?? null,
          txRef:
            payment?.tx_ref ?? null,
          flutterwaveTransactionId:
            payment?.flutterwave_transaction_id ??
            null,
          paymentStatus:
            payment?.status ?? null,

          amountBeforeDiscount:
            redemption.amount_before_discount,
          discountAmount:
            redemption.discount_amount,
          amountPaid:
            redemption.amount_paid,
        };
      }
    );

    const summary = formatted.reduce(
      (result, redemption) => {
        result.redemptions += 1;
        result.originalAmount +=
          redemption.amountBeforeDiscount;
        result.discountAmount +=
          redemption.discountAmount;
        result.amountPaid +=
          redemption.amountPaid;

        return result;
      },
      {
        redemptions: 0,
        originalAmount: 0,
        discountAmount: 0,
        amountPaid: 0,
      }
    );

    return NextResponse.json({
      redemptions: formatted,
      summary,
    });
  } catch (error) {
    console.error(
      "Discount redemption report error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unexpected error loading redemption report.",
      },
      { status: 500 }
    );
  }
}