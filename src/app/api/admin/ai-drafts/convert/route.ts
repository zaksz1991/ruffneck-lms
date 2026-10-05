import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ConvertBody = {
  id?: unknown;
};

type Profile = {
  role: "admin" | "instructor" | "student";
};

type ConversionResult = {
  success?: boolean;
  already_converted?: boolean;
  draft_id?: string;
  course_id?: string;
  course_title?: string;
  section_count?: number;
  duration_minutes?: number;
  converted_at?: string;
};

type AiSection = {
  heading?: unknown;
  content?: unknown;
  examples?: unknown;
};

type AiStudyPlanItem = {
  step?: unknown;
  action?: unknown;
};

type AiKeyConcept = {
  term?: unknown;
  explanation?: unknown;
};

type AiPracticalActivity = {
  title?: unknown;
  instructions?: unknown;
  expected_output?: unknown;
};

type LearningPack = {
  title?: unknown;
  source_summary?: unknown;
  learning_objectives?: unknown;
  prerequisites?: unknown;
  key_concepts?: unknown;
  sections?: unknown;
  practical_activity?: unknown;
  assessment_questions?: unknown;
  study_plan?: unknown;
  flashcards?: unknown;
  source_warnings?: unknown;
  estimated_duration_minutes?: unknown;
  difficulty?: unknown;
};

type LessonRecord = {
  id: string;
  title: string;
  sort_order: number | null;
  section_id: string;
};

type DraftRecord = {
  id: string;
  title: string;
  status: string;
  learning_pack: unknown;
  converted_course_id: string | null;
  converted_at: string | null;
};

function asString(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function asStringArray(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is string =>
        typeof item === "string"
    )
    .map((item) => item.trim())
    .filter(Boolean);
}

function asObject(
  value: unknown
): Record<string, unknown> {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as Record<
      string,
      unknown
    >;
  }

  return {};
}

function asObjectArray(
  value: unknown
): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (
      item
    ): item is Record<string, unknown> =>
      Boolean(item) &&
      typeof item === "object" &&
      !Array.isArray(item)
  );
}

function isConversionResult(
  value: unknown
): value is ConversionResult {
  return (
    typeof value === "object" &&
    value !== null
  );
}

function normalizeAnswer(
  value: string
): string {
  return value.trim().toLowerCase();
}

function escapeHtml(
  value: string
): string {
  return value
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#39;"
    );
}

function textToParagraphs(
  value: string
): string {
  const paragraphs =
    value
      .split(/\n\s*\n/)
      .map((part) =>
        part
          .replace(/\r/g, "")
          .trim()
      )
      .filter(Boolean);

  if (paragraphs.length === 0) {
    return "";
  }

  return paragraphs
    .map(
      (paragraph) =>
        `<p>${escapeHtml(
          paragraph
        ).replace(
          /\n/g,
          "<br />"
        )}</p>`
    )
    .join("\n");
}

function getLearningPack(
  value: unknown
): LearningPack {
  return asObject(
    value
  ) as LearningPack;
}

function getSections(
  pack: LearningPack
): AiSection[] {
  return asObjectArray(
    pack.sections
  ) as AiSection[];
}

function getStudyPlan(
  pack: LearningPack
): AiStudyPlanItem[] {
  return asObjectArray(
    pack.study_plan
  ) as AiStudyPlanItem[];
}

function getKeyConcepts(
  pack: LearningPack
): AiKeyConcept[] {
  return asObjectArray(
    pack.key_concepts
  ) as AiKeyConcept[];
}

function getPracticalActivity(
  pack: LearningPack
): AiPracticalActivity | null {
  const value =
    asObject(
      pack.practical_activity
    );

  if (
    Object.keys(value).length ===
    0
  ) {
    return null;
  }

  return value as AiPracticalActivity;
}

function buildLessonContentHtml(
  lessonIndex: number,
  totalLessons: number,
  lesson: LessonRecord,
  pack: LearningPack
): string {
  const sections =
    getSections(pack);

  const studyPlan =
    getStudyPlan(pack);

  const keyConcepts =
    getKeyConcepts(pack);

  const practicalActivity =
    getPracticalActivity(pack);

  const section =
    sections[lessonIndex] ??
    sections[
      Math.min(
        lessonIndex,
        Math.max(
          0,
          sections.length - 1
        )
      )
    ] ??
    null;

  const planItem =
    studyPlan[lessonIndex] ??
    null;

  const heading =
    asString(
      section?.heading
    ) ||
    lesson.title;

  const action =
    asString(
      planItem?.action
    );

  const sectionContent =
    asString(
      section?.content
    );

  const examples =
    asStringArray(
      section?.examples
    );

  const learningObjectives =
    asStringArray(
      pack.learning_objectives
    );

  const prerequisites =
    asStringArray(
      pack.prerequisites
    );

  const html: string[] = [];

  html.push(
    `<h2>${escapeHtml(
      heading
    )}</h2>`
  );

  if (action) {
    html.push(
      `<p><strong>Learning focus:</strong> ${escapeHtml(
        action
      )}</p>`
    );
  }

  if (sectionContent) {
    html.push(
      textToParagraphs(
        sectionContent
      )
    );
  } else if (action) {
    html.push(
      `<p>${escapeHtml(
        action
      )}</p>`
    );
  } else {
    html.push(
      `<p>This lesson provides practical learning material for ${escapeHtml(
        lesson.title
      )}.</p>`
    );
  }

  /*
   * Put course objectives and prerequisites
   * into the first generated lesson.
   */
  if (
    lessonIndex === 0 &&
    learningObjectives.length > 0
  ) {
    html.push(
      "<h3>Learning objectives</h3>"
    );

    html.push(
      "<ul>"
    );

    for (
      const objective of learningObjectives
    ) {
      html.push(
        `<li>${escapeHtml(
          objective
        )}</li>`
      );
    }

    html.push(
      "</ul>"
    );
  }

  if (
    lessonIndex === 0 &&
    prerequisites.length > 0
  ) {
    html.push(
      "<h3>Prerequisites</h3>"
    );

    html.push(
      "<ul>"
    );

    for (
      const prerequisite of prerequisites
    ) {
      html.push(
        `<li>${escapeHtml(
          prerequisite
        )}</li>`
      );
    }

    html.push(
      "</ul>"
    );
  }

  if (
    examples.length > 0
  ) {
    html.push(
      "<h3>Practical examples</h3>"
    );

    html.push(
      "<ul>"
    );

    for (
      const example of examples
    ) {
      html.push(
        `<li>${escapeHtml(
          example
        )}</li>`
      );
    }

    html.push(
      "</ul>"
    );
  }

  /*
   * Add key concepts to the first lesson so
   * the core terminology is available inside
   * the actual course material.
   */
  if (
    lessonIndex === 0 &&
    keyConcepts.length > 0
  ) {
    html.push(
      "<h3>Key concepts</h3>"
    );

    html.push(
      "<dl>"
    );

    for (
      const concept of keyConcepts
    ) {
      const term =
        asString(
          concept.term
        );

      const explanation =
        asString(
          concept.explanation
        );

      if (!term && !explanation) {
        continue;
      }

      html.push(
        `<dt><strong>${escapeHtml(
          term ||
            "Key concept"
        )}</strong></dt>`
      );

      if (explanation) {
        html.push(
          `<dd>${escapeHtml(
            explanation
          )}</dd>`
        );
      }
    }

    html.push(
      "</dl>"
    );
  }

  /*
   * Put the practical activity in the final
   * generated lesson.
   */
  if (
    lessonIndex ===
      totalLessons - 1 &&
    practicalActivity
  ) {
    const activityTitle =
      asString(
        practicalActivity.title
      );

    const instructions =
      asString(
        practicalActivity.instructions
      );

    const expectedOutput =
      asString(
        practicalActivity.expected_output
      );

    html.push(
      "<h3>Practical activity</h3>"
    );

    if (activityTitle) {
      html.push(
        `<h4>${escapeHtml(
          activityTitle
        )}</h4>`
      );
    }

    if (instructions) {
      html.push(
        textToParagraphs(
          instructions
        )
      );
    }

    if (expectedOutput) {
      html.push(
        `<p><strong>Expected output:</strong> ${escapeHtml(
          expectedOutput
        )}</p>`
      );
    }
  }

  return html
    .filter(Boolean)
    .join("\n");
}

async function populateLessonContent(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >,
  courseId: string,
  learningPackValue: unknown
) {
  const pack =
    getLearningPack(
      learningPackValue
    );

  const {
    data: lessonData,
    error: lessonError,
  } = await supabase
    .from("lessons")
    .select(
      "id, title, sort_order, section_id"
    )
    .eq(
      "course_id",
      courseId
    )
    .order("sort_order", {
      ascending: true,
    });

  if (lessonError) {
    throw new Error(
      lessonError.message ||
        "Unable to load LMS lessons for AI content population."
    );
  }

  const lessons =
    (lessonData ??
      []) as unknown as LessonRecord[];

  if (lessons.length === 0) {
    return {
      populated: 0,
      skipped: 0,
    };
  }

  let populated = 0;
  let skipped = 0;

  for (
    let index = 0;
    index < lessons.length;
    index += 1
  ) {
    const lesson =
      lessons[index];

    const contentHtml =
      buildLessonContentHtml(
        index,
        lessons.length,
        lesson,
        pack
      );

    if (!contentHtml.trim()) {
      skipped += 1;
      continue;
    }

    /*
     * Only populate an empty lesson. This prevents
     * later synchronization from overwriting content
     * an admin has manually edited.
     */
    const {
      data: existingLesson,
      error: existingError,
    } = await supabase
      .from("lessons")
      .select(
        "id, content_html"
      )
      .eq(
        "id",
        lesson.id
      )
      .eq(
        "course_id",
        courseId
      )
      .maybeSingle();

    if (existingError) {
      throw new Error(
        existingError.message ||
          "Unable to inspect LMS lesson content."
      );
    }

    const existingContent =
      asString(
        existingLesson?.content_html
      );

    if (existingContent) {
      skipped += 1;
      continue;
    }

    const {
      error: updateError,
    } = await supabase
      .from("lessons")
      .update({
        content_html:
          contentHtml,
      })
      .eq(
        "id",
        lesson.id
      )
      .eq(
        "course_id",
        courseId
      );

    if (updateError) {
      throw new Error(
        updateError.message ||
          `Unable to populate lesson ${index + 1}.`
      );
    }

    populated += 1;
  }

  return {
    populated,
    skipped,
  };
}

async function importAssessmentQuestions(
  supabase: Awaited<
    ReturnType<typeof createClient>
  >,
  courseId: string,
  learningPack: unknown
) {
  const pack =
    getLearningPack(
      learningPack
    );

  const rawQuestions =
    Array.isArray(
      pack.assessment_questions
    )
      ? pack.assessment_questions
      : [];

  const questions =
    rawQuestions.filter(
      (
        item
      ): item is Record<
        string,
        unknown
      > =>
        Boolean(item) &&
        typeof item === "object" &&
        !Array.isArray(item)
    );

  if (
    questions.length === 0
  ) {
    return {
      imported: 0,
      existing: 0,
      message:
        "No assessment questions were included in the AI learning pack.",
    };
  }

  const {
    data: existingQuestions,
    error: existingError,
  } = await supabase
    .from(
      "assessment_questions"
    )
    .select("id")
    .eq(
      "course_id",
      courseId
    );

  if (existingError) {
    throw new Error(
      existingError.message ||
        "Unable to check existing assessment questions."
    );
  }

  const existingCount =
    existingQuestions?.length ??
    0;

  /*
   * Preserve questions already maintained
   * by an administrator.
   */
  if (existingCount > 0) {
    return {
      imported: 0,
      existing: existingCount,
      message:
        "Existing assessment questions were preserved.",
    };
  }

  const rows = [];

  for (
    let index = 0;
    index < questions.length;
    index += 1
  ) {
    const item =
      questions[index];

    const question =
      asString(
        item.question
      );

    const options =
      asStringArray(
        item.options
      );

    const correctAnswer =
      asString(
        item.correct_answer
      );

    const explanation =
      asString(
        item.explanation
      ) || null;

    const difficultyRaw =
      asString(
        item.difficulty
      ).toLowerCase();

    const difficulty =
      difficultyRaw ===
        "intermediate" ||
      difficultyRaw ===
        "advanced"
        ? difficultyRaw
        : "beginner";

    const questionTypeRaw =
      asString(
        item.question_type
      ).toLowerCase();

    const questionType =
      questionTypeRaw ===
        "true_false" ||
      questionTypeRaw ===
        "short_answer"
        ? questionTypeRaw
        : "multiple_choice";

    const points =
      typeof item.points ===
        "number" &&
      Number.isFinite(
        item.points
      ) &&
      item.points > 0
        ? Math.round(
            item.points
          )
        : 1;

    if (!question) {
      throw new Error(
        `AI assessment question ${
          index + 1
        } is missing question text.`
      );
    }

    if (
      questionType ===
        "multiple_choice" &&
      options.length < 2
    ) {
      throw new Error(
        `AI assessment question ${
          index + 1
        } must contain at least two options.`
      );
    }

    if (
      questionType ===
        "multiple_choice" &&
      !options.some(
        (option) =>
          normalizeAnswer(
            option
          ) ===
          normalizeAnswer(
            correctAnswer
          )
      )
    ) {
      throw new Error(
        `AI assessment question ${
          index + 1
        } has a correct answer that does not match one of its options.`
      );
    }

    rows.push({
      course_id:
        courseId,
      skill_id: null,
      question,
      question_text:
        question,
      options,
      correct_answer:
        correctAnswer ||
        null,
      explanation,
      difficulty,
      points,
      question_type:
        questionType,
      sort_order:
        index + 1,
    });
  }

  const {
    error: insertError,
  } = await supabase
    .from(
      "assessment_questions"
    )
    .insert(rows);

  if (insertError) {
    throw new Error(
      insertError.message ||
        "Unable to import AI assessment questions."
    );
  }

  return {
    imported:
      rows.length,
    existing: 0,
    message:
      `${rows.length} AI-generated assessment question${
        rows.length === 1
          ? ""
          : "s"
      } imported successfully.`,
  };
}

export async function POST(
  request: Request
) {
  try {
    const supabase =
      await createClient();

    const {
      data: { user },
      error: userError,
    } =
      await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          error:
            "Authentication required.",
        },
        { status: 401 }
      );
    }

    const {
      data: profile,
      error: profileError,
    } =
      await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

    if (
      profileError ||
      !profile
    ) {
      return NextResponse.json(
        {
          error:
            "User profile could not be verified.",
        },
        { status: 403 }
      );
    }

    const role =
      profile.role as Profile["role"];

    if (
      role !== "admin" &&
      role !== "instructor"
    ) {
      return NextResponse.json(
        {
          error:
            "Only admins and instructors can convert AI drafts.",
        },
        { status: 403 }
      );
    }

    let body: ConvertBody;

    try {
      body =
        (await request.json()) as ConvertBody;
    } catch {
      return NextResponse.json(
        {
          error:
            "Invalid request body.",
        },
        { status: 400 }
      );
    }

    const draftId =
      asString(body.id);

    if (!draftId) {
      return NextResponse.json(
        {
          error:
            "AI draft ID is required.",
        },
        { status: 400 }
      );
    }

    const {
      data: draft,
      error: draftError,
    } =
      await supabase
        .from("ai_learning_drafts")
        .select(
          [
            "id",
            "title",
            "status",
            "learning_pack",
            "converted_course_id",
            "converted_at",
          ].join(", ")
        )
        .eq("id", draftId)
        .single<DraftRecord>();

    if (
      draftError ||
      !draft
    ) {
      return NextResponse.json(
        {
          error:
            "AI draft not found.",
        },
        { status: 404 }
      );
    }

    /*
     * Already converted courses can still be synchronized
     * with lesson content and assessment questions.
     */
    if (
      draft.status ===
        "converted" &&
      draft.converted_course_id
    ) {
      try {
        const [
          lessonContent,
          assessment,
        ] = await Promise.all([
          populateLessonContent(
            supabase,
            draft.converted_course_id,
            draft.learning_pack
          ),
          importAssessmentQuestions(
            supabase,
            draft.converted_course_id,
            draft.learning_pack
          ),
        ]);

        return NextResponse.json({
          success: true,
          already_converted: true,
          course_id:
            draft.converted_course_id,
          lesson_content:
            lessonContent,
          assessment,
          draft: {
            id: draft.id,
            title: draft.title,
            status: draft.status,
            converted_course_id:
              draft.converted_course_id,
            converted_at:
              draft.converted_at,
          },
          message:
            `Existing converted LMS course synchronized. ${lessonContent.populated} lesson${
              lessonContent.populated ===
              1
                ? ""
                : "s"
            } populated and ${assessment.imported} assessment question${
              assessment.imported ===
              1
                ? ""
                : "s"
            } imported.`,
        });
      } catch (syncError) {
        console.error(
          "Existing AI course synchronization failed:",
          syncError
        );

        return NextResponse.json(
          {
            error:
              syncError instanceof
              Error
                ? syncError.message
                : "The converted LMS course could not be synchronized.",
            course_id:
              draft.converted_course_id,
          },
          { status: 500 }
        );
      }
    }

    if (
      draft.status !==
      "approved"
    ) {
      return NextResponse.json(
        {
          error:
            "Only approved AI drafts can be converted to an LMS course.",
        },
        { status: 409 }
      );
    }

    const {
      data: result,
      error:
        conversionError,
    } = await supabase.rpc(
      "convert_ai_draft_to_course",
      {
        p_draft_id:
          draftId,
        p_reviewer_id:
          user.id,
      }
    );

    if (conversionError) {
      console.error(
        "AI draft conversion failed:",
        conversionError
      );

      return NextResponse.json(
        {
          error:
            conversionError.message ||
            "The AI draft could not be converted to an LMS course.",
        },
        { status: 500 }
      );
    }

    if (
      !isConversionResult(
        result
      )
    ) {
      console.error(
        "AI draft conversion returned an unexpected result:",
        result
      );

      return NextResponse.json(
        {
          error:
            "The AI draft conversion completed with an invalid server response.",
        },
        { status: 500 }
      );
    }

    const courseId =
      asString(
        result.course_id
      );

    if (!courseId) {
      console.error(
        "AI draft conversion returned no course_id:",
        result
      );

      return NextResponse.json(
        {
          error:
            "The AI draft conversion did not return the created course ID.",
        },
        { status: 500 }
      );
    }

    let lessonContent;

    let assessment;

    try {
      lessonContent =
        await populateLessonContent(
          supabase,
          courseId,
          draft.learning_pack
        );

      assessment =
        await importAssessmentQuestions(
          supabase,
          courseId,
          draft.learning_pack
        );
    } catch (syncError) {
      console.error(
        "AI LMS content synchronization failed:",
        syncError
      );

      return NextResponse.json(
        {
          error:
            syncError instanceof
            Error
              ? `The LMS course was created, but AI learning content could not be synchronized: ${syncError.message}`
              : "The LMS course was created, but AI learning content could not be synchronized.",
          course_id:
            courseId,
          result,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      already_converted:
        result.already_converted ===
        true,
      course_id:
        courseId,
      result,
      lesson_content:
        lessonContent,
      assessment,
      message:
        `AI draft converted successfully. ${lessonContent.populated} lesson${
          lessonContent.populated ===
          1
            ? ""
            : "s"
        } populated with AI learning content and ${assessment.imported} assessment question${
          assessment.imported ===
          1
            ? ""
            : "s"
        } imported.`,
    });
  } catch (error) {
    console.error(
      "AI draft conversion route error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof
          Error
            ? error.message
            : "An unexpected error occurred while converting the AI draft.",
      },
      { status: 500 }
    );
  }
}