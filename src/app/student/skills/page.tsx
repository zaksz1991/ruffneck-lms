import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

function clampScore(value: number | null) {
  const number = Number(value ?? 0);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.min(100, Math.max(0, number));
}

function formatLevel(level: string | null) {
  if (!level) {
    return "Beginner";
  }

  return level.charAt(0).toUpperCase() + level.slice(1);
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
  }).format(date);
}

function getLevelDescription(score: number) {
  if (score >= 80) {
    return "Strong demonstrated performance";
  }

  if (score >= 50) {
    return "Developing capability";
  }

  return "An opportunity to improve";
}

function getSkillInitial(name: string | undefined) {
  return name?.trim().charAt(0).toUpperCase() || "S";
}

const profileStyles = `
  .rn-profile-social,
  .rn-profile-social * {
    box-sizing: border-box;
  }

  .rn-profile-social {
    --profile-blue: #0a66c2;
    --profile-blue-dark: #004182;
    --profile-text: #191919;
    --profile-muted: #666a70;
    --profile-border: #dfe3e8;
    --profile-green: #16834a;

    width: 100%;
    min-height: 75vh;
    padding: 28px 22px 38px;
    background: #f3f5f8;
    color: var(--profile-text);
    font-family: Arial, Helvetica, sans-serif;
  }

  .rn-profile-social .rn-profile-shell {
    width: 100%;
    max-width: 1180px;
    margin: 0 auto;
  }

  /* Page heading */

  .rn-profile-social .rn-profile-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 22px;
    padding: 27px 28px;
    margin-bottom: 20px;
    border: 1px solid var(--profile-border);
    border-radius: 12px;
    background: #ffffff;
    box-shadow: 0 1px 2px rgb(0 0 0 / 3%);
  }

  .rn-profile-social .rn-profile-heading-copy {
    flex: 1;
    min-width: 0;
  }

  .rn-profile-social .rn-profile-eyebrow {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    color: var(--profile-blue);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 1px;
  }

  .rn-profile-social .rn-profile-eyebrow-dot {
    width: 8px;
    height: 8px;
    flex: 0 0 8px;
    border-radius: 50%;
    background: var(--profile-blue);
  }

  .rn-profile-social .rn-profile-header h1 {
    margin: 0;
    color: var(--profile-text);
    font-size: clamp(26px, 3vw, 34px);
    font-weight: 750;
    letter-spacing: -0.7px;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }

  .rn-profile-social .rn-profile-header p {
    max-width: 670px;
    margin: 10px 0 0;
    color: var(--profile-muted);
    font-size: 13px;
    line-height: 1.8;
  }

  .rn-profile-social .rn-profile-header-actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 9px;
  }

  .rn-profile-social .rn-profile-primary,
  .rn-profile-social .rn-profile-secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 41px;
    padding: 10px 17px;
    border: 1px solid transparent;
    border-radius: 23px;
    font-size: 12px;
    font-weight: 750;
    line-height: 1.4;
    text-align: center;
    text-decoration: none;
    transition:
      background 150ms ease,
      border-color 150ms ease,
      color 150ms ease,
      box-shadow 150ms ease;
  }

  .rn-profile-social .rn-profile-primary {
    border-color: var(--profile-blue);
    background: var(--profile-blue);
    color: #ffffff;
  }

  .rn-profile-social .rn-profile-primary:hover {
    border-color: var(--profile-blue-dark);
    background: var(--profile-blue-dark);
    color: #ffffff;
    box-shadow: 0 2px 5px rgb(10 102 194 / 15%);
  }

  .rn-profile-social .rn-profile-secondary {
    border-color: #b7c0ca;
    background: #ffffff;
    color: #343a40;
  }

  .rn-profile-social .rn-profile-secondary:hover {
    border-color: var(--profile-blue);
    background: #edf5fd;
    color: var(--profile-blue);
  }

  .rn-profile-social .rn-profile-primary:focus-visible,
  .rn-profile-social .rn-profile-secondary:focus-visible,
  .rn-profile-social .rn-profile-text-link:focus-visible {
    outline: 3px solid rgb(10 102 194 / 30%);
    outline-offset: 3px;
  }

  /* Summary cards */

  .rn-profile-social .rn-profile-stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 15px;
    margin-bottom: 22px;
  }

  .rn-profile-social .rn-profile-stat {
    min-width: 0;
    padding: 20px;
    border: 1px solid var(--profile-border);
    border-radius: 11px;
    background: #ffffff;
    box-shadow: 0 1px 2px rgb(0 0 0 / 3%);
    transition:
      box-shadow 150ms ease,
      transform 150ms ease;
  }

  .rn-profile-social .rn-profile-stat:hover {
    box-shadow: 0 4px 12px rgb(0 0 0 / 5%);
    transform: translateY(-1px);
  }

  .rn-profile-social .rn-profile-stat-top {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
  }

  .rn-profile-social .rn-profile-stat-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    flex: 0 0 34px;
    border-radius: 9px;
    font-size: 15px;
    font-weight: 800;
  }

  .rn-profile-social .rn-profile-icon-blue {
    background: #e8f2fc;
    color: #0a66c2;
  }

  .rn-profile-social .rn-profile-icon-green {
    background: #e6f5ec;
    color: #16834a;
  }

  .rn-profile-social .rn-profile-icon-purple {
    background: #f0eafd;
    color: #7550b3;
  }

  .rn-profile-social .rn-profile-icon-amber {
    background: #fff3df;
    color: #986414;
  }

  .rn-profile-social .rn-profile-stat-label {
    min-width: 0;
    color: var(--profile-muted);
    font-size: 10px;
    font-weight: 750;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .rn-profile-social .rn-profile-stat-value {
    margin-top: 17px;
    color: var(--profile-text);
    font-size: clamp(28px, 3vw, 35px);
    font-weight: 800;
    letter-spacing: -0.8px;
    line-height: 1.15;
    overflow-wrap: anywhere;
  }

  .rn-profile-social .rn-profile-stat-caption {
    margin-top: 7px;
    color: var(--profile-muted);
    font-size: 11px;
    line-height: 1.6;
  }

  .rn-profile-social .rn-profile-mini-track {
    height: 5px;
    margin-top: 12px;
    overflow: hidden;
    border-radius: 20px;
    background: #e9edf2;
  }

  .rn-profile-social .rn-profile-mini-track > span {
    display: block;
    height: 100%;
    max-width: 100%;
    border-radius: inherit;
    background: var(--profile-blue);
  }

  /* Main dashboard */

  .rn-profile-social .rn-profile-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 310px;
    align-items: start;
    gap: 20px;
  }

  .rn-profile-social .rn-profile-panel {
    min-width: 0;
    padding: 22px;
    margin-bottom: 16px;
    border: 1px solid var(--profile-border);
    border-radius: 12px;
    background: #ffffff;
    box-shadow: 0 1px 2px rgb(0 0 0 / 3%);
  }

  .rn-profile-social .rn-profile-panel-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    padding-bottom: 17px;
    margin-bottom: 4px;
    border-bottom: 1px solid #e9ecef;
  }

  .rn-profile-social .rn-profile-panel-heading h2,
  .rn-profile-social .rn-profile-panel > h2 {
    margin: 5px 0 0;
    color: var(--profile-text);
    font-size: 18px;
    font-weight: 750;
    line-height: 1.4;
    letter-spacing: -0.25px;
    overflow-wrap: anywhere;
  }

  .rn-profile-social .rn-profile-panel > h2 {
    margin-bottom: 15px;
  }

  .rn-profile-social .rn-profile-text-link {
    color: var(--profile-blue);
    font-size: 11px;
    font-weight: 750;
    line-height: 1.5;
    text-decoration: none;
  }

  .rn-profile-social .rn-profile-text-link:hover {
    color: var(--profile-blue-dark);
    text-decoration: underline;
  }

  /* Individual skills */

  .rn-profile-social .rn-profile-skill-list {
    display: grid;
  }

  .rn-profile-social .rn-profile-skill {
    min-width: 0;
    padding: 21px 0;
    border-bottom: 1px solid #e9ecef;
  }

  .rn-profile-social .rn-profile-skill:last-child {
    padding-bottom: 3px;
    border-bottom: none;
  }

  .rn-profile-social .rn-profile-skill-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
    min-width: 0;
  }

  .rn-profile-social .rn-profile-skill-heading > div:first-child {
    flex: 1;
    min-width: 0;
  }

  .rn-profile-social .rn-profile-skill-heading > div:first-child > strong {
    display: block;
    color: #25292e;
    font-size: 14px;
    font-weight: 750;
    line-height: 1.6;
    overflow-wrap: anywhere;
  }

  .rn-profile-social .rn-profile-skill-heading > div:first-child > span {
    display: inline-block;
    margin-top: 5px;
    color: var(--profile-muted);
    font-size: 10px;
    line-height: 1.5;
  }

  .rn-profile-social .rn-profile-skill-score {
    display: flex;
    flex: 0 0 auto;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
  }

  .rn-profile-social .rn-profile-skill-score > strong {
    color: var(--profile-blue);
    font-size: 24px;
    font-weight: 800;
    letter-spacing: -0.6px;
    line-height: 1.2;
    white-space: nowrap;
  }

  .rn-profile-social .rn-profile-skill-score > span {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    max-width: 100%;
    padding: 4px 8px;
    border: 1px solid #d8e7f7;
    border-radius: 18px;
    background: #edf5fd;
    color: #0a579e;
    font-size: 9px;
    font-weight: 750;
    line-height: 1.4;
    text-align: center;
  }

  .rn-profile-social .rn-skill-bar {
    width: 100%;
    height: 7px;
    margin-top: 15px;
    overflow: hidden;
    border-radius: 20px;
    background: #e9edf2;
  }

  .rn-profile-social .rn-skill-bar > span {
    display: block;
    height: 100%;
    max-width: 100%;
    border-radius: inherit;
    background: #0a66c2;
    transition: width 220ms ease;
  }

  .rn-profile-social .rn-profile-level-caption {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 7px;
    color: var(--profile-muted);
    font-size: 10px;
    line-height: 1.6;
  }

  .rn-profile-social .rn-profile-evidence {
    margin: 13px 0 0;
    padding: 12px 13px;
    border: 1px solid #e6ebf0;
    border-radius: 8px;
    background: #f8fafc;
    color: #505963;
    font-size: 11px;
    line-height: 1.75;
    overflow-wrap: anywhere;
  }

  .rn-profile-social .rn-profile-insight {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 9px;
    margin-top: 11px;
  }

  .rn-profile-social .rn-profile-insight > div {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    min-width: 0;
    padding: 11px;
    border: 1px solid #e6ebf0;
    border-radius: 8px;
    background: #ffffff;
  }

  .rn-profile-social .rn-profile-insight > div > strong {
    color: var(--profile-muted);
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }

  .rn-profile-social .rn-profile-insight > div > span {
    color: #343a40;
    font-size: 11px;
    line-height: 1.7;
    overflow-wrap: anywhere;
  }

  /* Sidebar */

  .rn-profile-social .rn-profile-sidebar {
    display: grid;
    gap: 0;
    min-width: 0;
  }

  .rn-profile-social .rn-profile-sidebar .rn-profile-panel {
    padding: 19px;
  }

  .rn-profile-social .rn-profile-sidebar .rn-profile-panel > h2 {
    margin-bottom: 12px;
    font-size: 15px;
  }

  .rn-profile-social .rn-profile-mini-list {
    display: grid;
  }

  .rn-profile-social .rn-profile-mini-list > div {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
    padding: 12px 0;
    border-bottom: 1px solid #edf0f2;
  }

  .rn-profile-social .rn-profile-mini-list > div:first-child {
    padding-top: 4px;
  }

  .rn-profile-social .rn-profile-mini-list > div:last-child {
    padding-bottom: 3px;
    border-bottom: none;
  }

  .rn-profile-social .rn-profile-mini-list strong {
    color: #30343b;
    font-size: 12px;
    font-weight: 750;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .rn-profile-social .rn-profile-mini-list span {
    color: var(--profile-muted);
    font-size: 10px;
    line-height: 1.5;
  }

  .rn-profile-social .rn-profile-muted {
    margin: 8px 0 0;
    color: var(--profile-muted);
    font-size: 12px;
    line-height: 1.8;
  }

  .rn-profile-social .rn-profile-next {
    border-top: 3px solid var(--profile-blue);
  }

  .rn-profile-social .rn-profile-next > p {
    margin: 9px 0 17px;
    color: var(--profile-muted);
    font-size: 12px;
    line-height: 1.8;
  }

  .rn-profile-social .rn-profile-block-button {
    display: flex;
    width: 100%;
  }

  .rn-profile-social .rn-profile-updated {
    margin: 3px 0 0;
    color: #737780;
    font-size: 11px;
    line-height: 1.7;
    text-align: right;
  }

  /* Empty state */

  .rn-profile-social .rn-profile-empty {
    max-width: 760px;
    margin: 16px auto 0;
    padding: clamp(25px, 5vw, 42px);
    border: 1px solid var(--profile-border);
    border-radius: 12px;
    background: #ffffff;
    text-align: center;
    box-shadow: 0 1px 2px rgb(0 0 0 / 3%);
  }

  .rn-profile-social .rn-profile-empty-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 55px;
    height: 55px;
    margin: 0 auto 17px;
    border: 1px solid #cfe0f2;
    border-radius: 14px;
    background: #edf5fd;
    color: var(--profile-blue);
    font-size: 17px;
    font-weight: 850;
    letter-spacing: -0.5px;
  }

  .rn-profile-social .rn-profile-empty h2 {
    margin: 0;
    color: var(--profile-text);
    font-size: clamp(22px, 3vw, 28px);
    font-weight: 750;
    letter-spacing: -0.4px;
    line-height: 1.4;
  }

  .rn-profile-social .rn-profile-empty > p {
    max-width: 570px;
    margin: 11px auto 22px;
    color: var(--profile-muted);
    font-size: 13px;
    line-height: 1.85;
  }

  /* Mobile and tablet */

  @media (max-width: 1050px) {
    .rn-profile-social .rn-profile-stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .rn-profile-social .rn-profile-grid {
      grid-template-columns: minmax(0, 1fr) 280px;
      gap: 15px;
    }
  }

  @media (max-width: 800px) {
    .rn-profile-social {
      padding: 20px 15px 30px;
    }

    .rn-profile-social .rn-profile-grid {
      grid-template-columns: minmax(0, 1fr);
      gap: 0;
    }

    .rn-profile-social .rn-profile-sidebar {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      column-gap: 12px;
      align-items: start;
    }

    .rn-profile-social .rn-profile-sidebar .rn-profile-next {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 520px) {
    .rn-profile-social {
      padding: 12px 10px 25px;
    }

    .rn-profile-social .rn-profile-header {
      padding: 20px 16px;
      margin-bottom: 13px;
      border-radius: 10px;
    }

    .rn-profile-social .rn-profile-header h1 {
      font-size: 25px;
    }

    .rn-profile-social .rn-profile-header p {
      font-size: 12px;
    }

    .rn-profile-social .rn-profile-header-actions {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      width: 100%;
      gap: 9px;
    }

    .rn-profile-social .rn-profile-header-actions > a {
      width: 100%;
    }

    .rn-profile-social .rn-profile-stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 13px;
    }

    .rn-profile-social .rn-profile-stat {
      padding: 15px 13px;
      border-radius: 10px;
    }

    .rn-profile-social .rn-profile-stat-top {
      align-items: flex-start;
      gap: 7px;
    }

    .rn-profile-social .rn-profile-stat-icon {
      width: 29px;
      height: 29px;
      flex-basis: 29px;
      font-size: 13px;
    }

    .rn-profile-social .rn-profile-stat-label {
      padding-top: 2px;
      font-size: 9px;
    }

    .rn-profile-social .rn-profile-stat-value {
      margin-top: 13px;
      font-size: 29px;
    }

    .rn-profile-social .rn-profile-stat-caption {
      font-size: 10px;
    }

    .rn-profile-social .rn-profile-panel {
      padding: 17px 14px;
      margin-bottom: 12px;
      border-radius: 10px;
    }

    .rn-profile-social .rn-profile-panel-heading {
      gap: 9px;
    }

    .rn-profile-social .rn-profile-panel-heading h2 {
      font-size: 17px;
    }

    .rn-profile-social .rn-profile-text-link {
      font-size: 10px;
    }

    .rn-profile-social .rn-profile-skill {
      padding: 17px 0;
    }

    .rn-profile-social .rn-profile-skill-heading {
      gap: 9px;
    }

    .rn-profile-social .rn-profile-skill-heading > div:first-child > strong {
      font-size: 13px;
    }

    .rn-profile-social .rn-profile-skill-score > strong {
      font-size: 22px;
    }

    .rn-profile-social .rn-profile-skill-score > span {
      font-size: 8px;
    }

    .rn-profile-social .rn-profile-insight {
      grid-template-columns: minmax(0, 1fr);
    }

    .rn-profile-social .rn-profile-sidebar {
      grid-template-columns: minmax(0, 1fr);
    }

    .rn-profile-social .rn-profile-sidebar .rn-profile-next {
      grid-column: auto;
    }

    .rn-profile-social .rn-profile-sidebar .rn-profile-panel {
      padding: 17px;
    }

    .rn-profile-social .rn-profile-updated {
      text-align: left;
    }

    .rn-profile-social .rn-profile-empty {
      padding: 25px 16px;
      border-radius: 10px;
    }

    .rn-profile-social .rn-profile-empty > p {
      font-size: 12px;
    }
  }

  @media (max-width: 350px) {
    .rn-profile-social .rn-profile-stats {
      grid-template-columns: minmax(0, 1fr);
    }

    .rn-profile-social .rn-profile-stat {
      padding: 16px;
    }

    .rn-profile-social .rn-profile-stat-top {
      align-items: center;
    }

    .rn-profile-social .rn-profile-stat-value {
      margin-top: 10px;
    }

    .rn-profile-social .rn-profile-skill-heading {
      flex-direction: column;
      align-items: flex-start;
    }

    .rn-profile-social .rn-profile-skill-score {
      flex-direction: row;
      align-items: center;
      gap: 9px;
    }

    .rn-profile-social .rn-profile-skill-score > strong {
      font-size: 22px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .rn-profile-social *,
    .rn-profile-social *::before,
    .rn-profile-social *::after {
      scroll-behavior: auto !important;
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
`;

export default async function StudentSkillsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/student/skills");
  }

  const {
    data: profiles,
    error: profilesError,
  } = await supabase
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
    .order("confidence_score", {
      ascending: false,
    });

  if (profilesError) {
    console.error(
      "Failed to load student skill profile:",
      profilesError
    );
  }

  const skillProfiles =
    (profiles || []) as unknown as SkillProfile[];

  const normalized = skillProfiles.map((profile) => {
    const skill = Array.isArray(profile.learning_skills)
      ? profile.learning_skills[0] ?? null
      : profile.learning_skills;

    return {
      ...profile,
      skill,
      score: clampScore(profile.confidence_score),
    };
  });

  const averageScore =
    normalized.length > 0
      ? Math.round(
          normalized.reduce(
            (sum, item) => sum + item.score,
            0
          ) / normalized.length
        )
      : 0;

  const strengths = normalized.filter(
    (item) => item.score >= 80
  );

  const developmentAreas = normalized.filter(
    (item) => item.score < 50
  );

  const latestUpdate =
    normalized
      .map((item) => item.updated_at)
      .filter(
        (value): value is string => Boolean(value)
      )
      .sort(
        (a, b) =>
          new Date(b).getTime() -
          new Date(a).getTime()
      )[0] ?? null;

  return (
    <main className="rn-profile-social">
      <div className="rn-profile-shell">
        <header className="rn-profile-header">
          <div className="rn-profile-heading-copy">
            <div className="rn-profile-eyebrow">
              <span className="rn-profile-eyebrow-dot" />
              RUFFNECK LEARN
            </div>

            <h1>My Learning Profile</h1>

            <p>
              Track your demonstrated skills, current confidence
              levels and areas for further development. Your profile
              brings your learning progress into one place.
            </p>
          </div>

          <div className="rn-profile-header-actions">
            <Link
              href="/courses"
              className="rn-profile-primary"
            >
              {normalized.length
                ? "Explore More Learning"
                : "Start Learning"}
              <span aria-hidden="true">→</span>
            </Link>

            <Link
              href="/student/dashboard"
              className="rn-profile-secondary"
            >
              Dashboard
            </Link>
          </div>
        </header>

        {normalized.length === 0 ? (
          <section className="rn-profile-empty">
            <div className="rn-profile-empty-icon">
              RN
            </div>

            <div className="rn-profile-eyebrow">
              <span className="rn-profile-eyebrow-dot" />
              YOUR SKILL JOURNEY
            </div>

            <h2>Build your learning profile</h2>

            <p>
              Your skill profile is built from assessments completed
              through RuffNeck Learn courses. Enroll in a course and
              complete its assessment to establish and develop your
              learning profile.
            </p>

            <Link
              href="/courses"
              className="rn-profile-primary"
            >
              Browse Courses
              <span aria-hidden="true">→</span>
            </Link>
          </section>
        ) : (
          <>
            <section
              className="rn-profile-stats"
              aria-label="Learning profile statistics"
            >
              <article className="rn-profile-stat">
                <div className="rn-profile-stat-top">
                  <span className="rn-profile-stat-icon rn-profile-icon-blue">
                    %
                  </span>

                  <span className="rn-profile-stat-label">
                    OVERALL PERFORMANCE
                  </span>
                </div>

                <div className="rn-profile-stat-value">
                  {averageScore}%
                </div>

                <div className="rn-profile-stat-caption">
                  Average confidence score
                </div>

                <div
                  className="rn-profile-mini-track"
                  role="progressbar"
                  aria-label="Average skill score"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={averageScore}
                >
                  <span
                    style={{
                      width: `${averageScore}%`,
                    }}
                  />
                </div>
              </article>

              <article className="rn-profile-stat">
                <div className="rn-profile-stat-top">
                  <span className="rn-profile-stat-icon rn-profile-icon-blue">
                    S
                  </span>

                  <span className="rn-profile-stat-label">
                    SKILL DEVELOPMENT
                  </span>
                </div>

                <div className="rn-profile-stat-value">
                  {normalized.length}
                </div>

                <div className="rn-profile-stat-caption">
                  Skills in your profile
                </div>
              </article>

              <article className="rn-profile-stat">
                <div className="rn-profile-stat-top">
                  <span className="rn-profile-stat-icon rn-profile-icon-green">
                    ✓
                  </span>

                  <span className="rn-profile-stat-label">
                    STRONG AREAS
                  </span>
                </div>

                <div className="rn-profile-stat-value">
                  {strengths.length}
                </div>

                <div className="rn-profile-stat-caption">
                  Scores of 80% or above
                </div>
              </article>

              <article className="rn-profile-stat">
                <div className="rn-profile-stat-top">
                  <span className="rn-profile-stat-icon rn-profile-icon-amber">
                    ↗
                  </span>

                  <span className="rn-profile-stat-label">
                    GROWTH OPPORTUNITIES
                  </span>
                </div>

                <div className="rn-profile-stat-value">
                  {developmentAreas.length}
                </div>

                <div className="rn-profile-stat-caption">
                  Skills scoring below 50%
                </div>
              </article>
            </section>

            <div className="rn-profile-grid">
              <section className="rn-profile-panel">
                <div className="rn-profile-panel-heading">
                  <div>
                    <div className="rn-profile-eyebrow">
                      <span className="rn-profile-eyebrow-dot" />
                      SKILL MAP
                    </div>

                    <h2>Your skills</h2>
                  </div>

                  <Link
                    href="/courses"
                    className="rn-profile-text-link"
                  >
                    Continue learning →
                  </Link>
                </div>

                <div className="rn-profile-skill-list">
                  {normalized.map((item) => (
                    <article
                      className="rn-profile-skill"
                      key={item.id}
                    >
                      <div className="rn-profile-skill-heading">
                        <div>
                          <strong>
                            {item.skill?.name || "Learning skill"}
                          </strong>

                          {item.skill?.category && (
                            <span>
                              {item.skill.category}
                            </span>
                          )}
                        </div>

                        <div className="rn-profile-skill-score">
                          <strong>{item.score}%</strong>

                          <span>
                            {formatLevel(item.skill_level)}
                          </span>
                        </div>
                      </div>

                      <div
                        className="rn-skill-bar"
                        role="progressbar"
                        aria-label={`${item.skill?.name || "Skill"} confidence score`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={item.score}
                      >
                        <span
                          style={{
                            width: `${item.score}%`,
                          }}
                        />
                      </div>

                      <div className="rn-profile-level-caption">
                        <span>
                          {getLevelDescription(item.score)}
                        </span>

                        <span>{item.score} out of 100</span>
                      </div>

                      {item.evidence && (
                        <p className="rn-profile-evidence">
                          {item.evidence}
                        </p>
                      )}

                      {(item.strengths || item.gaps) && (
                        <div className="rn-profile-insight">
                          {item.strengths && (
                            <div>
                              <strong>Strength</strong>
                              <span>{item.strengths}</span>
                            </div>
                          )}

                          {item.gaps && (
                            <div>
                              <strong>Development</strong>
                              <span>{item.gaps}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>

              <aside className="rn-profile-sidebar">
                <section className="rn-profile-panel">
                  <div className="rn-profile-eyebrow">
                    <span className="rn-profile-eyebrow-dot" />
                    STRENGTHS
                  </div>

                  <h2>What you already know</h2>

                  {strengths.length ? (
                    <div className="rn-profile-mini-list">
                      {strengths.map((item) => (
                        <div key={item.id}>
                          <strong>
                            {item.skill?.name || "Skill"}
                          </strong>

                          <span>
                            {item.score}% demonstrated
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rn-profile-muted">
                      Complete more course assessments to identify
                      your strongest areas. Scores of 80% or above
                      appear here.
                    </p>
                  )}
                </section>

                <section className="rn-profile-panel">
                  <div className="rn-profile-eyebrow">
                    <span className="rn-profile-eyebrow-dot" />
                    DEVELOPMENT
                  </div>

                  <h2>Areas to strengthen</h2>

                  {developmentAreas.length ? (
                    <div className="rn-profile-mini-list">
                      {developmentAreas.map((item) => (
                        <div key={item.id}>
                          <strong>
                            {item.skill?.name || "Skill"}
                          </strong>

                          <span>
                            {item.score}% demonstrated
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rn-profile-muted">
                      No major development areas have been identified
                      by the current scoring threshold.
                    </p>
                  )}
                </section>

                <section className="rn-profile-panel rn-profile-next">
                  <div className="rn-profile-eyebrow">
                    <span className="rn-profile-eyebrow-dot" />
                    NEXT STEP
                  </div>

                  <h2>Keep building your skills</h2>

                  <p>
                    Choose courses that build on your strengths and
                    help address development areas in your profile.
                  </p>

                  <Link
                    href="/courses"
                    className="rn-profile-primary rn-profile-block-button"
                  >
                    Browse Courses
                    <span aria-hidden="true">→</span>
                  </Link>

                  <Link
                    href="/student/assessment/results"
                    className="rn-profile-secondary rn-profile-block-button"
                    style={{ marginTop: 9 }}
                  >
                    Review Assessment Results
                  </Link>
                </section>
              </aside>
            </div>

            {latestUpdate && (
              <p className="rn-profile-updated">
                Profile last updated {formatDate(latestUpdate)}
              </p>
            )}
          </>
        )}
      </div>

      <style>{profileStyles}</style>
    </main>
  );
}