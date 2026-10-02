import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type SkillProfile = {
  skill_id: string;
  confidence_score: number | null;
  skill_level: string | null;
};

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in." },
      { status: 401 }
    );
  }

  const { data: profiles, error: profileError } = await supabase
    .from("learner_skill_profiles")
    .select("skill_id, confidence_score, skill_level")
    .eq("student_id", user.id);

  if (profileError) {
    return NextResponse.json(
      { error: "Unable to load your learning profile." },
      { status: 500 }
    );
  }

  const skillProfiles = (profiles || []) as SkillProfile[];

  if (!skillProfiles.length) {
    return NextResponse.json({
      recommendations: [],
      message: "Complete the diagnostic assessment first.",
    });
  }

  const weakSkills = skillProfiles
    .filter((profile) => Number(profile.confidence_score || 0) < 70)
    .sort(
      (a, b) =>
        Number(a.confidence_score || 0) -
        Number(b.confidence_score || 0)
    );

  const weakSkillIds = weakSkills.map((skill) => skill.skill_id);

  if (!weakSkillIds.length) {
    return NextResponse.json({
      recommendations: [],
      message:
        "No major skill gaps were identified from your current profile.",
    });
  }

  const { data: lessonSkills } = await supabase
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
    .in("skill_id", weakSkillIds);

  const recommendations = (lessonSkills || [])
    .filter((item: any) => {
      const lesson = Array.isArray(item.lessons)
        ? item.lessons[0]
        : item.lessons;

      const course = lesson?.courses
        ? Array.isArray(lesson.courses)
          ? lesson.courses[0]
          : lesson.courses
        : null;

      return (
        lesson?.is_published === true &&
        course?.status === "published"
      );
    })
    .map((item: any) => {
      const lesson = Array.isArray(item.lessons)
        ? item.lessons[0]
        : item.lessons;

      const course = lesson?.courses
        ? Array.isArray(lesson.courses)
          ? lesson.courses[0]
          : lesson.courses
        : null;

      const profile = skillProfiles.find(
        (skill) => skill.skill_id === item.skill_id
      );

      return {
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        lessonSlug: lesson.slug,
        courseId: course.id,
        courseTitle: course.title,
        courseSlug: course.slug,
        skillId: item.skill_id,
        score: Number(profile?.confidence_score || 0),
        relevanceWeight: Number(item.relevance_weight || 1),
        priority:
          Number(profile?.confidence_score || 0) < 50
            ? "high"
            : "medium",
      };
    })
    .sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority === "high" ? -1 : 1;
      }

      return (
        a.score - b.score ||
        b.relevanceWeight - a.relevanceWeight
      );
    })
    .slice(0, 12);

  return NextResponse.json({
    recommendations,
  });
}