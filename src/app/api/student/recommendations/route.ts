import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type SkillProfile = {
  skill_id: string;
  confidence_score: number | null;
  skill_level: string | null;
};

type LessonProgress = {
  lesson_id: string;
  completed: boolean;
};

type RelatedCourse = {
  id: string;
  title: string;
  slug: string;
  status: string;
};

type RelatedLesson = {
  id: string;
  course_id: string;
  title: string;
  slug: string;
  duration_minutes: number | null;
  duration_seconds: number | null;
  is_preview: boolean;
  is_published: boolean;
  courses:
    | RelatedCourse
    | RelatedCourse[]
    | null;
};

type LessonSkill = {
  lesson_id: string;
  skill_id: string;
  relevance_weight: number | null;
  lessons:
    | RelatedLesson
    | RelatedLesson[]
    | null;
};

function getSingleRelation<T>(
  relation: T | T[] | null | undefined
): T | null {
  if (!relation) {
    return null;
  }

  return Array.isArray(relation)
    ? relation[0] || null
    : relation;
}

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "You must be logged in.",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * --------------------------------------------------------------
     * LEARNER SKILL PROFILE
     * --------------------------------------------------------------
     */

    const {
      data: profiles,
      error: profileError,
    } = await supabase
      .from("learner_skill_profiles")
      .select(
        "skill_id, confidence_score, skill_level"
      )
      .eq("student_id", user.id);

    if (profileError) {
      console.error(
        "Learning profile error:",
        profileError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load your learning profile.",
        },
        {
          status: 500,
        }
      );
    }

    const skillProfiles =
      (profiles || []) as SkillProfile[];

    if (!skillProfiles.length) {
      return NextResponse.json({
        recommendations: [],
        message:
          "Complete the diagnostic assessment first.",
      });
    }

    /*
     * --------------------------------------------------------------
     * IDENTIFY SKILL GAPS
     * --------------------------------------------------------------
     */

    const weakSkills = skillProfiles
      .filter(
        (profile) =>
          Number(
            profile.confidence_score || 0
          ) < 70
      )
      .sort(
        (a, b) =>
          Number(
            a.confidence_score || 0
          ) -
          Number(
            b.confidence_score || 0
          )
      );

    const weakSkillIds =
      weakSkills.map(
        (skill) => skill.skill_id
      );

    if (!weakSkillIds.length) {
      return NextResponse.json({
        recommendations: [],
        message:
          "No major skill gaps were identified from your current profile.",
      });
    }

    /*
     * --------------------------------------------------------------
     * COMPLETED LESSONS
     * --------------------------------------------------------------
     *
     * Recommendations must never send a learner back to a lesson
     * that has already been completed.
     */

    const {
      data: progressData,
      error: progressError,
    } = await supabase
      .from("lesson_progress")
      .select(
        "lesson_id, completed"
      )
      .eq("student_id", user.id)
      .eq("completed", true);

    if (progressError) {
      console.error(
        "Lesson progress error:",
        progressError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load your learning progress.",
        },
        {
          status: 500,
        }
      );
    }

    const completedLessonIds =
      new Set(
        (
          (progressData || []) as LessonProgress[]
        ).map(
          (progress) =>
            progress.lesson_id
        )
      );

    /*
     * --------------------------------------------------------------
     * LESSON-SKILL RELATIONSHIPS
     * --------------------------------------------------------------
     */

    const {
      data: lessonSkillData,
      error: lessonSkillError,
    } = await supabase
      .from("lesson_skills")
      .select(
        `
          lesson_id,
          skill_id,
          relevance_weight,
          lessons (
            id,
            course_id,
            title,
            slug,
            duration_minutes,
            duration_seconds,
            is_preview,
            is_published,
            courses (
              id,
              title,
              slug,
              status
            )
          )
        `
      )
      .in(
        "skill_id",
        weakSkillIds
      );

    if (lessonSkillError) {
      console.error(
        "Lesson skill recommendation error:",
        lessonSkillError
      );

      return NextResponse.json(
        {
          error:
            "Unable to generate learning recommendations.",
        },
        {
          status: 500,
        }
      );
    }

    const lessonSkills =
      (lessonSkillData || []) as unknown as LessonSkill[];

    /*
     * --------------------------------------------------------------
     * BUILD RECOMMENDATIONS
     * --------------------------------------------------------------
     */

    const recommendations =
      lessonSkills
        .map((item) => {
          const lesson =
            getSingleRelation(
              item.lessons
            );

          if (!lesson) {
            return null;
          }

          const course =
            getSingleRelation(
              lesson.courses
            );

          if (!course) {
            return null;
          }

          /*
           * Only published lessons belonging to published courses
           * are valid recommendations.
           */
          if (
            lesson.is_published !== true ||
            course.status !== "published"
          ) {
            return null;
          }

          /*
           * Never recommend an already completed lesson.
           */
          if (
            completedLessonIds.has(
              lesson.id
            )
          ) {
            return null;
          }

          const profile =
            skillProfiles.find(
              (skill) =>
                skill.skill_id ===
                item.skill_id
            );

          const score = Number(
            profile?.confidence_score || 0
          );

          const relevanceWeight =
            Number(
              item.relevance_weight || 1
            );

          return {
            lessonId: lesson.id,
            lessonTitle: lesson.title,
            lessonSlug: lesson.slug,
            courseId: course.id,
            courseTitle: course.title,
            courseSlug: course.slug,
            skillId: item.skill_id,
            score,
            relevanceWeight,
            priority:
              score < 50
                ? "high"
                : "medium",
          };
        })
        .filter(
          (
            item
          ): item is NonNullable<
            typeof item
          > => item !== null
        )
        .sort((a, b) => {
          /*
           * Highest priority:
           * 1. Severe skill gaps
           * 2. Lowest confidence score
           * 3. Strongest lesson relevance
           */

          if (
            a.priority !==
            b.priority
          ) {
            return a.priority ===
              "high"
              ? -1
              : 1;
          }

          return (
            a.score - b.score ||
            b.relevanceWeight -
              a.relevanceWeight
          );
        })
        .slice(0, 12);

    /*
     * --------------------------------------------------------------
     * RESPONSE
     * --------------------------------------------------------------
     */

    return NextResponse.json({
      recommendations,
    });
  } catch (error) {
    console.error(
      "Recommendations error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to generate learning recommendations.",
      },
      {
        status: 500,
      }
    );
  }
}