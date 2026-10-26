import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const STORAGE_BUCKET = "practical-work-evidence";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_TEXT_LENGTH = 50_000;

const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const EXTENSIONS_BY_TYPE: Record<string, string[]> = {
  "application/pdf": ["pdf"],
  "application/msword": ["doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    "docx",
  ],
  "application/vnd.ms-excel": ["xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
    "xlsx",
  ],
  "application/vnd.ms-powerpoint": ["ppt"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
    "pptx",
  ],
  "text/plain": ["txt"],
  "text/csv": ["csv"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
};

type SubmissionStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_required";

type Enrollment = {
  course_id: string;
  enrollment_status: string;
};

type PracticalTask = {
  id: string;
  course_id: string;
  title: string;
  scenario: string;
  instructions: string;
  expected_outcome: string | null;
  submission_type:
    | "text"
    | "document"
    | "spreadsheet"
    | "presentation"
    | "mixed";
  max_score: number;
  sort_order: number;
  is_published: boolean;
  skill_id: string | null;
};

type PracticalSubmission = {
  id: string;
  task_id: string;
  student_id: string;
  submission_text: string | null;
  status: SubmissionStatus;
  score: number | null;
  reviewer_feedback: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  evidence_file_path: string | null;
  evidence_file_name: string | null;
  evidence_file_type: string | null;
  evidence_file_size: number | null;
  evidence_recorded_at: string | null;
  created_at?: string;
};

type SupabaseClient = Awaited<
  ReturnType<typeof createClient>
>;

function jsonError(
  message: string,
  status = 400,
) {
  return NextResponse.json(
    { error: message },
    { status },
  );
}

async function getAuthenticatedUser() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error(
      "Practical work authentication error:",
      error.message,
    );
  }

  return {
    supabase,
    user: error ? null : user,
  };
}

function getSafeFileName(fileName: string): string {
  const cleaned = fileName
    .normalize("NFKC")
    .replace(/[\\/]/g, "-")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 160);

  return cleaned || "evidence-file";
}

function extensionForFile(file: File): string {
  const name = file.name.trim();
  const dot = name.lastIndexOf(".");

  if (dot <= 0 || dot === name.length - 1) {
    return "";
  }

  return name
    .slice(dot + 1)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function submissionTypeAllowsFile(
  submissionType: PracticalTask["submission_type"],
  file: File,
): boolean {
  if (submissionType === "mixed") {
    return true;
  }

  const type = file.type.toLowerCase();

  if (submissionType === "document") {
    return [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ].includes(type);
  }

  if (submissionType === "spreadsheet") {
    return [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
    ].includes(type);
  }

  if (submissionType === "presentation") {
    return [
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/pdf",
    ].includes(type);
  }

  return false;
}

function bytesStartWith(
  bytes: Uint8Array,
  signature: number[],
  offset = 0,
): boolean {
  return signature.every(
    (byte, index) => bytes[offset + index] === byte,
  );
}

async function validateFileSignature(
  file: File,
): Promise<boolean> {
  const buffer = await file
    .slice(0, Math.min(file.size, 8192))
    .arrayBuffer();

  const bytes = new Uint8Array(buffer);
  const type = file.type.toLowerCase();

  if (type === "application/pdf") {
    return bytesStartWith(bytes, [
      0x25, 0x50, 0x44, 0x46, 0x2d,
    ]);
  }

  if (type === "image/jpeg") {
    return bytesStartWith(bytes, [
      0xff, 0xd8, 0xff,
    ]);
  }

  if (type === "image/png") {
    return bytesStartWith(bytes, [
      0x89, 0x50, 0x4e, 0x47,
      0x0d, 0x0a, 0x1a, 0x0a,
    ]);
  }

  if (type === "image/webp") {
    return (
      bytesStartWith(bytes, [
        0x52, 0x49, 0x46, 0x46,
      ]) &&
      bytesStartWith(
        bytes,
        [0x57, 0x45, 0x42, 0x50],
        8,
      )
    );
  }

  const modernOfficeTypes = [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ];

  if (modernOfficeTypes.includes(type)) {
    return bytesStartWith(bytes, [
      0x50, 0x4b, 0x03, 0x04,
    ]);
  }

  const legacyOfficeTypes = [
    "application/msword",
    "application/vnd.ms-excel",
    "application/vnd.ms-powerpoint",
  ];

  if (legacyOfficeTypes.includes(type)) {
    return bytesStartWith(bytes, [
      0xd0, 0xcf, 0x11, 0xe0,
      0xa1, 0xb1, 0x1a, 0xe1,
    ]);
  }

  if (
    type === "text/plain" ||
    type === "text/csv"
  ) {
    if (bytes.length === 0) {
      return false;
    }

    for (const byte of bytes) {
      if (byte === 0) {
        return false;
      }
    }

    return true;
  }

  return false;
}

async function createEvidenceSignedUrl(
  supabase: SupabaseClient,
  filePath: string | null,
): Promise<string | null> {
  if (!filePath) {
    return null;
  }

  try {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(filePath, 60 * 60);

    if (error) {
      console.error(
        "Evidence signed URL error:",
        error.message,
      );

      return null;
    }

    return data?.signedUrl ?? null;
  } catch (error) {
    console.error(
      "Evidence signed URL request failed:",
      error,
    );

    return null;
  }
}

async function removeUploadedFile(
  supabase: SupabaseClient,
  filePath: string | null,
): Promise<void> {
  if (!filePath) {
    return;
  }

  try {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([filePath]);

    if (error) {
      console.error(
        "Evidence cleanup error:",
        error.message,
      );
    }
  } catch (error) {
    console.error(
      "Evidence cleanup request failed:",
      error,
    );
  }
}

async function getFileFromFormData(
  formData: FormData,
): Promise<File | null> {
  const rawFile = formData.get("evidenceFile");

  if (
    typeof File !== "undefined" &&
    rawFile instanceof File &&
    rawFile.size > 0
  ) {
    return rawFile;
  }

  return null;
}

export async function GET() {
  try {
    const { supabase, user } =
      await getAuthenticatedUser();

    if (!user) {
      return jsonError(
        "Authentication required.",
        401,
      );
    }

    const {
      data: enrollmentData,
      error: enrollmentError,
    } = await supabase
      .from("enrollments")
      .select("course_id, enrollment_status")
      .eq("student_id", user.id)
      .in("enrollment_status", [
        "active",
        "completed",
      ]);

    if (enrollmentError) {
      console.error(
        "Practical work enrollment error:",
        enrollmentError.message,
      );

      return jsonError(
        "Unable to load your course access.",
        500,
      );
    }

    const enrollments =
      (enrollmentData ?? []) as Enrollment[];

    const courseIds = Array.from(
      new Set(
        enrollments.map(
          (item) => item.course_id,
        ),
      ),
    );

    if (courseIds.length === 0) {
      return NextResponse.json({
        tasks: [],
        submissions: [],
      });
    }

    const {
      data: taskData,
      error: taskError,
    } = await supabase
      .from("course_practical_tasks")
      .select(`
        id,
        course_id,
        title,
        scenario,
        instructions,
        expected_outcome,
        submission_type,
        max_score,
        sort_order,
        is_published,
        skill_id
      `)
      .in("course_id", courseIds)
      .eq("is_published", true)
      .order("sort_order", {
        ascending: true,
      });

    if (taskError) {
      console.error(
        "Practical tasks load error:",
        taskError.message,
      );

      return jsonError(
        "Unable to load practical tasks.",
        500,
      );
    }

    const tasks =
      (taskData ?? []) as unknown as PracticalTask[];

    const taskIds = tasks.map(
      (task) => task.id,
    );

    let submissions: PracticalSubmission[] = [];

    if (taskIds.length > 0) {
      const {
        data: submissionData,
        error: submissionError,
      } = await supabase
        .from("student_practical_task_submissions")
        .select(`
          id,
          task_id,
          student_id,
          submission_text,
          status,
          score,
          reviewer_feedback,
          submitted_at,
          reviewed_at,
          evidence_file_path,
          evidence_file_name,
          evidence_file_type,
          evidence_file_size,
          evidence_recorded_at,
          created_at
        `)
        .eq("student_id", user.id)
        .in("task_id", taskIds)
        .order("submitted_at", {
          ascending: false,
          nullsFirst: false,
        })
        .order("created_at", {
          ascending: false,
        });

      if (submissionError) {
        console.error(
          "Practical submissions load error:",
          submissionError.message,
        );

        return jsonError(
          "Unable to load your practical submissions.",
          500,
        );
      }

      submissions =
        (submissionData ?? []) as unknown as PracticalSubmission[];
    }

    /*
     * Return the newest record for each task.
     * This is robust even if legacy data contains multiple
     * submissions for one learner/task combination.
     */
    const submissionMap =
      new Map<string, PracticalSubmission>();

    for (const submission of submissions) {
      if (!submissionMap.has(submission.task_id)) {
        submissionMap.set(
          submission.task_id,
          submission,
        );
      }
    }

    const submissionsWithUrls = await Promise.all(
      Array.from(submissionMap.values()).map(
        async (submission) => ({
          ...submission,
          evidence_file_url:
            await createEvidenceSignedUrl(
              supabase,
              submission.evidence_file_path,
            ),
        }),
      ),
    );

    const finalSubmissionMap = new Map(
      submissionsWithUrls.map(
        (submission) => [
          submission.task_id,
          submission,
        ],
      ),
    );

    const enrichedTasks = tasks.map((task) => ({
      ...task,
      submission:
        finalSubmissionMap.get(task.id) ?? null,
    }));

    return NextResponse.json({
      tasks: enrichedTasks,
      submissions: submissionsWithUrls,
    });
  } catch (error) {
    console.error(
      "Practical work GET error:",
      error,
    );

    return jsonError(
      "An unexpected error occurred while loading practical work.",
      500,
    );
  }
}

export async function POST(request: Request) {
  let supabase: SupabaseClient | null = null;
  let uploadedFilePath: string | null = null;
  let submissionSaved = false;

  try {
    const auth = await getAuthenticatedUser();

    supabase = auth.supabase;

    if (!auth.user) {
      return jsonError(
        "Authentication required.",
        401,
      );
    }

    const user = auth.user;

    const contentType = (
      request.headers.get("content-type") ?? ""
    ).toLowerCase();

    let taskId = "";
    let submissionText = "";
    let evidenceFile: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      let formData: FormData;

      try {
        formData = await request.formData();
      } catch {
        return jsonError(
          "Invalid multipart request body.",
          400,
        );
      }

      const rawTaskId = formData.get("taskId");
      const rawSubmissionText =
        formData.get("submissionText");

      taskId =
        typeof rawTaskId === "string"
          ? rawTaskId.trim()
          : "";

      submissionText =
        typeof rawSubmissionText === "string"
          ? rawSubmissionText.trim()
          : "";

      evidenceFile =
        await getFileFromFormData(formData);
    } else if (
      contentType.includes("application/json")
    ) {
      let body: unknown;

      try {
        body = await request.json();
      } catch {
        return jsonError(
          "Invalid request body.",
          400,
        );
      }

      if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body)
      ) {
        return jsonError(
          "Invalid request body.",
          400,
        );
      }

      const payload =
        body as Record<string, unknown>;

      taskId =
        typeof payload.taskId === "string"
          ? payload.taskId.trim()
          : "";

      submissionText =
        typeof payload.submissionText === "string"
          ? payload.submissionText.trim()
          : "";
    } else {
      return jsonError(
        "Use a JSON or multipart form request.",
        415,
      );
    }

    if (!taskId) {
      return jsonError(
        "Task ID is required.",
        400,
      );
    }

    if (submissionText.length > MAX_TEXT_LENGTH) {
      return jsonError(
        "Your submission is too long. Maximum length is 50,000 characters.",
        400,
      );
    }

    if (!submissionText && !evidenceFile) {
      return jsonError(
        "Enter your practical response or attach an evidence file before submitting.",
        400,
      );
    }

    if (evidenceFile) {
      if (evidenceFile.size > MAX_FILE_SIZE) {
        return jsonError(
          "Evidence file is too large. Maximum file size is 10 MB.",
          400,
        );
      }

      if (
        !ALLOWED_FILE_TYPES.has(
          evidenceFile.type.toLowerCase(),
        )
      ) {
        return jsonError(
          "Unsupported file type. Upload PDF, Word, Excel, PowerPoint, CSV, TXT, JPG, PNG, or WEBP.",
          400,
        );
      }

      const extension =
        extensionForFile(evidenceFile);

      if (!extension) {
        return jsonError(
          "The evidence file must have a valid file extension.",
          400,
        );
      }

      const allowedExtensions =
        EXTENSIONS_BY_TYPE[
          evidenceFile.type.toLowerCase()
        ] ?? [];

      if (!allowedExtensions.includes(extension)) {
        return jsonError(
          "The file extension does not match its declared file type.",
          400,
        );
      }

      const validSignature =
        await validateFileSignature(evidenceFile);

      if (!validSignature) {
        return jsonError(
          "The file contents do not match the declared file type. Choose a valid file and try again.",
          400,
        );
      }
    }

    const {
      data: taskData,
      error: taskError,
    } = await supabase
      .from("course_practical_tasks")
      .select(`
        id,
        course_id,
        title,
        scenario,
        instructions,
        expected_outcome,
        submission_type,
        max_score,
        sort_order,
        is_published,
        skill_id
      `)
      .eq("id", taskId)
      .eq("is_published", true)
      .maybeSingle();

    if (taskError) {
      console.error(
        "Practical task lookup error:",
        taskError.message,
      );

      return jsonError(
        "Unable to verify the practical task.",
        500,
      );
    }

    const task =
      taskData as unknown as PracticalTask | null;

    if (!task) {
      return jsonError(
        "Practical task not found or is not currently available.",
        404,
      );
    }

    if (
      evidenceFile &&
      !submissionTypeAllowsFile(
        task.submission_type,
        evidenceFile,
      )
    ) {
      return jsonError(
        `This task expects ${task.submission_type} evidence. The selected file is not compatible with that submission type.`,
        400,
      );
    }

    const {
      data: enrollmentData,
      error: enrollmentError,
    } = await supabase
      .from("enrollments")
      .select("course_id, enrollment_status")
      .eq("student_id", user.id)
      .eq("course_id", task.course_id)
      .in("enrollment_status", [
        "active",
        "completed",
      ])
      .maybeSingle();

    if (enrollmentError) {
      console.error(
        "Practical work enrollment verification error:",
        enrollmentError.message,
      );

      return jsonError(
        "Unable to verify your course enrollment.",
        500,
      );
    }

    const enrollment =
      enrollmentData as Enrollment | null;

    if (!enrollment) {
      return jsonError(
        "You must be enrolled in this course before submitting practical work.",
        403,
      );
    }

    /*
     * Retrieve the newest existing submission.
     * This avoids maybeSingle() failing merely because older duplicate
     * records exist from previous submission flows.
     */
    const {
      data: existingData,
      error: existingError,
    } = await supabase
      .from("student_practical_task_submissions")
      .select(`
        id,
        task_id,
        student_id,
        submission_text,
        status,
        score,
        reviewer_feedback,
        submitted_at,
        reviewed_at,
        evidence_file_path,
        evidence_file_name,
        evidence_file_type,
        evidence_file_size,
        evidence_recorded_at,
        created_at
      `)
      .eq("task_id", task.id)
      .eq("student_id", user.id)
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.error(
        "Existing practical submission lookup error:",
        existingError.message,
      );

      return jsonError(
        "Unable to check your previous submission.",
        500,
      );
    }

    const existingSubmission =
      existingData as unknown as PracticalSubmission | null;

    if (
      existingSubmission?.status === "approved" ||
      existingSubmission?.status === "under_review"
    ) {
      return jsonError(
        "This practical task cannot be resubmitted while the current submission is approved or under review.",
        409,
      );
    }

    let evidencePath =
      existingSubmission?.evidence_file_path ?? null;

    let evidenceName =
      existingSubmission?.evidence_file_name ?? null;

    let evidenceType =
      existingSubmission?.evidence_file_type ?? null;

    let evidenceSize =
      existingSubmission?.evidence_file_size ?? null;

    if (evidenceFile) {
      const safeName = getSafeFileName(
        evidenceFile.name,
      );

      const extension =
        extensionForFile(evidenceFile);

      const uniqueName =
        `${crypto.randomUUID()}.${extension}`;

      const path =
        `${user.id}/${task.id}/${uniqueName}`;

      const {
        error: uploadError,
      } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, evidenceFile, {
          contentType: evidenceFile.type,
          upsert: false,
        });

      if (uploadError) {
        console.error(
          "Practical evidence upload error:",
          uploadError.message,
        );

        return jsonError(
          "Unable to upload your evidence file. Please try again.",
          500,
        );
      }

      uploadedFilePath = path;
      evidencePath = path;
      evidenceName = safeName;
      evidenceType = evidenceFile.type;
      evidenceSize = evidenceFile.size;
    }

    const now = new Date().toISOString();

    const submissionPayload = {
      task_id: task.id,
      student_id: user.id,
      submission_text: submissionText || null,
      status: "submitted" as const,
      score: null,
      reviewer_feedback: null,
      submitted_at: now,
      reviewed_at: null,
      evidence_file_path: evidencePath,
      evidence_file_name: evidenceName,
      evidence_file_type: evidenceType,
      evidence_file_size: evidenceSize,

      /*
       * A new or revised learner submission is not yet approved evidence.
       * Clear any stale marker so the reviewer must record evidence again
       * after approving the new submission.
       */
      evidence_recorded_at: null,
      updated_at: now,
    };

    const selectFields = `
      id,
      task_id,
      student_id,
      submission_text,
      status,
      score,
      reviewer_feedback,
      submitted_at,
      reviewed_at,
      evidence_file_path,
      evidence_file_name,
      evidence_file_type,
      evidence_file_size,
      evidence_recorded_at,
      created_at
    `;

    let savedData: unknown = null;
    let saveError: {
      message: string;
      code?: string;
    } | null = null;

    if (existingSubmission) {
      const result = await supabase
        .from("student_practical_task_submissions")
        .update(submissionPayload)
        .eq("id", existingSubmission.id)
        .eq("student_id", user.id)
        .select(selectFields)
        .single();

      savedData = result.data;
      saveError = result.error;
    } else {
      const result = await supabase
        .from("student_practical_task_submissions")
        .insert(submissionPayload)
        .select(selectFields)
        .single();

      savedData = result.data;
      saveError = result.error;
    }

    if (saveError || !savedData) {
      console.error(
        "Practical submission save error:",
        saveError?.message ?? "No submission returned.",
      );

      await removeUploadedFile(
        supabase,
        uploadedFilePath,
      );

      uploadedFilePath = null;

      if (saveError?.code === "23505") {
        return jsonError(
          "A submission was saved at the same time. Refresh the page before trying again.",
          409,
        );
      }

      return jsonError(
        "Unable to submit your practical work.",
        500,
      );
    }

    submissionSaved = true;

    const submission =
      savedData as PracticalSubmission;

    /*
     * Delete the previous storage object only after the new submission
     * record has been saved successfully.
     */
    if (
      evidenceFile &&
      existingSubmission?.evidence_file_path &&
      existingSubmission.evidence_file_path !==
        uploadedFilePath
    ) {
      await removeUploadedFile(
        supabase,
        existingSubmission.evidence_file_path,
      );
    }

    const evidenceFileUrl =
      await createEvidenceSignedUrl(
        supabase,
        submission.evidence_file_path,
      );

    return NextResponse.json({
      success: true,
      submission: {
        ...submission,
        evidence_file_url: evidenceFileUrl,
      },
    });
  } catch (error) {
    console.error(
      "Practical work POST error:",
      error,
    );

    /*
     * Do not delete an uploaded file if its submission record has
     * already been saved successfully.
     */
    if (
      supabase &&
      uploadedFilePath &&
      !submissionSaved
    ) {
      await removeUploadedFile(
        supabase,
        uploadedFilePath,
      );
    }

    return jsonError(
      "An unexpected error occurred while submitting practical work.",
      500,
    );
  }
}