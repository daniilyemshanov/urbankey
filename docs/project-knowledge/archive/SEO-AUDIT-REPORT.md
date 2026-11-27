# UrbanKey — SEO-only update

**Date:** 9 November 2026  
**Domain:** https://urbankey.uz  
**Scope:** SEO changes only. No redesign, UI changes, route changes, catalog/filter logic changes, database schema/data changes, Vercel settings, DNS changes, or deployment.

## Business and targeting constraints

- Geography: Tashkent only.
- Target audiences: apartment buyers; commercial-property buyers; commercial-premises tenants.
- Do not target apartment rentals yet.
- Do not target property sellers yet.
- Budget: $0; no paid SEO services or paid APIs introduced.

## What changed

### 1. Sitemap and crawl safety

- `api/sitemap.js`: published commercial records from `commercials_public` are now included even when no matching `commercial_pages` row exists. These simplified public listing pages are valid detail pages.
- Sitemap generation now returns `503` with `Cache-Control: no-store` and `Retry-After` if the district inventory scan fails. It no longer returns a misleading partial sitemap that could expose empty programmatic district pages.
- `api/_publicDb.js`: district inventory reads are paginated in batches of 1,000 rather than silently stopping at the first page. A failed primary listing scan is treated as unknown, not as an empty inventory.

### 2. Metadata and structured data

- `src/utils/structuredData.js`: breadcrumb URLs normalize leading/trailing slashes, so the homepage breadcrumb points to `/ru` (matching the canonical route) instead of `/ru/`.
- `index.html`: removed a duplicate Supabase `preconnect` hint; retained the credentialed preconnect.
- `src/utils/staticPages.js` and locale translation files: the general catalog title is neutral instead of promising a purchase-only catalog while the existing catalog still exposes multiple deal types.
- Contact-page SEO copy now describes the contact form rather than claiming that an office address and phone are displayed on that page.

### 3. Apartment-rental exclusion

- District apartment-page titles, descriptions, and intro copy are neutral and do not target apartment-rental queries.
- The general catalog title is neutral and does not claim a buy-only filter.
- Contact-page copy refers to apartment purchase and commercial-property purchase/rental, not apartment rental.
- Commercial district pages retain sale/rental relevance.
- No apartment-rental landing pages, routes, filters, or catalog behavior were added.

## Explicitly unchanged

- Design, colors, layout, typography, CSS, and visual components.
- `Catalog.jsx`, `DistrictListings.jsx`, app routes, filter behavior, and listing/business logic.
- Existing navigation and user flows.
- Supabase schema/data, Vercel project settings, DNS, and production deployment.

The separate `DealListings.jsx` / `dealPages.js` experiment from an intermediate working copy was deliberately excluded because it introduced new landing routes and catalog behavior, which are outside the requested SEO-only scope.

## Files changed

- `api/_publicDb.js`
- `api/sitemap.js`
- `index.html`
- `src/locales/en/translation.json`
- `src/locales/ru/translation.json`
- `src/locales/uz/translation.json`
- `src/utils/districtPages.js`
- `src/utils/staticPages.js`
- `src/utils/structuredData.js`
- `tests/api.test.mjs`
- `tests/brand.test.mjs`
- `tests/district.rules.test.mjs`
- `tests/legal.test.mjs`
- `tests/seo-copy.test.mjs` (new)

## Verification

- 70 targeted automated tests passed.
  - API/sitemap/SSR tests were run with a temporary lightweight Supabase client test double because the actual npm dependency could not be installed in this environment. The test double was removed and is not included in the deliverable.
  - District, structured-data, legal/contact-copy, preload, and SEO-copy tests passed.
- `node --check` passed for all changed JavaScript modules and test files.
- RU/EN/UZ translation JSON parsed successfully.
- Explicit guard checks confirmed that `Catalog.jsx`, `DistrictListings.jsx`, `App.jsx`, `vercel.json`, and `public/robots.txt` are unchanged.
- Confirmed no new apartment-rental route or landing-page files are present.

### Not verified

- Production Vite build and ESLint: npm dependencies were incomplete; `npm ci` timed out. The build must be run in a normal project environment after `npm ci`.
- Live `urbankey.uz` checks: the domain could not be fetched from this environment (DNS/network safety validation failure). Production HTTP status, redirects, canonical/hreflang reciprocity, robots, sitemap XML, and server-rendered output remain unverified.
- Google Search Console, GA4, PageSpeed Insights/CrUX, Google Business Profile, and backlink data: no authorized API credentials or connected analytics source were available. No traffic, ranking, backlink, or CWV values are invented in this report.

## Next SEO work after read-only data access

1. Export GSC query/page performance for the last 3–6 months; prioritize Tashkent purchase-intent apartment queries and commercial purchase/rental queries. Exclude apartment-rental and seller-intent clusters.
2. Inspect GSC indexing reports and URL Inspection for canonical selection, crawled-not-indexed pages, duplicates, and soft 404s.
3. Read GA4 organic landing pages and lead events to identify pages that attract qualified enquiries.
4. Verify real NAP/business details with the business owner before adding them to `RealEstateAgent` schema or external local profiles.
5. Measure PageSpeed Insights and CrUX on homepage, catalog, district pages, and representative listing pages.
6. Improve district content only with verifiable local facts and real listing data; do not bulk-generate thin location pages.
7. Revisit sitemap scalability and district-query performance when production inventory and DB query plans can be inspected. Do not run a full-table scan per request indefinitely.

## Reference guidance

- Google: [Localized versions and reciprocal hreflang](https://developers.google.com/search/docs/specialty/international/localized-versions).
- Google: [Sitemaps overview](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview).
- Google: [Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).

**Status:** SEO-only source changes prepared; not deployed. Full promotion work is not complete until production checks and GSC/GA4 data review are possible.
