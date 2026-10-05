"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type EnrollButtonProps = {
  courseId: string;
  courseSlug: string;
  firstLessonSlug: string | null;
  courseTitle: string;
  className?: string;
  label?: string;
};

type EnrollmentResponse = {
  success?: boolean;
  already_enrolled?: boolean;
  error?: string;
  enrollment?: {
    id: string;
    enrollment_status: string;
  };
};

export default function EnrollButton({
  courseId,
  courseSlug,
  firstLessonSlug,
  courseTitle,
  className,
  label = "Enroll Free",
}: EnrollButtonProps) {
  const router =
    useRouter();

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(
      null
    );

  async function enroll() {
    setLoading(true);
    setError(null);

    try {
      const supabase =
        createClient();

      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) {
        router.push(
          `/login?next=/courses/${courseSlug}`
        );

        return;
      }

      const response =
        await fetch(
          "/api/student/enroll",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              course_id:
                courseId,
            }),
          }
        );

      const data =
        (await response.json()) as EnrollmentResponse;

      if (!response.ok) {
        throw new Error(
          data.error ||
            `Unable to enroll in ${courseTitle}.`
        );
      }

      if (
        firstLessonSlug
      ) {
        router.push(
          `/learn/${courseSlug}/${firstLessonSlug}`
        );

        return;
      }

      router.refresh();
    } catch (enrollmentError) {
      setError(
        enrollmentError instanceof
          Error
          ? enrollmentError.message
          : `Unable to enroll in ${courseTitle}.`
      );

      setLoading(false);
    }
  }

  return (
    <div className="rn-enroll-control">
      <button
        type="button"
        className={className}
        onClick={enroll}
        disabled={loading}
      >
        {loading
          ? "Enrolling…"
          : label}
      </button>

      {error ? (
        <p className="rn-enroll-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}