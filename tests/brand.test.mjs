// Связь бренда с официальными профилями (sameAs) и «имя сайта» для поиска.
// Запуск: node --test tests/brand.test.mjs (входит в npm run test:all)

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildOrganizationJsonLd, buildWebSiteJsonLd } from "../src/utils/structuredData.js";
import { SOCIAL_LINKS, SAME_AS } from "../src/utils/socialLinks.js";
import { buildStaticHead } from "../api/_seoMeta.js";

const ld = (lines) =>
    [...lines.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

test("Organization: название, варианты написания и официальные профили", () => {
    const org = buildOrganizationJsonLd();
    assert.equal(org.name, "UrbanKey");
    assert.ok(org.alternateName.includes("Urban Key"));
    assert.deepEqual(org.sameAs, SAME_AS);
    assert.ok(SAME_AS.includes("https://www.instagram.com/urban_keyuz/"));
    assert.ok(SAME_AS.includes("https://t.me/UrbanKeyNedvizhimost_Tashkent"));
    for (const url of SAME_AS) assert.match(url, /^https:\/\//);
});

test("личный контакт менеджера не попадает в sameAs компании", () => {
    assert.ok(!SAME_AS.some((u) => /Vladislav_commercia/i.test(u)));
    assert.equal(Object.keys(SOCIAL_LINKS).length, SAME_AS.length);
});

test("WebSite: имя сайта, URL и ссылка на организацию", () => {
    const site = buildWebSiteJsonLd();
    assert.equal(site["@type"], "WebSite");
    assert.equal(site.name, "UrbanKey");
    assert.equal(site.url, "https://urbankey.uz/");
    assert.deepEqual(site.publisher, { "@id": "https://urbankey.uz/#organization" });
});

test("главная отдаёт Organization и WebSite в серверном HTML, другие страницы — нет", () => {
    for (const lang of ["ru", "en", "uz"]) {
        const blocks = ld(buildStaticHead({ page: "home", lang }).lines);
        assert.deepEqual(blocks.map((b) => b["@type"]).sort(), ["RealEstateAgent", "WebSite"], lang);
    }
    assert.equal(ld(buildStaticHead({ page: "Properties", lang: "ru" }).lines).length, 0);
    assert.equal(ld(buildStaticHead({ page: "Privacy", lang: "ru" }).lines).length, 0);
});
