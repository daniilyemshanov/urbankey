# UrbanKey — AI context

UrbanKey is a React 19/Vite 8 real-estate catalog for Tashkent, deployed/configured for Vercel with Supabase data/auth/storage. UI languages are Russian, Uzbek and English. The ZIP snapshot has no Git history or evidence of current production settings.

## Architecture in one minute

- Start in `src/main.jsx` → `src/App.jsx`; localized and account/admin routes use React Router. Most screens are lazy-loaded.
- `src/Context.jsx` is the broad client data/auth context. `src/supabase.js` is a browser client using a public anon/publishable key only.
- `api/*.js` are serverless Vercel handlers; `api/_*.js` are their shared helpers. `server/bot.js` is the optional Telegram polling runtime.
- Residential core uses `cardss` plus `villas`; commercial uses `commercials` plus optional detail `commercial_pages`; public reads use views. Live schema and migrations are unverified; see `DATABASE.md`.
- Leads flow through `/api/lead` to Supabase and optional Telegram/Binotel/CRM integrations. AI provider keys and service credentials are server-side.
- SEO public HTML and sitemap are handled in `api/spa.js` / `api/sitemap.js`; the client UI alone is not the only SEO renderer.

## Hard constraints

- Preserve current architecture, product behavior and visual design unless request explicitly changes them.
- Never expose or echo secrets/PII. Do not read `.env` for general discovery. Never move service-role credentials into `VITE_*`.
- Never apply production SQL, change DNS/Cloudflare/Vercel/Supabase settings, or deploy/push without explicit authorization.
- Do not remove SQL, API integrations, public media or route/component candidates from a bare import count. Check config, route tree, dynamic import/test aliases, runtime path strings and data references.
- Do not create SEO content with fabricated office/NAP, expertise, deals, reviews or market data. Current intent excludes residential rental pages; commercial rent remains supported.

## Status summary

- **Implemented in source:** public localized SPA, user profile/listing flows, admin screens, Telegram parsing variants, lead intake, advanced paginated catalog UI/client parser, CRM/analytics/SEO helpers and Vercel/Supabase configs.
- **Partially implemented:** external accounts/providers, their credentials, Edge deployment, production RLS/views, webhook mode, GA4 property and live SEO.
- **Planned:** ownership-confirmed Local SEO facts, expert articles, profile cleanup, organic lead analysis and repeatable AI-search sampling.
- **Deprecated/isolated:** three React component candidates are preserved in `src/unused/`; five old reports are archived under `docs/project-knowledge/archive/`.
- **Unknown:** current production schema/config, real review/profile identity, live crawls/rankings, secrets history and deploy health.

## Read these files by task

- Overall: `PROJECT_MASTER.md`; architecture: `ARCHITECTURE.md`.
- SQL/RLS/RPC/data access: `DATABASE.md` before any schema edit.
- Catalog search, filters, URL state and RPC: `PROPERTY_SEARCH.md`; the SQL migration requires schema/RLS review and explicit production approval.
- Endpoint: `API.md`; provider or account: `INTEGRATIONS.md`.
- SEO work: `SEO_GEO.md` plus `docs/SEO-GEO-FINAL-REPORT.md` and `docs/SEO-GEO-90-DAY-PLAN.md`.
- Local setup or coding patterns: `DEVELOPMENT_GUIDE.md`.
- Historical rationale only: `archive/README.md` and linked legacy notes.

## Before finishing significant work

Run focused tests and then `npm run test:all`, `npm run build`, focused ESLint for changed files. Review diff/status where Git exists; this supplied snapshot has none. Document production limitations, update the relevant reference and append `CHANGELOG_AI.md`. Never claim a production operation/check happened when only mocked/local code was tested.
