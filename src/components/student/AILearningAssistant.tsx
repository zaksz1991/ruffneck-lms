"use client";

import { useEffect, useRef, useState } from "react";

type Course = { id: string; title: string; slug: string };
type Message = { role: "user" | "assistant"; content: string };

const quickPrompts = [
  { title: "Explain a concept", prompt: "Explain a difficult concept from my course in simple language, then give a practical example." },
  { title: "Show a worked example", prompt: "Give me a realistic step-by-step worked example related to my course." },
  { title: "Test my understanding", prompt: "Ask me 5 practice questions one at a time. Wait for my answer before revealing the explanation." },
  { title: "Make a study plan", prompt: "Create a realistic 7-day study plan for this course, with short daily activities and review checkpoints." },
];

export default function AILearningAssistant({ courses }: { courses: Course[] }) {
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [language, setLanguage] = useState("English");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedCourse = courses.find((course) => course.id === courseId);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function ask(promptOverride?: string) {
    const prompt = (promptOverride ?? question).trim();
    if (!prompt || busy) return;
    const nextMessages: Message[] = [...messages, { role: "user", content: prompt }];
    setMessages(nextMessages);
    setQuestion("");
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/student/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          language,
          message: prompt,
          history: messages.slice(-10).map((item) => ({ role: item.role, content: item.content })),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok || typeof data.answer !== "string") {
        throw new Error(data?.error || "The assistant could not respond. Please try again.");
      }
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);
    } catch (err) {
      setMessages((prev) => prev.filter((item, index) => !(index === prev.length - 1 && item.role === "user" && item.content === prompt)));
      setQuestion(prompt);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function resetChat() {
    if (busy) return;
    setMessages([]);
    setError("");
    setQuestion("");
  }

  return (
    <section className="rn-assistant-app">
      <aside className="rn-assistant-sidebar">
        <div className="rn-assistant-sidebar-heading"><span className="rn-assistant-sidebar-icon">✧</span><div><strong>Study companion</strong><small>AI-powered learning support</small></div></div>
        <label className="rn-assistant-field-label" htmlFor="assistant-course">LEARNING CONTEXT</label>
        <select id="assistant-course" value={courseId} onChange={(event) => { setCourseId(event.target.value); resetChat(); }}>
          {courses.map((course) => <option value={course.id} key={course.id}>{course.title}</option>)}
        </select>
        <label className="rn-assistant-field-label" htmlFor="assistant-language">RESPONSE LANGUAGE</label>
        <select id="assistant-language" value={language} onChange={(event) => setLanguage(event.target.value)}>
          <option>English</option><option>Hausa</option><option>Yoruba</option><option>Igbo</option>
        </select>
        <div className="rn-assistant-side-rule" />
        <div className="rn-assistant-sidebar-label">TRY A STARTER</div>
        <div className="rn-assistant-starters">
          {quickPrompts.map((item) => <button key={item.title} type="button" disabled={busy} onClick={() => ask(item.prompt)}><span>↗</span><span>{item.title}<small>{item.prompt.length > 68 ? `${item.prompt.slice(0, 65)}…` : item.prompt}</small></span></button>)}
        </div>
        <div className="rn-assistant-privacy"><span>▣</span><p><strong>Learn safely</strong><br />Avoid sharing passwords, private records, or sensitive personal information.</p></div>
      </aside>

      <div className="rn-assistant-chat">
        <div className="rn-assistant-chat-header"><div><span className="rn-assistant-online" /><div><strong>Learning assistant</strong><small>{selectedCourse?.title ?? "Course support"}</small></div></div><button type="button" onClick={resetChat} disabled={busy || !messages.length}>New chat ↺</button></div>
        <div className="rn-assistant-messages" ref={scrollRef}>
          {!messages.length ? (
            <div className="rn-assistant-welcome">
              <div className="rn-assistant-welcome-icon">✧</div>
              <span className="rn-assistant-welcome-kicker">YOUR LEARNING PARTNER</span>
              <h2>What would you like to understand?</h2>
              <p>Ask a course question, request a practical example, or practise a skill. The assistant will use your selected course as context.</p>
              <div className="rn-assistant-suggestion-grid">{quickPrompts.map((item) => <button type="button" key={item.title} disabled={busy} onClick={() => ask(item.prompt)}><strong>{item.title}</strong><span>{item.prompt}</span><b>↗</b></button>)}</div>
            </div>
          ) : messages.map((message, index) => (
            <div className={`rn-assistant-message ${message.role}`} key={`${index}-${message.role}`}>
              <div className="rn-assistant-avatar">{message.role === "assistant" ? "✧" : "Y"}</div>
              <div className="rn-assistant-message-body"><span className="rn-assistant-message-label">{message.role === "assistant" ? "RUFFNECK AI TUTOR" : "YOU"}</span><div className="rn-assistant-message-content">{message.content}</div></div>
            </div>
          ))}
          {busy ? <div className="rn-assistant-message assistant"><div className="rn-assistant-avatar">✧</div><div className="rn-assistant-thinking"><span /><span /><span /> <small>Preparing a learning-focused response…</small></div></div> : null}
        </div>
        {error ? <div className="rn-assistant-error" role="alert">{error}</div> : null}
        <form className="rn-assistant-composer" onSubmit={(event) => { event.preventDefault(); void ask(); }}>
          <textarea value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void ask(); } }} placeholder={`Ask anything about ${selectedCourse?.title ?? "your course"}…`} rows={2} maxLength={4000} aria-label="Ask the learning assistant" />
          <div className="rn-assistant-composer-bottom"><span>Enter to send · Shift + Enter for a new line</span><button type="submit" disabled={busy || !question.trim()}>{busy ? "Thinking…" : "Ask assistant"} <b>↑</b></button></div>
        </form>
        <div className="rn-assistant-disclaimer">AI can make mistakes. Verify important facts and follow your course materials and instructor guidance.</div>
      </div>
      <style>{`
        .rn-assistant-app{display:grid;grid-template-columns:285px minmax(0,1fr);margin-top:22px;min-height:600px;border:1px solid #1b3652;border-radius:20px;overflow:hidden;background:#09182a;box-shadow:0 22px 60px #02081444}.rn-assistant-sidebar{padding:22px 18px;background:#0b1d32;border-right:1px solid #1a334e}.rn-assistant-sidebar-heading{display:flex;gap:11px;align-items:center;margin-bottom:28px}.rn-assistant-sidebar-icon{width:39px;height:39px;display:grid;place-items:center;border:1px solid #23617b;border-radius:12px;background:#00b4d81c;color:#5fe3f4;font-size:22px}.rn-assistant-sidebar-heading strong,.rn-assistant-sidebar-heading small{display:block}.rn-assistant-sidebar-heading strong{font-size:12px;color:#e3f0fc}.rn-assistant-sidebar-heading small{font-size:9px;color:#7792ad;margin-top:4px}.rn-assistant-field-label,.rn-assistant-sidebar-label{display:block;font-size:9px;font-weight:800;letter-spacing:.13em;color:#6e8aa7;margin:18px 0 8px}.rn-assistant-sidebar select{width:100%;height:40px;border:1px solid #25425e;border-radius:9px;background:#071629;color:#d7e7f7;padding:0 10px;font-size:11px;outline:none}.rn-assistant-sidebar select:focus{border-color:#00b4d8}.rn-assistant-side-rule{height:1px;background:#203750;margin:23px 0}.rn-assistant-starters{display:grid;gap:7px}.rn-assistant-starters button{display:flex;gap:10px;align-items:flex-start;text-align:left;padding:10px;border:1px solid transparent;border-radius:9px;background:transparent;color:#b7cce0;cursor:pointer;font-size:10px}.rn-assistant-starters button:hover{background:#102a43;border-color:#234a66}.rn-assistant-starters button>span:first-child{color:#4ed5eb;font-size:15px}.rn-assistant-starters button small{display:block;margin-top:5px;color:#6f8aa6;font-size:9px;line-height:1.5}.rn-assistant-privacy{display:flex;gap:9px;margin-top:28px;padding:11px;border:1px solid #24425a;border-radius:10px;background:#0a2031;color:#74d9c3}.rn-assistant-privacy>span{font-size:16px}.rn-assistant-privacy p{margin:0;color:#8ca9bd;font-size:9px;line-height:1.65}.rn-assistant-privacy strong{color:#8ce5cf;font-size:10px}
        .rn-assistant-chat{display:flex;flex-direction:column;min-width:0;min-height:600px}.rn-assistant-chat-header{height:66px;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 20px;border-bottom:1px solid #1b334d}.rn-assistant-chat-header>div{display:flex;align-items:center;gap:10px}.rn-assistant-online{width:8px;height:8px;background:#4ee1b4;border-radius:50%;box-shadow:0 0 9px #4ee1b466}.rn-assistant-chat-header strong,.rn-assistant-chat-header small{display:block}.rn-assistant-chat-header strong{font-size:12px;color:#e4f1ff}.rn-assistant-chat-header small{font-size:10px;color:#7792ad;margin-top:4px}.rn-assistant-chat-header button{border:1px solid #25425e;background:transparent;border-radius:8px;padding:8px 10px;color:#9bb5cd;font-size:10px;cursor:pointer}.rn-assistant-chat-header button:disabled{opacity:.45;cursor:not-allowed}
        .rn-assistant-messages{flex:1;min-height:390px;max-height:680px;overflow-y:auto;padding:24px 24px 12px}.rn-assistant-welcome{max-width:610px;margin:22px auto 15px;text-align:center}.rn-assistant-welcome-icon{display:grid;place-items:center;width:55px;height:55px;margin:0 auto 17px;border-radius:18px;border:1px solid #2b6279;background:#00b4d81b;color:#63e2f2;font-size:29px;box-shadow:0 0 30px #00b4d810}.rn-assistant-welcome-kicker{font-size:9px;font-weight:800;letter-spacing:.16em;color:#57d5ea}.rn-assistant-welcome h2{font-size:24px;letter-spacing:-.03em;margin:9px 0}.rn-assistant-welcome>p{max-width:450px;margin:0 auto;color:#8ca6c0;font-size:12px;line-height:1.75}.rn-assistant-suggestion-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:23px;text-align:left}.rn-assistant-suggestion-grid button{position:relative;min-height:96px;padding:13px;border:1px solid #1f3b57;border-radius:11px;background:#0b1e32;color:#cce0f3;text-align:left;cursor:pointer}.rn-assistant-suggestion-grid button:hover{border-color:#00a9ce;background:#0d263d}.rn-assistant-suggestion-grid strong,.rn-assistant-suggestion-grid span{display:block;padding-right:14px}.rn-assistant-suggestion-grid strong{font-size:11px;margin-bottom:7px}.rn-assistant-suggestion-grid span{font-size:9px;line-height:1.55;color:#819cb7}.rn-assistant-suggestion-grid b{position:absolute;top:12px;right:12px;color:#4bd6ec;font-size:13px}
        .rn-assistant-message{display:flex;align-items:flex-start;gap:11px;margin:0 0 23px}.rn-assistant-message.user{flex-direction:row-reverse}.rn-assistant-avatar{flex:0 0 32px;width:32px;height:32px;display:grid;place-items:center;border-radius:10px;background:#123b51;color:#60dff0;font-size:16px}.rn-assistant-message.user .rn-assistant-avatar{background:#263750;color:#c2d6ec;font-size:11px;font-weight:800}.rn-assistant-message-body{min-width:0;max-width:calc(100% - 45px)}.rn-assistant-message.user .rn-assistant-message-body{text-align:right}.rn-assistant-message-label{display:block;font-size:8px;letter-spacing:.13em;color:#6f8ba6;font-weight:800;margin:1px 0 7px}.rn-assistant-message-content{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;line-height:1.85;color:#c4d7e9;border:1px solid #1d3953;background:#0d2035;padding:13px 15px;border-radius:4px 13px 13px 13px;text-align:left}.rn-assistant-message.user .rn-assistant-message-content{display:inline-block;background:#103247;border-color:#20516a;border-radius:13px 4px 13px 13px;color:#d9f2f8}.rn-assistant-thinking{display:flex;align-items:center;gap:5px;flex-wrap:wrap;padding:10px 0}.rn-assistant-thinking>span{width:6px;height:6px;border-radius:50%;background:#3ed3e9;animation:rn-assistant-pulse 1s infinite alternate}.rn-assistant-thinking>span:nth-child(2){animation-delay:.2s}.rn-assistant-thinking>span:nth-child(3){animation-delay:.4s}.rn-assistant-thinking small{margin-left:7px;color:#7894af;font-size:10px}@keyframes rn-assistant-pulse{to{opacity:.25;transform:translateY(-3px)}}
        .rn-assistant-error{margin:0 20px 10px;padding:10px;border-radius:8px;background:#3b2029;border:1px solid #6a3741;color:#ffb9c0;font-size:11px}.rn-assistant-composer{margin:0 18px;border:1px solid #284560;border-radius:13px;background:#071629;overflow:hidden}.rn-assistant-composer:focus-within{border-color:#00a9ce;box-shadow:0 0 0 3px #00b4d812}.rn-assistant-composer textarea{display:block;width:100%;box-sizing:border-box;resize:vertical;min-height:65px;max-height:170px;border:0;outline:0;background:transparent;color:#e3f2ff;padding:14px 15px;font:inherit;font-size:12px;line-height:1.7}.rn-assistant-composer textarea::placeholder{color:#66819d}.rn-assistant-composer-bottom{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 10px 10px 14px}.rn-assistant-composer-bottom>span{font-size:9px;color:#627d98}.rn-assistant-composer-bottom button{display:flex;align-items:center;gap:12px;border:0;border-radius:8px;background:#00b4d8;color:#041626;font-weight:800;font-size:10px;padding:10px 12px;cursor:pointer}.rn-assistant-composer-bottom button:disabled{opacity:.5;cursor:not-allowed}.rn-assistant-composer-bottom button b{font-size:15px}.rn-assistant-disclaimer{text-align:center;color:#637f99;font-size:9px;line-height:1.6;padding:10px 18px 13px}
        @media(max-width:900px){.rn-assistant-app{grid-template-columns:230px minmax(0,1fr)}.rn-assistant-sidebar{padding:18px 13px}.rn-assistant-messages{padding:18px 15px}}@media(max-width:700px){.rn-assistant-app{grid-template-columns:1fr}.rn-assistant-sidebar{border-right:0;border-bottom:1px solid #1a334e}.rn-assistant-sidebar-heading{margin-bottom:15px}.rn-assistant-sidebar .rn-assistant-field-label{margin-top:12px}.rn-assistant-sidebar select{max-width:100%}.rn-assistant-side-rule{margin:14px 0}.rn-assistant-starters{grid-template-columns:repeat(2,minmax(0,1fr))}.rn-assistant-starters button{padding:8px}.rn-assistant-privacy{margin-top:14px}.rn-assistant-chat{min-height:570px}.rn-assistant-messages{min-height:330px}.rn-assistant-welcome h2{font-size:21px}.rn-assistant-suggestion-grid{gap:7px}.rn-assistant-composer{margin:0 10px}.rn-assistant-composer-bottom>span{max-width:55%;line-height:1.4}}@media(max-width:390px){.rn-assistant-starters{grid-template-columns:1fr}.rn-assistant-suggestion-grid{grid-template-columns:1fr}.rn-assistant-suggestion-grid button{min-height:80px}.rn-assistant-chat-header{padding:0 12px}}
      `}</style>
    </section>
  );
}
