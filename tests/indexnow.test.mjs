// IndexNow: уведомление Яндекса и Bing о новых страницах.
// Запуск: node --test tests/indexnow.test.mjs (входит в npm run test:all)

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
    INDEXNOW_KEY,
    INDEXNOW_ENDPOINT,
    listingUrls,
    buildIndexNowPayload,
    submitIndexNow,
    notifyListing,
} from "../api/_indexNow.js";
import handler, { extractLocs } from "../api/indexnow-sync.js";

const saved = {};
const ENV = ["VERCEL_ENV", "INDEXNOW_ENABLED", "INDEXNOW_DISABLED", "CRON_SECRET"];

beforeEach(() => { for (const k of ENV) { saved[k] = process.env[k]; delete process.env[k]; } });
afterEach(() => { for (const k of ENV) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } });

const okFetch = (status = 200) => { const calls = []; const f = async (url, init) => { calls.push({ url, init }); return { status }; }; f.calls = calls; return f; };

test("ключ: файл на сайте совпадает с ключом в коде, длина допустима", () => {
    const file = fs.readFileSync(new URL(`../public/${INDEXNOW_KEY}.txt`, import.meta.url), "utf8").trim();
    assert.equal(file, INDEXNOW_KEY);
    assert.match(INDEXNOW_KEY, /^[a-zA-Z0-9-]{8,128}$/);
});

test("адреса объекта: три языка, квартиры и коммерция", () => {
    assert.deepEqual(listingUrls(false, 94), [
        "https://urbankey.uz/ru/property/94", "https://urbankey.uz/en/property/94", "https://urbankey.uz/uz/property/94",
    ]);
    assert.ok(listingUrls(true, 7).every((u) => u.includes("/commercial/7")));
});

test("payload: только адреса сайта, без повторов; пусто — null", () => {
    const p = buildIndexNowPayload([
        "https://urbankey.uz/ru", "https://urbankey.uz/ru", "https://evil.example/x", "не-адрес", "https://www.urbankey.uz/ru",
    ]);
    assert.deepEqual(p.urlList, ["https://urbankey.uz/ru"]);
    assert.equal(p.host, "urbankey.uz");
    assert.equal(p.key, INDEXNOW_KEY);
    assert.equal(p.keyLocation, `https://urbankey.uz/${INDEXNOW_KEY}.txt`);
    assert.equal(buildIndexNowPayload([]), null);
    assert.equal(buildIndexNowPayload(["https://evil.example/"]), null);
});

test("без VERCEL_ENV=production и без INDEXNOW_ENABLED отправки нет (тесты и локальная разработка не бьют по сети)", async () => {
    const f = okFetch();
    const r = await notifyListing(false, 1, { fetchImpl: f });
    assert.equal(r.skipped, true);
    assert.equal(f.calls.length, 0);
});

test("на продакшене Vercel запрос уходит в IndexNow", async () => {
    process.env.VERCEL_ENV = "production";
    const f = okFetch(200);
    const r = await notifyListing(true, 5, { fetchImpl: f });
    assert.equal(r.ok, true);
    assert.equal(r.count, 3);
    assert.equal(f.calls[0].url, INDEXNOW_ENDPOINT);
    assert.equal(f.calls[0].init.method, "POST");
    assert.equal(JSON.parse(f.calls[0].init.body).urlList.length, 3);
});

test("статусы: 200 и 202 — успех, 403 — нет", async () => {
    process.env.INDEXNOW_ENABLED = "1";
    assert.equal((await submitIndexNow(["https://urbankey.uz/ru"], { fetchImpl: okFetch(202) })).ok, true);
    assert.equal((await submitIndexNow(["https://urbankey.uz/ru"], { fetchImpl: okFetch(403) })).ok, false);
});

test("сбой сети не бросает исключение, INDEXNOW_DISABLED важнее force", async () => {
    process.env.INDEXNOW_ENABLED = "1";
    const boom = async () => { throw new Error("network down"); };
    const r = await submitIndexNow(["https://urbankey.uz/ru"], { fetchImpl: boom });
    assert.equal(r.ok, false);
    assert.match(r.error, /network down/);

    process.env.INDEXNOW_DISABLED = "1";
    const f = okFetch();
    assert.equal((await submitIndexNow(["https://urbankey.uz/ru"], { fetchImpl: f, force: true })).skipped, true);
    assert.equal(f.calls.length, 0);
});

test("extractLocs достаёт адреса из sitemap", () => {
    assert.deepEqual(extractLocs("<urlset><url><loc> https://urbankey.uz/ru </loc></url><url><loc>https://urbankey.uz/uz</loc></url></urlset>"), [
        "https://urbankey.uz/ru", "https://urbankey.uz/uz",
    ]);
    assert.deepEqual(extractLocs(""), []);
});

const call = async (req) => {
    const out = { headers: {} };
    const res = { setHeader: (k, v) => { out.headers[k] = v; }, status(c) { out.code = c; return this; }, json(b) { out.body = b; return this; } };
    await handler(req, res);
    return out;
};

test("endpoint /api/indexnow-sync: без секрета 503, с чужим 401, с верным отправляет sitemap", async () => {
    assert.equal((await call({ method: "POST", headers: {} })).code, 503);

    process.env.CRON_SECRET = "s3cret";
    assert.equal((await call({ method: "POST", headers: { authorization: "Bearer wrong" } })).code, 401);
    assert.equal((await call({ method: "DELETE", headers: {} })).code, 405);

    const realFetch = globalThis.fetch;
    const sent = [];
    globalThis.fetch = async (url, init) => {
        if (String(url).endsWith("/sitemap.xml")) {
            return { ok: true, status: 200, text: async () => "<urlset><url><loc>https://urbankey.uz/ru</loc></url><url><loc>https://urbankey.uz/uz</loc></url></urlset>" };
        }
        sent.push(JSON.parse(init.body));
        return { status: 200 };
    };
    try {
        const r = await call({ method: "POST", headers: { authorization: "Bearer s3cret" } });
        assert.equal(r.code, 200);
        assert.equal(r.body.urls, 2);
        assert.equal(sent.length, 1);
        assert.deepEqual(sent[0].urlList, ["https://urbankey.uz/ru", "https://urbankey.uz/uz"]);
    } finally {
        globalThis.fetch = realFetch;
    }
});
