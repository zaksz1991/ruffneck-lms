import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type SkillProfile = {
  skill_id: string;
  confidence_score: number;
  skill_level: string;
};

type Skill = {
  id: string;
  name: string;
  category: string | null;
};

type AssessmentAttempt = {
  score: number | null;
  total_questions: number | null;
  completed_at: string | null;
  created_at: string;
};

type LessonProgress = {
  lesson_id: string;
  completed: boolean;
};

type Course = {
  id: string;
  title: string;
  slug: string;
  level: "beginner" | "intermediate" | "advanced";
  category: string | null;
  short_description: string | null;
  thumbnail_url: string | null;
  duration_minutes: number | null;
};

type Enrollment = {
  course_id: string;
};

type LearningActivity = {
  created_at: string;
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function calculateLearningStreak(
  activities: LearningActivity[]
) {
  if (activities.length === 0) {
    return 0;
  }

  const uniqueDates = [
    ...new Set(
      activities.map((activity) =>
        new Date(activity.created_at)
          .toISOString()
          .slice(0, 10)
      )
    ),
  ].sort((a, b) => (a < b ? 1 : -1));

  if (uniqueDates.length === 0) {
    return 0;
  }

  const today = new Date();

  const todayKey = today.toISOString().slice(0, 10);

  const yesterday = new Date(today);

  yesterday.setUTCDate(
    yesterday.getUTCDate() - 1
  );

  const yesterdayKey = yesterday
    .toISOString()
    .slice(0, 10);

  if (
    uniqueDates[0] !== todayKey &&
    uniqueDates[0] !== yesterdayKey
  ) {
    return 0;
  }

  let streak = 1;

  for (let index = 1; index < uniqueDates.length; index++) {
    const current = new Date(
      `${uniqueDates[index - 1]}T00:00:00Z`
    );

    const previous = new Date(
      `${uniqueDates[index]}T00:00:00Z`
    );

    const difference =
      (current.getTime() - previous.getTime()) /
      (1000 * 60 * 60 * 24);

    if (difference === 1) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
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
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * ---------------------------------------------------------------
     * SKILL PROFILES
     * ---------------------------------------------------------------
     */

    const { data: skillProfileData, error: skillProfileError } =
      await supabase
        .from("learner_skill_profiles")
        .select(
          "skill_id, confidence_score, skill_level"
        )
        .eq("student_id", user.id);

    if (skillProfileError) {
      return NextResponse.json(
        {
          error: skillProfileError.message,
        },
        {
          status: 500,
        }
      );
    }

    const skillProfiles =
      (skillProfileData || []) as SkillProfile[];

    const skillIds = [
      ...new Set(
        skillProfiles.map(
          (profile) => profile.skill_id
        )
      ),
    ];

    let skills: Skill[] = [];

    if (skillIds.length > 0) {
      const { data: skillData } = await supabase
        .from("learning_skills")
        .select("id, name, category")
        .in("id", skillIds);

      skills = (skillData || []) as Skill[];
    }

    const skillMap = new Map<string, Skill>();

    skills.forEach((skill) => {
      skillMap.set(skill.id, skill);
    });

    /*
     * ---------------------------------------------------------------
     * LATEST ASSESSMENT
     * ---------------------------------------------------------------
     */

    const { data: assessmentData } = await supabase
      .from("assessment_attempts")
      .select(
        `
          score,
          total_questions,
          completed_at,
          created_at
        `
      )
      .eq("student_id", user.id)
      .order("created_at", {
        ascending: false,
      })
      .limit(1);

    const latestAssessment =
      assessmentData &&
      assessmentData.length > 0
        ? (assessmentData[0] as AssessmentAttempt)
        : null;

    const assessmentScore = latestAssessment
      ? clamp(Number(latestAssessment.score || 0))
      : 0;

    /*
     * ---------------------------------------------------------------
     * COMPLETED LESSONS
     * ---------------------------------------------------------------
     */

    const { data: progressData } = await supabase
      .from("lesson_progress")
      .select("lesson_id, completed")
      .eq("student_id", user.id)
      .eq("completed", true);

    const lessonProgress =
      (progressData || []) as LessonProgress[];

    const completedLessons = lessonProgress.length;

    /*
     * ---------------------------------------------------------------
     * ENROLLMENTS
     * ---------------------------------------------------------------
     */

    const { data: enrollmentData } = await supabase
      .from("enrollments")
      .select("course_id")
      .eq("student_id", user.id);

    const enrollments =
      (enrollmentData || []) as Enrollment[];

    const enrolledCourseIds = [
      ...new Set(
        enrollments.map(
          (enrollment) => enrollment.course_id
        )
      ),
    ];

    /*
     * ---------------------------------------------------------------
     * LEARNING ACTIVITY / STREAK
     * ---------------------------------------------------------------
     */

    const { data: activityData } = await supabase
      .from("learning_activity")
      .select("created_at")
      .eq("student_id", user.id)
      .order("created_at", {
        ascending: false,
      })
      .limit(100);

    const activities =
      (activityData || []) as LearningActivity[];

    const learningStreak =
      calculateLearningStreak(activities);

    /*
     * ---------------------------------------------------------------
     * SKILL METRICS
     * ---------------------------------------------------------------
     */

    const averageSkillScore =
      skillProfiles.length > 0
        ? skillProfiles.reduce(
            (total, profile) =>
              total +
              Number(profile.confidence_score || 0),
            0
          ) / skillProfiles.length
        : 0;

    const masteredSkills = skillProfiles.filter(
      (profile) =>
        Number(profile.confidence_score || 0) >= 80
    ).length;

    const developingSkills = skillProfiles.filter(
      (profile) =>
        Number(profile.confidence_score || 0) < 70
    ).length;

    /*
     * ---------------------------------------------------------------
     * OVERALL LEARNING SCORE
     *
     * Uses available evidence:
     * - skill profile: 50%
     * - assessment: 30%
     * - activity/completion signal: 20%
     * ---------------------------------------------------------------
     */

    const activityScore =
      completedLessons > 0 || activities.length > 0
        ? 100
        : 0;

    const overallLearningScore =
      skillProfiles.length === 0 &&
      !latestAssessment
        ? 0
        : clamp(
            averageSkillScore * 0.5 +
              assessmentScore * 0.3 +
              activityScore * 0.2
          );

    /*
     * ---------------------------------------------------------------
     * NEXT COURSE RECOMMENDATION
     *
     * Prefer an advanced course for a learner whose current
     * profile demonstrates strong foundational skills.
     * ---------------------------------------------------------------
     */

    let nextCourse: Course | null = null;

    const { data: advancedCourseData } =
      await supabase
        .from("courses")
        .select(
          `
            id,
            title,
            slug,
            level,
            category,
            short_description,
            thumbnail_url,
            duration_minutes
          `
        )
        .eq("status", "published")
        .eq("level", "advanced")
        .order("created_at", {
          ascending: false,
        })
        .limit(10);

    const advancedCourses =
      (advancedCourseData || []) as Course[];

    const availableAdvancedCourses =
      advancedCourses.filter(
        (course) =>
          !enrolledCourseIds.includes(course.id)
      );

    if (
      availableAdvancedCourses.length > 0 &&
      averageSkillScore >= 70
    ) {
      nextCourse = availableAdvancedCourses[0];
    }

    if (!nextCourse) {
      const { data: intermediateCourseData } =
        await supabase
          .from("courses")
          .select(
            `
              id,
              title,
              slug,
              level,
              category,
              short_description,
              thumbnail_url,
              duration_minutes
            `
          )
          .eq("status", "published")
          .eq("level", "intermediate")
          .order("created_at", {
            ascending: false,
          })
          .limit(10);

      const intermediateCourses =
        (intermediateCourseData || []) as Course[];

      const availableIntermediateCourses =
        intermediateCourses.filter(
          (course) =>
            !enrolledCourseIds.includes(course.id)
        );

      if (availableIntermediateCourses.length > 0) {
        nextCourse =
          availableIntermediateCourses[0];
      }
    }

    /*
     * ---------------------------------------------------------------
     * SKILL BREAKDOWN
     * ---------------------------------------------------------------
     */

    const skillBreakdown = skillProfiles
      .map((profile) => {
        const skill = skillMap.get(profile.skill_id);

        return {
          id: profile.skill_id,
          name: skill?.name || "Learning Skill",
          category: skill?.category || "General",
          score: clamp(
            Number(profile.confidence_score || 0)
          ),
          level:
            profile.skill_level || "beginner",
        };
      })
      .sort((a, b) => b.score - a.score);

    return NextResponse.json({
      overallLearningScore,
      assessmentScore,
      completedLessons,
      learningStreak,
      masteredSkills,
      developingSkills,
      totalSkills: skillProfiles.length,
      skillBreakdown,
      nextCourse,
      latestAssessmentDate:
        latestAssessment?.completed_at ||
        latestAssessment?.created_at ||
        null,
    });
  } catch (error) {
    console.error(
      "Learning intelligence error:",
      error
    );

    return NextResponse.json(
      {
        error: "Unable to load learning intelligence.",
      },
      {
        status: 500,
      }
    );
  }
}