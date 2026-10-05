import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ConvertBody = {
  id?: unknown;
};

type Profile = {
  role: "admin" | "instructor" | "student";
};

type ConversionResult = {
  success?: boolean;
  already_converted?: boolean;
  draft_id?: string;
  course_id?: string;
  course_title?: string;
  section_count?: number;
  duration_minutes?: number;
  converted_at?: string;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isConversionResult(value: unknown): value is ConversionResult {
  return typeof value === "object" && value !== null;
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
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single<Profile>();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "User profile could not be verified." },
        { status: 403 }
      );
    }

    if (profile.role !== "admin" && profile.role !== "instructor") {
      return NextResponse.json(
        { error: "Only admins and instructors can convert AI drafts." },
        { status: 403 }
      );
    }

    let body: ConvertBody;

    try {
      body = (await request.json()) as ConvertBody;
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const draftId = asString(body.id);

    if (!draftId) {
      return NextResponse.json(
        { error: "AI draft ID is required." },
        { status: 400 }
      );
    }

    const { data: draft, error: draftError } = await supabase
      .from("ai_learning_drafts")
      .select("id, title, status, converted_course_id, converted_at")
      .eq("id", draftId)
      .single();

    if (draftError || !draft) {
      return NextResponse.json(
        { error: "AI draft not found." },
        { status: 404 }
      );
    }

    if (draft.status === "converted" && draft.converted_course_id) {
      return NextResponse.json({
        success: true,
        already_converted: true,
        course_id: draft.converted_course_id,
        draft: {
          id: draft.id,
          title: draft.title,
          status: draft.status,
          converted_course_id: draft.converted_course_id,
          converted_at: draft.converted_at,
        },
        message:
          "This AI draft has already been converted to an LMS course.",
      });
    }

    if (draft.status !== "approved") {
      return NextResponse.json(
        {
          error:
            "Only approved AI drafts can be converted to an LMS course.",
        },
        { status: 409 }
      );
    }

    const { data: result, error: conversionError } = await supabase.rpc(
      "convert_ai_draft_to_course",
      {
        p_draft_id: draftId,
        p_reviewer_id: user.id,
      }
    );

    if (conversionError) {
      console.error("AI draft conversion failed:", conversionError);

      return NextResponse.json(
        {
          error:
            conversionError.message ||
            "The AI draft could not be converted to an LMS course.",
        },
        { status: 500 }
      );
    }

    if (!isConversionResult(result)) {
      console.error(
        "AI draft conversion returned an unexpected result:",
        result
      );

      return NextResponse.json(
        {
          error:
            "The AI draft conversion completed with an invalid server response.",
        },
        { status: 500 }
      );
    }

    const courseId = asString(result.course_id);

    if (!courseId) {
      console.error(
        "AI draft conversion returned no course_id:",
        result
      );

      return NextResponse.json(
        {
          error:
            "The AI draft conversion did not return the created course ID.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      already_converted: result.already_converted === true,
      course_id: courseId,
      result,
      message: "AI draft converted to an unpublished LMS course.",
    });
  } catch (error) {
    console.error("AI draft conversion route error:", error);

    return NextResponse.json(
      {
        error:
          "An unexpected error occurred while converting the AI draft.",
      },
      { status: 500 }
    );
  }
}