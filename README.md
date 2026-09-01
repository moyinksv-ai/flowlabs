# FlowLab 4.0 — deploy package

This package is intentionally flat: every project file is at the repository root. There is no `src/`, `api/`, `script/`, or `supabase/` folder to create in GitHub.

## Deploy to Vercel

1. Upload the contents of this package to the root of your GitHub repository.
2. Import that GitHub repository into Vercel. Do not add a Build Command or Output Directory.
3. In Vercel Environment Variables add `GEMINI_API_KEY`, `GEMINI_MODEL`, `SUPABASE_URL`, and `SUPABASE_PUBLISHABLE_KEY`.
4. Put the same public Supabase URL and publishable key into `config.js` for browser auth/sync.
5. Run `supabase.sql` once in the Supabase SQL Editor.
6. Push the files to GitHub. Vercel will deploy automatically.

The old `vercel.json` runtime declaration is deliberately absent. Vercel supports Express deployment with zero configuration, and Node version is controlled by `package.json` instead.

## Local/Acode preview

Open the project through Acode Preview or a web server. Do not use a `file://` URL. The frontend uses classic browser scripts, so it does not require a bundler.

## Security

`GEMINI_API_KEY` is server-only. Never put it in `config.js` or client-side JavaScript. Supabase browser access uses the publishable key plus the signed-in user's JWT and is protected by RLS.

## Health check

After deployment, open `/api/health`. It should return JSON with `status: ok`.
