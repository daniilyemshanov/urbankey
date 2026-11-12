# URBAN KEY SEO hardening — deployment notes

This change keeps the existing React/Vite, Vercel and Supabase architecture. It does not run migrations, alter production DNS, or change live environment variables.

## Before deployment

1. Back up the Supabase database and review the current definitions of `public.cardss_public` and `public.commercials_public`.
2. Apply `sql/add_sold_flag.sql` once in the Supabase SQL editor if the production schema does not already have `is_sold`, `sold_at` and `updated_at`, and if the existing public views are present. The migration preserves the current view projections, adds `seo_lastmod`, and retains the filter that excludes sold listings.
3. Do not run `supabase/user_listings_and_leads.sql` merely as an SEO patch. It is a broader setup/migration script that also manages policies and storage permissions. It has been updated so its public views retain the sold filter and `seo_lastmod` if that complete script is intentionally used.
4. Deploy the application to Vercel with `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` set to the project URL and public anon/publishable key. Keep `SUPABASE_SERVICE_KEY`, `CRON_SECRET`, bot tokens, Cloudflare credentials and AI provider keys server-side only; never use a service-role key in a `VITE_` variable.
5. Verify that the Vercel project is attached to `urbankey.uz` and that DNS already points both the apex and `www` host to the intended Vercel project. The code adds a 301 redirect from `www` to the apex host; it does not change DNS records.

## Post-deploy smoke checks

- `https://urbankey.uz/sitemap.xml` returns either a URL set or a sitemap index.
- If an index is returned, every referenced `/sitemap-N.xml` responds with XML and status 200.
- `https://www.urbankey.uz/ru` redirects permanently to `https://urbankey.uz/ru`.
- A known active listing returns 200; a sold or missing listing returns 404; a temporary Supabase failure returns 503 with `Cache-Control: no-store`.
- Each indexed listing language contains localized title/content and a self-canonical; `hreflang` contains only language versions that actually have a translated title.
- Supabase views exclude rows where `is_sold = true` and expose `seo_lastmod` sourced from `updated_at`.
- GA4 DebugView receives one `page_view` per SPA navigation and `generate_lead` only after a successful lead API response.
- Check `/admin`, `/login`, `/register`, `/profile` and `/my-listings` after deployment to confirm their existing client-side rewrites and authentication flows.

## Credentials and archive hygiene

The project archive used for this work contained a local `.env` file and Git metadata. The deliverable source archive omits `.env*` (except `.env.example`), `.git`, `node_modules`, build output and local cache directories. Treat values in the uploaded archive as potentially disclosed: rotate the Supabase service-role key, Cloudflare token, cron/webhook/finalization secrets and external AI keys that were present, then inspect Git history before pushing or sharing the repository. The anon/publishable Supabase key is expected to be public, but its RLS policies must remain restrictive.
