# Developer guide

## Setup and commands

Use Node/npm compatible with the locked dependencies. The repo does not declare `engines` or `.nvmrc`; current snapshot was exercised using Node 24 and npm with the checked-in lock file.

```sh
npm ci
npm run dev
npm run test:all
npm run build
npm run lint
```

`npm run lint` covers all files and may report existing project-wide issues. For a focused review use `npx eslint path/to/changed-file.jsx`. Optional suites include `test:api`, `test:listing`, `test:anthropic`, `test:sold`, `test:fx`, `test:seo`. `node check-i18n.cjs` validates translation structure; `node check-public-images.cjs` checks image references. Additional `tests/e2e/` flows may need a local Supabase test stack and external tools; follow `tests/e2e/README.md` before running them.

## Runtime configuration

Acquire secrets through the team's authorized secret manager. Read variable **names only** in `INTEGRATIONS.md` and `rg 'process.env|import.meta.env' api src server supabase/functions`. No env file or secret values are part of this guide. Client variables are public: never put service-role keys, bot tokens or private API keys behind `VITE_`.

Local setup needs Supabase URL and publishable/anon key for client/backend reads; some tests use mocks and do not require production credentials. Server-only flows need their own local secret values. Do not use a real production service-role key for ad-hoc local work unless authorized.

## Where to change things

- Routes: `src/App.jsx`; production rewrites/redirects: `vercel.json`.
- Page and UI: `src/pages/` and `src/components/`; admin primitives in `src/components/admin/`.
- Shared auth/data: `src/Context.jsx`; Supabase client: `src/supabase.js`.
- New localization: update all `src/locales/{ru,en,uz}/translation.json`; verify i18n checker; avoid inline text where translation pattern is used.
- Client data logic: `src/utils/`, `src/hooks/`, `src/api/`; keep secrets/server-only operations out of client bundles.
- Vercel endpoint: add one top-level `api/name.js` handler, define allowed method(s), validate body/headers, authenticate privileged work, bound input/time, avoid logging PII, and update `API.md`/tests.
- Supabase query/schema: inspect existing callers, SQL, RPC and RLS; use explicit selected columns. Never run a production migration without a change plan, backup and approval.
- SEO metadata: `src/utils/staticPages.js`, `districtPages.js`, translations; SSR templates in `api/_seoMeta.js`, behavior in `api/spa.js` and sitemap in `api/sitemap.js`.
- Lead intake: client callers use `src/utils/sendLead.js` → `/api/lead`; preserve idempotency, sanitization, Turnstile, CRM status handling and PII boundary.
- AI listing parser: `api/listingParser.js`, `api/_listingFacts.js`, `_districtRules.js`, `aiProviders.js`; do not bypass factual evidence checks.
- Telegram: webhook and finalizer in `api/`; polling alternative in `server/bot.js`; shared persistence/parser logic in API helpers.

## Safe change checklist

1. Read `AI_CONTEXT.md` and the matching technical reference.
2. Search exact symbol/path in runtime code, config, tests, public resources and import aliases before removing or renaming.
3. Preserve existing UX, business and API contracts unless asked to change them.
4. Update language variants, input validation, tests and docs together where applicable.
5. Run the smallest relevant tests, then `npm run test:all`, `npm run build` and focused ESLint on changed files. State any skipped/failed step.
6. Do not silently repair unrelated lint warnings, dependency tree or generated files in a feature task.
7. Update `CHANGELOG_AI.md` with date, change, reason, files, verification and outstanding issues.
