# RuffNeck Learn — Phase 1 (Next.js)

Learning portal connected to your **ruffneck-entertainment** Supabase project.

## Features (Phase 1)

- Home + course catalogue
- Course detail + curriculum (safe titles)
- Auth: sign up / log in / sign out
- Free enrollment (published free courses only)
- Student dashboard + progress %
- Lesson player + “Mark complete”
- Admin overview (admin/instructor only)
- Middleware protects `/student`, `/learn`, `/admin`

**Not included yet:** Flutterwave, quizzes, certificates.

## Setup

### 1. Environment

```bash
cd lms/web
cp .env.example .env.local
```

Edit `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://grehbumrnrgimwwyiqua.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from Supabase → Project Settings → API → anon public>
NEXT_PUBLIC_SITE_URL=https://ruffneck-entertainment.vercel.app
```

### 2. Supabase Auth URL config

In Supabase → **Authentication** → **URL configuration**:

- Site URL: `http://localhost:3000` (dev) or your LMS Vercel URL
- Redirect URLs: add `http://localhost:3000/**` and your production LMS URL

### 3. Install & run

```bash
npm install
npm run dev
```

Open http://localhost:3000

Log in as **ruffneckhassan@gmail.com** (admin).

### 4. Deploy (Vercel)

- New Vercel project → root `lms/web`
- Add the same env vars
- Deploy
- Update Supabase Auth redirect URLs to the Vercel domain

Optional: put LMS under a path or subdomain, e.g. `learn.ruffneck-entertainment...`, and link **Learn** from the main site.

## Test checklist

1. Anonymous: see published courses, open `ai-literacy`, see curriculum  
2. Student: sign up → enroll free → open lessons → mark complete → progress % rises  
3. Admin: `/admin/lms` shows courses and counts  
4. Cannot enroll paid course until Phase 2  

## Project layout

```
src/app/           pages (App Router)
src/components/    EnrollButton, CompleteLessonButton, Header
src/lib/supabase/  browser + server clients, middleware helper
```
