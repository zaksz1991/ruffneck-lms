"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
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
type AutoSaveStatus = "clean" | "pending" | "saving" | "saved" | "error";
type StudioApiResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  submission?: { status?: string; score?: number | null; feedback?: string | null; updated_at?: string | null };
};
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

function projectFingerprint(html: string, css: string, reflection: string): string {
  return JSON.stringify([html, css, reflection]);
}

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

type ProjectZipEntry = { path: string; content: string };

const ZIP_CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0
        ? 0xedb88320 ^ (value >>> 1)
        : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function projectCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (crc >>> 8) ^ ZIP_CRC_TABLE[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeZipUint16(target: Uint8Array, offset: number, value: number): void {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
}

function writeZipUint32(target: Uint8Array, offset: number, value: number): void {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
}

/** Creates a small standards-compliant ZIP using the uncompressed STORE method. */
function createProjectZip(entries: ProjectZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;
  const now = new Date();
  const dosYear = Math.max(1980, now.getFullYear());
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((dosYear - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.path);
    const contentBytes = encoder.encode(entry.content);
    const checksum = projectCrc32(contentBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    writeZipUint32(localHeader, 0, 0x04034b50);
    writeZipUint16(localHeader, 4, 20);
    writeZipUint16(localHeader, 6, 0x0800); // UTF-8 filenames
    writeZipUint16(localHeader, 8, 0); // STORE: no compression
    writeZipUint16(localHeader, 10, dosTime);
    writeZipUint16(localHeader, 12, dosDate);
    writeZipUint32(localHeader, 14, checksum);
    writeZipUint32(localHeader, 18, contentBytes.length);
    writeZipUint32(localHeader, 22, contentBytes.length);
    writeZipUint16(localHeader, 26, nameBytes.length);
    writeZipUint16(localHeader, 28, 0);
    localHeader.set(nameBytes, 30);
    localParts.push(localHeader, contentBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    writeZipUint32(centralHeader, 0, 0x02014b50);
    writeZipUint16(centralHeader, 4, 20);
    writeZipUint16(centralHeader, 6, 20);
    writeZipUint16(centralHeader, 8, 0x0800);
    writeZipUint16(centralHeader, 10, 0);
    writeZipUint16(centralHeader, 12, dosTime);
    writeZipUint16(centralHeader, 14, dosDate);
    writeZipUint32(centralHeader, 16, checksum);
    writeZipUint32(centralHeader, 20, contentBytes.length);
    writeZipUint32(centralHeader, 24, contentBytes.length);
    writeZipUint16(centralHeader, 28, nameBytes.length);
    writeZipUint16(centralHeader, 30, 0);
    writeZipUint16(centralHeader, 32, 0);
    writeZipUint16(centralHeader, 34, 0);
    writeZipUint16(centralHeader, 36, 0);
    writeZipUint32(centralHeader, 38, 0);
    writeZipUint32(centralHeader, 42, localOffset);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    localOffset += localHeader.length + contentBytes.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const endRecord = new Uint8Array(22);
  writeZipUint32(endRecord, 0, 0x06054b50);
  writeZipUint16(endRecord, 4, 0);
  writeZipUint16(endRecord, 6, 0);
  writeZipUint16(endRecord, 8, entries.length);
  writeZipUint16(endRecord, 10, entries.length);
  writeZipUint32(endRecord, 12, centralSize);
  writeZipUint32(endRecord, 16, localOffset);
  writeZipUint16(endRecord, 20, 0);

  const totalLength = localOffset + centralSize + endRecord.length;
  const archive = new Uint8Array(totalLength);
  let cursor = 0;
  for (const part of localParts) {
    archive.set(part, cursor);
    cursor += part.length;
  }
  for (const part of centralParts) {
    archive.set(part, cursor);
    cursor += part.length;
  }
  archive.set(endRecord, cursor);
  return archive;
}

function isStudioHazardous(html: string): boolean {
  return /<\s*script\b/i.test(html) || /\son[a-z]+\s*=/i.test(html) || /javascript\s*:/i.test(html);
}

type DiagnosticLevel = "error" | "warning" | "pass" | "info";
type StudioDiagnostic = {
  id: string;
  level: DiagnosticLevel;
  title: string;
  detail: string;
  source?: "HTML" | "CSS";
  line?: number;
};

function sourceLine(source: string, index: number): number {
  return source.slice(0, Math.max(0, index)).split("\n").length;
}

function readAttribute(attributes: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = attributes.match(new RegExp(`\\b${escaped}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match?.[2] ?? null;
}

function inspectCssStructure(css: string): { detail: string; index: number } | null {
  let depth = 0;
  let quote: "'" | '"' | null = null;
  let quoteStart = -1;
  let inComment = false;
  let commentStart = -1;
  let lastOpenBrace = -1;

  for (let index = 0; index < css.length; index += 1) {
    const character = css[index];
    const next = css[index + 1];

    if (inComment) {
      if (character === "*" && next === "/") {
        inComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (character === "\\") {
        index += 1;
        continue;
      }
      if (character === quote) quote = null;
      continue;
    }

    if (character === "/" && next === "*") {
      inComment = true;
      commentStart = index;
      index += 1;
      continue;
    }

    if (character === "'" || character === '"') {
      quote = character;
      quoteStart = index;
      continue;
    }

    if (character === "{") {
      depth += 1;
      lastOpenBrace = index;
    } else if (character === "}") {
      depth -= 1;
      if (depth < 0) {
        return { detail: "A closing brace appears before a matching opening brace.", index };
      }
    }
  }

  if (inComment) return { detail: "A CSS comment is opened with /* but is not closed with */.", index: commentStart };
  if (quote) return { detail: "A quoted CSS value appears to be missing its closing quote.", index: quoteStart };
  if (depth > 0) return { detail: "One or more CSS blocks are missing a closing brace (}).", index: lastOpenBrace };
  return null;
}

function analyzeHtmlCssProject(html: string, css: string): StudioDiagnostic[] {
  const diagnostics: StudioDiagnostic[] = [];
  const add = (
    id: string,
    level: DiagnosticLevel,
    title: string,
    detail: string,
    source?: "HTML" | "CSS",
    line?: number,
  ) => diagnostics.push({ id, level, title, detail, source, line });

  const h1Matches = Array.from(html.matchAll(/<h1\b/gi));
  if (h1Matches.length === 1) {
    add("h1", "pass", "Exactly one H1 heading", "The page has one primary heading.", "HTML", sourceLine(html, h1Matches[0].index ?? 0));
  } else if (h1Matches.length === 0) {
    add("h1", "error", "Add a primary H1 heading", "Use one descriptive H1 that communicates the page's main purpose.", "HTML");
  } else {
    add("h1", "warning", "Multiple H1 headings found", `Found ${h1Matches.length} H1 headings. Check that the page has one clear primary heading.`, "HTML", sourceLine(html, h1Matches[1].index ?? 0));
  }

  const requiredLandmarks = [
    { tag: "header", title: "Header landmark", detail: "Add a header for the page identity or introductory content." },
    { tag: "nav", title: "Navigation landmark", detail: "Use nav around the main group of navigation links." },
    { tag: "main", title: "Main landmark", detail: "Wrap the primary page content in one main element." },
    { tag: "footer", title: "Footer landmark", detail: "Add a footer for supporting information or closing links." },
  ];
  for (const landmark of requiredLandmarks) {
    const match = new RegExp(`<\\s*${landmark.tag}\\b`, "i").exec(html);
    add(
      `landmark-${landmark.tag}`,
      match ? "pass" : "warning",
      match ? `${landmark.tag} landmark found` : `Consider adding a ${landmark.tag} landmark`,
      match ? `The page includes a ${landmark.tag} element.` : landmark.detail,
      "HTML",
      match ? sourceLine(html, match.index) : undefined,
    );
  }

  const idMatches = Array.from(html.matchAll(/\bid\s*=\s*(["'])(.*?)\1/gi));
  const idLocations = new Map<string, number[]>();
  for (const match of idMatches) {
    const value = (match[2] ?? "").trim();
    if (!value) continue;
    const locations = idLocations.get(value) ?? [];
    locations.push(match.index ?? 0);
    idLocations.set(value, locations);
  }
  const duplicates = Array.from(idLocations.entries()).filter(([, locations]) => locations.length > 1);
  if (duplicates.length) {
    const [duplicateId, locations] = duplicates[0];
    add("duplicate-id", "error", "Duplicate HTML IDs", `The id "${duplicateId}" appears more than once. IDs should be unique so links and labels target the correct element.`, "HTML", sourceLine(html, locations[1]));
  } else {
    add("duplicate-id", "pass", "HTML IDs are unique", "No duplicate non-empty id attributes were detected.", "HTML");
  }

  const knownIds = new Set(idLocations.keys());
  const brokenAnchors: Array<{ href: string; index: number }> = [];
  const emptyAnchors: Array<{ index: number }> = [];
  const anchorTags = Array.from(html.matchAll(/<a\b([^>]*)>/gi));
  for (const anchor of anchorTags) {
    const attributes = anchor[1] ?? "";
    const href = readAttribute(attributes, "href");
    const index = anchor.index ?? 0;
    if (href === null || href.trim() === "" || href.trim() === "#") {
      emptyAnchors.push({ index });
      continue;
    }
    if (href.trim().startsWith("#")) {
      let target = href.trim().slice(1);
      try { target = decodeURIComponent(target); } catch { /* Keep the literal fragment for reporting. */ }
      if (target && !knownIds.has(target)) brokenAnchors.push({ href: href.trim(), index });
    }
  }
  if (brokenAnchors.length) {
    const first = brokenAnchors[0];
    add("broken-anchor", "warning", "Internal link target not found", `The link ${first.href} does not match an id in the HTML. Check spelling or add the target section.`, "HTML", sourceLine(html, first.index));
  } else {
    add("broken-anchor", "pass", "Internal section links checked", "No missing targets were detected for fragment links.", "HTML");
  }
  if (emptyAnchors.length) {
    add("empty-link", "warning", "Empty or placeholder links", `${emptyAnchors.length} link(s) have no useful destination. Replace empty href values or href="#" with a real destination.`, "HTML", sourceLine(html, emptyAnchors[0].index));
  } else {
    add("empty-link", "pass", "Links have destinations", "No empty href values or href='#' placeholders were detected.", "HTML");
  }

  const imageTags = Array.from(html.matchAll(/<img\b([^>]*)>/gi));
  const missingAlt = imageTags.filter((match) => readAttribute(match[1] ?? "", "alt") === null);
  if (missingAlt.length) {
    add("image-alt", "error", "Image alt text missing", `${missingAlt.length} image(s) have no alt attribute. Add concise alternative text, or alt="" for decorative images.`, "HTML", sourceLine(html, missingAlt[0].index ?? 0));
  } else {
    add("image-alt", "pass", imageTags.length ? "Images have alt attributes" : "No images need alt text yet", imageTags.length ? "Each image includes an alt attribute; review whether each description is meaningful." : "No img elements were detected, so there are no image alt attributes to check.", "HTML");
  }

  const linkMatches = Array.from(html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi));
  const unnamedLinks = linkMatches.filter((match) => {
    const attributes = match[1] ?? "";
    const inner = match[2] ?? "";
    const accessibleLabel = readAttribute(attributes, "aria-label");
    const text = inner.replace(/<[^>]*>/g, " ").replace(/&(?:nbsp|#\d+|#x[0-9a-f]+);/gi, " ").trim();
    const imageAlt = Array.from(inner.matchAll(/<img\b([^>]*)>/gi)).some((img) => Boolean(readAttribute(img[1] ?? "", "alt")?.trim()));
    return !text && !accessibleLabel?.trim() && !imageAlt;
  });
  if (unnamedLinks.length) {
    add("link-names", "warning", "Link text needs an accessible name", `${unnamedLinks.length} link(s) appear to have no readable text, aria-label, or named image. Give each link a clear purpose.`, "HTML", sourceLine(html, unnamedLinks[0].index ?? 0));
  } else {
    add("link-names", "pass", "Links have accessible names", "All detected anchor links have readable text or another simple accessible name.", "HTML");
  }

  const controls = Array.from(html.matchAll(/<(input|select|textarea)\b([^>]*)>/gi)).filter((match) => {
    const tag = (match[1] ?? "").toLowerCase();
    const type = readAttribute(match[2] ?? "", "type")?.toLowerCase();
    return !(tag === "input" && type === "hidden");
  });
  const labels = Array.from(html.matchAll(/<label\b[^>]*>[\s\S]*?<\/label\s*>/gi));
  const unlabeledControls = controls.filter((control) => {
    const attributes = control[2] ?? "";
    if (readAttribute(attributes, "aria-label")?.trim() || readAttribute(attributes, "aria-labelledby")?.trim()) return false;
    const id = readAttribute(attributes, "id");
    if (id) {
      const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`<label\\b[^>]*\\bfor\\s*=\\s*(["'])${escapedId}\\1`, "i").test(html)) return false;
    }
    const controlIndex = control.index ?? 0;
    return !labels.some((label) => {
      const start = label.index ?? 0;
      return controlIndex >= start && controlIndex < start + label[0].length;
    });
  });
  if (controls.length === 0) {
    add("field-labels", "pass", "No form fields detected", "No input, select, or textarea controls require label checks.", "HTML");
  } else if (unlabeledControls.length) {
    add("field-labels", "warning", "Check form control labels", `${unlabeledControls.length} field(s) may not have an associated label. Use a wrapping label, matching label-for/id, or aria-label.`, "HTML", sourceLine(html, unlabeledControls[0].index ?? 0));
  } else {
    add("field-labels", "pass", "Form controls have labels", "Each detected form control has a matching label or accessible-name attribute.", "HTML");
  }

  const headingMatches = Array.from(html.matchAll(/<h([1-6])\b/gi));
  let headingJump: RegExpMatchArray | null = null;
  for (let index = 1; index < headingMatches.length; index += 1) {
    const previousLevel = Number(headingMatches[index - 1][1]);
    const currentLevel = Number(headingMatches[index][1]);
    if (currentLevel > previousLevel + 1) {
      headingJump = headingMatches[index];
      break;
    }
  }
  if (headingJump) {
    add("heading-order", "warning", "Heading levels skip a level", `The page jumps from a lower-numbered heading to H${headingJump[1]}. Use a logical heading hierarchy so sections remain understandable to assistive technology.`, "HTML", sourceLine(html, headingJump.index ?? 0));
  } else {
    add("heading-order", "pass", "Heading order looks consistent", "No skipped heading levels were detected in the heading sequence.", "HTML");
  }

  if (isStudioHazardous(html)) {
    add("html-sandbox", "error", "Remove scripts and inline event handlers", "This lab accepts HTML and CSS only. Script tags, event-handler attributes, and javascript: URLs are blocked.", "HTML");
  } else {
    add("html-sandbox", "pass", "HTML stays within the lab's rules", "No script tags, inline event handlers, or javascript: URLs were detected.", "HTML");
  }

  const structureIssue = inspectCssStructure(css);
  if (structureIssue) {
    add("css-structure", "error", "CSS structure needs attention", structureIssue.detail, "CSS", sourceLine(css, structureIssue.index));
  } else {
    add("css-structure", "pass", "CSS braces, strings and comments are balanced", "No unmatched block braces, unclosed quoted values, or unclosed comments were detected.", "CSS");
  }

  const mediaMatch = /@media\b/i.exec(css);
  if (!mediaMatch) {
    add("responsive-media", "error", "Responsive media query missing", "Add an @media rule and adapt the layout for narrower viewports.", "CSS");
  } else {
    add("responsive-media", "pass", "Responsive media query found", "The stylesheet contains an @media rule.", "CSS", sourceLine(css, mediaMatch.index));
  }
  if (mediaMatch && !/@media[^{}]*\(\s*(?:max-width|min-width|width\s*[<>])/i.test(css)) {
    add("responsive-breakpoint", "warning", "Check the responsive breakpoint", "No common width-based breakpoint was detected. Confirm that the CSS adapts to phone and tablet widths.", "CSS", sourceLine(css, mediaMatch.index));
  } else if (mediaMatch) {
    add("responsive-breakpoint", "pass", "Width-based breakpoint found", "A width-based responsive breakpoint was detected; verify the result in all three previews.", "CSS", sourceLine(css, mediaMatch.index));
  }

  const focusMatch = /:focus-visible\b|:focus\b/i.exec(css);
  if (!focusMatch) {
    add("focus-style", "warning", "Keyboard focus styling not found", "Add a clearly visible :focus-visible style for links and interactive controls.", "CSS");
  } else {
    add("focus-style", "pass", "Keyboard focus selector found", "The stylesheet defines a :focus-visible or :focus rule. Confirm the outline remains visible against each surface.", "CSS", sourceLine(css, focusMatch.index));
  }

  const variableDefinitions = Array.from(css.matchAll(/--[a-zA-Z_][\w-]*\s*:/g));
  const variableUses = Array.from(css.matchAll(/var\(\s*--[a-zA-Z_][\w-]*/g));
  if (variableDefinitions.length && variableUses.length) {
    add("design-tokens", "pass", "CSS custom properties are in use", `Found ${variableDefinitions.length} custom-property definition(s) and ${variableUses.length} var() reference(s).`, "CSS");
  } else {
    add("design-tokens", "warning", "Consider a small CSS design system", "Define reusable custom properties such as --brand, --space and --radius, then use them with var().", "CSS");
  }

  const fixedWidths = Array.from(css.matchAll(/(?:^|[;{])\s*(?:width|min-width)\s*:\s*(\d{3,4})px\b/gi))
    .filter((match) => Number(match[1]) >= 600);
  if (fixedWidths.length) {
    add("fixed-width", "warning", "Large fixed width may overflow on mobile", `Found ${fixedWidths.length} width declaration(s) at 600px or wider. Consider max-width: 100%, flexible units, Grid, Flexbox, or clamp() where appropriate.`, "CSS", sourceLine(css, fixedWidths[0].index ?? 0));
  } else {
    add("fixed-width", "pass", "No large fixed width detected", "No obvious 600px-or-wider fixed width declaration was detected by this simple check.", "CSS");
  }

  const externalResources = /@import\b|url\(\s*["']?https?:\/\//i.exec(css);
  if (externalResources || /\b(?:src|href)\s*=\s*(["'])https?:\/\//i.test(html)) {
    add("external-assets", "warning", "External assets may not appear in preview", "The isolated preview blocks network requests. Prefer included resources, embedded data images, or local assets added to the exported project.", externalResources ? "CSS" : "HTML", externalResources ? sourceLine(css, externalResources.index) : undefined);
  } else {
    add("external-assets", "pass", "No obvious external asset request detected", "No CSS import or common external URL reference was detected.", "CSS");
  }

  add("visual-manual", "info", "Visual checks still require your judgement", "Automated checks cannot reliably judge colour contrast, visual hierarchy, meaning, or whether the page actually works at every width. Inspect the live preview on desktop, tablet and mobile.");
  return diagnostics;
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
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>("clean");
  const [autoSaveCycle, setAutoSaveCycle] = useState(0);
  const currentFingerprint = projectFingerprint(html, css, reflection);
  const currentFingerprintRef = useRef(currentFingerprint);
  currentFingerprintRef.current = currentFingerprint;
  const lastSavedFingerprintRef = useRef(currentFingerprint);
  const autoSaveRequestRef = useRef<Promise<StudioApiResponse> | null>(null);
  const manualSaveInProgressRef = useRef(false);

  type EditorLanguage = "html" | "css";
  type EditorSearchMode = "closed" | "find" | "replace";
  type EditorSearchState = {
    mode: EditorSearchMode;
    find: string;
    replace: string;
    note: string;
  };
  const [editorSearch, setEditorSearch] = useState<Record<EditorLanguage, EditorSearchState>>({
    html: { mode: "closed", find: "", replace: "", note: "" },
    css: { mode: "closed", find: "", replace: "", note: "" },
  });
  const htmlEditorRef = useRef<HTMLTextAreaElement>(null);
  const cssEditorRef = useRef<HTMLTextAreaElement>(null);
  const [htmlScroll, setHtmlScroll] = useState({ top: 0, left: 0 });
  const [cssScroll, setCssScroll] = useState({ top: 0, left: 0 });

  const previewDocument = useMemo(() => makePreviewDocument(html, css), [html, css, previewKey]);
  const rubricTotal = assessmentRubric.reduce((total, item) => total + item.points, 0);
  const locked = status === "submitted" || status === "approved";
  const previewWidth = previewMode === "desktop" ? "100%" : previewMode === "tablet" ? "768px" : "390px";
  const diagnostics = useMemo(() => analyzeHtmlCssProject(html, css), [html, css]);
  const diagnosticErrors = diagnostics.filter((item) => item.level === "error").length;
  const diagnosticWarnings = diagnostics.filter((item) => item.level === "warning").length;
  const diagnosticPasses = diagnostics.filter((item) => item.level === "pass").length;

  useEffect(() => {
    if (locked || saving) return;

    const snapshot = { html, css, reflection };
    const snapshotFingerprint = projectFingerprint(
      snapshot.html,
      snapshot.css,
      snapshot.reflection,
    );

    if (snapshotFingerprint === lastSavedFingerprintRef.current) {
      setAutoSaveStatus((current) =>
        current === "pending" || current === "error" ? "saved" : current,
      );
      return;
    }

    setAutoSaveStatus("pending");
    const timer = window.setTimeout(() => {
      void (async () => {
        // Do not send an outdated snapshot if the student typed again.
        if (currentFingerprintRef.current !== snapshotFingerprint) {
          setAutoSaveCycle((value) => value + 1);
          return;
        }
        if (manualSaveInProgressRef.current) return;

        // Serialize writes so a slower request cannot overwrite newer work.
        const pendingRequest = autoSaveRequestRef.current;
        if (pendingRequest) {
          try {
            await pendingRequest;
          } catch {
            // The next autosave attempt or manual save will report any failure.
          }
          if (currentFingerprintRef.current !== lastSavedFingerprintRef.current) {
            setAutoSaveCycle((value) => value + 1);
          }
          return;
        }

        if (snapshotFingerprint === lastSavedFingerprintRef.current) {
          setAutoSaveStatus("saved");
          return;
        }

        setAutoSaveStatus("saving");
        const request = (async (): Promise<StudioApiResponse> => {
          const response = await fetch(
            `/api/student/labs/${encodeURIComponent(labId)}/studio`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...snapshot, action: "autosave" }),
            },
          );
          const result = await response.json().catch(() => null) as StudioApiResponse | null;
          if (!response.ok || !result?.ok) {
            throw new Error(result?.error || "Autosave failed. Use Save draft to retry.");
          }
          return result;
        })();
        autoSaveRequestRef.current = request;

        try {
          const result = await request;
          lastSavedFingerprintRef.current = snapshotFingerprint;
          if (result.submission?.status) setStatus(result.submission.status);
          if (result.submission && "score" in result.submission) {
            setScore(result.submission.score ?? null);
          }
          if (result.submission && "feedback" in result.submission) {
            setFeedback(result.submission.feedback ?? null);
          }
          setUpdatedAt(result.submission?.updated_at ?? new Date().toISOString());

          if (currentFingerprintRef.current === snapshotFingerprint) {
            setAutoSaveStatus("saved");
          } else {
            setAutoSaveStatus("pending");
            setAutoSaveCycle((value) => value + 1);
          }
        } catch {
          setAutoSaveStatus("error");
        } finally {
          if (autoSaveRequestRef.current === request) {
            autoSaveRequestRef.current = null;
          }
        }
      })();
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [html, css, reflection, locked, saving, labId, autoSaveCycle]);

  function getEditorValue(language: EditorLanguage): string {
    return language === "html" ? html : css;
  }

  function setEditorValue(language: EditorLanguage, value: string) {
    if (language === "html") setHtml(value);
    else setCss(value);
  }

  function getEditorRef(language: EditorLanguage) {
    return language === "html" ? htmlEditorRef : cssEditorRef;
  }

  function updateEditorSearch(language: EditorLanguage, patch: Partial<EditorSearchState>) {
    setEditorSearch((current) => ({
      ...current,
      [language]: { ...current[language], ...patch },
    }));
  }

  function toggleEditorSearch(language: EditorLanguage, mode: Exclude<EditorSearchMode, "closed">) {
    updateEditorSearch(language, {
      mode: editorSearch[language].mode === mode ? "closed" : mode,
      note: "",
    });
  }

  function findNext(language: EditorLanguage) {
    const needle = editorSearch[language].find;
    const target = getEditorRef(language).current;
    const value = getEditorValue(language);
    if (!needle) {
      updateEditorSearch(language, { note: "Enter text to find." });
      return;
    }
    if (!target) return;
    let index = value.indexOf(needle, target.selectionEnd);
    if (index < 0) index = value.indexOf(needle, 0);
    if (index < 0) {
      updateEditorSearch(language, { note: "No match found." });
      return;
    }
    target.focus();
    target.setSelectionRange(index, index + needle.length);
    const line = value.slice(0, index).split("\n").length;
    updateEditorSearch(language, { note: `Match selected on line ${line}.` });
  }

  function replaceCurrent(language: EditorLanguage) {
    const search = editorSearch[language];
    const target = getEditorRef(language).current;
    const value = getEditorValue(language);
    if (!search.find || !target) {
      updateEditorSearch(language, { note: "Enter text to find first." });
      return;
    }
    let start = target.selectionStart;
    let end = target.selectionEnd;
    if (value.slice(start, end) !== search.find) {
      let found = value.indexOf(search.find, target.selectionEnd);
      if (found < 0) found = value.indexOf(search.find, 0);
      if (found < 0) {
        updateEditorSearch(language, { note: "No match found." });
        return;
      }
      start = found;
      end = found + search.find.length;
    }
    const next = value.slice(0, start) + search.replace + value.slice(end);
    const characterLimit = language === "html" ? MAX_HTML_LENGTH : MAX_CSS_LENGTH;
    if (next.length > characterLimit) {
      updateEditorSearch(language, { note: `Replacement would exceed the ${characterLimit.toLocaleString()} character limit.` });
      return;
    }
    setEditorValue(language, next);
    updateEditorSearch(language, { note: "Replaced one occurrence." });
    window.requestAnimationFrame(() => {
      target.focus();
      target.setSelectionRange(start + search.replace.length, start + search.replace.length);
    });
  }

  function replaceAll(language: EditorLanguage) {
    const search = editorSearch[language];
    const value = getEditorValue(language);
    if (!search.find) {
      updateEditorSearch(language, { note: "Enter text to find first." });
      return;
    }
    const parts = value.split(search.find);
    const count = parts.length - 1;
    if (count === 0) {
      updateEditorSearch(language, { note: "No match found." });
      return;
    }
    const next = parts.join(search.replace);
    const characterLimit = language === "html" ? MAX_HTML_LENGTH : MAX_CSS_LENGTH;
    if (next.length > characterLimit) {
      updateEditorSearch(language, { note: `Replace all would exceed the ${characterLimit.toLocaleString()} character limit.` });
      return;
    }
    setEditorValue(language, next);
    updateEditorSearch(language, { note: `Replaced ${count} occurrence${count === 1 ? "" : "s"}.` });
  }

  function indentEditor(event: KeyboardEvent<HTMLTextAreaElement>, language: EditorLanguage) {
    const target = event.currentTarget;
    const value = getEditorValue(language);
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const selected = value.slice(start, end);
    const outdent = event.shiftKey;

    if (selected.includes("\n")) {
      event.preventDefault();
      const blockStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
      let blockEnd = value.indexOf("\n", end);
      if (blockEnd < 0) blockEnd = value.length;
      const block = value.slice(blockStart, blockEnd);
      const lines = block.split("\n");
      const changedLines = lines.map((line) => {
        if (!outdent) return `  ${line}`;
        if (line.startsWith("\t")) return line.slice(1);
        if (line.startsWith("  ")) return line.slice(2);
        if (line.startsWith(" ")) return line.slice(1);
        return line;
      });
      const changed = changedLines.join("\n");
      setEditorValue(language, value.slice(0, blockStart) + changed + value.slice(blockEnd));
      window.requestAnimationFrame(() => {
        target.focus();
        target.setSelectionRange(blockStart, blockStart + changed.length);
      });
      return;
    }

    if (outdent) {
      event.preventDefault();
      const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
      const line = value.slice(lineStart);
      const indent = /^(?: {1,2}|\t)/.exec(line)?.[0];
      if (!indent) return;
      const next = value.slice(0, lineStart) + value.slice(lineStart + indent.length);
      setEditorValue(language, next);
      const nextStart = Math.max(lineStart, start - indent.length);
      const nextEnd = Math.max(nextStart, end - indent.length);
      window.requestAnimationFrame(() => {
        target.focus();
        target.setSelectionRange(nextStart, nextEnd);
      });
      return;
    }

    event.preventDefault();
    const next = value.slice(0, start) + "  " + value.slice(end);
    setEditorValue(language, next);
    window.requestAnimationFrame(() => {
      target.focus();
      target.setSelectionRange(start + 2, start + 2);
    });
  }

  function handleEditorKeyDown(event: KeyboardEvent<HTMLTextAreaElement>, language: EditorLanguage) {
    if (locked || saving) return;
    const target = event.currentTarget;
    const modifier = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();

    if (modifier && key === "f") {
      event.preventDefault();
      updateEditorSearch(language, { mode: "find", note: "" });
      return;
    }
    if (modifier && key === "h") {
      event.preventDefault();
      updateEditorSearch(language, { mode: "replace", note: "" });
      return;
    }
    if (modifier && key === "g") {
      event.preventDefault();
      findNext(language);
      return;
    }
    if (event.key === "Tab") {
      indentEditor(event, language);
      return;
    }

    const value = getEditorValue(language);
    const start = target.selectionStart;
    const end = target.selectionEnd;

    if (["}", ")", "]"].includes(event.key) && start === end && value[start] === event.key) {
      event.preventDefault();
      target.setSelectionRange(start + 1, start + 1);
      return;
    }

    const pairs: Record<string, string> = { "{": "}", "(": ")", "[": "]" };
    const close = pairs[event.key];
    if (close && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const selectedText = value.slice(start, end);
      setEditorValue(language, value.slice(0, start) + event.key + selectedText + close + value.slice(end));
      window.requestAnimationFrame(() => {
        target.focus();
        if (selectedText.length > 0) target.setSelectionRange(start + 1, start + 1 + selectedText.length);
        else target.setSelectionRange(start + 1, start + 1);
      });
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
      const linePrefix = value.slice(lineStart, start);
      const indent = /^[ \t]*/.exec(linePrefix)?.[0] ?? "";
      const trimmed = linePrefix.trimEnd();
      const opensCssBlock = language === "css" && trimmed.endsWith("{");
      const opensHtmlElement = language === "html" && /<([a-z][\w:-]*)\b[^>]*>$/i.test(trimmed) && !/\/>$/.test(trimmed) && !/^<\//.test(trimmed);
      const nextChar = value[end];
      const extraIndent = opensCssBlock || opensHtmlElement ? "  " : "";
      if (extraIndent && nextChar === (language === "css" ? "}" : "<")) {
        const closingIndent = `\n${indent}`;
        const insertion = `\n${indent}${extraIndent}${closingIndent}`;
        const next = value.slice(0, start) + insertion + value.slice(end);
        setEditorValue(language, next);
        const cursor = start + 1 + indent.length + extraIndent.length;
        window.requestAnimationFrame(() => {
          target.focus();
          target.setSelectionRange(cursor, cursor);
        });
      } else {
        const insertion = `\n${indent}${extraIndent}`;
        const next = value.slice(0, start) + insertion + value.slice(end);
        setEditorValue(language, next);
        const cursor = start + insertion.length;
        window.requestAnimationFrame(() => {
          target.focus();
          target.setSelectionRange(cursor, cursor);
        });
      }
    }
  }

  function highlightedCode(source: string, language: EditorLanguage): ReactNode[] {
    const pattern = language === "html"
      ? /(<!--[\s\S]*?-->)|(<!--[\s\S]*?$)|(<\/?[A-Za-z][\w:-]*)|(\s+[A-Za-z_:][\w:.-]*)(?=\s*=)|(\s*=\s*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\/?>)|(&(?:#\d+|#x[\da-f]+|[\w]+);)/gi
      : /(\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(@[\w-]+)|(--[\w-]+)|(#[\da-fA-F]{3,8}\b)|([.#][\w-]+)|([A-Za-z_-][\w-]*)(?=\s*:)|(\b\d*\.?\d+(?:px|rem|em|%|vh|vw|s|ms|deg)?\b)|([{}:;,()])/gi;
    const nodes: ReactNode[] = [];
    let offset = 0;
    let keyIndex = 0;
    for (const match of source.matchAll(pattern)) {
      const token = match[0];
      const index = match.index ?? 0;
      if (index > offset) nodes.push(source.slice(offset, index));
      let tokenClass = styles.tokenPlain;
      if (language === "html") {
        if (match[1] || match[2]) tokenClass = styles.tokenComment;
        else if (match[3]) tokenClass = styles.tokenTag;
        else if (match[4]) tokenClass = styles.tokenAttribute;
        else if (match[5]) tokenClass = styles.tokenOperator;
        else if (match[6]) tokenClass = styles.tokenString;
        else if (match[7]) tokenClass = styles.tokenPunctuation;
        else if (match[8]) tokenClass = styles.tokenEntity;
      } else {
        if (match[1]) tokenClass = styles.tokenComment;
        else if (match[2]) tokenClass = styles.tokenString;
        else if (match[3]) tokenClass = styles.tokenAtRule;
        else if (match[4]) tokenClass = styles.tokenVariable;
        else if (match[5] || match[6]) tokenClass = styles.tokenColor;
        else if (match[7]) tokenClass = styles.tokenProperty;
        else if (match[8]) tokenClass = styles.tokenNumber;
        else if (match[9]) tokenClass = styles.tokenPunctuation;
      }
      nodes.push(<span key={`token-${keyIndex++}`} className={tokenClass}>{token}</span>);
      offset = index + token.length;
    }
    if (offset < source.length) nodes.push(source.slice(offset));
    return nodes.length ? nodes : [" "];
  }

  function changeTemplate(nextTemplateId: TemplateId) {
    const changed = html !== TEMPLATES[nextTemplateId].html || css !== TEMPLATES[nextTemplateId].css;
    if (changed && !window.confirm("Switching templates replaces the HTML and CSS currently in the editor. Continue?")) return;
    setTemplateId(nextTemplateId);
    setHtml(TEMPLATES[nextTemplateId].html);
    setCss(TEMPLATES[nextTemplateId].css);
    setReflection("");
    setMessage({ kind: "info", text: `Loaded the ${TEMPLATES[nextTemplateId].label} starter template. Changes will autosave after a short pause; you can also save a draft manually.` });
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

    manualSaveInProgressRef.current = true;
    setSaving(true);
    try {
      const pendingAutoSave = autoSaveRequestRef.current;
      if (pendingAutoSave) {
        try {
          await pendingAutoSave;
        } catch {
          // Continue with the explicit user-requested save.
        }
      }
      const response = await fetch(`/api/student/labs/${encodeURIComponent(labId)}/studio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, css, reflection, action }),
      });
      const result = await response.json().catch(() => null) as StudioApiResponse | null;
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Unable to save the project. Please try again.");
      }
      const nextStatus = result.submission?.status ?? (action === "draft" ? "draft" : "submitted");
      setStatus(nextStatus);
      setScore(result.submission?.score ?? null);
      setFeedback(result.submission?.feedback ?? feedback);
      setUpdatedAt(result.submission?.updated_at ?? new Date().toISOString());
      lastSavedFingerprintRef.current = projectFingerprint(html, css, reflection);
      setAutoSaveStatus("saved");
      setMessage({ kind: "success", text: result.message || (action === "draft" ? "Draft saved." : "Project submitted for review.") });
      router.refresh();
    } catch (error: unknown) {
      setAutoSaveStatus("error");
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "A network error occurred. Please try again." });
    } finally {
      manualSaveInProgressRef.current = false;
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
  function downloadProjectZip() {
    const zipHtml = `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>${labTitle.replace(/[<>]/g, "")}</title>\n  <link rel="stylesheet" href="styles.css">\n</head>\n<body>\n${html}\n</body>\n</html>\n`;
    const reflectionFile = reflection.trim()
      ? `${reflection.trim()}\n`
      : "No project reflection was provided yet.\n";
    const projectReadme = `# ${labTitle}\n\nExported from RuffNeck Learn's Advanced HTML & CSS Website Studio.\n\n## Files\n\n- \`index.html\`: the page structure and content.\n- \`styles.css\`: the visual design and responsive layout.\n- \`project-reflection.txt\`: the reflection entered in the learning studio.\n\n## Open the project\n\n1. Extract this ZIP archive.\n2. Keep \`index.html\` and \`styles.css\` in the same folder.\n3. Open \`index.html\` in a modern web browser.\n4. Edit the HTML and CSS with a code editor to continue developing the project.\n\n## Notes\n\nThis practice project is built for HTML and CSS. The RuffNeck Learn preview blocks JavaScript and external network requests by design. Links that point to external websites may need internet access when opened outside the learning studio.\n`;
    const archive = createProjectZip([
      { path: `${safeProjectName}/index.html`, content: zipHtml },
      { path: `${safeProjectName}/styles.css`, content: css },
      { path: `${safeProjectName}/README.md`, content: projectReadme },
      { path: `${safeProjectName}/project-reflection.txt`, content: reflectionFile },
    ]);
    const archiveBuffer = new ArrayBuffer(archive.byteLength);
    new Uint8Array(archiveBuffer).set(archive);
    const blob = new Blob([archiveBuffer], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeProjectName}-project.zip`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  const autoSaveLabel = autoSaveStatus === "pending"
    ? "Unsaved changes · saving shortly"
    : autoSaveStatus === "saving"
      ? "Auto-saving…"
      : autoSaveStatus === "saved"
        ? "All changes saved"
        : autoSaveStatus === "error"
          ? "Autosave failed · use Save draft"
          : "Auto-save enabled";
  const autoSaveClass = autoSaveStatus === "error"
    ? styles.autoSaveError
    : autoSaveStatus === "saved"
      ? styles.autoSaveSuccess
      : autoSaveStatus === "saving"
        ? styles.autoSaveSaving
        : styles.autoSavePending;

  return (
    <div className={styles.studio}>
      <div className={styles.studioTopline}>
        <a href="/student/labs" className={styles.backLink}>← All practical labs</a>
        <div className={styles.toplineRight}>
          <span className={`${styles.statusPill} ${status === "approved" ? styles.statusApproved : status === "submitted" ? styles.statusSubmitted : status === "revision_required" ? styles.statusRevision : ""}`}>{status === "new" ? "Not started" : status.replaceAll("_", " ")}</span>
          {!locked && <span className={`${styles.autoSaveIndicator} ${autoSaveClass}`} role="status" aria-live="polite">{autoSaveLabel}</span>}
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
          <div><span className={styles.eyebrow}>YOUR WORKSPACE</span><h2>Build. Preview. Improve.</h2><p>Edit HTML and CSS side-by-side. Changes autosave after about 1.2 seconds of inactivity. The preview runs in an isolated frame with scripts and network requests blocked.</p></div>
          <label className={styles.templateSelect}>Starter template<select value={templateId} onChange={(event) => changeTemplate(event.target.value as TemplateId)} disabled={locked || saving}>{Object.entries(TEMPLATES).map(([id, template]) => <option value={id} key={id}>{template.label}</option>)}</select></label>
        </div>
        <div className={styles.editorGrid}>
          <section className={styles.editorPanel}>
            <div className={styles.editorTitle}><div><span className={styles.fileDotHtml} /> <strong>index.html</strong></div><span>{html.length.toLocaleString()} / {MAX_HTML_LENGTH.toLocaleString()}</span></div>
            <p className={styles.editorHelp}>HTML with line numbers, basic syntax highlighting, auto-closing brackets, smart indentation and find/replace.</p>
            <div className={styles.editorTools}>
              <div className={styles.editorToolButtons}>
                <button type="button" className={styles.editorToolButton} onClick={() => toggleEditorSearch("html", "find")} aria-expanded={editorSearch.html.mode !== "closed"}>Find <kbd>Ctrl/⌘ F</kbd></button>
                <button type="button" className={styles.editorToolButton} onClick={() => toggleEditorSearch("html", "replace")} aria-expanded={editorSearch.html.mode === "replace"}>Replace <kbd>Ctrl/⌘ H</kbd></button>
              </div>
              <span className={styles.editorShortcutNote}>Tab indent · Shift+Tab outdent · Ctrl/⌘+G next match</span>
            </div>
            {editorSearch.html.mode !== "closed" && <div className={styles.editorSearchBar}>
              <input className={styles.editorSearchInput} aria-label="Find in HTML" placeholder="Find in HTML…" value={editorSearch.html.find} onChange={(event) => updateEditorSearch("html", { find: event.target.value, note: "" })} onKeyDown={(event) => { if (event.key === "Enter") findNext("html"); if (event.key === "Escape") updateEditorSearch("html", { mode: "closed" }); }} />
              {editorSearch.html.mode === "replace" && <input className={styles.editorSearchInput} aria-label="Replace HTML text with" placeholder="Replace with…" value={editorSearch.html.replace} onChange={(event) => updateEditorSearch("html", { replace: event.target.value, note: "" })} onKeyDown={(event) => { if (event.key === "Enter") replaceCurrent("html"); if (event.key === "Escape") updateEditorSearch("html", { mode: "closed" }); }} />}
              <div className={styles.editorSearchActions}><button type="button" className={styles.editorToolButton} onClick={() => findNext("html")}>Find next</button>{editorSearch.html.mode === "replace" && <><button type="button" className={styles.editorToolButton} onClick={() => replaceCurrent("html")}>Replace</button><button type="button" className={styles.editorToolButton} onClick={() => replaceAll("html")}>Replace all</button></>}</div>
              <span className={styles.editorSearchNote} role="status" aria-live="polite">{editorSearch.html.note}</span>
            </div>}
            <div className={styles.codeEditorShell}>
              <div className={styles.lineNumberGutter} aria-hidden="true"><div className={styles.lineNumberRows} style={{ transform: `translateY(-${htmlScroll.top}px)` }}>{Array.from({ length: html.split("\n").length }, (_, index) => <span key={index}>{index + 1}</span>)}</div></div>
              <div className={styles.codeEditorInputWrap}>
                <pre aria-hidden="true" className={styles.codeHighlight} style={{ transform: `translate(${-htmlScroll.left}px, ${-htmlScroll.top}px)` }}>{highlightedCode(html, "html")}</pre>
                <textarea ref={htmlEditorRef} className={styles.codeEditor} aria-label="HTML source code" spellCheck={false} autoCapitalize="off" autoComplete="off" autoCorrect="off" value={html} onChange={(event) => setHtml(event.target.value)} onScroll={(event) => setHtmlScroll({ top: event.currentTarget.scrollTop, left: event.currentTarget.scrollLeft })} onKeyDown={(event) => handleEditorKeyDown(event, "html")} maxLength={MAX_HTML_LENGTH} rows={24} disabled={locked || saving} />
              </div>
            </div>
          </section>
          <section className={styles.editorPanel}>
            <div className={styles.editorTitle}><div><span className={styles.fileDotCss} /> <strong>styles.css</strong></div><span>{css.length.toLocaleString()} / {MAX_CSS_LENGTH.toLocaleString()}</span></div>
            <p className={styles.editorHelp}>CSS with line numbers, syntax colours, auto-paired braces, smart indentation and find/replace.</p>
            <div className={styles.editorTools}>
              <div className={styles.editorToolButtons}>
                <button type="button" className={styles.editorToolButton} onClick={() => toggleEditorSearch("css", "find")} aria-expanded={editorSearch.css.mode !== "closed"}>Find <kbd>Ctrl/⌘ F</kbd></button>
                <button type="button" className={styles.editorToolButton} onClick={() => toggleEditorSearch("css", "replace")} aria-expanded={editorSearch.css.mode === "replace"}>Replace <kbd>Ctrl/⌘ H</kbd></button>
              </div>
              <span className={styles.editorShortcutNote}>Tab indent · Shift+Tab outdent · Ctrl/⌘+G next match</span>
            </div>
            {editorSearch.css.mode !== "closed" && <div className={styles.editorSearchBar}>
              <input className={styles.editorSearchInput} aria-label="Find in CSS" placeholder="Find in CSS…" value={editorSearch.css.find} onChange={(event) => updateEditorSearch("css", { find: event.target.value, note: "" })} onKeyDown={(event) => { if (event.key === "Enter") findNext("css"); if (event.key === "Escape") updateEditorSearch("css", { mode: "closed" }); }} />
              {editorSearch.css.mode === "replace" && <input className={styles.editorSearchInput} aria-label="Replace CSS text with" placeholder="Replace with…" value={editorSearch.css.replace} onChange={(event) => updateEditorSearch("css", { replace: event.target.value, note: "" })} onKeyDown={(event) => { if (event.key === "Enter") replaceCurrent("css"); if (event.key === "Escape") updateEditorSearch("css", { mode: "closed" }); }} />}
              <div className={styles.editorSearchActions}><button type="button" className={styles.editorToolButton} onClick={() => findNext("css")}>Find next</button>{editorSearch.css.mode === "replace" && <><button type="button" className={styles.editorToolButton} onClick={() => replaceCurrent("css")}>Replace</button><button type="button" className={styles.editorToolButton} onClick={() => replaceAll("css")}>Replace all</button></>}</div>
              <span className={styles.editorSearchNote} role="status" aria-live="polite">{editorSearch.css.note}</span>
            </div>}
            <div className={styles.codeEditorShell}>
              <div className={styles.lineNumberGutter} aria-hidden="true"><div className={styles.lineNumberRows} style={{ transform: `translateY(-${cssScroll.top}px)` }}>{Array.from({ length: css.split("\n").length }, (_, index) => <span key={index}>{index + 1}</span>)}</div></div>
              <div className={styles.codeEditorInputWrap}>
                <pre aria-hidden="true" className={styles.codeHighlight} style={{ transform: `translate(${-cssScroll.left}px, ${-cssScroll.top}px)` }}>{highlightedCode(css, "css")}</pre>
                <textarea ref={cssEditorRef} className={styles.codeEditor} aria-label="CSS source code" spellCheck={false} autoCapitalize="off" autoComplete="off" autoCorrect="off" value={css} onChange={(event) => setCss(event.target.value)} onScroll={(event) => setCssScroll({ top: event.currentTarget.scrollTop, left: event.currentTarget.scrollLeft })} onKeyDown={(event) => handleEditorKeyDown(event, "css")} maxLength={MAX_CSS_LENGTH} rows={24} disabled={locked || saving} />
              </div>
            </div>
          </section>
        </div>

        <section className={styles.previewPanel}>
          <div className={styles.previewHeader}><div><span className={styles.eyebrow}>LIVE RENDER</span><h3>Website preview</h3></div><div className={styles.previewControls} role="group" aria-label="Preview viewport"><button type="button" onClick={() => setPreviewMode("desktop")} className={previewMode === "desktop" ? styles.previewSelected : ""} aria-pressed={previewMode === "desktop"}>Desktop</button><button type="button" onClick={() => setPreviewMode("tablet")} className={previewMode === "tablet" ? styles.previewSelected : ""} aria-pressed={previewMode === "tablet"}>Tablet</button><button type="button" onClick={() => setPreviewMode("mobile")} className={previewMode === "mobile" ? styles.previewSelected : ""} aria-pressed={previewMode === "mobile"}>Mobile</button><button type="button" onClick={() => setPreviewKey((value) => value + 1)} className={styles.refreshPreview}>Refresh preview</button></div></div>
          <div className={styles.previewStage}>
            <div className={styles.previewFrame} style={{ width: previewWidth, maxWidth: "100%" }}><iframe key={previewKey} title="Sandboxed HTML and CSS website preview" sandbox="" referrerPolicy="no-referrer" srcDoc={previewDocument} /></div>
          </div>
          <p className={styles.previewNote}>This preview intentionally disables JavaScript, form submission, pop-ups and external network requests. It is designed for HTML and CSS practice.</p>
        </section>

        <section className={styles.checksPanel} aria-labelledby="studio-diagnostics-title">
          <div className={styles.checksHeader}>
            <div>
              <span className={styles.eyebrow}>ADVANCED CODE DIAGNOSTICS</span>
              <h3 id="studio-diagnostics-title">Inspect before you submit</h3>
            </div>
            <span className={styles.checkCount}>{diagnosticPasses} checks passing</span>
          </div>
          <div className={styles.diagnosticSummary} aria-live="polite">
            <div className={styles.diagnosticStat}><strong>{diagnosticErrors}</strong><span>Needs attention</span></div>
            <div className={styles.diagnosticStat}><strong>{diagnosticWarnings}</strong><span>Suggestions</span></div>
            <div className={styles.diagnosticStat}><strong>{diagnosticPasses}</strong><span>Passed checks</span></div>
          </div>
          <div className={styles.diagnosticList}>
            {diagnostics.map((diagnostic) => (
              <article key={diagnostic.id} className={`${styles.diagnosticItem} ${diagnostic.level === "error" ? styles.diagnosticError : diagnostic.level === "warning" ? styles.diagnosticWarning : diagnostic.level === "info" ? styles.diagnosticInfo : styles.diagnosticPass}`}>
                <div className={styles.diagnosticMeta}>
                  <span className={styles.diagnosticBadge}>{diagnostic.level === "error" ? "Needs attention" : diagnostic.level === "warning" ? "Suggestion" : diagnostic.level === "info" ? "Manual check" : "Passed"}</span>
                  <span>{diagnostic.source ? `${diagnostic.source}${diagnostic.line ? ` · line ${diagnostic.line}` : ""}` : "Project"}</span>
                </div>
                <h4>{diagnostic.title}</h4>
                <p>{diagnostic.detail}</p>
              </article>
            ))}
          </div>
          <p className={styles.editorHelp}>These diagnostics use static checks and may not detect every issue or fully understand valid HTML/CSS. They do not replace the live preview. Check desktop, tablet and mobile layouts, and review contrast and readability manually.</p>
        </section>

        <section className={styles.reflectionPanel}>
          <label htmlFor="html-css-reflection"><span className={styles.eyebrow}>PROJECT REFLECTION</span><strong>Explain your design decisions</strong><span>Describe one design choice, one responsive issue you tested or fixed, and one accessibility check you completed. Required before final submission.</span></label>
          <textarea id="html-css-reflection" value={reflection} onChange={(event) => setReflection(event.target.value)} maxLength={MAX_REFLECTION_LENGTH} rows={4} disabled={locked || saving} placeholder="I chose this layout because… On mobile I noticed… I checked accessibility by…" />
          <small>{reflection.length.toLocaleString()} / {MAX_REFLECTION_LENGTH.toLocaleString()} characters</small>
        </section>

        {message && <div className={`${styles.message} ${message.kind === "error" ? styles.messageError : message.kind === "success" ? styles.messageSuccess : styles.messageInfo}`} role={message.kind === "error" ? "alert" : "status"}>{message.text}</div>}

        <div className={styles.actionBar}>
          <div className={styles.downloadActions}><button type="button" className={styles.secondaryButton} onClick={downloadHtmlFile}>Download index.html</button><button type="button" className={styles.secondaryButton} onClick={downloadCssFile}>Download styles.css</button><button type="button" className={styles.secondaryButton} onClick={downloadProjectZip}>Download project ZIP</button><button type="button" className={styles.secondaryButton} disabled={locked || saving} onClick={() => changeTemplate("business")}>Reset to starter</button></div>
          <div className={styles.saveActions}><button type="button" className={styles.secondaryButton} disabled={locked || saving} onClick={() => void saveProject("draft")}>{saving ? "Saving…" : "Save draft"}</button><button type="button" className={styles.primaryButton} disabled={locked || saving} onClick={() => void saveProject("submitted")}>{saving ? "Submitting…" : status === "revision_required" ? "Resubmit for review" : "Submit project"}</button></div>
        </div>
        <p className={styles.privacyNote}>Only your submitted project text and code are sent to RuffNeck Learn for saving and review. The live preview runs in a sandboxed frame. Do not include passwords, personal contact details or secrets in your code.</p>
      </section>
    </div>
  );
}
