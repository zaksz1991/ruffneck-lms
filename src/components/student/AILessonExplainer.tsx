"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Mode = "explain" | "example" | "quiz" | "simplify";
type Message = { id: string; role: "user" | "assistant"; text: string; mode?: Mode; createdAt: string };

type Props = {
  courseTitle: string;
  lessonTitle: string;
  lessonContent: string;
  lessonKey?: string;
};

const STORAGE_PREFIX = "ruffneck-ai-lesson-explainer-v1";
const ACTIONS: Array<{ mode: Mode; label: string; prompt: string }> = [
  { mode: "explain", label: "Explain a concept", prompt: "Explain the main concept of this lesson step by step." },
  { mode: "example", label: "Show a practical example", prompt: "Give me a practical worked example based on this lesson." },
  { mode: "quiz", label: "Practise with a quiz", prompt: "Start a short practice quiz based on this lesson." },
  { mode: "simplify", label: "Simplify it", prompt: "Explain this lesson in plain language for a beginner." },
];

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function AILessonExplainer({ courseTitle, lessonTitle, lessonContent, lessonKey }: Props) {
  const storageKey = useMemo(() => `${STORAGE_PREFIX}:${lessonKey || lessonTitle}`, [lessonKey, lessonTitle]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<Mode>("explain");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      setMessages(saved ? (JSON.parse(saved) as Message[]) : []);
    } catch {
      setMessages([]);
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(messages.slice(-40)));
    } catch {
      // The tutor remains usable if local storage is unavailable or full.
    }
  }, [messages, storageKey]);

  async function sendMessage(text: string, selectedMode: Mode = mode) {
    const cleanQuestion = text.trim();
    if (!cleanQuestion || busy) return;
    if (!lessonContent.trim()) {
      setError("This page has not supplied lesson content to the explainer yet.");
      return;
    }

    setError("");
    setBusy(true);
    setQuestion("");
    const userMessage: Message = { id: makeId(), role: "user", text: cleanQuestion, mode: selectedMode, createdAt: new Date().toISOString() };
    setMessages((current) => [...current, userMessage]);

    try {
      const response = await fetch("/api/student/ai-lesson-explainer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseTitle, lessonTitle, lessonContent, question: cleanQuestion, mode: selectedMode }),
      });
      const data = await response.json().catch(() => ({})) as { answer?: string; error?: string };
      if (!response.ok || !data.answer) throw new Error(data.error || "The AI tutor could not respond. Please try again.");
      setMessages((current) => [...current, { id: makeId(), role: "assistant", text: data.answer!, mode: selectedMode, createdAt: new Date().toISOString() }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to contact the AI tutor. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(question);
  }

  function clearConversation() {
    setMessages([]);
    setError("");
    try { window.localStorage.removeItem(storageKey); } catch { /* Ignore storage failures. */ }
  }

  return (
    <section className="ale-root" aria-labelledby="ale-title">
      <style jsx>{`
        .ale-root{--ale-navy:#0b1e3a;--ale-cyan:#00b4d8;color:#172033;border:1px solid #dbe5ef;border-radius:18px;background:#fff;overflow:hidden;box-shadow:0 12px 35px rgba(11,30,58,.07)}
        .ale-head{padding:22px 24px;background:linear-gradient(120deg,#0b1e3a,#123a61);color:#fff}.ale-head h2{margin:0;font-size:1.2rem}.ale-head p{margin:7px 0 0;color:#d5e7f4;font-size:.9rem;line-height:1.5}.ale-context{font-size:.8rem;color:#b9eefa;margin-top:10px}
        .ale-actions{display:flex;flex-wrap:wrap;gap:8px;padding:14px 18px;border-bottom:1px solid #e5edf4}.ale-action{border:1px solid #c8d8e5;background:#f7fbfd;border-radius:999px;padding:8px 12px;color:#14304d;font-size:.82rem;cursor:pointer}.ale-action:hover{border-color:#00b4d8;background:#eefbfe}.ale-action:disabled{opacity:.5;cursor:not-allowed}
        .ale-chat{display:flex;flex-direction:column;gap:12px;min-height:190px;max-height:460px;overflow:auto;padding:18px;background:#f8fafc}.ale-empty{padding:30px 16px;text-align:center;color:#62748a;font-size:.92rem;line-height:1.6}.ale-message{max-width:92%;padding:12px 14px;border-radius:14px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6;font-size:.92rem}.ale-user{align-self:flex-end;background:#dff8fc;border:1px solid #b5edf6}.ale-assistant{align-self:flex-start;background:#fff;border:1px solid #dce6ef}.ale-role{display:block;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#536a80;margin-bottom:5px}.ale-error{margin:12px 18px 0;padding:10px 12px;border:1px solid #fecaca;background:#fff1f2;color:#991b1b;border-radius:10px;font-size:.88rem}.ale-form{padding:16px 18px 18px;border-top:1px solid #e5edf4}.ale-select{width:100%;max-width:210px;border:1px solid #cbd5e1;border-radius:9px;padding:8px;background:#fff;color:#172033;margin-bottom:10px}.ale-compose{display:flex;gap:9px;align-items:stretch}.ale-input{flex:1;min-width:0;resize:vertical;min-height:48px;max-height:140px;padding:12px;border:1px solid #cbd5e1;border-radius:10px;font:inherit;color:#172033}.ale-send{border:0;border-radius:10px;background:#00b4d8;color:#06243a;font-weight:700;padding:0 18px;cursor:pointer}.ale-send:disabled{opacity:.55;cursor:not-allowed}.ale-footer{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-top:10px;font-size:.76rem;color:#64748b}.ale-clear{border:0;background:transparent;color:#38556f;text-decoration:underline;cursor:pointer;padding:4px}.ale-clear:disabled{opacity:.4;cursor:not-allowed}@media(max-width:520px){.ale-head{padding:18px}.ale-actions{padding:12px}.ale-chat{padding:12px}.ale-form{padding:14px}.ale-compose{flex-direction:column}.ale-send{min-height:44px}.ale-message{max-width:100%}}
      `}</style>
      <header className="ale-head">
        <h2 id="ale-title">AI Lesson Explainer</h2>
        <p>Ask about the lesson you are studying. Get clearer explanations, practical examples, or a short practice quiz.</p>
        <div className="ale-context">{courseTitle} · {lessonTitle}</div>
      </header>
      <div className="ale-actions" aria-label="Learning actions">
        {ACTIONS.map((action) => <button key={action.mode} type="button" className="ale-action" disabled={busy} onClick={() => { setMode(action.mode); void sendMessage(action.prompt, action.mode); }}>{action.label}</button>)}
      </div>
      <div className="ale-chat" aria-live="polite" aria-busy={busy}>
        {messages.length === 0 && !busy ? <div className="ale-empty">Start with one of the learning actions above, or ask a specific question below.<br />The tutor uses the lesson content supplied by this page.</div> : null}
        {messages.map((message) => <div key={message.id} className={`ale-message ${message.role === "user" ? "ale-user" : "ale-assistant"}`}><span className="ale-role">{message.role === "user" ? "You" : "AI tutor"}</span>{message.text}</div>)}
        {busy ? <div className="ale-message ale-assistant"><span className="ale-role">AI tutor</span>Preparing an explanation…</div> : null}
      </div>
      {error ? <div className="ale-error" role="alert">{error}</div> : null}
      <form className="ale-form" onSubmit={onSubmit}>
        <label htmlFor="ale-mode" className="ale-role">Answer style</label>
        <select id="ale-mode" className="ale-select" value={mode} onChange={(event) => setMode(event.target.value as Mode)} disabled={busy}>
          <option value="explain">Step-by-step explanation</option><option value="example">Practical example</option><option value="quiz">Practice quiz</option><option value="simplify">Beginner-friendly</option>
        </select>
        <div className="ale-compose">
          <textarea className="ale-input" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="What would you like explained?" maxLength={2000} rows={2} disabled={busy} aria-label="Your question" />
          <button className="ale-send" type="submit" disabled={busy || !question.trim()}>{busy ? "Working…" : "Ask tutor"}</button>
        </div>
        <div className="ale-footer"><span>Conversation history is saved in this browser only.</span><button type="button" className="ale-clear" onClick={clearConversation} disabled={busy || messages.length === 0}>Clear conversation</button></div>
      </form>
    </section>
  );
}
