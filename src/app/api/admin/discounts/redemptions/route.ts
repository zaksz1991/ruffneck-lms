import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const adminClient = createAdminClient();

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      );
    }

    const role = profile?.role;

    if (role !== "admin" && role !== "instructor") {
      return NextResponse.json(
        { error: "You do not have permission to view redemption reports." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const codeId = searchParams.get("codeId")?.trim() || null;
    const courseId = searchParams.get("courseId")?.trim() || null;

    let allowedCourseIds: string[] | null = null;

    if (role === "instructor") {
      const { data: instructorCourses, error: instructorCoursesError } =
        await adminClient
          .from("courses")
          .select("id")
          .eq("instructor_id", user.id);

      if (instructorCoursesError) {
        return NextResponse.json(
          { error: instructorCoursesError.message },
          { status: 500 }
        );
      }

      allowedCourseIds = (instructorCourses ?? []).map(
        (course) => course.id
      );

      if (courseId && !allowedCourseIds.includes(courseId)) {
        return NextResponse.json(
          { error: "You do not have permission to view this course." },
          { status: 403 }
        );
      }
    }

    let query = adminClient
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
          slug,
          instructor_id
        ),
        course_payments (
          id,
          tx_ref,
          flutterwave_transaction_id,
          status
        ),
        profiles:student_id (
          id,
          display_name,
          full_name,
          email
        )
        `
      )
      .order("created_at", { ascending: false });

    if (codeId) {
      query = query.eq("discount_code_id", codeId);
    }

    if (courseId) {
      query = query.eq("course_id", courseId);
    }

    if (allowedCourseIds) {
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

      query = query.in("course_id", allowedCourseIds);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const redemptions = data ?? [];

    const summary = redemptions.reduce(
      (totals, redemption) => {
        totals.redemptions += 1;
        totals.originalAmount += Number(
          redemption.amount_before_discount ?? 0
        );
        totals.discountAmount += Number(
          redemption.discount_amount ?? 0
        );
        totals.amountPaid += Number(
          redemption.amount_paid ?? 0
        );

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
      redemptions,
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
          error instanceof Error
            ? error.message
            : "Unable to load redemption report.",
      },
      { status: 500 }
    );
  }
}