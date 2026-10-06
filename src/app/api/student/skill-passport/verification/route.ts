import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";

function generateVerificationCode() {
  return randomBytes(12)
    .toString("hex")
    .toUpperCase();
}

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        error: "Authentication required.",
      },
      { status: 401 },
    );
  }

  const { data, error } = await supabase
    .from("skill_passport_verifications")
    .select(
      "id,verification_code,is_active,expires_at,created_at,updated_at",
    )
    .eq("student_id", user.id)
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      {
        error: error.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    verification: data ?? null,
  });
}

export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        error: "Authentication required.",
      },
      { status: 401 },
    );
  }

  const { data: existing, error: existingError } =
    await supabase
      .from("skill_passport_verifications")
      .select(
        "id,verification_code,is_active,expires_at,created_at,updated_at",
      )
      .eq("student_id", user.id)
      .eq("is_active", true)
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

  if (existingError) {
    return NextResponse.json(
      {
        error: existingError.message,
      },
      { status: 500 },
    );
  }

  if (existing) {
    return NextResponse.json({
      verification: existing,
    });
  }

  let verification = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const verificationCode =
      generateVerificationCode();

    const { data, error } = await supabase
      .from("skill_passport_verifications")
      .insert({
        student_id: user.id,
        verification_code:
          verificationCode,
        is_active: true,
      })
      .select(
        "id,verification_code,is_active,expires_at,created_at,updated_at",
      )
      .single();

    if (!error && data) {
      verification = data;
      break;
    }

    if (
      !error ||
      !error.message
        .toLowerCase()
        .includes("duplicate")
    ) {
      return NextResponse.json(
        {
          error:
            error?.message ??
            "Unable to create verification record.",
        },
        { status: 500 },
      );
    }
  }

  if (!verification) {
    return NextResponse.json(
      {
        error:
          "Unable to generate a unique verification code.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      verification,
    },
    { status: 201 },
  );
}

export async function PATCH(
  request: Request,
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        error: "Authentication required.",
      },
      { status: 401 },
    );
  }

  let body: {
    is_active?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "Invalid request body.",
      },
      { status: 400 },
    );
  }

  if (
    typeof body.is_active !==
    "boolean"
  ) {
    return NextResponse.json(
      {
        error:
          "is_active must be a boolean.",
      },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("skill_passport_verifications")
    .update({
      is_active: body.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("student_id", user.id)
    .eq("is_active", !body.is_active)
    .select(
      "id,verification_code,is_active,expires_at,created_at,updated_at",
    )
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      {
        error: error.message,
      },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json(
      {
        error:
          "No matching verification record found.",
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    verification: data,
  });
}