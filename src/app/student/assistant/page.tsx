import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AILearningAssistant from "@/components/student/AILearningAssistant";

type Enrollment = {
  course_id: string;
  enrollment_status: string | null;
  payment_status: string | null;
};

type Course = {
  id: string;
  title: string;
  slug: string;
};

export default async function StudentAssistantPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/student/assistant");

  const { data: enrollmentData, error: enrollmentError } = await supabase
    .from("enrollments")
    .select("course_id, enrollment_status, payment_status")
    .eq("student_id", user.id);

  if (enrollmentError) console.error("AI Learning Assistant enrollment lookup failed:", enrollmentError);

  const eligibleIds = [...new Set(
    ((enrollmentData ?? []) as Enrollment[])
      .filter((item) =>
        ["active", "completed"].includes(item.enrollment_status ?? "") &&
        ["free", "paid"].includes(item.payment_status ?? "")
      )
      .map((item) => item.course_id)
  )];

  let courses: Course[] = [];
  if (eligibleIds.length) {
    const { data, error } = await supabase
      .from("courses")
      .select("id, title, slug")
      .in("id", eligibleIds)
      .eq("status", "published")
      .order("title", { ascending: true });
    if (error) console.error("AI Learning Assistant course lookup failed:", error);
    courses = (data ?? []) as Course[];
  }

  return (
    <main className="rn-assistant-page">
      <div className="rn-assistant-shell">
        <div className="rn-assistant-topbar">
          <Link href="/student" className="rn-assistant-back">← Student dashboard</Link>
          <span className="rn-assistant-brand">RUFFNECK <b>LEARN</b></span>
        </div>
        <header className="rn-assistant-hero">
          <div>
            <span className="rn-assistant-eyebrow"><span /> PERSONALIZED STUDY SUPPORT</span>
            <h1>Your AI Learning <em>Assistant</em></h1>
            <p>Ask questions, request simpler explanations, practise with examples, and check your understanding. Use it as a learning partner—not a substitute for your own judgement.</p>
            <div className="rn-assistant-hero-tags"><span>Explain concepts</span><span>Worked examples</span><span>Practice questions</span><span>Study planning</span></div>
          </div>
          <div className="rn-assistant-hero-visual" aria-hidden="true">
            <div className="rn-assistant-glow" />
            <div className="rn-assistant-orbit" />
            <div className="rn-assistant-brain">✧</div>
            <div className="rn-assistant-float rn-assistant-float-one">Explain it simply</div>
            <div className="rn-assistant-float rn-assistant-float-two">Learn by doing <b>✓</b></div>
          </div>
        </header>

        {courses.length ? (
          <AILearningAssistant courses={courses} />
        ) : (
          <section className="rn-assistant-empty">
            <span>▤</span><h2>Enrol in a course to get started</h2>
            <p>The assistant can tailor explanations to your RuffNeck Learn course once you have an eligible enrollment.</p>
            <Link href="/courses" className="rn-assistant-button">Browse courses <b>→</b></Link>
          </section>
        )}
        <footer className="rn-assistant-footer"><span>RUFFNECK LEARN</span><span>Understand the concept. Practise the skill. Verify the result.</span></footer>
      </div>
      <style>{`
        .rn-assistant-page{min-height:100vh;background:#071426;color:#eaf3ff;padding:26px 22px 44px}.rn-assistant-shell{max-width:1180px;margin:0 auto}.rn-assistant-topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:27px}.rn-assistant-back{font-size:13px;color:#9db3ce;text-decoration:none}.rn-assistant-back:hover{color:#00b4d8}.rn-assistant-brand{font-size:12px;font-weight:800;letter-spacing:.15em}.rn-assistant-brand b{color:#00b4d8}
        .rn-assistant-hero{display:grid;grid-template-columns:1.3fr .7fr;align-items:center;min-height:275px;padding:40px 45px;overflow:hidden;position:relative;border:1px solid #1d3a56;border-radius:25px;background:radial-gradient(ellipse at 80% 50%,#00b4d822,transparent 40%),linear-gradient(125deg,#102744,#09182b 74%);box-shadow:0 24px 70px #02081444}.rn-assistant-eyebrow{display:flex;align-items:center;gap:9px;font-size:10px;letter-spacing:.16em;color:#63dced;font-weight:800}.rn-assistant-eyebrow span{width:7px;height:7px;border-radius:50%;background:#00b4d8;box-shadow:0 0 10px #00b4d8}.rn-assistant-hero h1{font-size:clamp(32px,4vw,48px);letter-spacing:-.045em;line-height:1.1;margin:16px 0 13px}.rn-assistant-hero h1 em{font-style:normal;color:#00c3e7}.rn-assistant-hero p{max-width:650px;font-size:13px;line-height:1.8;color:#a5bbd3;margin:0}.rn-assistant-hero-tags{display:flex;gap:8px;flex-wrap:wrap;margin-top:22px}.rn-assistant-hero-tags span{font-size:10px;color:#a6dce9;border:1px solid #27516b;border-radius:30px;padding:7px 10px;background:#00b4d80c}
        .rn-assistant-hero-visual{position:relative;min-height:190px;display:grid;place-items:center}.rn-assistant-glow{position:absolute;width:175px;height:175px;border-radius:50%;background:#00b4d81b;filter:blur(4px)}.rn-assistant-orbit{position:absolute;width:210px;height:150px;border:1px solid #27617a;border-radius:50%;transform:rotate(-27deg)}.rn-assistant-brain{z-index:1;width:110px;height:110px;display:grid;place-items:center;border:1px solid #3c7890;border-radius:32px;transform:rotate(8deg);background:linear-gradient(145deg,#194564,#0c2239);color:#65e4f5;font-size:64px;box-shadow:0 20px 50px #02081388}.rn-assistant-float{position:absolute;z-index:2;border:1px solid #2b4d69;background:#102741;padding:10px 12px;border-radius:10px;font-size:10px;color:#cfe2f5;box-shadow:0 8px 24px #02081366}.rn-assistant-float-one{top:12px;right:0}.rn-assistant-float-two{bottom:6px;left:0}.rn-assistant-float-two b{color:#67e3bf;margin-left:8px}
        .rn-assistant-empty{margin-top:24px;text-align:center;padding:45px 20px;border:1px dashed #294562;border-radius:18px;background:#0a1a2e}.rn-assistant-empty>span{display:grid;place-items:center;width:50px;height:50px;margin:0 auto 13px;border-radius:14px;background:#00b4d81c;color:#55d9ed;font-size:22px}.rn-assistant-empty h2{font-size:20px;margin:0 0 8px}.rn-assistant-empty p{font-size:12px;line-height:1.7;color:#8fa8c5;max-width:500px;margin:0 auto 18px}.rn-assistant-button{display:inline-flex;gap:15px;align-items:center;padding:11px 15px;border-radius:9px;background:#00b4d8;color:#031525;text-decoration:none;font-size:11px;font-weight:800}
        .rn-assistant-footer{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;border-top:1px solid #172d46;margin-top:36px;padding-top:19px;color:#6e87a1;font-size:10px}.rn-assistant-footer span:first-child{font-weight:800;letter-spacing:.14em;color:#8ca7c4}
        @media(max-width:740px){.rn-assistant-page{padding:17px 13px 32px}.rn-assistant-hero{grid-template-columns:1fr;padding:28px 22px 16px}.rn-assistant-hero-visual{min-height:180px;margin-top:10px}.rn-assistant-float-one{right:7%}.rn-assistant-footer{flex-direction:column}}@media(max-width:390px){.rn-assistant-hero{padding:24px 17px 12px}.rn-assistant-hero-tags span{font-size:9px}}
      `}</style>
    </main>
  );
}
