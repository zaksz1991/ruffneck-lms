"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type CoachMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
};

type Props = {
  courseTitle?: string;
};

const STARTERS = [
  "Explain this concept in simple terms.",
  "Give me a practical example from a Nigerian workplace.",
  "Quiz me on what I have learned.",
  "Help me understand where I made a mistake.",
];

export default function AIStudyCoach({ courseTitle = "General learning" }: Props) {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/student/ai-study-coach", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load your study conversation.");
      setMessages(Array.isArray(payload.messages) ? payload.messages : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your study conversation.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadHistory(); }, [loadHistory]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, sending]);

  async function sendMessage(event?: FormEvent, suggested?: string) {
    event?.preventDefault();
    const question = (suggested ?? input).trim();
    if (!question || sending) return;
    setInput("");
    setError("");
    setMessages((current) => [...current, { id: `pending-${Date.now()}`, role: "user", content: question }]);
    setSending(true);
    try {
      const response = await fetch("/api/student/ai-study-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, courseTitle }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "The study coach could not answer. Please try again.");
      if (Array.isArray(payload.messages)) setMessages(payload.messages);
      else if (payload.answer) setMessages((current) => [...current, { id: `answer-${Date.now()}`, role: "assistant", content: payload.answer }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The study coach could not answer. Please try again.");
      await loadHistory();
    } finally {
      setSending(false);
    }
  }

  async function clearConversation() {
    if (!window.confirm("Clear your saved Study Coach conversation? This cannot be undone.")) return;
    setError("");
    try {
      const response = await fetch("/api/student/ai-study-coach", { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not clear the conversation.");
      setMessages([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not clear the conversation.");
    }
  }

  return (
    <section className="asc-wrap" aria-label="AI Study Coach">
      <style>{`
        .asc-wrap{--asc-navy:#0b1e3a;--asc-cyan:#00b4d8;color:#17243a;max-width:1000px;margin:0 auto;font-family:inherit}
        .asc-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:22px;border-radius:18px;background:linear-gradient(125deg,#0b1e3a,#12365b);color:#fff}
        .asc-head h2{margin:0 0 7px;font-size:clamp(1.25rem,3vw,1.8rem)}.asc-head p{margin:0;color:#d5e6f6;line-height:1.55;font-size:.94rem}
        .asc-tag{display:inline-flex;margin-bottom:10px;padding:5px 9px;border-radius:999px;background:#00b4d826;color:#85edff;font-size:.75rem;font-weight:700;letter-spacing:.04em}
        .asc-clear{border:1px solid #ffffff55;background:transparent;color:white;border-radius:9px;padding:9px 11px;cursor:pointer;white-space:nowrap}
        .asc-card{margin-top:16px;border:1px solid #dce5ef;border-radius:16px;background:white;overflow:hidden}.asc-context{padding:12px 17px;border-bottom:1px solid #e6edf4;background:#f7fafc;color:#53657a;font-size:.86rem}
        .asc-chat{height:min(52vh,520px);min-height:280px;overflow-y:auto;padding:18px;display:flex;flex-direction:column;gap:14px}
        .asc-empty{margin:auto;max-width:560px;text-align:center;padding:20px 8px}.asc-empty h3{margin:0 0 8px;color:#0b1e3a}.asc-empty p{margin:0;color:#65758a;line-height:1.6}
        .asc-starters{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:20px}.asc-starters button{padding:11px;border:1px solid #cfe1ed;border-radius:10px;background:#f5fbfd;color:#153b55;text-align:left;cursor:pointer;line-height:1.4}.asc-starters button:hover{border-color:#00b4d8;background:#eafaff}
        .asc-msg{max-width:86%;padding:12px 14px;border-radius:14px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere}.asc-msg.user{align-self:flex-end;background:#0b1e3a;color:#fff;border-bottom-right-radius:4px}.asc-msg.assistant{align-self:flex-start;background:#f0f6fa;border:1px solid #e1ebf2;color:#1e3044;border-bottom-left-radius:4px}.asc-role{display:block;font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;opacity:.72;margin-bottom:4px}
        .asc-error{margin:12px 16px;padding:10px 12px;border:1px solid #f2c4c4;background:#fff4f4;color:#8b2020;border-radius:9px;font-size:.9rem}.asc-compose{padding:14px;border-top:1px solid #e6edf4;display:flex;gap:10px;align-items:flex-end}.asc-compose textarea{resize:vertical;min-height:48px;max-height:150px;flex:1;border:1px solid #cbd7e3;border-radius:11px;padding:12px;font:inherit;line-height:1.4;outline:none}.asc-compose textarea:focus{border-color:#00a9cb;box-shadow:0 0 0 3px #00b4d81c}.asc-send{min-height:46px;padding:0 18px;border:0;border-radius:10px;background:#00b4d8;color:#06243a;font-weight:800;cursor:pointer}.asc-send:disabled{opacity:.5;cursor:not-allowed}.asc-note{padding:0 16px 14px;color:#68788b;font-size:.78rem;line-height:1.5}.asc-loading{color:#64748b;margin:auto}
        @media(max-width:560px){.asc-head{padding:17px;flex-direction:column}.asc-clear{align-self:flex-start}.asc-chat{padding:12px;min-height:300px}.asc-starters{grid-template-columns:1fr}.asc-msg{max-width:94%}.asc-compose{padding:10px;gap:7px}.asc-send{padding:0 12px}}
      `}</style>
      <header className="asc-head">
        <div><span className="asc-tag">RUFFNECK LEARN · AI SUPPORT</span><h2>AI Study Coach</h2><p>Ask questions, practise a skill, or get a difficult concept explained step by step.</p></div>
        <button className="asc-clear" type="button" onClick={clearConversation} disabled={loading || sending || messages.length === 0}>Clear chat</button>
      </header>
      <div className="asc-card">
        <div className="asc-context">Learning context: <strong>{courseTitle}</strong></div>
        <div className="asc-chat" ref={scrollRef} aria-live="polite">
          {loading ? <div className="asc-loading">Loading your conversation…</div> : messages.length === 0 ? (
            <div className="asc-empty"><h3>What are you working on?</h3><p>Ask for a clear explanation, a practical example, a practice question, or feedback on your reasoning.</p><div className="asc-starters">{STARTERS.map((starter) => <button type="button" key={starter} disabled={sending} onClick={() => void sendMessage(undefined, starter)}>{starter}</button>)}</div></div>
          ) : messages.map((message) => <div className={`asc-msg ${message.role}`} key={message.id}><span className="asc-role">{message.role === "user" ? "You" : "Study Coach"}</span>{message.content}</div>)}
          {sending && <div className="asc-msg assistant"><span className="asc-role">Study Coach</span>Thinking through your question…</div>}
        </div>
        {error && <div className="asc-error" role="alert">{error}</div>}
        <form className="asc-compose" onSubmit={(event) => void sendMessage(event)}><textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask a question or describe what you want to practise…" maxLength={4000} disabled={sending || loading} aria-label="Your question"/><button className="asc-send" type="submit" disabled={sending || loading || !input.trim()}>Send</button></form>
        <div className="asc-note">Use the coach to support your learning, not to replace course assessments. Check important facts against course materials and trusted sources. Do not submit passwords, financial details, or other sensitive personal information.</div>
      </div>
    </section>
  );
}
