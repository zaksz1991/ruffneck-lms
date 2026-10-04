import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Course = {
  id: string;
  title: string;
  slug: string;
};

type Assessment = {
  score: number | null;
};

type Project = {
  id: string;
};

type ApprovedSubmission = {
  score: number | null;
};

type CurriculumLesson = {
  lesson_id: string;
};

export async function POST(
  request: Request
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error:
            "Authentication required.",
        },
        {
          status: 401,
        }
      );
    }

    let body: {
      courseId?: string;
    };

    try {
      body =
        (await request.json()) as {
          courseId?: string;
        };
    } catch {
      return NextResponse.json(
        {
          error:
            "Invalid request body.",
        },
        {
          status: 400,
        }
      );
    }

    const courseId = body.courseId;

    if (!courseId) {
      return NextResponse.json(
        {
          error:
            "Course ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * --------------------------------------------------------------
     * COURSE
     * --------------------------------------------------------------
     */

    const {
      data: courseData,
      error: courseError,
    } = await supabase
      .from("courses")
      .select(
        "id, title, slug"
      )
      .eq("id", courseId)
      .eq("status", "published")
      .maybeSingle();

    if (courseError) {
      console.error(
        "Certificate course lookup failed:",
        courseError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify the course.",
        },
        {
          status: 500,
        }
      );
    }

    const course =
      courseData as unknown as Course | null;

    if (!course) {
      return NextResponse.json(
        {
          error:
            "Course not found.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * --------------------------------------------------------------
     * ENROLLMENT
     * --------------------------------------------------------------
     *
     * Enrollment is required, but enrollment_status is NOT used
     * as the source of truth for course completion.
     *
     * Actual completion is verified below from the published
     * curriculum and lesson_progress.
     */

    const {
      data: enrollment,
      error: enrollmentError,
    } = await supabase
      .from("enrollments")
      .select(
        "id, enrollment_status"
      )
      .eq("student_id", user.id)
      .eq("course_id", courseId)
      .maybeSingle();

    if (enrollmentError) {
      console.error(
        "Certificate enrollment lookup failed:",
        enrollmentError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify your enrollment.",
        },
        {
          status: 500,
        }
      );
    }

    if (!enrollment) {
      return NextResponse.json(
        {
          error:
            "You must be enrolled in this course before requesting a certificate.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * --------------------------------------------------------------
     * PUBLISHED CURRICULUM
     * --------------------------------------------------------------
     *
     * course_curriculum is the canonical curriculum used by the
     * learning experience.
     */

    const {
      data: curriculumData,
      error: curriculumError,
    } = await supabase
      .from("course_curriculum")
      .select(
        "lesson_id"
      )
      .eq("course_id", courseId)
      .eq("is_published", true);

    if (curriculumError) {
      console.error(
        "Certificate curriculum lookup failed:",
        curriculumError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify course curriculum.",
        },
        {
          status: 500,
        }
      );
    }

    const curriculum =
      (curriculumData || []) as CurriculumLesson[];

    const publishedLessonIds =
      new Set(
        curriculum.map(
          (lesson) =>
            lesson.lesson_id
        )
      );

    const totalPublishedLessons =
      publishedLessonIds.size;

    if (totalPublishedLessons === 0) {
      return NextResponse.json(
        {
          error:
            "This course does not have any published curriculum lessons.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * --------------------------------------------------------------
     * COMPLETED LESSONS
     * --------------------------------------------------------------
     *
     * Only completed lessons that actually belong to the published
     * curriculum count toward certificate eligibility.
     */

    const {
      data: completedProgressData,
      error: completedProgressError,
    } = await supabase
      .from("lesson_progress")
      .select(
        "lesson_id"
      )
      .eq("student_id", user.id)
      .eq("course_id", courseId)
      .eq("completed", true);

    if (completedProgressError) {
      console.error(
        "Certificate lesson progress lookup failed:",
        completedProgressError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify lesson completion.",
        },
        {
          status: 500,
        }
      );
    }

    const completedCurriculumLessonIds =
      new Set(
        (
          completedProgressData || []
        )
          .map(
            (row) =>
              row.lesson_id as string
          )
          .filter((lessonId) =>
            publishedLessonIds.has(
              lessonId
            )
          )
      );

    const completedLessons =
      completedCurriculumLessonIds.size;

    /*
     * Every published curriculum lesson must be completed.
     */
    if (
      completedLessons <
      totalPublishedLessons
    ) {
      return NextResponse.json(
        {
          error:
            "Complete all published lessons before requesting a certificate.",
          completedLessons,
          totalLessons:
            totalPublishedLessons,
          progressPercent: Math.round(
            (completedLessons /
              totalPublishedLessons) *
              100
          ),
        },
        {
          status: 403,
        }
      );
    }

    /*
     * --------------------------------------------------------------
     * ASSESSMENT
     * --------------------------------------------------------------
     */

    const {
      data: assessmentData,
      error: assessmentError,
    } = await supabase
      .from("assessment_attempts")
      .select("score")
      .eq(
        "student_id",
        user.id
      )
      .eq(
        "course_id",
        courseId
      )
      .order(
        "completed_at",
        {
          ascending: false,
        }
      )
      .limit(1)
      .maybeSingle();

    if (assessmentError) {
      console.error(
        "Certificate assessment lookup failed:",
        assessmentError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify your course assessment.",
        },
        {
          status: 500,
        }
      );
    }

    const assessment =
      assessmentData as unknown as Assessment | null;

    if (!assessment) {
      return NextResponse.json(
        {
          error:
            "Complete the course assessment before requesting a certificate.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * --------------------------------------------------------------
     * PUBLISHED CAPSTONE
     * --------------------------------------------------------------
     */

    const {
      data: projectsData,
      error: projectsError,
    } = await supabase
      .from("course_projects")
      .select("id")
      .eq(
        "course_id",
        courseId
      )
      .eq(
        "is_published",
        true
      );

    if (projectsError) {
      console.error(
        "Certificate project lookup failed:",
        projectsError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify the course capstone.",
        },
        {
          status: 500,
        }
      );
    }

    const projects =
      (projectsData || []) as Project[];

    const projectIds =
      projects.map(
        (project) => project.id
      );

    if (projectIds.length === 0) {
      return NextResponse.json(
        {
          error:
            "This course does not have a published capstone.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * --------------------------------------------------------------
     * APPROVED CAPSTONE
     * --------------------------------------------------------------
     */

    const {
      data: approvedData,
      error: approvedError,
    } = await supabase
      .from("project_submissions")
      .select("score")
      .in(
        "project_id",
        projectIds
      )
      .eq(
        "student_id",
        user.id
      )
      .eq(
        "status",
        "approved"
      )
      .order(
        "reviewed_at",
        {
          ascending: false,
        }
      )
      .limit(1)
      .maybeSingle();

    if (approvedError) {
      console.error(
        "Certificate capstone lookup failed:",
        approvedError
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify your capstone.",
        },
        {
          status: 500,
        }
      );
    }

    const approved =
      approvedData as unknown as ApprovedSubmission | null;

    if (!approved) {
      return NextResponse.json(
        {
          error:
            "Your capstone must be approved before a certificate can be issued.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * --------------------------------------------------------------
     * LEARNER PROFILE
     * --------------------------------------------------------------
     */

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select(
        "full_name, email"
      )
      .eq(
        "id",
        user.id
      )
      .maybeSingle();

    if (profileError) {
      console.error(
        "Certificate profile lookup failed:",
        profileError
      );

      return NextResponse.json(
        {
          error:
            "Unable to load your learner profile.",
        },
        {
          status: 500,
        }
      );
    }

    const holderName =
      profile?.full_name ||
      profile?.email ||
      "Learner";

    /*
     * --------------------------------------------------------------
     * EXISTING CERTIFICATE
     * --------------------------------------------------------------
     *
     * Issuing is idempotent. A learner requesting the same certificate
     * again receives the existing certificate instead of a duplicate.
     */

    const {
      data: existing,
      error: existingError,
    } = await supabase
      .from("course_certificates")
      .select(
        "id, certificate_number"
      )
      .eq(
        "student_id",
        user.id
      )
      .eq(
        "course_id",
        courseId
      )
      .maybeSingle();

    if (existingError) {
      console.error(
        "Certificate lookup failed:",
        existingError
      );

      return NextResponse.json(
        {
          error:
            "Unable to check existing certificate.",
        },
        {
          status: 500,
        }
      );
    }

    if (existing) {
      return NextResponse.json({
        certificateId:
          existing.id,
        certificateNumber:
          existing.certificate_number,
      });
    }

    /*
     * --------------------------------------------------------------
     * ISSUE CERTIFICATE
     * --------------------------------------------------------------
     */

    const {
      data: certificate,
      error: certificateError,
    } = await supabase
      .from("course_certificates")
      .insert({
        student_id: user.id,
        course_id: courseId,
        holder_name: holderName,
        course_title: course.title,
        course_slug: course.slug,
        assessment_score:
          assessment.score,
        capstone_score:
          approved.score,
        is_revoked: false,
      })
      .select(
        "id, certificate_number"
      )
      .single();

    if (
      certificateError ||
      !certificate
    ) {
      console.error(
        "Certificate issuance failed:",
        certificateError
      );

      return NextResponse.json(
        {
          error:
            certificateError?.message ||
            "Unable to issue certificate.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      certificateId:
        certificate.id,
      certificateNumber:
        certificate.certificate_number,
    });
  } catch (error) {
    console.error(
      "Certificate issuance error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to issue certificate.",
      },
      {
        status: 500,
      }
    );
  }
}