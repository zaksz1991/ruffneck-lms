import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";

type CertificateRow = {
  id: string;
  certificate_number: string | null;
  course_id: string;
};

type VerificationRow = {
  id: string;
  certificate_id: string;
  verification_code: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

function generateVerificationCode() {
  return randomBytes(12)
    .toString("hex")
    .toUpperCase();
}

async function getAuthenticatedClient() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    supabase,
    user,
  };
}

export async function GET(
  request: Request,
) {
  const {
    supabase,
    user,
  } = await getAuthenticatedClient();

  if (!user) {
    return NextResponse.json(
      {
        error: "Authentication required.",
      },
      { status: 401 },
    );
  }

  const { searchParams } =
    new URL(request.url);

  const certificateId =
    searchParams.get(
      "certificate_id",
    );

  if (!certificateId) {
    return NextResponse.json(
      {
        error:
          "certificate_id is required.",
      },
      { status: 400 },
    );
  }

  const { data: certificate, error: certificateError } =
    await supabase
      .from("course_certificates")
      .select(
        "id,certificate_number,course_id",
      )
      .eq("id", certificateId)
      .eq("student_id", user.id)
      .maybeSingle();

  if (certificateError) {
    return NextResponse.json(
      {
        error: certificateError.message,
      },
      { status: 500 },
    );
  }

  if (!certificate) {
    return NextResponse.json(
      {
        error:
          "Certificate not found.",
      },
      { status: 404 },
    );
  }

  const { data, error } =
    await supabase
      .from("certificate_verifications")
      .select(
        "id,certificate_id,verification_code,is_active,expires_at,created_at,updated_at",
      )
      .eq(
        "certificate_id",
        certificate.id,
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

  return NextResponse.json({
    certificate:
      certificate as CertificateRow,
    verification:
      (data as VerificationRow | null) ??
      null,
  });
}

export async function POST(
  request: Request,
) {
  const {
    supabase,
    user,
  } = await getAuthenticatedClient();

  if (!user) {
    return NextResponse.json(
      {
        error: "Authentication required.",
      },
      { status: 401 },
    );
  }

  let body: {
    certificate_id?: string;
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

  const certificateId =
    typeof body.certificate_id ===
    "string"
      ? body.certificate_id.trim()
      : "";

  if (!certificateId) {
    return NextResponse.json(
      {
        error:
          "certificate_id is required.",
      },
      { status: 400 },
    );
  }

  const {
    data: certificate,
    error: certificateError,
  } = await supabase
    .from("course_certificates")
    .select(
      "id,certificate_number,course_id",
    )
    .eq("id", certificateId)
    .eq("student_id", user.id)
    .maybeSingle();

  if (certificateError) {
    return NextResponse.json(
      {
        error: certificateError.message,
      },
      { status: 500 },
    );
  }

  if (!certificate) {
    return NextResponse.json(
      {
        error:
          "Certificate not found.",
      },
      { status: 404 },
    );
  }

  const {
    data: existing,
    error: existingError,
  } = await supabase
    .from("certificate_verifications")
    .select(
      "id,certificate_id,verification_code,is_active,expires_at,created_at,updated_at",
    )
    .eq(
      "certificate_id",
      certificate.id,
    )
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
      certificate,
      verification: existing,
    });
  }

  let verification:
    | VerificationRow
    | null = null;

  for (
    let attempt = 0;
    attempt < 5;
    attempt += 1
  ) {
    const verificationCode =
      generateVerificationCode();

    const {
      data,
      error,
    } = await supabase
      .from("certificate_verifications")
      .insert({
        certificate_id:
          certificate.id,
        verification_code:
          verificationCode,
        is_active: true,
      })
      .select(
        "id,certificate_id,verification_code,is_active,expires_at,created_at,updated_at",
      )
      .single();

    if (!error && data) {
      verification =
        data as VerificationRow;

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
            "Unable to create certificate verification.",
        },
        { status: 500 },
      );
    }
  }

  if (!verification) {
    return NextResponse.json(
      {
        error:
          "Unable to generate a unique certificate verification code.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      certificate,
      verification,
    },
    { status: 201 },
  );
}

export async function PATCH(
  request: Request,
) {
  const {
    supabase,
    user,
  } = await getAuthenticatedClient();

  if (!user) {
    return NextResponse.json(
      {
        error: "Authentication required.",
      },
      { status: 401 },
    );
  }

  let body: {
    certificate_id?: string;
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

  const certificateId =
    typeof body.certificate_id ===
    "string"
      ? body.certificate_id.trim()
      : "";

  if (!certificateId) {
    return NextResponse.json(
      {
        error:
          "certificate_id is required.",
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

  const {
    data: certificate,
    error: certificateError,
  } = await supabase
    .from("course_certificates")
    .select("id")
    .eq("id", certificateId)
    .eq("student_id", user.id)
    .maybeSingle();

  if (certificateError) {
    return NextResponse.json(
      {
        error: certificateError.message,
      },
      { status: 500 },
    );
  }

  if (!certificate) {
    return NextResponse.json(
      {
        error:
          "Certificate not found.",
      },
      { status: 404 },
    );
  }

  const {
    data,
    error,
  } = await supabase
    .from("certificate_verifications")
    .update({
      is_active:
        body.is_active,
      updated_at:
        new Date().toISOString(),
    })
    .eq(
      "certificate_id",
      certificate.id,
    )
    .select(
      "id,certificate_id,verification_code,is_active,expires_at,created_at,updated_at",
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
          "No certificate verification record exists yet.",
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    verification:
      data as VerificationRow,
  });
}