import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AssessmentClient from "./AssessmentClient";

type CourseRow = {
  id: string;
  title: string;
  slug: string;
};

export default async function AssessmentPage({
  params,
}: {
  params: Promise<{
    slug: string;
  }>;
}) {
  const { slug } = await params;

  const supabase = await createClient();

  const { data: courseData, error } = await supabase
    .from("courses")
    .select("id, title, slug")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    console.error(
      "Assessment course lookup failed:",
      error
    );

    throw new Error(
      "Unable to load the course."
    );
  }

  if (!courseData) {
    notFound();
  }

  const course =
    courseData as unknown as CourseRow;

  return (
    <AssessmentClient
      courseId={course.id}
      courseTitle={course.title}
      courseSlug={course.slug}
    />
  );
}