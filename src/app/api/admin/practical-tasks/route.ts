import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type TaskPayload = {
  id?: string;
  course_id?: string;
  title?: string;
  scenario?: string;
  instructions?: string;
  expected_outcome?: string | null;
  submission_type?: string;
  max_score?: number;
  sort_order?: number;
  is_published?: boolean;
};

type Profile = {
  id: string;
  role: "admin" | "instructor" | "student";
};

const submissionTypes = [
  "text",
  "document",
  "spreadsheet",
  "presentation",
  "mixed",
] as const;

function errorResponse(
  message: string,
  status = 400,
) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
    },
    { status },
  );
}

async function getAuthorizedUser() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      supabase,
      user: null,
      profile: null,
    };
  }

  const { data: profile } =
    await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

  return {
    supabase,
    user,
    profile:
      (profile as Profile | null) ||
      null,
  };
}

async function canManageCourse(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >,
  userId: string,
  role: Profile["role"],
  courseId: string,
) {
  if (role === "admin") {
    return true;
  }

  if (role !== "instructor") {
    return false;
  }

  const { data: course } =
    await supabase
      .from("courses")
      .select("id")
      .eq("id", courseId)
      .eq("instructor_id", userId)
      .maybeSingle();

  return Boolean(course);
}

export async function GET() {
  const {
    supabase,
    user,
    profile,
  } = await getAuthorizedUser();

  if (!user) {
    return errorResponse(
      "Authentication required.",
      401,
    );
  }

  if (
    !profile ||
    (profile.role !== "admin" &&
      profile.role !== "instructor")
  ) {
    return errorResponse(
      "You are not authorized to manage practical tasks.",
      403,
    );
  }

  let query = supabase
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
        created_at,
        updated_at,
        courses (
          id,
          title,
          slug,
          instructor_id
        )
      `,
    )
    .order("course_id")
    .order("sort_order");

  const { data, error } = await query;

  if (error) {
    console.error(
      "Failed to load practical tasks:",
      error,
    );

    return errorResponse(
      "Unable to load practical tasks.",
      500,
    );
  }

  const tasks = (data || []).filter(
    (task) => {
      if (profile.role === "admin") {
        return true;
      }

      const course = Array.isArray(
        task.courses,
      )
        ? task.courses[0]
        : task.courses;

      return (
        course?.instructor_id ===
        user.id
      );
    },
  );

  return NextResponse.json({
    ok: true,
    tasks,
  });
}

export async function POST(
  request: Request,
) {
  const {
    supabase,
    user,
    profile,
  } = await getAuthorizedUser();

  if (!user) {
    return errorResponse(
      "Authentication required.",
      401,
    );
  }

  if (
    !profile ||
    (profile.role !== "admin" &&
      profile.role !== "instructor")
  ) {
    return errorResponse(
      "You are not authorized to manage practical tasks.",
      403,
    );
  }

  let body: TaskPayload;

  try {
    body =
      (await request.json()) as TaskPayload;
  } catch {
    return errorResponse(
      "Invalid request body.",
    );
  }

  const courseId = String(
    body.course_id || "",
  ).trim();

  const title = String(
    body.title || "",
  ).trim();

  const scenario = String(
    body.scenario || "",
  ).trim();

  const instructions = String(
    body.instructions || "",
  ).trim();

  const expectedOutcome =
    body.expected_outcome === null ||
    body.expected_outcome === undefined
      ? null
      : String(
          body.expected_outcome,
        ).trim() || null;

  const submissionType =
    String(
      body.submission_type || "text",
    ).trim();

  const maxScore = Number(
    body.max_score ?? 100,
  );

  const sortOrder = Number(
    body.sort_order ?? 0,
  );

  const isPublished =
    Boolean(body.is_published);

  if (!courseId) {
    return errorResponse(
      "Course is required.",
    );
  }

  if (!title) {
    return errorResponse(
      "Task title is required.",
    );
  }

  if (!scenario) {
    return errorResponse(
      "Workplace scenario is required.",
    );
  }

  if (!instructions) {
    return errorResponse(
      "Task instructions are required.",
    );
  }

  if (
    !submissionTypes.includes(
      submissionType as (typeof submissionTypes)[number],
    )
  ) {
    return errorResponse(
      "Invalid submission type.",
    );
  }

  if (
    !Number.isInteger(maxScore) ||
    maxScore <= 0 ||
    maxScore > 1000
  ) {
    return errorResponse(
      "Maximum score must be a positive whole number.",
    );
  }

  if (
    !Number.isInteger(sortOrder) ||
    sortOrder < 0
  ) {
    return errorResponse(
      "Sort order must be a non-negative whole number.",
    );
  }

  const authorized =
    await canManageCourse(
      supabase,
      user.id,
      profile.role,
      courseId,
    );

  if (!authorized) {
    return errorResponse(
      "You are not authorized to manage tasks for this course.",
      403,
    );
  }

  const { data, error } =
    await supabase
      .from("course_practical_tasks")
      .insert({
        course_id: courseId,
        title,
        scenario,
        instructions,
        expected_outcome: expectedOutcome,
        submission_type: submissionType,
        max_score: maxScore,
        sort_order: sortOrder,
        is_published: isPublished,
      })
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
          is_published
        `,
      )
      .single();

  if (error) {
    console.error(
      "Failed to create practical task:",
      error,
    );

    return errorResponse(
      "Unable to create practical task.",
      500,
    );
  }

  return NextResponse.json(
    {
      ok: true,
      task: data,
    },
    { status: 201 },
  );
}

export async function PATCH(
  request: Request,
) {
  const {
    supabase,
    user,
    profile,
  } = await getAuthorizedUser();

  if (!user) {
    return errorResponse(
      "Authentication required.",
      401,
    );
  }

  if (
    !profile ||
    (profile.role !== "admin" &&
      profile.role !== "instructor")
  ) {
    return errorResponse(
      "You are not authorized to manage practical tasks.",
      403,
    );
  }

  let body: TaskPayload;

  try {
    body =
      (await request.json()) as TaskPayload;
  } catch {
    return errorResponse(
      "Invalid request body.",
    );
  }

  const taskId = String(
    body.id || "",
  ).trim();

  if (!taskId) {
    return errorResponse(
      "Task ID is required.",
    );
  }

  const { data: existingTask } =
    await supabase
      .from("course_practical_tasks")
      .select("id, course_id")
      .eq("id", taskId)
      .maybeSingle();

  if (!existingTask) {
    return errorResponse(
      "Practical task not found.",
      404,
    );
  }

  const authorized =
    await canManageCourse(
      supabase,
      user.id,
      profile.role,
      existingTask.course_id,
    );

  if (!authorized) {
    return errorResponse(
      "You are not authorized to manage this task.",
      403,
    );
  }

  const updates: Record<
    string,
    unknown
  > = {
    updated_at:
      new Date().toISOString(),
  };

  if (body.title !== undefined) {
    const title = String(
      body.title,
    ).trim();

    if (!title) {
      return errorResponse(
        "Task title cannot be empty.",
      );
    }

    updates.title = title;
  }

  if (body.scenario !== undefined) {
    const scenario = String(
      body.scenario,
    ).trim();

    if (!scenario) {
      return errorResponse(
        "Workplace scenario cannot be empty.",
      );
    }

    updates.scenario = scenario;
  }

  if (
    body.instructions !== undefined
  ) {
    const instructions = String(
      body.instructions,
    ).trim();

    if (!instructions) {
      return errorResponse(
        "Task instructions cannot be empty.",
      );
    }

    updates.instructions =
      instructions;
  }

  if (
    body.expected_outcome !==
    undefined
  ) {
    updates.expected_outcome =
      body.expected_outcome
        ? String(
            body.expected_outcome,
          ).trim()
        : null;
  }

  if (
    body.submission_type !==
    undefined
  ) {
    if (
      !submissionTypes.includes(
        body.submission_type as (typeof submissionTypes)[number],
      )
    ) {
      return errorResponse(
        "Invalid submission type.",
      );
    }

    updates.submission_type =
      body.submission_type;
  }

  if (body.max_score !== undefined) {
    const maxScore = Number(
      body.max_score,
    );

    if (
      !Number.isInteger(maxScore) ||
      maxScore <= 0 ||
      maxScore > 1000
    ) {
      return errorResponse(
        "Maximum score must be a positive whole number.",
      );
    }

    updates.max_score = maxScore;
  }

  if (body.sort_order !== undefined) {
    const sortOrder = Number(
      body.sort_order,
    );

    if (
      !Number.isInteger(sortOrder) ||
      sortOrder < 0
    ) {
      return errorResponse(
        "Sort order must be a non-negative whole number.",
      );
    }

    updates.sort_order = sortOrder;
  }

  if (
    body.is_published !== undefined
  ) {
    updates.is_published =
      Boolean(body.is_published);
  }

  const { data, error } =
    await supabase
      .from("course_practical_tasks")
      .update(updates)
      .eq("id", taskId)
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
          is_published
        `,
      )
      .single();

  if (error) {
    console.error(
      "Failed to update practical task:",
      error,
    );

    return errorResponse(
      "Unable to update practical task.",
      500,
    );
  }

  return NextResponse.json({
    ok: true,
    task: data,
  });
}

export async function DELETE(
  request: Request,
) {
  const {
    supabase,
    user,
    profile,
  } = await getAuthorizedUser();

  if (!user) {
    return errorResponse(
      "Authentication required.",
      401,
    );
  }

  if (
    !profile ||
    (profile.role !== "admin" &&
      profile.role !== "instructor")
  ) {
    return errorResponse(
      "You are not authorized to manage practical tasks.",
      403,
    );
  }

  const url = new URL(
    request.url,
  );

  const taskId =
    url.searchParams.get("id")?.trim();

  if (!taskId) {
    return errorResponse(
      "Task ID is required.",
    );
  }

  const { data: task } =
    await supabase
      .from("course_practical_tasks")
      .select("id, course_id")
      .eq("id", taskId)
      .maybeSingle();

  if (!task) {
    return errorResponse(
      "Practical task not found.",
      404,
    );
  }

  const authorized =
    await canManageCourse(
      supabase,
      user.id,
      profile.role,
      task.course_id,
    );

  if (!authorized) {
    return errorResponse(
      "You are not authorized to delete this task.",
      403,
    );
  }

  const { error } =
    await supabase
      .from("course_practical_tasks")
      .delete()
      .eq("id", taskId);

  if (error) {
    console.error(
      "Failed to delete practical task:",
      error,
    );

    return errorResponse(
      "Unable to delete practical task.",
      500,
    );
  }

  return NextResponse.json({
    ok: true,
  });
}