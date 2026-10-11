import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createFlutterwavePayment } from "@/lib/flutterwave";

export const runtime = "nodejs";

type Course = {
  id: string;
  title: string;
  slug: string;
  price_ngn: number;
  currency: string | null;
  is_free: boolean;
  status: string;
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
  per_student_limit: number | null;
  is_active: boolean;
};

type ExistingPayment = {
  id: string;
  tx_ref: string;
  checkout_url: string | null;
  status: string;
  amount: number;
  currency: string;
  original_amount: number | null;
  discount_code_id: string | null;
  discount_amount: number | null;
};

function makeTxRef() {
  return `RNL-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function calculateDiscount(
  price: number,
  discount: DiscountCode,
): number {
  let amount =
    discount.discount_type === "percentage"
      ? Math.floor((price * discount.discount_value) / 100)
      : Math.floor(discount.discount_value);

  if (
    discount.maximum_discount !== null &&
    discount.maximum_discount > 0
  ) {
    amount = Math.min(
      amount,
      Math.floor(discount.maximum_discount),
    );
  }

  return Math.max(0, Math.min(price, amount));
}

function isValidDate(value: string | null): boolean {
  return value === null || Number.isFinite(new Date(value).getTime());
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonError("You must be logged in to enroll.", 401);
    }

    const admin = createAdminClient();

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("full_name, email, phone, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Profile lookup error:", profileError);
      return jsonError("Unable to load your profile.", 500);
    }

    if (
      profile?.role &&
      !["student", "admin", "instructor"].includes(profile.role)
    ) {
      return jsonError(
        "Your account is not permitted to enroll.",
        403,
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON request.");
    }

    const input =
      typeof body === "object" && body !== null
        ? (body as Record<string, unknown>)
        : {};

    const courseId =
      typeof input.courseId === "string"
        ? input.courseId.trim()
        : "";

    const courseSlug =
      typeof input.courseSlug === "string"
        ? input.courseSlug.trim()
        : "";

    const discountCodeInput =
      typeof input.discountCode === "string"
        ? input.discountCode.trim().toUpperCase()
        : typeof input.code === "string"
          ? input.code.trim().toUpperCase()
          : "";

    if (!courseId && !courseSlug) {
      return jsonError("Course ID or course slug is required.");
    }

    if (
      courseId.length > 100 ||
      courseSlug.length > 200 ||
      discountCodeInput.length > 100
    ) {
      return jsonError("Invalid enrollment request.");
    }

    let courseQuery = admin
      .from("courses")
      .select(
        "id, title, slug, price_ngn, currency, is_free, status",
      );

    const { data: courseData, error: courseError } = courseId
      ? await courseQuery.eq("id", courseId).maybeSingle()
      : await courseQuery.eq("slug", courseSlug).maybeSingle();

    if (courseError) {
      console.error("Course lookup error:", courseError);
      return jsonError("Unable to load the course.", 500);
    }

    const course = courseData as Course | null;

    if (!course) {
      return jsonError("Course not found.", 404);
    }

    if (course.status !== "published") {
      return jsonError(
        "This course is not currently available for enrollment.",
      );
    }

    const {
      data: existingEnrollment,
      error: enrollmentError,
    } = await admin
      .from("enrollments")
      .select("id, enrollment_status, payment_status")
      .eq("student_id", user.id)
      .eq("course_id", course.id)
      .maybeSingle();

    if (enrollmentError) {
      console.error("Enrollment lookup error:", enrollmentError);
      return jsonError("Unable to verify your enrollment.", 500);
    }

    if (
      existingEnrollment &&
      ["active", "completed"].includes(
        existingEnrollment.enrollment_status,
      )
    ) {
      return NextResponse.json({
        success: true,
        alreadyEnrolled: true,
        paymentRequired: false,
        enrollmentId: existingEnrollment.id,
        courseSlug: course.slug,
      });
    }

    const isFree =
      Boolean(course.is_free) ||
      Number(course.price_ngn ?? 0) <= 0;

    const originalAmount = isFree ? 0 : Number(course.price_ngn);

    if (
      !isFree &&
      (!Number.isFinite(originalAmount) || originalAmount <= 0)
    ) {
      return jsonError("This paid course has an invalid price.");
    }

    let discount: DiscountCode | null = null;
    let discountAmount = 0;

    if (discountCodeInput) {
      if (isFree) {
        return jsonError(
          "Discount codes are only available for paid courses.",
        );
      }

      const { data: discountData, error: discountError } =
        await admin
          .from("course_discount_codes")
          .select(
            "id, code, discount_type, discount_value, course_id, minimum_amount, maximum_discount, starts_at, expires_at, usage_limit, usage_count, per_student_limit, is_active",
          )
          .eq("code", discountCodeInput)
          .maybeSingle();

      if (discountError) {
        console.error("Discount lookup error:", discountError);
        return jsonError(
          "Unable to verify the discount code.",
          500,
        );
      }

      discount = discountData as DiscountCode | null;

      if (!discount || !discount.is_active) {
        return jsonError("Invalid or inactive discount code.");
      }

      if (
        !isValidDate(discount.starts_at) ||
        !isValidDate(discount.expires_at)
      ) {
        return jsonError(
          "This discount code has invalid date settings.",
        );
      }

      const now = Date.now();

      if (
        discount.starts_at &&
        now < new Date(discount.starts_at).getTime()
      ) {
        return jsonError(
          "This discount code is not active yet.",
        );
      }

      if (
        discount.expires_at &&
        now > new Date(discount.expires_at).getTime()
      ) {
        return jsonError("This discount code has expired.");
      }

      if (
        discount.course_id &&
        discount.course_id !== course.id
      ) {
        return jsonError(
          "This discount code does not apply to this course.",
        );
      }

      if (
        discount.minimum_amount !== null &&
        originalAmount < discount.minimum_amount
      ) {
        return jsonError(
          `This code requires a minimum course amount of ₦${discount.minimum_amount.toLocaleString()}.`,
        );
      }

      if (
        !["percentage", "fixed"].includes(
          discount.discount_type,
        ) ||
        !Number.isFinite(discount.discount_value) ||
        discount.discount_value <= 0 ||
        (discount.discount_type === "percentage" &&
          discount.discount_value > 100)
      ) {
        return jsonError(
          "This discount code has an invalid discount value.",
        );
      }

      if (
        discount.usage_limit !== null &&
        discount.usage_count >= discount.usage_limit
      ) {
        return jsonError(
          "This discount code has reached its usage limit.",
        );
      }

      const {
        count,
        error: redemptionError,
      } = await admin
        .from("course_discount_redemptions")
        .select("id", { count: "exact", head: true })
        .eq("discount_code_id", discount.id)
        .eq("student_id", user.id);

      if (redemptionError) {
        console.error(
          "Discount usage lookup error:",
          redemptionError,
        );
        return jsonError(
          "Unable to verify discount usage.",
          500,
        );
      }

      if (
        discount.per_student_limit !== null &&
        (count ?? 0) >= discount.per_student_limit
      ) {
        return jsonError(
          "You have reached the usage limit for this discount code.",
        );
      }

      discountAmount = calculateDiscount(
        originalAmount,
        discount,
      );
    }

    const finalAmount = Math.max(
      0,
      originalAmount - discountAmount,
    );

    /*
     * Free and fully discounted enrollments bypass checkout.
     */
    if (isFree || finalAmount === 0) {
      let enrollmentId: string;

      if (existingEnrollment) {
        const { data: updated, error } = await admin
          .from("enrollments")
          .update({
            enrollment_status:
              existingEnrollment.enrollment_status === "completed"
                ? "completed"
                : "active",
            payment_status: isFree ? "free" : "paid",
          })
          .eq("id", existingEnrollment.id)
          .select("id")
          .single();

        if (error) {
          throw new Error(error.message);
        }

        enrollmentId = updated.id;
      } else {
        const { data: created, error } = await admin
          .from("enrollments")
          .insert({
            student_id: user.id,
            course_id: course.id,
            enrollment_status: "active",
            payment_status: isFree ? "free" : "paid",
            progress_percent: 0,
            enrolled_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (error) {
          if (error.code === "23505") {
            return jsonError(
              "Your enrollment is being processed. Refresh and try again.",
              409,
            );
          }

          throw new Error(error.message);
        }

        enrollmentId = created.id;
      }

      if (discount && discountAmount > 0) {
        const { error } = await admin.rpc(
          "record_discount_redemption",
          {
            p_discount_code_id: discount.id,
            p_student_id: user.id,
            p_course_id: course.id,
            p_payment_id: null,
            p_amount_before_discount: Math.round(originalAmount),
            p_discount_amount: Math.round(discountAmount),
            p_amount_paid: 0,
          },
        );

        if (error) {
          console.error(
            "Full-discount redemption recording failed:",
            error,
          );

          return jsonError(
            "Enrollment was created, but discount recording failed. Contact support.",
            500,
          );
        }
      }

      return NextResponse.json({
        success: true,
        alreadyEnrolled: false,
        paymentRequired: false,
        enrollmentId,
        courseSlug: course.slug,
        originalAmount,
        discountAmount,
        finalAmount,
      });
    }

    const amount = finalAmount;
    const currency = course.currency || "NGN";

    /*
     * Check for existing pending transactions before creating a
     * new Flutterwave checkout.
     */
    const {
      data: existingPaymentsData,
      error: existingPaymentError,
    } = await admin
      .from("course_payments")
      .select(
        "id, tx_ref, checkout_url, status, amount, currency, original_amount, discount_code_id, discount_amount",
      )
      .eq("student_id", user.id)
      .eq("course_id", course.id)
      .in("status", ["initiated", "pending"])
      .order("created_at", { ascending: false })
      .limit(10);

    if (existingPaymentError) {
      console.error(
        "Existing payment lookup error:",
        existingPaymentError,
      );
      return jsonError(
        "Unable to check existing payments.",
        500,
      );
    }

    const existingPayments =
      (existingPaymentsData ?? []) as ExistingPayment[];

    const matchingPayment = existingPayments.find(
      (payment) =>
        Boolean(payment.checkout_url) &&
        Number(payment.amount) === amount &&
        payment.currency === currency &&
        Number(payment.original_amount) === originalAmount &&
        (payment.discount_code_id ?? null) ===
          (discount?.id ?? null) &&
        Number(payment.discount_amount ?? 0) === discountAmount,
    );

    if (matchingPayment?.checkout_url) {
      return NextResponse.json({
        success: true,
        alreadyEnrolled: false,
        paymentRequired: true,
        payment_url: matchingPayment.checkout_url,
        tx_ref: matchingPayment.tx_ref,
        paymentId: matchingPayment.id,
        courseSlug: course.slug,
        originalAmount,
        discountAmount,
        finalAmount,
      });
    }

    /*
     * Never create a second pending payment for the same course.
     * The existing checkout may still be payable at Flutterwave.
     */
    if (existingPayments.length > 0) {
      return NextResponse.json(
        {
          error:
            "You already have a pending payment for this course with different payment details. Complete or resolve that payment before changing the discount code.",
          code: "PENDING_PAYMENT_CONFLICT",
          courseSlug: course.slug,
        },
        { status: 409 },
      );
    }

    const customerName =
      profile?.full_name ||
      user.user_metadata?.full_name ||
      user.email ||
      "RuffNeck Learn Student";

    const customerEmail = profile?.email || user.email;

    if (!customerEmail) {
      return jsonError(
        "A valid email address is required before payment.",
      );
    }

    const siteUrl = (
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://ruffneck-lms.vercel.app"
    ).replace(/\/+$/, "");

    const txRef = makeTxRef();

    const flutterwavePayment = await createFlutterwavePayment({
      amount,
      currency,
      txRef,
      redirectUrl: `${siteUrl}/api/payments/flutterwave/callback`,
      customer: {
        email: customerEmail,
        name: customerName,
        phone_number:
          profile?.phone ||
          user.user_metadata?.phone ||
          undefined,
      },
      courseId: course.id,
      courseTitle: course.title,
      studentId: user.id,
    });

    const checkoutUrl = flutterwavePayment.link;

    if (!checkoutUrl || !/^https:\/\//i.test(checkoutUrl)) {
      console.error(
        "Invalid Flutterwave checkout URL:",
        flutterwavePayment,
      );
      return jsonError(
        "Flutterwave did not return a valid checkout URL.",
        502,
      );
    }

    const {
      data: payment,
      error: paymentError,
    } = await admin
      .from("course_payments")
      .insert({
        student_id: user.id,
        course_id: course.id,
        course_slug: course.slug,
        tx_ref: txRef,
        flutterwave_transaction_id: null,
        amount,
        currency,
        status: "initiated",
        checkout_url: checkoutUrl,
        original_amount: originalAmount,
        discount_code_id: discount?.id ?? null,
        discount_amount: discountAmount,
      })
      .select("id, tx_ref, checkout_url, status")
      .single();

    if (paymentError) {
      console.error("Course payment insert error:", paymentError);

      /*
       * Another concurrent request may have created a pending
       * payment after our initial lookup. Do not create a duplicate.
       */
      if (paymentError.code === "23505") {
        return NextResponse.json(
          {
            error:
              "A payment for this course is already being created. Refresh and try again.",
            code: "PENDING_PAYMENT_CONFLICT",
          },
          { status: 409 },
        );
      }

      return jsonError(
        "Unable to create the payment record. Please retry.",
        500,
      );
    }

    return NextResponse.json({
      success: true,
      alreadyEnrolled: false,
      paymentRequired: true,
      payment_url: payment.checkout_url,
      tx_ref: payment.tx_ref,
      paymentId: payment.id,
      courseSlug: course.slug,
      originalAmount,
      discountAmount,
      finalAmount,
    });
  } catch (error) {
    console.error("Student enrollment error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to process enrollment.",
      },
      { status: 500 },
    );
  }
}