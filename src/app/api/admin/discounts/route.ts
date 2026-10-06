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

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (
    error ||
    !profile ||
    !["admin", "instructor"].includes(profile.role)
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

function validatePayload(payload: DiscountPayload) {
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

  const perStudentLimit = Number(
    payload.perStudentLimit ?? 1
  );

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

async function validateSelectedCourse({
  admin,
  role,
  userId,
  courseId,
  discountType,
  discountValue,
}: {
  admin: ReturnType<typeof createAdminClient>;
  role: string;
  userId: string;
  courseId?: string | null;
  discountType: DiscountType;
  discountValue: number;
}) {
  if (!courseId) {
    if (role === "instructor") {
      return {
        error:
          "Instructors must assign discounts to one of their courses.",
      };
      }

    return {
      course: null,
      error: null,
    };
  }

  const { data: course, error } = await admin
    .from("courses")
    .select(
      "id, title, price_ngn, instructor_id, status"
    )
    .eq("id", courseId)
    .maybeSingle();

  if (error) {
    return {
      error: error.message,
    };
  }

  if (!course) {
    return {
      error: "Selected course was not found.",
    };
  }

  if (course.status !== "published") {
    return {
      error:
        "Discounts can only be assigned to published courses.",
    };
  }

  if (
    role === "instructor" &&
    course.instructor_id !== userId
  ) {
    return {
      error:
        "You can only create discounts for your assigned courses.",
    };
  }

  if (
    discountType === "fixed" &&
    discountValue > Number(course.price_ngn ?? 0)
  ) {
    return {
      error:
        "Fixed discount cannot exceed the course price.",
    };
  }

  return {
    course,
    error: null,
  };
}

export async function GET() {
  const auth = await requireAdmin();

  if ("error" in auth) {
    return auth.error;
  }

  const { admin, role, user } = auth;

  let discountQuery = admin
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

  let courseQuery = admin
    .from("courses")
    .select(
      "id, title, slug, price_ngn, status"
    )
    .eq("status", "published")
    .gt("price_ngn", 0)
    .order("title", {
      ascending: true,
    });

  if (role === "instructor") {
    courseQuery = courseQuery.eq(
      "instructor_id",
      user.id
    );

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

    discountQuery = courseIds.length
      ? discountQuery.in(
          "course_id",
          courseIds
        )
      : discountQuery.eq(
          "course_id",
          "00000000-0000-0000-0000-000000000000"
        );
  }

  const [
    discountsResult,
    coursesResult,
  ] = await Promise.all([
    discountQuery,
    courseQuery,
  ]);

  if (discountsResult.error) {
    return NextResponse.json(
      { error: discountsResult.error.message },
      { status: 500 }
    );
  }

  if (coursesResult.error) {
    return NextResponse.json(
      { error: coursesResult.error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    discounts: discountsResult.data ?? [],
    courses: coursesResult.data ?? [],
  });
}

export async function POST(request: Request) {
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

  const courseValidation =
    await validateSelectedCourse({
      admin,
      role,
      userId: user.id,
      courseId: payload.courseId,
      discountType: payload.discountType!,
      discountValue,
    });

  if (courseValidation.error) {
    return NextResponse.json(
      { error: courseValidation.error },
      { status:
          courseValidation.error.includes(
            "assigned courses"
          )
            ? 403
            : 400,
      }
    );
  }

  const { data: existing } = await admin
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

  const { data, error } = await admin
    .from("course_discount_codes")
    .insert({
      code,
      discount_type:
        payload.discountType,
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

export async function PATCH(request: Request) {
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

  const { data: existing } = await admin
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

    const { data: existingCourse } =
      await admin
        .from("courses")
        .select("instructor_id")
        .eq(
          "id",
          existing.course_id
        )
        .maybeSingle();

    if (
      !existingCourse ||
      existingCourse.instructor_id !== user.id
    ) {
      return NextResponse.json(
        { error: "Access denied." },
        { status: 403 }
      );
    }
  }

  const discountValue = Math.round(
    Number(payload.discountValue)
  );

  const courseValidation =
    await validateSelectedCourse({
      admin,
      role,
      userId: user.id,
      courseId: payload.courseId,
      discountType: payload.discountType!,
      discountValue,
    });

  if (courseValidation.error) {
    return NextResponse.json(
      { error: courseValidation.error },
      {
        status:
          courseValidation.error.includes(
            "assigned courses"
          )
            ? 403
            : 400,
      }
    );
  }

  if (
    role === "instructor" &&
    existing.course_id !== payload.courseId
  ) {
    return NextResponse.json(
      {
        error:
          "Instructors cannot move a discount to another course.",
      },
      { status: 403 }
    );
  }

  const { error } = await admin
    .from("course_discount_codes")
    .update({
      code: payload.code!
        .trim()
        .toUpperCase(),
      discount_type:
        payload.discountType,
      discount_value: discountValue,
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
      updated_at:
        new Date().toISOString(),
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

export async function DELETE(request: Request) {
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

  const { data: discount } = await admin
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

    const { data: course } = await admin
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

  const { error } = await admin
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