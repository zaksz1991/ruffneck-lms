import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const STORAGE_BUCKET =
  "practical-work-evidence";

const MAX_FILE_SIZE =
  10 * 1024 * 1024;

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
  expected_outcome: string;
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
  status:
    | "draft"
    | "submitted"
    | "under_review"
    | "approved"
    | "revision_required";
  score: number | null;
  reviewer_feedback: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  evidence_file_path: string | null;
  evidence_file_name: string | null;
  evidence_file_type: string | null;
  evidence_file_size: number | null;
  evidence_recorded_at: string | null;
}

async function getAuthenticatedUser() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    supabase,
    user,
  };
}

function getSafeFileName(
  fileName: string
) {
  const cleaned =
    fileName
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 160);

  return cleaned || "evidence-file";
}

function isAllowedFileType(
  file: File
) {
  return ALLOWED_FILE_TYPES.has(
    file.type
  );
}

function extensionForFile(
  file: File
) {
  const originalName =
    file.name.trim();

  const lastDot =
    originalName.lastIndexOf(".");

  if (
    lastDot > -1 &&
    lastDot < originalName.length - 1
  ) {
    return originalName
      .slice(lastDot + 1)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  return "file";
}

function submissionTypeAllowsFile(
  submissionType: PracticalTask["submission_type"],
  file: File
) {
  if (submissionType === "mixed") {
    return true;
  }

  const type = file.type;

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

async function createEvidenceSignedUrl(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >,
  filePath: string | null
) {
  if (!filePath) {
    return null;
  }

  const {
    data,
    error,
  } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(
      filePath,
      60 * 60
    );

  if (error) {
    console.error(
      "Evidence signed URL error:",
      error
    );

    return null;
  }

  return data?.signedUrl ?? null;
}

export async function GET() {
  try {
    const { supabase, user } =
      await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        {
          error:
            "Authentication required.",
        },
        { status: 401 }
      );
    }

    const {
      data: enrollmentData,
      error: enrollmentError,
    } = await supabase
      .from("enrollments")
      .select(
        "course_id, enrollment_status"
      )
      .eq("student_id", user.id)
      .in("enrollment_status", [
        "active",
        "completed",
      ]);

    if (enrollmentError) {
      console.error(
        "Practical work enrollment error:",
        enrollmentError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load your course access.",
        },
        { status: 500 }
      );
    }

    const enrollments =
      (enrollmentData ??
        []) as Enrollment[];

    const courseIds = [
      ...new Set(
        enrollments.map(
          (enrollment) =>
            enrollment.course_id
        )
      ),
    ];

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
      .select(
        `
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
        `
      )
      .in("course_id", courseIds)
      .eq("is_published", true)
      .order("sort_order", {
        ascending: true,
      });

    if (taskError) {
      console.error(
        "Practical tasks load error:",
        taskError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load practical tasks.",
        },
        { status: 500 }
      );
    }

    const tasks =
      (taskData ?? []) as unknown as PracticalTask[];

    const taskIds = tasks.map(
      (task) => task.id
    );

    let submissions: PracticalSubmission[] =
      [];

    if (taskIds.length > 0) {
      const {
        data: submissionData,
        error: submissionError,
      } = await supabase
        .from(
          "student_practical_task_submissions"
        )
        .select(
          `
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
            evidence_recorded_at
          `
        )
        .eq(
          "student_id",
          user.id
        )
        .in(
          "task_id",
          taskIds
        );

      if (submissionError) {
        console.error(
          "Practical submissions load error:",
          submissionError
        );

        return NextResponse.json(
          {
            error:
              "Unable to load your practical submissions.",
          },
          { status: 500 }
        );
      }

      submissions =
        (submissionData ??
          []) as unknown as PracticalSubmission[];
    }

    const submissionsWithUrls =
      await Promise.all(
        submissions.map(
          async (submission) => ({
            ...submission,
            evidence_file_url:
              await createEvidenceSignedUrl(
                supabase,
                submission.evidence_file_path
              ),
          })
        )
      );

    const submissionMap = new Map<
      string,
      (typeof submissionsWithUrls)[number]
    >();

    for (const submission of submissionsWithUrls) {
      submissionMap.set(
        submission.task_id,
        submission
      );
    }

    const enrichedTasks =
      tasks.map((task) => ({
        ...task,
        submission:
          submissionMap.get(task.id) ??
          null,
      }));

    return NextResponse.json({
      tasks: enrichedTasks,
      submissions:
        submissionsWithUrls,
    });
  } catch (error) {
    console.error(
      "Practical work GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "An unexpected error occurred while loading practical work.",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request
) {
  let uploadedFilePath:
    | string
    | null = null;

  try {
    const { supabase, user } =
      await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        {
          error:
            "Authentication required.",
        },
        { status: 401 }
      );
    }

    const contentType =
      request.headers.get(
        "content-type"
      ) ?? "";

    let taskId = "";
    let submissionText = "";
    let evidenceFile: File | null =
      null;

    if (
      contentType
        .toLowerCase()
        .includes("multipart/form-data")
    ) {
      const formData =
        await request.formData();

      const rawTaskId =
        formData.get("taskId");

      const rawSubmissionText =
        formData.get(
          "submissionText"
        );

      const rawFile =
        formData.get("evidenceFile");

      taskId =
        typeof rawTaskId === "string"
          ? rawTaskId.trim()
          : "";

      submissionText =
        typeof rawSubmissionText ===
        "string"
          ? rawSubmissionText.trim()
          : "";

      if (
        rawFile instanceof File &&
        rawFile.size > 0
      ) {
        evidenceFile = rawFile;
      }
    } else {
      try {
        const body =
          await request.json();

        taskId =
          typeof body.taskId ===
          "string"
            ? body.taskId.trim()
            : "";

        submissionText =
          typeof body.submissionText ===
          "string"
            ? body.submissionText.trim()
            : "";
      } catch {
        return NextResponse.json(
          {
            error:
              "Invalid request body.",
          },
          { status: 400 }
        );
      }
    }

    if (!taskId) {
      return NextResponse.json(
        {
          error:
            "Task ID is required.",
        },
        { status: 400 }
      );
    }

    if (
      !submissionText &&
      !evidenceFile
    ) {
      return NextResponse.json(
        {
          error:
            "Please enter practical work or attach an evidence file before submitting.",
        },
        { status: 400 }
      );
    }

    if (
      submissionText.length > 50000
    ) {
      return NextResponse.json(
        {
          error:
            "Your submission is too long. Maximum length is 50,000 characters.",
        },
        { status: 400 }
      );
    }

    if (evidenceFile) {
      if (
        evidenceFile.size >
        MAX_FILE_SIZE
      ) {
        return NextResponse.json(
          {
            error:
              "Evidence file is too large. Maximum file size is 10 MB.",
          },
          { status: 400 }
        );
      }

      if (
        !isAllowedFileType(
          evidenceFile
        )
      ) {
        return NextResponse.json(
          {
            error:
              "This file type is not supported. Upload PDF, Word, Excel, PowerPoint, CSV, TXT, JPG, PNG, or WEBP.",
          },
          { status: 400 }
        );
      }
    }

    const {
      data: taskData,
      error: taskError,
    } = await supabase
      .from("course_practical_tasks")
      .select(
        `
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
        `
      )
      .eq("id", taskId)
      .eq("is_published", true)
      .maybeSingle();

    if (taskError) {
      console.error(
        "Practical task lookup error:",
        taskError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify the practical task.",
        },
        { status: 500 }
      );
    }

    const task =
      taskData as unknown as PracticalTask | null;

    if (!task) {
      return NextResponse.json(
        {
          error:
            "Practical task not found or is not currently available.",
        },
        { status: 404 }
      );
    }

    if (
      evidenceFile &&
      !submissionTypeAllowsFile(
        task.submission_type,
        evidenceFile
      )
    ) {
      return NextResponse.json(
        {
          error:
            `This task expects ${task.submission_type} evidence. The selected file is not compatible with that submission type.`,
        },
        { status: 400 }
      );
    }

    const {
      data: enrollment,
      error: enrollmentError,
    } = await supabase
      .from("enrollments")
      .select(
        "id, enrollment_status"
      )
      .eq("student_id", user.id)
      .eq(
        "course_id",
        task.course_id
      )
      .in("enrollment_status", [
        "active",
        "completed",
      ])
      .maybeSingle();

    if (enrollmentError) {
      console.error(
        "Practical work enrollment verification error:",
        enrollmentError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify your course enrollment.",
        },
        { status: 500 }
      );
    }

    if (!enrollment) {
      return NextResponse.json(
        {
          error:
            "You must be enrolled in this course before submitting practical work.",
        },
        { status: 403 }
      );
    }

    const {
      data: existingData,
      error: existingError,
    } = await supabase
      .from(
        "student_practical_task_submissions"
      )
      .select(
        `
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
          evidence_recorded_at
        `
      )
      .eq(
        "task_id",
        task.id
      )
      .eq(
        "student_id",
        user.id
      )
      .maybeSingle();

    if (existingError) {
      console.error(
        "Existing practical submission lookup error:",
        existingError
      );

      return NextResponse.json(
        {
          error:
            "Unable to check your previous submission.",
        },
        { status: 500 }
      );
    }

    const existingSubmission =
      existingData as unknown as PracticalSubmission | null;

    if (
      existingSubmission?.status ===
        "approved" ||
      existingSubmission?.status ===
        "under_review"
    ) {
      return NextResponse.json(
        {
          error:
            "This practical task cannot be resubmitted while the current submission is approved or under review.",
        },
        { status: 409 }
      );
    }

    let evidencePath =
      existingSubmission?.evidence_file_path ??
      null;

    let evidenceName =
      existingSubmission?.evidence_file_name ??
      null;

    let evidenceType =
      existingSubmission?.evidence_file_type ??
      null;

    let evidenceSize =
      existingSubmission?.evidence_file_size ??
      null;

    if (evidenceFile) {
      const safeName =
        getSafeFileName(
          evidenceFile.name
        );

      const extension =
        extensionForFile(
          evidenceFile
        );

      const uniqueName =
        `${crypto.randomUUID()}.${extension}`;

      const path =
        `${user.id}/${task.id}/${uniqueName}`;

      const {
        error: uploadError,
      } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(
          path,
          evidenceFile,
          {
            contentType:
              evidenceFile.type ||
              "application/octet-stream",
            upsert: false,
          }
        );

      if (uploadError) {
        console.error(
          "Practical evidence upload error:",
          uploadError
        );

        return NextResponse.json(
          {
            error:
              "Unable to upload your evidence file.",
          },
          { status: 500 }
        );
      }

      uploadedFilePath =
        path;

      evidencePath = path;
      evidenceName = safeName;
      evidenceType =
        evidenceFile.type ||
        "application/octet-stream";
      evidenceSize =
        evidenceFile.size;
    }

    const now =
      new Date().toISOString();

    const {
      data: savedData,
      error: saveError,
    } = await supabase
      .from(
        "student_practical_task_submissions"
      )
      .upsert(
        {
          task_id: task.id,
          student_id: user.id,
          submission_text:
            submissionText ||
            null,
          status: "submitted",
          score: null,
          reviewer_feedback:
            null,
          submitted_at: now,
          reviewed_at: null,
          evidence_file_path:
            evidencePath,
          evidence_file_name:
            evidenceName,
          evidence_file_type:
            evidenceType,
          evidence_file_size:
            evidenceSize,
        },
        {
          onConflict:
            "task_id,student_id",
        }
      )
      .select(
        `
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
          evidence_recorded_at
        `
      )
      .single();

    if (saveError) {
      console.error(
        "Practical submission save error:",
        saveError
      );

      if (uploadedFilePath) {
        await supabase.storage
          .from(
            STORAGE_BUCKET
          )
          .remove([
            uploadedFilePath,
          ]);
      }

      return NextResponse.json(
        {
          error:
            "Unable to submit your practical work.",
        },
        { status: 500 }
      );
    }

    /*
     * If the learner replaced an older evidence file,
     * remove the old object only after the database
     * submission has been saved successfully.
     */
    if (
      evidenceFile &&
      existingSubmission?.evidence_file_path &&
      existingSubmission
        .evidence_file_path !==
        uploadedFilePath
    ) {
      const {
        error:
          oldFileDeleteError,
      } = await supabase.storage
        .from(
          STORAGE_BUCKET
        )
        .remove([
          existingSubmission.evidence_file_path,
        ]);

      if (oldFileDeleteError) {
        console.error(
          "Previous practical evidence cleanup error:",
          oldFileDeleteError
        );
      }
    }

    const submission =
      savedData as unknown as PracticalSubmission;

    const evidenceFileUrl =
      await createEvidenceSignedUrl(
        supabase,
        submission.evidence_file_path
      );

    return NextResponse.json({
      success: true,
      submission: {
        ...submission,
        evidence_file_url:
          evidenceFileUrl,
      },
    });
  } catch (error) {
    console.error(
      "Practical work POST error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "An unexpected error occurred while submitting practical work.",
      },
      { status: 500 }
    );
  }
}