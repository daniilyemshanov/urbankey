# Advanced property search

## Current design

When installed, `src/components/Catalog.jsx` calls `src/api/propertySearch.js`, which invokes the `search_public_listings` Supabase RPC and returns only a page. Until that pending migration exists, a compatibility path uses the listing collections the existing `MyContext` already loads so the catalog remains usable. This temporary path has the older client-side performance and field-coverage limits. It normalizes the legacy Context object shape (localized nested title/address/class fields); apply and validate the migration to enable server-side search. The RPC returns one 24-row page and an exact total; the client asks for another page only when the user selects **Show more**. Search input is debounced, and outdated responses are discarded.

The same normalized URL query parameters drive the search and can be copied or restored after refresh/back navigation. Price bounds carry their source currency in `pc`, convert for display and server requests, and survive currency toggles without clearing or changing their real threshold. Existing localized paths and district catalog links remain in use. Query state stays on the catalog route, not a generated SEO landing page. Search sorting supports relevance, newest first, and price ascending/descending. Boosted listings are shown with their badge but do not override the selected order.

## Natural-language interpretation

`src/utils/propertySearch.js` performs local, deterministic RU/UZ/EN parsing with no model call or new paid service. It recognizes the supported deal/category/type vocabulary, district aliases from `districts.js`, numeric room counts, price bounds/ranges and units, commercial floor area, and central-location phrases. Unrecognized words remain a text query. Ambiguous deal type stays unset. Currency conversion uses the site rate before the resulting price filter is sent to Supabase.

The catalog starts with 24 listings and offers progressive loading for the rest. Filter controls use verified category fields; district names are presented in full in Russian, district chips scroll horizontally, and selects have a compact styled control. Listing cards show a short real description and whichever verified room, bathroom, area, floor, address, district, type and status fields are available. The catalog also shows popular example searches. When a text query returns matches, the first page supplies up to five live listing suggestions. No synthetic listings are used.

## Search data and filters

The SQL source is `sql/advanced_property_search.sql`; this file is a **pending migration** and has not been run. Its trigram index expressions use immutable text concatenation (`||`) rather than `concat_ws`, which PostgreSQL rejects in expression indexes because it is not marked IMMUTABLE. It builds separate search views on top of the existing sold-filtered `cardss_public` and `commercials_public` views, joins the public villa location fields needed for residential district search, adds public `is_rent` metadata, and grants read access to the derived views and an invoker-rights RPC. Trigram indexes support multilingual text search. No service-role key or production operation is involved.

| Filter | Backing evidence | Scope |
|---|---|---|
| Residential / commercial | Separate public views | All or one category |
| Sale / rent | `is_rent` in the derived view | Only rows with a known value; null status is not silently called sale |
| District | District/address/landmark text and residential `villas.location_*` | All categories |
| Price range | Existing raw `price`, optional `discount_price`, and current rate | Both categories; handles USD/UZS and per-area price text |
| Rooms | `bedrooms_ru/en/uz` in `cardss_public` | Residential only |
| Area | `area` in `commercials_public` | Commercial only; no residential area source is confirmed |
| Floor | Existing commercial `floor`; optional residential field read through JSON | Both categories where value exists |
| Building type, condition, primary/secondary market | No consistently confirmed public field | Not offered |

## Ranking and performance

Text search first narrows candidate rows with trigram matching and normalized token matching. Relevance prioritizes exact title and phrase matches, then matches on all remaining words. Explicit filters are hard constraints. Newest uses numeric `id` order because the inspected public views do not expose a confirmed timestamp. Price sorting uses parsed prices in the user's selected currency. Promotional status never changes relevance or order.

The browser receives only a 24-row page of results when the RPC is active; compatibility mode uses the legacy context-loaded inventory and paginates that collection locally. Filtering and sorting are database-side in RPC mode. Exact totals and parsing mixed-currency price text may require a database scan in some query plans. Validate query plans and index sizes against the actual Supabase schema and inventory before applying the migration. Offset pagination fits the current page UI; consider keyset pagination if inventory grows enough to make deep offsets material.

## Required rollout and constraints

1. Inspect `DATABASE.md`, target view definitions, grants, RLS and installed `pg_trgm` schema.
2. Review `sql/advanced_property_search.sql`; apply to a non-production project first, measure query plans, and test as both `anon` and `authenticated`.
3. Only after separate production approval, apply the migration and verify active listings, unknown status handling, sold-record exclusion through source views, and pagination.
4. If the RPC is missing, the app currently uses the legacy context collections as a compatibility fallback. This preserves the prior working catalog until the migration is installed, but it is not the scalable target architecture.

The old `/api/ai-search` serverless endpoint and `src/utils/aiSearch.js` are not called by the new UI. The endpoint is retained for compatibility and has not been invoked during this work. AI listing-parser integrations are separate and unchanged.

## Tests

`tests/propertySearch.test.mjs` covers RU/UZ/EN parsing, district variants, price/area extraction, ambiguity, URL serialization and regressions where room or area values could be misread as price. The SQL cannot be validated against production without a database; no production schema, credentials or live query plans were available in this workspace.
