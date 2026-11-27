import test from "node:test";
import assert from "node:assert/strict";
import {
    fetchAllRows,
    getDistrictsWithListings,
    commercialExists,
    noRetry,
} from "../api/_publicDb.js";
import { buildListingHead } from "../api/_seoMeta.js";
import { buildBreadcrumbJsonLd } from "../src/utils/structuredData.js";
import { buildStaticHead } from "../api/_seoMeta.js";
import { chunkGroups, MAX_URLS_PER_SITEMAP } from "../api/sitemap.js";
import { readFileSync } from "node:fs";

function pagedClient(rowsByTable, { failTable } = {}) {
    const calls = [];
    return {
        calls,
        from(table) {
            let from = 0;
            let to = 999;
            const builder = {
                select() { return builder; },
                order() { return builder; },
                range(start, end) {
                    from = start;
                    to = end;
                    calls.push({ table, from, to });
                    if (table === failTable) {
                        return Promise.resolve({ data: null, error: { message: "simulated Supabase failure" } });
                    }
                    const rows = rowsByTable[table] || [];
                    return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
                },
            };
            return builder;
        },
    };
}

test("fetchAllRows: reads every page with stable non-overlapping ranges", async () => {
    const rows = Array.from({ length: 2205 }, (_, index) => ({ id: index + 1 }));
    const client = pagedClient({ listings: rows });
    const result = await fetchAllRows(client, "listings", "id", "id", 1000);
    assert.equal(result.length, 2205);
    assert.deepEqual(client.calls.map(({ from, to }) => [from, to]), [[0, 999], [1000, 1999], [2000, 2999]]);
});

test("getDistrictsWithListings: районы находятся и после 2 000-й/5 000-й записи", async () => {
    const homes = Array.from({ length: 2005 }, (_, index) => ({
        id: index + 1,
        title_ru: index === 2004 ? "Квартира в Чиланзаре" : "Квартира",
    }));
    const commercials = Array.from({ length: 2005 }, (_, index) => ({
        id: index + 1,
        district_ru: index === 2004 ? "Юнусабадский район" : "",
    }));
    const villas = [{ id: 1, card_id: 2005, location_ru: "Чиланзар" }];
    const client = pagedClient({ cardss_public: homes, commercials_public: commercials, villas });
    const result = await getDistrictsWithListings(client);
    assert.ok(result.apartments.has("chilanzar"));
    assert.ok(result.commercial.has("yunusabad"));
    assert.ok(client.calls.some((call) => call.table === "cardss_public" && call.from === 2000));
    assert.ok(client.calls.some((call) => call.table === "commercials_public" && call.from === 2000));
});

test("getDistrictsWithListings: ошибка любой таблицы не превращается в пустой каталог", async () => {
    const client = pagedClient({ cardss_public: [], commercials_public: [], villas: [] }, { failTable: "villas" });
    assert.equal(await getDistrictsWithListings(client), null);
});

test("commercialExists: источником публикации является commercials_public, commercial_pages не нужен", async () => {
    const queries = [];
    const client = {
        from(table) {
            queries.push(table);
            const builder = {
                select() { return builder; },
                eq() { return builder; },
                maybeSingle() {
                    return Promise.resolve({ data: table === "commercials_public" ? { id: 88 } : null, error: null });
                },
            };
            return builder;
        },
    };
    assert.equal(await commercialExists(client, 88), true);
    assert.deepEqual(queries, ["commercials_public"]);
});

test("языковая версия без перевода не получает русский fallback и индексируется только при переводе", () => {
    const meta = {
        title: { ru: "Квартира в Чиланзаре", en: "", uz: "Chilonzordagi kvartira" },
        description: { ru: "Русское описание", en: "", uz: "O'zbekcha tavsif" },
    };
    const en = buildListingHead({ kind: "property", id: 3, lang: "en", meta });
    assert.equal(en.noindex, true);
    assert.equal(en.body, "");
    assert.match(en.lines, /Property listing — UrbanKey/);
    assert.match(en.lines, /name="robots" content="noindex, follow"/);
    assert.doesNotMatch(en.lines, /Квартира в Чиланзаре|Русское описание/);
    assert.doesNotMatch(en.lines, /hreflang=/);

    const ru = buildListingHead({ kind: "property", id: 3, lang: "ru", meta });
    assert.equal(ru.noindex, false);
    assert.match(ru.lines, /hreflang="ru"/);
    assert.match(ru.lines, /hreflang="uz"/);
    assert.doesNotMatch(ru.lines, /hreflang="en"/);
});

test("Breadcrumb JSON-LD нормализует корневой URL без завершающего слеша", () => {
    const jsonLd = buildBreadcrumbJsonLd([{ name: "UrbanKey", path: "/" }, { name: "Объект", path: "/property/7/" }], "ru");
    assert.equal(jsonLd.itemListElement[0].item, "https://urbankey.uz/ru");
    assert.equal(jsonLd.itemListElement[1].item, "https://urbankey.uz/ru/property/7");
});


test("статические HTML-страницы используют нормализованный canonical и полные hreflang", () => {
    const head = buildStaticHead({ page: "home", lang: "ru" });
    assert.match(head.lines, /rel="canonical" href="https:\/\/urbankey\.uz\/ru"/);
    for (const lang of ["ru", "en", "uz"]) assert.match(head.lines, new RegExp(`hreflang="${lang}"`));
    assert.match(head.lines, /hreflang="x-default"/);
});

test("в SQL-скриптах пересоздания публичных views сохранён фильтр проданных объектов", () => {
    const files = ["../sql/add_sold_flag.sql", "../sql/recreate_public_views.sql", "../supabase/user_listings_and_leads.sql"];
    for (const file of files) {
        const sql = readFileSync(new URL(file, import.meta.url), "utf8").toLowerCase();
        assert.match(sql, /coalesce\s*\(\s*(?:[a-z_][a-z0-9_]*\.)?is_sold\s*,\s*false\s*\)\s*=\s*false/, file);
        assert.match(sql, /updated_at\s+as\s+seo_lastmod/, file);
    }
});

test("www redirect и раздельные sitemap rewrites объявлены в конфигурации Vercel", () => {
    const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
    assert.ok(config.redirects.some((r) => r.has?.some((h) => h.type === "host" && h.value === "www.urbankey.uz") && r.destination === "https://urbankey.uz/:path*" && r.permanent));
    assert.ok(config.rewrites.some((r) => r.source === "/sitemap-:part.xml" && r.destination === "/api/sitemap?part=:part"));
    assert.ok(config.rewrites.some((r) => r.source === "/sitemap.xml" && r.destination === "/api/sitemap"));
});


test("sitemap chunking keeps every XML file below the configured URL ceiling", () => {
    const groups = Array.from({ length: MAX_URLS_PER_SITEMAP + 1 }, (_, i) => ({ blocks: [`<url>${i}</url>`] }));
    const chunks = chunkGroups(groups);
    assert.equal(chunks.length, 2);
    assert.ok(chunks.every((chunk) => chunk.length <= MAX_URLS_PER_SITEMAP));
    assert.equal(chunks.reduce((total, chunk) => total + chunk.length, 0), groups.length);
});


test("noRetry отключает повторы на конкретном запросе Supabase", () => {
    const query = {
        enabled: true,
        retry(value) { this.enabled = value; return this; },
    };
    assert.equal(noRetry(query), query);
    assert.equal(query.enabled, false);
});
