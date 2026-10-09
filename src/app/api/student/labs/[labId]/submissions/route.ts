import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ labId: string }>;
};

const MAX_ANSWER_LENGTH = 20_000;

export async function POST(request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "Sign in to save or submit lab work." }, { status: 401 });
    }

    const { labId } = await context.params;
    if (!labId || labId.length > 100) {
      return NextResponse.json({ ok: false, error: "A valid lab ID is required." }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const answerText = typeof body?.answerText === "string" ? body.answerText.trim() : "";
    const action = body?.action === "draft" ? "draft" : body?.action === "submitted" ? "submitted" : null;

    if (!action) {
      return NextResponse.json({ ok: false, error: "Choose whether to save a draft or submit your work." }, { status: 400 });
    }
    if (!answerText) {
      return NextResponse.json({ ok: false, error: "Your response cannot be empty." }, { status: 400 });
    }
    if (answerText.length > MAX_ANSWER_LENGTH) {
      return NextResponse.json({ ok: false, error: "Your response is too long. Keep it under 20,000 characters." }, { status: 413 });
    }

    const { data: lab, error: labError } = await supabase
      .from("practical_labs")
      .select("id, course_id, is_published")
      .eq("id", labId)
      .eq("is_published", true)
      .maybeSingle();

    if (labError) {
      console.error("Practical Lab submission lab lookup failed:", labError);
      return NextResponse.json({ ok: false, error: "The lab is not ready. Confirm the Practical Lab database migration has been applied." }, { status: 503 });
    }
    if (!lab) {
      return NextResponse.json({ ok: false, error: "This practical task is unavailable." }, { status: 404 });
    }

    const { data: enrollment, error: enrollmentError } = await supabase
      .from("enrollments")
      .select("id, enrollment_status, payment_status")
      .eq("student_id", user.id)
      .eq("course_id", lab.course_id)
      .maybeSingle();

    if (enrollmentError) {
      console.error("Practical Lab enrollment validation failed:", enrollmentError);
      return NextResponse.json({ ok: false, error: "Unable to verify your course enrollment." }, { status: 500 });
    }
    if (
      !enrollment ||
      !["active", "completed"].includes(enrollment.enrollment_status ?? "") ||
      !["free", "paid"].includes(enrollment.payment_status ?? "")
    ) {
      return NextResponse.json({ ok: false, error: "You need an active, eligible enrollment in this course to submit this lab." }, { status: 403 });
    }

    const { data: existing, error: existingError } = await supabase
      .from("lab_submissions")
      .select("id, status")
      .eq("lab_id", lab.id)
      .eq("student_id", user.id)
      .maybeSingle();

    if (existingError) {
      console.error("Practical Lab existing submission lookup failed:", existingError);
      return NextResponse.json({ ok: false, error: "Unable to load your existing lab submission." }, { status: 500 });
    }

    if (existing?.status === "approved" && action === "submitted") {
      return NextResponse.json({ ok: false, error: "This task has already been approved. You can review it, but cannot overwrite the approved submission." }, { status: 409 });
    }

    const nextStatus = action === "draft" ? "draft" : "submitted";
    const submissionPayload = {
      lab_id: lab.id,
      student_id: user.id,
      answer_text: answerText,
      status: nextStatus,
      submitted_at: action === "submitted" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    const result = existing
      ? await supabase.from("lab_submissions").update(submissionPayload).eq("id", existing.id).select("id, status").single()
      : await supabase.from("lab_submissions").insert(submissionPayload).select("id, status").single();

    if (result.error) {
      console.error("Practical Lab submission save failed:", result.error);
      return NextResponse.json({ ok: false, error: "Your work could not be saved. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, submission: result.data });
  } catch (error) {
    console.error("Practical Lab submission route failed:", error);
    return NextResponse.json({ ok: false, error: "Unexpected error while saving your lab work." }, { status: 500 });
  }
}
