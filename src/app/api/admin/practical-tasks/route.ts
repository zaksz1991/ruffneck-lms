import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Role = "admin" | "instructor";

type CourseRow = {
  id: string;
  title?: string;
  instructor_id: string | null;
};

type SkillRow = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
};

type PracticalTaskRow = {
  id: string;
  course_id: string;
  title: string;
  scenario: string;
  instructions: string;
  expected_outcome: string | null;
  submission_type: string;
  max_score: number;
  sort_order: number;
  is_published: boolean;
  skill_id: string | null;
  created_at: string;
  updated_at: string;
};

type SubmissionType =
  | "text"
  | "document"
  | "spreadsheet"
  | "presentation"
  | "mixed";

type RequestBody = Record<string, unknown>;

type ReviewerContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: { id: string } | null;
  role: Role | null;
  lookupError: boolean;
};

const SUBMISSION_TYPES: SubmissionType[] = [
  "text",
  "document",
  "spreadsheet",
  "presentation",
  "mixed",
];

function jsonError(
  message: string,
  status = 400,
) {
  return NextResponse.json(
    { error: message },
    { status },
  );
}

function hasOwn(
  object: Record<string, unknown>,
  key: string,
): boolean {
  return Object.prototype.hasOwnProperty.call(
    object,
    key,
  );
}

function cleanString(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function parseNumber(
  value: unknown,
  fallback: number,
): number {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  if (
    typeof value !== "number" &&
    typeof value !== "string"
  ) {
    return Number.NaN;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : Number.NaN;
}

function isSubmissionType(
  value: string,
): value is SubmissionType {
  return SUBMISSION_TYPES.includes(
    value as SubmissionType,
  );
}

async function readRequestBody(
  request: Request,
): Promise<RequestBody | null> {
  try {
    const value: unknown = await request.json();

    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      return null;
    }

    return value as RequestBody;
  } catch {
    return null;
  }
}

async function getReviewerContext(): Promise<ReviewerContext> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error(
      "Practical task authentication lookup failed:",
      authError.message,
    );

    return {
      supabase,
      user: null,
      role: null,
      lookupError: true,
    };
  }

  if (!user) {
    return {
      supabase,
      user: null,
      role: null,
      lookupError: false,
    };
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error(
      "Practical task reviewer lookup failed:",
      profileError.message,
    );

    return {
      supabase,
      user,
      role: null,
      lookupError: true,
    };
  }

  const role: Role | null =
    profile?.role === "admin" ||
    profile?.role === "instructor"
      ? profile.role
      : null;

  return {
    supabase,
    user,
    role,
    lookupError: false,
  };
}

function authorizeReviewer(
  context: ReviewerContext,
): NextResponse | null {
  if (context.lookupError) {
    return jsonError(
      "Unable to verify your account permissions.",
      500,
    );
  }

  if (!context.user) {
    return jsonError(
      "Authentication required.",
      401,
    );
  }

  if (!context.role) {
    return jsonError(
      "Admin or instructor access required.",
      403,
    );
  }

  return null;
}

async function canManageCourse(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  role: Role,
  courseId: string,
): Promise<{
  allowed: boolean;
  exists: boolean;
  error: string | null;
}> {
  const {
    data: course,
    error,
  } = await supabase
    .from("courses")
    .select("id, instructor_id")
    .eq("id", courseId)
    .maybeSingle();

  if (error) {
    console.error(
      "Practical task course lookup failed:",
      error.message,
    );

    return {
      allowed: false,
      exists: false,
      error: "Unable to verify the course.",
    };
  }

  if (!course) {
    return {
      allowed: false,
      exists: false,
      error: null,
    };
  }

  if (role === "admin") {
    return {
      allowed: true,
      exists: true,
      error: null,
    };
  }

  return {
    allowed: course.instructor_id === userId,
    exists: true,
    error: null,
  };
}

async function validateSkill(
  supabase: Awaited<ReturnType<typeof createClient>>,
  skillId: string | null,
): Promise<{
  valid: boolean;
  error: string | null;
}> {
  if (!skillId) {
    return {
      valid: true,
      error: null,
    };
  }

  const {
    data: skill,
    error,
  } = await supabase
    .from("learning_skills")
    .select("id")
    .eq("id", skillId)
    .maybeSingle();

  if (error) {
    console.error(
      "Practical task skill validation failed:",
      error.message,
    );

    return {
      valid: false,
      error: "Unable to validate the selected skill.",
    };
  }

  return {
    valid: Boolean(skill),
    error: null,
  };
}

function validateTaskFields(
  body: RequestBody,
): {
  error: string | null;
  values: {
    courseId: string;
    title: string;
    scenario: string;
    instructions: string;
    expectedOutcome: string | null;
    submissionType: SubmissionType;
    maxScore: number;
    sortOrder: number;
    isPublished: boolean;
    skillId: string | null;
  };
} {
  const courseId = cleanString(body.course_id);
  const title = cleanString(body.title);
  const scenario = cleanString(body.scenario);
  const instructions = cleanString(body.instructions);

  const expectedOutcome =
    cleanString(body.expected_outcome) || null;

  const rawSubmissionType =
    cleanString(body.submission_type) || "text";

  const maxScore = parseNumber(
    body.max_score,
    100,
  );

  const sortOrder = parseNumber(
    body.sort_order,
    0,
  );

  const isPublished =
    body.is_published === true;

  const skillId =
    cleanString(body.skill_id) || null;

  if (!courseId) {
    return {
      error: "Course is required.",
      values: {} as never,
    };
  }

  if (!title) {
    return {
      error: "Task title is required.",
      values: {} as never,
    };
  }

  if (!scenario) {
    return {
      error: "Scenario is required.",
      values: {} as never,
    };
  }

  if (!instructions) {
    return {
      error: "Task instructions are required.",
      values: {} as never,
    };
  }

  if (!isSubmissionType(rawSubmissionType)) {
    return {
      error: "Invalid submission type.",
      values: {} as never,
    };
  }

  if (
    !Number.isFinite(maxScore) ||
    maxScore <= 0
  ) {
    return {
      error: "Maximum score must be greater than zero.",
      values: {} as never,
    };
  }

  if (
    !Number.isFinite(sortOrder) ||
    !Number.isInteger(sortOrder) ||
    sortOrder < 0
  ) {
    return {
      error: "Sort order must be a non-negative whole number.",
      values: {} as never,
    };
  }

  if (
    body.is_published !== undefined &&
    typeof body.is_published !== "boolean"
  ) {
    return {
      error: "Publication status must be true or false.",
      values: {} as never,
    };
  }

  return {
    error: null,
    values: {
      courseId,
      title,
      scenario,
      instructions,
      expectedOutcome,
      submissionType: rawSubmissionType,
      maxScore,
      sortOrder,
      isPublished,
      skillId,
    },
  };
}

const TASK_SELECT = [
  "id",
  "course_id",
  "title",
  "scenario",
  "instructions",
  "expected_outcome",
  "submission_type",
  "max_score",
  "sort_order",
  "is_published",
  "skill_id",
  "created_at",
  "updated_at",
].join(", ");

export async function GET() {
  try {
    const context = await getReviewerContext();

    const authResponse =
      authorizeReviewer(context);

    if (authResponse) {
      return authResponse;
    }

    const { supabase, user, role } = context;

    if (!user || !role) {
      return jsonError(
        "Unable to verify reviewer permissions.",
        500,
      );
    }

    const {
      data: taskData,
      error: taskError,
    } = await supabase
      .from("course_practical_tasks")
      .select(TASK_SELECT)
      .order("course_id")
      .order("sort_order");

    if (taskError) {
      console.error(
        "Practical task listing failed:",
        taskError.message,
      );

      return jsonError(
        "Unable to load practical tasks.",
        500,
      );
    }

    const tasks =
      (taskData ?? []) as unknown as PracticalTaskRow[];

    let visibleTasks = tasks;

    if (role === "instructor") {
      const courseIds = Array.from(
        new Set(
          tasks.map((task) => task.course_id),
        ),
      );

      if (courseIds.length === 0) {
        return NextResponse.json({
          tasks: [],
          skills: [],
        });
      }

      const {
        data: courseData,
        error: courseError,
      } = await supabase
        .from("courses")
        .select("id, title, instructor_id")
        .in("id", courseIds);

      if (courseError) {
        console.error(
          "Instructor course lookup failed:",
          courseError.message,
        );

        return jsonError(
          "Unable to verify course ownership.",
          500,
        );
      }

      const courses =
        (courseData ?? []) as CourseRow[];

      const ownedCourseIds = new Set(
        courses
          .filter(
            (course) =>
              course.instructor_id === user.id,
          )
          .map((course) => course.id),
      );

      visibleTasks = tasks.filter(
        (task) =>
          ownedCourseIds.has(task.course_id),
      );
    }

    const {
      data: skillData,
      error: skillError,
    } = await supabase
      .from("learning_skills")
      .select("id, name, slug, category")
      .order("category")
      .order("name");

    if (skillError) {
      console.error(
        "Practical task skill listing failed:",
        skillError.message,
      );

      return jsonError(
        "Unable to load the skill catalogue.",
        500,
      );
    }

    const skills =
      (skillData ?? []) as SkillRow[];

    return NextResponse.json({
      tasks: visibleTasks,
      skills,
    });
  } catch (error) {
    console.error(
      "Practical task GET failed:",
      error,
    );

    return jsonError(
      "An unexpected error occurred while loading practical tasks.",
      500,
    );
  }
}

export async function POST(request: Request) {
  try {
    const context = await getReviewerContext();

    const authResponse =
      authorizeReviewer(context);

    if (authResponse) {
      return authResponse;
    }

    const { supabase, user, role } = context;

    if (!user || !role) {
      return jsonError(
        "Unable to verify reviewer permissions.",
        500,
      );
    }

    const body = await readRequestBody(request);

    if (!body) {
      return jsonError(
        "A valid JSON object is required.",
      );
    }

    const validation = validateTaskFields(body);

    if (validation.error) {
      return jsonError(validation.error);
    }

    const values = validation.values;

    const courseAccess = await canManageCourse(
      supabase,
      user.id,
      role,
      values.courseId,
    );

    if (courseAccess.error) {
      return jsonError(
        courseAccess.error,
        500,
      );
    }

    if (!courseAccess.exists) {
      return jsonError(
        "The selected course was not found.",
        404,
      );
    }

    if (!courseAccess.allowed) {
      return jsonError(
        "You are not authorised to manage this course.",
        403,
      );
    }

    const skillValidation = await validateSkill(
      supabase,
      values.skillId,
    );

    if (skillValidation.error) {
      return jsonError(
        skillValidation.error,
        500,
      );
    }

    if (!skillValidation.valid) {
      return jsonError(
        "The selected skill does not exist.",
        400,
      );
    }

    const {
      data,
      error,
    } = await supabase
      .from("course_practical_tasks")
      .insert({
        course_id: values.courseId,
        title: values.title,
        scenario: values.scenario,
        instructions: values.instructions,
        expected_outcome: values.expectedOutcome,
        submission_type: values.submissionType,
        max_score: values.maxScore,
        sort_order: values.sortOrder,
        is_published: values.isPublished,
        skill_id: values.skillId,
      })
      .select(TASK_SELECT)
      .single();

    if (error) {
      console.error(
        "Practical task creation failed:",
        error.message,
      );

      return jsonError(
        "Unable to create practical task.",
        500,
      );
    }

    return NextResponse.json(
      { task: data },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "Practical task POST failed:",
      error,
    );

    return jsonError(
      "An unexpected error occurred while creating the practical task.",
      500,
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await getReviewerContext();

    const authResponse =
      authorizeReviewer(context);

    if (authResponse) {
      return authResponse;
    }

    const { supabase, user, role } = context;

    if (!user || !role) {
      return jsonError(
        "Unable to verify reviewer permissions.",
        500,
      );
    }

    const body = await readRequestBody(request);

    if (!body) {
      return jsonError(
        "A valid JSON object is required.",
      );
    }

    const id = cleanString(body.id);

    if (!id) {
      return jsonError(
        "Task ID is required.",
      );
    }

    const {
      data: existing,
      error: existingError,
    } = await supabase
      .from("course_practical_tasks")
      .select("id, course_id")
      .eq("id", id)
      .maybeSingle();

    if (existingError) {
      console.error(
        "Practical task lookup failed:",
        existingError.message,
      );

      return jsonError(
        "Unable to load the practical task.",
        500,
      );
    }

    if (!existing) {
      return jsonError(
        "Practical task not found.",
        404,
      );
    }

    const originalAccess = await canManageCourse(
      supabase,
      user.id,
      role,
      existing.course_id,
    );

    if (originalAccess.error) {
      return jsonError(
        originalAccess.error,
        500,
      );
    }

    if (!originalAccess.allowed) {
      return jsonError(
        "You are not authorised to manage this task.",
        403,
      );
    }

    const update: Record<string, unknown> = {};

    if (hasOwn(body, "course_id")) {
      const courseId = cleanString(body.course_id);

      if (!courseId) {
        return jsonError(
          "Course is required.",
        );
      }

      const targetAccess = await canManageCourse(
        supabase,
        user.id,
        role,
        courseId,
      );

      if (targetAccess.error) {
        return jsonError(
          targetAccess.error,
          500,
        );
      }

      if (!targetAccess.exists) {
        return jsonError(
          "The selected course was not found.",
          404,
        );
      }

      if (!targetAccess.allowed) {
        return jsonError(
          "You are not authorised to move this task to that course.",
          403,
        );
      }

      update.course_id = courseId;
    }

    if (hasOwn(body, "title")) {
      const title = cleanString(body.title);

      if (!title) {
        return jsonError(
          "Task title is required.",
        );
      }

      update.title = title;
    }

    if (hasOwn(body, "scenario")) {
      const scenario = cleanString(body.scenario);

      if (!scenario) {
        return jsonError(
          "Scenario is required.",
        );
      }

      update.scenario = scenario;
    }

    if (hasOwn(body, "instructions")) {
      const instructions = cleanString(
        body.instructions,
      );

      if (!instructions) {
        return jsonError(
          "Task instructions are required.",
        );
      }

      update.instructions = instructions;
    }

    if (hasOwn(body, "expected_outcome")) {
      update.expected_outcome =
        cleanString(body.expected_outcome) || null;
    }

    if (hasOwn(body, "submission_type")) {
      const submissionType = cleanString(
        body.submission_type,
      );

      if (!isSubmissionType(submissionType)) {
        return jsonError(
          "Invalid submission type.",
        );
      }

      update.submission_type = submissionType;
    }

    if (hasOwn(body, "max_score")) {
      const maxScore = parseNumber(
        body.max_score,
        Number.NaN,
      );

      if (
        !Number.isFinite(maxScore) ||
        maxScore <= 0
      ) {
        return jsonError(
          "Maximum score must be greater than zero.",
        );
      }

      update.max_score = maxScore;
    }

    if (hasOwn(body, "sort_order")) {
      const sortOrder = parseNumber(
        body.sort_order,
        Number.NaN,
      );

      if (
        !Number.isFinite(sortOrder) ||
        !Number.isInteger(sortOrder) ||
        sortOrder < 0
      ) {
        return jsonError(
          "Sort order must be a non-negative whole number.",
        );
      }

      update.sort_order = sortOrder;
    }

    if (hasOwn(body, "is_published")) {
      if (typeof body.is_published !== "boolean") {
        return jsonError(
          "Publication status must be true or false.",
        );
      }

      update.is_published = body.is_published;
    }

    if (hasOwn(body, "skill_id")) {
      const skillId =
        cleanString(body.skill_id) || null;

      const skillValidation = await validateSkill(
        supabase,
        skillId,
      );

      if (skillValidation.error) {
        return jsonError(
          skillValidation.error,
          500,
        );
      }

      if (!skillValidation.valid) {
        return jsonError(
          "The selected skill does not exist.",
        );
      }

      update.skill_id = skillId;
    }

    if (Object.keys(update).length === 0) {
      return jsonError(
        "No changes supplied.",
      );
    }

    const {
      data,
      error,
    } = await supabase
      .from("course_practical_tasks")
      .update(update)
      .eq("id", id)
      .select(TASK_SELECT)
      .single();

    if (error) {
      console.error(
        "Practical task update failed:",
        error.message,
      );

      return jsonError(
        "Unable to update practical task.",
        500,
      );
    }

    return NextResponse.json({
      task: data,
    });
  } catch (error) {
    console.error(
      "Practical task PATCH failed:",
      error,
    );

    return jsonError(
      "An unexpected error occurred while updating the practical task.",
      500,
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await getReviewerContext();

    const authResponse =
      authorizeReviewer(context);

    if (authResponse) {
      return authResponse;
    }

    const { supabase, user, role } = context;

    if (!user || !role) {
      return jsonError(
        "Unable to verify reviewer permissions.",
        500,
      );
    }

    const body = await readRequestBody(request);

    if (!body) {
      return jsonError(
        "A valid JSON object is required.",
      );
    }

    const id = cleanString(body.id);

    if (!id) {
      return jsonError(
        "Task ID is required.",
      );
    }

    const {
      data: existing,
      error: existingError,
    } = await supabase
      .from("course_practical_tasks")
      .select("id, course_id")
      .eq("id", id)
      .maybeSingle();

    if (existingError) {
      console.error(
        "Practical task deletion lookup failed:",
        existingError.message,
      );

      return jsonError(
        "Unable to load the practical task.",
        500,
      );
    }

    if (!existing) {
      return jsonError(
        "Practical task not found.",
        404,
      );
    }

    const access = await canManageCourse(
      supabase,
      user.id,
      role,
      existing.course_id,
    );

    if (access.error) {
      return jsonError(
        access.error,
        500,
      );
    }

    if (!access.allowed) {
      return jsonError(
        "You are not authorised to delete this task.",
        403,
      );
    }

    const { error: deleteError } = await supabase
      .from("course_practical_tasks")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error(
        "Practical task deletion failed:",
        deleteError.message,
      );

      return jsonError(
        "Unable to delete practical task. It may have existing submissions that prevent deletion.",
        409,
      );
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error(
      "Practical task DELETE failed:",
      error,
    );

    return jsonError(
      "An unexpected error occurred while deleting the practical task.",
      500,
    );
  }
}