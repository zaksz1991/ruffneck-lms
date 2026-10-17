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

type PublishedLesson = {
  id: string;
  course_id: string;
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
  is_revoked: boolean;
};

type VerificationRecord = {
  id: string;
  certificate_id: string;
  verification_code: string;
  is_active: boolean;
  expires_at: string | null;
};

function getAssessmentPercentage(
  attempt: AssessmentAttempt,
): number | null {
  const hasEarnedPoints =
    attempt.earned_points !== null;

  const hasTotalPoints =
    attempt.total_points !== null;

  if (hasEarnedPoints || hasTotalPoints) {
    if (
      typeof attempt.earned_points !== "number" ||
      typeof attempt.total_points !== "number" ||
      !Number.isFinite(attempt.earned_points) ||
      !Number.isFinite(attempt.total_points) ||
      attempt.total_points <= 0 ||
      attempt.earned_points < 0 ||
      attempt.earned_points > attempt.total_points
    ) {
      return null;
    }

    return (
      (attempt.earned_points / attempt.total_points) * 100
    );
  }

  if (
    typeof attempt.score === "number" &&
    Number.isFinite(attempt.score) &&
    attempt.score >= 0 &&
    attempt.score <= 100 &&
    typeof attempt.total_questions === "number" &&
    attempt.total_questions > 0
  ) {
    // Legacy records without point totals may store score
    // as an already-calculated percentage.
    return attempt.score;
  }

  return null;
}

function generateVerificationCode() {
  return `RNVERIFY-${randomBytes(16)
    .toString("hex")
    .toUpperCase()}`;
}

async function ensureVerificationRecord(
  admin: ReturnType<typeof createAdminClient>,
  certificateId: string,
) {
  const { data: existingData, error: existingError } =
    await admin
      .from("certificate_verifications")
      .select(
        "id, certificate_id, verification_code, is_active, expires_at",
      )
      .eq("certificate_id", certificateId)
      .maybeSingle();

  if (existingError) {
    return {
      verification: null,
      error: existingError,
    };
  }

  const existingVerification =
    existingData as unknown as VerificationRecord | null;

  if (existingVerification) {
    if (!existingVerification.is_active) {
      const {
        data: reactivatedData,
        error: reactivateError,
      } = await admin
        .from("certificate_verifications")
        .update({ is_active: true })
        .eq("id", existingVerification.id)
        .select(
          "id, certificate_id, verification_code, is_active, expires_at",
        )
        .single();

      if (reactivateError) {
        return {
          verification: null,
          error: reactivateError,
        };
      }

      return {
        verification:
          reactivatedData as unknown as VerificationRecord,
        error: null,
      };
    }

    return {
      verification: existingVerification,
      error: null,
    };
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const verificationCode = generateVerificationCode();

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
        "id, certificate_id, verification_code, is_active, expires_at",
      )
      .single();

    if (!insertError && insertedData) {
      return {
        verification:
          insertedData as unknown as VerificationRecord,
        error: null,
      };
    }

    if (insertError?.code !== "23505") {
      return {
        verification: null,
        error: insertError,
      };
    }

    const {
      data: retryData,
      error: retryError,
    } = await admin
      .from("certificate_verifications")
      .select(
        "id, certificate_id, verification_code, is_active, expires_at",
      )
      .eq("certificate_id", certificateId)
      .maybeSingle();

    if (retryError) {
      return {
        verification: null,
        error: retryError,
      };
    }

    if (retryData) {
      return {
        verification:
          retryData as unknown as VerificationRecord,
        error: null,
      };
    }
  }

  return {
    verification: null,
    error: new Error(
      "Unable to create a unique certificate verification record.",
    ),
  };
}

function errorResponse(
  error: string,
  stage: string,
  status: number,
) {
  return NextResponse.json(
    { ok: false, error, stage },
    { status },
  );
}

export async function POST(request: Request) {
  let stage = "request body";

  try {
    const supabase = await createClient();

    stage = "authentication";

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse(
        "You must be signed in to issue a certificate.",
        stage,
        401,
      );
    }

    stage = "request body";

    let body: { courseId?: unknown };

    try {
      body = await request.json();
    } catch {
      return errorResponse(
        "The request body must contain valid JSON.",
        stage,
        400,
      );
    }

    const courseId =
      typeof body?.courseId === "string"
        ? body.courseId.trim()
        : "";

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        courseId,
      )
    ) {
      return errorResponse(
        "A valid course ID is required.",
        stage,
        400,
      );
    }

    const admin = createAdminClient();

    stage = "course lookup";

    const { data: courseData, error: courseError } =
      await admin
        .from("courses")
        .select("id, title, slug, is_free")
        .eq("id", courseId)
        .eq("status", "published")
        .maybeSingle();

    if (courseError) {
      console.error("Certificate course lookup failed:", courseError);

      return errorResponse(
        "Unable to load the course.",
        stage,
        500,
      );
    }

    const course = courseData as Course | null;

    if (!course) {
      return errorResponse(
        "Course not found or not published.",
        stage,
        404,
      );
    }

    stage = "enrollment lookup";

    const {
      data: enrollmentData,
      error: enrollmentError,
    } = await admin
      .from("enrollments")
      .select("id, enrollment_status, payment_status")
      .eq("student_id", user.id)
      .eq("course_id", course.id)
      .in("enrollment_status", ["active", "completed"])
      .limit(2);

    if (enrollmentError) {
      console.error("Certificate enrollment lookup failed:", enrollmentError);

      return errorResponse(
        "Unable to verify your enrollment.",
        stage,
        500,
      );
    }

    const enrollments =
      (enrollmentData ?? []) as Enrollment[];

    if (enrollments.length !== 1) {
      return errorResponse(
        enrollments.length === 0
          ? "You must be enrolled in this course before receiving a certificate."
          : "Multiple matching enrollments were found. Please contact support.",
        stage,
        enrollments.length === 0 ? 403 : 409,
      );
    }

    const enrollment = enrollments[0];

    stage = "payment verification";

    if (
      !course.is_free &&
      enrollment.payment_status !== "paid"
    ) {
      return errorResponse(
        "Payment must be completed before a certificate can be issued.",
        stage,
        403,
      );
    }

    stage = "published curriculum lookup";

    const {
      data: curriculumData,
      error: curriculumError,
    } = await admin
      .from("course_curriculum")
      .select("lesson_id")
      .eq("course_id", course.id)
      .eq("is_published", true);

    if (curriculumError) {
      console.error("Certificate curriculum lookup failed:", curriculumError);

      return errorResponse(
        "Unable to verify the published course lessons.",
        stage,
        500,
      );
    }

    const curriculum =
      (curriculumData ?? []) as CurriculumLesson[];

    const curriculumLessonIds = [
      ...new Set(
        curriculum
          .map((lesson) => lesson.lesson_id)
          .filter(
            (id): id is string =>
              typeof id === "string" && id.length > 0,
          ),
      ),
    ];

    if (curriculumLessonIds.length === 0) {
      return errorResponse(
        "This course does not currently have published lessons.",
        stage,
        400,
      );
    }

    stage = "published lesson verification";

    const { data: publishedLessonsData, error: publishedLessonsError } =
      await admin
        .from("lessons")
        .select("id, course_id")
        .eq("course_id", course.id)
        .eq("is_published", true)
        .in("id", curriculumLessonIds);

    if (publishedLessonsError) {
      console.error("Published lesson verification failed:", publishedLessonsError);

      return errorResponse(
        "Unable to verify published lessons.",
        stage,
        500,
      );
    }

    const publishedLessons =
      (publishedLessonsData ?? []) as PublishedLesson[];

    const lessonIds = [
      ...new Set(publishedLessons.map((lesson) => lesson.id)),
    ];

    if (
      lessonIds.length !== curriculumLessonIds.length ||
      lessonIds.length === 0
    ) {
      return errorResponse(
        "The published curriculum contains unpublished or mismatched lessons. Please contact the course administrator.",
        stage,
        409,
      );
    }

    stage = "lesson completion verification";

    const { data: progressData, error: progressError } =
      await admin
        .from("lesson_progress")
        .select("lesson_id")
        .eq("student_id", user.id)
        .eq("course_id", course.id)
        .eq("completed", true)
        .in("lesson_id", lessonIds);

    if (progressError) {
      console.error("Lesson completion verification failed:", progressError);

      return errorResponse(
        "Unable to verify your lesson completion.",
        stage,
        500,
      );
    }

    const completedLessonIds = new Set(
      (progressData ?? []).map(
        (lesson: { lesson_id: string }) => lesson.lesson_id,
      ),
    );

    if (
      lessonIds.some((lessonId) => !completedLessonIds.has(lessonId))
    ) {
      return errorResponse(
        "All published lessons must be completed before the certificate can be issued.",
        stage,
        403,
      );
    }

    stage = "assessment verification";

    const {
      data: assessmentData,
      error: assessmentError,
    } = await admin
      .from("assessment_attempts")
      .select(
        "id, score, total_points, earned_points, total_questions, completed_at, created_at",
      )
      .eq("student_id", user.id)
      .eq("course_id", course.id)
      .not("completed_at", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (assessmentError) {
      console.error("Assessment verification failed:", assessmentError);

      return errorResponse(
        "Unable to verify your assessment result.",
        stage,
        500,
      );
    }

    const assessment =
      assessmentData as AssessmentAttempt | null;

    if (!assessment) {
      return errorResponse(
        "A completed assessment is required before the certificate can be issued.",
        stage,
        403,
      );
    }

    const assessmentPercentage =
      getAssessmentPercentage(assessment);

    if (
      assessmentPercentage === null ||
      assessmentPercentage < 70
    ) {
      return errorResponse(
        "A valid assessment result of at least 70% is required before the certificate can be issued.",
        stage,
        403,
      );
    }

    stage = "capstone lookup";

    const { data: projectData, error: projectError } =
      await admin
        .from("course_projects")
        .select("id, project_type")
        .eq("course_id", course.id)
        .eq("project_type", "capstone")
        .eq("is_published", true)
        .limit(2);

    if (projectError) {
      console.error("Capstone lookup failed:", projectError);

      return errorResponse(
        "Unable to verify the course capstone.",
        stage,
        500,
      );
    }

    const projects = (projectData ?? []) as CourseProject[];

    if (projects.length !== 1) {
      return errorResponse(
        projects.length === 0
          ? "The course capstone is not currently available."
          : "Multiple published capstone projects were found. Please contact the course administrator.",
        stage,
        409,
      );
    }

    const capstoneProject = projects[0];

    stage = "capstone approval verification";

    const {
      data: submissionData,
      error: submissionError,
    } = await admin
      .from("project_submissions")
      .select("id, score, status, reviewed_at")
      .eq("project_id", capstoneProject.id)
      .eq("student_id", user.id)
      .eq("status", "approved")
      .not("reviewed_at", "is", null)
      .order("reviewed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (submissionError) {
      console.error("Capstone approval verification failed:", submissionError);

      return errorResponse(
        "Unable to verify your capstone approval.",
        stage,
        500,
      );
    }

    const submission =
      submissionData as ProjectSubmission | null;

    if (!submission) {
      return errorResponse(
        "An approved and reviewed capstone submission is required before the certificate can be issued.",
        stage,
        403,
      );
    }

    stage = "profile lookup";

    const { data: profileData, error: profileError } =
      await admin
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {
      console.error("Certificate profile lookup failed:", profileError);

      return errorResponse(
        "Unable to load your learner profile.",
        stage,
        500,
      );
    }

    const profile = profileData as Profile | null;

    const holderName =
      profile?.full_name?.trim() ||
      profile?.email?.trim() ||
      user.email?.trim() ||
      "RuffNeck Learn Student";

    const capstoneScore =
      typeof submission.score === "number" &&
      Number.isFinite(submission.score) &&
      submission.score >= 0 &&
      submission.score <= 100
        ? Math.round(submission.score)
        : null;

    stage = "existing certificate lookup";

    const {
      data: existingCertificateData,
      error: existingCertificateError,
    } = await admin
      .from("course_certificates")
      .select("id, certificate_number, is_revoked")
      .eq("student_id", user.id)
      .eq("course_id", course.id)
      .maybeSingle();

    if (existingCertificateError) {
      console.error("Existing certificate lookup failed:", existingCertificateError);

      return errorResponse(
        "Unable to check for an existing certificate.",
        stage,
        500,
      );
    }

    const existingCertificate =
      existingCertificateData as Certificate | null;

    if (existingCertificate) {
      if (existingCertificate.is_revoked) {
        return errorResponse(
          "Your existing certificate has been revoked. Please contact RuffNeck Learn support.",
          stage,
          403,
        );
      }

      stage = "verification record";

      const {
        verification,
        error: verificationError,
      } = await ensureVerificationRecord(
        admin,
        existingCertificate.id,
      );

      if (verificationError) {
        console.error("Existing certificate verification setup failed:", verificationError);

        return NextResponse.json(
          {
            ok: true,
            certificateId: existingCertificate.id,
            certificateNumber: existingCertificate.certificate_number,
            alreadyIssued: true,
            verificationPending: true,
          },
          { status: 200 },
        );
      }

      return NextResponse.json(
        {
          ok: true,
          certificateId: existingCertificate.id,
          certificateNumber: existingCertificate.certificate_number,
          verificationCode: verification?.verification_code ?? null,
          alreadyIssued: true,
        },
        { status: 200 },
      );
    }

    stage = "certificate creation";

    const {
      data: insertedCertificateData,
      error: insertCertificateError,
    } = await admin
      .from("course_certificates")
      .insert({
        student_id: user.id,
        course_id: course.id,
        holder_name: holderName,
        course_title: course.title,
        course_slug: course.slug,
        assessment_score: Math.round(assessmentPercentage),
        capstone_score: capstoneScore,
        is_revoked: false,
      })
      .select("id, certificate_number, is_revoked")
      .single();

    if (insertCertificateError) {
      if (insertCertificateError.code === "23505") {
        const {
          data: duplicateData,
          error: duplicateError,
        } = await admin
          .from("course_certificates")
          .select("id, certificate_number, is_revoked")
          .eq("student_id", user.id)
          .eq("course_id", course.id)
          .maybeSingle();

        if (duplicateError) {
          console.error("Duplicate certificate lookup failed:", duplicateError);

          return errorResponse(
            "The certificate already exists, but it could not be loaded.",
            stage,
            500,
          );
        }

        const duplicateCertificate =
          duplicateData as Certificate | null;

        if (!duplicateCertificate) {
          return errorResponse(
            "The certificate record conflicted with another request. Please try again.",
            stage,
            409,
          );
        }

        if (duplicateCertificate.is_revoked) {
          return errorResponse(
            "Your existing certificate has been revoked. Please contact RuffNeck Learn support.",
            stage,
            403,
          );
        }

        stage = "verification record";

        const {
          verification,
          error: verificationError,
        } = await ensureVerificationRecord(
          admin,
          duplicateCertificate.id,
        );

        if (verificationError) {
          console.error("Duplicate certificate verification setup failed:", verificationError);

          return NextResponse.json(
            {
              ok: true,
              certificateId: duplicateCertificate.id,
              certificateNumber: duplicateCertificate.certificate_number,
              alreadyIssued: true,
              verificationPending: true,
            },
            { status: 200 },
          );
        }

        return NextResponse.json(
          {
            ok: true,
            certificateId: duplicateCertificate.id,
            certificateNumber: duplicateCertificate.certificate_number,
            verificationCode: verification?.verification_code ?? null,
            alreadyIssued: true,
          },
          { status: 200 },
        );
      }

      console.error("Certificate creation failed:", insertCertificateError);

      return errorResponse(
        "Unable to issue the certificate.",
        stage,
        500,
      );
    }

    const certificate =
      insertedCertificateData as Certificate;

    stage = "verification record";

    const {
      verification,
      error: verificationError,
    } = await ensureVerificationRecord(
      admin,
      certificate.id,
    );

    if (verificationError) {
      console.error("New certificate verification setup failed:", verificationError);

      return NextResponse.json(
        {
          ok: true,
          certificateId: certificate.id,
          certificateNumber: certificate.certificate_number,
          alreadyIssued: false,
          verificationPending: true,
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        certificateId: certificate.id,
        certificateNumber: certificate.certificate_number,
        verificationCode: verification?.verification_code ?? null,
        alreadyIssued: false,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Certificate issuance failed:", {
      stage,
      error,
    });

    return NextResponse.json(
      {
        ok: false,
        error: `Certificate issuance failed during ${stage}.`,
        stage,
      },
      { status: 500 },
    );
  }
}