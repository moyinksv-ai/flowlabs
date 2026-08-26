# FlowLab 3.2

FlowLab is a local-first creative memory and songwriting workspace. It is designed around the workflow: **capture → connect → develop → version → revisit**.

## The simple phone workflow

This project has **no Vite/build step**. The same project root is used in Acode, GitHub, and Vercel.

### In Acode

1. Open the **FlowLab folder itself**. Do not open `index.html` from a file manager.
2. Open Acode's Preview for `index.html`. Acode's preview should serve the folder over HTTP so ES modules work.
3. For cloud/auth testing on the phone, put your Supabase **project URL** and **publishable key** in `config.js`.
4. For local-only testing, leave the placeholders untouched. The Idea Bank and songs still work locally.

Termux fallback:

```bash
cd /path/to/FlowLab
npm run serve
```

Then open `http://127.0.0.1:4173/` in Chrome.

## GitHub → Vercel

Upload the **contents of this folder** to the root of your GitHub repository. There should be an `index.html` directly at the repository root—not another `FlowLab` folder around it.

Connect that repository to Vercel. No build command is required because the frontend is static and Vercel serves the `/api/*.js` functions.

## Supabase

1. Create a Supabase project.
2. Open SQL Editor.
3. Run `supabase/migrations/001_initial.sql` once.
4. Copy the project URL and **publishable key** into `config.js` for browser use.
5. In Supabase Auth settings, configure your deployed site URL and allowed redirect URLs as appropriate for your project.

The browser intentionally never contains a Supabase secret key.

## Vercel environment variables

Set these in the Vercel project settings:

```text
GEMINI_API_KEY=your Gemini API key
GEMINI_MODEL=gemini-2.5-flash-lite
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your Supabase publishable key
```

`GEMINI_API_KEY` stays server-side in the Vercel function. Do not put it in `config.js` or commit it to GitHub.

## What is already implemented

- Creative Idea Bank with hooks, concepts, phrases, melodies, unfinished lines, themes, references, snippets, voice notes, discarded versions and other fragments.
- Local-first persistence with IndexedDB/localStorage.
- Songs and immutable versions.
- Explicit idea-to-song links.
- Archive instead of destructive deletion.
- Browser audio capture for melody/voice-note ideas.
- Supabase Auth, Postgres, RLS, and private audio storage integration.
- Vercel Gemini endpoint with session validation.
- Offline-capable service worker that never caches `/api/*` responses.

## Validation

```bash
npm run preflight
npm test
npm run check
```

There is intentionally no `npm run build`. The production frontend is plain static HTML/CSS/ES modules so the exact same files can be previewed from Acode and deployed by Vercel.
