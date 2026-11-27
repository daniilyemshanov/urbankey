# Vercel API reference

**Scope:** Serverless entrypoint files in `api/*.js` without a leading `_`; underscore modules are internal helpers, not endpoints. Vercel maps each entrypoint to `/api/<filename>`. Local in-memory rate limits are per serverless process/instance and are not a distributed quota. Production host, env and endpoint health are **Unknown**.

## Supabase catalog RPC (pending migration)

`src/api/propertySearch.js` calls `public.search_public_listings` over the existing Supabase client. The function is defined in `sql/advanced_property_search.sql`, which is **not applied**. It accepts `p_filters` (JSON: text, category, type, deal type, district, price, room, area, floor, location), `p_sort` (`relevance`, `newest`, `priceAsc`, `priceDesc`), `p_page`, `p_page_size` (clamped to 48), display `p_currency`, `p_rate`, and district aliases. It returns JSON `{ items, total, page, pageSize }`; errors surface as an unavailable-search state. The function is `SECURITY INVOKER`, granted to `anon` and `authenticated`, and reads derived views over the existing public views. Its actual RLS behavior and production grants must be verified after applying it to a non-production project. No privileged key is sent from the browser.

## Public/client-facing endpoints

| Endpoint | Method and input | Authorization / validation | Result and failures | Dependencies |
|---|---|---|---|---|
| `/api/ai-search` | POST JSON `{ query, lang }`; query trimmed and capped at 300 chars; lang falls back to `ru` | Origin host allowlist; in-memory max 15 requests/IP/min; no user auth | 200 `{ok:true,provider,filters}` or `{ok:false}` on provider failure; 400 empty query; 403 Origin; 405 other methods; 429 rate limited | `runListingAiChain`; filters include category, residential type, deal, price, beds, keywords. Anthropic is skipped for this endpoint |
| `/api/exchange-rate` | GET; no parameters | Public; method restricted | 200 `{rate,date}` with CDN caching; 502 `rate_unavailable` and no-store on failure; 405 otherwise | CBU USD rate endpoint; retries/timeouts in `_exchangeRate.js` |
| `/api/lead` | POST JSON `{source,data,captchaToken,company,skipCrm,idempotencyKey}`; idempotency key may also be a header | Origin validation, in-memory IP rate limit, sanitized/allowlisted source and fields, honeypot, Turnstile; skip-CRM requires a verified admin session | 200 `{ok:true}` (including honeypot/dedup); 400 payload/CAPTCHA errors; 403 Origin; 405 wrong method; 429 limit; 500 missing required runtime configuration; DB/dispatch failures handled by status code in handler | Supabase service client, Cloudflare Turnstile, Telegram notification, Binotel, optional CRM webhook |
| `/api/sitemap` (`/sitemap.xml` rewrite) | Public GET via sitemap route; handler has no explicit method allowlist | Public; obtains public-key Supabase client | 200 XML; 503 no-store/Retry-After if database configuration/reads fail | Supabase public views, district inventory, static SEO page data, language helper |
| `/api/spa` | GET through `vercel.json` rewrite; query is an internal routing contract: `kind`, plus `lang`, and one of `id`, `dtype`/`district`, `page` | Public route handler; listing existence is read from public views; no user auth | HTML shell with SSR SEO body; public static/district/listing success 200; missing/unknown route 404 + `X-Robots-Tag`; DB/shell failure 503 no-store; empty district 200 + `noindex` | `index.html` fetched from same host, Supabase, `_seoMeta`, static/district page builders, exchange-rate helper |
| `/api/telegram-webhook` | POST Telegram Update JSON | If `TELEGRAM_WEBHOOK_SECRET` is set, checks `x-telegram-bot-api-secret-token`; if unset, handler does not require this secret. Configure it in production. | Processes accepted message/media updates and returns 200 `{ok:true}`; 405 wrong method; 401 when configured token mismatch; processing errors handled in route | Telegram Bot API, Supabase service client, parser/AI providers, listing DB/media helpers, IndexNow |
| `/api/translate` | POST JSON `{source,targets,texts:[{id,text}]}`; up to 25 texts, each sliced to 2,000 chars | Origin host validation; 20 requests/IP/min in local process; no user auth; only `ru/en/uz` and distinct valid targets | 200 `{results}` with per-item language result and `ok`; 400 invalid source/targets/texts; 403 Origin; 405 wrong method; 429 limit | Google Translate public endpoint (`translate.googleapis.com`), not a dedicated authenticated translation API |

## Privileged / operational endpoints

| Endpoint | Method and input | Authorization / validation | Result and failures | Dependencies |
|---|---|---|---|---|
| `/api/finalize-albums` | GET or POST; `secret` query parameter or `x-finalize-secret` header | Requires `FINALIZE_SECRET`; exact compare; do not share secret query URLs because URLs may be logged | 200 `{ok,processed,checked}` or no-op; 401 missing/invalid; 405 other methods; 500 handler error | Telegram file API, Supabase service client, album rows and shared parser; Vercel maxDuration 60s |
| `/api/indexnow-sync` | GET or POST; no body contract | `Authorization: Bearer <CRON_SECRET>`; constant-time hash compare in shared auth helper | 200 `{ok,urls,results}`; 401 unauthorized; 503 missing secret; 502 sitemap/IndexNow failure; 500 unexpected error; no-store | Fetches canonical sitemap, sends batches to IndexNow; supplementary bot call path sends new/changed listing URLs |
| `/api/update-exchange-rate` | GET or POST; no body contract | `Authorization: Bearer <CRON_SECRET>`; constant-time hash compare | 200 update result; 401 unauthorized; 503 missing config/storage; 502 upstream CBU failure; 500 unexpected error; no-store | Vercel cron at `0 1 * * *` in config, CBU, Supabase service client, event logger |

## Internal API modules

Files prefixed `_` are imported by endpoints/runtime, not standalone route contracts:

- `_publicDb.js`: public DB configuration, ID parsing, listing existence/meta, pagination and district inventory.
- `_listingDb.js`: listing and pending-album persistence with schema-compatible retry helpers.
- `_listingFacts.js`, `_districtRules.js`, `listingParser.js`, `aiProviders.js`, `_aiLog.js`: extraction, evidence/rules, multi-provider fallback and redacted event logging.
- `_leadRouting.js`, `_leadManagers.js`, `_binotel.js`: form data allowlists, lead classification/assignment, Binotel API requests.
- `_telegramPhotos.js`: Telegram download, image processing, Supabase Storage upload.
- `_exchangeRate.js`: CBU fetch, validation and DB update functions.
- `_indexNow.js`: route URL generation and push notification.
- `_seoMeta.js`: server HTML metadata, JSON-LD and content injection.

## Error handling and security notes

- Never place service-role, bot or CRM keys in `VITE_*` variables. Client `VITE_SUPABASE_KEY` is a publishable/anon key only.
- Browser requests carry no server secrets. API routes that need privileged writes use server env and should retain payload validation and minimal projections.
- `Origin` validation permits requests without an Origin header. It is not authentication and does not prevent non-browser callers.
- IP rate limit maps are not shared between serverless instances; use managed edge controls for an enforceable quota.
- The webhook check is conditional: absent webhook secret leaves Telegram route without that code-level shared-secret check. Verify Vercel/TG configuration before relying on it.
- `finalize-albums` accepts secret in query as well as a header; prefer the header and consider removing query support in a separately reviewed change.
- Do not document actual secret values or paste payload PII into logs/tests/docs.
