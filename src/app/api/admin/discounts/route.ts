import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type DiscountType = "percentage" | "fixed";

type DiscountPayload = {
  id?: string;
  code?: string;
  discountType?: DiscountType;
  discountValue?: number;
  courseId?: string | null;
  minimumAmount?: number | null;
  maximumDiscount?: number | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  usageLimit?: number | null;
  perStudentLimit?: number;
  isActive?: boolean;
  description?: string | null;
};

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      ),
    };
  }

  const { data: profile, error } =
    await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

  if (
    error ||
    !profile ||
    !["admin", "instructor"].includes(
      profile.role
    )
  ) {
    return {
      error: NextResponse.json(
        { error: "Administrator access required." },
        { status: 403 }
      ),
    };
  }

  return {
    user,
    role: profile.role as string,
    admin: createAdminClient(),
  };
}

function normalizeNullableNumber(
  value: number | null | undefined
) {
  if (
    value === null ||
    value === undefined ||
    value === 0
  ) {
    return null;
  }

  return Number.isFinite(value)
    ? Math.round(value)
    : null;
}

function validatePayload(
  payload: DiscountPayload
) {
  const code = payload.code
    ?.trim()
    .toUpperCase();

  if (!code) {
    return "Discount code is required.";
  }

  if (!/^[A-Z0-9_-]{3,100}$/.test(code)) {
    return "Code may contain only letters, numbers, underscores and hyphens.";
  }

  if (
    payload.discountType !== "percentage" &&
    payload.discountType !== "fixed"
  ) {
    return "Select a valid discount type.";
  }

  const discountValue = Number(
    payload.discountValue
  );

  if (
    !Number.isFinite(discountValue) ||
    discountValue <= 0
  ) {
    return "Discount value must be greater than zero.";
  }

  if (
    payload.discountType === "percentage" &&
    discountValue > 100
  ) {
    return "Percentage discount cannot exceed 100%.";
  }

  const minimumAmount =
    normalizeNullableNumber(
      payload.minimumAmount
    );

  const maximumDiscount =
    normalizeNullableNumber(
      payload.maximumDiscount
    );

  const usageLimit =
    normalizeNullableNumber(
      payload.usageLimit
    );

  const perStudentLimit =
    Number(payload.perStudentLimit ?? 1);

  if (
    minimumAmount !== null &&
    minimumAmount <= 0
  ) {
    return "Minimum amount must be greater than zero.";
  }

  if (
    maximumDiscount !== null &&
    maximumDiscount <= 0
  ) {
    return "Maximum discount must be greater than zero.";
  }

  if (
    usageLimit !== null &&
    usageLimit <= 0
  ) {
    return "Usage limit must be greater than zero.";
  }

  if (
    !Number.isInteger(perStudentLimit) ||
    perStudentLimit <= 0
  ) {
    return "Per-student limit must be at least 1.";
  }

  if (
    payload.startsAt &&
    payload.expiresAt
  ) {
    const startsAt = new Date(
      payload.startsAt
    ).getTime();

    const expiresAt = new Date(
      payload.expiresAt
    ).getTime();

    if (
      !Number.isFinite(startsAt) ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= startsAt
    ) {
      return "Expiry date must be later than the start date.";
    }
  }

  return null;
}

export async function GET() {
  const auth = await requireAdmin();

  if ("error" in auth) {
    return auth.error;
  }

  const { admin, role, user } = auth;

  let query = admin
    .from("course_discount_codes")
    .select(
      `
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
        is_active,
        description,
        created_by,
        created_at,
        updated_at
      `
    )
    .order("created_at", {
      ascending: false,
    });

  if (role === "instructor") {
    const { data: courses, error } =
      await admin
        .from("courses")
        .select("id")
        .eq("instructor_id", user.id);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const courseIds = (courses ?? []).map(
      (course) => course.id
    );

    query = courseIds.length
      ? query.in("course_id", courseIds)
      : query.is("course_id", null);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  const courseIds = [
    ...new Set(
      (data ?? [])
        .map((item) => item.course_id)
        .filter(Boolean)
    ),
  ];

  const { data: courses } =
    courseIds.length
      ? await admin
          .from("courses")
          .select(
            "id, title, slug, price_ngn, status"
          )
          .in("id", courseIds)
      : { data: [] };

  return NextResponse.json({
    discounts: data ?? [],
    courses: courses ?? [],
  });
}

export async function POST(
  request: Request
) {
  const auth = await requireAdmin();

  if ("error" in auth) {
    return auth.error;
  }

  const { admin, role, user } = auth;

  let payload: DiscountPayload;

  try {
    payload =
      (await request.json()) as DiscountPayload;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const validation =
    validatePayload(payload);

  if (validation) {
    return NextResponse.json(
      { error: validation },
      { status: 400 }
    );
  }

  const code = payload.code!
    .trim()
    .toUpperCase();

  const discountValue = Math.round(
    Number(payload.discountValue)
  );

  const minimumAmount =
    normalizeNullableNumber(
      payload.minimumAmount
    );

  const maximumDiscount =
    normalizeNullableNumber(
      payload.maximumDiscount
    );

  const usageLimit =
    normalizeNullableNumber(
      payload.usageLimit
    );

  const perStudentLimit = Math.round(
    Number(payload.perStudentLimit ?? 1)
  );

  if (payload.courseId) {
    const { data: course } =
      await admin
        .from("courses")
        .select(
          "id, price_ngn, instructor_id, status"
        )
        .eq("id", payload.courseId)
        .maybeSingle();

    if (!course) {
      return NextResponse.json(
        { error: "Selected course was not found." },
        { status: 400 }
      );
    }

    if (
      course.status !== "published"
    ) {
      return NextResponse.json(
        {
          error:
            "Discounts can only be assigned to published courses.",
        },
        { status: 400 }
      );
    }

    if (
      role === "instructor" &&
      course.instructor_id !== user.id
    ) {
      return NextResponse.json(
        {
          error:
            "You can only create discounts for your assigned courses.",
        },
        { status: 403 }
      );
    }

    if (
      discountValue >
        Number(course.price_ngn ?? 0) &&
      payload.discountType === "fixed"
    ) {
      return NextResponse.json(
        {
          error:
            "Fixed discount cannot exceed the course price.",
        },
        { status: 400 }
      );
    }
  }

  const { data: existing } =
    await admin
      .from("course_discount_codes")
      .select("id")
      .eq("code", code)
      .maybeSingle();

  if (existing) {
    return NextResponse.json(
      {
        error:
          "A discount code with this code already exists.",
      },
      { status: 409 }
    );
  }

  const { data, error } =
    await admin
      .from("course_discount_codes")
      .insert({
        code,
        discount_type: payload.discountType,
        discount_value: discountValue,
        course_id:
          payload.courseId || null,
        minimum_amount: minimumAmount,
        maximum_discount:
          maximumDiscount,
        starts_at:
          payload.startsAt || null,
        expires_at:
          payload.expiresAt || null,
        usage_limit: usageLimit,
        per_student_limit:
          perStudentLimit,
        is_active:
          payload.isActive ?? true,
        description:
          payload.description?.trim() ||
          null,
        created_by: user.id,
      })
      .select()
      .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      discount: data,
    },
    { status: 201 }
  );
}

export async function PATCH(
  request: Request
) {
  const auth = await requireAdmin();

  if ("error" in auth) {
    return auth.error;
  }

  const { admin, role, user } = auth;

  let payload: DiscountPayload;

  try {
    payload =
      (await request.json()) as DiscountPayload;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  if (!payload.id) {
    return NextResponse.json(
      { error: "Discount ID is required." },
      { status: 400 }
    );
  }

  const validation =
    validatePayload(payload);

  if (validation) {
    return NextResponse.json(
      { error: validation },
      { status: 400 }
    );
  }

  const { data: existing } =
    await admin
      .from("course_discount_codes")
      .select(
        "id, code, course_id, usage_count"
      )
      .eq("id", payload.id)
      .maybeSingle();

  if (!existing) {
    return NextResponse.json(
      { error: "Discount code not found." },
      { status: 404 }
    );
  }

  if (
    payload.code
      ?.trim()
      .toUpperCase() !== existing.code
  ) {
    const { data: duplicate } =
      await admin
        .from("course_discount_codes")
        .select("id")
        .eq(
          "code",
          payload.code!
            .trim()
            .toUpperCase()
        )
        .neq("id", payload.id)
        .maybeSingle();

    if (duplicate) {
      return NextResponse.json(
        {
          error:
            "Another discount code already uses this code.",
        },
        { status: 409 }
      );
    }
  }

  if (role === "instructor") {
    if (!existing.course_id) {
      return NextResponse.json(
        {
          error:
            "Instructors cannot modify site-wide discount codes.",
        },
        { status: 403 }
      );
    }

    const { data: course } =
      await admin
        .from("courses")
        .select("instructor_id")
        .eq(
          "id",
          existing.course_id
        )
        .maybeSingle();

    if (
      !course ||
      course.instructor_id !== user.id
    ) {
      return NextResponse.json(
        { error: "Access denied." },
        { status: 403 }
      );
    }
  }

  const { error } =
    await admin
      .from("course_discount_codes")
      .update({
        code: payload.code!
          .trim()
          .toUpperCase(),
        discount_type:
          payload.discountType,
        discount_value: Math.round(
          Number(payload.discountValue)
        ),
        course_id:
          payload.courseId || null,
        minimum_amount:
          normalizeNullableNumber(
            payload.minimumAmount
          ),
        maximum_discount:
          normalizeNullableNumber(
            payload.maximumDiscount
          ),
        starts_at:
          payload.startsAt || null,
        expires_at:
          payload.expiresAt || null,
        usage_limit:
          normalizeNullableNumber(
            payload.usageLimit
          ),
        per_student_limit:
          Math.round(
            Number(
              payload.perStudentLimit ?? 1
            )
          ),
        is_active:
          payload.isActive ?? true,
        description:
          payload.description?.trim() ||
          null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.id);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
  });
}

export async function DELETE(
  request: Request
) {
  const auth = await requireAdmin();

  if ("error" in auth) {
    return auth.error;
  }

  const { admin, role, user } = auth;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Discount ID is required." },
      { status: 400 }
    );
  }

  const { data: discount } =
    await admin
      .from("course_discount_codes")
      .select(
        "id, course_id, usage_count"
      )
      .eq("id", id)
      .maybeSingle();

  if (!discount) {
    return NextResponse.json(
      { error: "Discount code not found." },
      { status: 404 }
    );
  }

  if (discount.usage_count > 0) {
    return NextResponse.json(
      {
        error:
          "A discount code that has already been used cannot be deleted. Deactivate it instead.",
      },
      { status: 409 }
    );
  }

  if (role === "instructor") {
    if (!discount.course_id) {
      return NextResponse.json(
        {
          error:
            "Instructors cannot delete site-wide discount codes.",
        },
        { status: 403 }
      );
    }

    const { data: course } =
      await admin
        .from("courses")
        .select("instructor_id")
        .eq(
          "id",
          discount.course_id
        )
        .maybeSingle();

    if (
      !course ||
      course.instructor_id !== user.id
    ) {
      return NextResponse.json(
        { error: "Access denied." },
        { status: 403 }
      );
    }
  }

  const { error } =
    await admin
      .from("course_discount_codes")
      .delete()
      .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
  });
}