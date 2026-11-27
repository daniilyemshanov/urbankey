# SEO / Local SEO / GEO

This document summarizes the project’s existing 27.11.2026 SEO work; it does not replace a production crawl or external account review. Full detail and ownership plan: [`docs/SEO-GEO-FINAL-REPORT.md`](../SEO-GEO-FINAL-REPORT.md) and [`docs/SEO-GEO-90-DAY-PLAN.md`](../SEO-GEO-90-DAY-PLAN.md).

## Implemented in source

- Server-generated HTML head/body for public localized static routes, districts, active residential/commercial listing details using `api/spa.js` and `api/_seoMeta.js`.
- Canonical, available-language hreflang, OG/Twitter cards, title/description and structured data helpers in `src/components/Seo.jsx`, `src/utils/structuredData.js` and server helper.
- Sitemap uses public views, excludes sold rows according to supplied SQL view definitions, lists non-empty district pages and listing translations with titles; DB failures return 503 (tested against mocks).
- Vercel redirects/rewrite rules and `public/robots.txt`; explicit OAI-SearchBot allow and GPTBot training-crawl disallow in current source.
- `RealEstateAgent`, `WebSite`, `BreadcrumbList`, and listing JSON-LD. `sameAs` references configured social URLs; ownership/accuracy remains owner-confirmation required.
- RU/UZ/EN homepage, catalog, services, contacts, district copy and listing metadata.

## Status labels

- **Implemented:** static code/config and automated mocked behavior exists.
- **Partially implemented:** depends on runtime data, business facts or service configuration.
- **Unknown:** production response, crawl/indexing, Maps profiles, rankings, CWV, GSC/Yandex Webmaster/GA4 data, backlink profile, CDN/WAF bot access and AI citations were not inspected.
- **Planned:** 90-day team roadmap, factual expert content, profile checks and monthly AI answer sample logging.

## Constraints for further work

- No apartment-rental landing pages and no seller-intent campaign in current business scope; commercial rent remains supported.
- Do not infer office address, legal identity, licensing, review, transaction or market statistic. Confirm with the company before publishing or adding Schema.
- Only add district or service pages where live inventory and distinct factual content support a standalone page.
- Do not promise rank improvements; compare GSC queries/pages, qualified CRM lead data, local-profile referrals, and dated identical AI prompts.
- Production URLs/statuses and view migration state must be tested in a controlled preview/account before release; never run production SQL/deploy as part of documentation.
