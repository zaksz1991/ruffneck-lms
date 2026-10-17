"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "./HtmlCssLabStudio.module.css";

type RubricCriterion = {
  criterion: string;
  points: number;
  description?: string;
};

type StudioSubmission = {
  id: string;
  status: string;
  score: number | null;
  feedback: string | null;
  answer_text: string | null;
  updated_at: string | null;
};

type HtmlCssProject = {
  html: string;
  css: string;
  reflection: string;
};

type Message = { kind: "success" | "error" | "info"; text: string };
type SaveAction = "draft" | "submitted";
type PreviewMode = "desktop" | "tablet" | "mobile";
type TemplateId = "business" | "portfolio" | "learning";

const PROJECT_MARKER = "RUFFNECK_HTML_CSS_STUDIO_PROJECT_V1";
const REFLECTION_MARKER = "\n\n[STUDENT REFLECTION]\n";
const HTML_MARKER = "\n\n[HTML SOURCE]\n";
const CSS_MARKER = "\n\n[CSS SOURCE]\n";
const MAX_HTML_LENGTH = 9_000;
const MAX_CSS_LENGTH = 7_000;
const MAX_REFLECTION_LENGTH = 1_000;

const TEMPLATES: Record<TemplateId, { label: string; html: string; css: string }> = {
  business: {
    label: "Small business landing page",
    html: `<header class="site-header" id="top">
  <a class="brand" href="#top" aria-label="Northstar Studio home">northstar<span>.</span></a>
  <nav aria-label="Main navigation">
    <a href="#services">Services</a>
    <a href="#approach">Our approach</a>
    <a href="#contact">Contact</a>
  </nav>
  <a class="header-link" href="#contact">Start a project <span aria-hidden="true">↗</span></a>
</header>
<main>
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero-copy">
      <p class="eyebrow">PRACTICAL DIGITAL PARTNERS</p>
      <h1 id="hero-title">Make your next digital move <em>count.</em></h1>
      <p class="hero-intro">Clear websites and useful digital systems that help growing businesses turn good ideas into meaningful customer experiences.</p>
      <div class="hero-actions">
        <a class="button button-primary" href="#contact">Let’s build something</a>
        <a class="text-link" href="#services">Explore services <span aria-hidden="true">↓</span></a>
      </div>
      <p class="small-proof"><span aria-hidden="true">✦</span> Strategy first. Useful design. Measurable progress.</p>
    </div>
    <div class="hero-card" aria-label="Our working principles">
      <div class="card-topline"><span class="live-dot"></span> THE NORTHSTAR METHOD</div>
      <div class="metric"><strong>01</strong><div><b>Understand</b><span>Start with the customer and the goal.</span></div></div>
      <div class="metric"><strong>02</strong><div><b>Build</b><span>Keep every page clear and purposeful.</span></div></div>
      <div class="metric"><strong>03</strong><div><b>Improve</b><span>Use evidence to make the next version better.</span></div></div>
      <p class="card-footnote">A simple process, designed for real work.</p>
    </div>
  </section>
  <section class="services section-wrap" id="services" aria-labelledby="services-title">
    <div class="section-heading"><p class="eyebrow">WHAT WE DO</p><h2 id="services-title">Useful digital work.<br><em>Without the noise.</em></h2></div>
    <div class="service-grid">
      <article class="service-card"><span class="service-number">01 / WEB</span><h3>Website foundations</h3><p>Responsive pages that explain the offer, build trust and make the next step obvious.</p><a href="#contact" aria-label="Ask about website foundations">Explore service ↗</a></article>
      <article class="service-card featured"><span class="service-number">02 / CONTENT</span><h3>Content and campaigns</h3><p>Purposeful messages, useful content and landing pages organised around one measurable goal.</p><a href="#contact" aria-label="Ask about content and campaigns">Explore service ↗</a></article>
      <article class="service-card"><span class="service-number">03 / SYSTEMS</span><h3>Practical automation</h3><p>Small, reliable workflows that reduce repetition and help teams respond consistently.</p><a href="#contact" aria-label="Ask about practical automation">Explore service ↗</a></article>
    </div>
  </section>
  <section class="approach section-wrap" id="approach"><div><p class="eyebrow">THE DIFFERENCE</p><h2>Design should make the next step <em>easier.</em></h2></div><p>We combine clear writing, thoughtful structure and responsive design so customers can find what matters, understand the value and take action with confidence.</p></section>
  <section class="contact section-wrap" id="contact"><div><p class="eyebrow">READY WHEN YOU ARE</p><h2>What would you like to <em>improve?</em></h2><p>Tell us about the business goal. We’ll start with the problem, not the software.</p></div><a class="button button-light" href="mailto:hello@example.com">Start a conversation ↗</a></section>
</main>
<footer class="site-footer"><a class="brand" href="#top">northstar<span>.</span></a><p>Fictional practice project · Built with HTML and CSS.</p><a href="#top">Back to top ↑</a></footer>`,
    css: `:root {
  --ink: #10233b;
  --muted: #5c6c80;
  --paper: #f7f8fa;
  --surface: #ffffff;
  --line: #e0e6ec;
  --accent: #0b766e;
  --accent-soft: #e2f4f0;
  --gold: #f2bd55;
  --radius: 18px;
  --space: clamp(1rem, 2vw, 2rem);
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin: 0; color: var(--ink); background: var(--paper); font: 16px/1.65 Arial, Helvetica, sans-serif; }
a { color: inherit; text-underline-offset: .22em; }
a:focus-visible { outline: 3px solid var(--gold); outline-offset: 4px; border-radius: 4px; }
.site-header { display: flex; align-items: center; justify-content: space-between; gap: 1.25rem; padding: 1.1rem clamp(1rem, 5vw, 4.5rem); background: var(--surface); border-bottom: 1px solid var(--line); }
.brand { font-size: 1.35rem; font-weight: 800; letter-spacing: -.05em; text-decoration: none; }
.brand span { color: var(--accent); }
nav { display: flex; gap: clamp(.8rem, 2.5vw, 2rem); }
nav a, .header-link, .text-link { font-size: .9rem; font-weight: 700; text-decoration: none; }
nav a { color: var(--muted); }
.header-link { white-space: nowrap; }
.header-link span, .text-link span { color: var(--accent); }
.hero { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(260px, .75fr); gap: clamp(2rem, 6vw, 5rem); align-items: center; padding: clamp(3rem, 7vw, 6.5rem) clamp(1rem, 7vw, 6rem); background: linear-gradient(135deg, #f7f8fa, #edf6f4); }
.eyebrow { margin: 0 0 .9rem; color: var(--accent); font-size: .72rem; font-weight: 800; letter-spacing: .15em; }
h1, h2, h3, p { margin-top: 0; }
h1, h2 { line-height: 1.08; letter-spacing: -.045em; }
h1 { max-width: 760px; margin-bottom: 1.4rem; font-size: clamp(2.4rem, 5vw, 4.8rem); }
h1 em, h2 em { color: var(--accent); font-family: Georgia, serif; font-weight: 500; }
.hero-intro { max-width: 620px; color: var(--muted); font-size: clamp(1rem, 1.7vw, 1.2rem); }
.hero-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 1rem 1.4rem; margin: 1.7rem 0; }
.button { display: inline-flex; min-height: 46px; align-items: center; justify-content: center; padding: .75rem 1.2rem; border: 1px solid transparent; border-radius: 999px; font-weight: 800; text-decoration: none; }
.button-primary { color: #fff; background: var(--accent); }
.button-light { color: var(--ink); background: #fff; }
.small-proof { color: var(--muted); font-size: .84rem; }
.small-proof span { color: var(--accent); }
.hero-card { padding: clamp(1.2rem, 2.8vw, 2rem); border: 1px solid #d9e7e3; border-radius: var(--radius); background: rgba(255,255,255,.9); box-shadow: 0 20px 60px rgba(16,35,59,.07); }
.card-topline { display: flex; align-items: center; gap: .6rem; padding-bottom: 1.2rem; border-bottom: 1px solid var(--line); font-size: .68rem; font-weight: 800; letter-spacing: .12em; }
.live-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--accent); }
.metric { display: flex; gap: 1rem; padding: 1.15rem 0; border-bottom: 1px solid var(--line); }
.metric > strong { color: var(--accent); font-size: 1.2rem; }
.metric div { display: grid; gap: .15rem; }
.metric span { color: var(--muted); font-size: .87rem; }
.card-footnote { margin: 1.2rem 0 0; color: var(--muted); font-size: .8rem; }
.section-wrap { padding: clamp(3rem, 7vw, 6rem) clamp(1rem, 7vw, 6rem); }
.section-heading { display: flex; justify-content: space-between; align-items: end; gap: 2rem; margin-bottom: 2rem; }
.section-heading h2, .approach h2, .contact h2 { margin-bottom: 0; font-size: clamp(2rem, 4vw, 3.4rem); }
.service-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 1rem; }
.service-card { padding: 1.5rem; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); }
.service-card.featured { border-color: #b5ded6; background: var(--accent-soft); }
.service-number { color: var(--accent); font-size: .7rem; font-weight: 800; letter-spacing: .12em; }
.service-card h3 { margin: 1.5rem 0 .6rem; font-size: 1.25rem; }
.service-card p { min-height: 5.5rem; color: var(--muted); font-size: .94rem; }
.service-card a { font-size: .85rem; font-weight: 800; text-decoration: none; }
.approach { display: grid; grid-template-columns: minmax(0, 1fr) minmax(220px, .7fr); gap: 2rem; align-items: end; border-top: 1px solid var(--line); }
.approach > p { max-width: 560px; margin-bottom: .25rem; color: var(--muted); }
.contact { display: flex; justify-content: space-between; align-items: center; gap: 2rem; color: #fff; background: var(--ink); }
.contact .eyebrow { color: #8de0d4; }
.contact h2 { max-width: 620px; }
.contact h2 em { color: #8de0d4; }
.contact p:last-child { max-width: 540px; margin: 1rem 0 0; color: #c5d1de; }
.site-footer { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 1.5rem clamp(1rem, 5vw, 4.5rem); background: #fff; }
.site-footer p { margin: 0; color: var(--muted); font-size: .8rem; }
.site-footer > a:last-child { font-size: .8rem; font-weight: 700; }
@media (max-width: 760px) {
  .site-header { flex-wrap: wrap; }
  nav { order: 3; width: 100%; flex-wrap: wrap; gap: .8rem 1.2rem; }
  .hero { grid-template-columns: 1fr; }
  .hero-card { max-width: 580px; }
  .section-heading, .approach, .contact { display: grid; grid-template-columns: 1fr; }
  .service-grid { grid-template-columns: 1fr; }
  .service-card p { min-height: 0; }
  .site-footer { align-items: flex-start; flex-wrap: wrap; }
}
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }`,
  },
  portfolio: {
    label: "Creative portfolio",
    html: `<header class="topbar" id="top"><a class="logo" href="#top">Amina<span> / Design</span></a><nav aria-label="Portfolio navigation"><a href="#work">Selected work</a><a href="#about">About</a><a href="#contact">Contact</a></nav></header>
<main><section class="intro"><p class="eyebrow">DESIGNER · PROBLEM SOLVER</p><h1>Good design should feel <span>clear.</span></h1><p class="intro-copy">I help purpose-led teams turn complex ideas into simple, useful digital experiences.</p><a class="button" href="#work">Explore selected work ↓</a><div class="intro-note"><b>Based in Nigeria</b><span>Available for thoughtful collaborations</span></div></section>
<section class="work" id="work"><div class="section-title"><p class="eyebrow">A FEW PROJECTS</p><h2>Selected work</h2></div><div class="work-grid"><article class="project project-one"><span>01 / DIGITAL</span><div><h3>Community finance</h3><p>A clearer service journey for first-time customers.</p></div></article><article class="project project-two"><span>02 / BRAND</span><div><h3>Everyday Goods</h3><p>A practical identity for an ambitious local brand.</p></div></article><article class="project project-three"><span>03 / CONTENT</span><div><h3>Learning for all</h3><p>A calmer layout for complex learning material.</p></div></article></div></section>
<section class="about" id="about"><p class="eyebrow">HOW I WORK</p><h2>Curious by nature.<br><span>Careful by design.</span></h2><p>I listen, map the problem, test simple ideas and explain the trade-offs. The goal is work people can actually use.</p></section><section class="contact" id="contact"><p class="eyebrow">HAVE A CHALLENGE?</p><h2>Let's make the next version better.</h2><a class="button button-light" href="mailto:hello@example.com">Contact me ↗</a></section></main><footer><a class="logo" href="#top">Amina<span> / Design</span></a><p>Practice portfolio · Sample projects are fictional.</p></footer>`,
    css: `:root { --ink:#15253a; --muted:#68758a; --paper:#f8f7f3; --accent:#b34e31; --line:#dedbd3; }
* { box-sizing:border-box; }
body { margin:0; background:var(--paper); color:var(--ink); font:16px/1.65 Arial, sans-serif; }
a { color:inherit; }
a:focus-visible { outline:3px solid #e5a64d; outline-offset:4px; }
.topbar, footer { display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:1.3rem clamp(1rem,6vw,5rem); }
.logo { font-weight:900; font-size:1.2rem; text-decoration:none; letter-spacing:-.05em; }
.logo span { color:var(--accent); }
nav { display:flex; flex-wrap:wrap; gap:1.3rem; }
nav a { color:var(--muted); text-decoration:none; font-size:.88rem; font-weight:700; }
.intro { padding:clamp(4rem,9vw,8rem) clamp(1rem,12vw,10rem); background:#efebe2; }
.eyebrow { color:var(--accent); font-size:.72rem; font-weight:800; letter-spacing:.16em; }
h1,h2 { line-height:1.08; letter-spacing:-.05em; }
h1 { max-width:800px; margin:.8rem 0; font-size:clamp(2.7rem,7vw,6.2rem); }
h1 span,h2 span { color:var(--accent); font-family:Georgia,serif; font-weight:400; }
.intro-copy { max-width:560px; color:var(--muted); font-size:1.15rem; }
.button { display:inline-flex; min-height:46px; align-items:center; margin-top:1rem; padding:.7rem 1.2rem; border-radius:999px; background:var(--accent); color:#fff; font-weight:800; text-decoration:none; }
.intro-note { display:flex; flex-wrap:wrap; gap:.5rem 1.4rem; margin-top:4rem; font-size:.85rem; }
.intro-note span { color:var(--muted); }
.work,.about { padding:clamp(3rem,7vw,6rem) clamp(1rem,7vw,6rem); }
.section-title { display:flex; justify-content:space-between; align-items:end; gap:1rem; }
h2 { font-size:clamp(2rem,4vw,3.5rem); }
.work-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:1rem; }
.project { min-height:320px; display:flex; flex-direction:column; justify-content:space-between; padding:1.3rem; border:1px solid var(--line); border-radius:14px; background:#e9d7c6; }
.project-two { background:#d5e2d8; }
.project-three { background:#d9dbea; }
.project > span { font-size:.7rem; font-weight:800; letter-spacing:.1em; }
.project h3 { margin-bottom:.4rem; font-size:1.5rem; }
.project p { margin:0; color:#4d5968; }
.about { border-top:1px solid var(--line); }
.about h2 { max-width:650px; }
.about > p:last-child { max-width:600px; color:var(--muted); }
.contact { padding:clamp(3rem,7vw,6rem) clamp(1rem,7vw,6rem); background:var(--ink); color:#fff; }
.contact .eyebrow { color:#f3bba7; }
.contact h2 { max-width:720px; }
.button-light { background:#fff; color:var(--ink); }
footer { border-top:1px solid var(--line); }
footer p { color:var(--muted); font-size:.8rem; }
@media(max-width:720px) { .topbar { flex-wrap:wrap; } nav { width:100%; } .work-grid { grid-template-columns:1fr; } .project { min-height:240px; } .section-title { display:block; } footer { flex-wrap:wrap; } }`,
  },
  learning: {
    label: "Learning programme",
    html: `<header class="header" id="top"><a class="brand" href="#top">FIELDNOTE <span>LEARNING</span></a><nav aria-label="Main navigation"><a href="#programme">Programme</a><a href="#outcomes">Outcomes</a><a href="#enrol">Get started</a></nav></header>
<main><section class="hero"><div><p class="eyebrow">PRACTICAL SKILLS · REAL PROJECTS</p><h1>Learn by making something <em>useful.</em></h1><p class="lead">A focused learning programme for people who want to move from ideas to confident practice.</p><a class="button" href="#enrol">View the programme ↗</a></div><aside class="hero-note"><span class="note-label">THE FIELDNOTE APPROACH</span><strong>Learn → Practice → Reflect → Improve</strong><p>Short lessons, guided work and useful feedback.</p></aside></section>
<section class="programme" id="programme"><p class="eyebrow">THE PROGRAMME</p><h2>Build capability step by step</h2><div class="module-list"><article><span>01</span><div><h3>Foundations</h3><p>Understand the concepts and the context where they matter.</p></div><b>Start here</b></article><article><span>02</span><div><h3>Guided practice</h3><p>Use a brief, starter resources and a clear definition of done.</p></div><b>Make it</b></article><article><span>03</span><div><h3>Review and improve</h3><p>Use feedback to refine the result and explain your choices.</p></div><b>Reflect</b></article></div></section>
<section class="outcomes" id="outcomes"><p class="eyebrow">AFTER THE PROGRAMME</p><h2>Leave with proof of practice.</h2><p>Each project creates a tangible deliverable and a short explanation of the decisions behind it.</p></section><section class="enrol" id="enrol"><div><p class="eyebrow">YOUR NEXT STEP</p><h2>Start with one practical project.</h2><p>Choose a goal, build a first version, and improve it with feedback.</p></div><a class="button button-light" href="mailto:hello@example.com">Ask about the programme ↗</a></section></main><footer><a class="brand" href="#top">FIELDNOTE <span>LEARNING</span></a><p>Sample programme · Replace this content with your own project.</p></footer>`,
    css: `:root { --ink:#172a3a; --muted:#647481; --paper:#f8faf8; --green:#176f5b; --pale:#e5f1ec; --line:#dbe5df; }
* { box-sizing:border-box; }
body { margin:0; color:var(--ink); background:var(--paper); font:16px/1.65 Arial,sans-serif; }
a { color:inherit; }
a:focus-visible { outline:3px solid #e5a744; outline-offset:4px; }
.header,footer { display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:1.2rem clamp(1rem,6vw,5rem); }
.brand { font-size:1rem; font-weight:900; letter-spacing:.08em; text-decoration:none; }
.brand span { color:var(--green); }
nav { display:flex; flex-wrap:wrap; gap:1.2rem; }
nav a { font-size:.88rem; text-decoration:none; font-weight:700; }
.hero { display:grid; grid-template-columns:1.2fr .8fr; align-items:center; gap:2rem; padding:clamp(3rem,8vw,7rem) clamp(1rem,8vw,7rem); background:var(--pale); }
.eyebrow { margin-bottom:.8rem; color:var(--green); font-size:.72rem; font-weight:800; letter-spacing:.14em; }
h1,h2 { line-height:1.1; letter-spacing:-.04em; }
h1 { max-width:750px; font-size:clamp(2.5rem,6vw,5rem); }
h1 em { color:var(--green); font-family:Georgia,serif; font-weight:400; }
h2 { font-size:clamp(2rem,4vw,3.2rem); }
.lead { max-width:580px; color:var(--muted); font-size:1.12rem; }
.button { display:inline-flex; min-height:46px; align-items:center; margin-top:.8rem; padding:.7rem 1.1rem; border-radius:999px; background:var(--green); color:#fff; font-weight:800; text-decoration:none; }
.hero-note { padding:1.6rem; border:1px solid #d0e0d7; border-radius:16px; background:rgba(255,255,255,.75); }
.note-label { display:block; margin-bottom:1rem; color:var(--green); font-size:.7rem; font-weight:800; letter-spacing:.1em; }
.hero-note strong { display:block; font-size:1.5rem; line-height:1.25; }
.hero-note p { color:var(--muted); }
.programme,.outcomes { padding:clamp(3rem,7vw,6rem) clamp(1rem,8vw,7rem); }
.module-list { margin-top:2rem; border-top:1px solid var(--line); }
.module-list article { display:grid; grid-template-columns:55px 1fr auto; gap:1rem; align-items:start; padding:1.35rem 0; border-bottom:1px solid var(--line); }
.module-list article > span { color:var(--green); font-weight:900; }
.module-list h3 { margin:0 0 .4rem; }
.module-list p { margin:0; color:var(--muted); }
.module-list b { color:var(--green); font-size:.8rem; }
.outcomes { border-top:1px solid var(--line); }
.outcomes > p:last-child { max-width:600px; color:var(--muted); }
.enrol { display:flex; align-items:center; justify-content:space-between; gap:2rem; padding:clamp(3rem,7vw,6rem) clamp(1rem,8vw,7rem); color:#fff; background:var(--ink); }
.enrol .eyebrow { color:#93e0c7; }
.enrol h2 { max-width:650px; }
.enrol p:last-child { color:#c6d5df; }
.button-light { white-space:nowrap; background:#fff; color:var(--ink); }
footer { border-top:1px solid var(--line); }
footer p { color:var(--muted); font-size:.8rem; }
@media(max-width:720px) { .header { flex-wrap:wrap; } nav { width:100%; } .hero { grid-template-columns:1fr; } .module-list article { grid-template-columns:35px 1fr; } .module-list b { grid-column:2; } .enrol { display:grid; } .button-light { justify-self:start; white-space:normal; } footer { flex-wrap:wrap; } }`,
  },
};

function initialProject(answerText: string | null): HtmlCssProject {
  if (!answerText || !answerText.startsWith(PROJECT_MARKER)) {
    return { html: TEMPLATES.business.html, css: TEMPLATES.business.css, reflection: "" };
  }
  const reflectionStart = answerText.indexOf(REFLECTION_MARKER);
  const htmlStart = answerText.indexOf(HTML_MARKER);
  const cssStart = answerText.indexOf(CSS_MARKER);
  if (reflectionStart < 0 || htmlStart < 0 || cssStart < 0 || !(reflectionStart < htmlStart && htmlStart < cssStart)) {
    return { html: TEMPLATES.business.html, css: TEMPLATES.business.css, reflection: "" };
  }
  return {
    reflection: answerText.slice(reflectionStart + REFLECTION_MARKER.length, htmlStart).trim(),
    html: answerText.slice(htmlStart + HTML_MARKER.length, cssStart).replace(/^\n/, ""),
    css: answerText.slice(cssStart + CSS_MARKER.length).replace(/^\n/, "").replace(/\s+$/, ""),
  };
}

function encodeProject(project: HtmlCssProject, title: string): string {
  return `${PROJECT_MARKER}\nProject: ${title}${REFLECTION_MARKER}${project.reflection.trim() || "Not provided yet"}${HTML_MARKER}${project.html}${CSS_MARKER}${project.css}`;
}

function makePreviewDocument(html: string, css: string): string {
  // Sandboxing and CSP are deliberate: this studio teaches HTML/CSS, not script execution.
  const safeCss = css.replace(/<\/style/gi, "<\\/style");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; connect-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'"><title>Student website preview</title><style>${safeCss}</style></head><body>${html}</body></html>`;
}

function downloadText(filename: string, content: string, contentType: string): void {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function isStudioHazardous(html: string): boolean {
  return /<\s*script\b/i.test(html) || /\son[a-z]+\s*=/i.test(html) || /javascript\s*:/i.test(html);
}

export default function HtmlCssLabStudio({
  labId,
  labTitle,
  courseTitle,
  summary,
  instructions,
  deliverable,
  practiceSteps,
  assessmentRubric,
  initialSubmission: suppliedSubmission,
}: {
  labId: string;
  labTitle: string;
  courseTitle: string;
  summary: string;
  instructions: string;
  deliverable: string;
  practiceSteps: string[];
  assessmentRubric: RubricCriterion[];
  initialSubmission: StudioSubmission | null;
}) {
  const router = useRouter();
  const initial = useMemo(() => initialProject(suppliedSubmission?.answer_text ?? null), [suppliedSubmission?.answer_text]);
  const [html, setHtml] = useState(initial.html);
  const [css, setCss] = useState(initial.css);
  const [reflection, setReflection] = useState(initial.reflection);
  const [templateId, setTemplateId] = useState<TemplateId>(() => {
    const match = (Object.entries(TEMPLATES) as Array<[TemplateId, { label: string; html: string; css: string }]>).find(([, template]) => template.html === initial.html && template.css === initial.css);
    return match?.[0] ?? "business";
  });
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [status, setStatus] = useState(suppliedSubmission?.status ?? "new");
  const [score, setScore] = useState<number | null>(suppliedSubmission?.score ?? null);
  const [feedback, setFeedback] = useState(suppliedSubmission?.feedback ?? null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [updatedAt, setUpdatedAt] = useState(suppliedSubmission?.updated_at ?? null);
  const [previewKey, setPreviewKey] = useState(0);

  const previewDocument = useMemo(() => makePreviewDocument(html, css), [html, css, previewKey]);
  const rubricTotal = assessmentRubric.reduce((total, item) => total + item.points, 0);
  const locked = status === "submitted" || status === "approved";
  const previewWidth = previewMode === "desktop" ? "100%" : previewMode === "tablet" ? "768px" : "390px";
  const checks = useMemo(() => [
    { label: "One clear H1 heading", passed: /<h1\b/i.test(html) },
    { label: "Semantic page landmark", passed: /<(main|header|nav|footer)\b/i.test(html) },
    { label: "Responsive CSS media query", passed: /@media\b/i.test(css) },
    { label: "Visible keyboard-focus styling", passed: /:focus-visible/i.test(css) },
    { label: "Images include alt text", passed: !/<img\b(?![^>]*\balt\s*=)[^>]*>/i.test(html) },
  ], [html, css]);

  function handleTab(event: KeyboardEvent<HTMLTextAreaElement>, language: "html" | "css") {
    if (event.key !== "Tab" || event.shiftKey || locked) return;
    event.preventDefault();
    const target = event.currentTarget;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const current = language === "html" ? html : css;
    const next = `${current.slice(0, start)}  ${current.slice(end)}`;
    if (language === "html") setHtml(next); else setCss(next);
    window.requestAnimationFrame(() => target.setSelectionRange(start + 2, start + 2));
  }

  function changeTemplate(nextTemplateId: TemplateId) {
    const changed = html !== TEMPLATES[nextTemplateId].html || css !== TEMPLATES[nextTemplateId].css;
    if (changed && !window.confirm("Switching templates replaces the HTML and CSS currently in the editor. Continue?")) return;
    setTemplateId(nextTemplateId);
    setHtml(TEMPLATES[nextTemplateId].html);
    setCss(TEMPLATES[nextTemplateId].css);
    setReflection("");
    setMessage({ kind: "info", text: `Loaded the ${TEMPLATES[nextTemplateId].label} starter template. Save a draft to keep it in your account.` });
  }

  function validateBeforeSubmit(): string | null {
    if (html.trim().length < 120) return "Add more HTML before submitting. Include the required page sections and a meaningful heading.";
    if (css.trim().length < 100) return "Add more CSS before submitting. Define the visual design and layout.";
    if (!/<h1\b/i.test(html)) return "Add one clear H1 heading to the page before submitting.";
    if (!/<(main|header|nav|footer)\b/i.test(html)) return "Use at least one semantic landmark such as header, nav, main or footer.";
    if (!/@media\b/i.test(css)) return "Add a CSS @media rule to demonstrate responsive behaviour.";
    if (isStudioHazardous(html)) return "This HTML/CSS lab does not accept script tags, inline event handlers or javascript: URLs. Keep the project HTML and CSS only.";
    if (reflection.trim().length < 60) return "Add a reflection of at least 60 characters explaining one design choice and what you tested.";
    return null;
  }

  async function saveProject(action: SaveAction) {
    setMessage(null);
    if (locked) {
      setMessage({ kind: "error", text: status === "approved" ? "This project has been approved and is locked." : "Your project is awaiting review and is locked until the instructor responds." });
      return;
    }
    if (html.length > MAX_HTML_LENGTH || css.length > MAX_CSS_LENGTH || reflection.length > MAX_REFLECTION_LENGTH) {
      setMessage({ kind: "error", text: "The project exceeds a code or reflection limit. Reduce the content and try again." });
      return;
    }
    if (isStudioHazardous(html)) {
      setMessage({ kind: "error", text: "This lab accepts HTML and CSS only. Remove script tags, inline event handlers, and javascript: URLs." });
      return;
    }
    if (action === "submitted") {
      const validation = validateBeforeSubmit();
      if (validation) {
        setMessage({ kind: "error", text: validation });
        return;
      }
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/student/labs/${encodeURIComponent(labId)}/studio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, css, reflection, action }),
      });
      const result = await response.json().catch(() => null) as {
        ok?: boolean;
        error?: string;
        message?: string;
        submission?: { status?: string; score?: number | null; feedback?: string | null; updated_at?: string | null };
      } | null;
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Unable to save the project. Please try again.");
      }
      const nextStatus = result.submission?.status ?? (action === "draft" ? "draft" : "submitted");
      setStatus(nextStatus);
      setScore(result.submission?.score ?? null);
      setFeedback(result.submission?.feedback ?? feedback);
      setUpdatedAt(result.submission?.updated_at ?? new Date().toISOString());
      setMessage({ kind: "success", text: result.message || (action === "draft" ? "Draft saved." : "Project submitted for review.") });
      router.refresh();
    } catch (error: unknown) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "A network error occurred. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  const safeProjectName = labTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "ruffneck-website-project";
  const cssFilename = `${safeProjectName}-styles.css`;
  const downloadableHtml = `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>${labTitle.replace(/[<>]/g, "")}</title>\n  <link rel="stylesheet" href="${cssFilename}">\n</head>\n<body>\n${html}\n</body>\n</html>\n`;
  function downloadHtmlFile() {
    downloadText(`${safeProjectName}-index.html`, downloadableHtml, "text/html;charset=utf-8");
  }
  function downloadCssFile() {
    downloadText(cssFilename, css, "text/css;charset=utf-8");
  }

  return (
    <div className={styles.studio}>
      <div className={styles.studioTopline}>
        <a href="/student/labs" className={styles.backLink}>← All practical labs</a>
        <div className={styles.toplineRight}>
          <span className={`${styles.statusPill} ${status === "approved" ? styles.statusApproved : status === "submitted" ? styles.statusSubmitted : status === "revision_required" ? styles.statusRevision : ""}`}>{status === "new" ? "Not started" : status.replaceAll("_", " ")}</span>
          {updatedAt && <span className={styles.savedAt}>Last saved {new Date(updatedAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</span>}
        </div>
      </div>

      <section className={styles.briefGrid}>
        <div className={styles.briefMain}>
          <span className={styles.eyebrow}>ADVANCED PRACTICAL LAB · {courseTitle}</span>
          <h2>{labTitle}</h2>
          <p className={styles.lead}>{summary}</p>
          <div className={styles.briefText}>{instructions}</div>
          <div className={styles.deliverable}><strong>Required deliverable</strong><p>{deliverable}</p></div>
        </div>
        <aside className={styles.rubricCard}>
          <div className={styles.rubricHeading}><span>ASSESSMENT RUBRIC</span><strong>{rubricTotal}/100</strong></div>
          {assessmentRubric.length ? <ol className={styles.rubricList}>{assessmentRubric.map((criterion, index) => <li key={`${criterion.criterion}-${index}`}><div><strong>{criterion.criterion}</strong>{criterion.description && <p>{criterion.description}</p>}</div><b>{criterion.points}</b></li>)}</ol> : <p className={styles.muted}>Your instructor will assess the required deliverable and reflection.</p>}
          <div className={styles.stepsBlock}><strong>Practice sequence</strong><ol>{practiceSteps.map((step, index) => <li key={`${index}-${step.slice(0, 20)}`}>{step}</li>)}</ol></div>
        </aside>
      </section>

      {feedback && (status === "revision_required" || status === "approved") && <section className={status === "revision_required" ? styles.revisionBox : styles.feedbackBox}><strong>{status === "revision_required" ? "Instructor feedback — revision required" : "Instructor feedback"}</strong><p>{feedback}</p>{score !== null && <span>Current score: {score}/100</span>}</section>}
      {status === "submitted" && <div className={styles.lockedNotice}>Your project is awaiting instructor review. Editing is locked until the instructor responds.</div>}
      {status === "approved" && <div className={styles.approvedNotice}>This project has been approved and cannot be changed.</div>}

      <section className={styles.workbench} aria-label="HTML and CSS editor">
        <div className={styles.workbenchHeader}>
          <div><span className={styles.eyebrow}>YOUR WORKSPACE</span><h2>Build. Preview. Improve.</h2><p>Edit HTML and CSS side-by-side. The preview runs in an isolated frame with scripts and network requests blocked.</p></div>
          <label className={styles.templateSelect}>Starter template<select value={templateId} onChange={(event) => changeTemplate(event.target.value as TemplateId)} disabled={locked || saving}>{Object.entries(TEMPLATES).map(([id, template]) => <option value={id} key={id}>{template.label}</option>)}</select></label>
        </div>
        <div className={styles.editorGrid}>
          <section className={styles.editorPanel}>
            <div className={styles.editorTitle}><div><span className={styles.fileDotHtml} /> <strong>index.html</strong></div><span>{html.length.toLocaleString()} / {MAX_HTML_LENGTH.toLocaleString()}</span></div>
            <p className={styles.editorHelp}>Write the page structure and content. Use two spaces for indentation; Tab inserts spaces.</p>
            <textarea className={styles.codeEditor} aria-label="HTML source code" spellCheck={false} autoCapitalize="off" autoComplete="off" autoCorrect="off" value={html} onChange={(event) => setHtml(event.target.value)} onKeyDown={(event) => handleTab(event, "html")} maxLength={MAX_HTML_LENGTH} rows={24} disabled={locked || saving} />
          </section>
          <section className={styles.editorPanel}>
            <div className={styles.editorTitle}><div><span className={styles.fileDotCss} /> <strong>styles.css</strong></div><span>{css.length.toLocaleString()} / {MAX_CSS_LENGTH.toLocaleString()}</span></div>
            <p className={styles.editorHelp}>Define colours, spacing, layout, responsive rules, and focus/hover states.</p>
            <textarea className={styles.codeEditor} aria-label="CSS source code" spellCheck={false} autoCapitalize="off" autoComplete="off" autoCorrect="off" value={css} onChange={(event) => setCss(event.target.value)} onKeyDown={(event) => handleTab(event, "css")} maxLength={MAX_CSS_LENGTH} rows={24} disabled={locked || saving} />
          </section>
        </div>

        <section className={styles.previewPanel}>
          <div className={styles.previewHeader}><div><span className={styles.eyebrow}>LIVE RENDER</span><h3>Website preview</h3></div><div className={styles.previewControls} role="group" aria-label="Preview viewport"><button type="button" onClick={() => setPreviewMode("desktop")} className={previewMode === "desktop" ? styles.previewSelected : ""} aria-pressed={previewMode === "desktop"}>Desktop</button><button type="button" onClick={() => setPreviewMode("tablet")} className={previewMode === "tablet" ? styles.previewSelected : ""} aria-pressed={previewMode === "tablet"}>Tablet</button><button type="button" onClick={() => setPreviewMode("mobile")} className={previewMode === "mobile" ? styles.previewSelected : ""} aria-pressed={previewMode === "mobile"}>Mobile</button><button type="button" onClick={() => setPreviewKey((value) => value + 1)} className={styles.refreshPreview}>Refresh preview</button></div></div>
          <div className={styles.previewStage}>
            <div className={styles.previewFrame} style={{ width: previewWidth, maxWidth: "100%" }}><iframe key={previewKey} title="Sandboxed HTML and CSS website preview" sandbox="" referrerPolicy="no-referrer" srcDoc={previewDocument} /></div>
          </div>
          <p className={styles.previewNote}>This preview intentionally disables JavaScript, form submission, pop-ups and external network requests. It is designed for HTML and CSS practice.</p>
        </section>

        <section className={styles.checksPanel}>
          <div className={styles.checksHeader}><div><span className={styles.eyebrow}>SELF-CHECK</span><h3>Before you submit</h3></div><span className={styles.checkCount}>{checks.filter((check) => check.passed).length} / {checks.length} checks</span></div>
          <div className={styles.checkList}>{checks.map((check) => <div key={check.label} className={check.passed ? styles.checkPassed : styles.checkPending}><span aria-hidden="true">{check.passed ? "✓" : "○"}</span>{check.label}</div>)}</div>
          <p className={styles.editorHelp}>These checks are hints, not a full validator. Review the actual preview at all three widths and confirm your links, content and visual hierarchy make sense.</p>
        </section>

        <section className={styles.reflectionPanel}>
          <label htmlFor="html-css-reflection"><span className={styles.eyebrow}>PROJECT REFLECTION</span><strong>Explain your design decisions</strong><span>Describe one design choice, one responsive issue you tested or fixed, and one accessibility check you completed. Required before final submission.</span></label>
          <textarea id="html-css-reflection" value={reflection} onChange={(event) => setReflection(event.target.value)} maxLength={MAX_REFLECTION_LENGTH} rows={4} disabled={locked || saving} placeholder="I chose this layout because… On mobile I noticed… I checked accessibility by…" />
          <small>{reflection.length.toLocaleString()} / {MAX_REFLECTION_LENGTH.toLocaleString()} characters</small>
        </section>

        {message && <div className={`${styles.message} ${message.kind === "error" ? styles.messageError : message.kind === "success" ? styles.messageSuccess : styles.messageInfo}`} role={message.kind === "error" ? "alert" : "status"}>{message.text}</div>}

        <div className={styles.actionBar}>
          <div className={styles.downloadActions}><button type="button" className={styles.secondaryButton} onClick={downloadHtmlFile}>Download index.html</button><button type="button" className={styles.secondaryButton} onClick={downloadCssFile}>Download styles.css</button><button type="button" className={styles.secondaryButton} disabled={locked || saving} onClick={() => changeTemplate("business")}>Reset to starter</button></div>
          <div className={styles.saveActions}><button type="button" className={styles.secondaryButton} disabled={locked || saving} onClick={() => void saveProject("draft")}>{saving ? "Saving…" : "Save draft"}</button><button type="button" className={styles.primaryButton} disabled={locked || saving} onClick={() => void saveProject("submitted")}>{saving ? "Submitting…" : status === "revision_required" ? "Resubmit for review" : "Submit project"}</button></div>
        </div>
        <p className={styles.privacyNote}>Only your submitted project text and code are sent to RuffNeck Learn for saving and review. The live preview runs in a sandboxed frame. Do not include passwords, personal contact details or secrets in your code.</p>
      </section>
    </div>
  );
}
