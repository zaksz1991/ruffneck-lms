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
  progress_percent: number | null;
  enrollment_status: string | null;
};

type LearningActivity = {
  activity_type: string;
  created_at: string;
};

type LessonProgress = {
  lesson_id: string;
  course_id: string;
  completed: boolean;
  last_accessed_at: string | null;
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

type CourseCompletion = {
  courseId: string;
  completedLessons: number;
  totalLessons: number;
  progressPercent: number;
};

function getNigeriaDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

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
  ].sort((a, b) =>
    a > b ? -1 : a < b ? 1 : 0
  );

  if (!uniqueDates.length) {
    return 0;
  }

  const today = getNigeriaDate(new Date());

  const yesterdayDate = new Date();
  yesterdayDate.setDate(
    yesterdayDate.getDate() - 1
  );

  const yesterday =
    getNigeriaDate(yesterdayDate);

  const mostRecentDate = uniqueDates[0];

  if (
    mostRecentDate !== today &&
    mostRecentDate !== yesterday
  ) {
    return 0;
  }

  let streak = 1;

  for (
    let index = 1;
    index < uniqueDates.length;
    index++
  ) {
    const current = new Date(
      `${uniqueDates[index - 1]}T12:00:00`
    );

    const previous = new Date(
      `${uniqueDates[index]}T12:00:00`
    );

    const difference =
      (current.getTime() -
        previous.getTime()) /
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
  const activityScore =
    completedLessons > 0 ||
    learningActivityCount > 0
      ? 100
      : 0;

  const score =
    skillScore * 0.5 +
    assessmentScore * 0.3 +
    activityScore * 0.2;

  return Math.round(
    Math.min(100, Math.max(0, score))
  );
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

    const {
      data: skillProfileData,
      error: skillProfileError,
    } = await supabase
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
      const {
        data: skillData,
        error: skillError,
      } = await supabase
        .from("learning_skills")
        .select("id, name, category")
        .in("id", skillIds);

      if (skillError) {
        throw skillError;
      }

      skills =
        (skillData || []) as Skill[];
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

    const {
      data: assessmentData,
      error: assessmentError,
    } = await supabase
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
      ? Number(
          latestAssessment.score || 0
        )
      : 0;

    /*
     * --------------------------------------------------------------
     * ENROLLMENTS
     * --------------------------------------------------------------
     *
     * Enrollment status is retained for enrollment state,
     * but progress_percent is NOT used as the source of truth
     * for course completion.
     */

    const {
      data: enrollmentData,
      error: enrollmentError,
    } = await supabase
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
     * LESSON PROGRESS
     * --------------------------------------------------------------
     *
     * This is the canonical source of lesson completion.
     */

    const {
      data: progressData,
      error: progressError,
    } = await supabase
      .from("lesson_progress")
      .select(
        `
          lesson_id,
          course_id,
          completed,
          last_accessed_at
        `
      )
      .eq("student_id", user.id)
      .eq("completed", true);

    if (progressError) {
      throw progressError;
    }

    const completedProgress =
      (progressData || []) as LessonProgress[];

    const completedLessons =
      completedProgress.length;

    /*
     * --------------------------------------------------------------
     * LEARNING ACTIVITY
     * --------------------------------------------------------------
     */

    const {
      data: activityData,
      error: activityError,
    } = await supabase
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
      calculateLearningStreak(
        activities
      );

    /*
     * --------------------------------------------------------------
     * COURSE DATA
     * --------------------------------------------------------------
     */

    const {
      data: courseData,
      error: courseError,
    } = await supabase
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

    /*
     * --------------------------------------------------------------
     * PUBLISHED CURRICULUM
     * --------------------------------------------------------------
     *
     * We need the actual published lesson count per course
     * so that 16 completed lessons against 16 published lessons
     * becomes 100%.
     */

    const courseIds = courses.map(
      (course) => course.id
    );

    const courseCompletionMap =
      new Map<string, CourseCompletion>();

    if (courseIds.length > 0) {
      const {
        data: curriculumData,
        error: curriculumError,
      } = await supabase
        .from("course_curriculum")
        .select(
          `
            course_id,
            lesson_id,
            is_published
          `
        )
        .in("course_id", courseIds)
        .eq("is_published", true);

      if (curriculumError) {
        throw curriculumError;
      }

      const publishedLessonCounts =
        new Map<string, number>();

      (
        curriculumData || []
      ).forEach((row) => {
        const courseId =
          row.course_id as string;

        publishedLessonCounts.set(
          courseId,
          (publishedLessonCounts.get(
            courseId
          ) || 0) + 1
        );
      });

      const completedByCourse =
        new Map<string, Set<string>>();

      completedProgress.forEach(
        (progress) => {
          if (!completedByCourse.has(
            progress.course_id
          )) {
            completedByCourse.set(
              progress.course_id,
              new Set<string>()
            );
          }

          completedByCourse
            .get(progress.course_id)!
            .add(progress.lesson_id);
        }
      );

      courses.forEach((course) => {
        const totalLessons =
          publishedLessonCounts.get(
            course.id
          ) || 0;

        const completedSet =
          completedByCourse.get(course.id);

        const completedCount =
          completedSet?.size || 0;

        const progressPercent =
          totalLessons > 0
            ? Math.min(
                100,
                Math.round(
                  (completedCount /
                    totalLessons) *
                    100
                )
              )
            : 0;

        courseCompletionMap.set(
          course.id,
          {
            courseId: course.id,
            completedLessons:
              completedCount,
            totalLessons,
            progressPercent,
          }
        );
      });
    }

    /*
     * --------------------------------------------------------------
     * COURSE COMPLETION
     * --------------------------------------------------------------
     *
     * A course is considered completed only when every published
     * curriculum lesson has been completed.
     *
     * enrollment.progress_percent is deliberately not used here.
     */

    const completedCourseIds =
      new Set<string>();

    courseCompletionMap.forEach(
      (completion) => {
        if (
          completion.totalLessons > 0 &&
          completion.completedLessons >=
            completion.totalLessons
        ) {
          completedCourseIds.add(
            completion.courseId
          );
        }
      }
    );

    /*
     * --------------------------------------------------------------
     * SKILL METRICS
     * --------------------------------------------------------------
     */

    const totalSkills =
      skillProfiles.length;

    const skillScore =
      totalSkills > 0
        ? Math.round(
            skillProfiles.reduce(
              (total, profile) =>
                total +
                Number(
                  profile.confidence_score ||
                    0
                ),
              0
            ) / totalSkills
          )
        : 0;

    const masteredSkills =
      skillProfiles.filter(
        (profile) =>
          Number(
            profile.confidence_score || 0
          ) >= 80
      ).length;

    const developingSkills =
      skillProfiles.filter(
        (profile) =>
          Number(
            profile.confidence_score || 0
          ) < 80
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
        learningActivityCount:
          activities.length,
      });

    /*
     * --------------------------------------------------------------
     * SKILL BREAKDOWN
     * --------------------------------------------------------------
     */

    const skillBreakdown =
      skillProfiles
        .map((profile) => {
          const skill =
            skillMap.get(
              profile.skill_id
            );

          if (!skill) {
            return null;
          }

          return {
            id: skill.id,
            name: skill.name,
            category:
              skill.category ||
              "General",
            score: Math.round(
              Number(
                profile.confidence_score ||
                  0
              )
            ),
            level:
              profile.skill_level ||
              "beginner",
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
        .sort(
          (a, b) =>
            b.score - a.score
        );

    /*
     * --------------------------------------------------------------
     * RECOMMENDED NEXT COURSE
     * --------------------------------------------------------------
     */

    const availableCourses =
      courses.filter(
        (course) =>
          !completedCourseIds.has(
            course.id
          )
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