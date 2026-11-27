# Archived tests

`seo-hardening.test.mjs.disabled` is retained for historical context but is excluded from npm scripts. It imports exports that do not exist in the current `api/sitemap.js` and asserts an obsolete chunked-sitemap route/rewrite. The current sitemap implementation does not provide chunking, so restoring this test requires rewriting it to describe verified current behavior; do not add obsolete production behavior merely to satisfy it.
