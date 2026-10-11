import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PracticalWorkClient from "./PracticalWorkClient";

type Course = {
  id: string;
  title: string;
  slug: string;
};

type Task = {
  id: string;
  course_id: string;
  title: string;
  scenario: string;
  instructions: string;
  expected_outcome: string;
  submission_type:
    | "text"
    | "document"
    | "spreadsheet"
    | "presentation"
    | "mixed";
  max_score: number;
  sort_order: number;
  is_published: boolean;
  skill_id: string | null;
};

type Submission = {
  id: string;
  task_id: string;
  student_id: string;
  submission_text: string | null;
  status:
    | "draft"
    | "submitted"
    | "under_review"
    | "approved"
    | "revision_required";
  score: number | null;
  reviewer_feedback: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  evidence_file_path: string | null;
  evidence_file_name: string | null;
  evidence_file_type: string | null;
  evidence_file_size: number | null;
  evidence_recorded_at: string | null;
  evidence_file_url?: string | null;
};

type SkillProfile = {
  skill_id: string;
  score: number | null;
  confidence_score: number | null;
  skill_level: string | null;
  evidence_count: number | null;
  evidence: string[] | null;
  strengths: string[] | null;
  gaps: string[] | null;
};

type LearningSkill = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  description: string | null;
};

async function getPageData() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/student/practical-work");
  }

  const {
    data: enrollments,
    error: enrollmentError,
  } = await supabase
    .from("enrollments")
    .select("course_id, enrollment_status")
    .eq("student_id", user.id)
    .in("enrollment_status", ["active", "completed"]);

  if (enrollmentError) {
    throw new Error("Unable to load your course access.");
  }

  const courseIds = [
    ...new Set(
      (enrollments ?? []).map(
        (enrollment) => enrollment.course_id,
      ),
    ),
  ];

  if (courseIds.length === 0) {
    return {
      courses: [] as Course[],
      tasks: [] as Task[],
      submissions: [] as Submission[],
      skills: [] as LearningSkill[],
      skillProfiles: [] as SkillProfile[],
    };
  }

  const [
    coursesResult,
    tasksResult,
    submissionsResult,
    skillProfilesResult,
  ] = await Promise.all([
    supabase
      .from("courses")
      .select("id, title, slug")
      .in("id", courseIds)
      .eq("status", "published")
      .order("title", { ascending: true }),

    supabase
      .from("course_practical_tasks")
      .select(`
        id,
        course_id,
        title,
        scenario,
        instructions,
        expected_outcome,
        submission_type,
        max_score,
        sort_order,
        is_published,
        skill_id
      `)
      .in("course_id", courseIds)
      .eq("is_published", true)
      .order("sort_order", { ascending: true }),

    supabase
      .from("student_practical_task_submissions")
      .select(`
        id,
        task_id,
        student_id,
        submission_text,
        status,
        score,
        reviewer_feedback,
        submitted_at,
        reviewed_at,
        evidence_file_path,
        evidence_file_name,
        evidence_file_type,
        evidence_file_size,
        evidence_recorded_at
      `)
      .eq("student_id", user.id),

    supabase
      .from("learner_skill_profiles")
      .select(`
        skill_id,
        score,
        confidence_score,
        skill_level,
        evidence_count,
        evidence,
        strengths,
        gaps
      `)
      .eq("student_id", user.id),
  ]);

  if (coursesResult.error) {
    throw new Error("Unable to load your courses.");
  }

  if (tasksResult.error) {
    throw new Error("Unable to load practical tasks.");
  }

  if (submissionsResult.error) {
    throw new Error("Unable to load your practical submissions.");
  }

  if (skillProfilesResult.error) {
    throw new Error("Unable to load your learning intelligence.");
  }

  const tasks = (tasksResult.data ?? []) as unknown as Task[];

  const skillIds = [
    ...new Set(
      tasks
        .map((task) => task.skill_id)
        .filter(
          (skillId): skillId is string =>
            Boolean(skillId),
        ),
    ),
  ];

  let skills: LearningSkill[] = [];

  if (skillIds.length > 0) {
    const {
      data: skillRows,
      error: skillsError,
    } = await supabase
      .from("learning_skills")
      .select("id, name, slug, category, description")
      .in("id", skillIds)
      .order("name", { ascending: true });

    if (skillsError) {
      throw new Error("Unable to load learning skills.");
    }

    skills = (skillRows ?? []) as LearningSkill[];
  }

  return {
    courses: (coursesResult.data ?? []) as Course[],
    tasks,
    submissions:
      (submissionsResult.data ?? []) as unknown as Submission[],
    skills,
    skillProfiles:
      (skillProfilesResult.data ?? []) as unknown as SkillProfile[],
  };
}

function formatSkillLevel(value: string | null) {
  if (!value) return "Developing";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatConfidence(value: number | null) {
  if (value === null) return "—";

  const normalized = value <= 1 ? value * 100 : value;

  return `${Math.round(normalized)}%`;
}

const styles = `
  .pw-page {
    --pw-navy: #0b1e3a;
    --pw-blue: #123d63;
    --pw-cyan: #00b4d8;
    --pw-gold: #fbbf24;
    --pw-text: #172b43;
    --pw-muted: #64748b;
    --pw-border: #dfe7ef;
    width: 100%;
    max-width: 1240px;
    margin: 0 auto;
    padding: 28px 22px 56px;
    color: var(--pw-text);
    box-sizing: border-box;
    font-family: inherit;
  }

  .pw-page *,
  .pw-page *::before,
  .pw-page *::after {
    box-sizing: border-box;
  }

  .pw-page a {
    text-decoration: none;
  }

  .pw-hero {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    flex-wrap: wrap;
    overflow: hidden;
    padding: 34px;
    color: #fff;
    background: linear-gradient(125deg, var(--pw-navy), var(--pw-blue));
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 22px;
    box-shadow: 0 16px 38px rgba(11,30,58,.12);
  }

  .pw-hero::after {
    content: "";
    position: absolute;
    right: -75px;
    bottom: -150px;
    width: 320px;
    height: 320px;
    border: 1px solid rgba(0,180,216,.22);
    border-radius: 50%;
    box-shadow: 0 0 0 35px rgba(0,180,216,.045),
                0 0 0 75px rgba(0,180,216,.035);
    pointer-events: none;
  }

  .pw-hero-content {
    position: relative;
    z-index: 1;
    max-width: 790px;
  }

  .pw-eyebrow {
    margin: 0 0 10px;
    color: #0784a2;
    font-size: 12px;
    font-weight: 850;
    letter-spacing: .14em;
    line-height: 1.5;
    text-transform: uppercase;
  }

  .pw-hero .pw-eyebrow {
    color: #7ce7f5;
  }

  .pw-hero h1 {
    max-width: 760px;
    margin: 0 0 16px;
    color: #fff;
    font-size: clamp(28px, 4vw, 43px);
    font-weight: 850;
    line-height: 1.13;
    letter-spacing: -.035em;
  }

  .pw-hero-description {
    max-width: 730px;
    margin: 0;
    color: #d7e7f4;
    font-size: 15px;
    line-height: 1.85;
  }

  .pw-actions {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .pw-button {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    min-height: 44px;
    padding: 11px 17px;
    border: 1px solid transparent;
    border-radius: 10px;
    background: var(--pw-cyan);
    color: #062138;
    font-size: 14px;
    font-weight: 800;
    line-height: 1.4;
    cursor: pointer;
    transition: transform .18s ease, filter .18s ease;
  }

  .pw-button:hover {
    filter: brightness(1.06);
    transform: translateY(-1px);
  }

  .pw-button-secondary {
    border-color: #d8e2ec;
    background: #fff;
    color: var(--pw-navy);
  }

  .pw-hero .pw-button-secondary {
    border-color: rgba(255,255,255,.28);
    background: rgba(255,255,255,.1);
    color: #fff;
  }

  .pw-stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
    margin: 22px 0;
  }

  .pw-stat {
    position: relative;
    min-width: 0;
    padding: 20px;
    overflow: hidden;
    background: #fff;
    border: 1px solid var(--pw-border);
    border-radius: 15px;
    box-shadow: 0 5px 18px rgba(11,30,58,.035);
  }

  .pw-stat::before {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    width: 4px;
    background: var(--pw-cyan);
  }

  .pw-stat-label {
    display: block;
    color: var(--pw-muted);
    font-size: 13px;
    font-weight: 700;
    line-height: 1.5;
  }

  .pw-stat-value {
    display: block;
    margin-top: 9px;
    color: var(--pw-navy);
    font-size: 32px;
    font-weight: 850;
    line-height: 1.15;
    letter-spacing: -.035em;
  }

  .pw-stat-note {
    display: block;
    margin-top: 6px;
    color: #8290a2;
    font-size: 12px;
    line-height: 1.5;
  }

  .pw-panel {
    min-width: 0;
    margin-bottom: 22px;
    padding: 25px;
    background: #fff;
    border: 1px solid var(--pw-border);
    border-radius: 17px;
    box-shadow: 0 5px 18px rgba(11,30,58,.035);
  }

  .pw-section-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 20px;
  }

  .pw-section-heading h2,
  .pw-panel > h2 {
    margin: 0;
    color: var(--pw-navy);
    font-size: clamp(20px, 2.5vw, 25px);
    font-weight: 850;
    line-height: 1.3;
    letter-spacing: -.025em;
  }

  .pw-section-description {
    max-width: 720px;
    margin: 9px 0 0;
    color: var(--pw-muted);
    font-size: 14px;
    line-height: 1.75;
  }

  .pw-workflow {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 13px;
    margin-top: 22px;
  }

  .pw-step {
    display: flex;
    align-items: flex-start;
    gap: 13px;
    min-width: 0;
    padding: 17px;
    background: #f8fafc;
    border: 1px solid #e6edf4;
    border-radius: 13px;
  }

  .pw-step-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 34px;
    width: 34px;
    height: 34px;
    border-radius: 10px;
    background: #dff8fc;
    color: #075b71;
    font-size: 14px;
    font-weight: 850;
  }

  .pw-step h3 {
    margin: 1px 0 6px;
    color: var(--pw-navy);
    font-size: 14px;
    font-weight: 850;
  }

  .pw-step p {
    margin: 0;
    color: #617188;
    font-size: 13px;
    line-height: 1.7;
  }

  .pw-skill-list {
    display: grid;
    gap: 14px;
    margin-top: 20px;
  }

  .pw-skill-card {
    min-width: 0;
    padding: 20px;
    border: 1px solid #dce8f1;
    border-radius: 14px;
    background: linear-gradient(145deg, #fff, #f8fcff);
  }

  .pw-skill-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
    flex-wrap: wrap;
  }

  .pw-skill-card h3 {
    margin: 0;
    color: var(--pw-navy);
    font-size: 18px;
    line-height: 1.4;
  }

  .pw-skill-category {
    margin: 6px 0 0;
    color: var(--pw-muted);
    font-size: 13px;
  }

  .pw-verified-badge {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 11px;
    border: 1px solid #b7e8d1;
    border-radius: 100px;
    background: #eafaf2;
    color: #126943;
    font-size: 11px;
    font-weight: 850;
    line-height: 1.4;
  }

  .pw-verified-badge::before {
    content: "✓";
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 17px;
    height: 17px;
    border-radius: 50%;
    background: #c7f1dc;
    font-size: 11px;
  }

  .pw-skill-metrics {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-top: 18px;
  }

  .pw-skill-metric {
    min-width: 0;
    padding: 13px;
    background: #f1f6fa;
    border-radius: 10px;
  }

  .pw-skill-metric span {
    display: block;
    color: var(--pw-muted);
    font-size: 12px;
    font-weight: 700;
  }

  .pw-skill-metric strong {
    display: block;
    margin-top: 7px;
    color: var(--pw-navy);
    font-size: 17px;
    overflow-wrap: anywhere;
  }

  .pw-skill-details {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px;
    margin-top: 18px;
  }

  .pw-skill-details h4 {
    margin: 0 0 8px;
    color: var(--pw-navy);
    font-size: 13px;
  }

  .pw-skill-details ul {
    margin: 0;
    padding-left: 19px;
    color: #5c6e82;
    font-size: 13px;
    line-height: 1.8;
    overflow-wrap: anywhere;
  }

  .pw-course-section {
    margin-top: 30px;
  }

  .pw-course-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--pw-border);
  }

  .pw-course-header h2 {
    margin: 0;
    color: var(--pw-navy);
    font-size: clamp(21px, 3vw, 28px);
    font-weight: 850;
    line-height: 1.3;
    letter-spacing: -.025em;
    overflow-wrap: anywhere;
  }

  .pw-empty {
    padding: 38px 24px;
    text-align: center;
    background: #f8fafc;
    border: 1px dashed #cbd8e5;
    border-radius: 15px;
  }

  .pw-empty-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 54px;
    height: 54px;
    margin: 0 auto 16px;
    border-radius: 15px;
    background: #e1f8fc;
    color: #087f9c;
    font-size: 25px;
    font-weight: 850;
  }

  .pw-empty h2 {
    margin: 0 0 9px;
    color: var(--pw-navy);
    font-size: 21px;
  }

  .pw-empty p {
    max-width: 530px;
    margin: 0 auto;
    color: var(--pw-muted);
    font-size: 14px;
    line-height: 1.8;
  }

  .pw-page .muted {
    color: var(--pw-muted);
  }

  @media (max-width: 900px) {
    .pw-stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .pw-workflow {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .pw-skill-metrics {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 600px) {
    .pw-page {
      padding: 16px 12px 36px;
    }

    .pw-hero {
      padding: 23px 19px;
      border-radius: 17px;
    }

    .pw-hero h1 {
      font-size: 29px;
    }

    .pw-hero-description {
      font-size: 14px;
    }

    .pw-actions {
      width: 100%;
    }

    .pw-actions .pw-button {
      width: 100%;
    }

    .pw-stats {
      gap: 9px;
      margin: 14px 0 20px;
    }

    .pw-stat {
      padding: 15px 13px;
    }

    .pw-stat-value {
      font-size: 27px;
    }

    .pw-panel {
      padding: 18px 15px;
      border-radius: 14px;
    }

    .pw-workflow {
      grid-template-columns: 1fr;
      gap: 10px;
    }

    .pw-skill-metrics {
      gap: 9px;
    }

    .pw-skill-metric {
      padding: 11px;
    }

    .pw-skill-details {
      grid-template-columns: 1fr;
    }

    .pw-course-header {
      align-items: stretch;
    }

    .pw-course-header .pw-button {
      width: 100%;
    }

    .pw-empty {
      padding: 30px 17px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .pw-page *,
    .pw-page *::before,
    .pw-page *::after {
      scroll-behavior: auto !important;
      transition: none !important;
    }
  }
`;

export default async function PracticalWorkPage() {
  const {
    courses,
    tasks,
    submissions,
    skills,
    skillProfiles,
  } = await getPageData();

  const submissionMap = new Map<string, Submission>();

  for (const submission of submissions) {
    const existing = submissionMap.get(submission.task_id);

    // Prefer the most recently submitted record if duplicate
    // records exist for the same task.
    if (
      !existing ||
      (submission.submitted_at ?? "") >
        (existing.submitted_at ?? "")
    ) {
      submissionMap.set(submission.task_id, submission);
    }
  }

  const enrichedTasks = tasks.map((task) => ({
    ...task,
    submission: submissionMap.get(task.id) ?? null,
  }));

  const groupedTasks = courses
    .map((course) => ({
      course,
      tasks: enrichedTasks.filter(
        (task) => task.course_id === course.id,
      ),
    }))
    .filter((group) => group.tasks.length > 0);

  const totalTasks = enrichedTasks.length;

  const submittedTasks = enrichedTasks.filter((task) =>
    [
      "submitted",
      "under_review",
      "approved",
      "revision_required",
    ].includes(task.submission?.status ?? ""),
  ).length;

  const approvedTasks = enrichedTasks.filter(
    (task) => task.submission?.status === "approved",
  ).length;

  const revisionTasks = enrichedTasks.filter(
    (task) => task.submission?.status === "revision_required",
  ).length;

  const skillMap = new Map(
    skills.map((skill) => [skill.id, skill]),
  );

  const profileMap = new Map(
    skillProfiles.map((profile) => [
      profile.skill_id,
      profile,
    ]),
  );

  const verifiedSkillIds = [
    ...new Set(
      enrichedTasks
        .filter(
          (task) =>
            task.submission?.status === "approved" &&
            task.submission.evidence_recorded_at &&
            task.skill_id,
        )
        .map((task) => task.skill_id as string),
    ),
  ];

  const verifiedSkills = verifiedSkillIds
    .map((skillId) => {
      const skill = skillMap.get(skillId);
      const profile = profileMap.get(skillId);

      if (!skill || !profile) return null;

      return { skill, profile };
    })
    .filter(
      (
        item,
      ): item is {
        skill: LearningSkill;
        profile: SkillProfile;
      } => Boolean(item),
    );

  const workflowSteps = [
    {
      number: "01",
      title: "Learn",
      description:
        "Study the relevant lesson and understand the expected skill.",
    },
    {
      number: "02",
      title: "Practice",
      description:
        "Complete a realistic workplace task using the skills you have learned.",
    },
    {
      number: "03",
      title: "Submit",
      description:
        "Provide your explanation and the actual file or evidence you created.",
    },
    {
      number: "04",
      title: "Review",
      description:
        "An authorized instructor or administrator evaluates your work.",
    },
    {
      number: "05",
      title: "Improve",
      description:
        "Use reviewer feedback to correct your work and resubmit when needed.",
    },
    {
      number: "06",
      title: "Verify",
      description:
        "Approved practical performance can contribute evidence to your learning profile.",
    },
  ];

  return (
    <main className="pw-page">
      <style>{styles}</style>

      <section className="pw-hero">
        <div className="pw-hero-content">
          <p className="pw-eyebrow">
            RuffNeck Learn · Practical Workbench
          </p>

          <h1>
            Do the work. Submit evidence.
            Build verified skills.
          </h1>

          <p className="pw-hero-description">
            Complete realistic workplace tasks, submit the work you
            actually produced, receive reviewer feedback, and turn
            approved practical performance into verified skill evidence.
          </p>
        </div>

        <div className="pw-actions">
          <Link
            href="/student/courses"
            className="pw-button pw-button-secondary"
          >
            My learning →
          </Link>
        </div>
      </section>

      <section
        className="pw-stats"
        aria-label="Practical work statistics"
      >
        <article className="pw-stat">
          <span className="pw-stat-label">
            Available tasks
          </span>
          <strong className="pw-stat-value">
            {totalTasks}
          </strong>
          <span className="pw-stat-note">
            Published for your courses
          </span>
        </article>

        <article className="pw-stat">
          <span className="pw-stat-label">
            Submitted
          </span>
          <strong className="pw-stat-value">
            {submittedTasks}
          </strong>
          <span className="pw-stat-note">
            Sent for review or completed
          </span>
        </article>

        <article className="pw-stat">
          <span className="pw-stat-label">
            Approved
          </span>
          <strong className="pw-stat-value">
            {approvedTasks}
          </strong>
          <span className="pw-stat-note">
            Accepted by a reviewer
          </span>
        </article>

        <article className="pw-stat">
          <span className="pw-stat-label">
            Revision required
          </span>
          <strong className="pw-stat-value">
            {revisionTasks}
          </strong>
          <span className="pw-stat-note">
            Feedback is available
          </span>
        </article>
      </section>

      {verifiedSkills.length > 0 && (
        <section className="pw-panel">
          <div className="pw-section-heading">
            <div>
              <p className="pw-eyebrow">
                Learning Intelligence
              </p>

              <h2>
                Verified skills from practical work
              </h2>

              <p className="pw-section-description">
                These skills have practical evidence approved by
                an authorized reviewer.
              </p>
            </div>

            <Link
              href="/student/assessment/results"
              className="pw-button pw-button-secondary"
            >
              Assessment results
            </Link>
          </div>

          <div className="pw-skill-list">
            {verifiedSkills.map(({ skill, profile }) => (
              <article
                key={skill.id}
                className="pw-skill-card"
              >
                <div className="pw-skill-top">
                  <div>
                    <h3>{skill.name}</h3>

                    {skill.category && (
                      <p className="pw-skill-category">
                        {skill.category}
                      </p>
                    )}

                    {skill.description && (
                      <p className="pw-section-description">
                        {skill.description}
                      </p>
                    )}
                  </div>

                  <span className="pw-verified-badge">
                    Verified practical evidence
                  </span>
                </div>

                <div className="pw-skill-metrics">
                  <div className="pw-skill-metric">
                    <span>Skill level</span>
                    <strong>
                      {formatSkillLevel(profile.skill_level)}
                    </strong>
                  </div>

                  <div className="pw-skill-metric">
                    <span>Confidence</span>
                    <strong>
                      {formatConfidence(profile.confidence_score)}
                    </strong>
                  </div>

                  <div className="pw-skill-metric">
                    <span>Evidence count</span>
                    <strong>
                      {profile.evidence_count ?? 0}
                    </strong>
                  </div>

                  <div className="pw-skill-metric">
                    <span>Skill score</span>
                    <strong>
                      {profile.score ?? "—"}
                    </strong>
                  </div>
                </div>

                {(Boolean(profile.evidence?.length) ||
                  Boolean(profile.strengths?.length)) && (
                  <div className="pw-skill-details">
                    {Boolean(profile.evidence?.length) && (
                      <div>
                        <h4>Evidence</h4>
                        <ul>
                          {profile.evidence!.slice(-3).map(
                            (item, index) => (
                              <li
                                key={`${skill.id}-evidence-${index}`}
                              >
                                {item}
                              </li>
                            ),
                          )}
                        </ul>
                      </div>
                    )}

                    {Boolean(profile.strengths?.length) && (
                      <div>
                        <h4>Strengths</h4>
                        <ul>
                          {profile.strengths!.slice(-3).map(
                            (item, index) => (
                              <li
                                key={`${skill.id}-strength-${index}`}
                              >
                                {item}
                              </li>
                            ),
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="pw-panel">
        <p className="pw-eyebrow">
          Your progress
        </p>

        <h2>
          How the Workbench works
        </h2>

        <p className="pw-section-description">
          Turn what you learn into practical evidence of what
          you can do.
        </p>

        <div className="pw-workflow">
          {workflowSteps.map((step) => (
            <article
              className="pw-step"
              key={step.number}
            >
              <span className="pw-step-number">
                {step.number}
              </span>

              <div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {groupedTasks.length === 0 ? (
        <section className="pw-panel">
          <div className="pw-empty">
            <div className="pw-empty-icon" aria-hidden="true">
              ✓
            </div>

            <h2>
              No practical work available
            </h2>

            <p>
              Practical tasks will appear here when they are
              published for your enrolled courses. Continue
              learning while new tasks become available.
            </p>

            <div
              className="pw-actions"
              style={{
                justifyContent: "center",
                marginTop: "20px",
              }}
            >
              <Link
                href="/student/courses"
                className="pw-button"
              >
                Explore my learning
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <div>
          {groupedTasks.map(({ course, tasks: courseTasks }) => (
            <section
              key={course.id}
              className="pw-course-section"
            >
              <div className="pw-course-header">
                <div>
                  <p className="pw-eyebrow">
                    Practical tasks
                  </p>

                  <h2>{course.title}</h2>
                </div>

                <Link
                  href={`/courses/${course.slug}`}
                  className="pw-button pw-button-secondary"
                >
                  View course →
                </Link>
              </div>

              <PracticalWorkClient tasks={courseTasks} />
            </section>
          ))}
        </div>
      )}
    </main>
  );
}