import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LearnerPortfolio from "@/components/student/LearnerPortfolio";

export const dynamic = "force-dynamic";

export default async function StudentPortfolioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/student/portfolio");

  const [{ data: profile }, { data: items }] = await Promise.all([
    supabase.from("portfolio_profiles").select("id,user_id,username,display_name,headline,bio,is_public").eq("user_id", user.id).maybeSingle(),
    supabase.from("portfolio_items").select("id,title,description,category,project_url,skills,is_public,sort_order,created_at").eq("user_id", user.id).order("sort_order").order("created_at", { ascending: false }),
  ]);

  return (
    <main className="portfolio-page">
      <div className="portfolio-topline"><Link href="/student">← Student dashboard</Link><span>RUFFNECK LEARN</span></div>
      <header className="portfolio-hero">
        <div><p className="eyebrow">YOUR PROFESSIONAL PROFILE</p><h1>Learner Portfolio</h1><p>Turn your course work, practical projects, and achievements into a clear record of what you can do.</p></div>
        <div className="hero-mark" aria-hidden="true">RL<span>+</span></div>
      </header>
      <LearnerPortfolio initialProfile={profile} initialItems={items ?? []} />
      <style>{`
        .portfolio-page{max-width:1120px;margin:0 auto;padding:26px 22px 64px;color:#eaf2ff}.portfolio-topline{display:flex;justify-content:space-between;align-items:center;font-size:12px;letter-spacing:.12em;color:#9bb0cc}.portfolio-topline a{color:#9ddff0;text-decoration:none;letter-spacing:0}.portfolio-hero{margin:28px 0 26px;padding:30px 32px;border:1px solid #234565;border-radius:24px;background:radial-gradient(circle at 88% 10%,#123e5a 0,transparent 35%),linear-gradient(135deg,#0b1e3a,#102d4a);display:flex;align-items:center;justify-content:space-between;gap:24px}.portfolio-hero h1{font-size:clamp(30px,5vw,46px);line-height:1.05;letter-spacing:-.04em;margin:8px 0 12px}.portfolio-hero p:not(.eyebrow){max-width:640px;color:#bfd0e3;line-height:1.7;margin:0}.eyebrow{font-size:11px;font-weight:800;letter-spacing:.16em;color:#57d4eb;margin:0}.hero-mark{height:82px;width:82px;border-radius:23px;border:1px solid #2b6681;display:grid;place-items:center;font-size:24px;font-weight:900;color:#fff;background:#102f4a;flex-shrink:0}.hero-mark span{color:#57d4eb}.portfolio-card{background:#0d213b;border:1px solid #203d5b;border-radius:18px;padding:22px;margin-bottom:18px}.portfolio-card h2{font-size:18px;margin:0 0 7px}.portfolio-muted{color:#9eb2cc;font-size:13px;line-height:1.6}.portfolio-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.portfolio-field{display:flex;flex-direction:column;gap:7px;font-size:12px;font-weight:700;color:#c5d5e8}.portfolio-field input,.portfolio-field textarea,.portfolio-field select{width:100%;box-sizing:border-box;border:1px solid #294967;border-radius:10px;padding:12px 13px;background:#08182c;color:#f4f8ff;font:inherit;font-weight:400;outline:none}.portfolio-field input:focus,.portfolio-field textarea:focus,.portfolio-field select:focus{border-color:#00b4d8;box-shadow:0 0 0 3px #00b4d81f}.portfolio-field textarea{resize:vertical;min-height:100px}.portfolio-wide{grid-column:1/-1}.portfolio-actions{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:16px}.portfolio-button{border:0;border-radius:10px;padding:11px 15px;background:#00b4d8;color:#041626;font-weight:800;cursor:pointer;text-decoration:none;font-size:13px}.portfolio-button.secondary{background:#142e4a;color:#d9e8f8;border:1px solid #31516e}.portfolio-button.danger{background:#4a202b;color:#ffdce2}.portfolio-status{font-size:13px;color:#8ce5c0;margin-top:10px}.portfolio-items{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.portfolio-item{border:1px solid #25445f;border-radius:14px;padding:17px;background:#0a1b31;min-width:0}.portfolio-item h3{font-size:16px;margin:10px 0 8px}.portfolio-item p{font-size:13px;line-height:1.65;color:#b6c8dd;white-space:pre-wrap;overflow-wrap:anywhere}.portfolio-chip{display:inline-flex;padding:5px 8px;border-radius:999px;background:#143b50;color:#81e2f1;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.portfolio-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}.portfolio-tags span{border:1px solid #2a4662;color:#b9cbe0;padding:4px 7px;border-radius:6px;font-size:11px}.portfolio-empty{padding:28px;border:1px dashed #31506b;border-radius:14px;color:#9eb2cc;text-align:center;font-size:13px;line-height:1.7}.portfolio-public-row{display:flex;align-items:center;justify-content:space-between;gap:18px}.portfolio-public-row label{display:flex;align-items:center;gap:9px;color:#d4e1f0;font-size:13px}.portfolio-public-row input{accent-color:#00b4d8;width:17px;height:17px}@media(max-width:680px){.portfolio-page{padding:18px 14px 42px}.portfolio-hero{padding:23px 20px}.hero-mark{display:none}.portfolio-grid,.portfolio-items{grid-template-columns:1fr}.portfolio-wide{grid-column:auto}.portfolio-card{padding:17px}.portfolio-public-row{align-items:flex-start;flex-direction:column}}
      `}</style>
    </main>
  );
}
