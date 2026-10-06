import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Role = "admin" | "instructor";

type CourseRow = {
  id: string;
  title: string;
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

const SUBMISSION_TYPES = [
  "text",
  "document",
  "spreadsheet",
  "presentation",
  "mixed",
] as const;

type SubmissionType =
  (typeof SUBMISSION_TYPES)[number];

function cleanString(
  value: unknown,
): string {
  return String(value ?? "").trim();
}

function parseNumber(
  value: unknown,
  fallback: number,
): number {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

async function getReviewerContext() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      supabase,
      user: null,
      role: null as Role | null,
    };
  }

  const { data: profile } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

  const role =
    profile?.role === "admin" ||
    profile?.role === "instructor"
      ? (profile.role as Role)
      : null;

  return {
    supabase,
    user,
    role,
  };
}

async function canManageCourse(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >,
  userId: string,
  role: Role,
  courseId: string,
) {
  if (role === "admin") {
    return true;
  }

  const { data: courseData } =
    await supabase
      .from("courses")
      .select("id, instructor_id")
      .eq("id", courseId)
      .maybeSingle();

  const course =
    courseData as CourseRow | null;

  return (
    course?.instructor_id === userId
  );
}

async function validateSkill(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >,
  skillId: string | null,
) {
  if (!skillId) {
    return {
      valid: true,
      skill: null as SkillRow | null,
    };
  }

  const { data, error } =
    await supabase
      .from("learning_skills")
      .select(
        "id, name, slug, category",
      )
      .eq("id", skillId)
      .maybeSingle();

  if (error) {
    return {
      valid: false,
      skill: null,
    };
  }

  return {
    valid: Boolean(data),
    skill:
      (data as SkillRow | null) ??
      null,
  };
}

export async function GET() {
  const {
    supabase,
    user,
    role,
  } = await getReviewerContext();

  if (!user) {
    return NextResponse.json(
      {
        error: "Authentication required.",
      },
      { status: 401 },
    );
  }

  if (!role) {
    return NextResponse.json(
      {
        error:
          "Admin or instructor access required.",
      },
      { status: 403 },
    );
  }

  const { data: taskData, error } =
    await supabase
      .from("course_practical_tasks")
      .select(
        [
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
        ].join(", "),
      )
      .order("course_id")
      .order("sort_order");

  if (error) {
    return NextResponse.json(
      {
        error:
          "Unable to load practical tasks.",
        details: error.message,
      },
      { status: 500 },
    );
  }

  const tasks =
    (taskData ?? []) as unknown as PracticalTaskRow[];

  let visibleTasks = tasks;

  if (role === "instructor") {
    const courseIds = [
      ...new Set(
        tasks.map(
          (task) => task.course_id,
        ),
      ),
    ];

    if (courseIds.length === 0) {
      return NextResponse.json({
        tasks: [],
        skills: [],
      });
    }

    const { data: courseData } =
      await supabase
        .from("courses")
        .select(
          "id, title, instructor_id",
        )
        .in("id", courseIds);

    const courses =
      (courseData ?? []) as unknown as CourseRow[];

    const ownedCourseIds = new Set(
      courses
        .filter(
          (course) =>
            course.instructor_id ===
            user.id,
        )
        .map((course) => course.id),
    );

    visibleTasks = tasks.filter(
      (task) =>
        ownedCourseIds.has(
          task.course_id,
        ),
    );
  }

  const { data: skillData } =
    await supabase
      .from("learning_skills")
      .select(
        "id, name, slug, category",
      )
      .order("category")
      .order("name");

  const skills =
    (skillData ?? []) as unknown as SkillRow[];

  return NextResponse.json({
    tasks: visibleTasks,
    skills,
  });
}

export async function POST(
  request: Request,
) {
  const {
    supabase,
    user,
    role,
  } = await getReviewerContext();

  if (!user) {
    return NextResponse.json(
      {
        error: "Authentication required.",
      },
      { status: 401 },
    );
  }

  if (!role) {
    return NextResponse.json(
      {
        error:
          "Admin or instructor access required.",
      },
      { status: 403 },
    );
  }

  let body: Record<
    string,
    unknown
  >;

  try {
    body = (await request.json()) as Record<
      string,
      unknown
    >;
  } catch {
    return NextResponse.json(
      {
        error: "Invalid request body.",
      },
      { status: 400 },
    );
  }

  const courseId = cleanString(
    body.course_id,
  );
  const title = cleanString(body.title);
  const scenario = cleanString(
    body.scenario,
  );
  const instructions = cleanString(
    body.instructions,
  );
  const expectedOutcome =
    cleanString(body.expected_outcome) ||
    null;

  const submissionType =
    cleanString(body.submission_type) ||
    "text";

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
    return NextResponse.json(
      {
        error: "Course is required.",
      },
      { status: 400 },
    );
  }

  if (!title) {
    return NextResponse.json(
      {
        error: "Task title is required.",
      },
      { status: 400 },
    );
  }

  if (!scenario) {
    return NextResponse.json(
      {
        error: "Scenario is required.",
      },
      { status: 400 },
    );
  }

  if (!instructions) {
    return NextResponse.json(
      {
        error:
          "Task instructions are required.",
      },
      { status: 400 },
    );
  }

  if (
    !SUBMISSION_TYPES.includes(
      submissionType as SubmissionType,
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid submission type.",
      },
      { status: 400 },
    );
  }

  if (
    !Number.isFinite(maxScore) ||
    maxScore <= 0
  ) {
    return NextResponse.json(
      {
        error:
          "Maximum score must be greater than zero.",
      },
      { status: 400 },
    );
  }

  const allowed =
    await canManageCourse(
      supabase,
      user.id,
      role,
      courseId,
    );

  if (!allowed) {
    return NextResponse.json(
      {
        error:
          "You are not authorised to manage this course.",
      },
      { status: 403 },
    );
  }

  const skillValidation =
    await validateSkill(
      supabase,
      skillId,
    );

  if (!skillValidation.valid) {
    return NextResponse.json(
      {
        error:
          "The selected skill does not exist.",
      },
      { status: 400 },
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
        submission_type:
          submissionType,
        max_score: maxScore,
        sort_order: sortOrder,
        is_published: isPublished,
        skill_id: skillId,
      })
      .select(
        [
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
        ].join(", "),
      )
      .single();

  if (error) {
    return NextResponse.json(
      {
        error:
          "Unable to create practical task.",
        details: error.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
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
    role,
  } = await getReviewerContext();

  if (!user) {
    return NextResponse.json(
      {
        error: "Authentication required.",
      },
      { status: 401 },
    );
  }

  if (!role) {
    return NextResponse.json(
      {
        error:
          "Admin or instructor access required.",
      },
      { status: 403 },
    );
  }

  let body: Record<
    string,
    unknown
  >;

  try {
    body = (await request.json()) as Record<
      string,
      unknown
    >;
  } catch {
    return NextResponse.json(
      {
        error: "Invalid request body.",
      },
      { status: 400 },
    );
  }

  const id = cleanString(body.id);

  if (!id) {
    return NextResponse.json(
      {
        error: "Task ID is required.",
      },
      { status: 400 },
    );
  }

  const { data: existingData } =
    await supabase
      .from("course_practical_tasks")
      .select("id, course_id")
      .eq("id", id)
      .maybeSingle();

  const existing =
    existingData as {
      id: string;
      course_id: string;
    } | null;

  if (!existing) {
    return NextResponse.json(
      {
        error: "Practical task not found.",
      },
      { status: 404 },
    );
  }

  const allowed =
    await canManageCourse(
      supabase,
      user.id,
      role,
      existing.course_id,
    );

  if (!allowed) {
    return NextResponse.json(
      {
        error:
          "You are not authorised to manage this task.",
      },
      { status: 403 },
    );
  }

  const update: Record<
    string,
    unknown
  > = {};

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "course_id",
    )
  ) {
    const courseId = cleanString(
      body.course_id,
    );

    if (!courseId) {
      return NextResponse.json(
        {
          error: "Course is required.",
        },
        { status: 400 },
      );
    }

    const courseAllowed =
      await canManageCourse(
        supabase,
        user.id,
        role,
        courseId,
      );

    if (!courseAllowed) {
      return NextResponse.json(
        {
          error:
            "You are not authorised to use that course.",
        },
        { status: 403 },
      );
    }

    update.course_id = courseId;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "title",
    )
  ) {
    const title = cleanString(
      body.title,
    );

    if (!title) {
      return NextResponse.json(
        {
          error:
            "Task title is required.",
        },
        { status: 400 },
      );
    }

    update.title = title;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "scenario",
    )
  ) {
    const scenario = cleanString(
      body.scenario,
    );

    if (!scenario) {
      return NextResponse.json(
        {
          error: "Scenario is required.",
        },
        { status: 400 },
      );
    }

    update.scenario = scenario;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "instructions",
    )
  ) {
    const instructions =
      cleanString(body.instructions);

    if (!instructions) {
      return NextResponse.json(
        {
          error:
            "Task instructions are required.",
        },
        { status: 400 },
      );
    }

    update.instructions = instructions;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "expected_outcome",
    )
  ) {
    update.expected_outcome =
      cleanString(
        body.expected_outcome,
      ) || null;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "submission_type",
    )
  ) {
    const submissionType =
      cleanString(
        body.submission_type,
      );

    if (
      !SUBMISSION_TYPES.includes(
        submissionType as SubmissionType,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid submission type.",
        },
        { status: 400 },
      );
    }

    update.submission_type =
      submissionType;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "max_score",
    )
  ) {
    const maxScore = parseNumber(
      body.max_score,
      NaN,
    );

    if (
      !Number.isFinite(maxScore) ||
      maxScore <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Maximum score must be greater than zero.",
        },
        { status: 400 },
      );
    }

    update.max_score = maxScore;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "sort_order",
    )
  ) {
    const sortOrder = parseNumber(
      body.sort_order,
      NaN,
    );

    if (!Number.isFinite(sortOrder)) {
      return NextResponse.json(
        {
          error:
            "Sort order must be a number.",
        },
        { status: 400 },
      );
    }

    update.sort_order = sortOrder;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "is_published",
    )
  ) {
    update.is_published =
      body.is_published === true;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "skill_id",
    )
  ) {
    const skillId =
      cleanString(body.skill_id) ||
      null;

    const skillValidation =
      await validateSkill(
        supabase,
        skillId,
      );

    if (!skillValidation.valid) {
      return NextResponse.json(
        {
          error:
            "The selected skill does not exist.",
        },
        { status: 400 },
      );
    }

    update.skill_id = skillId;
  }

  if (
    Object.keys(update).length === 0
  ) {
    return NextResponse.json(
      {
        error: "No changes supplied.",
      },
      { status: 400 },
    );
  }

  const { data, error } =
    await supabase
      .from("course_practical_tasks")
      .update(update)
      .eq("id", id)
      .select(
        [
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
        ].join(", "),
      )
      .single();

  if (error) {
    return NextResponse.json(
      {
        error:
          "Unable to update practical task.",
        details: error.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    task: data,
  });
}

export async function DELETE(
  request: Request,
) {
  const {
    supabase,
    user,
    role,
  } = await getReviewerContext();

  if (!user) {
    return NextResponse.json(
      {
        error: "Authentication required.",
      },
      { status: 401 },
    );
  }

  if (!role) {
    return NextResponse.json(
      {
        error:
          "Admin or instructor access required.",
      },
      { status: 403 },
    );
  }

  let body: Record<
    string,
    unknown
  >;

  try {
    body = (await request.json()) as Record<
      string,
      unknown
    >;
  } catch {
    return NextResponse.json(
      {
        error: "Invalid request body.",
      },
      { status: 400 },
    );
  }

  const id = cleanString(body.id);

  if (!id) {
    return NextResponse.json(
      {
        error: "Task ID is required.",
      },
      { status: 400 },
    );
  }

  const { data: existingData } =
    await supabase
      .from("course_practical_tasks")
      .select("id, course_id")
      .eq("id", id)
      .maybeSingle();

  const existing =
    existingData as {
      id: string;
      course_id: string;
    } | null;

  if (!existing) {
    return NextResponse.json(
      {
        error: "Practical task not found.",
      },
      { status: 404 },
    );
  }

  const allowed =
    await canManageCourse(
      supabase,
      user.id,
      role,
      existing.course_id,
    );

  if (!allowed) {
    return NextResponse.json(
      {
        error:
          "You are not authorised to delete this task.",
      },
      { status: 403 },
    );
  }

  const { error } =
    await supabase
      .from("course_practical_tasks")
      .delete()
      .eq("id", id);

  if (error) {
    return NextResponse.json(
      {
        error:
          "Unable to delete practical task.",
        details: error.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
  });
}