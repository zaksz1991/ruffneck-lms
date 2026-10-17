import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ labId: string }>;
};

type StudioAction = "draft" | "submitted" | "autosave";

type RequestBody = {
  html?: unknown;
  css?: unknown;
  reflection?: unknown;
  action?: unknown;
};

type LabRecord = {
  id: string;
  course_id: string;
  slug: string;
  is_published: boolean;
};

type ExistingSubmission = {
  id: string;
  status: string;
};

const MAX_HTML_LENGTH = 9_000;
const MAX_CSS_LENGTH = 7_000;
const MAX_REFLECTION_LENGTH = 1_000;
const MAX_ANSWER_LENGTH = 20_000;
const EDITABLE_STATUSES = new Set(["draft", "revision_required"]);
const STUDIO_SLUGS = new Set([
  "html-css-website-studio-ai",
  "html-css-website-studio-marketing",
]);

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function encodeSubmission(title: string, html: string, css: string, reflection: string) {
  return [
    "RUFFNECK_HTML_CSS_STUDIO_PROJECT_V1",
    `Project: ${title}`,
    "",
    "[STUDENT REFLECTION]",
    reflection.trim(),
    "",
    "[HTML SOURCE]",
    html,
    "",
    "[CSS SOURCE]",
    css,
  ].join("\n");
}

function hasDisallowedHtml(html: string): boolean {
  return /<\s*script\b/i.test(html) ||
    /\son[a-z]+\s*=/i.test(html) ||
    /javascript\s*:/i.test(html);
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonError("Sign in to save or submit your HTML/CSS project.", 401);
    }

    const { labId } = await context.params;
    if (typeof labId !== "string" || !/^[0-9a-f-]{36}$/i.test(labId)) {
      return jsonError("A valid practical lab ID is required.", 400);
    }

    const body = await request.json().catch(() => null) as RequestBody | null;
    if (!body || typeof body !== "object") {
      return jsonError("A valid JSON request body is required.", 400);
    }

    const html = typeof body.html === "string" ? body.html : "";
    const css = typeof body.css === "string" ? body.css : "";
    const reflection = typeof body.reflection === "string" ? body.reflection : "";
    const action: StudioAction | null = body.action === "draft"
      ? "draft"
      : body.action === "submitted"
        ? "submitted"
        : body.action === "autosave"
          ? "autosave"
          : null;

    if (!action) return jsonError("Choose Save draft or Submit project.", 400);
    if (html.length > MAX_HTML_LENGTH) return jsonError(`HTML must not exceed ${MAX_HTML_LENGTH.toLocaleString()} characters.`, 413);
    if (css.length > MAX_CSS_LENGTH) return jsonError(`CSS must not exceed ${MAX_CSS_LENGTH.toLocaleString()} characters.`, 413);
    if (reflection.length > MAX_REFLECTION_LENGTH) return jsonError(`Your reflection must not exceed ${MAX_REFLECTION_LENGTH.toLocaleString()} characters.`, 413);
    if (hasDisallowedHtml(html)) {
      return jsonError("This lab accepts HTML and CSS only. Remove script tags, inline event handlers and javascript: URLs.", 400);
    }

    if (action === "submitted") {
      if (html.trim().length < 120) {
        return jsonError("Add more HTML and include the required page sections before submitting.", 400);
      }
      if (css.trim().length < 100) {
        return jsonError("Add the CSS design, layout and responsive rules before submitting.", 400);
      }
      if (!/<h1\b/i.test(html)) {
        return jsonError("Add one clear H1 heading before submitting.", 400);
      }
      if (!/<(main|header|nav|footer)\b/i.test(html)) {
        return jsonError("Use at least one semantic landmark such as header, nav, main or footer.", 400);
      }
      if (!/@media\b/i.test(css)) {
        return jsonError("Add a CSS @media rule to demonstrate responsive behaviour.", 400);
      }
      if (reflection.trim().length < 60) {
        return jsonError("Write a reflection of at least 60 characters about your design decisions and what you tested.", 400);
      }
    }

    const { data: labData, error: labError } = await supabase
      .from("practical_labs")
      .select("id, course_id, slug, is_published")
      .eq("id", labId)
      .eq("is_published", true)
      .maybeSingle();

    if (labError) {
      console.error("HTML/CSS Studio lab lookup failed:", labError);
      return jsonError("Unable to load the practical lab. Please try again.", 500);
    }

    const lab = labData as LabRecord | null;
    if (!lab || !STUDIO_SLUGS.has(lab.slug)) {
      return jsonError("This HTML/CSS studio lab is unavailable.", 404);
    }

    const { data: enrollment, error: enrollmentError } = await supabase
      .from("enrollments")
      .select("id, enrollment_status, payment_status")
      .eq("student_id", user.id)
      .eq("course_id", lab.course_id)
      .maybeSingle();

    if (enrollmentError) {
      console.error("HTML/CSS Studio enrollment check failed:", enrollmentError);
      return jsonError("Unable to verify your course enrollment.", 500);
    }

    const eligible = !!enrollment &&
      ["active", "completed"].includes(enrollment.enrollment_status ?? "") &&
      ["free", "paid"].includes(enrollment.payment_status ?? "");
    if (!eligible) {
      return jsonError("You need an active, eligible enrollment in this course to use this studio.", 403);
    }

    const { data: existingData, error: existingError } = await supabase
      .from("lab_submissions")
      .select("id, status")
      .eq("lab_id", lab.id)
      .eq("student_id", user.id)
      .maybeSingle();

    if (existingError) {
      console.error("HTML/CSS Studio existing submission lookup failed:", existingError);
      return jsonError("Unable to load your saved project.", 500);
    }

    const existing = existingData as ExistingSubmission | null;
    if (existing?.status === "approved") {
      return jsonError("This project has already been approved and cannot be changed.", 409);
    }
    if (existing && !EDITABLE_STATUSES.has(existing.status)) {
      return jsonError("Your project is awaiting review and cannot be changed until the instructor responds.", 409);
    }

    const answerText = encodeSubmission("Advanced HTML & CSS Website Studio", html, css, reflection);
    if (answerText.length > MAX_ANSWER_LENGTH) {
      return jsonError("The combined project is too large to save. Reduce the HTML, CSS or reflection.", 413);
    }

    const now = new Date().toISOString();
    // Autosave preserves revision_required and existing timestamps. A first
    // autosave creates a draft; manual Save draft/Submit retain their behavior.
    const nextStatus = action === "submitted"
      ? "submitted"
      : action === "draft"
        ? "draft"
        : existing?.status ?? "draft";

    const updateValues = action === "autosave"
      ? { answer_text: answerText, updated_at: now }
      : {
          answer_text: answerText,
          status: nextStatus,
          submitted_at: action === "submitted" ? now : null,
          updated_at: now,
        };

    const saved = existing
      ? await supabase
          .from("lab_submissions")
          .update(updateValues)
          .eq("id", existing.id)
          .eq("student_id", user.id)
          .select("id, status, score, feedback, updated_at")
          .single()
      : await supabase
          .from("lab_submissions")
          .insert({
            lab_id: lab.id,
            student_id: user.id,
            answer_text: answerText,
            status: nextStatus,
            submitted_at: action === "submitted" ? now : null,
            updated_at: now,
          })
          .select("id, status, score, feedback, updated_at")
          .single();

    if (saved.error) {
      console.error("HTML/CSS Studio project save failed:", saved.error);
      return jsonError("The project could not be saved. Check the lab submission permissions and try again.", 500);
    }

    return NextResponse.json({
      ok: true,
      message: action === "autosave"
        ? "Your HTML/CSS project has been autosaved."
        : action === "draft"
          ? "Your HTML/CSS project draft has been saved."
          : existing?.status === "revision_required"
            ? "Your revised HTML/CSS project has been resubmitted for review."
            : "Your HTML/CSS project has been submitted for instructor review.",
      submission: saved.data,
    });
  } catch (error: unknown) {
    console.error("HTML/CSS Studio submission route failed:", error);
    return jsonError("An unexpected error occurred while saving your project.", 500);
  }
}
