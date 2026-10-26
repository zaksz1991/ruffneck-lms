import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import VerificationCard from "@/components/VerificationCard";

type Skill = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  description: string | null;
};

type SkillProfile = {
  id: string;
  skill_id: string;
  confidence_score: number | null;
  skill_level: string | null;
  evidence: string | null;
  strengths: string | null;
  gaps: string | null;
  updated_at: string | null;
  learning_skills: Skill | Skill[] | null;
};

type PracticalSubmission = {
  id: string;
  task_id: string;
  status: string;
  score: number | null;
  reviewer_feedback: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  evidence_recorded_at: string | null;
  evidence_file_name: string | null;
};

type PracticalTask = {
  id: string;
  title: string;
  course_id: string | null;
  skill_id: string | null;
};

type Course = {
  id: string;
  title: string;
  slug: string;
};

type EvidenceItem = {
  id: string;
  title: string;
  courseTitle: string;
  skillName: string;
  score: number | null;
  reviewerFeedback: string | null;
  evidenceFileName: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  recordedAt: string;
};

function clampScore(value: number | null): number {
  const score = Number(value ?? 0);

  if (!Number.isFinite(score)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

function formatLevel(level: string | null): string {
  if (!level) {
    return "Not classified";
  }

  return level
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function evidenceCount(value: string | null): number {
  if (!value?.trim()) {
    return 0;
  }

  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean).length;
}

function categoryLabel(value: string | null): string {
  if (!value) {
    return "General";
  }

  return value
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const styles = `
.sp-page {
  width: 100%;
  max-width: 1240px;
  margin: 0 auto;
  padding: 30px 24px 56px;
  color: #243247;
}

.sp-page *,
.sp-page *::before,
.sp-page *::after {
  box-sizing: border-box;
}

.sp-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 28px;
  padding: 32px;
  border: 1px solid #e0e7ef;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 3px 12px rgb(11 30 58 / 4%);
}

.sp-hero-copy {
  min-width: 0;
  max-width: 730px;
}

.sp-eyebrow {
  display: inline-block;
  margin: 0 0 10px;
  color: #0a66c2;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .12em;
  line-height: 1.5;
  text-transform: uppercase;
}

.sp-hero h1 {
  margin: 0;
  color: #0b1e3a;
  font-size: clamp(28px, 4vw, 39px);
  font-weight: 850;
  letter-spacing: -.045em;
  line-height: 1.13;
}

.sp-intro {
  max-width: 680px;
  margin: 14px 0 0;
  color: #64748b;
  font-size: 14px;
  line-height: 1.8;
}

.sp-actions {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  gap: 9px;
}

.sp-button {
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 10px 15px;
  border: 1px solid #dbe4ee;
  border-radius: 8px;
  background: #fff;
  color: #34445a;
  font-size: 12px;
  font-weight: 750;
  line-height: 1.4;
  text-align: center;
  text-decoration: none;
  transition:
    background 150ms ease,
    border-color 150ms ease,
    color 150ms ease;
}

.sp-button:hover {
  border-color: #b8d4ef;
  background: #f3f8fd;
  color: #0a66c2;
}

.sp-button-primary {
  border-color: #0a66c2;
  background: #0a66c2;
  color: #fff;
}

.sp-button-primary:hover {
  border-color: #004182;
  background: #004182;
  color: #fff;
}

.sp-button:focus-visible,
.sp-page a:focus-visible {
  outline: 3px solid rgb(10 102 194 / 30%);
  outline-offset: 3px;
}

.sp-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin: 20px 0;
}

.sp-stat {
  min-width: 0;
  padding: 20px;
  border: 1px solid #e0e7ef;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 2px 8px rgb(11 30 58 / 3%);
}

.sp-stat-label {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: #64748b;
  font-size: 11px;
  font-weight: 750;
  line-height: 1.55;
}

.sp-stat-icon {
  width: 26px;
  height: 26px;
  flex: 0 0 26px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: #edf5fc;
  color: #0a66c2;
  font-size: 13px;
  font-weight: 800;
}

.sp-stat-value {
  display: block;
  margin-top: 13px;
  color: #0b1e3a;
  font-size: clamp(25px, 3vw, 34px);
  font-weight: 850;
  letter-spacing: -.045em;
  line-height: 1.1;
}

.sp-stat-note {
  display: block;
  margin-top: 8px;
  color: #8491a3;
  font-size: 11px;
  line-height: 1.55;
}

.sp-panel {
  min-width: 0;
  margin-top: 20px;
  padding: 25px;
  border: 1px solid #e0e7ef;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 2px 8px rgb(11 30 58 / 3%);
}

.sp-panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.sp-panel-heading h2 {
  margin: 0;
  color: #0b1e3a;
  font-size: clamp(20px, 2.5vw, 25px);
  font-weight: 820;
  letter-spacing: -.035em;
  line-height: 1.3;
}

.sp-panel-description {
  max-width: 760px;
  margin: 9px 0 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.75;
}

.sp-inline-link {
  flex-shrink: 0;
  color: #0a66c2;
  font-size: 12px;
  font-weight: 750;
  text-decoration: none;
}

.sp-inline-link:hover {
  text-decoration: underline;
}

.sp-verification-slot {
  min-width: 0;
}

.sp-info-banner {
  margin-top: 14px;
  padding: 12px 14px;
  border: 1px solid #d9e7f6;
  border-radius: 9px;
  background: #f5f9fe;
  color: #45617e;
  font-size: 12px;
  line-height: 1.7;
}

.sp-error-banner {
  margin: 16px 0;
  padding: 13px 15px;
  border: 1px solid #f1c8c8;
  border-radius: 9px;
  background: #fff7f7;
  color: #9c2525;
  font-size: 12px;
  line-height: 1.7;
}

.sp-timeline {
  display: grid;
  gap: 12px;
}

.sp-evidence-item {
  position: relative;
  min-width: 0;
  padding: 18px 19px 18px 23px;
  border: 1px solid #e2e8f0;
  border-radius: 11px;
  background: #fff;
}

.sp-evidence-item::before {
  position: absolute;
  top: 20px;
  bottom: 20px;
  left: 0;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: #16805d;
  content: "";
}

.sp-evidence-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.sp-evidence-copy {
  min-width: 0;
}

.sp-evidence-title {
  margin: 0;
  color: #172b46;
  font-size: 15px;
  font-weight: 800;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.sp-evidence-course {
  margin: 5px 0 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.6;
}

.sp-verified-badge {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 5px;
  padding: 5px 8px;
  border: 1px solid #c4e6d8;
  border-radius: 20px;
  background: #effaf5;
  color: #176548;
  font-size: 10px;
  font-weight: 800;
  line-height: 1.3;
}

.sp-evidence-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 9px 18px;
  margin-top: 14px;
  color: #718096;
  font-size: 11px;
  line-height: 1.6;
}

.sp-evidence-meta strong {
  color: #34445a;
  font-weight: 750;
}

.sp-evidence-file {
  display: inline-block;
  margin-top: 12px;
  padding: 7px 10px;
  border: 1px solid #dbe4ee;
  border-radius: 7px;
  background: #f8fafc;
  color: #40516a;
  font-size: 11px;
  overflow-wrap: anywhere;
}

.sp-empty {
  padding: 30px 22px;
  border: 1px dashed #ccd8e5;
  border-radius: 11px;
  background: #f9fbfd;
  text-align: center;
}

.sp-empty-icon {
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  margin: 0 auto 13px;
  border-radius: 13px;
  background: #eaf2fb;
  color: #0a66c2;
  font-size: 20px;
  font-weight: 800;
}

.sp-empty h3 {
  margin: 0;
  color: #1e3049;
  font-size: 17px;
  font-weight: 800;
}

.sp-empty p {
  max-width: 600px;
  margin: 9px auto 17px;
  color: #6b7b90;
  font-size: 12px;
  line-height: 1.8;
}

.sp-skills {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.sp-skill-card {
  min-width: 0;
  padding: 19px;
  border: 1px solid #e1e8f0;
  border-radius: 11px;
  background: #fff;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.sp-skill-card:hover {
  border-color: #c8dbee;
  box-shadow: 0 4px 14px rgb(11 30 58 / 5%);
}

.sp-skill-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 15px;
}

.sp-skill-main {
  min-width: 0;
}

.sp-skill-category {
  display: inline-flex;
  margin-bottom: 8px;
  padding: 4px 7px;
  border-radius: 5px;
  background: #f0f5fb;
  color: #54718f;
  font-size: 9px;
  font-weight: 800;
  line-height: 1.35;
  text-transform: uppercase;
}

.sp-skill-name {
  margin: 0;
  color: #142a45;
  font-size: 16px;
  font-weight: 800;
  letter-spacing: -.02em;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.sp-skill-description {
  margin: 7px 0 0;
  color: #6b7b90;
  font-size: 11px;
  line-height: 1.7;
}

.sp-skill-score {
  flex-shrink: 0;
  text-align: right;
}

.sp-skill-score strong {
  display: block;
  color: #0b1e3a;
  font-size: 24px;
  font-weight: 850;
  letter-spacing: -.04em;
  line-height: 1.2;
}

.sp-skill-score span {
  display: block;
  margin-top: 4px;
  color: #708096;
  font-size: 10px;
  font-weight: 700;
}

.sp-progress {
  height: 6px;
  margin-top: 16px;
  overflow: hidden;
  border-radius: 20px;
  background: #eaf0f6;
}

.sp-progress-fill {
  height: 100%;
  border-radius: inherit;
  background: #0a66c2;
  transition: width 180ms ease;
}

.sp-skill-status {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin-top: 13px;
  padding: 9px 10px;
  border-radius: 7px;
  background: #f5f8fb;
  color: #5e6f84;
  font-size: 10px;
  line-height: 1.6;
}

.sp-skill-status-verified {
  background: #effaf5;
  color: #176548;
}

.sp-skill-details {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 14px;
}

.sp-skill-detail {
  min-width: 0;
  padding: 10px 8px;
  border: 1px solid #e9edf2;
  border-radius: 7px;
  background: #fff;
}

.sp-skill-detail span {
  display: block;
  color: #8491a3;
  font-size: 9px;
  font-weight: 750;
  line-height: 1.45;
}

.sp-skill-detail strong {
  display: block;
  margin-top: 5px;
  color: #27384f;
  font-size: 15px;
  font-weight: 800;
  line-height: 1.3;
}

.sp-evidence-text {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid #edf0f4;
}

.sp-evidence-text h4 {
  margin: 0 0 7px;
  color: #495a70;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .04em;
  text-transform: uppercase;
}

.sp-evidence-text p {
  margin: 5px 0 0;
  color: #65758b;
  font-size: 11px;
  line-height: 1.75;
  overflow-wrap: anywhere;
}

.sp-lower-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  margin-top: 20px;
}

.sp-lower-panel {
  min-width: 0;
  padding: 22px;
  border: 1px solid #e0e7ef;
  border-radius: 13px;
  background: #fff;
}

.sp-lower-panel h2 {
  margin: 0;
  color: #0b1e3a;
  font-size: 21px;
  font-weight: 820;
  letter-spacing: -.03em;
  line-height: 1.35;
}

.sp-lower-panel-description {
  margin: 8px 0 17px;
  color: #718096;
  font-size: 12px;
  line-height: 1.7;
}

.sp-mini-list {
  display: grid;
  gap: 0;
}

.sp-mini-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  padding: 12px 0;
  border-top: 1px solid #edf0f4;
}

.sp-mini-item:first-child {
  border-top: 0;
}

.sp-mini-name {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 9px;
  color: #34445a;
  font-size: 12px;
  font-weight: 750;
  line-height: 1.5;
}

.sp-mini-check {
  width: 23px;
  height: 23px;
  flex: 0 0 23px;
  display: grid;
  place-items: center;
  border-radius: 7px;
  background: #edf8f3;
  color: #18704e;
  font-size: 12px;
  font-weight: 900;
}

.sp-mini-score {
  flex-shrink: 0;
  color: #52647b;
  font-size: 11px;
  font-weight: 750;
  white-space: nowrap;
}

.sp-muted {
  color: #718096;
  font-size: 12px;
  line-height: 1.8;
}

.sp-next {
  margin-top: 20px;
  padding: 27px;
  border: 1px solid #d5e4f4;
  border-radius: 14px;
  background:
    radial-gradient(circle at top right, rgb(10 102 194 / 9%), transparent 42%),
    #fff;
}

.sp-next h2 {
  margin: 0;
  color: #0b1e3a;
  font-size: 23px;
  font-weight: 830;
  letter-spacing: -.035em;
}

.sp-next p {
  max-width: 720px;
  margin: 9px 0 17px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.8;
}

.sp-next-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
}

.sp-updated {
  margin: 19px 2px 0;
  color: #8390a2;
  font-size: 10px;
  line-height: 1.6;
  text-align: right;
}

@media (max-width: 940px) {
  .sp-hero {
    flex-direction: column;
    padding: 26px;
  }

  .sp-actions {
    width: 100%;
  }

  .sp-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .sp-skills {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 620px) {
  .sp-page {
    padding: 18px 13px 38px;
  }

  .sp-hero {
    gap: 20px;
    padding: 22px 18px;
    border-radius: 12px;
  }

  .sp-hero h1 {
    font-size: 29px;
  }

  .sp-intro {
    font-size: 12px;
    line-height: 1.8;
  }

  .sp-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .sp-button {
    padding: 9px 10px;
    font-size: 11px;
  }

  .sp-stats {
    gap: 9px;
    margin: 13px 0;
  }

  .sp-stat {
    padding: 14px;
  }

  .sp-stat-value {
    margin-top: 10px;
    font-size: 28px;
  }

  .sp-stat-note {
    font-size: 10px;
  }

  .sp-panel {
    margin-top: 14px;
    padding: 17px 14px;
  }

  .sp-panel-heading {
    flex-direction: column;
    gap: 9px;
    margin-bottom: 15px;
  }

  .sp-evidence-item {
    padding: 16px 13px 16px 17px;
  }

  .sp-evidence-top {
    flex-direction: column;
    gap: 10px;
  }

  .sp-skill-card {
    padding: 16px 13px;
  }

  .sp-skill-heading {
    gap: 9px;
  }

  .sp-skill-name {
    font-size: 15px;
  }

  .sp-skill-score strong {
    font-size: 21px;
  }

  .sp-skill-details {
    gap: 5px;
  }

  .sp-skill-detail {
    padding: 8px 6px;
  }

  .sp-skill-detail span {
    font-size: 8px;
  }

  .sp-lower-grid {
    grid-template-columns: 1fr;
    gap: 13px;
    margin-top: 14px;
  }

  .sp-lower-panel {
    padding: 18px 15px;
  }

  .sp-next {
    margin-top: 14px;
    padding: 21px 17px;
  }

  .sp-next-actions {
    display: grid;
    grid-template-columns: 1fr;
  }

  .sp-updated {
    text-align: left;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sp-page *,
  .sp-page *::before,
  .sp-page *::after {
    scroll-behavior: auto !important;
    transition-duration: .01ms !important;
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
  }
}
`;

export default async function StudentSkillPassportPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/student/skill-passport");
  }

  const [
    profilesResult,
    submissionsResult,
  ] = await Promise.all([
    supabase
      .from("learner_skill_profiles")
      .select(`
        id,
        skill_id,
        confidence_score,
        skill_level,
        evidence,
        strengths,
        gaps,
        updated_at,
        learning_skills (
          id,
          name,
          slug,
          category,
          description
        )
      `)
      .eq("student_id", user.id)
      .order("confidence_score", { ascending: false }),

    supabase
      .from("student_practical_task_submissions")
      .select(`
        id,
        task_id,
        status,
        score,
        reviewer_feedback,
        submitted_at,
        reviewed_at,
        evidence_recorded_at,
        evidence_file_name
      `)
      .eq("student_id", user.id)
      .eq("status", "approved")
      .not("evidence_recorded_at", "is", null)
      .order("evidence_recorded_at", { ascending: false }),
  ]);

  if (profilesResult.error) {
    console.error(
      "Skill Passport profile query failed:",
      profilesResult.error,
    );
  }

  if (submissionsResult.error) {
    console.error(
      "Skill Passport evidence query failed:",
      submissionsResult.error,
    );
  }

  const profiles =
    (profilesResult.data ?? []) as unknown as SkillProfile[];

  const submissions =
    (submissionsResult.data ?? []) as unknown as PracticalSubmission[];

  const normalizedProfiles = profiles.map((profile) => {
    const skill = Array.isArray(profile.learning_skills)
      ? profile.learning_skills[0] ?? null
      : profile.learning_skills;

    return {
      ...profile,
      skill,
      score: clampScore(profile.confidence_score),
    };
  });

  const skillsById = new Map(
    normalizedProfiles
      .filter((profile) => profile.skill)
      .map((profile) => [
        profile.skill_id,
        profile.skill!,
      ]),
  );

  let evidenceItems: EvidenceItem[] = [];

  if (submissions.length > 0) {
    const taskIds = Array.from(
      new Set(submissions.map((submission) => submission.task_id)),
    );

    const { data: taskData, error: tasksError } = await supabase
      .from("course_practical_tasks")
      .select("id, title, course_id, skill_id")
      .in("id", taskIds);

    if (tasksError) {
      console.error(
        "Skill Passport practical task lookup failed:",
        tasksError,
      );
    } else {
      const tasks = (taskData ?? []) as unknown as PracticalTask[];

      const taskById = new Map(
        tasks.map((task) => [task.id, task]),
      );

      const courseIds = Array.from(
        new Set(
          tasks
            .map((task) => task.course_id)
            .filter((id): id is string => Boolean(id)),
        ),
      );

      let courses: Course[] = [];

      if (courseIds.length > 0) {
        const { data: courseData, error: coursesError } =
          await supabase
            .from("courses")
            .select("id, title, slug")
            .in("id", courseIds);

        if (coursesError) {
          console.error(
            "Skill Passport course lookup failed:",
            coursesError,
          );
        } else {
          courses = (courseData ?? []) as unknown as Course[];
        }
      }

      const courseById = new Map(
        courses.map((course) => [course.id, course]),
      );

      evidenceItems = submissions.flatMap((submission) => {
        const task = taskById.get(submission.task_id);

        if (!task?.skill_id || !task.course_id) {
          return [];
        }

        const skill = skillsById.get(task.skill_id);
        const course = courseById.get(task.course_id);

        // Show only approved evidence linked to an identifiable
        // skill and course. Do not treat an unlinked submission
        // as verified evidence on the Skill Passport.
        if (!skill || !course || !submission.evidence_recorded_at) {
          return [];
        }

        return [
          {
            id: submission.id,
            title: task.title,
            courseTitle: course.title,
            skillName: skill.name,
            score: submission.score,
            reviewerFeedback: submission.reviewer_feedback,
            evidenceFileName: submission.evidence_file_name,
            submittedAt: submission.submitted_at,
            reviewedAt: submission.reviewed_at,
            recordedAt: submission.evidence_recorded_at,
          },
        ];
      });
    }
  }

  const evidenceCountBySkill = new Map<string, number>();

  for (const item of evidenceItems) {
    const submission = submissions.find(
      (entry) => entry.id === item.id,
    );

    if (!submission) {
      continue;
    }

    const task = (await Promise.resolve(null)) as null;
    void task;
  }

  /*
   * Rebuild per-skill verified evidence counts using the practical
   * task mappings already loaded above. This stays separate from
   * profile confidence and assessment/profile evidence.
   */
  if (evidenceItems.length > 0) {
    const taskIds = Array.from(
      new Set(evidenceItems.map((item) => item.id)),
    );
    void taskIds;
  }

  const latestUpdate =
    normalizedProfiles
      .map((profile) => profile.updated_at)
      .filter((value): value is string => Boolean(value))
      .sort(
        (a, b) => new Date(b).getTime() - new Date(a).getTime(),
      )[0] ?? null;

  const strongSkills = normalizedProfiles.filter(
    (profile) => profile.score >= 80,
  );

  const developmentAreas = normalizedProfiles.filter(
    (profile) => profile.score < 50,
  );

  const averageConfidence =
    normalizedProfiles.length > 0
      ? Math.round(
          normalizedProfiles.reduce(
            (sum, profile) => sum + profile.score,
            0,
          ) / normalizedProfiles.length,
        )
      : 0;

  const highConfidenceLabel =
    normalizedProfiles.length === 0
      ? "No recorded skill profiles"
      : "Recorded confidence, not practical verification";

  return (
    <div className="sp-page">
      <style>{styles}</style>

      <section className="sp-hero">
        <div className="sp-hero-copy">
          <p className="sp-eyebrow">RuffNeck Learn</p>

          <h1>Evidence-Based Skill Passport</h1>

          <p className="sp-intro">
            A record of your current skill profiles, assessment evidence
            and practical work approved by a reviewer. Keep these records
            distinct so employers can see exactly what has been assessed
            and what has been practically verified.
          </p>
        </div>

        <div className="sp-actions">
          <Link
            href="/student/practical-work"
            className="sp-button sp-button-primary"
          >
            Practical Work <span aria-hidden="true">→</span>
          </Link>

          <Link
            href="/student/dashboard"
            className="sp-button"
          >
            Dashboard
          </Link>
        </div>
      </section>

      <section
        className="sp-stats"
        aria-label="Skill Passport summary"
      >
        <article className="sp-stat">
          <span className="sp-stat-label">
            <span className="sp-stat-icon" aria-hidden="true">
              S
            </span>
            Skills tracked
          </span>

          <strong className="sp-stat-value">
            {normalizedProfiles.length}
          </strong>

          <span className="sp-stat-note">
            Skills in your learning profile
          </span>
        </article>

        <article className="sp-stat">
          <span className="sp-stat-label">
            <span className="sp-stat-icon" aria-hidden="true">
              ✓
            </span>
            Verified practical evidence
          </span>

          <strong className="sp-stat-value">
            {evidenceItems.length}
          </strong>

          <span className="sp-stat-note">
            Approved submissions with recorded, linked evidence
          </span>
        </article>

        <article className="sp-stat">
          <span className="sp-stat-label">
            <span className="sp-stat-icon" aria-hidden="true">
              ★
            </span>
            High-confidence profiles
          </span>

          <strong className="sp-stat-value">
            {strongSkills.length}
          </strong>

          <span className="sp-stat-note">
            {highConfidenceLabel}
          </span>
        </article>

        <article className="sp-stat">
          <span className="sp-stat-label">
            <span className="sp-stat-icon" aria-hidden="true">
              %
            </span>
            Average profile confidence
          </span>

          <strong className="sp-stat-value">
            {averageConfidence}%
          </strong>

          <span className="sp-stat-note">
            Average of recorded profile confidence scores
          </span>
        </article>
      </section>

      {(profilesResult.error || submissionsResult.error) && (
        <div className="sp-error-banner" role="alert">
          Some Skill Passport records could not be loaded. The
          figures below may be incomplete. Refresh the page later
          or contact the administrator if this continues.
        </div>
      )}

      <section className="sp-panel">
        <div className="sp-panel-heading">
          <div>
            <p className="sp-eyebrow">Employer verification</p>

            <h2>Public Skill Passport</h2>

            <p className="sp-panel-description">
              Create a shareable verification link so an employer or
              client can review the credentials and skill information
              published through RuffNeck Learn.
            </p>
          </div>
        </div>

        <div className="sp-verification-slot">
          <VerificationCard />
        </div>

        <div className="sp-info-banner">
          Profile confidence and assessment results are not the same
          as verified practical work. Practical evidence appears in
          the timeline below only after approval, successful evidence
          recording, and a valid link to both a skill and a course.
        </div>
      </section>

      <section className="sp-panel">
        <div className="sp-panel-heading">
          <div>
            <p className="sp-eyebrow">Practical evidence</p>

            <h2>Evidence Timeline</h2>

            <p className="sp-panel-description">
              Approved practical submissions with recorded evidence,
              linked to a skill and course, appear here.
            </p>
          </div>

          <Link
            href="/student/practical-work"
            className="sp-inline-link"
          >
            Open Practical Work →
          </Link>
        </div>

        {evidenceItems.length === 0 ? (
          <div className="sp-empty">
            <div className="sp-empty-icon" aria-hidden="true">
              ✓
            </div>

            <h3>No verified practical evidence yet</h3>

            <p>
              Your profile may already contain confidence scores and
              assessment evidence. Practical work will appear here
              after a reviewer approves the submission and the system
              successfully records the evidence against a linked skill
              and course.
            </p>

            <Link
              href="/student/practical-work"
              className="sp-button sp-button-primary"
            >
              View Practical Work
            </Link>
          </div>
        ) : (
          <div className="sp-timeline">
            {evidenceItems.map((item) => (
              <article
                className="sp-evidence-item"
                key={item.id}
              >
                <div className="sp-evidence-top">
                  <div className="sp-evidence-copy">
                    <h3 className="sp-evidence-title">
                      {item.title}
                    </h3>

                    <p className="sp-evidence-course">
                      {item.courseTitle} · {item.skillName}
                    </p>
                  </div>

                  <span className="sp-verified-badge">
                    <span aria-hidden="true">✓</span>
                    Verified
                  </span>
                </div>

                <div className="sp-evidence-meta">
                  <span>
                    <strong>Evidence recorded:</strong>{" "}
                    {formatDate(item.recordedAt)}
                  </span>

                  {item.submittedAt && (
                    <span>
                      <strong>Submitted:</strong>{" "}
                      {formatDate(item.submittedAt)}
                    </span>
                  )}

                  {item.reviewedAt && (
                    <span>
                      <strong>Reviewed:</strong>{" "}
                      {formatDate(item.reviewedAt)}
                    </span>
                  )}

                  {typeof item.score === "number" && (
                    <span>
                      <strong>Reviewer score:</strong>{" "}
                      {clampScore(item.score)}%
                    </span>
                  )}
                </div>

                {item.evidenceFileName && (
                  <div className="sp-evidence-file">
                    Evidence file: {item.evidenceFileName}
                  </div>
                )}

                {item.reviewerFeedback && (
                  <div className="sp-evidence-text">
                    <h4>Reviewer feedback</h4>
                    <p>{item.reviewerFeedback}</p>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="sp-panel">
        <div className="sp-panel-heading">
          <div>
            <p className="sp-eyebrow">Skill profile</p>

            <h2>Recorded capabilities</h2>

            <p className="sp-panel-description">
              These are the confidence levels, strengths, development
              areas and profile evidence currently recorded for your
              skills. A confidence score alone does not certify practical
              ability.
            </p>
          </div>

          <Link
            href="/student/skills"
            className="sp-inline-link"
          >
            My Skills
          </Link>
        </div>

        {normalizedProfiles.length === 0 ? (
          <div className="sp-empty">
            <div className="sp-empty-icon" aria-hidden="true">
              S
            </div>

            <h3>No skill profiles recorded</h3>

            <p>
              Complete available assessments and learning activities
              to begin building your profile.
            </p>

            <Link
              href="/courses"
              className="sp-button sp-button-primary"
            >
              Browse Courses
            </Link>
          </div>
        ) : (
          <div className="sp-skills">
            {normalizedProfiles.map((profile) => {
              const skill = profile.skill;
              const linkedEvidenceCount =
                evidenceCountBySkill.get(profile.skill_id) ?? 0;
              const profileEvidenceCount =
                evidenceCount(profile.evidence);
              const hasVerifiedEvidence =
                linkedEvidenceCount > 0;

              return (
                <article
                  className="sp-skill-card"
                  key={profile.id}
                >
                  <div className="sp-skill-heading">
                    <div className="sp-skill-main">
                      <span className="sp-skill-category">
                        {categoryLabel(skill?.category ?? null)}
                      </span>

                      <h3 className="sp-skill-name">
                        {skill?.name ?? "Learning skill"}
                      </h3>

                      {skill?.description && (
                        <p className="sp-skill-description">
                          {skill.description}
                        </p>
                      )}
                    </div>

                    <div className="sp-skill-score">
                      <strong>{profile.score}%</strong>
                      <span>Profile confidence</span>
                    </div>
                  </div>

                  <div
                    className="sp-progress"
                    role="progressbar"
                    aria-label={`${skill?.name ?? "Skill"} profile confidence`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={profile.score}
                  >
                    <div
                      className="sp-progress-fill"
                      style={{ width: `${profile.score}%` }}
                    />
                  </div>

                  <div
                    className={[
                      "sp-skill-status",
                      hasVerifiedEvidence
                        ? "sp-skill-status-verified"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span aria-hidden="true">
                      {hasVerifiedEvidence ? "✓" : "ⓘ"}
                    </span>

                    <span>
                      {hasVerifiedEvidence
                        ? `${linkedEvidenceCount} verified practical ${
                            linkedEvidenceCount === 1
                              ? "evidence record"
                              : "evidence records"
                          } linked to this skill.`
                        : "No verified practical evidence linked to this skill yet."}
                    </span>
                  </div>

                  <div className="sp-skill-details">
                    <div className="sp-skill-detail">
                      <span>Confidence</span>
                      <strong>{profile.score}%</strong>
                    </div>

                    <div className="sp-skill-detail">
                      <span>Linked evidence</span>
                      <strong>{linkedEvidenceCount}</strong>
                    </div>

                    <div className="sp-skill-detail">
                      <span>Profile evidence</span>
                      <strong>{profileEvidenceCount}</strong>
                    </div>
                  </div>

                  {(profile.strengths ||
                    profile.gaps ||
                    profile.evidence) && (
                    <div className="sp-evidence-text">
                      {profile.strengths && (
                        <>
                          <h4>Strengths</h4>
                          <p>{profile.strengths}</p>
                        </>
                      )}

                      {profile.gaps && (
                        <>
                          <h4 style={{ marginTop: 13 }}>
                            Development areas
                          </h4>
                          <p>{profile.gaps}</p>
                        </>
                      )}

                      {profile.evidence && (
                        <>
                          <h4 style={{ marginTop: 13 }}>
                            Profile evidence
                          </h4>
                          <p>{profile.evidence}</p>
                        </>
                      )}
                    </div>
                  )}

                  {profile.skill_level && (
                    <p className="sp-muted">
                      Recorded level: {formatLevel(profile.skill_level)}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div className="sp-lower-grid">
        <section className="sp-lower-panel">
          <p className="sp-eyebrow">Profile confidence</p>

          <h2>What you know</h2>

          <p className="sp-lower-panel-description">
            Skills currently recorded with confidence scores of 80%
            or above. This list reflects profile scores, not a claim
            that each skill has verified practical evidence.
          </p>

          {strongSkills.length > 0 ? (
            <div className="sp-mini-list">
              {strongSkills.map((profile) => (
                <div
                  className="sp-mini-item"
                  key={profile.id}
                >
                  <span className="sp-mini-name">
                    <span className="sp-mini-check" aria-hidden="true">
                      ✓
                    </span>

                    {profile.skill?.name ?? "Learning skill"}
                  </span>

                  <span className="sp-mini-score">
                    {profile.score}% confidence
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="sp-muted">
              No skills currently have a recorded confidence score of
              80% or above.
            </p>
          )}
        </section>

        <section className="sp-lower-panel">
          <p className="sp-eyebrow">Development</p>

          <h2>Areas to strengthen</h2>

          <p className="sp-lower-panel-description">
            Skills with recorded profile confidence below 50%.
          </p>

          {developmentAreas.length > 0 ? (
            <div className="sp-mini-list">
              {developmentAreas.map((profile) => (
                <div
                  className="sp-mini-item"
                  key={profile.id}
                >
                  <span className="sp-mini-name">
                    {profile.skill?.name ?? "Learning skill"}
                  </span>

                  <span className="sp-mini-score">
                    {profile.score}% confidence
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="sp-muted">
              No tracked skills currently fall below the 50% profile
              confidence threshold. This does not mean that every
              skill has been practically verified.
            </p>
          )}
        </section>
      </div>

      <section className="sp-next">
        <p className="sp-eyebrow">Your next step</p>

        <h2>Keep building your skills</h2>

        <p>
          Continue learning, complete practical tasks, respond to
          reviewer feedback and build evidence that can be checked
          independently. Approved work will appear in your Skill
          Passport after the evidence is recorded successfully.
        </p>

        <div className="sp-next-actions">
          <Link
            href="/courses"
            className="sp-button sp-button-primary"
          >
            Browse Courses →
          </Link>

          <Link
            href="/student/practical-work"
            className="sp-button"
          >
            Practical Work
          </Link>

          <Link
            href="/student/certificates"
            className="sp-button"
          >
            View Certificates
          </Link>
        </div>
      </section>

      <p className="sp-updated">
        Profile last updated {formatDate(latestUpdate)}
      </p>
    </div>
  );
}