import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import spa from "../api/spa.js";
import sitemap from "../api/sitemap.js";
import { fetchAllRows, propertyExists, commercialExists } from "../api/_publicDb.js";
import { buildListingHead, hasTranslation, getAvailableLangs } from "../api/_seoMeta.js";
import {
    trackPageView,
    trackEvent,
    trackViewItem,
    trackGenerateLead,
    trackClickToCall,
    trackClickTelegram,
    trackFormStart,
    GA_ID
} from "../src/analytics.js";

const SHELL = '<!doctype html><html><head><title>UrbanKey</title></head><body><div id="root"></div></body></html>';
const SB_URL = "https://fake-project.supabase.co";
const realFetch = globalThis.fetch;

let calls;
let supabase;
let shell;

const json = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const mkRes = () => {
    const r = {
        headers: {},
        code: 200,
        body: undefined,
        status(c) { r.code = c; return r; },
        setHeader(k, v) { r.headers[k] = v; },
        send(b) { r.body = b; return r; },
    };
    return r;
};

const callSpa = async (query, headers = {}) => {
    const res = mkRes();
    await spa({ query, headers: { host: "urbankey.uz", "x-forwarded-proto": "https", ...headers } }, res);
    return res;
};

const callSitemap = async () => {
    const res = mkRes();
    await sitemap({ headers: {} }, res);
    return res;
};

beforeEach(() => {
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.VITE_SUPABASE_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    calls = { shell: 0, supabase: 0, urls: [] };
    shell = () => new Response(SHELL, { status: 200, headers: { "Content-Type": "text/html" } });
    supabase = () => json([]);

    globalThis.fetch = async (url, init = {}) => {
        const u = String(url);
        calls.urls.push(u);
        if (u.endsWith("/index.html")) { calls.shell++; return shell(u, init); }
        if (u.startsWith(SB_URL)) { calls.supabase++; return supabase(u, init); }
        throw new Error("unexpected fetch " + u);
    };
});

after(() => { globalThis.fetch = realFetch; });

const withEnv = () => {
    process.env.VITE_SUPABASE_URL = SB_URL;
    process.env.VITE_SUPABASE_KEY = "anon-key";
};

// --- Test 1: Sitemap & Commercials without commercial_pages ---
test("sitemap: коммерческий объект из commercials_public попадает в sitemap даже без commercial_pages", async () => {
    withEnv();
    supabase = (url) => {
        const u = String(url);
        if (u.includes("/cardss_public")) return json([]);
        if (u.includes("/villas")) return json([]);
        if (u.includes("/commercials_public")) {
            return json([{ id: 42, title_ru: "Офис в центре", title_en: "Office downtown", title_uz: "Markazda ofis", delivery_date: "2026-12-01" }]);
        }
        return json([]);
    };

    const res = await callSitemap();
    assert.equal(res.code, 200);
    assert.match(res.body, /<loc>https:\/\/urbankey\.uz\/ru\/commercial\/42<\/loc>/);
    assert.match(res.body, /<loc>https:\/\/urbankey\.uz\/en\/commercial\/42<\/loc>/);
    assert.match(res.body, /<loc>https:\/\/urbankey\.uz\/uz\/commercial\/42<\/loc>/);
    assert.match(res.body, /<lastmod>2026-12-01<\/lastmod>/);
});

// --- Test 2: Localization in Sitemap ---
test("sitemap: листинг без переводов (только RU) не генерирует ложные URL для EN и UZ", async () => {
    withEnv();
    supabase = (url) => {
        const u = String(url);
        if (u.includes("/cardss_public")) {
            return json([{ id: 99, title_ru: "Только русский заголовок", title_en: "", title_uz: null }]);
        }
        if (u.includes("/villas")) {
            return json([{ card_id: 99 }]);
        }
        if (u.includes("/commercials_public")) return json([]);
        return json([]);
    };

    const res = await callSitemap();
    assert.equal(res.code, 200);
    assert.match(res.body, /<loc>https:\/\/urbankey\.uz\/ru\/property\/99<\/loc>/);
    assert.ok(!res.body.includes("<loc>https://urbankey.uz/en/property/99</loc>"), "не должно быть ложного URL en");
    assert.ok(!res.body.includes("<loc>https://urbankey.uz/uz/property/99</loc>"), "не должно быть ложного URL uz");
    assert.ok(!res.body.includes('hreflang="en" href="https://urbankey.uz/en/property/99"'));
});

// --- Test 3: Pagination in fetchAllRows ---
test("fetchAllRows: пагинация запрашивает несколько страниц и объединяет строки", async () => {
    const mockRanges = [];
    const mockSupabase = {
        from: (table) => ({
            select: () => ({
                order: () => ({
                    range: (from, to) => {
                        mockRanges.push([from, to]);
                        if (from === 0) {
                            return Promise.resolve({ data: [{ id: 1 }, { id: 2 }], error: null });
                        }
                        return Promise.resolve({ data: [{ id: 3 }], error: null });
                    }
                })
            })
        })
    };

    const rows = await fetchAllRows(mockSupabase, "test_table", "id", "id", 2);
    assert.equal(rows.length, 3);
    assert.deepEqual(rows.map(r => r.id), [1, 2, 3]);
    assert.deepEqual(mockRanges, [[0, 1], [2, 3]]);
});

// --- Test 4: SPA HTTP Status on Error ---
test("spa: при ошибке БД возвращается HTTP 503 Service Unavailable, а не 200", async () => {
    withEnv();
    supabase = () => json({ message: "DB timeout" }, 500);

    const res = await callSpa({ kind: "property", id: "10" });
    assert.equal(res.code, 503);
    assert.equal(res.headers["X-SPA-Existence-Check"], "skipped-error");
    assert.equal(res.headers["Cache-Control"], "no-store");
    assert.ok(res.headers["Retry-After"]);
});

// --- Test 5: SPA HTTP Status on Nonexistent Object ---
test("spa: реально отсутствующий объект возвращает 404 с X-Robots-Tag noindex", async () => {
    withEnv();
    supabase = () => json([]);

    const res = await callSpa({ kind: "property", id: "999" });
    assert.equal(res.code, 404);
    assert.equal(res.headers["X-Robots-Tag"], "noindex");
});

// --- Test 6: Fallback Localization & Canonical in SPA ---
test("spa/seoMeta: непереведённый объект на /en странице указывает canonical на /ru и не объявляет en в og:locale", () => {
    const meta = {
        title: { ru: "Красивая квартира", en: "", uz: "" },
        description: { ru: "Описание только на русском", en: "", uz: "" },
        image: "https://urbankey.uz/img.jpg"
    };

    const head = buildListingHead({ kind: "property", id: 7, lang: "en", meta });
    assert.ok(head);
    assert.equal(head.lang, "ru", "effectiveLang должен быть ru");
    assert.match(head.lines, /rel="canonical" href="https:\/\/urbankey\.uz\/ru\/property\/7"/);
    assert.match(head.lines, /property="og:locale" content="ru_RU"/);
    assert.ok(!head.lines.includes('hreflang="en"'), "не должно быть alternate hreflang en");
    assert.match(head.lines, /hreflang="ru"/);
    assert.match(head.lines, /hreflang="x-default"/);
});

// --- Test 7: Translated Object has Correct Localized Canonical & Alternates ---
test("spa/seoMeta: полностью переведённый объект имеет canonical на свой язык и все hreflang", () => {
    const meta = {
        title: { ru: "Квартира", en: "Apartment", uz: "Kvartira" },
        description: { ru: "Описание", en: "Description", uz: "Tavsif" },
        image: "https://urbankey.uz/img.jpg"
    };

    const head = buildListingHead({ kind: "property", id: 7, lang: "en", meta });
    assert.ok(head);
    assert.equal(head.lang, "en");
    assert.match(head.lines, /rel="canonical" href="https:\/\/urbankey\.uz\/en\/property\/7"/);
    assert.match(head.lines, /property="og:locale" content="en_US"/);
    assert.match(head.lines, /hreflang="en"/);
    assert.match(head.lines, /hreflang="ru"/);
    assert.match(head.lines, /hreflang="uz"/);
});

// --- Test 8: SQL Views Contain is_sold = false filter ---
test("sql views: recreate_public_views.sql и user_listings_and_leads.sql содержат фильтр is_sold = false", () => {
    const recreate = fs.readFileSync(path.resolve("sql/recreate_public_views.sql"), "utf8");
    const userLeads = fs.readFileSync(path.resolve("supabase/user_listings_and_leads.sql"), "utf8");

    assert.match(recreate, /cardss_public[\s\S]*?WHERE\s+coalesce\(is_sold,\s*false\)\s*=\s*false/i);
    assert.match(recreate, /commercials_public[\s\S]*?WHERE\s+coalesce\(is_sold,\s*false\)\s*=\s*false/i);
    assert.match(userLeads, /cardss_public[\s\S]*?where\s+coalesce\(is_sold,\s*false\)\s*=\s*false/i);
    assert.match(userLeads, /commercials_public[\s\S]*?where\s+coalesce\(is_sold,\s*false\)\s*=\s*false/i);
});

// --- Test 9: GA4 Analytics Filters Out PII ---
test("analytics: события фильтруют персональные данные (PII: phone, name, email, telegram)", () => {
    const events = [];
    globalThis.window = {
        dataLayer: [],
        gtag: (...args) => events.push(args),
        location: { href: "https://urbankey.uz/ru", pathname: "/ru", search: "" }
    };

    trackEvent("test_event", {
        source: "modal",
        name: "Ivan",
        phone: "+998901234567",
        email: "ivan@example.com",
        telegram: "@ivan",
        safe_param: "allowed"
    });

    assert.equal(events.length, 1);
    const [action, eventName, params] = events[0];
    assert.equal(action, "event");
    assert.equal(eventName, "test_event");
    assert.equal(params.source, "modal");
    assert.equal(params.safe_param, "allowed");
    assert.equal(params.name, undefined);
    assert.equal(params.phone, undefined);
    assert.equal(params.email, undefined);
    assert.equal(params.telegram, undefined);
});

// --- Test 10: GA4 generate_lead sends only source without user data ---
test("analytics: trackGenerateLead отправляет событие generate_lead без персональных данных", () => {
    const events = [];
    globalThis.window = {
        dataLayer: [],
        gtag: (...args) => events.push(args),
        location: { href: "https://urbankey.uz/ru", pathname: "/ru", search: "" }
    };

    trackGenerateLead({ source: "Connect" });
    assert.equal(events.length, 1);
    const [action, eventName, params] = events[0];
    assert.equal(eventName, "generate_lead");
    assert.equal(params.lead_source, "Connect");
    assert.equal(params.value, 1);
    assert.equal(params.currency, "UZS");
});

// --- Test 11: GA4 PageView Deduplication ---
test("analytics: trackPageView не шлёт дубли при повторном вызове того же пути", () => {
    const events = [];
    globalThis.window = {
        dataLayer: [],
        gtag: (...args) => events.push(args),
        location: { href: "https://urbankey.uz/ru/Properties", pathname: "/ru/Properties", search: "" }
    };

    trackPageView("/ru/Properties", "Title 1");
    trackPageView("/ru/Properties", "Title 1");
    trackPageView("/ru/AboutUs", "Title 2");

    const pageViews = events.filter(e => e[0] === "event" && e[1] === "page_view");
    assert.equal(pageViews.length, 2);
    assert.equal(pageViews[0][2].page_path, "/ru/Properties");
    assert.equal(pageViews[1][2].page_path, "/ru/AboutUs");
});
