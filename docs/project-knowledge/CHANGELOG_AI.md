# AI / developer change log

Entries begin with the project inventory and cleanup in this snapshot. No earlier project history is reconstructed because the supplied ZIP has no Git metadata.

## 2026-11-27 — Codex — project inventory, cleanup, and knowledge docs

- **Changed:** documented architecture, DB/source schema evidence, endpoints, integrations, developer workflow, SEO/GEO status and AI context; added root agent rules and this log; replaced root README with a documentation index; archived five historical project notes and the legacy README; moved three import-unreferenced components to `src/unused/`; removed five CSS modules after searching for imports/references; added `seo-copy.test.mjs` to test scripts and archived the obsolete sitemap test after confirming it imported missing exports and expected a retired sitemap chunking route.
- **Files:** root `AGENTS.md`, `README.md`, `package.json`; three source components and their styles moved to `src/unused/`; five unreferenced CSS modules removed; `tests/archive/README.md` and disabled legacy test; `docs/project-knowledge/*`; five historical notes and legacy README moved to archive.
- **Reason:** make the project navigable and factual, preserve historical notes and potentially useful UI modules, remove only CSS with no importer, and ensure the test command exercises relevant SEO copy checks without obsolete assertions.
- **Comments removed:** none. Source comment scan found tool directives and technical notes; no context-free AI-generated residue was confirmed for deletion.
- **Dependencies removed:** none; static import-only review was not sufficient to prove any package unused.
- **Tests/build/lint:** `npm ci` succeeded (17 audit advisories: 1 low, 6 moderate, 10 high; install scripts for `@parcel/watcher` and `sharp` were not approved); `npm run test:all` 263/263 pass; `npm run build` succeeds with missing `%VITE_SUPABASE_URL%` and unresolved `/Abstract Design.png` warnings; focused ESLint for three isolated components passes; full lint has 46 errors and 22 warnings in the repository.
- **Remaining issues:** production schema/deployment/external integrations unknown; no `.git` in supplied ZIP, so status/diff/history unavailable; build environment lacks production Vite env/assets; project-wide lint debt and npm audit advisories remain.

## 2026-11-27 — Codex — advanced property search

- **Changed:** replaced catalog-wide client downloads with paginated `search_public_listings` RPC client; added URL-backed category/deal/district/price/room/area/floor/text filters, relevance/newest/price ordering, listing suggestions, quick searches and an empty/error state; added local RU/UZ/EN natural-query parsing; changed the existing hero search to serialize filters locally; added an unapplied SQL migration with derived public views, trigram indexes and an invoker-rights RPC; added localized search strings and parser regression tests.
- **Files:** `src/components/Catalog.jsx`, `Catalog.module.css`, `AiSearchBar.jsx`; `src/api/propertySearch.js`; `src/utils/propertySearch.js`; `sql/advanced_property_search.sql`; `tests/propertySearch.test.mjs`; `package.json`; `src/locales/{ru,en,uz}/translation.json`; `docs/project-knowledge/{PROPERTY_SEARCH,PROJECT_MASTER,ARCHITECTURE,DATABASE,API,INTEGRATIONS,DEVELOPMENT_GUIDE,AI_CONTEXT,CHANGELOG_AI}.md`; `README.md`.
- **Reason:** the old catalog fetched all residential/commercial records, filtered only in browser, offered limited controls, did not preserve most state in URLs, and put boosted listings ahead of the chosen sort. Search intent is now parsed without adding paid AI calls.
- **Data/rollout:** no production DB changed. `sql/advanced_property_search.sql` is pending and must be reviewed/tested against actual schema/RLS before use. Search UI requires that RPC and intentionally does not fall back to a full inventory download. Residential area is omitted because it is not exposed in the inspected public view; unknown deal flags remain unknown.
- **Dependencies removed/added:** none.
- **Tests/build/lint:** `npm run test:all` 270/270 pass; `npm run build` succeeds with existing missing `%VITE_SUPABASE_URL%` and unresolved `/Abstract Design.png` warnings; focused ESLint on the changed search and test files passes. RU/UZ/EN locale JSON parses. Browser visual inspection was stopped by the user, and the SQL migration was not executed or validated against production.
- **Remaining issues:** production Supabase schema, query plans, RPC grants and responsive visual rendering could not be validated from the ZIP alone. Offset pagination and exact counts need measurement at production inventory scale. Existing legacy `/api/ai-search` serverless code remains, but current catalog/hero no longer call it.


## 2026-11-27 — Codex — search compatibility correction

- **Changed:** removed the duplicate catalog search field from the Properties page; retained the existing top search; added a fallback to the legacy already-loaded listing collections when the new RPC is not installed. Price, room, commercial area, district and deal filters are preserved as far as the legacy data supports them.
- **Files:** `src/components/Catalog.jsx`; `docs/project-knowledge/PROPERTY_SEARCH.md`; this log.
- **Reason:** the new RPC migration is intentionally not applied to production, so requiring it immediately made the catalog display an unavailable error. The duplicate field was redundant because `Properties.jsx` already renders `Find` above `Catalog`.
- **Tests/build/lint:** `npm run test:all` 270/270 pass; `npm run build` passes; focused ESLint passes. Browser visual check was interrupted before it could be completed.
- **Remaining issue:** until migration rollout, compatibility mode uses the legacy full context collections and does not have the target RPC's scalable server-side behavior.


## 2026-11-27 — Codex — SQL index and catalog completeness fix

- **Changed:** rewrote trigram GIN expression indexes to use immutable `text ||` expressions instead of `concat_ws`; corrected fallback normalization for nested localized commercial objects; made fallback load the legacy public-view collections when opened directly; increased initial RPC page size to 24; added factual description and available attributes to listing cards.
- **Files:** `sql/advanced_property_search.sql`, `src/components/Catalog.jsx`, `src/components/Catalog.module.css`, `src/api/propertySearch.js`, `docs/project-knowledge/PROPERTY_SEARCH.md`, this log.
- **Reason:** PostgreSQL rejects `concat_ws` in expression indexes as non-IMMUTABLE; legacy context records use nested language objects, and a direct catalog visit can otherwise reach the fallback before those collections have loaded.
- **Tests/build/lint:** `npm run test:all` 270/270 pass; `npm run build` passes; focused ESLint on the changed search files passes. SQL was reviewed statically; no database was available to execute it.
- **Remaining issues:** migration is not executed against the database; row counts and complete listing parity must be verified in the target project after applying the corrected script.


## 2026-11-27 — Codex — currency-safe filters and compact catalog controls

- **Changed:** price bounds retain their source currency in URL (`pc`), convert only for display/query, and reset pagination without dropping filters when currency/rate changes; fixed currency conversion for natural queries; polished district chips/selects and RU district labels; added concise room filter text, category-aware type/area filters, and range input constraints.
- **Files:** `src/components/Catalog.jsx`, `src/components/Catalog.module.css`, `src/components/AiSearchBar.jsx`, `src/api/propertySearch.js`, `src/utils/currency.js`, `src/utils/propertySearch.js`, `src/locales/{ru,en,uz}/translation.json`, `tests/{propertySearch,currency.display}.test.mjs`, `docs/project-knowledge/PROPERTY_SEARCH.md`, this log.
- **Reason:** changing display currency must not alter the user's real price bounds or current search; controls should remain readable and filters should match supported data by category.
- **Tests/build/lint:** `npm run test:all` 271/271 pass; production build succeeds; focused ESLint and RU/UZ/EN locale JSON validation pass. Filter/currency helper coverage is automated; live Supabase data parity and browser rendering were not available for verification.
- **Remaining issues:** live database/RPC behavior and browser visual rendering are not accessible from the supplied project snapshot.


## 2026-11-27 — Codex — native select and district scrolling polish

- **Changed:** darkened native dropdown options with a gold selected state and exposed a slim gold horizontal scrollbar for the district strip.
- **Files:** src/components/Catalog.module.css; this log.
- **Reason:** the browser's open select menu retained a gray/blue native palette, and clipped district chips had no visible scroll affordance.
- **Tests/build/lint:** not run; CSS-only change as requested.
- **Remaining issues:** native option popup rendering can vary slightly by browser/Windows theme.


## 2026-11-27 — Codex — responsive catalog polish

- **Changed:** listing metadata now wraps within narrow cards; mobile card padding/type scale is tighter; district navigation keeps touch scrolling but hides the desktop scrollbar on touch widths; mobile search input and submit button stack cleanly.
- **Files:** src/components/Catalog.module.css, src/components/AiSearchBar.module.css, this log.
- **Reason:** prevent clipped address chips and intrusive horizontal scrollbar on phones.
- **Tests/build/lint:** no test suite run as requested; 
pm run build succeeds with existing environment and image warnings.
- **Remaining issues:** no real device/browser visual pass was run.


## 2026-11-27 — Codex — apartment gallery Swiper repair

- **Changed:** apartment gallery filters empty/invalid image URLs, removes failed images, keys slides by URL, hides controls for a single image, removes autoplay, and shows a localized empty state; mobile height and touch behavior were adjusted. Added dedicated gallery notes.
- **Files:** `src/components/Property.jsx`, `src/components/Property.module.css`, `src/locales/{ru,en,uz}/translation.json`, `docs/project-knowledge/PROPERTY_GALLERY.md`, `docs/project-knowledge/PROJECT_MASTER.md`, this log.
- **Reason:** prevent blank/stale slides and misleading controls on the apartment page, especially with one or failed photos.
- **Tests/build/lint:** `npm run build` succeeds with existing missing `%VITE_SUPABASE_URL%` and unresolved image warnings; no test suite run per request.
- **Remaining issues:** real listing image URLs and phone interaction require production/device verification.


## 2026-11-27 — Codex — corrective apartment Swiper responsive fix

- **Changed:** restored desktop gallery behavior and fixed the actual mobile flex sizing: the column layout now stretches children, the gallery wrapper and Swiper are explicitly width-constrained, and Swiper recalculates on resize.
- **Files:** `src/components/Property.jsx`, `src/components/Property.module.css`, `src/locales/{ru,en,uz}/translation.json` (removed the speculative empty-gallery labels), `docs/project-knowledge/PROPERTY_GALLERY.md`, this log.
- **Reason:** the reported white overflow was a responsive flex sizing defect; the previous empty/failed-image diagnosis was incorrect.
- **Tests/build/lint:** `npm run build` succeeds with existing environment/image warnings; no test suite run per request.
- **Remaining issues:** visual confirmation on the actual phone/browser is still needed.
