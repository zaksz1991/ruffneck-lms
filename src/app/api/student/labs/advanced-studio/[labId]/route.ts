import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ labId: string }> };
type ProjectTrack = "web_development" | "digital_publishing";
type Action = "draft" | "autosave" | "submitted";
type FileBody = { path?: unknown; content?: unknown };
type RequestBody = { track?: unknown; title?: unknown; files?: unknown; metadata?: unknown; reflection?: unknown; action?: unknown };
type ExistingSubmission = { id: string; status: string; submitted_at: string | null; score: number | null; feedback: string | null };
const WEBSITE_SLUGS = new Set(["multi-file-website-studio-ai", "multi-file-website-studio-marketing"]);
const PUBLISHING_SLUGS = new Set(["digital-publishing-studio-ai", "digital-publishing-studio-marketing"]);
const MAX_BODY_CHARS = 800_000;
const MAX_FILE_COUNT = 14;
const MAX_TEXT_FILE_CHARS = 30_000;
const MAX_TEXT_TOTAL = 250_000;
const MAX_IMAGE_BYTES = 150 * 1024;
const MAX_IMAGE_TOTAL_BYTES = 300 * 1024;
const MAX_REFLECTION = 1_000;
const EDITABLE_STATUSES = new Set(["draft", "revision_required"]);
const PROJECT_MARKER = "RUFFNECK_ADVANCED_PROJECT_STUDIO_V1";

function error(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
function safePath(path: string): boolean {
  return path.length > 0 && path.length <= 140 &&
    /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\)[A-Za-z0-9._/-]+$/.test(path) &&
    !path.includes("//") && !path.split("/").some((part) => part === "." || part === "..");
}
function decodeDataUrlSize(value: string): { type: string; bytes: number } | null {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value);
  if (!match) return null;
  const encoded = match[2];
  return { type: match[1].toLowerCase(), bytes: Math.floor(encoded.length * 3 / 4) - (encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0) };
}
function validateFiles(value: unknown, track: ProjectTrack): { files: { path: string; content: string }[]; totalText: number; totalImages: number } | { failure: string } {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_FILE_COUNT) {
    return { failure: `A project must contain 1–${MAX_FILE_COUNT} files.` };
  }
  const files: { path: string; content: string }[] = [];
  const paths = new Set<string>();
  let totalText = 0;
  let totalImages = 0;
  const websiteExts = new Set(["html", "css", "md", "txt", "json", "csv", "png", "jpg", "jpeg", "webp"]);
  const publishingExts = new Set(["md", "css", "json", "txt", "csv", "png", "jpg", "jpeg", "webp"]);
  for (const item of value as FileBody[]) {
    if (!isPlainObject(item) || typeof item.path !== "string" || typeof item.content !== "string") return { failure: "Each project file requires a path and text or image content." };
    const path = item.path;
    const content = item.content;
    if (!safePath(path)) return { failure: `The file path “${path.slice(0, 80)}” is not a safe relative path.` };
    const lowerPath = path.toLowerCase();
    if (paths.has(lowerPath)) return { failure: "Project file paths must be unique." };
    paths.add(lowerPath);
    const extension = lowerPath.split(".").pop() ?? "";
    if (!(track === "web_development" ? websiteExts : publishingExts).has(extension)) {
      return { failure: track === "web_development" ? "Website projects accept HTML, CSS, Markdown, text, JSON, CSV and supported image files." : "Publishing projects accept Markdown, CSS, metadata, text, CSV and supported image files." };
    }
    if (content.startsWith("data:")) {
      const asset = decodeDataUrlSize(content);
      if (!asset || !["png", "jpg", "jpeg", "webp"].includes(extension) || (extension === "jpg" && asset.type !== "image/jpeg") || (extension === "jpeg" && asset.type !== "image/jpeg") || (extension === "png" && asset.type !== "image/png") || (extension === "webp" && asset.type !== "image/webp")) {
        return { failure: "Image assets must be valid PNG, JPEG or WebP data URLs with a matching filename extension." };
      }
      if (asset.bytes > MAX_IMAGE_BYTES) return { failure: "Each image asset must be 150 KB or smaller." };
      totalImages += asset.bytes;
      if (totalImages > MAX_IMAGE_TOTAL_BYTES) return { failure: "Combined image assets must not exceed 300 KB." };
    } else {
      if (content.length > MAX_TEXT_FILE_CHARS) return { failure: `Each text file must be ${MAX_TEXT_FILE_CHARS.toLocaleString()} characters or fewer.` };
      totalText += content.length;
      if (totalText > MAX_TEXT_TOTAL) return { failure: `Combined text files must not exceed ${MAX_TEXT_TOTAL.toLocaleString()} characters.` };
      if (/\.(png|jpe?g|webp)$/i.test(path)) return { failure: "Image filenames must contain uploaded image data, not plain text." };
    }
    files.push({ path, content });
  }
  const required = track === "web_development" ? ["index.html"] : ["publication.md"];
  for (const path of required) if (!paths.has(path)) return { failure: `The project must include ${path}.` };
  if (track === "web_development" && !files.some((file) => file.path.toLowerCase().endsWith(".css"))) return { failure: "The website project must contain at least one CSS file." };
  return { files, totalText, totalImages };
}
function hasUnsafeHtml(html: string): boolean {
  return /<\s*script\b/i.test(html) || /\son[a-z]+\s*=/i.test(html) || /javascript\s*:/i.test(html) || /<\s*(iframe|object|embed|applet)\b/i.test(html);
}
function textBody(files: { path: string; content: string }[], path: string): string {
  return files.find((file) => file.path === path)?.content ?? "";
}
function safeTitle(value: unknown, fallback: string): string {
  return (typeof value === "string" ? value : "").trim().replace(/[<>\r\n]/g, "").slice(0, 160) || fallback;
}
export async function POST(request: Request, context: RouteContext) {
  try {
    const bodyText = await request.text();
    if (bodyText.length > MAX_BODY_CHARS) return error("The project is too large to upload. Reduce the number or size of its files.", 413);
    const body = JSON.parse(bodyText) as RequestBody;
    if (!isPlainObject(body)) return error("A valid project request is required.");
    const track = body.track;
    if (track !== "web_development" && track !== "digital_publishing") return error("Choose a supported project track.");
    const action: Action | null = body.action === "draft" || body.action === "autosave" || body.action === "submitted" ? body.action : null;
    if (!action) return error("Choose save draft, autosave or submit for review.");
    const reflection = typeof body.reflection === "string" ? body.reflection : "";
    if (reflection.length > MAX_REFLECTION) return error("The project reflection must be 1,000 characters or fewer.", 413);
    const normalized = validateFiles(body.files, track);
    if ("failure" in normalized) return error(normalized.failure, 400);
    const files = normalized.files;
    const metadata = isPlainObject(body.metadata) ? body.metadata : {};
    const title = safeTitle(body.title, track === "web_development" ? "Multi-file website project" : "Digital publication");

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return error("Sign in to save or submit this project.", 401);

    const { labId } = await context.params;
    if (typeof labId !== "string" || !/^[0-9a-f-]{36}$/i.test(labId)) return error("A valid practical lab ID is required.");
    const { data: labData, error: labError } = await supabase
      .from("practical_labs")
      .select("id, course_id, slug, is_published")
      .eq("id", labId)
      .eq("is_published", true)
      .maybeSingle();
    if (labError) return error("Unable to load the practical studio. Please try again.", 500);
    const lab = labData as { id: string; course_id: string; slug: string; is_published: boolean } | null;
    const trackAllowed = !!lab && (track === "web_development" ? WEBSITE_SLUGS.has(lab.slug) : PUBLISHING_SLUGS.has(lab.slug));
    if (!trackAllowed || !lab) return error("This project track is not available for the selected lab.", 404);

    const { data: enrollment, error: enrollmentError } = await supabase
      .from("enrollments")
      .select("id, enrollment_status, payment_status")
      .eq("student_id", user.id)
      .eq("course_id", lab.course_id)
      .maybeSingle();
    if (enrollmentError) return error("Unable to verify course enrolment.", 500);
    const eligible = !!enrollment && ["active", "completed"].includes(enrollment.enrollment_status ?? "") && ["free", "paid"].includes(enrollment.payment_status ?? "");
    if (!eligible) return error("An eligible enrolment in this course is required.", 403);

    if (track === "web_development") {
      for (const file of files.filter((row) => row.path.toLowerCase().endsWith(".html"))) {
        if (hasUnsafeHtml(file.content)) return error(`Remove script tags, inline event handlers, frames, and javascript: URLs from ${file.path}. This track is HTML/CSS only.`);
      }
    } else {
      const pubTitle = safeTitle(metadata.title, "");
      const slug = typeof metadata.slug === "string" ? metadata.slug.trim() : "";
      const description = typeof metadata.metaDescription === "string" ? metadata.metaDescription.trim() : "";
      const pubBody = textBody(files, "publication.md").trim();
      if (!pubTitle || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return error("A publication title and a valid hyphenated URL slug are required.");
      if (action === "submitted") {
        if (pubBody.length < 500) return error("The publication body must be at least 500 characters before submission.");
        if (description.length < 50 || description.length > 160) return error("The SEO description must be between 50 and 160 characters.");
        if (reflection.trim().length < 60) return error("Write a reflection of at least 60 characters before submitting.");
      }
    }

    const { data: existingData, error: existingError } = await supabase
      .from("lab_submissions")
      .select("id, status, submitted_at, score, feedback")
      .eq("lab_id", lab.id)
      .eq("student_id", user.id)
      .maybeSingle();
    if (existingError) return error("Unable to load the current submission.", 500);
    const existing = existingData as ExistingSubmission | null;
    if (existing?.status === "approved") return error("This project has been approved and cannot be changed.", 409);
    if (existing && !EDITABLE_STATUSES.has(existing.status)) return error("This project is awaiting instructor review and is locked until the instructor responds.", 409);
    if (action === "submitted") {
      if (track === "web_development") {
        const indexHtml = textBody(files, "index.html");
        const stylesPath = files.find((file) => /(^|\/)styles\.css$/i.test(file.path))?.path ?? files.find((file) => file.path.endsWith(".css"))?.path;
        if (indexHtml.trim().length < 120 || !/<h1\b/i.test(indexHtml) || !/<(main|header|nav|footer)\b/i.test(indexHtml)) return error("Add meaningful HTML, one H1, and a semantic landmark before submitting.");
        const css = stylesPath ? textBody(files, stylesPath) : "";
        if (css.trim().length < 100 || !/@media\b/i.test(css)) return error("Add a responsive CSS stylesheet with an @media rule before submitting.");
        if (reflection.trim().length < 60) return error("Write a reflection of at least 60 characters before submitting.");
        if (!metadata || !isPlainObject(metadata)) return error("Project metadata is invalid.");
      }
    }

    const projectJson = { version: 1, track, files, metadata };
    const projectJsonString = JSON.stringify(projectJson);
    if (projectJsonString.length > MAX_BODY_CHARS) return error("The project data exceeds the storage limit.", 413);
    const now = new Date().toISOString();
    const { data: workspaceData, error: workspaceError } = await supabase
      .from("lab_project_workspaces")
      .upsert({
        lab_id: lab.id,
        student_id: user.id,
        project_type: track,
        project_title: title,
        project_json: projectJson,
        reflection,
        updated_at: now,
      }, { onConflict: "lab_id,student_id" })
      .select("id, updated_at")
      .single();
    if (workspaceError) {
      console.error("Advanced project workspace save failed:", workspaceError);
      return error("The project workspace could not be saved. Check the workspace migration and access policies.", 500);
    }
    const workspace = workspaceData as { id: string; updated_at: string };
    const encodedSubmission = [
      PROJECT_MARKER,
      `Workspace: ${workspace.id}`,
      `Project: ${title}`,
      `Type: ${track}`,
      "[STUDENT REFLECTION]",
      reflection.trim() || "Not provided yet",
    ].join("\n");
    const nextStatus = action === "submitted" ? "submitted" : action === "draft" ? (existing?.status === "revision_required" ? "revision_required" : "draft") : existing?.status ?? "draft";
    const submittedAt = action === "submitted" ? now : action === "draft" && existing?.status !== "revision_required" ? null : existing?.submitted_at ?? null;
    const write = existing
      ? await supabase.from("lab_submissions").update({ answer_text: encodedSubmission, status: nextStatus, submitted_at: submittedAt, updated_at: now }).eq("id", existing.id).eq("student_id", user.id).select("id, status, score, feedback, updated_at").single()
      : await supabase.from("lab_submissions").insert({ lab_id: lab.id, student_id: user.id, answer_text: encodedSubmission, status: nextStatus, submitted_at: action === "submitted" ? now : null, updated_at: now }).select("id, status, score, feedback, updated_at").single();
    if (write.error) {
      console.error("Advanced project submission save failed:", write.error);
      return error("The project files were saved, but the submission record could not be updated. Please use Save draft again or contact the teaching team.", 500);
    }
    return NextResponse.json({
      ok: true,
      message: action === "autosave" ? "Project autosaved." : action === "draft" ? "Project draft saved." : existing?.status === "revision_required" ? "Revised project resubmitted for review." : "Project submitted for instructor review.",
      workspace: { id: workspace.id },
      submission: write.data,
    });
  } catch (errorValue: unknown) {
    if (errorValue instanceof SyntaxError) return error("The project request is not valid JSON.");
    console.error("Advanced Project Studio save route failed:", errorValue);
    return error("An unexpected error occurred while saving the project.", 500);
  }
}
