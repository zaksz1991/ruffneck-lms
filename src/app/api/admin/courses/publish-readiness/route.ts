import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Course = {
  id: string;
  title: string | null;
  short_description: string | null;
  description: string | null;
  learning_outcomes: unknown;
  is_free: boolean | null;
  price_ngn: number | null;
  instructor_id: string | null;
};

type Section = {
  id: string;
};

type Lesson = {
  id: string;
  section_id: string;
  is_published: boolean | null;
};

function normaliseText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function hasLearningOutcomes(value: unknown): boolean {
  if (!Array.isArray(value)) {
    return false;
  }

  return value.some(
    (item) =>
      typeof item === "string" &&
      item.trim().length > 0
  );
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          error: "Authentication required.",
        },
        { status: 401 }
      );
    }

    const adminClient = createAdminClient();

    const {
      data: profile,
      error: profileError,
    } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        {
          ok: false,
          error: profileError.message,
        },
        { status: 500 }
      );
    }

    const role = profile?.role;

    if (
      role !== "admin" &&
      role !== "instructor"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "You do not have permission to check course publishing readiness.",
        },
        { status: 403 }
      );
    }

    const { searchParams } =
      new URL(request.url);

    const courseId =
      searchParams.get("courseId")?.trim();

    if (!courseId) {
      return NextResponse.json(
        {
          ok: false,
          error: "courseId is required.",
        },
        { status: 400 }
      );
    }

    const {
      data: course,
      error: courseError,
    } = await adminClient
      .from("courses")
      .select(
        "id,title,short_description,description,learning_outcomes,is_free,price_ngn,instructor_id"
      )
      .eq("id", courseId)
      .maybeSingle<Course>();

    if (courseError) {
      return NextResponse.json(
        {
          ok: false,
          error: courseError.message,
        },
        { status: 500 }
      );
    }

    if (!course) {
      return NextResponse.json(
        {
          ok: false,
          error: "Course not found.",
        },
        { status: 404 }
      );
    }

    if (
      role === "instructor" &&
      course.instructor_id !== user.id
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "You do not have permission to publish this course.",
        },
        { status: 403 }
      );
    }

    const {
      data: sections,
      error: sectionsError,
    } = await adminClient
      .from("course_sections")
      .select("id")
      .eq("course_id", course.id)
      .order("sort_order", {
        ascending: true,
      })
      .returns<Section[]>();

    if (sectionsError) {
      return NextResponse.json(
        {
          ok: false,
          error: sectionsError.message,
        },
        { status: 500 }
      );
    }

    const sectionIds = (
      sections ?? []
    ).map((section) => section.id);

    let lessons: Lesson[] = [];

    if (sectionIds.length > 0) {
      const {
        data: lessonRows,
        error: lessonsError,
      } = await adminClient
        .from("lessons")
        .select(
          "id,section_id,is_published"
        )
        .in("section_id", sectionIds)
        .order("sort_order", {
          ascending: true,
        })
        .returns<Lesson[]>();

      if (lessonsError) {
        return NextResponse.json(
          {
            ok: false,
            error: lessonsError.message,
          },
          { status: 500 }
        );
      }

      lessons = lessonRows ?? [];
    }

    const reasons: string[] = [];

    if (!normaliseText(course.title)) {
      reasons.push(
        "A course title is required."
      );
    }

    if (
      !normaliseText(
        course.short_description
      )
    ) {
      reasons.push(
        "A short course description is required."
      );
    }

    if (
      !normaliseText(course.description)
    ) {
      reasons.push(
        "A full course description is required."
      );
    }

    if (
      !hasLearningOutcomes(
        course.learning_outcomes
      )
    ) {
      reasons.push(
        "At least one learning outcome is required."
      );
    }

    if (sections.length === 0) {
      reasons.push(
        "At least one course section is required."
      );
    }

    if (lessons.length === 0) {
      reasons.push(
        "At least one lesson is required."
      );
    }

    const publishedLessons =
      lessons.filter(
        (lesson) =>
          lesson.is_published === true
      );

    if (
      lessons.length > 0 &&
      publishedLessons.length === 0
    ) {
      reasons.push(
        "At least one lesson must be published."
      );
    }

    if (!course.is_free) {
      const price = Number(
        course.price_ngn ?? 0
      );

      if (
        !Number.isFinite(price) ||
        price <= 0
      ) {
        reasons.push(
          "A paid course must have a price greater than ₦0."
        );
      }
    }

    if (!course.instructor_id) {
      reasons.push(
        "An instructor must be assigned."
      );
    }

    return NextResponse.json({
      ok: true,
      ready: reasons.length === 0,
      courseId: course.id,

      checks: {
        title: Boolean(
          normaliseText(course.title)
        ),

        shortDescription: Boolean(
          normaliseText(
            course.short_description
          )
        ),

        description: Boolean(
          normaliseText(
            course.description
          )
        ),

        learningOutcomes:
          hasLearningOutcomes(
            course.learning_outcomes
          ),

        sections:
          sections.length > 0,

        lessons:
          lessons.length > 0,

        publishedLessons:
          publishedLessons.length > 0,

        pricing: course.is_free
          ? true
          : Number(
              course.price_ngn ?? 0
            ) > 0,

        instructor:
          Boolean(course.instructor_id),
      },

      totals: {
        sections: sections.length,
        lessons: lessons.length,
        publishedLessons:
          publishedLessons.length,
      },

      reasons,
    });
  } catch (error) {
    console.error(
      "Course publish readiness error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to check course publishing readiness.",
      },
      { status: 500 }
    );
  }
}