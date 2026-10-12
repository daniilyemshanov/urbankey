// Тесты api/spa.js и api/sitemap.js: поведение при отсутствии конфигурации,
// сбоях и таймаутах Supabase, защита от рекурсии, статусы 200/404.
// Не требуют БД и сети: fetch подменяется. Запуск: npm run test:api
//
// Проверка на настоящей БД с RLS — см. tests/e2e/README.md.

import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";

import spa from "../api/spa.js";
import sitemap from "../api/sitemap.js";

const SHELL = '<!doctype html><html><body><div id="root"></div></body></html>';
const SB_URL = "https://fake-project.supabase.co";
const realFetch = globalThis.fetch;
const ENV_KEYS = ["VITE_SUPABASE_URL", "VITE_SUPABASE_KEY", "SUPABASE_URL", "SUPABASE_ANON_KEY", "VERCEL_AUTOMATION_BYPASS_SECRET"];

let calls;      // что запрашивалось
let supabase;   // поведение подделки Supabase: (url, init) => Response | throw | зависнуть
let shell;      // поведение index.html

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

// --- без конфигурации ---------------------------------------------------

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

// --- сбои Supabase ------------------------------------------------------

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
    // AbortSignal.timeout использует unref-таймер: в проде процесс держит живым
    // сервер/сокет, в тесте — этот интервал.
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

// --- корректные ответы БД -----------------------------------------------

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

// --- index.html ---------------------------------------------------------

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
