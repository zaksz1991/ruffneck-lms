import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import styles from "./InstructorDashboard.module.css";

type InstructorCourse = {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  status: "draft" | "published" | "archived";
  updated_at: string | null;
  created_at: string;
};

export const dynamic = "force-dynamic";

function initials(name: string | null, email: string | null) {
  const value = (name || email?.split("@")[0] || "Instructor").trim();
  return value.split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("");
}

function formatDate(value: string | null) {
  if (!value) return "Not updated yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not updated yet";
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(date);
}

export default async function InstructorDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) redirect("/login?next=/instructor/dashboard");

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Instructor dashboard profile lookup failed:", profileError.message);
    throw new Error("Unable to verify instructor access.");
  }

  const profile = profileData as { full_name: string | null; email: string | null; role: string } | null;
  if (profile?.role === "admin") redirect("/admin/lms");
  if (profile?.role !== "instructor") redirect("/student/dashboard");

  const { data: courseData, error: courseError } = await supabase
    .from("courses")
    .select("id, title, slug, category, status, updated_at, created_at")
    .eq("instructor_id", user.id)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(100);

  if (courseError) {
    console.error("Instructor course lookup failed:", courseError.message);
    throw new Error("Unable to load your assigned courses.");
  }

  const courses = (courseData ?? []) as InstructorCourse[];
  const courseIds = courses.map((course) => course.id);
  const publishedCourseCount = courses.filter((course) => course.status === "published").length;

  let enrollmentCount = 0;
  let pendingLabReviews = 0;
  let pendingProjectReviews = 0;
  let labCount = 0;
  let projectCount = 0;

  if (courseIds.length > 0) {
    const { count, error } = await supabase
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .in("course_id", courseIds);
    if (error) console.error("Instructor enrollment count failed:", error.message);
    enrollmentCount = count ?? 0;

    const { data: labData, error: labsError } = await supabase
      .from("practical_labs")
      .select("id")
      .in("course_id", courseIds);
    if (labsError) {
      console.error("Instructor lab lookup failed:", labsError.message);
    } else {
      const labIds = (labData ?? []).map((item: { id: string }) => item.id);
      labCount = labIds.length;
      if (labIds.length > 0) {
        const { count: pendingCount, error: pendingError } = await supabase
          .from("lab_submissions")
          .select("id", { count: "exact", head: true })
          .in("lab_id", labIds)
          .eq("status", "submitted");
        if (pendingError) console.error("Instructor pending lab count failed:", pendingError.message);
        pendingLabReviews = pendingCount ?? 0;
      }
    }

    const { data: projectData, error: projectsError } = await supabase
      .from("course_projects")
      .select("id")
      .in("course_id", courseIds)
      .eq("is_published", true);
    if (projectsError) {
      console.error("Instructor project lookup failed:", projectsError.message);
    } else {
      const projectIds = (projectData ?? []).map((item: { id: string }) => item.id);
      projectCount = projectIds.length;
      if (projectIds.length > 0) {
        const { count: pendingCount, error: pendingError } = await supabase
          .from("project_submissions")
          .select("id", { count: "exact", head: true })
          .in("project_id", projectIds)
          .in("status", ["submitted", "under_review"]);
        if (pendingError) console.error("Instructor pending project count failed:", pendingError.message);
        pendingProjectReviews = pendingCount ?? 0;
      }
    }
  }

  const displayName = profile.full_name?.trim() || user.email?.split("@")[0] || "Instructor";
  const totalPendingReviews = pendingLabReviews + pendingProjectReviews;

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroMain}>
          <div className={styles.eyebrow}>RUFFNECK LEARN · TEACHING WORKSPACE</div>
          <h1>Welcome back, {displayName.split(/\s+/)[0]}.</h1>
          <p>Manage your assigned courses, follow learner activity, and keep reviews moving from one workspace.</p>
          <div className={styles.heroActions}>
            <Link href="/admin/lms?view=courses" className={styles.primaryButton}>Manage my courses <span aria-hidden="true">→</span></Link>
            <Link href="/account/profile" className={styles.heroButton}>My profile</Link>
          </div>
        </div>
        <div className={styles.identity}>
          <div className={styles.avatar}>{initials(profile.full_name, profile.email || user.email || null)}</div>
          <div><strong>{displayName}</strong><span>{profile.email || user.email}</span><small>Instructor account</small></div>
        </div>
      </header>

      <section className={styles.stats} aria-label="Teaching overview">
        <article className={styles.statCard}><span className={styles.statIcon}>▦</span><div><span>Assigned courses</span><strong>{courses.length}</strong><small>{publishedCourseCount} published</small></div></article>
        <article className={styles.statCard}><span className={styles.statIcon}>◉</span><div><span>Enrollments</span><strong>{enrollmentCount}</strong><small>Across your courses</small></div></article>
        <article className={`${styles.statCard} ${totalPendingReviews > 0 ? styles.attention : ""}`}><span className={styles.statIcon}>◷</span><div><span>Reviews awaiting review</span><strong>{totalPendingReviews}</strong><small>{pendingLabReviews} lab · {pendingProjectReviews} project</small></div></article>
        <article className={styles.statCard}><span className={styles.statIcon}>✦</span><div><span>Published activities</span><strong>{labCount + projectCount}</strong><small>{labCount} labs · {projectCount} projects</small></div></article>
      </section>

      <section className={styles.contentGrid}>
        <div className={styles.panel}>
          <div className={styles.panelHeading}><div><span className={styles.eyebrowDark}>TEACHING</span><h2>My courses</h2><p>Only courses assigned to your instructor account appear here.</p></div><Link href="/admin/lms?view=courses" className={styles.textLink}>Manage courses →</Link></div>
          {courses.length === 0 ? (
            <div className={styles.empty}><div className={styles.emptyIcon}>▦</div><h3>No courses assigned yet</h3><p>Your dashboard will show course activity after an administrator assigns a course to your account.</p><Link href="/admin/lms" className={styles.secondaryButton}>Open instructor workspace</Link></div>
          ) : (
            <div className={styles.courseList}>
              {courses.slice(0, 6).map((course) => (
                <article className={styles.courseRow} key={course.id}>
                  <div className={styles.courseMark}>{(course.title.trim()[0] || "C").toUpperCase()}</div>
                  <div className={styles.courseBody}><h3>{course.title}</h3><p>{course.category || "Practical skills course"} · Updated {formatDate(course.updated_at || course.created_at)}</p></div>
                  <span className={`${styles.status} ${course.status === "published" ? styles.statusPublished : course.status === "draft" ? styles.statusDraft : styles.statusArchived}`}>{course.status}</span>
                  <Link href={`/courses/${course.slug}`} className={styles.courseLink}>View ↗</Link>
                </article>
              ))}
              {courses.length > 6 ? <p className={styles.moreCourses}>Showing 6 of {courses.length} assigned courses.</p> : null}
            </div>
          )}
        </div>

        <aside className={styles.sideColumn}>
          <section className={styles.panel}>
            <div className={styles.panelHeading}><div><span className={styles.eyebrowDark}>QUICK ACTIONS</span><h2>Review & manage</h2></div></div>
            <nav className={styles.actionList} aria-label="Instructor quick actions">
              <Link href="/admin/labs" className={styles.action}><span className={styles.actionIcon}>✓</span><span><strong>Practical Labs</strong><small>Review submitted lab work</small></span><b>{pendingLabReviews}</b></Link>
              <Link href="/admin/projects" className={styles.action}><span className={styles.actionIcon}>◇</span><span><strong>Projects & capstones</strong><small>Assess learner projects</small></span><b>{pendingProjectReviews}</b></Link>
              <Link href="/admin/assessments" className={styles.action}><span className={styles.actionIcon}>▤</span><span><strong>Assessments</strong><small>Open assessment management</small></span><span aria-hidden="true">→</span></Link>
              <Link href="/admin/ai-drafts" className={styles.action}><span className={styles.actionIcon}>✦</span><span><strong>AI drafts</strong><small>Review learning drafts</small></span><span aria-hidden="true">→</span></Link>
            </nav>
          </section>

          <section className={styles.profilePanel}>
            <span className={styles.eyebrowDark}>PROFILE & ACCOUNT</span>
            <h2>Keep your details current</h2>
            <p>Update the name and phone number displayed in your RuffNeck Learn account. Your email and instructor role remain protected here.</p>
            <Link href="/account/profile" className={styles.secondaryButton}>Edit my profile</Link>
          </section>
        </aside>
      </section>
    </main>
  );
}
