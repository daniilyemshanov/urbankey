import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";

import spa from "../api/spa.js";
import sitemap from "../api/sitemap.js";

const SHELL = '<!doctype html><html><body><div id="root"></div></body></html>';
const SB_URL = "https://fake-project.supabase.co";
const realFetch = globalThis.fetch;
const ENV_KEYS = ["VITE_SUPABASE_URL", "VITE_SUPABASE_KEY", "SUPABASE_URL", "SUPABASE_ANON_KEY", "VERCEL_AUTOMATION_BYPASS_SECRET"];

let calls;
let supabase;
let shell;

const json = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
    for (const k of ENV_KEYS) delete process.env[k];
    calls = { shell: 0, supabase: 0 };
    shell = () => new Response(SHELL, { status: 200, headers: { "Content-Type": "text/html" } });
    supabase = () => json([]);

    globalThis.fetch = async (url, init = {}) => {
        const u = String(url);
        if (u.endsWith("/index.html")) { calls.shell++; return shell(u, init); }
        if (u.startsWith(SB_URL)) { calls.supabase++; return supabase(u, init); }
        throw new Error("unexpected fetch " + u);
    };
});
after(() => { globalThis.fetch = realFetch; });

const withEnv = () => { process.env.VITE_SUPABASE_URL = SB_URL; process.env.VITE_SUPABASE_KEY = "anon-key"; };

const mkRes = () => {
    const r = { headers: {}, code: undefined, body: undefined,
        status(c) { r.code = c; return r; }, setHeader(k, v) { r.headers[k] = v; }, send(b) { r.body = b; return r; } };
    return r;
};
const callSpa = async (query, headers = {}) => {
    const res = mkRes();
    await spa({ query, headers: { host: "urbankey.uz", "x-forwarded-proto": "https", ...headers } }, res);
    return res;
};
const callSitemap = async () => { const res = mkRes(); await sitemap({ headers: {} }, res); return res; };

test("без env: sitemap -> 503 без кэша (а не урезанный sitemap с 200)", async () => {
    const res = await callSitemap();
    assert.equal(res.code, 503);
    assert.equal(res.headers["Cache-Control"], "no-store");
    assert.ok(res.headers["Retry-After"]);
});

test("без env: страница объекта не падает, проверка пропущена и это видно в заголовке", async () => {
    const res = await callSpa({ kind: "property", id: "5" });
    assert.equal(res.code, 200);
    assert.equal(res.headers["X-SPA-Existence-Check"], "skipped-no-config");
    assert.equal(res.headers["Cache-Control"], "no-store");
    assert.equal(calls.supabase, 0);
});

test("без env: мусорный id и неизвестный URL всё равно 404 (БД не нужна)", async () => {
    for (const q of [{ kind: "property", id: "abc" }, { kind: "property", id: "-1" }, { kind: "commercial", id: "0" }, { kind: "property", id: "1e3" }, { kind: "notfound" }]) {
        const res = await callSpa(q);
        assert.equal(res.code, 404, JSON.stringify(q));
        assert.match(res.body, /id="root"/);
        assert.equal(res.headers["X-Robots-Tag"], "noindex");
    }
});

test("запасные имена env (SUPABASE_URL / SUPABASE_ANON_KEY) тоже работают", async () => {
    process.env.SUPABASE_URL = SB_URL; process.env.SUPABASE_ANON_KEY = "anon-key";
    supabase = () => json([{ card_id: 5 }]);
    const res = await callSpa({ kind: "property", id: "5" });
    assert.equal(res.code, 200);
    assert.equal(res.headers["X-SPA-Existence-Check"], "ok");
});

test("сеть до Supabase оборвалась: spa пропускает проверку, sitemap -> 503", async () => {
    withEnv();
    supabase = () => { throw new TypeError("fetch failed"); };
    const page = await callSpa({ kind: "property", id: "5" });
    assert.equal(page.code, 200);
    assert.equal(page.headers["X-SPA-Existence-Check"], "skipped-error");
    assert.equal((await callSitemap()).code, 503);
});

test("Supabase отвечает 500/401: spa пропускает проверку, sitemap -> 503", async () => {
    withEnv();
    for (const status of [500, 401]) {
        supabase = () => json({ message: "boom" }, status);
        const page = await callSpa({ kind: "commercial", id: "3" });
        assert.equal(page.code, 200, `status ${status}`);
        assert.equal(page.headers["X-SPA-Existence-Check"], "skipped-error");
        assert.equal((await callSitemap()).code, 503, `sitemap, status ${status}`);
    }
});

test("Supabase завис: spa укладывается в таймаут и не повторяет запрос", { timeout: 9000 }, async () => {
    withEnv();
    supabase = (_u, init) => new Promise((_res, rej) => init.signal?.addEventListener("abort", () => rej(init.signal.reason)));
    const keepAlive = setInterval(() => {}, 100);
    const t0 = Date.now();
    const page = await callSpa({ kind: "property", id: "5" });
    const elapsed = Date.now() - t0;
    clearInterval(keepAlive);
    assert.equal(page.code, 200);
    assert.equal(page.headers["X-SPA-Existence-Check"], "skipped-error");
    assert.ok(elapsed < 4500, `ушло ${elapsed} мс — таймаут не сработал`);
    assert.equal(calls.supabase, 1, "повторных запросов (retry) быть не должно");
});

test("опубликованный объект -> 200, кэшируется на CDN", async () => {
    withEnv();
    supabase = () => json([{ card_id: 5 }]);
    const res = await callSpa({ kind: "property", id: "5" });
    assert.equal(res.code, 200);
    assert.equal(res.headers["X-SPA-Existence-Check"], "ok");
    assert.match(res.headers["Cache-Control"], /s-maxage=60/);
});

test("is_draft НЕ влияет: страница, созданная ботом (is_draft = true), публикуется сразу -> 200", async () => {
    withEnv();
    for (const row of [{ card_id: 5, is_draft: true }, { card_id: 5, is_draft: false }, { card_id: 5, is_draft: null }]) {
        supabase = () => json([row]);
        const res = await callSpa({ kind: "property", id: "5" });
        assert.equal(res.code, 200, JSON.stringify(row));
        assert.equal(res.headers["X-SPA-Existence-Check"], "ok");
    }
});

test("нет строки страницы жилья -> 404", async () => {
    withEnv();
    supabase = () => json([]);
    assert.equal((await callSpa({ kind: "property", id: "5" })).code, 404);
});

test("коммерция: есть commercial_pages (в т.ч. is_draft = true) -> 200", async () => {
    withEnv();
    supabase = () => json([{ commercial_id: 3, is_draft: true }]);
    assert.equal((await callSpa({ kind: "commercial", id: "3" })).code, 200);
});

test("коммерция без commercial_pages, но есть в commercials_public -> 200 (упрощённая страница)", async () => {
    withEnv();
    supabase = (u) => (u.includes("/commercial_pages") ? json([]) : json([{ id: 3 }]));
    assert.equal((await callSpa({ kind: "commercial", id: "3" })).code, 200);
});

test("коммерция: нет ни страницы, ни объекта -> 404", async () => {
    withEnv();
    supabase = () => json([]);
    assert.equal((await callSpa({ kind: "commercial", id: "3" })).code, 404);
});

test("защита от рекурсии: собственный запрос за index.html не идёт в БД и не вызывает себя снова", async () => {
    withEnv();
    const res = await callSpa({ kind: "property", id: "5" }, { "x-urbankey-shell": "1" });
    assert.equal(res.code, 404);
    assert.equal(calls.shell, 0);
    assert.equal(calls.supabase, 0);
});

test("запрос за оболочкой несёт служебный заголовок (для защиты от рекурсии)", async () => {
    shell = (_u, init) => { assert.equal(init.headers["x-urbankey-shell"], "1"); return new Response(SHELL, { status: 200 }); };
    assert.equal((await callSpa({ kind: "notfound" })).code, 404);
    assert.equal(calls.shell, 1);
});

test("index.html недоступен или это не оболочка приложения -> 503, а не чужая страница", async () => {
    shell = () => new Response("nf", { status: 404 });
    assert.equal((await callSpa({ kind: "notfound" })).code, 503);
    shell = () => new Response("<html>Please log in (Deployment Protection)</html>", { status: 200 });
    const res = await callSpa({ kind: "notfound" });
    assert.equal(res.code, 503);
    assert.equal(res.headers["Cache-Control"], "no-store");
});

test("секрет обхода Deployment Protection передаётся только если задан", async () => {
    shell = (_u, init) => { assert.equal(init.headers["x-vercel-protection-bypass"], undefined); return new Response(SHELL); };
    await callSpa({ kind: "notfound" });
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET = "s3cret";
    shell = (_u, init) => { assert.equal(init.headers["x-vercel-protection-bypass"], "s3cret"); return new Response(SHELL); };
    await callSpa({ kind: "notfound" });
});

test("общие страницы и страницы районов не кэшируются на CDN (иначе после деплоя пропадают стили)", async () => {
    for (const q of [
        { kind: "page", page: "home", lang: "ru" },
        { kind: "page", page: "Properties", lang: "uz" },
        { kind: "district", dtype: "apartments", district: "yunusabad", lang: "ru" },
    ]) {
        const res = await callSpa(q);
        assert.equal(res.code, 200, JSON.stringify(q));
        assert.equal(res.headers["Cache-Control"], "public, max-age=0, must-revalidate", JSON.stringify(q));
        assert.doesNotMatch(res.headers["Cache-Control"], /s-maxage|stale-while-revalidate/);
    }
});

test("страница объекта кэшируется не дольше минуты и без stale-while-revalidate", async () => {
    withEnv();
    supabase = () => json([{ card_id: 5 }]);
    const res = await callSpa({ kind: "property", id: "5" });
    assert.equal(res.headers["Cache-Control"], "public, s-maxage=60");
});

const LISTING_ROW = {
    title_ru: "Квартира </script><b>X", title_en: "Flat", title_uz: "Kvartira",
    description_ru: "Описание <img onerror=1> Чиланзар", description_en: "Desc", description_uz: "Tavsif",
    image: "https://cdn.example.com/a b.jpg",
};

const HEAD_SHELL = `<!doctype html><html lang="ru"><head><title>t</title></head><body><div id="root"></div></body></html>`;
const listingSupabase = ({ extraFails = false, rate = true } = {}) => (u) => {
    if (u.includes("/exchange_rates")) return rate ? json({ rate: "12500", rate_date: "2026-11-01", fetched_at: null }) : json({ message: "x" }, 500);
    if (u.includes("/villas") && u.includes("location_ru")) return extraFails ? json({ message: "x" }, 400) : json({ location_ru: "Чиланзар", location_en: "Chilanzar", location_uz: "Chilonzor" });
    if (u.includes("/villas")) return json({ card_id: 5 });
    if (u.includes("/cardss_public") && u.includes("bedrooms_ru")) return extraFails ? json({ message: "x" }, 400) : json({ bedrooms_ru: "2", bedrooms_en: "2", bedrooms_uz: "2", type_ru: "Квартира", type_en: "Flat", type_uz: "Kvartira", price: "$50 000" });
    if (u.includes("/cardss_public") && u.includes("title_ru")) return json(LISTING_ROW);
    if (u.includes("/cardss_public")) return json({ id: 5 });
    return json([]);
};

const count = (html, re) => (html.match(re) || []).length;

test("листинг: SSR-тело (h1, ссылки) и по одному ld+json на тип с data-ssr-seo, всё экранировано", async () => {
    withEnv();
    shell = () => new Response(HEAD_SHELL, { status: 200 });
    supabase = listingSupabase();
    const res = await callSpa({ kind: "property", id: "5", lang: "ru" });
    assert.equal(res.code, 200);
    assert.match(res.body, /<div id="root"><main data-ssr-seo="1"/);
    assert.match(res.body, /<h1>Квартира &lt;\/script&gt;&lt;b&gt;X<\/h1>/);
    assert.match(res.body, /<a href="\/ru\/Properties">/);
    assert.match(res.body, /<a href="\/ru\/Properties\/apartments\//);
    assert.equal(count(res.body, /<script data-ssr-seo="1" type="application\/ld\+json">/g), 2);
    assert.equal(count(res.body, /"@type":"RealEstateListing"/g), 1);
    assert.equal(count(res.body, /"@type":"BreadcrumbList"/g), 1);
    assert.ok(!/<\/script><b>/.test(res.body), "< внутри JSON-LD должен быть экранирован");
    assert.match(res.body, /"priceCurrency":"UZS"/);
});

test("листинг: без курса Offer опускается, страница остаётся 200", async () => {
    withEnv();
    shell = () => new Response(HEAD_SHELL, { status: 200 });
    supabase = listingSupabase({ rate: false });
    const res = await callSpa({ kind: "property", id: "5", lang: "ru" });
    assert.equal(res.code, 200);
    assert.equal(count(res.body, /"@type":"RealEstateListing"/g), 1);
    assert.ok(!res.body.includes('"@type":"Offer"'));
});

test("листинг: сбой опциональных запросов не теряет основные метаданные", async () => {
    withEnv();
    shell = () => new Response(HEAD_SHELL, { status: 200 });
    supabase = listingSupabase({ extraFails: true });
    const res = await callSpa({ kind: "property", id: "5", lang: "en" });
    assert.equal(res.code, 200);
    assert.match(res.body, /<title data-ssr-seo="1">Flat — UrbanKey<\/title>/);
    assert.match(res.body, /<h1>Flat<\/h1>/);
    assert.equal(count(res.body, /"@type":"BreadcrumbList"/g), 1);
});

import { buildListingHead, buildListingBody } from "../api/_seoMeta.js";

const ldBlocks = (lines) => [...lines.matchAll(/<script data-ssr-seo="1" type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

test("некорректный URL картинки (%): ни head, ни тело, ни JSON-LD не падают, остальные данные на месте", () => {
    const meta = { title: { ru: "Квартира" }, description: { ru: "Описание" }, image: "https://cdn.example.com/%E0%A4%A.jpg", price: "500 000 000 сум" };
    const head = buildListingHead({ kind: "property", id: 5, lang: "ru", meta });
    assert.ok(head, "head не должен пропасть");
    assert.match(head.lines, /<title data-ssr-seo="1">Квартира — UrbanKey<\/title>/);
    assert.match(head.lines, /og:image" content="https:\/\/urbankey\.uz\/image%20\(16\)\.webp"/, "og:image -> запасная картинка");
    assert.ok(!head.body.includes("<img"));
    assert.match(head.body, /<h1>Квартира<\/h1>/);
    const [listing, breadcrumb] = ldBlocks(head.lines);
    assert.equal(listing["@type"], "RealEstateListing");
    assert.equal(breadcrumb["@type"], "BreadcrumbList");
    assert.ok(!("image" in listing), "поле image не выводится");
    assert.equal(listing.offers.price, 500000000);
});

test("корректные URL картинки не меняются", () => {
    const meta = { title: { ru: "T" }, description: { ru: "D" } };
    const abs = buildListingHead({ kind: "property", id: 5, lang: "ru", meta: { ...meta, image: "https://cdn.example.com/a b.jpg" } });
    assert.match(abs.body, /<img src="https:\/\/cdn\.example\.com\/a%20b\.jpg"/);
    assert.deepEqual(ldBlocks(abs.lines)[0].image, ["https://cdn.example.com/a%20b.jpg"]);
    const rel = buildListingBody({ kind: "property", id: 5, lang: "ru", meta: { ...meta, image: "/img/x y.webp" } });
    assert.match(rel, /<img src="https:\/\/urbankey\.uz\/img\/x%20y\.webp"/);
});

test("подписи характеристик локализованы, пустые значения не выводятся", () => {
    const trio = (ru, en, uz) => ({ ru, en, uz });
    const property = {
        title: trio("Кв", "Flat", "Kv"), description: trio("D", "D", "D"), price: "$50 000",
        location: trio("Юнусабад", "Yunusabad", "Yunusobod"),
        facts: { type: trio("Квартира", "Apartment", "Kvartira"), bedrooms: trio("2", "2", "2") },
    };
    const line = (html) => html.match(/<p>([^<]*:[^<]*)<\/p>/)[1];
    assert.equal(line(buildListingBody({ kind: "property", id: 1, lang: "ru", meta: property })), "Квартира · Район: Юнусабад · Комнат: 2 · Цена: $50 000");
    assert.equal(line(buildListingBody({ kind: "property", id: 1, lang: "en", meta: property })), "Apartment · District: Yunusabad · Rooms: 2 · Price: $50 000");
    assert.equal(line(buildListingBody({ kind: "property", id: 1, lang: "uz", meta: property })), "Kvartira · Tuman: Yunusobod · Xonalar: 2 · Narx: $50 000");

    const commercial = {
        title: trio("Офис", "Office", "Ofis"), description: trio("D", "D", "D"), price: "100 000 $",
        facts: { district: trio("Юнусабад", "Yunusabad", "Yunusobod"), area: "120", floor: "3" },
    };
    assert.equal(line(buildListingBody({ kind: "commercial", id: 1, lang: "ru", meta: commercial })), "Район: Юнусабад · Площадь: 120 м² · Этаж: 3 · Цена: 100 000 $");
    assert.equal(line(buildListingBody({ kind: "commercial", id: 1, lang: "uz", meta: commercial })), "Tuman: Yunusobod · Maydon: 120 m² · Qavat: 3 · Narx: 100 000 $");

    const sparse = buildListingBody({ kind: "commercial", id: 1, lang: "en", meta: { title: trio("Офис", "Office", "Ofis"), description: trio("", "", ""), facts: { floor: "5", area: " ", district: trio("", "", "") } } });
    assert.match(sparse, /<p>Floor: 5<\/p>/);
    assert.ok(!/District:|Area:|Price:| · /.test(sparse), "нет пустых подписей и разделителей");
    const none = buildListingBody({ kind: "property", id: 1, lang: "en", meta: { title: trio("Кв", "Flat", "Kv"), description: trio("", "", "") } });
    assert.ok(!none.includes("<p>"), "без данных нет пустого <p>");
});
