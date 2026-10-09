"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Course = { id: string; title: string; slug: string; status: string; progressPercent: number; completedLessons: number };
type Certificate = { id: string; number: string | null; issuedAt: string | null };
type Project = { id: string; status: string; score: number | null; createdAt: string | null };
type Skill = { id: string; name: string; level: string; score: number | null };
type Data = {
  summary: { enrolledCourses: number; completedCourses: number; averageProgress: number; certificates: number; projectSubmissions: number; approvedProjects: number; trackedSkills: number };
  courses: Course[]; certificates: Certificate[]; projects: Project[]; skills: Skill[]; notices: string[];
};
const empty: Data = { summary: { enrolledCourses: 0, completedCourses: 0, averageProgress: 0, certificates: 0, projectSubmissions: 0, approvedProjects: 0, trackedSkills: 0 }, courses: [], certificates: [], projects: [], skills: [], notices: [] };
const label = (value: string) => value.replace(/[_-]/g, " ").replace(/\b\w/g, (x) => x.toUpperCase());
const dateLabel = (value: string | null) => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "Date unavailable";

export default function ProgressAchievementCenter() {
  const [data, setData] = useState<Data>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/student/achievements", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Could not load your achievements.");
      setData({ ...empty, ...json, summary: { ...empty.summary, ...(json.summary ?? {}) } });
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load your achievements."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const s = data.summary;

  return <main className="pa-page">
    <style>{`
      .pa-page{min-height:100vh;background:#f3f7fb;color:#13243b;padding:clamp(18px,4vw,42px);font-family:Arial,Helvetica,sans-serif}.pa-wrap{max-width:1180px;margin:auto}.pa-hero{background:linear-gradient(120deg,#0b1e3a,#123e5c);border-radius:22px;padding:clamp(22px,4vw,38px);color:white;display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap}.pa-kicker{color:#70e4f4;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}.pa-hero h1{font-size:clamp(28px,4vw,42px);letter-spacing:-.04em;margin:10px 0}.pa-hero p{color:#d5e5f0;line-height:1.6;max-width:680px;margin:0}.pa-btn{display:inline-flex;align-items:center;justify-content:center;padding:11px 15px;border:1px solid #cbd5e1;border-radius:11px;background:white;color:#13243b;text-decoration:none;font-size:13px;font-weight:800;cursor:pointer}.pa-btn.primary{background:#00b4d8;border-color:#00b4d8;color:#06243a}.pa-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:13px;margin:18px 0}.pa-stat,.pa-panel{background:white;border:1px solid #e0e8f0;border-radius:17px;padding:20px;box-shadow:0 7px 22px #0b1e3a08}.pa-label{font-size:12px;color:#64748b;font-weight:700}.pa-value{font-size:31px;font-weight:800;letter-spacing:-.04em;margin:10px 0 4px}.pa-note{font-size:12px;color:#718096}.pa-layout{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(280px,.8fr);gap:17px}.pa-panel{margin-bottom:17px}.pa-panel h2{font-size:18px;margin:0 0 7px}.pa-muted{color:#64748b;font-size:13px;line-height:1.55;margin:0 0 16px}.pa-row{padding:15px 0;border-top:1px solid #edf2f7}.pa-row:first-of-type{border-top:0}.pa-rowhead{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.pa-rowtitle{font-size:13px;font-weight:800;margin-bottom:5px}.pa-small{font-size:11px;color:#64748b}.pa-track{height:8px;background:#e8eef5;border-radius:20px;overflow:hidden;margin:11px 0 7px}.pa-fill{height:100%;background:linear-gradient(90deg,#00b4d8,#0b789b);border-radius:20px}.pa-badge{display:inline-flex;padding:5px 8px;border-radius:99px;background:#edf7fb;color:#087f9e;font-size:10px;font-weight:800;text-transform:uppercase;white-space:nowrap}.pa-badge.good{background:#e9f8ef;color:#187345}.pa-badge.warn{background:#fff5df;color:#996500}.pa-skills{display:grid;gap:14px}.pa-skillhead{display:flex;justify-content:space-between;gap:10px;font-size:13px;font-weight:700}.pa-links{display:grid;grid-template-columns:1fr 1fr;gap:9px}.pa-link{border:1px solid #e0e8f0;border-radius:12px;padding:13px;color:#13243b;text-decoration:none;font-size:13px;font-weight:800}.pa-link span{display:block;color:#64748b;font-size:11px;font-weight:400;line-height:1.5;margin-top:5px}.pa-empty{background:#f8fafc;border-radius:12px;padding:20px;text-align:center;color:#64748b;font-size:13px;line-height:1.6}.pa-notice{background:#fff7e6;color:#875a00;border:1px solid #f4dfac;border-radius:11px;padding:12px 14px;margin:12px 0;font-size:12px;line-height:1.5}.pa-error{background:#fff1f2;color:#9f1239;border:1px solid #fecdd3;padding:13px;border-radius:11px;margin:14px 0}.pa-foot{font-size:11px;color:#718096;line-height:1.55;margin-top:14px}@media(max-width:850px){.pa-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.pa-layout{grid-template-columns:1fr}}@media(max-width:480px){.pa-stat,.pa-panel{padding:15px}.pa-value{font-size:25px}.pa-links{grid-template-columns:1fr 1fr}}
    `}</style>
    <div className="pa-wrap">
      <header className="pa-hero"><div><div className="pa-kicker">RuffNeck Learn · Your learning record</div><h1>Progress & Achievement Center</h1><p>Track learning progress, practical work, recorded skills, and certificates in one place. This view reflects records available to your account.</p></div><button className="pa-btn primary" onClick={() => void load()} disabled={loading}>{loading ? "Refreshing…" : "Refresh progress"}</button></header>
      {error && <div className="pa-error" role="alert">{error} <button className="pa-btn" onClick={() => void load()}>Try again</button></div>}
      {loading && !error && <div className="pa-empty" style={{ marginTop: 16 }}>Loading your learning record…</div>}
      {!loading && <>
        <section className="pa-stats" aria-label="Achievement summary">
          <Stat label="Courses enrolled" value={s.enrolledCourses} note={`${s.completedCourses} completed`} />
          <Stat label="Average progress" value={`${s.averageProgress}%`} note="Across recorded enrolments" />
          <Stat label="Certificates" value={s.certificates} note="Issued certificate records" />
          <Stat label="Practical work" value={s.projectSubmissions} note={`${s.approvedProjects} approved`} />
        </section>
        {data.notices.map((notice, i) => <div className="pa-notice" key={`${notice}-${i}`}>{notice}</div>)}
        <div className="pa-layout"><div>
          <section className="pa-panel"><h2>Learning journey</h2><p className="pa-muted">Continue active courses and build steady progress.</p>
            {data.courses.length ? data.courses.map(course => { const pct = Math.max(0, Math.min(100, course.progressPercent)); return <div className="pa-row" key={course.id}><div className="pa-rowhead"><div><div className="pa-rowtitle">{course.title}</div><div className="pa-small">{course.completedLessons} completed lesson records · {label(course.status)}</div></div><strong>{pct}%</strong></div><div className="pa-track"><div className="pa-fill" style={{ width: `${pct}%` }} /></div>{course.slug && <Link href={`/courses/${course.slug}`} className="pa-small" style={{ color: "#087f9e", fontWeight: 800 }}>Continue course →</Link>}</div>; }) : <div className="pa-empty">Your enrolled courses will appear here once enrolment records are available.</div>}
          </section>
          <section className="pa-panel"><h2>Practical achievements</h2><p className="pa-muted">A record of practical submissions and their current review status.</p>
            {data.projects.length ? data.projects.map(project => <div className="pa-row" key={project.id}><div className="pa-rowhead"><div><div className="pa-rowtitle">Practical submission</div><div className="pa-small">{dateLabel(project.createdAt)}{project.score !== null ? ` · Score: ${project.score}` : ""}</div></div><span className={`pa-badge ${["approved","completed","passed"].includes(project.status.toLowerCase()) ? "good" : "warn"}`}>{label(project.status)}</span></div></div>) : <div className="pa-empty">Practical submissions will appear here when records are available.</div>}
          </section>
          <section className="pa-panel"><h2>Certificates</h2><p className="pa-muted">Certificates recorded for your account.</p>
            {data.certificates.length ? data.certificates.map(certificate => <div className="pa-row" key={certificate.id}><div className="pa-rowhead"><div><div className="pa-rowtitle">Course certificate</div><div className="pa-small">{certificate.number ? `Certificate number: ${certificate.number} · ` : ""}{dateLabel(certificate.issuedAt)}</div></div><span className="pa-badge good">Issued</span></div></div>) : <div className="pa-empty">No certificate records were returned. Complete the course requirements to qualify for a certificate.</div>}
          </section>
        </div><div>
          <section className="pa-panel"><h2>Skills in progress</h2><p className="pa-muted">Scores and levels shown here come from saved skill-profile records.</p>
            {data.skills.length ? <div className="pa-skills">{data.skills.map(skill => { const score = skill.score === null ? null : Math.max(0, Math.min(100, skill.score)); return <div key={skill.id}><div className="pa-skillhead"><span>{skill.name}</span><span className="pa-badge">{score === null ? label(skill.level) : `${score}%`}</span></div>{score !== null && <div className="pa-track"><div className="pa-fill" style={{ width: `${score}%` }} /></div>}<div className="pa-small">{label(skill.level)}</div></div>; })}</div> : <div className="pa-empty">Skill profile records are not available yet. Keep completing lessons, assessments, and practical work.</div>}
          </section>
          <section className="pa-panel"><h2>Keep moving forward</h2><p className="pa-muted">Open a learning tool to build your next piece of evidence.</p><div className="pa-links"><Link className="pa-link" href="/student/courses">My learning<span>Continue courses and lessons.</span></Link><Link className="pa-link" href="/student/labs">Practical labs<span>Apply knowledge to tasks.</span></Link><Link className="pa-link" href="/student/practice-studio">Practice Studio<span>Practise professional skills.</span></Link><Link className="pa-link" href="/student/portfolio">Portfolio<span>Showcase your work.</span></Link><Link className="pa-link" href="/student/competencies">Competencies<span>Review your skill profile.</span></Link><Link className="pa-link" href="/student/learning-path">Learning path<span>Choose a next step.</span></Link></div><p className="pa-foot">This center reports saved records only. It does not alter course progression rules, grade official course assessments, or issue certificates.</p></section>
        </div></div>
      </>}
    </div>
  </main>;
}

function Stat({ label, value, note }: { label: string; value: string | number; note: string }) { return <div className="pa-stat"><div className="pa-label">{label}</div><div className="pa-value">{value}</div><div className="pa-note">{note}</div></div>; }
