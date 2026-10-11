import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const TABLE = "learner_saved_resources";
const BUCKET = "learner-resource-files";
const MAX_TITLE = 180;
const MAX_DESCRIPTION = 1200;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const TYPES = [
  "article",
  "video",
  "document",
  "tool",
  "website",
  "other",
] as const;

type ResourceType = (typeof TYPES)[number];

const SELECT_FIELDS =
  "id,title,url,description,resource_type,course_title,topic,is_favorite,created_at,updated_at,file_path,file_name,file_size,mime_type";

const ALLOWED_FILES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;

  const text = value.trim();

  return text.length > 0 && text.length <= max ? text : null;
}

function optionalText(
  value: unknown,
  max: number,
): string | null | undefined {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return cleanText(value, max) ?? undefined;
}

function validUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) {
    return null;
  }

  try {
    const url = new URL(value.trim());

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function session() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return {
    supabase,
    user: error ? null : user,
  };
}

function getFileExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");

  if (dot < 0) return "";

  return filename.slice(dot + 1).toLowerCase();
}

function sanitizeFilename(filename: string): string {
  return (
    filename
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/\.{2,}/g, ".")
      .slice(0, 150) || "document"
  );
}

function validUpload(file: File): boolean {
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    return false;
  }

  const extension = getFileExtension(file.name);
  const expectedMime = ALLOWED_FILES[extension];

  if (!expectedMime || file.type !== expectedMime) {
    return false;
  }

  return true;
}

async function attachDownloadLinks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  resources: Record<string, unknown>[],
) {
  return Promise.all(
    resources.map(async (resource) => {
      const filePath =
        typeof resource.file_path === "string"
          ? resource.file_path
          : null;

      if (!filePath) {
        return {
          ...resource,
          download_url: null,
        };
      }

      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(filePath, 300, {
          download:
            typeof resource.file_name === "string"
              ? resource.file_name
              : true,
        });

      return {
        ...resource,
        download_url: error ? null : data.signedUrl,
      };
    }),
  );
}

async function removeStoredFile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string | null,
) {
  if (!path) return;

  await supabase.storage.from(BUCKET).remove([path]);
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await session();

    if (!user) {
      return jsonError(
        "Please sign in to access your learning resources.",
        401,
      );
    }

    const search = (
      request.nextUrl.searchParams.get("q") ?? ""
    )
      .trim()
      .slice(0, 120);

    const type = request.nextUrl.searchParams.get("type") ?? "all";

    let query = supabase
      .from(TABLE)
      .select(SELECT_FIELDS)
      .eq("user_id", user.id)
      .order("is_favorite", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);

    if (search) {
      const term = search.replace(/[%_,()]/g, " ");

      query = query.or(
        `title.ilike.%${term}%,description.ilike.%${term}%,topic.ilike.%${term}%,course_title.ilike.%${term}%`,
      );
    }

    if (
      type !== "all" &&
      TYPES.includes(type as ResourceType)
    ) {
      query = query.eq("resource_type", type);
    }

    const { data, error } = await query;

    if (error) {
      return jsonError("Could not load saved resources.", 500);
    }

    const resources = await attachDownloadLinks(
      supabase,
      (data ?? []) as Record<string, unknown>[],
    );

    return NextResponse.json({ resources });
  } catch {
    return jsonError(
      "Unexpected error while loading resources.",
      500,
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await session();

    if (!user) {
      return jsonError(
        "Please sign in to save a resource.",
        401,
      );
    }

    const contentType = request.headers.get("content-type") ?? "";

    // Document upload.
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();

      const file = form.get("file");
      const title = cleanText(form.get("title"), MAX_TITLE);
      const description = optionalText(
        form.get("description"),
        MAX_DESCRIPTION,
      );
      const courseTitle = optionalText(
        form.get("course_title"),
        180,
      );
      const topic = optionalText(form.get("topic"), 120);

      const requestedType = form.get("resource_type");

      const resourceType: ResourceType =
        typeof requestedType === "string" &&
        TYPES.includes(requestedType as ResourceType)
          ? (requestedType as ResourceType)
          : "document";

      if (!(file instanceof File)) {
        return jsonError("Choose a file to upload.", 400);
      }

      if (!title) {
        return jsonError("Enter a valid document title.", 400);
      }

      if (
        description === undefined ||
        courseTitle === undefined ||
        topic === undefined
      ) {
        return jsonError(
          "One or more optional fields exceed their allowed length.",
          400,
        );
      }

      if (!validUpload(file)) {
        return jsonError(
          "Upload a valid PDF, DOC, DOCX, TXT, PNG, or JPEG file no larger than 10 MB.",
          400,
        );
      }

      const filename = sanitizeFilename(file.name);
      const path = `${user.id}/${crypto.randomUUID()}-${filename}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
          contentType: ALLOWED_FILES[getFileExtension(file.name)],
          upsert: false,
        });

      if (uploadError) {
        return jsonError(
          "File upload failed. Confirm the private storage bucket and policies are configured.",
          500,
        );
      }

      const { data, error } = await supabase
        .from(TABLE)
        .insert({
          user_id: user.id,
          title,
          url: null,
          description: description ?? null,
          resource_type: resourceType,
          course_title: courseTitle ?? null,
          topic: topic ?? null,
          file_path: path,
          file_name: file.name.slice(0, 255),
          file_size: file.size,
          mime_type: ALLOWED_FILES[getFileExtension(file.name)],
        })
        .select(SELECT_FIELDS)
        .single();

      if (error) {
        await removeStoredFile(supabase, path);

        return jsonError(
          "Could not save the uploaded document record. Confirm the database migration has been applied.",
          500,
        );
      }

      const [resource] = await attachDownloadLinks(
        supabase,
        [data as Record<string, unknown>],
      );

      return NextResponse.json({ resource }, { status: 201 });
    }

    // Existing save-link functionality.
    const body = await request.json();

    const title = cleanText(body.title, MAX_TITLE);
    const url = validUrl(body.url);

    const description = optionalText(
      body.description,
      MAX_DESCRIPTION,
    );

    const courseTitle = optionalText(
      body.course_title,
      180,
    );

    const topic = optionalText(body.topic, 120);

    const resourceType: ResourceType = TYPES.includes(
      body.resource_type,
    )
      ? body.resource_type
      : "other";

    if (
      !title ||
      !url ||
      description === undefined ||
      courseTitle === undefined ||
      topic === undefined
    ) {
      return jsonError(
        "Enter a valid title and HTTP/HTTPS URL. Check the optional field lengths.",
        400,
      );
    }

    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        user_id: user.id,
        title,
        url,
        description: description ?? null,
        resource_type: resourceType,
        course_title: courseTitle ?? null,
        topic: topic ?? null,
      })
      .select(SELECT_FIELDS)
      .single();

    if (error) {
      return jsonError("Could not save this resource.", 500);
    }

    return NextResponse.json(
      {
        resource: {
          ...data,
          download_url: null,
        },
      },
      { status: 201 },
    );
  } catch {
    return jsonError("Invalid resource request.", 400);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { supabase, user } = await session();

    if (!user) {
      return jsonError(
        "Please sign in to update resources.",
        401,
      );
    }

    const body = await request.json();

    if (typeof body.id !== "string" || !body.id) {
      return jsonError("Resource ID is required.", 400);
    }

    const update: Record<string, unknown> = {};

    if (typeof body.is_favorite === "boolean") {
      update.is_favorite = body.is_favorite;
    }

    if (typeof body.title === "string") {
      const value = cleanText(body.title, MAX_TITLE);

      if (!value) {
        return jsonError("Title is invalid.", 400);
      }

      update.title = value;
    }

    if (typeof body.url === "string") {
      const value = validUrl(body.url);

      if (!value) {
        return jsonError(
          "URL must use HTTP or HTTPS.",
          400,
        );
      }

      update.url = value;
    }

    if (typeof body.description === "string") {
      if (body.description.length > MAX_DESCRIPTION) {
        return jsonError("Description is too long.", 400);
      }

      update.description = body.description.trim() || null;
    }

    if (typeof body.topic === "string") {
      if (body.topic.length > 120) {
        return jsonError("Topic is too long.", 400);
      }

      update.topic = body.topic.trim() || null;
    }

    if (typeof body.course_title === "string") {
      if (body.course_title.length > 180) {
        return jsonError("Course title is too long.", 400);
      }

      update.course_title =
        body.course_title.trim() || null;
    }

    if (body.resource_type !== undefined) {
      if (!TYPES.includes(body.resource_type)) {
        return jsonError(
          "Invalid resource type.",
          400,
        );
      }

      update.resource_type = body.resource_type;
    }

    if (!Object.keys(update).length) {
      return jsonError(
        "No valid fields supplied.",
        400,
      );
    }

    const { data, error } = await supabase
      .from(TABLE)
      .update(update)
      .eq("id", body.id)
      .eq("user_id", user.id)
      .select(SELECT_FIELDS)
      .single();

    if (error) {
      return jsonError(
        "Could not update resource.",
        500,
      );
    }

    const [resource] = await attachDownloadLinks(
      supabase,
      [data as Record<string, unknown>],
    );

    return NextResponse.json({ resource });
  } catch {
    return jsonError("Invalid update request.", 400);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { supabase, user } = await session();

    if (!user) {
      return jsonError(
        "Please sign in to delete resources.",
        401,
      );
    }

    const id = request.nextUrl.searchParams.get("id");

    if (!id) {
      return jsonError(
        "Resource ID is required.",
        400,
      );
    }

    const { data: resource, error: lookupError } = await supabase
      .from(TABLE)
      .select("id,file_path")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (lookupError) {
      return jsonError(
        "Could not find the resource.",
        500,
      );
    }

    if (!resource) {
      return jsonError("Resource not found.", 404);
    }

    const { error: deleteError } = await supabase
      .from(TABLE)
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (deleteError) {
      return jsonError(
        "Could not delete resource.",
        500,
      );
    }

    if (resource.file_path) {
      await removeStoredFile(
        supabase,
        resource.file_path,
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return jsonError(
      "Unexpected error while deleting resource.",
      500,
    );
  }
}