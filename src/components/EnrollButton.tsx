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

export default function EnrollButton({
  courseId,
  courseSlug,
  firstLessonSlug,
  courseTitle,
  className,
  label = "Enroll Free",
}: EnrollButtonProps) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    null
  );

  async function enroll() {
    setLoading(true);
    setError(null);

    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push(
        `/login?next=/courses/${courseSlug}`
      );
      return;
    }

    const { error: enrollmentError } =
      await supabase.from("enrollments").insert({
        student_id: user.id,
        course_id: courseId,
        payment_status: "free",
        enrollment_status: "active",
        progress_percent: 0,
      });

    if (enrollmentError) {
      if (
        enrollmentError.code === "23505"
      ) {
        if (firstLessonSlug) {
          router.push(
            `/learn/${courseSlug}/${firstLessonSlug}`
          );
        } else {
          router.refresh();
        }

        return;
      }

      setError(
        enrollmentError.message ||
          `Unable to enroll in ${courseTitle}.`
      );

      setLoading(false);
      return;
    }

    if (firstLessonSlug) {
      router.push(
        `/learn/${courseSlug}/${firstLessonSlug}`
      );
      return;
    }

    router.refresh();
  }

  return (
    <div className="rn-enroll-control">
      <button
        type="button"
        className={className}
        onClick={enroll}
        disabled={loading}
      >
        {loading ? "Enrolling…" : label}
      </button>

      {error ? (
        <p className="rn-enroll-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}