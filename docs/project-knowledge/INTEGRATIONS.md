# External integrations

Status means status of code support in this source snapshot, not confirmed account connectivity. **Unknown** means account credentials, production activity or deployment could not be queried.

| Integration | Status | Code path / function | Safe interpretation / missing proof |
|---|---|---|---|
| Supabase Postgres/Auth/Storage | Partially implemented | `src/supabase.js`, Context, `api/_publicDb.js`, `_listingDb.js`, storage helpers, SQL policies | Required dependency in code. No production URL/key/schema/RLS/dashboard check performed. |
| Supabase Edge Function delete-account | Partially implemented | `supabase/functions/delete-account/`, `supabase/config.toml` | Source/config present, `verify_jwt=false` means function code must validate caller token itself; deployed state unknown. |
| Catalog search RPC | Planned until migration is applied | `sql/advanced_property_search.sql`, `src/api/propertySearch.js` | UI invokes an invoker-rights `search_public_listings` RPC and reports unavailable if missing; production schema/status unknown. Local query parsing makes no paid AI call. |
| Legacy AI search API | Inactive in current UI | `api/ai-search.js`, `src/utils/aiSearch.js` | Retained code supports provider-backed parsing, but the new catalog and hero search do not call it. Runtime availability/credentials unknown. |
| Telegram Bot API — listing ingress | Partially implemented | `api/telegram-webhook.js`, `api/finalize-albums.js`; alternate `server/bot.js` | Webhook and long-poll modes share parser/database helpers; account configuration and which mode is live unknown. Set webhook secret; see `API.md`. |
| Telegram — lead notification | Partially implemented | `api/lead.js` via Telegram `sendMessage` | Requires server bot token/chat ID; production delivery not tested. |
| Binotel | Partially implemented | `api/_binotel.js`, `_leadManagers.js`, `api/lead.js` | Conditional API key/secret and manager mapping; may search/create customers and deals/assign employee. Successful account calls unknown. |
| External CRM webhook | Partially implemented | `api/lead.js` | Conditional `CRM_WEBHOOK_URL`, `CRM_TYPE`, optional secret; generic and named CRM branches in code. Credentials/target environment unknown. |
| GA4 | Partially implemented | `src/analytics.js`, SPA route tracking and form/contact events | Measurement ID and loader exist in source. GA4 property access, consent/tag/network delivery and current data unknown. |
| Cloudflare Turnstile | Partially implemented | `src/components/TurnstileWidget.jsx`, login/forms, `api/lead.js` verification | Client site key is optional by env; server secret needed for submit verification. Keys/config unknown. |
| AI providers | Partially implemented | `api/aiProviders.js`, parser and `ai-search.js` | Chain supports conditional Gemini/Anthropic and OpenAI-compatible providers including other names in source. Only env-configured providers run; actual provider/account status unknown. API key values intentionally omitted. |
| Google Translate endpoint | Active in code; service status unknown | `api/translate.js`, fallback in `api/listingParser.js` | Calls `translate.googleapis.com` public endpoint without a project key; availability/terms/quotas not verified. |
| Central Bank of Uzbekistan (CBU) FX | Active in code; last runtime fetch unknown | `api/_exchangeRate.js`, `/api/exchange-rate`, scheduled updater | Public USD rate endpoint; updater writes to `exchange_rates`; cron is defined in Vercel config, deployment unknown. |
| IndexNow / Bing / Yandex discovery | Partially implemented | `api/_indexNow.js`, `/api/indexnow-sync`, bot write calls | Automatic only under configured runtime conditions; API key file is public by protocol. Webmaster properties and accepted submissions unknown. |
| Vercel | Partially implemented | `vercel.json`, `api/*.js`, `vite.config.js` | Rewrite, headers, cron and function duration are in repo. Project linkage, envs, logs, domains and deployed version unknown. |
| OpenStreetMap tiles / Nominatim / OSRM | Partially implemented | `src/components/MapComponent.jsx`, CSP in `vercel.json` | Browser map and routing make external requests; service usage quotas/network status not tested. |

## Secret/configuration variable names referenced

Names only; no values. Browser-exposed variables include `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY` (publishable/anon only) and optional `VITE_TURNSTILE_SITE_KEY`. Server code references Supabase URL/service key; Telegram tokens and webhook/finalizer secrets; `CRON_SECRET`; Turnstile secret; `CRM_WEBHOOK_URL`, `CRM_WEBHOOK_SECRET`, `CRM_TYPE`; Binotel credentials/mappings; AI provider keys/model options; ALLOWED_ORIGINS; FX and IndexNow toggles. See `rg "process.env|import.meta.env" api src server supabase/functions` before modifying configuration.

Obtain secret values from the approved secret manager. Never copy them into this document, `.env.example`, browser code, commit, logs, or AI prompt.
