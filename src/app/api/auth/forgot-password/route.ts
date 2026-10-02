import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const email =
      typeof body?.email === "string" ? body.email.trim() : "";

    if (!email) {
      return NextResponse.json(
        { error: "Email address is required." },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const origin = request.nextUrl.origin;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/reset-password`,
    });

    /*
     * Deliberately return the same response whether or not the
     * email exists. This prevents account enumeration.
     */
    if (error) {
      console.error("Password reset request:", error);
    }

    return NextResponse.json(
      {
        ok: true,
        message:
          "If an account exists for this email, a password reset link has been sent.",
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, private",
        },
      }
    );
  } catch (error) {
    console.error("Forgot password route error:", error);

    return NextResponse.json(
      {
        error: "Unable to process the password reset request.",
      },
      {
        status: 500,
      }
    );
  }
}