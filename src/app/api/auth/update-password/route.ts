import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const password =
      typeof body?.password === "string" ? body.password : "";

    if (!password) {
      return NextResponse.json(
        { error: "New password is required." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          error: "Your new password must be at least 8 characters.",
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error:
            "Your password reset session has expired. Please request a new reset link.",
        },
        { status: 401 }
      );
    }

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      console.error("Password update:", error);

      return NextResponse.json(
        {
          error: error.message || "Unable to update your password.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message: "Your password has been updated successfully.",
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, private",
        },
      }
    );
  } catch (error) {
    console.error("Update password route error:", error);

    return NextResponse.json(
      {
        error: "Unable to update your password.",
      },
      {
        status: 500,
      }
    );
  }
}