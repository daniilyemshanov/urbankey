import test from "node:test";
import assert from "node:assert/strict";
import { injectHeroPreload } from "../api/spa.js";

test("preload героя добавляется перед </head> и не трогает остальной head", () => {
    const html = '<html><head><title>T</title><meta name="description" content="d" /></head><body></body></html>';
    const out = injectHeroPreload(html);
    assert.match(out, /<link rel="preload" as="image" href="\/c3383124-8cd3-4f72-9ab0-7fd2f40c9fcc\.webp" fetchpriority="high" \/>\s*<\/head>/);
    assert.ok(out.includes("<title>T</title>") && out.includes('name="description" content="d"'));
});

test("оболочка без </head> возвращается как есть", () => {
    assert.equal(injectHeroPreload("<div></div>"), "<div></div>");
});
