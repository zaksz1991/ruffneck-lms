export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "student" | "instructor" | "admin";
};

export type Course = {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  thumbnail_url: string | null;
  category: string | null;
  level: string;
  price_ngn: number;
  is_free: boolean;
  status: string;
  duration_minutes: number | null;
  learning_outcomes: string[] | null;
  target_audience: string | null;
};

export type Lesson = {
  id: string;
  course_id: string;
  section_id: string;
  title: string;
  slug: string;
  content_html: string | null;
  video_url: string | null;
  sort_order: number;
  is_preview: boolean;
  is_published: boolean;
  duration_minutes: number | null;
};

export type Enrollment = {
  id: string;
  student_id: string;
  course_id: string;
  progress_percent: number;
  enrollment_status: string;
  payment_status: string;
};
