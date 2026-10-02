import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const email =
      typeof body?.email === "string" ? body.email.trim() : "";

    const password =
      typeof body?.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json(
        {
          error: "Email and password are required.",
        },
        { status: 400 }
      );
    }

    const response = NextResponse.json(
      {
        ok: true,
        next: "/student/dashboard",
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, private",
        },
      }
    );

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },

          setAll(
            cookiesToSet: {
              name: string;
              value: string;
              options: CookieOptions;
            }[]
          ) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      return NextResponse.json(
        {
          error:
            error?.message ||
            "Login failed. Please check your email and password.",
        },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store, private",
          },
        }
      );
    }

    return response;
  } catch (error) {
    console.error("Login route error:", error);

    return NextResponse.json(
      {
        error: "Unable to connect to the authentication service.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, private",
        },
      }
    );
  }
}
