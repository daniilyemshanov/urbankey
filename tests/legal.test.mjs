// Страницы «Политика конфиденциальности» и «Условия использования».
// Запуск: node --test tests/legal.test.mjs (входит в npm run test:all)

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { LEGAL_TEXTS, LEGAL_LABELS } from "../src/legal/legalTexts.js";
import { STATIC_PAGES, getStaticPage } from "../src/utils/staticPages.js";
import { LEGAL_INFO, LEGAL_UPDATED } from "../src/utils/legalInfo.js";

const LANGS = ["ru", "en", "uz"];

test("оба документа есть на трёх языках, в каждом разделе есть заголовок и текст", () => {
    for (const doc of ["privacy", "terms"]) {
        for (const lang of LANGS) {
            const d = LEGAL_TEXTS[doc][lang];
            assert.ok(d.title && d.description, `${doc}/${lang}`);
            assert.ok(d.sections.length >= 8, `${doc}/${lang}: мало разделов`);
            for (const sec of d.sections) {
                assert.ok(sec.h && sec.p.length > 0 && sec.p.every((x) => x.length > 20), `${doc}/${lang}/${sec.h}`);
            }
        }
        assert.equal(LEGAL_TEXTS[doc].ru.sections.length, LEGAL_TEXTS[doc].en.sections.length);
        assert.equal(LEGAL_TEXTS[doc].ru.sections.length, LEGAL_TEXTS[doc].uz.sections.length);
    }
});

test("подписи страниц на трёх языках", () => {
    for (const key of Object.keys(LEGAL_LABELS)) {
        for (const lang of LANGS) assert.ok(LEGAL_LABELS[key][lang], `${key}/${lang}`);
    }
});

test("страницы доступны серверу: head и h1 для роботов", () => {
    assert.ok(STATIC_PAGES.includes("Privacy") && STATIC_PAGES.includes("Terms"));
    for (const page of ["Privacy", "Terms"]) {
        for (const lang of LANGS) {
            const p = getStaticPage(page, lang);
            assert.ok(p && p.title && p.h1 && p.description && p.intro, `${page}/${lang}`);
        }
    }
});

test("маршрут /:lang/Privacy и /:lang/Terms не попадает в 404", () => {
    const cfg = JSON.parse(fs.readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
    const rule = cfg.rewrites.find((r) => r.source.includes(":page("));
    assert.ok(rule && /Privacy/.test(rule.source) && /Terms/.test(rule.source), rule?.source);
});

test("страницы есть в sitemap", () => {
    const src = fs.readFileSync(new URL("../api/sitemap.js", import.meta.url), "utf8");
    assert.match(src, /path: "\/Privacy"/);
    assert.match(src, /path: "\/Terms"/);
});

test("реквизиты оператора: структура на месте, дата обновления задана", () => {
    for (const k of ["brand", "companyName", "inn", "address", "email", "phone"]) assert.ok(k in LEGAL_INFO, k);
    assert.match(LEGAL_UPDATED, /^\d{2}\.\d{2}\.\d{4}$/);
});
