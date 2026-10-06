import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Course = {
  id: string;
  title: string;
  slug: string;
  is_free: boolean;
  price_ngn: number;
};

type DiscountCode = {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  course_id: string | null;
  minimum_amount: number | null;
  maximum_discount: number | null;
  starts_at: string | null;
  expires_at: string | null;
  usage_limit: number | null;
  usage_count: number;
  per_student_limit: number;
  is_active: boolean;
};

function normalizeCode(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toUpperCase();
}

function calculateDiscount(
  price: number,
  discount: DiscountCode
): number {
  let amount = 0;

  if (discount.discount_type === "percentage") {
    amount = Math.floor(
      (price * discount.discount_value) / 100
    );

    if (
      discount.maximum_discount !== null &&
      amount > discount.maximum_discount
    ) {
      amount = discount.maximum_discount;
    }
  } else {
    amount = discount.discount_value;
  }

  return Math.max(0, Math.min(price, amount));
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "You must be logged in to use a discount code." },
        { status: 401 }
      );
    }

    const body = await request.json();

    const courseSlug =
      typeof body?.courseSlug === "string"
        ? body.courseSlug.trim()
        : "";

    const code = normalizeCode(body?.code);

    if (!courseSlug) {
      return NextResponse.json(
        { error: "Course is required." },
        { status: 400 }
      );
    }

    if (!code) {
      return NextResponse.json(
        { error: "Discount code is required." },
        { status: 400 }
      );
    }

    if (code.length > 100) {
      return NextResponse.json(
        { error: "Invalid discount code." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: course, error: courseError } = await admin
      .from("courses")
      .select("id, title, slug, is_free, price_ngn")
      .eq("slug", courseSlug)
      .eq("status", "published")
      .maybeSingle<Course>();

    if (courseError) {
      console.error("Discount course lookup error:", courseError);

      return NextResponse.json(
        { error: "Unable to verify the course." },
        { status: 500 }
      );
    }

    if (!course) {
      return NextResponse.json(
        { error: "Course not found." },
        { status: 404 }
      );
    }

    if (course.is_free || course.price_ngn <= 0) {
      return NextResponse.json(
        { error: "Discount codes are only available for paid courses." },
        { status: 400 }
      );
    }

    const now = new Date();

    const { data: discount, error: discountError } = await admin
      .from("course_discount_codes")
      .select(`
        id,
        code,
        discount_type,
        discount_value,
        course_id,
        minimum_amount,
        maximum_discount,
        starts_at,
        expires_at,
        usage_limit,
        usage_count,
        per_student_limit,
        is_active
      `)
      .eq("code", code)
      .maybeSingle<DiscountCode>();

    if (discountError) {
      console.error(
        "Discount code lookup error:",
        discountError
      );

      return NextResponse.json(
        { error: "Unable to verify the discount code." },
        { status: 500 }
      );
    }

    if (!discount) {
      return NextResponse.json(
        { error: "Invalid discount code." },
        { status: 400 }
      );
    }

    if (!discount.is_active) {
      return NextResponse.json(
        { error: "This discount code is no longer active." },
        { status: 400 }
      );
    }

    if (
      discount.starts_at &&
      now < new Date(discount.starts_at)
    ) {
      return NextResponse.json(
        { error: "This discount code is not active yet." },
        { status: 400 }
      );
    }

    if (
      discount.expires_at &&
      now > new Date(discount.expires_at)
    ) {
      return NextResponse.json(
        { error: "This discount code has expired." },
        { status: 400 }
      );
    }

    if (
      discount.usage_limit !== null &&
      discount.usage_count >= discount.usage_limit
    ) {
      return NextResponse.json(
        { error: "This discount code has reached its usage limit." },
        { status: 400 }
      );
    }

    if (
      discount.course_id !== null &&
      discount.course_id !== course.id
    ) {
      return NextResponse.json(
        { error: "This discount code does not apply to this course." },
        { status: 400 }
      );
    }

    if (
      discount.minimum_amount !== null &&
      course.price_ngn < discount.minimum_amount
    ) {
      return NextResponse.json(
        {
          error: `This code requires a minimum course amount of ₦${discount.minimum_amount.toLocaleString()}.`,
        },
        { status: 400 }
      );
    }

    const { count: studentUsageCount, error: usageError } =
      await admin
        .from("course_discount_redemptions")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("discount_code_id", discount.id)
        .eq("student_id", user.id);

    if (usageError) {
      console.error(
        "Discount redemption lookup error:",
        usageError
      );

      return NextResponse.json(
        { error: "Unable to verify discount usage." },
        { status: 500 }
      );
    }

    if (
      (studentUsageCount ?? 0) >= discount.per_student_limit
    ) {
      return NextResponse.json(
        {
          error:
            "You have already used this discount code the maximum allowed number of times.",
        },
        { status: 400 }
      );
    }

    const discountAmount = calculateDiscount(
      course.price_ngn,
      discount
    );

    const finalAmount = Math.max(
      0,
      course.price_ngn - discountAmount
    );

    return NextResponse.json({
      valid: true,
      code: discount.code,
      course: {
        id: course.id,
        title: course.title,
        slug: course.slug,
      },
      originalAmount: course.price_ngn,
      discountAmount,
      finalAmount,
      discountType: discount.discount_type,
      discountValue: discount.discount_value,
      isFullDiscount: finalAmount === 0,
    });
  } catch (error) {
    console.error("Discount validation error:", error);

    return NextResponse.json(
      { error: "Unable to validate discount code." },
      { status: 500 }
    );
  }
}