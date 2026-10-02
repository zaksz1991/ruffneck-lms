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

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) ?? null,
    [courses, selectedCourseId]
  );

  const selectedLesson = useMemo(
    () => lessons.find((lesson) => lesson.id === selectedLessonId) ?? null,
    [lessons, selectedLessonId]
  );

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

    const [{ data: sectionData, error: sectionError }, { data: lessonData, error: lessonError }] =
      await Promise.all([
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
  }

  function beginEditCourse(course: Course) {
    clearMessages();
    setSelectedCourseId(course.id);
    setCourseForm(course);
    setEditingCourse(true);
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
  }

  function beginEditLesson(lesson: Lesson) {
    clearMessages();

    setLessonSectionId(lesson.section_id);
    setLessonForm(lesson);
    setEditingLessonId(lesson.id);
    setSelectedLessonId(lesson.id);
  }

  function cancelLessonEdit() {
    setLessonSectionId("");
    setLessonForm(emptyLesson);
    setEditingLessonId(null);
  }

  async function saveLesson() {
    if (!selectedCourseId) {
      setError("Select a course first.");
      return;
    }

    const title = String(lessonForm.title ?? "").trim();
    const slug = String(lessonForm.slug ?? "").trim();
    const sectionId = lessonSectionId || String(lessonForm.section_id ?? "");

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
      setMessage("Lesson created.");
    }

    setLessonForm(emptyLesson);
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

  return (
    <div>
      {message && (
        <div
          className="panel"
          style={{
            marginBottom: 16,
            borderLeft: "4px solid #16a34a",
          }}
        >
          {message}
        </div>
      )}

      {error && (
        <div
          className="panel"
          style={{
            marginBottom: 16,
            borderLeft: "4px solid #dc2626",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      <div
        className="panel"
        style={{
          marginBottom: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 260 }}>
          <label
            style={{
              display: "block",
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            Course
          </label>

          <select
            value={selectedCourseId}
            onChange={(event) => {
              clearMessages();
              setSelectedCourseId(event.target.value);
              setEditingCourse(false);
            }}
            style={{ width: "100%", padding: 10 }}
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
        >
          + New Course
        </button>
      </div>

      {editingCourse && (
        <div className="panel" style={{ marginBottom: 24 }}>
          <h3 style={{ marginTop: 0 }}>
            {selectedCourseId ? "Edit Course" : "Create Course"}
          </h3>

          <div className="grid">
            <div>
              <label>Title</label>
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
                style={{ width: "100%", padding: 10 }}
              />
            </div>

            <div>
              <label>Slug</label>
              <input
                value={String(courseForm.slug ?? "")}
                onChange={(event) =>
                  updateCourseField("slug", event.target.value)
                }
                style={{ width: "100%", padding: 10 }}
              />
            </div>

            <div>
              <label>Category</label>
              <input
                value={String(courseForm.category ?? "")}
                onChange={(event) =>
                  updateCourseField("category", event.target.value)
                }
                style={{ width: "100%", padding: 10 }}
              />
            </div>

            <div>
              <label>Level</label>
              <select
                value={courseForm.level ?? "beginner"}
                onChange={(event) =>
                  updateCourseField(
                    "level",
                    event.target.value as Course["level"]
                  )
                }
                style={{ width: "100%", padding: 10 }}
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            <div>
              <label>Price (NGN)</label>
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
                style={{ width: "100%", padding: 10 }}
              />
            </div>

            <div>
              <label>Status</label>
              <select
                value={courseForm.status ?? "draft"}
                onChange={(event) =>
                  updateCourseField(
                    "status",
                    event.target.value as Course["status"]
                  )
                }
                style={{ width: "100%", padding: 10 }}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            {role === "admin" && (
              <div>
                <label>Instructor</label>
                <select
                  value={courseForm.instructor_id ?? ""}
                  onChange={(event) =>
                    updateCourseField(
                      "instructor_id",
                      event.target.value || null
                    )
                  }
                  style={{ width: "100%", padding: 10 }}
                >
                  <option value="">No instructor assigned</option>

                  {instructors.map((instructor) => (
                    <option key={instructor.id} value={instructor.id}>
                      {instructor.full_name || instructor.email || instructor.id}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label>Duration (minutes)</label>
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
                style={{ width: "100%", padding: 10 }}
              />
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <label>Short description</label>
            <textarea
              value={String(courseForm.short_description ?? "")}
              onChange={(event) =>
                updateCourseField(
                  "short_description",
                  event.target.value
                )
              }
              rows={3}
              style={{ width: "100%", padding: 10 }}
            />
          </div>

          <div style={{ marginTop: 16 }}>
            <label>Description</label>
            <textarea
              value={String(courseForm.description ?? "")}
              onChange={(event) =>
                updateCourseField("description", event.target.value)
              }
              rows={6}
              style={{ width: "100%", padding: 10 }}
            />
          </div>

          <div className="grid" style={{ marginTop: 16 }}>
            <div>
              <label>Thumbnail URL</label>
              <input
                value={String(courseForm.thumbnail_url ?? "")}
                onChange={(event) =>
                  updateCourseField(
                    "thumbnail_url",
                    event.target.value
                  )
                }
                style={{ width: "100%", padding: 10 }}
              />
            </div>

            <div>
              <label>Intro video URL</label>
              <input
                value={String(courseForm.intro_video_url ?? "")}
                onChange={(event) =>
                  updateCourseField(
                    "intro_video_url",
                    event.target.value
                  )
                }
                style={{ width: "100%", padding: 10 }}
              />
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <label>Learning outcomes — one per line</label>
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
              style={{ width: "100%", padding: 10 }}
            />
          </div>

          <div style={{ marginTop: 16 }}>
            <label>Target audience</label>
            <textarea
              value={String(courseForm.target_audience ?? "")}
              onChange={(event) =>
                updateCourseField(
                  "target_audience",
                  event.target.value
                )
              }
              rows={3}
              style={{ width: "100%", padding: 10 }}
            />
          </div>

          <div className="grid" style={{ marginTop: 16 }}>
            <div>
              <label>SEO title</label>
              <input
                value={String(courseForm.seo_title ?? "")}
                onChange={(event) =>
                  updateCourseField("seo_title", event.target.value)
                }
                style={{ width: "100%", padding: 10 }}
              />
            </div>

            <div>
              <label>SEO description</label>
              <input
                value={String(courseForm.seo_description ?? "")}
                onChange={(event) =>
                  updateCourseField(
                    "seo_description",
                    event.target.value
                  )
                }
                style={{ width: "100%", padding: 10 }}
              />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 20,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={saveCourse}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Course"}
            </button>

            <button
              type="button"
              onClick={cancelCourseEdit}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {selectedCourse && !editingCourse && (
        <div className="panel" style={{ marginBottom: 24 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h3 style={{ marginTop: 0 }}>
                {selectedCourse.title}
              </h3>

              <div className="muted">
                {selectedCourse.status} ·{" "}
                {selectedCourse.is_free
                  ? "Free"
                  : `₦${selectedCourse.price_ngn.toLocaleString()}`}
              </div>

              {role === "admin" && (
                <div className="muted" style={{ marginTop: 6 }}>
                  Instructor:{" "}
                  {selectedCourse.instructor_id
                    ? instructors.find(
                        (item) =>
                          item.id === selectedCourse.instructor_id
                      )?.full_name ||
                      instructors.find(
                        (item) =>
                          item.id === selectedCourse.instructor_id
                      )?.email ||
                      "Assigned"
                    : "Not assigned"}
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() => beginEditCourse(selectedCourse)}
                disabled={saving}
              >
                Edit
              </button>

              <a
                href={`/courses/${selectedCourse.slug}`}
                target="_blank"
                rel="noreferrer"
              >
                <button type="button">View</button>
              </a>

              {role === "admin" && (
                <button
                  type="button"
                  onClick={() => deleteCourse(selectedCourse.id)}
                  disabled={saving}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedCourseId && (
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Curriculum</h3>

          {loadingCurriculum ? (
            <p className="muted">Loading curriculum...</p>
          ) : (
            <>
              <div className="muted" style={{ marginBottom: 20 }}>
                {sections.length} section
                {sections.length === 1 ? "" : "s"} ·{" "}
                {lessons.length} lesson
                {lessons.length === 1 ? "" : "s"}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  marginBottom: 24,
                }}
              >
                <input
                  value={sectionTitle}
                  placeholder={
                    editingSectionId
                      ? "Rename section"
                      : "New section title"
                  }
                  onChange={(event) =>
                    setSectionTitle(event.target.value)
                  }
                  style={{
                    padding: 10,
                    minWidth: 240,
                  }}
                />

                <button
                  type="button"
                  onClick={saveSection}
                  disabled={saving}
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
                    className="panel"
                    style={{
                      marginBottom: 16,
                      background: "transparent",
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
                      <div>
                        <strong>
                          {sectionIndex + 1}. {section.title}
                        </strong>

                        <div className="muted">
                          {sectionLessons.length} lesson
                          {sectionLessons.length === 1 ? "" : "s"}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            moveSection(section, "up")
                          }
                          disabled={
                            saving || sectionIndex === 0
                          }
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
                        >
                          ↓
                        </button>

                        <button
                          type="button"
                          onClick={() => editSection(section)}
                          disabled={saving}
                        >
                          Rename
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteSection(section)}
                          disabled={saving}
                        >
                          Delete
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            beginCreateLesson(section.id)
                          }
                          disabled={saving}
                        >
                          + Lesson
                        </button>
                      </div>
                    </div>

                    {sectionLessons.length === 0 && (
                      <p
                        className="muted"
                        style={{ marginBottom: 0 }}
                      >
                        No lessons in this section.
                      </p>
                    )}

                    {sectionLessons.map(
                      (lesson, lessonIndex) => (
                        <div
                          key={lesson.id}
                          style={{
                            borderTop: "1px solid rgba(0,0,0,.1)",
                            marginTop: 12,
                            paddingTop: 12,
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
                            <div>
                              <strong>
                                {lessonIndex + 1}.{" "}
                                {lesson.title}
                              </strong>

                              <div className="muted">
                                {lesson.is_published
                                  ? "Published"
                                  : "Draft"}{" "}
                                ·{" "}
                                {lesson.is_preview
                                  ? "Preview"
                                  : "Members only"}
                              </div>
                            </div>

                            <div
                              style={{
                                display: "flex",
                                gap: 6,
                                flexWrap: "wrap",
                              }}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  moveLesson(lesson, "up")
                                }
                                disabled={
                                  saving ||
                                  lessonIndex === 0
                                }
                              >
                                ↑
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  moveLesson(lesson, "down")
                                }
                                disabled={
                                  saving ||
                                  lessonIndex ===
                                    sectionLessons.length - 1
                                }
                              >
                                ↓
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  beginEditLesson(lesson)
                                }
                                disabled={saving}
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  deleteLesson(lesson)
                                }
                                disabled={saving}
                              >
                                Delete
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  beginCreateResource(lesson.id)
                                }
                                disabled={saving}
                              >
                                Resources
                              </button>
                            </div>
                          </div>

                          {selectedLessonId === lesson.id && (
                            <div
                              className="panel"
                              style={{
                                marginTop: 12,
                                background: "transparent",
                              }}
                            >
                              <strong>
                                Lesson Resources
                              </strong>

                              {loadingResources ? (
                                <p className="muted">
                                  Loading resources...
                                </p>
                              ) : (
                                <>
                                  {resources.length === 0 && (
                                    <p className="muted">
                                      No resources added.
                                    </p>
                                  )}

                                  {resources.map(
                                    (
                                      resource,
                                      resourceIndex
                                    ) => (
                                      <div
                                        key={resource.id}
                                        style={{
                                          borderTop:
                                            "1px solid rgba(0,0,0,.1)",
                                          paddingTop: 10,
                                          marginTop: 10,
                                        }}
                                      >
                                        <div
                                          style={{
                                            display: "flex",
                                            justifyContent:
                                              "space-between",
                                            gap: 12,
                                            flexWrap: "wrap",
                                          }}
                                        >
                                          <div>
                                            <strong>
                                              {resourceIndex +
                                                1}
                                              .{" "}
                                              {resource.title}
                                            </strong>

                                            <div className="muted">
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
                                            style={{
                                              display: "flex",
                                              gap: 6,
                                            }}
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
                                              disabled={saving}
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
                                              disabled={saving}
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
                                        "1px solid rgba(0,0,0,.1)",
                                    }}
                                  >
                                    <h4
                                      style={{
                                        marginTop: 0,
                                      }}
                                    >
                                      {editingResourceId
                                        ? "Edit Resource"
                                        : "Add Resource"}
                                    </h4>

                                    <div className="grid">
                                      <div>
                                        <label>
                                          Title
                                        </label>

                                        <input
                                          value={String(
                                            resourceForm.title ??
                                              ""
                                          )}
                                          onChange={(event) =>
                                            updateResourceField(
                                              "title",
                                              event.target.value
                                            )
                                          }
                                          style={{
                                            width: "100%",
                                            padding: 10,
                                          }}
                                        />
                                      </div>

                                      <div>
                                        <label>
                                          Type
                                        </label>

                                        <select
                                          value={
                                            resourceForm.resource_type ??
                                            "link"
                                          }
                                          onChange={(event) =>
                                            updateResourceField(
                                              "resource_type",
                                              event.target
                                                .value as LessonResource["resource_type"]
                                            )
                                          }
                                          style={{
                                            width: "100%",
                                            padding: 10,
                                          }}
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
                                        marginTop: 12,
                                      }}
                                    >
                                      <label>
                                        URL
                                      </label>

                                      <input
                                        type="url"
                                        value={String(
                                          resourceForm.url ?? ""
                                        )}
                                        onChange={(event) =>
                                          updateResourceField(
                                            "url",
                                            event.target.value
                                          )
                                        }
                                        placeholder="https://..."
                                        style={{
                                          width: "100%",
                                          padding: 10,
                                        }}
                                      />
                                    </div>

                                    <div
                                      style={{
                                        display: "flex",
                                        gap: 8,
                                        marginTop: 12,
                                        flexWrap: "wrap",
                                      }}
                                    >
                                      <button
                                        type="button"
                                        onClick={saveResource}
                                        disabled={saving}
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
                );
              })}

              {sections.length === 0 && (
                <p className="muted">
                  No sections yet. Add the first section above.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {editingLessonId && (
        <div className="panel" style={{ marginTop: 24 }}>
          <h3 style={{ marginTop: 0 }}>Edit Lesson</h3>

          <div className="grid">
            <div>
              <label>Section</label>

              <select
                value={lessonSectionId}
                onChange={(event) =>
                  setLessonSectionId(event.target.value)
                }
                style={{
                  width: "100%",
                  padding: 10,
                }}
              >
                <option value="">Select section</option>

                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Title</label>

              <input
                value={String(lessonForm.title ?? "")}
                onChange={(event) => {
                  const title = event.target.value;

                  updateLessonField("title", title);

                  if (!lessonForm.slug) {
                    updateLessonField("slug", slugify(title));
                  }
                }}
                style={{
                  width: "100%",
                  padding: 10,
                }}
              />
            </div>

            <div>
              <label>Slug</label>

              <input
                value={String(lessonForm.slug ?? "")}
                onChange={(event) =>
                  updateLessonField(
                    "slug",
                    event.target.value
                  )
                }
                style={{
                  width: "100%",
                  padding: 10,
                }}
              />
            </div>

            <div>
              <label>Video URL</label>

              <input
                value={String(lessonForm.video_url ?? "")}
                onChange={(event) =>
                  updateLessonField(
                    "video_url",
                    event.target.value
                  )
                }
                style={{
                  width: "100%",
                  padding: 10,
                }}
              />
            </div>

            <div>
              <label>Duration (minutes)</label>

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
                style={{
                  width: "100%",
                  padding: 10,
                }}
              />
            </div>

            <div>
              <label>Duration (seconds)</label>

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
                style={{
                  width: "100%",
                  padding: 10,
                }}
              />
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <label>Lesson HTML content</label>

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
              rows={12}
              style={{
                width: "100%",
                padding: 10,
                fontFamily: "monospace",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              gap: 20,
              marginTop: 16,
              flexWrap: "wrap",
            }}
          >
            <label>
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
              />{" "}
              Preview lesson
            </label>

            <label>
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
              />{" "}
              Published
            </label>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 20,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={saveLesson}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Lesson"}
            </button>

            <button
              type="button"
              onClick={cancelLessonEdit}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {selectedLesson && !editingLessonId && (
        <div className="panel" style={{ marginTop: 24 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <strong>{selectedLesson.title}</strong>

              <div className="muted">
                {selectedLesson.is_published
                  ? "Published"
                  : "Draft"}{" "}
                ·{" "}
                {selectedLesson.is_preview
                  ? "Preview"
                  : "Members only"}
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={() =>
                  beginEditLesson(selectedLesson)
                }
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
