"use client";

import { useState } from "react";

type Message = { role: "interviewer" | "candidate" | "coach"; text: string };
type ApiResponse = { ok?: boolean; question?: string; feedback?: string; error?: string };

const styles = `
.aisim{--navy:#0b1e3a;--cyan:#00b4d8;color:#eaf2ff;max-width:1050px;margin:0 auto;padding:24px;font-family:inherit}
.aisim *{box-sizing:border-box}.aisim-head{background:linear-gradient(135deg,#0b1e3a,#123a5c);border:1px solid #244a6b;border-radius:20px;padding:26px;margin-bottom:18px}.aisim-kicker{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#67dff4;font-weight:800}.aisim h1{font-size:clamp(25px,4vw,34px);margin:8px 0;color:white}.aisim p{line-height:1.6}.aisim-grid{display:grid;grid-template-columns:300px minmax(0,1fr);gap:18px}.aisim-panel{background:#0d2039;border:1px solid #233e5c;border-radius:16px;padding:18px;min-width:0}.aisim label{display:block;font-size:13px;font-weight:700;color:#c8d7eb;margin:13px 0 6px}.aisim input,.aisim select,.aisim textarea{width:100%;background:#071629;color:#f3f7ff;border:1px solid #36516d;border-radius:10px;padding:11px;font:inherit}.aisim textarea{min-height:120px;resize:vertical}.aisim button{border:0;border-radius:10px;padding:11px 14px;font:inherit;font-weight:750;cursor:pointer}.aisim button:disabled{opacity:.5;cursor:wait}.aisim-primary{background:#00b4d8;color:#062036}.aisim-secondary{background:#193550;color:#eaf2ff;border:1px solid #36516d!important}.aisim-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:13px}.aisim-chat{display:flex;flex-direction:column;gap:12px;min-height:260px}.aisim-msg{padding:13px 14px;border-radius:13px;white-space:pre-wrap;line-height:1.6}.aisim-msg.interviewer{background:#132e4b;border:1px solid #294a6a}.aisim-msg.candidate{background:#083b49;border:1px solid #08738a}.aisim-msg.coach{background:#292746;border:1px solid #514d80}.aisim-role{display:block;text-transform:uppercase;letter-spacing:.08em;font-size:10px;font-weight:800;opacity:.75;margin-bottom:5px}.aisim-error{background:#4a1e29;color:#ffdce2;border:1px solid #8a3a4a;border-radius:10px;padding:11px;margin-top:12px}.aisim-muted{color:#aabbd0;font-size:13px}.aisim-tag{display:inline-block;border:1px solid #2d5674;border-radius:999px;padding:5px 9px;font-size:12px;color:#9ceafb;margin:4px 4px 0 0}@media(max-width:760px){.aisim{padding:14px}.aisim-grid{grid-template-columns:1fr}.aisim-head{padding:20px}}
`;

export default function AIInterviewSimulator() {
  const [role, setRole] = useState("Administrative Officer");
  const [level, setLevel] = useState("Entry level");
  const [interviewType, setInterviewType] = useState("Behavioural and competency");
  const [context, setContext] = useState("");
  const [answer, setAnswer] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [turn, setTurn] = useState(0);

  async function requestCoach(action: "start" | "feedback" | "next") {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/student/ai-interview-simulator", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, role, level, interviewType, context, question, answer, previousQuestions: messages.filter(m => m.role === "interviewer").map(m => m.text).slice(-8) })
      });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || "The interview coach could not complete the request.");
      if (action === "feedback") {
        setMessages(prev => [...prev, { role: "candidate", text: answer.trim() }, { role: "coach", text: data.feedback || "No feedback was returned." }]);
        setAnswer("");
      } else {
        const nextQuestion = data.question || "Tell me about a work challenge you handled and what you learned from it.";
        setQuestion(nextQuestion);
        setMessages(prev => [...prev, { role: "interviewer", text: nextQuestion }]);
        setTurn(n => n + 1);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Unexpected error. Please try again."); }
    finally { setBusy(false); }
  }

  function reset() { setMessages([]); setQuestion(""); setAnswer(""); setTurn(0); setError(""); }

  return <div className="aisim"><style>{styles}</style>
    <header className="aisim-head"><div className="aisim-kicker">RuffNeck Learn · Career readiness</div><h1>AI Interview Simulator</h1><p>Practise realistic interview questions, structure your answers, and receive actionable feedback before a real interview.</p><span className="aisim-tag">Role-specific practice</span><span className="aisim-tag">STAR answer guidance</span><span className="aisim-tag">Skills to improve</span></header>
    <div className="aisim-grid"><aside className="aisim-panel"><h2 style={{marginTop:0}}>Interview setup</h2>
      <label htmlFor="aisim-role">Target role</label><input id="aisim-role" value={role} onChange={e=>setRole(e.target.value)} maxLength={120} placeholder="e.g. Data Analyst" />
      <label htmlFor="aisim-level">Experience level</label><select id="aisim-level" value={level} onChange={e=>setLevel(e.target.value)}><option>Entry level</option><option>Early career</option><option>Mid-level</option><option>Senior</option><option>Career change</option></select>
      <label htmlFor="aisim-type">Interview focus</label><select id="aisim-type" value={interviewType} onChange={e=>setInterviewType(e.target.value)}><option>Behavioural and competency</option><option>Technical</option><option>Situational judgement</option><option>General HR</option><option>Client or freelance work</option></select>
      <label htmlFor="aisim-context">Job description or skills (optional)</label><textarea id="aisim-context" value={context} onChange={e=>setContext(e.target.value)} maxLength={3000} placeholder="Paste key responsibilities or skills to practise against." />
      <div className="aisim-actions"><button className="aisim-primary" disabled={busy||!role.trim()} onClick={()=>requestCoach(messages.length ? "next":"start")}>{busy?"Working…":messages.length?"Ask next question":"Start interview"}</button><button className="aisim-secondary" disabled={busy} onClick={reset}>Reset</button></div>
      <p className="aisim-muted">Practice only. Feedback is AI-generated and may be imperfect; verify technical or industry-specific guidance.</p>
    </aside>
    <main className="aisim-panel"><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}><h2 style={{marginTop:0}}>Practice session</h2><span className="aisim-muted">Question {turn}</span></div>
      {messages.length===0?<div className="aisim-muted" style={{padding:"30px 8px",textAlign:"center"}}>Choose your role and interview focus, then select <strong>Start interview</strong>. The coach will ask one question at a time.</div>:<div className="aisim-chat" aria-live="polite">{messages.map((m,i)=><div key={i} className={`aisim-msg ${m.role}`}><span className="aisim-role">{m.role === "interviewer" ? "Interviewer" : m.role === "candidate" ? "Your answer" : "Coach feedback"}</span>{m.text}</div>)}</div>}
      {question && <><label htmlFor="aisim-answer">Your answer</label><textarea id="aisim-answer" value={answer} onChange={e=>setAnswer(e.target.value)} maxLength={6000} placeholder="Answer as if you were speaking to an interviewer. Use a real example when possible." />
        <div className="aisim-actions"><button className="aisim-primary" disabled={busy||!answer.trim()} onClick={()=>requestCoach("feedback")}>{busy?"Reviewing…":"Review my answer"}</button><button className="aisim-secondary" disabled={busy} onClick={()=>requestCoach("next")}>Skip to next question</button></div>
      </>}
      {error && <div className="aisim-error" role="alert">{error}</div>}
    </main></div>
  </div>;
}
