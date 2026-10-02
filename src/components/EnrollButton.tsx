"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function EnrollButton({
  courseId,
  slug,
}: {
  courseId: string;
  slug: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function enroll() {
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Please log in first.");
      setLoading(false);
      return;
    }
    const { error: err } = await supabase.from("enrollments").insert({
      student_id: user.id,
      course_id: courseId,
      payment_status: "free",
      enrollment_status: "active",
      progress_percent: 0,
    });
    setLoading(false);
    if (err) {
      if (err.code === "23505") {
        router.push(`/courses/${slug}`);
        router.refresh();
        return;
      }
      setError(err.message);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      {error && <div className="error">{error}</div>}
      <button className="btn btn-primary" onClick={enroll} disabled={loading}>
        {loading ? "Enrolling…" : "Enroll free"}
      </button>
    </div>
  );
}
