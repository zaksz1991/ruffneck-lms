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
) {
  if (
    typeof attempt.total_points === "number" &&
    attempt.total_points > 0 &&
    typeof attempt.earned_points === "number"
  ) {
    return (
      (attempt.earned_points / attempt.total_points) * 100
    );
  }

  if (
    typeof attempt.total_questions === "number" &&
    attempt.total_questions > 0 &&
    typeof attempt.score === "number"
  ) {
    return (
      (attempt.score / attempt.total_questions) * 100
    );
  }

  if (typeof attempt.score === "number") {
    return attempt.score;
  }

  return 0;
}

function generateVerificationCode() {
  return `RNVERIFY-${randomBytes(16)
    .toString("hex")
    .toUpperCase()}`;
}

async function ensureVerificationRecord(
  admin: ReturnType<typeof createAdminClient>,
  certificateId: string
) {
  const { data: existingData, error: existingError } =
    await admin
      .from("certificate_verifications")
      .select(
        "id, certificate_id, verification_code, is_active, expires_at"
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
        .update({
          is_active: true,
        })
        .eq("id", existingVerification.id)
        .select(
          "id, certificate_id, verification_code, is_active, expires_at"
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
      verification:
        existingVerification as unknown as VerificationRecord,
      error: null,
    };
  }

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
        "id, certificate_id, verification_code, is_active, expires_at"
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
        "id, certificate_id, verification_code, is_active, expires_at"
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
      "Unable to create a unique certificate verification record."
    ),
  };
}

export async function POST(request: Request) {
  let stage = "request body";

  try {
    const supabase = await createClient();

    stage = "authentication";

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          error: "You must be signed in to issue a certificate.",
          stage,
        },
        { status: 401 }
      );
    }

    stage = "request body";

    const body = await request.json();

    const courseId =
      typeof body?.courseId === "string"
        ? body.courseId.trim()
        : "";

    if (!courseId) {
      return NextResponse.json(
        {
          ok: false,
          error: "A course ID is required.",
          stage,
        },
        { status: 400 }
      );
    }

    stage = "admin client";

    const admin = createAdminClient();

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
      return NextResponse.json(
        {
          ok: false,
          error: "Unable to load the course.",
          stage,
          details: courseError.message,
        },
        { status: 500 }
      );
    }

    const course =
      courseData as unknown as Course | null;

    if (!course) {
      return NextResponse.json(
        {
          ok: false,
          error: "Course not found.",
          stage,
        },
        { status: 404 }
      );
    }

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
      .eq("course_id", course.id)
      .in("enrollment_status", [
        "active",
        "completed",
      ])
      .maybeSingle();

    if (enrollmentError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unable to verify your enrollment.",
          stage,
          details: enrollmentError.message,
        },
        { status: 500 }
      );
    }

    const enrollment =
      enrollmentData as unknown as Enrollment | null;

    if (!enrollment) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "You must be enrolled in this course before receiving a certificate.",
          stage,
        },
        { status: 403 }
      );
    }

    stage = "payment verification";

    if (
      !course.is_free &&
      enrollment.payment_status !== "paid"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Payment must be completed before a certificate can be issued.",
          stage,
        },
        { status: 403 }
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
      return NextResponse.json(
        {
          ok: false,
          error:
            "Unable to verify the published course lessons.",
          stage,
          details: curriculumError.message,
        },
        { status: 500 }
      );
    }

    const curriculum =
      curriculumData as unknown as CurriculumLesson[];

    const lessonIds = curriculum
      .map((lesson) => lesson.lesson_id)
      .filter(Boolean);

    if (lessonIds.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "This course does not currently have published lessons.",
          stage,
        },
        { status: 400 }
      );
    }

    stage = "lesson completion verification";

    const {
      data: progressData,
      error: progressError,
    } = await admin
      .from("lesson_progress")
      .select("lesson_id, completed")
      .eq("student_id", user.id)
      .eq("course_id", course.id)
      .eq("completed", true)
      .in("lesson_id", lessonIds);

    if (progressError) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Unable to verify your lesson completion.",
          stage,
          details: progressError.message,
        },
        { status: 500 }
      );
    }

    const completedLessonIds = new Set(
      (
        (progressData ?? []) as Array<{
          lesson_id: string;
          completed: boolean;
        }>
      ).map((lesson) => lesson.lesson_id)
    );

    if (
      completedLessonIds.size <
      lessonIds.length
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "All published lessons must be completed before the certificate can be issued.",
          stage,
        },
        { status: 403 }
      );
    }

    stage = "assessment verification";

    const {
      data: assessmentData,
      error: assessmentError,
    } = await admin
      .from("assessment_attempts")
      .select(
        "id, score, total_points, earned_points, total_questions, completed_at, created_at"
      )
      .eq("student_id", user.id)
      .eq("course_id", course.id)
      .not("completed_at", "is", null)
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (assessmentError) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Unable to verify your assessment result.",
          stage,
          details: assessmentError.message,
        },
        { status: 500 }
      );
    }

    const assessment =
      assessmentData as unknown as AssessmentAttempt | null;

    if (!assessment) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "A completed assessment is required before the certificate can be issued.",
          stage,
        },
        { status: 403 }
      );
    }

    const assessmentPercentage =
      getAssessmentPercentage(assessment);

    if (assessmentPercentage < 70) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "You must score at least 70% on the assessment before the certificate can be issued.",
          stage,
        },
        { status: 403 }
      );
    }

    stage = "capstone lookup";

    const {
      data: projectData,
      error: projectError,
    } = await admin
      .from("course_projects")
      .select("id, project_type")
      .eq("course_id", course.id)
      .eq("project_type", "capstone")
      .eq("is_published", true);

    if (projectError) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Unable to verify the course capstone.",
          stage,
          details: projectError.message,
        },
        { status: 500 }
      );
    }

    const projects =
      projectData as unknown as CourseProject[];

    const capstoneProject = projects[0];

    if (!capstoneProject) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "The course capstone is not currently available.",
          stage,
        },
        { status: 403 }
      );
    }

    stage = "capstone approval verification";

    const {
      data: submissionData,
      error: submissionError,
    } = await admin
      .from("project_submissions")
      .select(
        "id, score, status, reviewed_at"
      )
      .eq(
        "project_id",
        capstoneProject.id
      )
      .eq("student_id", user.id)
      .eq("status", "approved")
      .order("reviewed_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (submissionError) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Unable to verify your capstone approval.",
          stage,
          details: submissionError.message,
        },
        { status: 500 }
      );
    }

    const submission =
      submissionData as unknown as ProjectSubmission | null;

    if (!submission) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "An approved capstone submission is required before the certificate can be issued.",
          stage,
        },
        { status: 403 }
      );
    }

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
      return NextResponse.json(
        {
          ok: false,
          error:
            "Unable to load your learner profile.",
          stage,
          details: profileError.message,
        },
        { status: 500 }
      );
    }

    const profile =
      profileData as unknown as Profile | null;

    const holderName =
      profile?.full_name?.trim() ||
      profile?.email?.trim() ||
      user.email?.trim() ||
      "RuffNeck Learn Student";

    const capstoneScore =
      typeof submission.score === "number"
        ? Math.round(submission.score)
        : null;

    stage = "existing certificate lookup";

    const {
      data: existingCertificateData,
      error: existingCertificateError,
    } = await admin
      .from("course_certificates")
      .select("id, certificate_number")
      .eq("student_id", user.id)
      .eq("course_id", course.id)
      .maybeSingle();

    if (existingCertificateError) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Unable to check for an existing certificate.",
          stage,
          details:
            existingCertificateError.message,
        },
        { status: 500 }
      );
    }

    const existingCertificate =
      existingCertificateData as unknown as Certificate | null;

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
        return NextResponse.json(
          {
            ok: true,
            certificateId:
              existingCertificate.id,
            certificateNumber:
              existingCertificate.certificate_number,
            alreadyIssued: true,
            verificationPending: true,
            verificationError:
              verificationError.message,
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        {
          ok: true,
          certificateId:
            existingCertificate.id,
          certificateNumber:
            existingCertificate.certificate_number,
          verificationCode:
            verification?.verification_code ??
            null,
          alreadyIssued: true,
        },
        { status: 200 }
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
        assessment_score: Math.round(
          assessmentPercentage
        ),
        capstone_score: capstoneScore,
        is_revoked: false,
      })
      .select(
        "id, certificate_number"
      )
      .single();

    if (insertCertificateError) {
      if (
        insertCertificateError.code ===
        "23505"
      ) {
        const {
          data: duplicateData,
          error: duplicateError,
        } = await admin
          .from("course_certificates")
          .select(
            "id, certificate_number"
          )
          .eq("student_id", user.id)
          .eq("course_id", course.id)
          .maybeSingle();

        if (duplicateError) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "The certificate already exists, but it could not be loaded.",
              stage,
              details: duplicateError.message,
            },
            { status: 500 }
          );
        }

        const duplicateCertificate =
          duplicateData as unknown as Certificate | null;

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
            return NextResponse.json(
              {
                ok: true,
                certificateId:
                  duplicateCertificate.id,
                certificateNumber:
                  duplicateCertificate.certificate_number,
                alreadyIssued: true,
                verificationPending: true,
                verificationError:
                  verificationError.message,
              },
              { status: 200 }
            );
          }

          return NextResponse.json(
            {
              ok: true,
              certificateId:
                duplicateCertificate.id,
              certificateNumber:
                duplicateCertificate.certificate_number,
              verificationCode:
                verification?.verification_code ??
                null,
              alreadyIssued: true,
            },
            { status: 200 }
          );
        }
      }

      return NextResponse.json(
        {
          ok: false,
          error:
            "Unable to issue the certificate.",
          stage,
          details:
            insertCertificateError.message,
          code: insertCertificateError.code,
        },
        { status: 500 }
      );
    }

    const certificate =
      insertedCertificateData as unknown as Certificate;

    stage = "verification record";

    const {
      verification,
      error: verificationError,
    } = await ensureVerificationRecord(
      admin,
      certificate.id
    );

    if (verificationError) {
      return NextResponse.json(
        {
          ok: true,
          certificateId: certificate.id,
          certificateNumber:
            certificate.certificate_number,
          alreadyIssued: false,
          verificationPending: true,
          verificationError:
            verificationError.message,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        certificateId: certificate.id,
        certificateNumber:
          certificate.certificate_number,
        verificationCode:
          verification?.verification_code ?? null,
        alreadyIssued: false,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "Certificate issuance failed:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error: `Certificate issuance failed during ${stage}.`,
        stage,
        details:
          error instanceof Error
            ? error.message
            : "Unknown server error.",
      },
      { status: 500 }
    );
  }
}