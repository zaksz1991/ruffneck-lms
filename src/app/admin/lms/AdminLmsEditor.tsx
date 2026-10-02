"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Role = "admin" | "instructor";

type Course = {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  thumbnail_url: string | null;
  intro_video_url: string | null;
  category: string | null;
  level: "beginner" | "intermediate" | "advanced";
  price_ngn: number;
  currency: string;
  is_free: boolean;
  status: "draft" | "published" | "archived";
  instructor_id: string | null;
  duration_minutes: number;
  learning_outcomes: string[] | null;
  target_audience: string | null;
  seo_title: string | null;
  seo_description: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type Section = {
  id: string;
  course_id: string;
  title: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type Lesson = {
  id: string;
  section_id: string;
  course_id: string;
  title: string;
  slug: string;
  content_html: string | null;
  video_url: string | null;
  duration_minutes: number;
  duration_seconds: number;
  sort_order: number;
  is_preview: boolean;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

type LessonResource = {
  id: string;
  lesson_id: string;
  title: string;
  resource_type: "file" | "link" | "pdf" | "audio";
  url: string;
  sort_order: number;
  created_at: string;
};

type Instructor = {
  id: string;
  email: string | null;
  full_name: string | null;
};

type Props = {
  initialCourses: Course[];
  userId: string;
  role: Role;
};

const emptyCourse: Partial<Course> = {
  title: "",
  slug: "",
  short_description: "",
  description: "",
  thumbnail_url: "",
  intro_video_url: "",
  category: "",
  level: "beginner",
  price_ngn: 0,
  currency: "NGN",
  status: "draft",
  instructor_id: null,
  duration_minutes: 0,
  learning_outcomes: [],
  target_audience: "",
  seo_title: "",
  seo_description: "",
};

const emptyLesson: Partial<Lesson> = {
  title: "",
  slug: "",
  content_html: "",
  video_url: "",
  duration_minutes: 0,
  duration_seconds: 0,
  is_preview: false,
  is_published: true,
};

const emptyResource: Partial<LessonResource> = {
  title: "",
  resource_type: "link",
  url: "",
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function statusLabel(status: Course["status"]) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDuration(minutes: number, seconds = 0) {
  const totalSeconds = Math.max(
    0,
    Number(minutes || 0) * 60 + Number(seconds || 0)
  );

  if (!totalSeconds) return "No duration";

  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;

  return secs ? `${mins}m ${secs}s` : `${mins} min`;
}

const styles = {
  shell: {
    display: "grid",
    gap: 20,
  } as React.CSSProperties,

  panel: {
    border: "1px solid rgba(15, 23, 42, .10)",
    borderRadius: 14,
    background: "#fff",
    padding: 20,
    boxShadow: "0 2px 8px rgba(15, 23, 42, .04)",
  } as React.CSSProperties,

  panelSoft: {
    border: "1px solid rgba(15, 23, 42, .08)",
    borderRadius: 12,
    background: "#f8fafc",
    padding: 16,
  } as React.CSSProperties,

  field: {
    display: "grid",
    gap: 7,
  } as React.CSSProperties,

  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 700,
    color: "#334155",
  } as React.CSSProperties,

  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    borderRadius: 9,
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#0f172a",
    fontSize: 14,
    outline: "none",
  } as React.CSSProperties,

  textarea: {
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 12px",
    borderRadius: 9,
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#0f172a",
    fontSize: 14,
    lineHeight: 1.6,
    resize: "vertical",
  } as React.CSSProperties,

  select: {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    borderRadius: 9,
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#0f172a",
    fontSize: 14,
  } as React.CSSProperties,

  button: {
    borderRadius: 9,
    padding: "9px 13px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  } as React.CSSProperties,

  actionRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  } as React.CSSProperties,

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16,
  } as React.CSSProperties,

  muted: {
    color: "#64748b",
    fontSize: 13,
  } as React.CSSProperties,

  divider: {
    height: 1,
    background: "#e2e8f0",
    margin: "16px 0",
  } as React.CSSProperties,

  badge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
    lineHeight: 1.2,
  } as React.CSSProperties,
};

export default function AdminLmsEditor({
  initialCourses,
  userId,
  role,
}: Props) {
  const supabase = createClient();

  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    initialCourses[0]?.id ?? ""
  );

  const [sections, setSections] = useState<Section[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [resources, setResources] = useState<LessonResource[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);

  const [loadingCurriculum, setLoadingCurriculum] = useState(false);
  const [loadingResources, setLoadingResources] = useState(false);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [courseForm, setCourseForm] =
    useState<Partial<Course>>(emptyCourse);

  const [editingCourse, setEditingCourse] = useState(false);

  const [sectionTitle, setSectionTitle] = useState("");
  const [editingSectionId, setEditingSectionId] = useState<string | null>(
    null
  );

  const [lessonForm, setLessonForm] =
    useState<Partial<Lesson>>(emptyLesson);

  const [editingLessonId, setEditingLessonId] = useState<string | null>(
    null
  );

  const [lessonSectionId, setLessonSectionId] = useState("");

  const [selectedLessonId, setSelectedLessonId] = useState<string>("");
  const [resourceForm, setResourceForm] =
    useState<Partial<LessonResource>>(emptyResource);

  const [editingResourceId, setEditingResourceId] =
    useState<string | null>(null);

  const [coursePreview, setCoursePreview] = useState(false);
  const [lessonPreview, setLessonPreview] = useState(false);
  const [contentPreview, setContentPreview] = useState(false);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) ?? null,
    [courses, selectedCourseId]
  );

  const selectedLesson = useMemo(
    () => lessons.find((lesson) => lesson.id === selectedLessonId) ?? null,
    [lessons, selectedLessonId]
  );

  const selectedInstructor = useMemo(() => {
    if (!selectedCourse?.instructor_id) return null;

    return (
      instructors.find(
        (instructor) => instructor.id === selectedCourse.instructor_id
      ) ?? null
    );
  }, [selectedCourse, instructors]);

  const lessonsBySection = useMemo(() => {
    const result: Record<string, Lesson[]> = {};

    for (const section of sections) {
      result[section.id] = lessons
        .filter((lesson) => lesson.section_id === section.id)
        .sort((a, b) => a.sort_order - b.sort_order);
    }

    return result;
  }, [sections, lessons]);

  useEffect(() => {
    if (selectedCourse) {
      setCourseForm(selectedCourse);
    } else {
      setCourseForm(emptyCourse);
    }
  }, [selectedCourse]);

  useEffect(() => {
    if (!selectedCourseId) {
      setSections([]);
      setLessons([]);
      setSelectedLessonId("");
      return;
    }

    loadCurriculum(selectedCourseId);
  }, [selectedCourseId]);

  useEffect(() => {
    if (role !== "admin") return;
    loadInstructors();
  }, [role]);

  useEffect(() => {
    if (!selectedLessonId) {
      setResources([]);
      return;
    }

    loadResources(selectedLessonId);
  }, [selectedLessonId]);

  async function loadInstructors() {
    const { data, error: instructorError } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("role", "instructor")
      .order("full_name", { ascending: true });

    if (instructorError) {
      setError(instructorError.message);
      return;
    }

    setInstructors(data ?? []);
  }

  async function loadCurriculum(courseId: string) {
    setLoadingCurriculum(true);
    setError("");

    const [
      { data: sectionData, error: sectionError },
      { data: lessonData, error: lessonError },
    ] = await Promise.all([
      supabase
        .from("course_sections")
        .select("*")
        .eq("course_id", courseId)
        .order("sort_order", { ascending: true }),

      supabase
        .from("lessons")
        .select("*")
        .eq("course_id", courseId)
        .order("sort_order", { ascending: true }),
    ]);

    if (sectionError) {
      setError(sectionError.message);
      setLoadingCurriculum(false);
      return;
    }

    if (lessonError) {
      setError(lessonError.message);
      setLoadingCurriculum(false);
      return;
    }

    const loadedSections = sectionData ?? [];
    const loadedLessons = lessonData ?? [];

    setSections(loadedSections);
    setLessons(loadedLessons);

    if (
      selectedLessonId &&
      !loadedLessons.some((lesson) => lesson.id === selectedLessonId)
    ) {
      setSelectedLessonId("");
    }

    setLoadingCurriculum(false);
  }

  async function loadResources(lessonId: string) {
    setLoadingResources(true);
    setError("");

    const { data, error: resourceError } = await supabase
      .from("lesson_resources")
      .select("*")
      .eq("lesson_id", lessonId)
      .order("sort_order", { ascending: true });

    if (resourceError) {
      setError(resourceError.message);
      setResources([]);
    } else {
      setResources(data ?? []);
    }

    setLoadingResources(false);
  }

  function clearMessages() {
    setMessage("");
    setError("");
  }

  function beginCreateCourse() {
    clearMessages();
    setEditingCourse(true);
    setCourseForm(emptyCourse);
    setSelectedCourseId("");
    setSections([]);
    setLessons([]);
    setSelectedLessonId("");
    setCoursePreview(false);
  }

  function beginEditCourse(course: Course) {
    clearMessages();
    setSelectedCourseId(course.id);
    setCourseForm(course);
    setEditingCourse(true);
    setCoursePreview(false);
  }

  function cancelCourseEdit() {
    clearMessages();
    setEditingCourse(false);

    if (selectedCourse) {
      setCourseForm(selectedCourse);
    } else {
      setCourseForm(emptyCourse);
    }
  }

  async function saveCourse() {
    clearMessages();

    const title = String(courseForm.title ?? "").trim();
    const slug = String(courseForm.slug ?? "").trim();

    if (!title) {
      setError("Course title is required.");
      return;
    }

    if (!slug) {
      setError("Course slug is required.");
      return;
    }

    setSaving(true);

    const status = courseForm.status ?? "draft";

    const payload = {
      title,
      slug,
      short_description: courseForm.short_description || null,
      description: courseForm.description || null,
      thumbnail_url: courseForm.thumbnail_url || null,
      intro_video_url: courseForm.intro_video_url || null,
      category: courseForm.category || null,
      level: courseForm.level ?? "beginner",
      price_ngn: Number(courseForm.price_ngn ?? 0),
      currency: courseForm.currency || "NGN",
      status,
      instructor_id:
        role === "admin"
          ? courseForm.instructor_id || null
          : editingCourse
            ? selectedCourse?.instructor_id ?? userId
            : userId,
      duration_minutes: Number(courseForm.duration_minutes ?? 0),
      learning_outcomes: Array.isArray(courseForm.learning_outcomes)
        ? courseForm.learning_outcomes.filter(Boolean)
        : [],
      target_audience: courseForm.target_audience || null,
      seo_title: courseForm.seo_title || null,
      seo_description: courseForm.seo_description || null,
      published_at:
        status === "published"
          ? selectedCourse?.published_at ?? new Date().toISOString()
          : null,
    };

    if (editingCourse && selectedCourseId) {
      const { data, error: updateError } = await supabase
        .from("courses")
        .update(payload)
        .eq("id", selectedCourseId)
        .select("*")
        .single();

      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }

      setCourses((current) =>
        current.map((course) =>
          course.id === selectedCourseId ? data : course
        )
      );

      setCourseForm(data);
      setMessage("Course updated successfully.");
    } else {
      const { data, error: insertError } = await supabase
        .from("courses")
        .insert(payload)
        .select("*")
        .single();

      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }

      setCourses((current) => [data, ...current]);
      setSelectedCourseId(data.id);
      setCourseForm(data);
      setEditingCourse(true);
      setMessage("Course created successfully.");
    }

    setSaving(false);
  }

  async function deleteCourse(courseId: string) {
    if (role !== "admin") {
      setError("Only admins can delete courses.");
      return;
    }

    if (
      !window.confirm(
        "Delete this course? Its sections, lessons and lesson resources will also be deleted through the database relationships."
      )
    ) {
      return;
    }

    clearMessages();
    setSaving(true);

    const { error: deleteError } = await supabase
      .from("courses")
      .delete()
      .eq("id", courseId);

    if (deleteError) {
      setError(deleteError.message);
      setSaving(false);
      return;
    }

    const remaining = courses.filter((course) => course.id !== courseId);

    setCourses(remaining);

    if (selectedCourseId === courseId) {
      const nextCourse = remaining[0];

      setSelectedCourseId(nextCourse?.id ?? "");
      setCourseForm(nextCourse ?? emptyCourse);
      setSections([]);
      setLessons([]);
      setSelectedLessonId("");
      setResources([]);
    }

    setMessage("Course deleted.");
    setSaving(false);
  }

  async function saveSection() {
    if (!selectedCourseId) {
      setError("Select a course first.");
      return;
    }

    const title = sectionTitle.trim();

    if (!title) {
      setError("Section title is required.");
      return;
    }

    clearMessages();
    setSaving(true);

    if (editingSectionId) {
      const { data, error: updateError } = await supabase
        .from("course_sections")
        .update({
          title,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingSectionId)
        .select("*")
        .single();

      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }

      setSections((current) =>
        current.map((section) =>
          section.id === editingSectionId ? data : section
        )
      );

      setMessage("Section renamed.");
    } else {
      const nextOrder =
        sections.length > 0
          ? Math.max(...sections.map((section) => section.sort_order)) + 1
          : 1;

      const { data, error: insertError } = await supabase
        .from("course_sections")
        .insert({
          course_id: selectedCourseId,
          title,
          sort_order: nextOrder,
        })
        .select("*")
        .single();

      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }

      setSections((current) =>
        [...current, data].sort((a, b) => a.sort_order - b.sort_order)
      );

      setMessage("Section created.");
    }

    setSectionTitle("");
    setEditingSectionId(null);
    setSaving(false);
  }

  function editSection(section: Section) {
    clearMessages();
    setSectionTitle(section.title);
    setEditingSectionId(section.id);
  }

  function cancelSectionEdit() {
    setSectionTitle("");
    setEditingSectionId(null);
  }

  async function deleteSection(section: Section) {
    if (
      !window.confirm(
        `Delete "${section.title}" and all lessons inside it?`
      )
    ) {
      return;
    }

    clearMessages();
    setSaving(true);

    const { error: deleteError } = await supabase
      .from("course_sections")
      .delete()
      .eq("id", section.id);

    if (deleteError) {
      setError(deleteError.message);
      setSaving(false);
      return;
    }

    setSections((current) =>
      current.filter((item) => item.id !== section.id)
    );

    const removedLessons = lessons.filter(
      (lesson) => lesson.section_id === section.id
    );

    setLessons((current) =>
      current.filter((lesson) => lesson.section_id !== section.id)
    );

    if (
      removedLessons.some((lesson) => lesson.id === selectedLessonId)
    ) {
      setSelectedLessonId("");
      setResources([]);
    }

    setMessage("Section deleted.");
    setSaving(false);
  }

  async function moveSection(
    section: Section,
    direction: "up" | "down"
  ) {
    const ordered = [...sections].sort(
      (a, b) => a.sort_order - b.sort_order
    );

    const index = ordered.findIndex((item) => item.id === section.id);

    if (index < 0) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= ordered.length) {
      return;
    }

    const target = ordered[targetIndex];

    clearMessages();
    setSaving(true);

    const firstOrder = section.sort_order;
    const secondOrder = target.sort_order;

    const { error: firstError } = await supabase
      .from("course_sections")
      .update({ sort_order: secondOrder })
      .eq("id", section.id);

    if (firstError) {
      setError(firstError.message);
      setSaving(false);
      return;
    }

    const { error: secondError } = await supabase
      .from("course_sections")
      .update({ sort_order: firstOrder })
      .eq("id", target.id);

    if (secondError) {
      setError(secondError.message);
      setSaving(false);
      return;
    }

    setSections((current) =>
      current
        .map((item) => {
          if (item.id === section.id) {
            return { ...item, sort_order: secondOrder };
          }

          if (item.id === target.id) {
            return { ...item, sort_order: firstOrder };
          }

          return item;
        })
        .sort((a, b) => a.sort_order - b.sort_order)
    );

    setMessage("Section order updated.");
    setSaving(false);
  }

  function beginCreateLesson(sectionId: string) {
    clearMessages();

    setLessonSectionId(sectionId);
    setLessonForm({
      ...emptyLesson,
      slug: "",
    });
    setEditingLessonId(null);
    setLessonPreview(false);
    setContentPreview(false);
  }

  function beginEditLesson(lesson: Lesson) {
    clearMessages();

    setLessonSectionId(lesson.section_id);
    setLessonForm(lesson);
    setEditingLessonId(lesson.id);
    setSelectedLessonId(lesson.id);
    setLessonPreview(false);
    setContentPreview(false);
  }

  function cancelLessonEdit() {
    setLessonSectionId("");
    setLessonForm(emptyLesson);
    setEditingLessonId(null);
    setLessonPreview(false);
    setContentPreview(false);
  }

  async function saveLesson() {
    if (!selectedCourseId) {
      setError("Select a course first.");
      return;
    }

    const title = String(lessonForm.title ?? "").trim();
    const slug = String(lessonForm.slug ?? "").trim();
    const sectionId =
      lessonSectionId || String(lessonForm.section_id ?? "");

    if (!title) {
      setError("Lesson title is required.");
      return;
    }

    if (!slug) {
      setError("Lesson slug is required.");
      return;
    }

    if (!sectionId) {
      setError("Lesson section is required.");
      return;
    }

    clearMessages();
    setSaving(true);

    if (editingLessonId) {
      const { data, error: updateError } = await supabase
        .from("lessons")
        .update({
          section_id: sectionId,
          title,
          slug,
          content_html: lessonForm.content_html || null,
          video_url: lessonForm.video_url || null,
          duration_minutes: Number(lessonForm.duration_minutes ?? 0),
          duration_seconds: Number(lessonForm.duration_seconds ?? 0),
          is_preview: Boolean(lessonForm.is_preview),
          is_published: Boolean(lessonForm.is_published),
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingLessonId)
        .select("*")
        .single();

      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }

      setLessons((current) =>
        current
          .map((lesson) =>
            lesson.id === editingLessonId ? data : lesson
          )
          .sort((a, b) => a.sort_order - b.sort_order)
      );

      setSelectedLessonId(data.id);
      setLessonForm(data);
      setMessage("Lesson updated.");
    } else {
      const sectionLessons = lessons.filter(
        (lesson) => lesson.section_id === sectionId
      );

      const nextOrder =
        sectionLessons.length > 0
          ? Math.max(...sectionLessons.map((lesson) => lesson.sort_order)) + 1
          : 1;

      const { data, error: insertError } = await supabase
        .from("lessons")
        .insert({
          section_id: sectionId,
          course_id: selectedCourseId,
          title,
          slug,
          content_html: lessonForm.content_html || null,
          video_url: lessonForm.video_url || null,
          duration_minutes: Number(lessonForm.duration_minutes ?? 0),
          duration_seconds: Number(lessonForm.duration_seconds ?? 0),
          sort_order: nextOrder,
          is_preview: Boolean(lessonForm.is_preview),
          is_published: Boolean(lessonForm.is_published),
        })
        .select("*")
        .single();

      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }

      setLessons((current) =>
        [...current, data].sort((a, b) => a.sort_order - b.sort_order)
      );

      setSelectedLessonId(data.id);
      setLessonForm(data);
      setMessage("Lesson created.");
    }

    setLessonSectionId("");
    setEditingLessonId(null);
    setSaving(false);
  }

  async function deleteLesson(lesson: Lesson) {
    if (!window.confirm(`Delete "${lesson.title}"?`)) {
      return;
    }

    clearMessages();
    setSaving(true);

    const { error: deleteError } = await supabase
      .from("lessons")
      .delete()
      .eq("id", lesson.id);

    if (deleteError) {
      setError(deleteError.message);
      setSaving(false);
      return;
    }

    setLessons((current) =>
      current.filter((item) => item.id !== lesson.id)
    );

    if (selectedLessonId === lesson.id) {
      setSelectedLessonId("");
      setResources([]);
    }

    setMessage("Lesson deleted.");
    setSaving(false);
  }

  async function moveLesson(
    lesson: Lesson,
    direction: "up" | "down"
  ) {
    const sectionLessons = lessons
      .filter((item) => item.section_id === lesson.section_id)
      .sort((a, b) => a.sort_order - b.sort_order);

    const index = sectionLessons.findIndex(
      (item) => item.id === lesson.id
    );

    if (index < 0) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (
      targetIndex < 0 ||
      targetIndex >= sectionLessons.length
    ) {
      return;
    }

    const target = sectionLessons[targetIndex];

    clearMessages();
    setSaving(true);

    const firstOrder = lesson.sort_order;
    const secondOrder = target.sort_order;

    const { error: firstError } = await supabase
      .from("lessons")
      .update({ sort_order: secondOrder })
      .eq("id", lesson.id);

    if (firstError) {
      setError(firstError.message);
      setSaving(false);
      return;
    }

    const { error: secondError } = await supabase
      .from("lessons")
      .update({ sort_order: firstOrder })
      .eq("id", target.id);

    if (secondError) {
      setError(secondError.message);
      setSaving(false);
      return;
    }

    setLessons((current) =>
      current
        .map((item) => {
          if (item.id === lesson.id) {
            return { ...item, sort_order: secondOrder };
          }

          if (item.id === target.id) {
            return { ...item, sort_order: firstOrder };
          }

          return item;
        })
        .sort((a, b) => a.sort_order - b.sort_order)
    );

    setMessage("Lesson order updated.");
    setSaving(false);
  }

  async function moveLessonToSection(
    lesson: Lesson,
    targetSectionId: string
  ) {
    if (targetSectionId === lesson.section_id) {
      return;
    }

    clearMessages();
    setSaving(true);

    const targetLessons = lessons.filter(
      (item) => item.section_id === targetSectionId
    );

    const nextOrder =
      targetLessons.length > 0
        ? Math.max(...targetLessons.map((item) => item.sort_order)) + 1
        : 1;

    const { data, error: updateError } = await supabase
      .from("lessons")
      .update({
        section_id: targetSectionId,
        sort_order: nextOrder,
        updated_at: new Date().toISOString(),
      })
      .eq("id", lesson.id)
      .select("*")
      .single();

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setLessons((current) =>
      current
        .map((item) => (item.id === lesson.id ? data : item))
        .sort((a, b) => a.sort_order - b.sort_order)
    );

    setMessage("Lesson moved.");
    setSaving(false);
  }

  function beginCreateResource(lessonId: string) {
    clearMessages();
    setSelectedLessonId(lessonId);
    setResourceForm(emptyResource);
    setEditingResourceId(null);
  }

  function beginEditResource(resource: LessonResource) {
    clearMessages();
    setSelectedLessonId(resource.lesson_id);
    setResourceForm(resource);
    setEditingResourceId(resource.id);
  }

  function cancelResourceEdit() {
    setResourceForm(emptyResource);
    setEditingResourceId(null);
  }

  async function saveResource() {
    if (!selectedLessonId) {
      setError("Select a lesson first.");
      return;
    }

    const title = String(resourceForm.title ?? "").trim();
    const url = String(resourceForm.url ?? "").trim();
    const resourceType = resourceForm.resource_type ?? "link";

    if (!title) {
      setError("Resource title is required.");
      return;
    }

    if (!url) {
      setError("Resource URL is required.");
      return;
    }

    clearMessages();
    setSaving(true);

    if (editingResourceId) {
      const { data, error: updateError } = await supabase
        .from("lesson_resources")
        .update({
          title,
          resource_type: resourceType,
          url,
        })
        .eq("id", editingResourceId)
        .select("*")
        .single();

      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }

      setResources((current) =>
        current
          .map((resource) =>
            resource.id === editingResourceId ? data : resource
          )
          .sort((a, b) => a.sort_order - b.sort_order)
      );

      setMessage("Resource updated.");
    } else {
      const nextOrder =
        resources.length > 0
          ? Math.max(...resources.map((resource) => resource.sort_order)) + 1
          : 1;

      const { data, error: insertError } = await supabase
        .from("lesson_resources")
        .insert({
          lesson_id: selectedLessonId,
          title,
          resource_type: resourceType,
          url,
          sort_order: nextOrder,
        })
        .select("*")
        .single();

      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }

      setResources((current) =>
        [...current, data].sort((a, b) => a.sort_order - b.sort_order)
      );

      setMessage("Resource added.");
    }

    setResourceForm(emptyResource);
    setEditingResourceId(null);
    setSaving(false);
  }

  async function deleteResource(resource: LessonResource) {
    if (!window.confirm(`Delete "${resource.title}"?`)) {
      return;
    }

    clearMessages();
    setSaving(true);

    const { error: deleteError } = await supabase
      .from("lesson_resources")
      .delete()
      .eq("id", resource.id);

    if (deleteError) {
      setError(deleteError.message);
      setSaving(false);
      return;
    }

    setResources((current) =>
      current.filter((item) => item.id !== resource.id)
    );

    setMessage("Resource deleted.");
    setSaving(false);
  }

  async function moveResource(
    resource: LessonResource,
    direction: "up" | "down"
  ) {
    const ordered = [...resources].sort(
      (a, b) => a.sort_order - b.sort_order
    );

    const index = ordered.findIndex(
      (item) => item.id === resource.id
    );

    if (index < 0) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (
      targetIndex < 0 ||
      targetIndex >= ordered.length
    ) {
      return;
    }

    const target = ordered[targetIndex];

    clearMessages();
    setSaving(true);

    const firstOrder = resource.sort_order;
    const secondOrder = target.sort_order;

    const { error: firstError } = await supabase
      .from("lesson_resources")
      .update({ sort_order: secondOrder })
      .eq("id", resource.id);

    if (firstError) {
      setError(firstError.message);
      setSaving(false);
      return;
    }

    const { error: secondError } = await supabase
      .from("lesson_resources")
      .update({ sort_order: firstOrder })
      .eq("id", target.id);

    if (secondError) {
      setError(secondError.message);
      setSaving(false);
      return;
    }

    setResources((current) =>
      current
        .map((item) => {
          if (item.id === resource.id) {
            return { ...item, sort_order: secondOrder };
          }

          if (item.id === target.id) {
            return { ...item, sort_order: firstOrder };
          }

          return item;
        })
        .sort((a, b) => a.sort_order - b.sort_order)
    );

    setMessage("Resource order updated.");
    setSaving(false);
  }

  function updateCourseField<K extends keyof Course>(
    field: K,
    value: Course[K]
  ) {
    setCourseForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateLessonField<K extends keyof Lesson>(
    field: K,
    value: Lesson[K]
  ) {
    setLessonForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateResourceField<K extends keyof LessonResource>(
    field: K,
    value: LessonResource[K]
  ) {
    setResourceForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function renderStatusBadge(
    label: string,
    kind: "green" | "blue" | "gray" | "amber"
  ) {
    const backgrounds = {
      green: "#dcfce7",
      blue: "#dbeafe",
      gray: "#f1f5f9",
      amber: "#fef3c7",
    };

    const colors = {
      green: "#166534",
      blue: "#1d4ed8",
      gray: "#475569",
      amber: "#92400e",
    };

    return (
      <span
        style={{
          ...styles.badge,
          background: backgrounds[kind],
          color: colors[kind],
        }}
      >
        {label}
      </span>
    );
  }

  return (
    <div style={styles.shell}>
      {message && (
        <div
          style={{
            ...styles.panel,
            borderLeft: "4px solid #16a34a",
            background: "#f0fdf4",
            color: "#166534",
          }}
        >
          <strong>{message}</strong>
        </div>
      )}

      {error && (
        <div
          style={{
            ...styles.panel,
            borderLeft: "4px solid #dc2626",
            background: "#fef2f2",
            color: "#991b1b",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* COURSE SELECTOR */}
      <div
        style={{
          ...styles.panel,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "end",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 320px" }}>
          <label style={styles.label}>Course</label>

          <select
            value={selectedCourseId}
            onChange={(event) => {
              clearMessages();
              setSelectedCourseId(event.target.value);
              setEditingCourse(false);
              setCoursePreview(false);
              setSelectedLessonId("");
            }}
            style={{ ...styles.select, marginTop: 7 }}
          >
            <option value="">Select a course</option>

            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={beginCreateCourse}
          disabled={saving}
          style={styles.button}
        >
          + New Course
        </button>
      </div>

      {/* COURSE EDITOR */}
      {editingCourse && (
        <div style={styles.panel}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              alignItems: "center",
              flexWrap: "wrap",
              marginBottom: 20,
            }}
          >
            <div>
              <h3 style={{ margin: 0 }}>
                {selectedCourseId ? "Edit Course" : "Create Course"}
              </h3>

              <div style={{ ...styles.muted, marginTop: 5 }}>
                Configure the course information, publishing state and
                metadata.
              </div>
            </div>

            {selectedCourse && (
              <div style={styles.actionRow}>
                {renderStatusBadge(
                  statusLabel(selectedCourse.status),
                  selectedCourse.status === "published"
                    ? "green"
                    : selectedCourse.status === "archived"
                      ? "gray"
                      : "amber"
                )}
              </div>
            )}
          </div>

          <div style={styles.grid}>
            <div style={styles.field}>
              <label style={styles.label}>Title</label>
              <input
                value={String(courseForm.title ?? "")}
                onChange={(event) =>
                  updateCourseField("title", event.target.value)
                }
                onBlur={() => {
                  if (!courseForm.slug && courseForm.title) {
                    updateCourseField(
                      "slug",
                      slugify(String(courseForm.title))
                    );
                  }
                }}
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Slug</label>
              <input
                value={String(courseForm.slug ?? "")}
                onChange={(event) =>
                  updateCourseField("slug", event.target.value)
                }
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Category</label>
              <input
                value={String(courseForm.category ?? "")}
                onChange={(event) =>
                  updateCourseField("category", event.target.value)
                }
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Level</label>
              <select
                value={courseForm.level ?? "beginner"}
                onChange={(event) =>
                  updateCourseField(
                    "level",
                    event.target.value as Course["level"]
                  )
                }
                style={styles.select}
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Price (NGN)</label>
              <input
                type="number"
                min="0"
                value={Number(courseForm.price_ngn ?? 0)}
                onChange={(event) =>
                  updateCourseField(
                    "price_ngn",
                    Number(event.target.value)
                  )
                }
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Status</label>
              <select
                value={courseForm.status ?? "draft"}
                onChange={(event) =>
                  updateCourseField(
                    "status",
                    event.target.value as Course["status"]
                  )
                }
                style={styles.select}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            {role === "admin" && (
              <div style={styles.field}>
                <label style={styles.label}>Instructor</label>
                <select
                  value={courseForm.instructor_id ?? ""}
                  onChange={(event) =>
                    updateCourseField(
                      "instructor_id",
                      event.target.value || null
                    )
                  }
                  style={styles.select}
                >
                  <option value="">No instructor assigned</option>

                  {instructors.map((instructor) => (
                    <option key={instructor.id} value={instructor.id}>
                      {instructor.full_name ||
                        instructor.email ||
                        instructor.id}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={styles.field}>
              <label style={styles.label}>Duration (minutes)</label>
              <input
                type="number"
                min="0"
                value={Number(courseForm.duration_minutes ?? 0)}
                onChange={(event) =>
                  updateCourseField(
                    "duration_minutes",
                    Number(event.target.value)
                  )
                }
                style={styles.input}
              />
            </div>
          </div>

          <div style={{ ...styles.field, marginTop: 18 }}>
            <label style={styles.label}>Short description</label>
            <textarea
              value={String(courseForm.short_description ?? "")}
              onChange={(event) =>
                updateCourseField(
                  "short_description",
                  event.target.value
                )
              }
              rows={3}
              style={styles.textarea}
            />
          </div>

          <div style={{ ...styles.field, marginTop: 18 }}>
            <label style={styles.label}>Description</label>
            <textarea
              value={String(courseForm.description ?? "")}
              onChange={(event) =>
                updateCourseField("description", event.target.value)
              }
              rows={7}
              style={styles.textarea}
            />
          </div>

          <div style={{ ...styles.grid, marginTop: 18 }}>
            <div style={styles.field}>
              <label style={styles.label}>Thumbnail URL</label>
              <input
                value={String(courseForm.thumbnail_url ?? "")}
                onChange={(event) =>
                  updateCourseField(
                    "thumbnail_url",
                    event.target.value
                  )
                }
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Intro video URL</label>
              <input
                value={String(courseForm.intro_video_url ?? "")}
                onChange={(event) =>
                  updateCourseField(
                    "intro_video_url",
                    event.target.value
                  )
                }
                style={styles.input}
              />
            </div>
          </div>

          <div style={{ ...styles.field, marginTop: 18 }}>
            <label style={styles.label}>
              Learning outcomes — one per line
            </label>

            <textarea
              value={(courseForm.learning_outcomes ?? []).join("\n")}
              onChange={(event) =>
                updateCourseField(
                  "learning_outcomes",
                  event.target.value
                    .split("\n")
                    .map((item) => item.trim())
                    .filter(Boolean)
                )
              }
              rows={5}
              style={styles.textarea}
            />
          </div>

          <div style={{ ...styles.field, marginTop: 18 }}>
            <label style={styles.label}>Target audience</label>

            <textarea
              value={String(courseForm.target_audience ?? "")}
              onChange={(event) =>
                updateCourseField(
                  "target_audience",
                  event.target.value
                )
              }
              rows={3}
              style={styles.textarea}
            />
          </div>

          <div style={{ ...styles.grid, marginTop: 18 }}>
            <div style={styles.field}>
              <label style={styles.label}>SEO title</label>
              <input
                value={String(courseForm.seo_title ?? "")}
                onChange={(event) =>
                  updateCourseField("seo_title", event.target.value)
                }
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>SEO description</label>
              <input
                value={String(courseForm.seo_description ?? "")}
                onChange={(event) =>
                  updateCourseField(
                    "seo_description",
                    event.target.value
                  )
                }
                style={styles.input}
              />
            </div>
          </div>

          <div
            style={{
              ...styles.actionRow,
              marginTop: 22,
              paddingTop: 18,
              borderTop: "1px solid #e2e8f0",
            }}
          >
            <button
              type="button"
              onClick={saveCourse}
              disabled={saving}
              style={styles.button}
            >
              {saving ? "Saving..." : "Save Course"}
            </button>

            <button
              type="button"
              onClick={cancelCourseEdit}
              disabled={saving}
              style={styles.button}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* COURSE SUMMARY */}
      {selectedCourse && !editingCourse && (
        <div style={styles.panel}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 20,
              flexWrap: "wrap",
            }}
          >
            <div style={{ minWidth: 260, flex: 1 }}>
              <div style={styles.actionRow}>
                {renderStatusBadge(
                  statusLabel(selectedCourse.status),
                  selectedCourse.status === "published"
                    ? "green"
                    : selectedCourse.status === "archived"
                      ? "gray"
                      : "amber"
                )}

                {renderStatusBadge(
                  selectedCourse.is_free
                    ? "Free"
                    : `₦${selectedCourse.price_ngn.toLocaleString()}`,
                  "blue"
                )}
              </div>

              <h2 style={{ margin: "12px 0 6px" }}>
                {selectedCourse.title}
              </h2>

              <div style={styles.muted}>
                {selectedCourse.category || "Uncategorized"} ·{" "}
                {selectedCourse.level}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 16,
                  flexWrap: "wrap",
                  marginTop: 12,
                  ...styles.muted,
                }}
              >
                <span>
                  {sections.length} section
                  {sections.length === 1 ? "" : "s"}
                </span>

                <span>
                  {lessons.length} lesson
                  {lessons.length === 1 ? "" : "s"}
                </span>

                <span>
                  {formatDuration(selectedCourse.duration_minutes)}
                </span>
              </div>

              {role === "admin" && (
                <div style={{ ...styles.muted, marginTop: 10 }}>
                  Instructor:{" "}
                  {selectedInstructor?.full_name ||
                    selectedInstructor?.email ||
                    (selectedCourse.instructor_id
                      ? "Assigned"
                      : "Not assigned")}
                </div>
              )}
            </div>

            <div
              style={{
                ...styles.actionRow,
                alignSelf: "start",
              }}
            >
              <button
                type="button"
                onClick={() => setCoursePreview((value) => !value)}
                disabled={saving}
                style={styles.button}
              >
                {coursePreview ? "Close Preview" : "Preview"}
              </button>

              <button
                type="button"
                onClick={() => beginEditCourse(selectedCourse)}
                disabled={saving}
                style={styles.button}
              >
                Edit
              </button>

              <a
                href={`/courses/${selectedCourse.slug}`}
                target="_blank"
                rel="noreferrer"
                style={{ textDecoration: "none" }}
              >
                <button type="button" style={styles.button}>
                  Public View
                </button>
              </a>

              {role === "admin" && (
                <button
                  type="button"
                  onClick={() => deleteCourse(selectedCourse.id)}
                  disabled={saving}
                  style={styles.button}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* COURSE PREVIEW */}
      {selectedCourse && coursePreview && (
        <div
          style={{
            ...styles.panel,
            padding: 0,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "14px 18px",
              background: "#0f172a",
              color: "#fff",
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <strong>Admin Course Preview</strong>
            <span style={{ opacity: 0.7, fontSize: 12 }}>
              Preview does not change public RLS access.
            </span>
          </div>

          {selectedCourse.thumbnail_url && (
            <div
              style={{
                width: "100%",
                maxHeight: 280,
                overflow: "hidden",
                background: "#e2e8f0",
              }}
            >
              <img
                src={selectedCourse.thumbnail_url}
                alt=""
                style={{
                  width: "100%",
                  maxHeight: 280,
                  objectFit: "cover",
                  display: "block",
                }}
              />
            </div>
          )}

          <div
            style={{
              padding: 24,
              maxWidth: 900,
              margin: "0 auto",
            }}
          >
            <div style={styles.actionRow}>
              {renderStatusBadge(
                statusLabel(selectedCourse.status),
                selectedCourse.status === "published"
                  ? "green"
                  : selectedCourse.status === "archived"
                    ? "gray"
                    : "amber"
              )}

              {selectedCourse.category &&
                renderStatusBadge(selectedCourse.category, "blue")}
            </div>

            <h1 style={{ margin: "14px 0 8px" }}>
              {selectedCourse.title}
            </h1>

            {selectedCourse.short_description && (
              <p
                style={{
                  color: "#475569",
                  fontSize: 16,
                  lineHeight: 1.7,
                }}
              >
                {selectedCourse.short_description}
              </p>
            )}

            {selectedCourse.description && (
              <div
                style={{
                  marginTop: 22,
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.7,
                  color: "#334155",
                }}
              >
                {selectedCourse.description}
              </div>
            )}

            {selectedCourse.learning_outcomes &&
              selectedCourse.learning_outcomes.length > 0 && (
                <div style={{ marginTop: 26 }}>
                  <h3>Learning outcomes</h3>

                  <ul style={{ lineHeight: 1.8 }}>
                    {selectedCourse.learning_outcomes.map(
                      (outcome, index) => (
                        <li key={`${outcome}-${index}`}>{outcome}</li>
                      )
                    )}
                  </ul>
                </div>
              )}

            {selectedCourse.target_audience && (
              <div style={{ marginTop: 26 }}>
                <h3>Target audience</h3>
                <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
                  {selectedCourse.target_audience}
                </p>
              </div>
            )}

            {selectedCourse.intro_video_url && (
              <div style={{ marginTop: 26 }}>
                <h3>Introduction video</h3>

                <a
                  href={selectedCourse.intro_video_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open introduction video
                </a>
              </div>
            )}

            <div style={{ marginTop: 30 }}>
              <h3>Course curriculum</h3>

              {sections.length === 0 ? (
                <p style={styles.muted}>No curriculum yet.</p>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {sections.map((section, index) => {
                    const sectionLessons =
                      lessonsBySection[section.id] ?? [];

                    return (
                      <div key={section.id} style={styles.panelSoft}>
                        <strong>
                          {index + 1}. {section.title}
                        </strong>

                        <div
                          style={{
                            marginTop: 10,
                            display: "grid",
                            gap: 7,
                          }}
                        >
                          {sectionLessons.map(
                            (lesson, lessonIndex) => (
                              <div
                                key={lesson.id}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  gap: 12,
                                  padding: "8px 0",
                                  borderTop:
                                    lessonIndex === 0
                                      ? "none"
                                      : "1px solid #e2e8f0",
                                }}
                              >
                                <span>
                                  {lessonIndex + 1}. {lesson.title}
                                </span>

                                <span style={styles.muted}>
                                  {formatDuration(
                                    lesson.duration_minutes,
                                    lesson.duration_seconds
                                  )}
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CURRICULUM */}
      {selectedCourseId && (
        <div style={styles.panel}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              alignItems: "center",
              flexWrap: "wrap",
              marginBottom: 18,
            }}
          >
            <div>
              <h3 style={{ margin: 0 }}>Curriculum</h3>

              <div style={{ ...styles.muted, marginTop: 5 }}>
                Build and organize sections, lessons and resources.
              </div>
            </div>

            <div style={styles.actionRow}>
              <span style={styles.muted}>
                {sections.length} section
                {sections.length === 1 ? "" : "s"} · {lessons.length}{" "}
                lesson
                {lessons.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          {loadingCurriculum ? (
            <div style={styles.panelSoft}>
              <p style={{ margin: 0, ...styles.muted }}>
                Loading curriculum...
              </p>
            </div>
          ) : (
            <>
              <div
                style={{
                  ...styles.panelSoft,
                  display: "flex",
                  gap: 10,
                  alignItems: "end",
                  flexWrap: "wrap",
                  marginBottom: 18,
                }}
              >
                <div style={{ flex: "1 1 260px" }}>
                  <label style={styles.label}>
                    {editingSectionId
                      ? "Rename section"
                      : "New section"}
                  </label>

                  <input
                    value={sectionTitle}
                    placeholder={
                      editingSectionId
                        ? "Section name"
                        : "New section title"
                    }
                    onChange={(event) =>
                      setSectionTitle(event.target.value)
                    }
                    style={{
                      ...styles.input,
                      marginTop: 7,
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={saveSection}
                  disabled={saving}
                  style={styles.button}
                >
                  {editingSectionId
                    ? "Rename Section"
                    : "Add Section"}
                </button>

                {editingSectionId && (
                  <button
                    type="button"
                    onClick={cancelSectionEdit}
                    disabled={saving}
                    style={styles.button}
                  >
                    Cancel
                  </button>
                )}
              </div>

              {sections.map((section, sectionIndex) => {
                const sectionLessons =
                  lessonsBySection[section.id] ?? [];

                return (
                  <div
                    key={section.id}
                    style={{
                      border: "1px solid #dbe3ed",
                      borderRadius: 12,
                      marginBottom: 14,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        padding: "14px 16px",
                        background: "#f8fafc",
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <strong>
                          {sectionIndex + 1}. {section.title}
                        </strong>

                        <div style={{ ...styles.muted, marginTop: 3 }}>
                          {sectionLessons.length} lesson
                          {sectionLessons.length === 1 ? "" : "s"}
                        </div>
                      </div>

                      <div style={styles.actionRow}>
                        <button
                          type="button"
                          onClick={() =>
                            moveSection(section, "up")
                          }
                          disabled={
                            saving || sectionIndex === 0
                          }
                          style={styles.button}
                        >
                          ↑
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            moveSection(section, "down")
                          }
                          disabled={
                            saving ||
                            sectionIndex === sections.length - 1
                          }
                          style={styles.button}
                        >
                          ↓
                        </button>

                        <button
                          type="button"
                          onClick={() => editSection(section)}
                          disabled={saving}
                          style={styles.button}
                        >
                          Rename
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteSection(section)}
                          disabled={saving}
                          style={styles.button}
                        >
                          Delete
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            beginCreateLesson(section.id)
                          }
                          disabled={saving}
                          style={styles.button}
                        >
                          + Lesson
                        </button>
                      </div>
                    </div>

                    <div style={{ padding: "0 16px 16px" }}>
                      {sectionLessons.length === 0 && (
                        <p style={{ ...styles.muted, marginBottom: 0 }}>
                          No lessons in this section.
                        </p>
                      )}

                      {sectionLessons.map(
                        (lesson, lessonIndex) => (
                          <div
                            key={lesson.id}
                            style={{
                              padding: "14px 0",
                              borderTop:
                                "1px solid #e2e8f0",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent:
                                  "space-between",
                                gap: 12,
                                alignItems: "center",
                                flexWrap: "wrap",
                              }}
                            >
                              <div
                                style={{
                                  minWidth: 220,
                                  flex: 1,
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    gap: 8,
                                    alignItems: "center",
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <strong>
                                    {lessonIndex + 1}.{" "}
                                    {lesson.title}
                                  </strong>

                                  {lesson.is_published
                                    ? renderStatusBadge(
                                        "Published",
                                        "green"
                                      )
                                    : renderStatusBadge(
                                        "Draft",
                                        "amber"
                                      )}

                                  {lesson.is_preview &&
                                    renderStatusBadge(
                                      "Preview",
                                      "blue"
                                    )}
                                </div>

                                <div
                                  style={{
                                    ...styles.muted,
                                    marginTop: 5,
                                  }}
                                >
                                  {formatDuration(
                                    lesson.duration_minutes,
                                    lesson.duration_seconds
                                  )}{" "}
                                  ·{" "}
                                  {lesson.is_preview
                                    ? "Public preview"
                                    : "Members only"}
                                </div>
                              </div>

                              <div style={styles.actionRow}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    moveLesson(
                                      lesson,
                                      "up"
                                    )
                                  }
                                  disabled={
                                    saving ||
                                    lessonIndex === 0
                                  }
                                  style={styles.button}
                                >
                                  ↑
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    moveLesson(
                                      lesson,
                                      "down"
                                    )
                                  }
                                  disabled={
                                    saving ||
                                    lessonIndex ===
                                      sectionLessons.length - 1
                                  }
                                  style={styles.button}
                                >
                                  ↓
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    beginEditLesson(lesson)
                                  }
                                  disabled={saving}
                                  style={styles.button}
                                >
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    setLessonPreview(
                                      selectedLessonId ===
                                        lesson.id
                                        ? !lessonPreview
                                        : true
                                    )
                                  }
                                  disabled={saving}
                                  style={styles.button}
                                >
                                  Preview
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    deleteLesson(lesson)
                                  }
                                  disabled={saving}
                                  style={styles.button}
                                >
                                  Delete
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    beginCreateResource(
                                      lesson.id
                                    )
                                  }
                                  disabled={saving}
                                  style={styles.button}
                                >
                                  Resources
                                </button>
                              </div>
                            </div>

                            {/* MOVE LESSON */}
                            {sections.length > 1 && (
                              <div
                                style={{
                                  marginTop: 10,
                                  display: "flex",
                                  gap: 8,
                                  alignItems: "center",
                                  flexWrap: "wrap",
                                }}
                              >
                                <span style={styles.muted}>
                                  Move to:
                                </span>

                                <select
                                  value={lesson.section_id}
                                  onChange={(event) =>
                                    moveLessonToSection(
                                      lesson,
                                      event.target.value
                                    )
                                  }
                                  disabled={saving}
                                  style={{
                                    ...styles.select,
                                    width: "auto",
                                    minWidth: 180,
                                  }}
                                >
                                  {sections.map(
                                    (targetSection) => (
                                      <option
                                        key={
                                          targetSection.id
                                        }
                                        value={
                                          targetSection.id
                                        }
                                      >
                                        {
                                          targetSection.title
                                        }
                                      </option>
                                    )
                                  )}
                                </select>
                              </div>
                            )}

                            {/* LESSON PREVIEW */}
                            {selectedLessonId === lesson.id &&
                              lessonPreview && (
                                <div
                                  style={{
                                    ...styles.panelSoft,
                                    marginTop: 14,
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent:
                                        "space-between",
                                      gap: 12,
                                      alignItems:
                                        "center",
                                    }}
                                  >
                                    <div>
                                      <strong>
                                        Lesson Preview
                                      </strong>

                                      <div
                                        style={{
                                          ...styles.muted,
                                          marginTop: 3,
                                        }}
                                      >
                                        Admin preview of the
                                        lesson content.
                                      </div>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        setLessonPreview(
                                          false
                                        )
                                      }
                                      style={styles.button}
                                    >
                                      Close
                                    </button>
                                  </div>

                                  <div
                                    style={styles.divider}
                                  />

                                  <h2
                                    style={{
                                      marginTop: 0,
                                    }}
                                  >
                                    {lesson.title}
                                  </h2>

                                  <div
                                    style={{
                                      ...styles.muted,
                                      marginBottom: 18,
                                    }}
                                  >
                                    {formatDuration(
                                      lesson.duration_minutes,
                                      lesson.duration_seconds
                                    )}
                                  </div>

                                  {lesson.video_url && (
                                    <div
                                      style={{
                                        marginBottom: 20,
                                      }}
                                    >
                                      <a
                                        href={
                                          lesson.video_url
                                        }
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        Open lesson video
                                      </a>
                                    </div>
                                  )}

                                  {lesson.content_html ? (
                                    <div
                                      style={{
                                        lineHeight: 1.75,
                                        color: "#334155",
                                      }}
                                      dangerouslySetInnerHTML={{
                                        __html:
                                          lesson.content_html,
                                      }}
                                    />
                                  ) : (
                                    <p
                                      style={
                                        styles.muted
                                      }
                                    >
                                      No lesson content has
                                      been added.
                                    </p>
                                  )}
                                </div>
                              )}

                            {/* RESOURCES */}
                            {selectedLessonId === lesson.id && (
                              <div
                                style={{
                                  ...styles.panelSoft,
                                  marginTop: 14,
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent:
                                      "space-between",
                                    gap: 12,
                                    alignItems: "center",
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <div>
                                    <strong>
                                      Lesson Resources
                                    </strong>

                                    <div
                                      style={{
                                        ...styles.muted,
                                        marginTop: 3,
                                      }}
                                    >
                                      {resources.length}{" "}
                                      resource
                                      {resources.length ===
                                      1
                                        ? ""
                                        : "s"}
                                    </div>
                                  </div>
                                </div>

                                {loadingResources ? (
                                  <p style={styles.muted}>
                                    Loading resources...
                                  </p>
                                ) : (
                                  <>
                                    {resources.length ===
                                      0 && (
                                      <p
                                        style={
                                          styles.muted
                                        }
                                      >
                                        No resources added.
                                      </p>
                                    )}

                                    {resources.map(
                                      (
                                        resource,
                                        resourceIndex
                                      ) => (
                                        <div
                                          key={
                                            resource.id
                                          }
                                          style={{
                                            marginTop: 10,
                                            padding: 12,
                                            background:
                                              "#fff",
                                            border:
                                              "1px solid #e2e8f0",
                                            borderRadius: 9,
                                          }}
                                        >
                                          <div
                                            style={{
                                              display:
                                                "flex",
                                              justifyContent:
                                                "space-between",
                                              gap: 12,
                                              flexWrap:
                                                "wrap",
                                              alignItems:
                                                "center",
                                            }}
                                          >
                                            <div>
                                              <strong>
                                                {resourceIndex +
                                                  1}
                                                .{" "}
                                                {
                                                  resource.title
                                                }
                                              </strong>

                                              <div
                                                style={{
                                                  ...styles.muted,
                                                  marginTop: 3,
                                                }}
                                              >
                                                {
                                                  resource.resource_type
                                                }{" "}
                                                ·{" "}
                                                <a
                                                  href={
                                                    resource.url
                                                  }
                                                  target="_blank"
                                                  rel="noreferrer"
                                                >
                                                  Open
                                                </a>
                                              </div>
                                            </div>

                                            <div
                                              style={
                                                styles.actionRow
                                              }
                                            >
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  moveResource(
                                                    resource,
                                                    "up"
                                                  )
                                                }
                                                disabled={
                                                  saving ||
                                                  resourceIndex ===
                                                    0
                                                }
                                                style={
                                                  styles.button
                                                }
                                              >
                                                ↑
                                              </button>

                                              <button
                                                type="button"
                                                onClick={() =>
                                                  moveResource(
                                                    resource,
                                                    "down"
                                                  )
                                                }
                                                disabled={
                                                  saving ||
                                                  resourceIndex ===
                                                    resources.length -
                                                      1
                                                }
                                                style={
                                                  styles.button
                                                }
                                              >
                                                ↓
                                              </button>

                                              <button
                                                type="button"
                                                onClick={() =>
                                                  beginEditResource(
                                                    resource
                                                  )
                                                }
                                                disabled={
                                                  saving
                                                }
                                                style={
                                                  styles.button
                                                }
                                              >
                                                Edit
                                              </button>

                                              <button
                                                type="button"
                                                onClick={() =>
                                                  deleteResource(
                                                    resource
                                                  )
                                                }
                                                disabled={
                                                  saving
                                                }
                                                style={
                                                  styles.button
                                                }
                                              >
                                                Delete
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      )
                                    )}

                                    <div
                                      style={{
                                        marginTop: 16,
                                        paddingTop: 16,
                                        borderTop:
                                          "1px solid #e2e8f0",
                                      }}
                                    >
                                      <h4
                                        style={{
                                          marginTop: 0,
                                          marginBottom: 14,
                                        }}
                                      >
                                        {editingResourceId
                                          ? "Edit Resource"
                                          : "Add Resource"}
                                      </h4>

                                      <div
                                        style={styles.grid}
                                      >
                                        <div
                                          style={
                                            styles.field
                                          }
                                        >
                                          <label
                                            style={
                                              styles.label
                                            }
                                          >
                                            Title
                                          </label>

                                          <input
                                            value={String(
                                              resourceForm.title ??
                                                ""
                                            )}
                                            onChange={(
                                              event
                                            ) =>
                                              updateResourceField(
                                                "title",
                                                event
                                                  .target
                                                  .value
                                              )
                                            }
                                            style={
                                              styles.input
                                            }
                                          />
                                        </div>

                                        <div
                                          style={
                                            styles.field
                                          }
                                        >
                                          <label
                                            style={
                                              styles.label
                                            }
                                          >
                                            Type
                                          </label>

                                          <select
                                            value={
                                              resourceForm.resource_type ??
                                              "link"
                                            }
                                            onChange={(
                                              event
                                            ) =>
                                              updateResourceField(
                                                "resource_type",
                                                event
                                                  .target
                                                  .value as LessonResource["resource_type"]
                                              )
                                            }
                                            style={
                                              styles.select
                                            }
                                          >
                                            <option value="file">
                                              File
                                            </option>
                                            <option value="link">
                                              Link
                                            </option>
                                            <option value="pdf">
                                              PDF
                                            </option>
                                            <option value="audio">
                                              Audio
                                            </option>
                                          </select>
                                        </div>
                                      </div>

                                      <div
                                        style={{
                                          ...styles.field,
                                          marginTop: 14,
                                        }}
                                      >
                                        <label
                                          style={
                                            styles.label
                                          }
                                        >
                                          URL
                                        </label>

                                        <input
                                          type="url"
                                          value={String(
                                            resourceForm.url ??
                                              ""
                                          )}
                                          onChange={(
                                            event
                                          ) =>
                                            updateResourceField(
                                              "url",
                                              event
                                                .target
                                                .value
                                            )
                                          }
                                          placeholder="https://..."
                                          style={
                                            styles.input
                                          }
                                        />
                                      </div>

                                      <div
                                        style={{
                                          ...styles.actionRow,
                                          marginTop: 14,
                                        }}
                                      >
                                        <button
                                          type="button"
                                          onClick={
                                            saveResource
                                          }
                                          disabled={saving}
                                          style={
                                            styles.button
                                          }
                                        >
                                          {saving
                                            ? "Saving..."
                                            : editingResourceId
                                              ? "Update Resource"
                                              : "Add Resource"}
                                        </button>

                                        {editingResourceId && (
                                          <button
                                            type="button"
                                            onClick={
                                              cancelResourceEdit
                                            }
                                            disabled={saving}
                                            style={
                                              styles.button
                                            }
                                          >
                                            Cancel
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                );
              })}

              {sections.length === 0 && (
                <div style={styles.panelSoft}>
                  <p style={{ margin: 0, ...styles.muted }}>
                    No sections yet. Add the first section above.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* LESSON EDITOR */}
      {editingLessonId && (
        <div style={styles.panel}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              alignItems: "center",
              flexWrap: "wrap",
              marginBottom: 18,
            }}
          >
            <div>
              <h3 style={{ margin: 0 }}>Edit Lesson</h3>

              <div style={{ ...styles.muted, marginTop: 5 }}>
                Edit lesson content, media, visibility and access.
              </div>
            </div>

            <div style={styles.actionRow}>
              {Boolean(lessonForm.is_published) &&
                renderStatusBadge("Published", "green")}

              {Boolean(lessonForm.is_preview) &&
                renderStatusBadge("Preview", "blue")}
            </div>
          </div>

          <div style={styles.grid}>
            <div style={styles.field}>
              <label style={styles.label}>Section</label>

              <select
                value={lessonSectionId}
                onChange={(event) =>
                  setLessonSectionId(event.target.value)
                }
                style={styles.select}
              >
                <option value="">Select section</option>

                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.title}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Title</label>

              <input
                value={String(lessonForm.title ?? "")}
                onChange={(event) => {
                  const title = event.target.value;

                  updateLessonField("title", title);

                  if (!lessonForm.slug) {
                    updateLessonField("slug", slugify(title));
                  }
                }}
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Slug</label>

              <input
                value={String(lessonForm.slug ?? "")}
                onChange={(event) =>
                  updateLessonField(
                    "slug",
                    event.target.value
                  )
                }
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Video URL</label>

              <input
                value={String(lessonForm.video_url ?? "")}
                onChange={(event) =>
                  updateLessonField(
                    "video_url",
                    event.target.value
                  )
                }
                placeholder="https://..."
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>
                Duration (minutes)
              </label>

              <input
                type="number"
                min="0"
                value={Number(
                  lessonForm.duration_minutes ?? 0
                )}
                onChange={(event) =>
                  updateLessonField(
                    "duration_minutes",
                    Number(event.target.value)
                  )
                }
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>
                Duration (seconds)
              </label>

              <input
                type="number"
                min="0"
                value={Number(
                  lessonForm.duration_seconds ?? 0
                )}
                onChange={(event) =>
                  updateLessonField(
                    "duration_seconds",
                    Number(event.target.value)
                  )
                }
                style={styles.input}
              />
            </div>
          </div>

          <div
            style={{
              ...styles.field,
              marginTop: 18,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <label style={styles.label}>
                Lesson HTML content
              </label>

              <button
                type="button"
                onClick={() =>
                  setContentPreview((value) => !value)
                }
                style={styles.button}
              >
                {contentPreview
                  ? "Edit HTML"
                  : "Preview Content"}
              </button>
            </div>

            {contentPreview ? (
              <div
                style={{
                  ...styles.panelSoft,
                  minHeight: 260,
                  lineHeight: 1.75,
                  color: "#334155",
                }}
              >
                {lessonForm.content_html ? (
                  <div
                    dangerouslySetInnerHTML={{
                      __html: String(
                        lessonForm.content_html
                      ),
                    }}
                  />
                ) : (
                  <p style={styles.muted}>
                    No lesson content has been entered.
                  </p>
                )}
              </div>
            ) : (
              <textarea
                value={String(
                  lessonForm.content_html ?? ""
                )}
                onChange={(event) =>
                  updateLessonField(
                    "content_html",
                    event.target.value
                  )
                }
                rows={16}
                placeholder="<h2>Lesson heading</h2><p>Lesson content...</p>"
                style={{
                  ...styles.textarea,
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 13,
                }}
              />
            )}
          </div>

          {lessonForm.video_url && (
            <div
              style={{
                ...styles.panelSoft,
                marginTop: 18,
              }}
            >
              <strong>Video</strong>

              <div style={{ marginTop: 6 }}>
                <a
                  href={String(lessonForm.video_url)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open video URL
                </a>
              </div>
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
              marginTop: 18,
            }}
          >
            <label
              style={{
                ...styles.panelSoft,
                cursor: "pointer",
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
              }}
            >
              <input
                type="checkbox"
                checked={Boolean(
                  lessonForm.is_preview
                )}
                onChange={(event) =>
                  updateLessonField(
                    "is_preview",
                    event.target.checked
                  )
                }
                style={{
                  marginTop: 3,
                }}
              />

              <span>
                <strong>Preview lesson</strong>
                <span
                  style={{
                    ...styles.muted,
                    display: "block",
                    marginTop: 3,
                  }}
                >
                  Allow the lesson to be accessible as a public
                  preview when the course is published.
                </span>
              </span>
            </label>

            <label
              style={{
                ...styles.panelSoft,
                cursor: "pointer",
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
              }}
            >
              <input
                type="checkbox"
                checked={Boolean(
                  lessonForm.is_published
                )}
                onChange={(event) =>
                  updateLessonField(
                    "is_published",
                    event.target.checked
                  )
                }
                style={{
                  marginTop: 3,
                }}
              />

              <span>
                <strong>Published</strong>
                <span
                  style={{
                    ...styles.muted,
                    display: "block",
                    marginTop: 3,
                  }}
                >
                  Include this lesson in the published curriculum.
                </span>
              </span>
            </label>
          </div>

          <div
            style={{
              ...styles.actionRow,
              marginTop: 20,
              paddingTop: 18,
              borderTop: "1px solid #e2e8f0",
            }}
          >
            <button
              type="button"
              onClick={saveLesson}
              disabled={saving}
              style={styles.button}
            >
              {saving ? "Saving..." : "Save Lesson"}
            </button>

            <button
              type="button"
              onClick={cancelLessonEdit}
              disabled={saving}
              style={styles.button}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* SELECTED LESSON SUMMARY */}
      {selectedLesson && !editingLessonId && (
        <div style={styles.panel}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div>
              <div style={styles.actionRow}>
                {selectedLesson.is_published
                  ? renderStatusBadge("Published", "green")
                  : renderStatusBadge("Draft", "amber")}

                {selectedLesson.is_preview &&
                  renderStatusBadge("Preview", "blue")}
              </div>

              <strong
                style={{
                  display: "block",
                  marginTop: 8,
                  fontSize: 16,
                }}
              >
                {selectedLesson.title}
              </strong>

              <div
                style={{
                  ...styles.muted,
                  marginTop: 4,
                }}
              >
                {formatDuration(
                  selectedLesson.duration_minutes,
                  selectedLesson.duration_seconds
                )}
              </div>
            </div>

            <div style={styles.actionRow}>
              <button
                type="button"
                onClick={() => {
                  setLessonPreview(true);
                  setSelectedLessonId(selectedLesson.id);
                }}
                style={styles.button}
              >
                Preview Lesson
              </button>

              <button
                type="button"
                onClick={() =>
                  beginEditLesson(selectedLesson)
                }
                style={styles.button}
              >
                Edit Lesson
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
