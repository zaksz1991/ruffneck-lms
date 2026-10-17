import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ labId: string }> };
type PublicationRow = { publication_slug?: string; is_published?: boolean; published_at?: string | null };

function responseError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}
function normaliseRow(data: unknown): PublicationRow | null {
  if (Array.isArray(data)) return data.length && data[0] && typeof data[0] === "object" ? data[0] as PublicationRow : null;
  return data && typeof data === "object" ? data as PublicationRow : null;
}
function callPublicationRpc(
  supabase: Awaited<ReturnType<typeof createClient>>,
  name: string,
  args: Record<string, unknown>,
): Promise<{ data: unknown; error: { message: string } | null }> {
  const rpc = supabase.rpc as unknown as (
    functionName: string,
    parameters: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
  return rpc(name, args);
}
async function resolveLabId(context: RouteContext): Promise<string | null> {
  const { labId } = await context.params;
  return /^[0-9a-f-]{36}$/i.test(labId) ? labId : null;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const labId = await resolveLabId(context);
    if (!labId) return responseError("A valid practical lab ID is required.");
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return responseError("Sign in to manage your publication.", 401);

    const { data, error } = await callPublicationRpc(supabase, "get_student_lab_publication", { p_lab_id: labId });
    if (error) {
      console.error("Public project status lookup failed:", error);
      return responseError("Public publishing is not configured yet. Apply the public publishing database migration first.", 503);
    }

    const row = normaliseRow(data);
    return NextResponse.json({
      ok: true,
      publication: row ? {
        slug: typeof row.publication_slug === "string" ? row.publication_slug : null,
        isPublished: row.is_published === true,
        publishedAt: row.published_at ?? null,
      } : null,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Public project status route failed:", error);
    return responseError("Unable to check publication status.", 500);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const labId = await resolveLabId(context);
    if (!labId) return responseError("A valid practical lab ID is required.");
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return responseError("Sign in to publish or unpublish this project.", 401);

    let body: unknown;
    try { body = await request.json(); } catch { return responseError("Request body must be valid JSON."); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return responseError("A valid publication action is required.");
    const payload = body as Record<string, unknown>;

    if (payload.action === "unpublish") {
      const { data, error } = await callPublicationRpc(supabase, "unpublish_lab_project", { p_lab_id: labId });
      if (error) {
        console.error("Public project unpublish failed:", error);
        return responseError("Unable to unpublish this project. Confirm the public publishing migration is installed.", 500);
      }
      if (data !== true) return responseError("No publication was found for this project.", 404);
      return NextResponse.json({ ok: true, publication: null, message: "Project unpublished." }, { headers: { "Cache-Control": "no-store" } });
    }

    if (payload.action !== "publish") return responseError("Choose publish or unpublish.");
    if (typeof payload.slug !== "string") return responseError("Enter a public URL slug.");
    const slug = payload.slug.trim();
    if (slug.length < 3 || slug.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return responseError("Use a URL slug of 3–64 lowercase letters, numbers, and single hyphens.");
    }

    const { data, error } = await callPublicationRpc(supabase, "publish_lab_project", {
      p_lab_id: labId,
      p_requested_slug: slug,
    });
    if (error) {
      console.error("Public project publish failed:", error);
      const lowerMessage = error.message.toLowerCase();
      const status = /already in use|duplicate key|unique constraint|reserved|must be approved|authorized|enrolment|required|invalid|remove scripts|external css|must include|project structure|url slug/.test(lowerMessage) ? 409 : 500;
      return responseError(error.message || "Unable to publish this project.", status);
    }

    const row = normaliseRow(data);
    const publicationSlug = row?.publication_slug ?? slug;
    return NextResponse.json({
      ok: true,
      publication: {
        slug: publicationSlug,
        isPublished: true,
        publishedAt: row?.published_at ?? new Date().toISOString(),
        path: `/p/${publicationSlug}`,
      },
      message: "The approved project is now public.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Public project publish route failed:", error);
    return responseError("Unable to publish this project.", 500);
  }
}
