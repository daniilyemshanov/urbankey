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
