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
  "image",
  "other",
] as const;

type ResourceType = (typeof TYPES)[number];
type ResourceRecord = Record<string, unknown>;

const SELECT_FIELDS =
  "id,user_id,title,url,description,resource_type,course_title,topic,is_favorite,created_at,updated_at,file_path,file_name,file_size,mime_type";

const ALLOWED_FILES: Record<
  string,
  {
    mime: string;
    signature: (bytes: Uint8Array) => boolean;
  }
> = {
  pdf: {
    mime: "application/pdf",
    signature: (bytes) =>
      bytes.length >= 5 &&
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46 &&
      bytes[4] === 0x2d,
  },
  png: {
    mime: "image/png",
    signature: (bytes) =>
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a,
  },
  jpg: {
    mime: "image/jpeg",
    signature: (bytes) =>
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff,
  },
  jpeg: {
    mime: "image/jpeg",
    signature: (bytes) =>
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff,
  },
  txt: {
    mime: "text/plain",
    signature: (bytes) =>
      bytes.every(
        (byte) =>
          byte !== 0 &&
          !(
            byte < 32 &&
            byte !== 9 &&
            byte !== 10 &&
            byte !== 12 &&
            byte !== 13
          ),
      ),
  },
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

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

function isResourceType(value: unknown): value is ResourceType {
  return (
    typeof value === "string" &&
    TYPES.includes(value as ResourceType)
  );
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

  return dot < 0 ? "" : filename.slice(dot + 1).toLowerCase();
}

function sanitizeFilename(filename: string): string {
  return (
    filename
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/\.{2,}/g, ".")
      .replace(/^\.+/, "")
      .slice(0, 150) || "document"
  );
}

async function validUpload(
  file: File,
): Promise<{ valid: boolean; mime: string | null }> {
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    return { valid: false, mime: null };
  }

  const extension = getFileExtension(file.name);
  const config = ALLOWED_FILES[extension];

  if (!config) {
    return { valid: false, mime: null };
  }

  if (file.type && file.type !== config.mime) {
    return { valid: false, mime: null };
  }

  const bytes = new Uint8Array(
    await file.slice(0, 16).arrayBuffer(),
  );

  if (!config.signature(bytes)) {
    return { valid: false, mime: null };
  }

  return { valid: true, mime: config.mime };
}

async function attachDownloadLinks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  resources: ResourceRecord[],
) {
  return Promise.all(
    resources.map(async (resource) => {
      const filePath =
        typeof resource.file_path === "string"
          ? resource.file_path
          : null;

      if (!filePath) {
        return { ...resource, download_url: null };
      }

      const userId =
        typeof resource.user_id === "string"
          ? resource.user_id
          : null;

      if (!userId || !filePath.startsWith(`${userId}/`)) {
        return { ...resource, download_url: null };
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
): Promise<boolean> {
  if (!path) return true;

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([path]);

  return !error;
}

async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
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

    if (type !== "all" && isResourceType(type)) {
      query = query.eq("resource_type", type);
    }

    const { data, error } = await query;

    if (error) {
      return jsonError("Could not load saved resources.", 500);
    }

    const resources = await attachDownloadLinks(
      supabase,
      (data ?? []) as ResourceRecord[],
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
        isResourceType(requestedType)
          ? requestedType
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

      const validation = await validUpload(file);

      if (!validation.valid || !validation.mime) {
        return jsonError(
          "Upload a valid PDF, TXT, PNG, or JPEG file no larger than 10 MB. The file contents must match the extension.",
          400,
        );
      }

      const filename = sanitizeFilename(file.name);
      const path = `${user.id}/${crypto.randomUUID()}-${filename}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
          contentType: validation.mime,
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
          mime_type: validation.mime,
        })
        .select(SELECT_FIELDS)
        .single();

      if (error) {
        const removed = await removeStoredFile(supabase, path);

        return jsonError(
          removed
            ? "Could not save the uploaded document record. Confirm the database migration has been applied."
            : "Could not save the document record, and storage cleanup failed. Administrator review is required.",
          500,
        );
      }

      const [resource] = await attachDownloadLinks(supabase, [
        data as ResourceRecord,
      ]);

      return NextResponse.json({ resource }, { status: 201 });
    }

    const body = await readJson(request);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonError("A valid JSON resource is required.", 400);
    }

    const input = body as Record<string, unknown>;
    const title = cleanText(input.title, MAX_TITLE);
    const url = validUrl(input.url);
    const description = optionalText(
      input.description,
      MAX_DESCRIPTION,
    );
    const courseTitle = optionalText(input.course_title, 180);
    const topic = optionalText(input.topic, 120);

    const resourceType: ResourceType = isResourceType(
      input.resource_type,
    )
      ? input.resource_type
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
      { resource: { ...data, download_url: null } },
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

    const body = await readJson(request);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonError("A valid update request is required.", 400);
    }

    const input = body as Record<string, unknown>;

    if (typeof input.id !== "string" || !input.id.trim()) {
      return jsonError("Resource ID is required.", 400);
    }

    const update: Record<string, unknown> = {};

    if (typeof input.is_favorite === "boolean") {
      update.is_favorite = input.is_favorite;
    }

    if (typeof input.title === "string") {
      const value = cleanText(input.title, MAX_TITLE);

      if (!value) {
        return jsonError("Title is invalid.", 400);
      }

      update.title = value;
    }

    if (typeof input.url === "string") {
      const value = validUrl(input.url);

      if (!value) {
        return jsonError("URL must use HTTP or HTTPS.", 400);
      }

      update.url = value;
    }

    if (typeof input.description === "string") {
      if (input.description.length > MAX_DESCRIPTION) {
        return jsonError("Description is too long.", 400);
      }

      update.description = input.description.trim() || null;
    }

    if (typeof input.topic === "string") {
      if (input.topic.length > 120) {
        return jsonError("Topic is too long.", 400);
      }

      update.topic = input.topic.trim() || null;
    }

    if (typeof input.course_title === "string") {
      if (input.course_title.length > 180) {
        return jsonError("Course title is too long.", 400);
      }

      update.course_title = input.course_title.trim() || null;
    }

    if (input.resource_type !== undefined) {
      if (!isResourceType(input.resource_type)) {
        return jsonError("Invalid resource type.", 400);
      }

      update.resource_type = input.resource_type;
    }

    if (!Object.keys(update).length) {
      return jsonError("No valid fields supplied.", 400);
    }

    const { data, error } = await supabase
      .from(TABLE)
      .update(update)
      .eq("id", input.id.trim())
      .eq("user_id", user.id)
      .select(SELECT_FIELDS)
      .single();

    if (error || !data) {
      return jsonError("Could not update resource.", 404);
    }

    const [resource] = await attachDownloadLinks(supabase, [
      data as ResourceRecord,
    ]);

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

    // Accept an ID in either the query string or JSON body.
    let id = request.nextUrl.searchParams.get("id")?.trim() ?? "";

    if (!id) {
      const body = await readJson(request);

      if (body && typeof body === "object" && !Array.isArray(body)) {
        const input = body as Record<string, unknown>;

        if (typeof input.id === "string") {
          id = input.id.trim();
        }
      }
    }

    if (!id) {
      return jsonError("Resource ID is required.", 400);
    }

    const { data: resource, error: lookupError } = await supabase
      .from(TABLE)
      .select("id,file_path")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (lookupError) {
      return jsonError("Could not find the resource.", 500);
    }

    if (!resource) {
      return jsonError("Resource not found.", 404);
    }

    const filePath =
      typeof resource.file_path === "string"
        ? resource.file_path
        : null;

    if (filePath && !filePath.startsWith(`${user.id}/`)) {
      return jsonError(
        "Resource file ownership could not be verified.",
        403,
      );
    }

    if (filePath) {
      const removed = await removeStoredFile(supabase, filePath);

      if (!removed) {
        return jsonError(
          "Could not remove the stored file. The resource was not deleted.",
          500,
        );
      }
    }

    const { error: deleteError } = await supabase
      .from(TABLE)
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (deleteError) {
      return jsonError(
        "The file was removed, but the resource record could not be deleted. Administrator review may be required.",
        500,
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return jsonError(
      "Unexpected error while deleting resources.",
      500,
    );
  }
}