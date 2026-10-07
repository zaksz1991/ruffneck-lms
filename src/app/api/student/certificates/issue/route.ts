import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Course = {
  id: string;
  title: string;
  slug: string;
  is_free: boolean;
};

type Enrollment = {
  id: string;
  enrollment_status: string;
  payment_status: string | null;
};

type CurriculumLesson = {
  lesson_id: string;
};

type LessonProgress = {
  lesson_id: string;
  completed: boolean;
};

type AssessmentAttempt = {
  id: string;
  score: number | null;
  total_points: number | null;
  earned_points: number | null;
  total_questions: number | null;
  completed_at: string | null;
  created_at: string;
};

type CourseProject = {
  id: string;
  project_type: string;
};

type ProjectSubmission = {
  id: string;
  project_id: string;
  score: number | null;
  status: string;
  reviewed_at: string | null;
};

type Profile = {
  full_name: string | null;
  email: string | null;
};

type Certificate = {
  id: string;
  certificate_number: string;
};

type VerificationRecord = {
  id: string;
  certificate_id: string;
  verification_code: string;
  is_active: boolean;
  expires_at: string | null;
};

function getAssessmentPercentage(
  attempt: AssessmentAttempt
): number {
  if (
    attempt.total_points !== null &&
    attempt.total_points > 0 &&
    attempt.earned_points !== null
  ) {
    return (attempt.earned_points / attempt.total_points) * 100;
  }

  if (
    attempt.total_questions !== null &&
    attempt.total_questions > 0 &&
    attempt.score !== null
  ) {
    return (attempt.score / attempt.total_questions) * 100;
  }

  if (attempt.score !== null) {
    return attempt.score;
  }

  return 0;
}

function errorResponse(
  stage: string,
  message: string,
  status = 500
) {
  return NextResponse.json(
    {
      ok: false,
      error: `Certificate issuance failed during ${stage}.`,
      stage,
      details: message,
    },
    { status }
  );
}

/**
 * Generate a high-entropy public verification code.
 *
 * Example:
 * RNVERIFY-7A9C4F2E8D1B6A03F51C9D27
 *
 * The code contains no student information and is safe
 * to expose publicly as a certificate verification identifier.
 */
function generateVerificationCode(): string {
  return `RNVERIFY-${randomBytes(16)
    .toString("hex")
    .toUpperCase()}`;
}

/**
 * Make sure an existing certificate has a verification record.
 *
 * This is intentionally idempotent:
 * - existing active verification -> reuse it
 * - existing inactive verification -> reactivate it
 * - no verification -> create one
 */
async function ensureVerificationRecord(
  admin: ReturnType<typeof createAdminClient>,
  certificateId: string
): Promise<{
  verification: VerificationRecord | null;
  error: string | null;
}> {
  const {
    data: existingData,
    error: existingError,
  } = await admin
    .from("certificate_verifications")
    .select(
      [
        "id",
        "certificate_id",
        "verification_code",
        "is_active",
        "expires_at",
      ].join(", ")
    )
    .eq("certificate_id", certificateId)
    .maybeSingle();

  if (existingError) {
    return {
      verification: null,
      error: existingError.message,
    };
  }

  const existing =
    existingData as VerificationRecord | null;

  if (existing) {
    if (!existing.is_active) {
      const {
        data: reactivatedData,
        error: reactivateError,
      } = await admin
        .from("certificate_verifications")
        .update({
          is_active: true,
        })
        .eq("id", existing.id)
        .select(
          [
            "id",
            "certificate_id",
            "verification_code",
            "is_active",
            "expires_at",
          ].join(", ")
        )
        .single();

      if (reactivateError) {
        return {
          verification: null,
          error: reactivateError.message,
        };
      }

      return {
        verification:
          reactivatedData as VerificationRecord,
        error: null,
      };
    }

    return {
      verification: existing,
      error: null,
    };
  }

  /*
   * Generate a new unique verification code.
   *
   * The database should already protect verification codes
   * with a uniqueness constraint. In the extremely unlikely
   * event of a collision, retry a few times.
   */
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const verificationCode =
      generateVerificationCode();

    const {
      data: insertedData,
      error: insertError,
    } = await admin
      .from("certificate_verifications")
      .insert({
        certificate_id: certificateId,
        verification_code: verificationCode,
        is_active: true,
      })
      .select(
        [
          "id",
          "certificate_id",
          "verification_code",
          "is_active",
          "expires_at",
        ].join(", ")
      )
      .single();

    if (!insertError && insertedData) {
      return {
        verification:
          insertedData as VerificationRecord,
        error: null,
      };
    }

    /*
     * 23505 = unique constraint violation.
     * Retry with another cryptographically random code.
     */
    if (insertError?.code === "23505") {
      continue;
    }

    return {
      verification: null,
      error:
        insertError?.message ||
        "Unable to create certificate verification record.",
    };
  }

  return {
    verification: null,
    error:
      "Unable to generate a unique certificate verification code.",
  };
}

export async function POST(request: Request) {
  let stage = "request validation";

  try {
    const supabase = await createClient();

    /*
     * ---------------------------------------------------------
     * 1. AUTHENTICATION
     * ---------------------------------------------------------
     */

    stage = "authentication";

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error(
        "[certificate] authentication error:",
        authError
      );

      return errorResponse(
        stage,
        authError.message ||
          "Unable to authenticate the user.",
        401
      );
    }

    if (!user) {
      return errorResponse(
        stage,
        "You must be logged in to claim a certificate.",
        401
      );
    }

    /*
     * ---------------------------------------------------------
     * 2. REQUEST BODY
     * ---------------------------------------------------------
     */

    stage = "request body";

    const body = await request.json().catch(() => null);

    const courseId =
      body &&
      typeof body.courseId === "string"
        ? body.courseId.trim()
        : "";

    if (!courseId) {
      return errorResponse(
        stage,
        "A valid courseId is required.",
        400
      );
    }

    const admin = createAdminClient();

    /*
     * ---------------------------------------------------------
     * 3. COURSE
     * ---------------------------------------------------------
     */

    stage = "course lookup";

    const {
      data: courseData,
      error: courseError,
    } = await admin
      .from("courses")
      .select("id, title, slug, is_free")
      .eq("id", courseId)
      .eq("status", "published")
      .maybeSingle();

    if (courseError) {
      console.error(
        "[certificate] course lookup:",
        courseError
      );

      return errorResponse(
        stage,
        courseError.message,
        500
      );
    }

    const course = courseData as Course | null;

    if (!course) {
      return errorResponse(
        stage,
        "The requested course does not exist or is not published.",
        404
      );
    }

    /*
     * ---------------------------------------------------------
     * 4. ENROLLMENT
     * ---------------------------------------------------------
     */

    stage = "enrollment lookup";

    const {
      data: enrollmentData,
      error: enrollmentError,
    } = await admin
      .from("enrollments")
      .select(
        "id, enrollment_status, payment_status"
      )
      .eq("student_id", user.id)
      .eq("course_id", courseId)
      .in("enrollment_status", [
        "active",
        "completed",
      ])
      .maybeSingle();

    if (enrollmentError) {
      console.error(
        "[certificate] enrollment lookup:",
        enrollmentError
      );

      return errorResponse(
        stage,
        enrollmentError.message,
        500
      );
    }

    const enrollment =
      enrollmentData as Enrollment | null;

    if (!enrollment) {
      return errorResponse(
        stage,
        "No active or completed enrollment was found for this course.",
        403
      );
    }

    /*
     * ---------------------------------------------------------
     * 5. PAYMENT
     * ---------------------------------------------------------
     */

    stage = "payment verification";

    if (course.is_free) {
      if (
        enrollment.payment_status !== null &&
        enrollment.payment_status !== "free"
      ) {
        return errorResponse(
          stage,
          `The free course has an unexpected payment status: ${enrollment.payment_status}.`,
          403
        );
      }
    } else {
      if (
        enrollment.payment_status !== null &&
        enrollment.payment_status !== "paid"
      ) {
        return errorResponse(
          stage,
          `The paid course has not been marked as paid. Current payment status: ${enrollment.payment_status}.`,
          403
        );
      }
    }

    /*
     * ---------------------------------------------------------
     * 6. PUBLISHED CURRICULUM
     * ---------------------------------------------------------
     */

    stage = "published curriculum lookup";

    const {
      data: curriculumData,
      error: curriculumError,
    } = await admin
      .from("course_curriculum")
      .select("lesson_id")
      .eq("course_id", courseId)
      .eq("is_published", true);

    if (curriculumError) {
      console.error(
        "[certificate] curriculum lookup:",
        curriculumError
      );

      return errorResponse(
        stage,
        curriculumError.message,
        500
      );
    }

    const curriculum =
      (curriculumData ?? []) as CurriculumLesson[];

    const lessonIds = curriculum
      .map((lesson) => lesson.lesson_id)
      .filter(Boolean);

    if (lessonIds.length === 0) {
      return errorResponse(
        stage,
        "This course has no published lessons, so certificate eligibility cannot be verified.",
        400
      );
    }

    /*
     * ---------------------------------------------------------
     * 7. LESSON COMPLETION
     * ---------------------------------------------------------
     */

    stage = "lesson completion verification";

    const {
      data: progressData,
      error: progressError,
    } = await admin
      .from("lesson_progress")
      .select("lesson_id, completed")
      .eq("student_id", user.id)
      .eq("course_id", courseId)
      .eq("completed", true)
      .in("lesson_id", lessonIds);

    if (progressError) {
      console.error(
        "[certificate] lesson progress:",
        progressError
      );

      return errorResponse(
        stage,
        progressError.message,
        500
      );
    }

    const completedLessons =
      (progressData ?? []) as LessonProgress[];

    const completedLessonIds = new Set(
      completedLessons.map(
        (lesson) => lesson.lesson_id
      )
    );

    const incompleteLessons = lessonIds.filter(
      (lessonId) =>
        !completedLessonIds.has(lessonId)
    );

    if (incompleteLessons.length > 0) {
      return errorResponse(
        stage,
        `${incompleteLessons.length} published lesson(s) are not completed.`,
        403
      );
    }

    /*
     * ---------------------------------------------------------
     * 8. ASSESSMENT
     * ---------------------------------------------------------
     */

    stage = "assessment lookup";

    const {
      data: assessmentData,
      error: assessmentError,
    } = await admin
      .from("assessment_attempts")
      .select(
        [
          "id",
          "score",
          "total_points",
          "earned_points",
          "total_questions",
          "completed_at",
          "created_at",
        ].join(", ")
      )
      .eq("student_id", user.id)
      .eq("course_id", courseId)
      .not("completed_at", "is", null)
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (assessmentError) {
      console.error(
        "[certificate] assessment lookup:",
        assessmentError
      );

      return errorResponse(
        stage,
        assessmentError.message,
        500
      );
    }

    const assessment =
      assessmentData as AssessmentAttempt | null;

    if (!assessment) {
      return errorResponse(
        stage,
        "No completed assessment attempt was found.",
        403
      );
    }

    const assessmentPercentage =
      getAssessmentPercentage(assessment);

    if (assessmentPercentage < 70) {
      return errorResponse(
        stage,
        `Assessment score is ${Math.round(
          assessmentPercentage
        )}%. A minimum score of 70% is required.`,
        403
      );
    }

    /*
     * ---------------------------------------------------------
     * 9. PUBLISHED CAPSTONE
     * ---------------------------------------------------------
     */

    stage = "capstone lookup";

    const {
      data: projectData,
      error: projectError,
    } = await admin
      .from("course_projects")
      .select("id, project_type")
      .eq("course_id", courseId)
      .eq("project_type", "capstone")
      .eq("is_published", true);

    if (projectError) {
      console.error(
        "[certificate] capstone lookup:",
        projectError
      );

      return errorResponse(
        stage,
        projectError.message,
        500
      );
    }

    const projects =
      (projectData ?? []) as CourseProject[];

    if (projects.length === 0) {
      return errorResponse(
        stage,
        "No published capstone was found for this course.",
        403
      );
    }

    /*
     * ---------------------------------------------------------
     * 10. APPROVED CAPSTONE SUBMISSION
     * ---------------------------------------------------------
     */

    stage =
      "capstone submission verification";

    const projectIds = projects
      .map((project) => project.id)
      .filter(Boolean);

    const {
      data: submissionData,
      error: submissionError,
    } = await admin
      .from("project_submissions")
      .select(
        "id, project_id, score, status, reviewed_at"
      )
      .in("project_id", projectIds)
      .eq("student_id", user.id)
      .eq("status", "approved")
      .order("reviewed_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (submissionError) {
      console.error(
        "[certificate] capstone submission:",
        submissionError
      );

      return errorResponse(
        stage,
        submissionError.message,
        500
      );
    }

    const submission =
      submissionData as ProjectSubmission | null;

    if (!submission) {
      return errorResponse(
        stage,
        "No approved capstone submission was found.",
        403
      );
    }

    const capstoneScore =
      submission.score !== null
        ? Math.round(submission.score)
        : null;

    if (
      capstoneScore !== null &&
      (capstoneScore < 0 ||
        capstoneScore > 100)
    ) {
      return errorResponse(
        stage,
        `The approved capstone score is ${capstoneScore}, which is outside the allowed 0–100 range.`,
        500
      );
    }

    /*
     * ---------------------------------------------------------
     * 11. PROFILE
     * ---------------------------------------------------------
     */

    stage = "profile lookup";

    const {
      data: profileData,
      error: profileError,
    } = await admin
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error(
        "[certificate] profile lookup:",
        profileError
      );

      return errorResponse(
        stage,
        profileError.message,
        500
      );
    }

    const profile =
      profileData as Profile | null;

    const holderName =
      profile?.full_name?.trim() ||
      profile?.email?.trim() ||
      user.email?.trim() ||
      "RuffNeck Learn Student";

    /*
     * ---------------------------------------------------------
     * 12. EXISTING CERTIFICATE
     * ---------------------------------------------------------
     *
     * If the certificate already exists, do not create a
     * duplicate. Instead, make sure its public verification
     * record exists.
     */

    stage = "existing certificate lookup";

    const {
      data: existingCertificateData,
      error: existingCertificateError,
    } = await admin
      .from("course_certificates")
      .select("id, certificate_number")
      .eq("student_id", user.id)
      .eq("course_id", courseId)
      .maybeSingle();

    if (existingCertificateError) {
      console.error(
        "[certificate] existing certificate lookup:",
        existingCertificateError
      );

      return errorResponse(
        stage,
        existingCertificateError.message,
        500
      );
    }

    const existingCertificate =
      existingCertificateData as Certificate | null;

    if (existingCertificate) {
      stage = "verification record";

      const {
        verification,
        error: verificationError,
      } = await ensureVerificationRecord(
        admin,
        existingCertificate.id
      );

      if (verificationError) {
        console.error(
          "[certificate] existing verification:",
          verificationError
        );

        return errorResponse(
          stage,
          verificationError,
          500
        );
      }

      return NextResponse.json({
        ok: true,
        certificateId: existingCertificate.id,
        certificateNumber:
          existingCertificate.certificate_number,
        verificationCode:
          verification?.verification_code ?? null,
        alreadyIssued: true,
      });
    }

    /*
     * ---------------------------------------------------------
     * 13. ISSUE CERTIFICATE
     * ---------------------------------------------------------
     */

    stage = "certificate insertion";

    const {
      data: insertedCertificateData,
      error: certificateError,
    } = await admin
      .from("course_certificates")
      .insert({
        student_id: user.id,
        course_id: course.id,
        holder_name: holderName,
        course_title: course.title,
        course_slug: course.slug,
        assessment_score: Math.round(
          assessmentPercentage
        ),
        capstone_score: capstoneScore,
        is_revoked: false,
      })
      .select("id, certificate_number")
      .single();

    if (certificateError) {
      console.error(
        "[certificate] INSERT ERROR:",
        certificateError
      );

      /*
       * Another request may have issued the certificate
       * between the existing-certificate check and INSERT.
       */
      if (certificateError.code === "23505") {
        const {
          data: duplicateCertificate,
          error: duplicateLookupError,
        } = await admin
          .from("course_certificates")
          .select("id, certificate_number")
          .eq("student_id", user.id)
          .eq("course_id", courseId)
          .maybeSingle();

        if (duplicateLookupError) {
          console.error(
            "[certificate] duplicate lookup:",
            duplicateLookupError
          );

          return errorResponse(
            stage,
            duplicateLookupError.message,
            500
          );
        }

        if (duplicateCertificate) {
          stage = "verification record";

          const {
            verification,
            error: verificationError,
          } = await ensureVerificationRecord(
            admin,
            duplicateCertificate.id
          );

          if (verificationError) {
            console.error(
              "[certificate] duplicate verification:",
              verificationError
            );

            return errorResponse(
              stage,
              verificationError,
              500
            );
          }

          return NextResponse.json({
            ok: true,
            certificateId:
              duplicateCertificate.id,
            certificateNumber:
              duplicateCertificate.certificate_number,
            verificationCode:
              verification?.verification_code ??
              null,
            alreadyIssued: true,
          });
        }
      }

      return errorResponse(
        stage,
        [
          `Database error code: ${
            certificateError.code || "unknown"
          }`,
          `Message: ${
            certificateError.message ||
            "Unknown database error."
          }`,
          certificateError.details
            ? `Details: ${certificateError.details}`
            : "",
          certificateError.hint
            ? `Hint: ${certificateError.hint}`
            : "",
        ]
          .filter(Boolean)
          .join(" | "),
        500
      );
    }

    const insertedCertificate =
      insertedCertificateData as Certificate;

    /*
     * ---------------------------------------------------------
     * 14. CREATE PUBLIC VERIFICATION RECORD
     * ---------------------------------------------------------
     */

    stage = "verification record";

    const {
      verification,
      error: verificationError,
    } = await ensureVerificationRecord(
      admin,
      insertedCertificate.id
    );

    if (verificationError) {
      console.error(
        "[certificate] verification creation:",
        verificationError
      );

      /*
       * The certificate itself has already been issued.
       * Return the certificate ID rather than pretending
       * certificate issuance failed completely.
       *
       * The certificate page can also display the existing
       * credential while the verification record is repaired.
       */
      return NextResponse.json(
        {
          ok: true,
          certificateId:
            insertedCertificate.id,
          certificateNumber:
            insertedCertificate.certificate_number,
          verificationCode: null,
          alreadyIssued: false,
          verificationPending: true,
          verificationError,
        },
        { status: 200 }
      );
    }

    /*
     * ---------------------------------------------------------
     * SUCCESS
     * ---------------------------------------------------------
     */

    return NextResponse.json({
      ok: true,
      certificateId: insertedCertificate.id,
      certificateNumber:
        insertedCertificate.certificate_number,
      verificationCode:
        verification?.verification_code ?? null,
      alreadyIssued: false,
      verificationPending: false,
    });
  } catch (error) {
    console.error(
      "[certificate] UNHANDLED ERROR:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : String(error);

    return errorResponse(
      stage,
      message || "Unknown server error.",
      500
    );
  }
}