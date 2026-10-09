"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Recommendation = { type: string; title: string; reason: string; action: string; href: string };
type Course = { id: string; title: string; slug: string; progress: number; level: string; enrollmentStatus: string };
type Skill = { id: string; name: string; score: number | null; level: string };
type PathData = {
  overview: { enrolledCourses: number; coursesInProgress: number; completedCourses: number; skillsTracked: number; projectsSubmitted: number; approvedProjects: number };
  recommendations: Recommendation[]; courses: Course[]; skills: Skill[]; notices: string[];
};

const emptyData: PathData = { overview: { enrolledCourses: 0, coursesInProgress: 0, completedCourses: 0, skillsTracked: 0, projectsSubmitted: 0, approvedProjects: 0 }, recommendations: [], courses: [], skills: [], notices: [] };

export default function PersonalizedLearningPath() {
  const [data, setData] = useState<PathData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/student/learning-path", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not load your learning path.");
        return payload as PathData;
      })
      .then((payload) => { if (active) setData(payload); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load your learning path."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return <main className="rlp-shell">
    <style>{`
      .rlp-shell{--navy:#0b1e3a;--cyan:#00b4d8;--gold:#fbbf24;max-width:1160px;margin:0 auto;padding:30px 20px 54px;color:#17263d}
      .rlp-hero{background:linear-gradient(125deg,#0b1e3a,#12365c);color:#fff;border-radius:24px;padding:clamp(24px,4vw,42px);position:relative;overflow:hidden}
      .rlp-hero:after{content:"";position:absolute;width:260px;height:260px;border:1px solid #ffffff20;border-radius:50%;right:-85px;top:-110px;box-shadow:0 0 0 30px #ffffff08,0 0 0 65px #ffffff06;pointer-events:none}
      .rlp-kicker{color:#76e7f5;font-size:12px;font-weight:800;letter-spacing:.13em;text-transform:uppercase}.rlp-hero h1{font-size:clamp(28px,4vw,42px);line-height:1.12;max-width:680px;margin:12px 0}.rlp-hero p{max-width:700px;color:#d5e4f4;line-height:1.7;margin:0}
      .rlp-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:18px 0 28px}.rlp-stat,.rlp-panel{border:1px solid #e0e7ef;border-radius:18px;background:#fff;box-shadow:0 8px 24px #0b1e3a08}.rlp-stat{padding:17px}.rlp-stat strong{display:block;font-size:27px;color:#0b1e3a}.rlp-stat span{display:block;color:#637187;font-size:13px;margin-top:5px}
      .rlp-section-title{font-size:22px;color:#0b1e3a;margin:28px 0 14px}.rlp-recs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.rlp-rec{padding:20px;display:flex;flex-direction:column;min-height:210px}.rlp-tag{display:inline-flex;align-self:flex-start;background:#e7faff;color:#087d97;padding:6px 9px;border-radius:999px;font-size:11px;font-weight:800}.rlp-rec h3{margin:13px 0 8px;font-size:18px;color:#0b1e3a}.rlp-rec p{color:#65748a;font-size:14px;line-height:1.65;margin:0 0 18px}.rlp-action{margin-top:auto;align-self:flex-start;text-decoration:none;background:#0b1e3a;color:#fff;border-radius:10px;padding:10px 13px;font-weight:700;font-size:13px}.rlp-action:hover{background:#123e68}.rlp-columns{display:grid;grid-template-columns:1.2fr .8fr;gap:16px}.rlp-panel{padding:20px;min-width:0}.rlp-panel h2{font-size:19px;color:#0b1e3a;margin:0 0 15px}.rlp-course{padding:14px 0;border-top:1px solid #edf1f6}.rlp-course:first-of-type{border-top:0}.rlp-course-head{display:flex;justify-content:space-between;gap:12px;align-items:start}.rlp-course a{font-weight:750;color:#0b1e3a;text-decoration:none}.rlp-muted{font-size:12px;color:#718096}.rlp-track{height:7px;background:#e8edf3;border-radius:99px;overflow:hidden;margin-top:10px}.rlp-track span{display:block;height:100%;background:linear-gradient(90deg,#00b4d8,#1b8dbe);border-radius:99px}.rlp-skill{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid #edf1f6}.rlp-skill:first-of-type{border-top:0}.rlp-score{font-weight:800;color:#0b1e3a;white-space:nowrap}.rlp-notice{background:#fff8e1;color:#74550b;padding:11px 13px;border-radius:10px;margin-top:12px;font-size:13px}.rlp-error{background:#fff0f0;color:#9c2222;border-radius:12px;padding:15px;margin-top:18px}.rlp-empty{color:#718096;font-size:14px;line-height:1.7}.rlp-bottom-links{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}.rlp-bottom-links a{border:1px solid #dbe4ee;color:#0b1e3a;text-decoration:none;padding:10px 13px;border-radius:10px;font-size:13px;font-weight:700}
      @media(max-width:760px){.rlp-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.rlp-recs,.rlp-columns{grid-template-columns:1fr}.rlp-shell{padding:18px 14px 40px}.rlp-rec{min-height:unset}}
    `}</style>
    <section className="rlp-hero">
      <div className="rlp-kicker">RuffNeck Learn · Your development plan</div>
      <h1>Your next step, based on your learning progress.</h1>
      <p>Use this personalized path to decide what to study next, practise skills that need attention, and turn course learning into practical evidence. Recommendations are generated from the learning records currently available to your account.</p>
    </section>

    {error && <div className="rlp-error">{error} <button onClick={() => { setLoading(true); setError(""); fetch("/api/student/learning-path", { cache: "no-store" }).then(async r => { const p = await r.json(); if (!r.ok) throw new Error(p.error || "Request failed"); setData(p); }).catch(e => setError(e instanceof Error ? e.message : "Request failed")).finally(() => setLoading(false)); }} style={{ marginLeft: 10, cursor: "pointer" }}>Retry</button></div>}

    <section className="rlp-stats" aria-label="Learning summary">
      {[[data.overview.enrolledCourses,"Enrolled courses"],[data.overview.coursesInProgress,"In progress"],[data.overview.completedCourses,"Completed courses"],[data.overview.approvedProjects,"Approved projects"]].map(([value,label]) => <div className="rlp-stat" key={String(label)}><strong>{loading ? "—" : value}</strong><span>{label}</span></div>)}
    </section>

    <h2 className="rlp-section-title">Recommended next steps</h2>
    {loading ? <div className="rlp-panel rlp-empty">Building your learning path…</div> : data.recommendations.length ? <div className="rlp-recs">{data.recommendations.map((rec, index) => <article className="rlp-panel rlp-rec" key={`${rec.title}-${index}`}><span className="rlp-tag">{rec.type}</span><h3>{rec.title}</h3><p>{rec.reason}</p><Link className="rlp-action" href={rec.href}>{rec.action} →</Link></article>)}</div> : <div className="rlp-panel rlp-empty">There is not enough learning activity to generate detailed recommendations yet. Start a course or complete a practical lab to build your path.</div>}

    <div className="rlp-columns" style={{ marginTop: 18 }}>
      <section className="rlp-panel"><h2>Your active courses</h2>{data.courses.length ? data.courses.map((course) => <div className="rlp-course" key={course.id}><div className="rlp-course-head"><div><Link href={course.slug ? `/courses/${course.slug}` : "/student/learning"}>{course.title}</Link><div className="rlp-muted" style={{ marginTop: 4 }}>{course.level}</div></div><strong className="rlp-score">{course.progress}%</strong></div><div className="rlp-track"><span style={{ width: `${course.progress}%` }} /></div></div>) : <p className="rlp-empty">No enrolled courses were returned. Visit My Learning to explore courses available to your account.</p>}<div className="rlp-bottom-links"><Link href="/student/learning">My Learning</Link><Link href="/courses">Browse Courses</Link></div></section>
      <section className="rlp-panel"><h2>Skills to keep developing</h2>{data.skills.length ? data.skills.map((skill) => <div className="rlp-skill" key={skill.id}><div><strong>{skill.name}</strong><div className="rlp-muted" style={{ marginTop: 4 }}>{skill.level}</div></div><span className="rlp-score">{skill.score === null ? "—" : `${skill.score}%`}</span></div>) : <p className="rlp-empty">Detailed skill scores are not available yet. Continue assessments and practical work to build a stronger evidence base.</p>}<div className="rlp-bottom-links"><Link href="/student/competencies">Competency Dashboard</Link><Link href="/student/labs">Practical Labs</Link></div></section>
    </div>
    {data.notices.map((notice) => <div className="rlp-notice" key={notice}>{notice}</div>)}
  </main>;
}
