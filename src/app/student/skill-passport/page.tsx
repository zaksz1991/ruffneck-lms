import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EvidenceTimeline from "./EvidenceTimeline";
import VerificationCard from "./VerificationCard";

type Skill = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
};

type SkillProfile = {
  id: string;
  skill_id: string;
  skill_level: string | null;
  confidence_score: number | null;
  mastery_score: number | null;
  evidence_count: number | null;
  strengths: string[] | null;
  gaps: string[] | null;
  evidence: string[] | null;
};

type PracticalSubmission = {
  id: string;
  task_id: string;
  score: number | null;
  reviewed_at: string | null;
  evidence_file_name: string | null;
  evidence_recorded_at: string | null;
};

type PracticalTask = {
  id: string;
  title: string;
  course_id: string;
  skill_id: string | null;
};

type Course = {
  id: string;
  title: string;
};

type EvidenceItem = {
  id: string;
  skillName: string;
  taskTitle: string;
  courseTitle: string;
  score: number | null;
  reviewedAt: string | null;
  evidenceFileName: string | null;
};

function clampScore(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, value));
}

function scoreLabel(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "Not assessed";
  }

  return `${Math.round(clampScore(value))}%`;
}

function levelLabel(value: string | null) {
  if (!value) {
    return "Developing";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
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

function skillLevelDescription(score: number) {
  if (score >= 80) {
    return "Strong demonstrated performance";
  }

  if (score >= 50) {
    return "Developing capability";
  }

  return "Opportunity to improve";
}

const passportStyles = `
  .rn-passport,
  .rn-passport * {
    box-sizing: border-box;
  }

  .rn-passport {
    --passport-blue: #0a66c2;
    --passport-blue-dark: #004182;
    --passport-text: #191919;
    --passport-muted: #666a70;
    --passport-border: #dfe3e8;
    --passport-green: #16834a;

    width: 100%;
    min-height: 75vh;
    padding: 28px 22px 38px;
    background: #f3f5f8;
    color: var(--passport-text);
    font-family: Arial, Helvetica, sans-serif;
  }

  .rn-passport-shell {
    width: 100%;
    max-width: 1180px;
    margin: 0 auto;
  }

  /* Page heading */

  .rn-passport-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 22px;
    padding: 27px 28px;
    margin-bottom: 20px;
    border: 1px solid var(--passport-border);
    border-radius: 12px;
    background: #fff;
    box-shadow: 0 1px 2px rgb(0 0 0 / 3%);
  }

  .rn-passport-heading-copy {
    flex: 1;
    min-width: 0;
  }

  .rn-passport-eyebrow {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    color: var(--passport-blue);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 1px;
    line-height: 1.5;
  }

  .rn-passport-eyebrow-dot {
    width: 8px;
    height: 8px;
    flex: 0 0 8px;
    border-radius: 50%;
    background: var(--passport-blue);
  }

  .rn-passport-header h1 {
    margin: 0;
    color: var(--passport-text);
    font-size: clamp(25px, 3vw, 34px);
    font-weight: 750;
    letter-spacing: -0.7px;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }

  .rn-passport-header p {
    max-width: 680px;
    margin: 10px 0 0;
    color: var(--passport-muted);
    font-size: 13px;
    line-height: 1.8;
  }

  .rn-passport-header-actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 9px;
  }

  .rn-passport-primary,
  .rn-passport-secondary {
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
    line-height: 1.45;
    text-align: center;
    text-decoration: none;
    transition:
      background 150ms ease,
      border-color 150ms ease,
      color 150ms ease,
      box-shadow 150ms ease;
  }

  .rn-passport-primary {
    border-color: var(--passport-blue);
    background: var(--passport-blue);
    color: #fff;
  }

  .rn-passport-primary:hover {
    border-color: var(--passport-blue-dark);
    background: var(--passport-blue-dark);
    color: #fff;
    box-shadow: 0 2px 5px rgb(10 102 194 / 15%);
  }

  .rn-passport-secondary {
    border-color: #b7c0ca;
    background: #fff;
    color: #343a40;
  }

  .rn-passport-secondary:hover {
    border-color: var(--passport-blue);
    background: #edf5fd;
    color: var(--passport-blue);
  }

  .rn-passport-primary:focus-visible,
  .rn-passport-secondary:focus-visible,
  .rn-passport-text-link:focus-visible {
    outline: 3px solid rgb(10 102 194 / 30%);
    outline-offset: 3px;
  }

  /* Summary cards */

  .rn-passport-stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 15px;
    margin-bottom: 21px;
  }

  .rn-passport-stat {
    min-width: 0;
    padding: 20px;
    border: 1px solid var(--passport-border);
    border-radius: 11px;
    background: #fff;
    box-shadow: 0 1px 2px rgb(0 0 0 / 3%);
    transition:
      box-shadow 150ms ease,
      transform 150ms ease;
  }

  .rn-passport-stat:hover {
    box-shadow: 0 4px 12px rgb(0 0 0 / 5%);
    transform: translateY(-1px);
  }

  .rn-passport-stat-top {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
  }

  .rn-passport-stat-icon {
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

  .rn-passport-icon-blue {
    background: #e8f2fc;
    color: #0a66c2;
  }

  .rn-passport-icon-green {
    background: #e6f5ec;
    color: #16834a;
  }

  .rn-passport-icon-purple {
    background: #f0eafd;
    color: #7550b3;
  }

  .rn-passport-icon-amber {
    background: #fff3df;
    color: #986414;
  }

  .rn-passport-stat-label {
    min-width: 0;
    color: var(--passport-muted);
    font-size: 9px;
    font-weight: 800;
    letter-spacing: .5px;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .rn-passport-stat-value {
    margin-top: 17px;
    color: var(--passport-text);
    font-size: clamp(28px, 3vw, 35px);
    font-weight: 800;
    letter-spacing: -.8px;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .rn-passport-stat-caption {
    margin-top: 7px;
    color: var(--passport-muted);
    font-size: 11px;
    line-height: 1.6;
  }

  .rn-passport-mini-track {
    width: 100%;
    height: 5px;
    margin-top: 12px;
    overflow: hidden;
    border-radius: 20px;
    background: #e9edf2;
  }

  .rn-passport-mini-track > span {
    display: block;
    height: 100%;
    max-width: 100%;
    border-radius: inherit;
    background: var(--passport-blue);
  }

  /* Shared panels */

  .rn-passport-panel {
    min-width: 0;
    padding: 22px;
    margin-bottom: 17px;
    border: 1px solid var(--passport-border);
    border-radius: 12px;
    background: #fff;
    box-shadow: 0 1px 2px rgb(0 0 0 / 3%);
  }

  .rn-passport-panel-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 13px;
    padding-bottom: 17px;
    margin-bottom: 6px;
    border-bottom: 1px solid #e9ecef;
  }

  .rn-passport-panel-heading > div {
    min-width: 0;
  }

  .rn-passport-panel-heading h2 {
    margin: 5px 0 0;
    color: var(--passport-text);
    font-size: 19px;
    font-weight: 750;
    letter-spacing: -.3px;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  .rn-passport-panel-description {
    margin: 7px 0 0;
    color: var(--passport-muted);
    font-size: 12px;
    line-height: 1.7;
  }

  .rn-passport-text-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    color: var(--passport-blue);
    font-size: 11px;
    font-weight: 750;
    line-height: 1.5;
    text-decoration: none;
  }

  .rn-passport-text-link:hover {
    color: var(--passport-blue-dark);
    text-decoration: underline;
  }

  .rn-passport-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 27px;
    padding: 5px 10px;
    border: 1px solid #d8e7f7;
    border-radius: 18px;
    background: #edf5fd;
    color: #0a579e;
    font-size: 10px;
    font-weight: 750;
  }

  /* Verification section */

  .rn-passport-verification {
    min-width: 0;
    margin-bottom: 20px;
  }

  /* Evidence timeline */

  .rn-passport-timeline {
    margin-bottom: 22px;
  }

  .rn-passport-timeline-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 40px;
    padding: 9px 15px;
    border: 1px solid var(--passport-blue);
    border-radius: 22px;
    background: var(--passport-blue);
    color: #fff;
    font-size: 11px;
    font-weight: 750;
    line-height: 1.4;
    text-decoration: none;
    transition: background 150ms ease;
  }

  .rn-passport-timeline-action:hover {
    border-color: var(--passport-blue-dark);
    background: var(--passport-blue-dark);
    color: #fff;
  }

  .rn-passport-evidence-content {
    min-width: 0;
    margin-top: 20px;
  }

  /* Main profile and sidebar */

  .rn-passport-content-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 305px;
    align-items: start;
    gap: 20px;
  }

  .rn-passport-main-column,
  .rn-passport-sidebar {
    min-width: 0;
  }

  .rn-passport-sidebar {
    display: grid;
    gap: 0;
  }

  .rn-passport-sidebar .rn-passport-panel {
    padding: 19px;
  }

  .rn-passport-sidebar .rn-passport-panel-heading {
    padding-bottom: 13px;
  }

  .rn-passport-sidebar .rn-passport-panel-heading h2 {
    font-size: 15px;
  }

  .rn-passport-sidebar .rn-passport-panel-heading .rn-passport-eyebrow {
    margin-bottom: 5px;
  }

  /* Individual skill cards */

  .rn-passport-skill-list {
    display: grid;
  }

  .rn-passport-skill-card {
    min-width: 0;
    padding: 21px 0;
    border-bottom: 1px solid #e9ecef;
  }

  .rn-passport-skill-card:last-child {
    padding-bottom: 3px;
    border-bottom: none;
  }

  .rn-passport-skill-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 15px;
    min-width: 0;
  }

  .rn-passport-skill-copy {
    flex: 1;
    min-width: 0;
  }

  .rn-passport-skill-copy h3 {
    margin: 0;
    color: #25292e;
    font-size: 15px;
    font-weight: 750;
    line-height: 1.55;
    overflow-wrap: anywhere;
  }

  .rn-passport-skill-category {
    display: inline-block;
    margin-top: 5px;
    color: var(--passport-muted);
    font-size: 10px;
    line-height: 1.5;
  }

  .rn-passport-skill-score {
    display: flex;
    flex: 0 0 auto;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
  }

  .rn-passport-skill-score > strong {
    color: var(--passport-blue);
    font-size: 25px;
    font-weight: 800;
    letter-spacing: -.5px;
    line-height: 1.15;
    white-space: nowrap;
  }

  .rn-passport-skill-level {
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

  .rn-passport-skill-track {
    width: 100%;
    height: 7px;
    margin-top: 15px;
    overflow: hidden;
    border-radius: 20px;
    background: #e9edf2;
  }

  .rn-passport-skill-track > span {
    display: block;
    height: 100%;
    max-width: 100%;
    border-radius: inherit;
    background: var(--passport-blue);
    transition: width 220ms ease;
  }

  .rn-passport-skill-footline {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 7px 12px;
    margin-top: 7px;
    color: var(--passport-muted);
    font-size: 10px;
    line-height: 1.6;
  }

  .rn-passport-skill-description {
    margin: 12px 0 0;
    color: #59616b;
    font-size: 11px;
    line-height: 1.75;
    overflow-wrap: anywhere;
  }

  .rn-passport-skill-metrics {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 9px;
    margin-top: 15px;
  }

  .rn-passport-skill-metric {
    min-width: 0;
    padding: 11px;
    border: 1px solid #e6ebf0;
    border-radius: 8px;
    background: #f8fafc;
  }

  .rn-passport-skill-metric > span {
    display: block;
    color: var(--passport-muted);
    font-size: 9px;
    font-weight: 700;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .rn-passport-skill-metric > strong {
    display: block;
    margin-top: 5px;
    color: #30343b;
    font-size: 13px;
    font-weight: 800;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .rn-passport-insights {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 12px;
  }

  .rn-passport-insight {
    min-width: 0;
    padding: 12px;
    border: 1px solid #e4e9ef;
    border-radius: 8px;
    background: #fff;
  }

  .rn-passport-insight-title {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 7px;
    color: #46515d;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: .4px;
    text-transform: uppercase;
  }

  .rn-passport-insight-title span {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 19px;
    height: 19px;
    flex: 0 0 19px;
    border-radius: 50%;
    background: #e8f2fc;
    color: var(--passport-blue);
    font-size: 10px;
  }

  .rn-passport-insight ul {
    display: grid;
    gap: 7px;
    padding-left: 17px;
    margin: 0;
    color: #4e5660;
    font-size: 11px;
    line-height: 1.65;
  }

  .rn-passport-insight li {
    overflow-wrap: anywhere;
  }

  .rn-passport-evidence-list {
    margin: 12px 0 0;
    padding: 12px;
    border: 1px solid #d8e7f7;
    border-radius: 8px;
    background: #f1f7fd;
  }

  .rn-passport-evidence-title {
    margin-bottom: 7px;
    color: #0a579e;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: .4px;
    text-transform: uppercase;
  }

  .rn-passport-evidence-list ul {
    display: grid;
    gap: 6px;
    padding-left: 17px;
    margin: 0;
    color: #465b70;
    font-size: 11px;
    line-height: 1.7;
  }

  .rn-passport-evidence-list li {
    overflow-wrap: anywhere;
  }

  /* Strength and development lists */

  .rn-passport-mini-list {
    display: grid;
  }

  .rn-passport-mini-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    min-width: 0;
    padding: 13px 0;
    border-bottom: 1px solid #edf0f2;
  }

  .rn-passport-mini-item:first-child {
    padding-top: 5px;
  }

  .rn-passport-mini-item:last-child {
    padding-bottom: 3px;
    border-bottom: none;
  }

  .rn-passport-mini-indicator {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    flex: 0 0 28px;
    border-radius: 8px;
    background: #e6f5ec;
    color: #16834a;
    font-size: 12px;
    font-weight: 800;
  }

  .rn-passport-mini-indicator-development {
    background: #fff3df;
    color: #986414;
  }

  .rn-passport-mini-copy {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
  }

  .rn-passport-mini-copy strong {
    color: #30343b;
    font-size: 11px;
    font-weight: 750;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .rn-passport-mini-copy span {
    color: var(--passport-muted);
    font-size: 10px;
    line-height: 1.5;
  }

  .rn-passport-muted {
    margin: 7px 0 0;
    color: var(--passport-muted);
    font-size: 12px;
    line-height: 1.8;
  }

  /* Next step */

  .rn-passport-next-panel {
    border-top: 3px solid var(--passport-blue);
  }

  .rn-passport-next-panel > p {
    margin: 10px 0 16px;
    color: var(--passport-muted);
    font-size: 12px;
    line-height: 1.8;
  }

  .rn-passport-block-link {
    display: flex;
    width: 100%;
  }

  .rn-passport-block-link + .rn-passport-block-link {
    margin-top: 9px;
  }

  .rn-passport-updated {
    margin: 2px 0 0;
    color: #737780;
    font-size: 11px;
    line-height: 1.7;
    text-align: right;
  }

  /* Empty state */

  .rn-passport-empty {
    max-width: 760px;
    margin: 15px auto 0;
    padding: clamp(26px, 5vw, 42px);
    border: 1px solid var(--passport-border);
    border-radius: 12px;
    background: #fff;
    text-align: center;
    box-shadow: 0 1px 2px rgb(0 0 0 / 3%);
  }

  .rn-passport-empty-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 55px;
    height: 55px;
    margin: 0 auto 17px;
    border: 1px solid #cfe0f2;
    border-radius: 14px;
    background: #edf5fd;
    color: var(--passport-blue);
    font-size: 17px;
    font-weight: 850;
    letter-spacing: -.5px;
  }

  .rn-passport-empty h2 {
    margin: 0;
    color: var(--passport-text);
    font-size: clamp(22px, 3vw, 28px);
    font-weight: 750;
    letter-spacing: -.4px;
    line-height: 1.4;
  }

  .rn-passport-empty > p {
    max-width: 570px;
    margin: 11px auto 22px;
    color: var(--passport-muted);
    font-size: 13px;
    line-height: 1.85;
  }

  .rn-passport-empty-actions {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 10px;
  }

  .rn-passport-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 8px 19px;
    padding-top: 23px;
    color: #7a8088;
    font-size: 10px;
    line-height: 1.6;
    text-align: center;
  }

  /* Responsive layouts */

  @media (max-width: 1050px) {
    .rn-passport-stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .rn-passport-content-grid {
      grid-template-columns: minmax(0, 1fr) 275px;
      gap: 15px;
    }
  }

  @media (max-width: 800px) {
    .rn-passport {
      padding: 20px 15px 30px;
    }

    .rn-passport-content-grid {
      grid-template-columns: minmax(0, 1fr);
      gap: 0;
    }

    .rn-passport-sidebar {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      column-gap: 12px;
      align-items: start;
    }

    .rn-passport-next-panel {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 520px) {
    .rn-passport {
      padding: 12px 10px 25px;
    }

    .rn-passport-header {
      padding: 20px 16px;
      margin-bottom: 13px;
      border-radius: 10px;
    }

    .rn-passport-header h1 {
      font-size: 25px;
    }

    .rn-passport-header p {
      font-size: 12px;
    }

    .rn-passport-header-actions {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      width: 100%;
    }

    .rn-passport-header-actions > a {
      width: 100%;
    }

    .rn-passport-stats {
      gap: 10px;
      margin-bottom: 13px;
    }

    .rn-passport-stat {
      padding: 15px 13px;
      border-radius: 10px;
    }

    .rn-passport-stat-top {
      align-items: flex-start;
      gap: 7px;
    }

    .rn-passport-stat-icon {
      width: 29px;
      height: 29px;
      flex-basis: 29px;
      font-size: 13px;
    }

    .rn-passport-stat-label {
      padding-top: 2px;
      font-size: 8px;
      letter-spacing: .3px;
    }

    .rn-passport-stat-value {
      margin-top: 13px;
      font-size: 28px;
    }

    .rn-passport-stat-caption {
      font-size: 10px;
    }

    .rn-passport-panel {
      padding: 17px 14px;
      margin-bottom: 12px;
      border-radius: 10px;
    }

    .rn-passport-panel-heading {
      gap: 9px;
      padding-bottom: 14px;
    }

    .rn-passport-panel-heading h2 {
      font-size: 17px;
    }

    .rn-passport-panel-description {
      font-size: 11px;
    }

    .rn-passport-text-link {
      font-size: 10px;
    }

    .rn-passport-timeline-action {
      width: 100%;
    }

    .rn-passport-evidence-content {
      margin-top: 15px;
    }

    .rn-passport-skill-card {
      padding: 17px 0;
    }

    .rn-passport-skill-heading {
      gap: 9px;
    }

    .rn-passport-skill-copy h3 {
      font-size: 13px;
    }

    .rn-passport-skill-score > strong {
      font-size: 22px;
    }

    .rn-passport-skill-score {
      gap: 5px;
    }

    .rn-passport-skill-level {
      font-size: 8px;
    }

    .rn-passport-skill-metrics {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 7px;
    }

    .rn-passport-skill-metric {
      padding: 9px 8px;
    }

    .rn-passport-skill-metric > span {
      font-size: 8px;
    }

    .rn-passport-skill-metric > strong {
      font-size: 12px;
    }

    .rn-passport-insights {
      grid-template-columns: minmax(0, 1fr);
      gap: 8px;
    }

    .rn-passport-sidebar {
      grid-template-columns: minmax(0, 1fr);
    }

    .rn-passport-next-panel {
      grid-column: auto;
    }

    .rn-passport-sidebar .rn-passport-panel {
      padding: 17px;
    }

    .rn-passport-updated {
      text-align: left;
    }

    .rn-passport-empty {
      padding: 25px 16px;
      border-radius: 10px;
    }

    .rn-passport-empty > p {
      font-size: 12px;
    }

    .rn-passport-empty-actions {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
    }

    .rn-passport-empty-actions > a {
      width: 100%;
    }
  }

  @media (max-width: 350px) {
    .rn-passport-stats {
      grid-template-columns: minmax(0, 1fr);
    }

    .rn-passport-stat {
      padding: 16px;
    }

    .rn-passport-stat-top {
      align-items: center;
    }

    .rn-passport-stat-value {
      margin-top: 10px;
    }

    .rn-passport-skill-heading {
      flex-direction: column;
      align-items: flex-start;
    }

    .rn-passport-skill-score {
      flex-direction: row;
      align-items: center;
      gap: 9px;
    }

    .rn-passport-skill-score > strong {
      font-size: 22px;
    }

    .rn-passport-skill-metrics {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .rn-passport *,
    .rn-passport *::before,
    .rn-passport *::after {
      scroll-behavior: auto !important;
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
`;

export default async function SkillPassportPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/student/skill-passport");
  }

  const [
    skillsResult,
    profilesResult,
    submissionsResult,
  ] = await Promise.all([
    supabase
      .from("learning_skills")
      .select("id,name,category,description")
      .order("name", {
        ascending: true,
      }),

    supabase
      .from("learner_skill_profiles")
      .select(
        "id,skill_id,skill_level,confidence_score,mastery_score,evidence_count,strengths,gaps,evidence"
      )
      .eq("learner_id", user.id)
      .order("confidence_score", {
        ascending: false,
        nullsFirst: false,
      }),

    supabase
      .from("student_practical_task_submissions")
      .select(
        "id,task_id,score,reviewed_at,evidence_file_name,evidence_recorded_at"
      )
      .eq("student_id", user.id)
      .eq("status", "approved")
      .not("evidence_recorded_at", "is", null)
      .order("reviewed_at", {
        ascending: false,
      }),
  ]);

  const skills = (skillsResult.data ?? []) as Skill[];

  const profiles =
    (profilesResult.data ?? []) as SkillProfile[];

  const submissions =
    (submissionsResult.data ?? []) as PracticalSubmission[];

  const skillMap = new Map(
    skills.map((skill) => [skill.id, skill])
  );

  const profileRows = profiles.filter(
    (profile) => skillMap.has(profile.skill_id)
  );

  const taskIds = Array.from(
    new Set(
      submissions.map((submission) => submission.task_id)
    )
  );

  let tasks: PracticalTask[] = [];

  if (taskIds.length > 0) {
    const { data } = await supabase
      .from("course_practical_tasks")
      .select("id,title,course_id,skill_id")
      .in("id", taskIds);

    tasks = (data ?? []) as PracticalTask[];
  }

  const courseIds = Array.from(
    new Set(tasks.map((task) => task.course_id))
  );

  let courses: Course[] = [];

  if (courseIds.length > 0) {
    const { data } = await supabase
      .from("courses")
      .select("id,title")
      .in("id", courseIds);

    courses = (data ?? []) as Course[];
  }

  const taskMap = new Map(
    tasks.map((task) => [task.id, task])
  );

  const courseMap = new Map(
    courses.map((course) => [course.id, course])
  );

  const evidenceItems: EvidenceItem[] = submissions
    .map((submission) => {
      const task = taskMap.get(submission.task_id);

      if (!task?.skill_id) {
        return null;
      }

      const skill = skillMap.get(task.skill_id);
      const course = courseMap.get(task.course_id);

      if (!skill || !course) {
        return null;
      }

      return {
        id: submission.id,
        skillName: skill.name,
        taskTitle: task.title,
        courseTitle: course.title,
        score: submission.score,
        reviewedAt: submission.reviewed_at,
        evidenceFileName: submission.evidence_file_name,
      };
    })
    .filter(
      (item): item is EvidenceItem => item !== null
    );

  const verifiedEvidenceCount = evidenceItems.length;

  const strongSkills = profileRows.filter(
    (profile) => clampScore(profile.confidence_score) >= 80
  ).length;

  const averageConfidence =
    profileRows.length > 0
      ? Math.round(
          profileRows.reduce(
            (total, profile) =>
              total + clampScore(profile.confidence_score),
            0
          ) / profileRows.length
        )
      : 0;

  const latestUpdate =
    profileRows
      .map((profile) => profile.updated_at)
      .filter(
        (value): value is string => Boolean(value)
      )
      .sort(
        (a, b) =>
          new Date(b).getTime() - new Date(a).getTime()
      )[0] ?? null;

  return (
    <main className="rn-passport">
      <div className="rn-passport-shell">
        <header className="rn-passport-header">
          <div className="rn-passport-heading-copy">
            <div className="rn-passport-eyebrow">
              <span className="rn-passport-eyebrow-dot" />
              RUFFNECK LEARN
            </div>

            <h1>Evidence-Based Skill Passport</h1>

            <p>
              A living record of the skills you have developed,
              demonstrated and verified through practical work.
              Review your strengths and track your professional
              development in one place.
            </p>
          </div>

          <div className="rn-passport-header-actions">
            <Link
              href="/student/practical-work"
              className="rn-passport-primary"
            >
              Practical Work
              <span aria-hidden="true">→</span>
            </Link>

            <Link
              href="/student/dashboard"
              className="rn-passport-secondary"
            >
              Dashboard
            </Link>
          </div>
        </header>

        <section
          className="rn-passport-stats"
          aria-label="Skill Passport summary"
        >
          <article className="rn-passport-stat">
            <div className="rn-passport-stat-top">
              <span className="rn-passport-stat-icon rn-passport-icon-blue">
                S
              </span>

              <span className="rn-passport-stat-label">
                SKILL DEVELOPMENT
              </span>
            </div>

            <div className="rn-passport-stat-value">
              {profileRows.length}
            </div>

            <div className="rn-passport-stat-caption">
              Skills in your learning profile
            </div>
          </article>

          <article className="rn-passport-stat">
            <div className="rn-passport-stat-top">
              <span className="rn-passport-stat-icon rn-passport-icon-green">
                ✓
              </span>

              <span className="rn-passport-stat-label">
                PRACTICAL EVIDENCE
              </span>
            </div>

            <div className="rn-passport-stat-value">
              {verifiedEvidenceCount}
            </div>

            <div className="rn-passport-stat-caption">
              Approved, recorded submissions
            </div>
          </article>

          <article className="rn-passport-stat">
            <div className="rn-passport-stat-top">
              <span className="rn-passport-stat-icon rn-passport-icon-purple">
                ★
              </span>

              <span className="rn-passport-stat-label">
                STRONG SKILLS
              </span>
            </div>

            <div className="rn-passport-stat-value">
              {strongSkills}
            </div>

            <div className="rn-passport-stat-caption">
              Confidence scores of 80% or above
            </div>
          </article>

          <article className="rn-passport-stat">
            <div className="rn-passport-stat-top">
              <span className="rn-passport-stat-icon rn-passport-icon-amber">
                %
              </span>

              <span className="rn-passport-stat-label">
                SKILL CONFIDENCE
              </span>
            </div>

            <div className="rn-passport-stat-value">
              {averageConfidence}%
            </div>

            <div className="rn-passport-stat-caption">
              Average confidence across recorded skills
            </div>

            <div
              className="rn-passport-mini-track"
              role="progressbar"
              aria-label="Average skill confidence"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={averageConfidence}
            >
              <span
                style={{
                  width: `${averageConfidence}%`,
                }}
              />
            </div>
          </article>
        </section>

        <section
          className="rn-passport-verification"
          aria-label="Skill Passport verification"
        >
          <VerificationCard />
        </section>

        <section className="rn-passport-panel rn-passport-timeline">
          <div className="rn-passport-panel-heading">
            <div>
              <div className="rn-passport-eyebrow">
                <span className="rn-passport-eyebrow-dot" />
                VERIFIED PRACTICAL EVIDENCE
              </div>

              <h2>Evidence Timeline</h2>

              <p className="rn-passport-panel-description">
                Approved practical tasks become evidence of
                demonstrated capability in your Skill Passport.
              </p>
            </div>

            <Link
              href="/student/practical-work"
              className="rn-passport-timeline-action"
            >
              Open Practical Work
              <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div className="rn-passport-evidence-content">
            <EvidenceTimeline items={evidenceItems} />
          </div>
        </section>

        <div className="rn-passport-content-grid">
          <section className="rn-passport-panel">
            <div className="rn-passport-panel-heading">
              <div>
                <div className="rn-passport-eyebrow">
                  <span className="rn-passport-eyebrow-dot" />
                  SKILL PROFILE
                </div>

                <h2>Demonstrated capabilities</h2>

                <p className="rn-passport-panel-description">
                  Your recorded skill levels, assessment confidence,
                  mastery scores and supporting evidence.
                </p>
              </div>

              <Link
                href="/student/certificates"
                className="rn-passport-secondary"
              >
                Certificates
              </Link>
            </div>

            {profileRows.length === 0 ? (
              <div className="rn-passport-empty">
                <div className="rn-passport-empty-icon">
                  RN
                </div>

                <h2>No skill evidence yet</h2>

                <p>
                  Complete lessons, assessments and Practical Work
                  tasks to begin building your Skill Passport.
                  Your recorded capabilities will appear here.
                </p>

                <div className="rn-passport-empty-actions">
                  <Link
                    href="/courses"
                    className="rn-passport-primary"
                  >
                    Explore Courses
                    <span aria-hidden="true">→</span>
                  </Link>

                  <Link
                    href="/student/practical-work"
                    className="rn-passport-secondary"
                  >
                    Start Practical Work
                  </Link>
                </div>
              </div>
            ) : (
              <div className="rn-passport-skill-list">
                {profileRows.map((profile) => {
                  const skill = skillMap.get(profile.skill_id);

                  if (!skill) {
                    return null;
                  }

                  const confidence = clampScore(
                    profile.confidence_score
                  );

                  const mastery =
                    profile.mastery_score === null
                      ? null
                      : clampScore(profile.mastery_score);

                  return (
                    <article
                      key={profile.id}
                      className="rn-passport-skill-card"
                    >
                      <div className="rn-passport-skill-heading">
                        <div className="rn-passport-skill-copy">
                          <h3>{skill.name}</h3>

                          <span className="rn-passport-skill-category">
                            {skill.category || "Professional Skill"}
                          </span>
                        </div>

                        <div className="rn-passport-skill-score">
                          <strong>
                            {scoreLabel(profile.confidence_score)}
                          </strong>

                          <span className="rn-passport-skill-level">
                            {levelLabel(profile.skill_level)}
                          </span>
                        </div>
                      </div>

                      <div
                        className="rn-passport-skill-track"
                        role="progressbar"
                        aria-label={`${skill.name} confidence`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={confidence}
                      >
                        <span
                          style={{
                            width: `${confidence}%`,
                          }}
                        />
                      </div>

                      <div className="rn-passport-skill-footline">
                        <span>
                          {skillLevelDescription(confidence)}
                        </span>

                        <span>
                          {confidence} out of 100
                        </span>
                      </div>

                      {skill.description && (
                        <p className="rn-passport-skill-description">
                          {skill.description}
                        </p>
                      )}

                      <div className="rn-passport-skill-metrics">
                        <div className="rn-passport-skill-metric">
                          <span>CONFIDENCE</span>

                          <strong>
                            {scoreLabel(profile.confidence_score)}
                          </strong>
                        </div>

                        <div className="rn-passport-skill-metric">
                          <span>MASTERY</span>

                          <strong>
                            {scoreLabel(profile.mastery_score)}
                          </strong>
                        </div>

                        <div className="rn-passport-skill-metric">
                          <span>EVIDENCE COUNT</span>

                          <strong>
                            {profile.evidence_count ?? 0}
                          </strong>
                        </div>
                      </div>

                      {profile.strengths &&
                        profile.strengths.length > 0 && (
                          <div className="rn-passport-insights">
                            <div className="rn-passport-insight">
                              <div className="rn-passport-insight-title">
                                <span aria-hidden="true">✓</span>
                                Strengths
                              </div>

                              <ul>
                                {profile.strengths.map(
                                  (strength, index) => (
                                    <li
                                      key={`${profile.id}-strength-${index}`}
                                    >
                                      {strength}
                                    </li>
                                  )
                                )}
                              </ul>
                            </div>

                            {profile.gaps &&
                              profile.gaps.length > 0 && (
                                <div className="rn-passport-insight">
                                  <div className="rn-passport-insight-title">
                                    <span aria-hidden="true">↗</span>
                                    Development
                                  </div>

                                  <ul>
                                    {profile.gaps.map(
                                      (gap, index) => (
                                        <li
                                          key={`${profile.id}-gap-${index}`}
                                        >
                                          {gap}
                                        </li>
                                      )
                                    )}
                                  </ul>
                                </div>
                              )}
                          </div>
                        )}

                      {(!profile.strengths ||
                        profile.strengths.length === 0) &&
                        profile.gaps &&
                        profile.gaps.length > 0 && (
                          <div className="rn-passport-insights">
                            <div className="rn-passport-insight">
                              <div className="rn-passport-insight-title">
                                <span aria-hidden="true">↗</span>
                                Development
                              </div>

                              <ul>
                                {profile.gaps.map((gap, index) => (
                                  <li
                                    key={`${profile.id}-gap-${index}`}
                                  >
                                    {gap}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}

                      {profile.evidence &&
                        profile.evidence.length > 0 && (
                          <div className="rn-passport-evidence-list">
                            <div className="rn-passport-evidence-title">
                              Evidence record
                            </div>

                            <ul>
                              {profile.evidence
                                .slice(0, 5)
                                .map((evidence, index) => (
                                  <li
                                    key={`${profile.id}-evidence-${index}`}
                                  >
                                    {evidence}
                                  </li>
                                ))}
                            </ul>
                          </div>
                        )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="rn-passport-sidebar">
            <section className="rn-passport-panel">
              <div className="rn-passport-panel-heading">
                <div>
                  <div className="rn-passport-eyebrow">
                    <span className="rn-passport-eyebrow-dot" />
                    STRENGTHS
                  </div>

                  <h2>What you know</h2>
                </div>

                <span className="rn-passport-count">
                  {strongSkills}
                </span>
              </div>

              {profileRows.filter(
                (profile) =>
                  clampScore(profile.confidence_score) >= 80
              ).length > 0 ? (
                <div className="rn-passport-mini-list">
                  {profileRows
                    .filter(
                      (profile) =>
                        clampScore(profile.confidence_score) >= 80
                    )
                    .map((profile) => {
                      const skill = skillMap.get(profile.skill_id);

                      if (!skill) {
                        return null;
                      }

                      return (
                        <div
                          className="rn-passport-mini-item"
                          key={profile.id}
                        >
                          <span className="rn-passport-mini-indicator">
                            ✓
                          </span>

                          <div className="rn-passport-mini-copy">
                            <strong>{skill.name}</strong>

                            <span>
                              {scoreLabel(profile.confidence_score)}
                              {" "}confidence
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p className="rn-passport-muted">
                  Skills with confidence scores of 80% or above
                  will appear here as your profile develops.
                </p>
              )}
            </section>

            <section className="rn-passport-panel">
              <div className="rn-passport-panel-heading">
                <div>
                  <div className="rn-passport-eyebrow">
                    <span className="rn-passport-eyebrow-dot" />
                    DEVELOPMENT
                  </div>

                  <h2>Areas to strengthen</h2>
                </div>

                <span className="rn-passport-count">
                  {profileRows.filter(
                    (profile) =>
                      clampScore(profile.confidence_score) < 50
                  ).length}
                </span>
              </div>

              {profileRows.filter(
                (profile) =>
                  clampScore(profile.confidence_score) < 50
              ).length > 0 ? (
                <div className="rn-passport-mini-list">
                  {profileRows
                    .filter(
                      (profile) =>
                        clampScore(profile.confidence_score) < 50
                    )
                    .map((profile) => {
                      const skill = skillMap.get(profile.skill_id);

                      if (!skill) {
                        return null;
                      }

                      return (
                        <div
                          className="rn-passport-mini-item"
                          key={profile.id}
                        >
                          <span className="rn-passport-mini-indicator rn-passport-mini-indicator-development">
                            ↗
                          </span>

                          <div className="rn-passport-mini-copy">
                            <strong>{skill.name}</strong>

                            <span>
                              {scoreLabel(profile.confidence_score)}
                              {" "}confidence
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p className="rn-passport-muted">
                  No skills currently fall below the 50% confidence
                  threshold. Continue practising to develop your
                  capabilities further.
                </p>
              )}
            </section>

            <section className="rn-passport-panel rn-passport-next-panel">
              <div className="rn-passport-eyebrow">
                <span className="rn-passport-eyebrow-dot" />
                YOUR NEXT STEP
              </div>

              <div className="rn-passport-panel-heading">
                <h2>Keep building your skills</h2>
              </div>

              <p>
                Strengthen your existing capabilities, address
                development areas, and add approved practical work
                to your evidence record.
              </p>

              <Link
                href="/courses"
                className="rn-passport-primary rn-passport-block-link"
              >
                Browse Courses
                <span aria-hidden="true">→</span>
              </Link>

              <Link
                href="/student/practical-work"
                className="rn-passport-secondary rn-passport-block-link"
              >
                Practical Work
              </Link>

              <Link
                href="/student/certificates"
                className="rn-passport-secondary rn-passport-block-link"
              >
                View Certificates
              </Link>
            </section>
          </aside>
        </div>

        {latestUpdate && (
          <p className="rn-passport-updated">
            Profile last updated {formatDate(latestUpdate)}
          </p>
        )}

        <footer className="rn-passport-footer">
          <span>RuffNeck Learn</span>
          <span>Evidence-Based Skill Passport</span>
          <span>Practical AI &amp; Digital Skills</span>
        </footer>
      </div>

      <style>{passportStyles}</style>
    </main>
  );
}