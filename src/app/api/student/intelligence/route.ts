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

type Enrollment = {
  course_id: string;
  progress_percent: number;
  enrollment_status: string;
};

type LearningActivity = {
  activity_type: string;
  created_at: string;
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

/**
 * Convert a timestamp into a calendar date in Nigeria.
 *
 * Using Africa/Lagos prevents UTC date boundaries from
 * incorrectly breaking a learner's streak.
 */
function getNigeriaDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

/**
 * Calculate consecutive learning days using Nigeria time.
 *
 * Today counts if the learner has learning activity today.
 * Yesterday counts as the previous active day.
 *
 * If the learner has no activity today but was active yesterday,
 * the streak remains active at yesterday's count.
 */
function calculateLearningStreak(
  activities: LearningActivity[]
) {
  if (!activities.length) {
    return 0;
  }

  const uniqueDates = [
    ...new Set(
      activities.map((activity) =>
        getNigeriaDate(activity.created_at)
      )
    ),
  ].sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));

  if (!uniqueDates.length) {
    return 0;
  }

  const today = getNigeriaDate(new Date());

  const yesterdayDate = new Date();

  yesterdayDate.setDate(yesterdayDate.getDate() - 1);

  const yesterday = getNigeriaDate(yesterdayDate);

  const mostRecentDate = uniqueDates[0];

  /*
   * A streak is only active if the most recent activity
   * happened today or yesterday.
   */
  if (
    mostRecentDate !== today &&
    mostRecentDate !== yesterday
  ) {
    return 0;
  }

  let streak = 1;

  for (let index = 1; index < uniqueDates.length; index++) {
    const current = new Date(
      `${uniqueDates[index - 1]}T12:00:00`
    );

    const previous = new Date(
      `${uniqueDates[index]}T12:00:00`
    );

    const difference =
      (current.getTime() - previous.getTime()) /
      (1000 * 60 * 60 * 24);

    if (Math.round(difference) !== 1) {
      break;
    }

    streak += 1;
  }

  return streak;
}

function calculateOverallLearningScore({
  skillScore,
  assessmentScore,
  completedLessons,
  learningActivityCount,
}: {
  skillScore: number;
  assessmentScore: number;
  completedLessons: number;
  learningActivityCount: number;
}) {
  /*
   * Skill profile:
   * 50%
   *
   * Latest assessment:
   * 30%
   *
   * Learning activity:
   * 20%
   */

  const activityScore =
    completedLessons > 0 || learningActivityCount > 0
      ? 100
      : 0;

  const score =
    skillScore * 0.5 +
    assessmentScore * 0.3 +
    activityScore * 0.2;

  return Math.round(Math.min(100, Math.max(0, score)));
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
     * --------------------------------------------------------------
     * SKILL PROFILES
     * --------------------------------------------------------------
     */

    const { data: skillProfileData, error: skillProfileError } =
      await supabase
        .from("learner_skill_profiles")
        .select(
          `
            skill_id,
            confidence_score,
            skill_level
          `
        )
        .eq("student_id", user.id);

    if (skillProfileError) {
      throw skillProfileError;
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
      const { data: skillData, error: skillError } =
        await supabase
          .from("learning_skills")
          .select("id, name, category")
          .in("id", skillIds);

      if (skillError) {
        throw skillError;
      }

      skills = (skillData || []) as Skill[];
    }

    const skillMap = new Map<string, Skill>();

    skills.forEach((skill) => {
      skillMap.set(skill.id, skill);
    });

    /*
     * --------------------------------------------------------------
     * LATEST ASSESSMENT
     * --------------------------------------------------------------
     */

    const { data: assessmentData, error: assessmentError } =
      await supabase
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
        .limit(1)
        .maybeSingle();

    if (assessmentError) {
      throw assessmentError;
    }

    const latestAssessment =
      assessmentData as AssessmentAttempt | null;

    const assessmentScore = latestAssessment
      ? Number(latestAssessment.score || 0)
      : 0;

    /*
     * --------------------------------------------------------------
     * ENROLLMENTS
     * --------------------------------------------------------------
     */

    const { data: enrollmentData, error: enrollmentError } =
      await supabase
        .from("enrollments")
        .select(
          `
            course_id,
            progress_percent,
            enrollment_status
          `
        )
        .eq("student_id", user.id);

    if (enrollmentError) {
      throw enrollmentError;
    }

    const enrollments =
      (enrollmentData || []) as Enrollment[];

    /*
     * --------------------------------------------------------------
     * COMPLETED LESSONS
     * --------------------------------------------------------------
     *
     * Count completed published lessons through lesson_progress.
     * The table already has RLS restricting access to the current
     * learner.
     */

    const { data: progressData, error: progressError } =
      await supabase
        .from("lesson_progress")
        .select(
          `
            lesson_id,
            completed,
            last_accessed_at
          `
        )
        .eq("student_id", user.id)
        .eq("completed", true);

    if (progressError) {
      throw progressError;
    }

    const completedLessons = progressData?.length || 0;

    /*
     * --------------------------------------------------------------
     * LEARNING ACTIVITY
     * --------------------------------------------------------------
     */

    const { data: activityData, error: activityError } =
      await supabase
        .from("learning_activity")
        .select(
          `
            activity_type,
            created_at
          `
        )
        .eq("student_id", user.id)
        .order("created_at", {
          ascending: false,
        });

    if (activityError) {
      throw activityError;
    }

    const activities =
      (activityData || []) as LearningActivity[];

    const learningStreak =
      calculateLearningStreak(activities);

    /*
     * --------------------------------------------------------------
     * SKILL METRICS
     * --------------------------------------------------------------
     */

    const totalSkills = skillProfiles.length;

    const skillScore =
      totalSkills > 0
        ? Math.round(
            skillProfiles.reduce(
              (total, profile) =>
                total +
                Number(
                  profile.confidence_score || 0
                ),
              0
            ) / totalSkills
          )
        : 0;

    const masteredSkills = skillProfiles.filter(
      (profile) =>
        Number(profile.confidence_score || 0) >= 80
    ).length;

    const developingSkills = skillProfiles.filter(
      (profile) =>
        Number(profile.confidence_score || 0) < 80
    ).length;

    /*
     * --------------------------------------------------------------
     * OVERALL LEARNING SCORE
     * --------------------------------------------------------------
     */

    const overallLearningScore =
      calculateOverallLearningScore({
        skillScore,
        assessmentScore,
        completedLessons,
        learningActivityCount: activities.length,
      });

    /*
     * --------------------------------------------------------------
     * SKILL BREAKDOWN
     * --------------------------------------------------------------
     */

    const skillBreakdown = skillProfiles
      .map((profile) => {
        const skill = skillMap.get(profile.skill_id);

        if (!skill) {
          return null;
        }

        return {
          id: skill.id,
          name: skill.name,
          category: skill.category || "General",
          score: Math.round(
            Number(profile.confidence_score || 0)
          ),
          level: profile.skill_level || "beginner",
        };
      })
      .filter(
        (
          item
        ): item is {
          id: string;
          name: string;
          category: string;
          score: number;
          level: string;
        } => item !== null
      )
      .sort((a, b) => b.score - a.score);

    /*
     * --------------------------------------------------------------
     * RECOMMENDED NEXT COURSE
     * --------------------------------------------------------------
     *
     * Choose the next published course that the learner has not
     * completed. Prefer intermediate/advanced courses when the
     * learner already has a strong profile.
     */

    const enrolledCourseIds = [
      ...new Set(
        enrollments.map(
          (enrollment) => enrollment.course_id
        )
      ),
    ];

    const completedCourseIds = new Set(
      enrollments
        .filter(
          (enrollment) =>
            enrollment.progress_percent >= 100 ||
            enrollment.enrollment_status === "completed"
        )
        .map(
          (enrollment) => enrollment.course_id
        )
    );

    const { data: courseData, error: courseError } =
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
        .order("created_at", {
          ascending: false,
        });

    if (courseError) {
      throw courseError;
    }

    const courses =
      (courseData || []) as Course[];

    const availableCourses = courses.filter(
      (course) =>
        !completedCourseIds.has(course.id)
    );

    const levelRank: Record<
      Course["level"],
      number
    > = {
      beginner: 1,
      intermediate: 2,
      advanced: 3,
    };

    const sortedCourses = [
      ...availableCourses,
    ].sort((a, b) => {
      /*
       * Strong learning profiles should be directed toward
       * higher-level material.
       */
      if (skillScore >= 80) {
        return (
          levelRank[b.level] -
          levelRank[a.level]
        );
      }

      if (skillScore >= 50) {
        return (
          levelRank[b.level] -
          levelRank[a.level]
        );
      }

      return (
        levelRank[a.level] -
        levelRank[b.level]
      );
    });

    const nextCourse =
      sortedCourses.length > 0
        ? sortedCourses[0]
        : null;

    /*
     * --------------------------------------------------------------
     * RESPONSE
     * --------------------------------------------------------------
     */

    return NextResponse.json({
      overallLearningScore,
      assessmentScore,
      completedLessons,
      learningStreak,
      masteredSkills,
      developingSkills,
      totalSkills,
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
        error:
          "Unable to load learning intelligence.",
      },
      {
        status: 500,
      }
    );
  }
}