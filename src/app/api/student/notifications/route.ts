import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const NOTIFICATION_COLUMNS = "id,type,title,message,href,read_at,created_at";
const MAX_REQUEST_SIZE = 4096;
const MAX_NOTIFICATION_ID_LENGTH = 100;

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    },
  );
}

function successResponse(data: Record<string, unknown>) {
  return NextResponse.json(data, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse(
        "Please sign in to view notifications.",
        401,
      );
    }

    const { data, error } = await supabase
      .from("student_notifications")
      .select(NOTIFICATION_COLUMNS)
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Notifications GET failed:", error.message);

      return errorResponse(
        "Notifications could not be loaded. Check that the notifications migration has been applied.",
        500,
      );
    }

    return successResponse({ notifications: data ?? [] });
  } catch (error) {
    console.error("Notifications GET unexpected error:", error);

    return errorResponse(
      "An unexpected error occurred while loading notifications.",
      500,
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse(
        "Please sign in to update notifications.",
        401,
      );
    }

    const contentType = request.headers.get("content-type") ?? "";

    if (!contentType.toLowerCase().includes("application/json")) {
      return errorResponse(
        "Content-Type must be application/json.",
        415,
      );
    }

    const contentLength = request.headers.get("content-length");

    if (
      contentLength &&
      (!/^\d+$/.test(contentLength) ||
        Number(contentLength) > MAX_REQUEST_SIZE)
    ) {
      return errorResponse("Request body is too large.", 413);
    }

    let rawBody: unknown;

    try {
      const text = await request.text();

      if (new TextEncoder().encode(text).byteLength > MAX_REQUEST_SIZE) {
        return errorResponse("Request body is too large.", 413);
      }

      rawBody = JSON.parse(text);
    } catch {
      return errorResponse(
        "A valid JSON request body is required.",
        400,
      );
    }

    if (
      rawBody === null ||
      typeof rawBody !== "object" ||
      Array.isArray(rawBody)
    ) {
      return errorResponse(
        "The request body must be a JSON object.",
        400,
      );
    }

    const body = rawBody as Record<string, unknown>;
    const allowedKeys = new Set(["id", "markAllRead"]);

    if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
      return errorResponse(
        "The request contains unsupported fields.",
        400,
      );
    }

    const now = new Date().toISOString();

    if (body.markAllRead === true) {
      if (Object.hasOwn(body, "id")) {
        return errorResponse(
          "Provide either markAllRead or an ID, not both.",
          400,
        );
      }

      const { error } = await supabase
        .from("student_notifications")
        .update({ read_at: now })
        .eq("recipient_id", user.id)
        .is("read_at", null);

      if (error) {
        console.error(
          "Mark all notifications read failed:",
          error.message,
        );

        return errorResponse(
          "Notifications could not be updated.",
          500,
        );
      }

      return successResponse({ success: true });
    }

    if (
      typeof body.id !== "string" ||
      body.id.trim().length === 0 ||
      body.id.length > MAX_NOTIFICATION_ID_LENGTH
    ) {
      return errorResponse(
        "A valid notification ID is required.",
        400,
      );
    }

    const { data, error } = await supabase
      .from("student_notifications")
      .update({ read_at: now })
      .eq("id", body.id)
      .eq("recipient_id", user.id)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error(
        "Mark notification read failed:",
        error.message,
      );

      return errorResponse(
        "This notification could not be updated.",
        500,
      );
    }

    if (!data) {
      return errorResponse("Notification not found.", 404);
    }

    return successResponse({ success: true });
  } catch (error) {
    console.error("Notifications PATCH unexpected error:", error);

    return errorResponse(
      "An unexpected error occurred while updating notifications.",
      500,
    );
  }
}