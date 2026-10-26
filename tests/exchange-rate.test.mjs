import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";

import {
    parseCbuUsdResponse, parseCbuDate, parseRateNumber,
    fetchCbuUsdRate, updateExchangeRate, assertPlausible, RateError, CBU_USD_URL,
} from "../api/_exchangeRate.js";
import handler, { isAuthorized } from "../api/update-exchange-rate.js";

const realFetch = globalThis.fetch;
const realLog = console.log;

let logs;
let cbuCalls;
let cbuBehavior;

const json = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const cbuRecord = (over = {}) => ({
    id: 69, Code: "840", Ccy: "USD",
    CcyNm_RU: "Доллар США", CcyNm_UZ: "AQSH dollari", CcyNm_EN: "US Dollar",
    Nominal: "1", Rate: "12108.12", Diff: "-9.5", Date: "12.10.2026",
    ...over,
});

beforeEach(() => {
    logs = [];
    cbuCalls = 0;
    console.log = (...args) => { logs.push(args.join(" ")); };
    cbuBehavior = () => json([cbuRecord()]);

    globalThis.fetch = async (url, init = {}) => {
        if (String(url).startsWith("https://cbu.uz/")) {
            cbuCalls++;
            const b = cbuBehavior(init);
            if (b instanceof Error) throw b;
            return b;
        }
        throw new Error(`непредусмотренный запрос ${url}`);
    };
});

after(() => {
    globalThis.fetch = realFetch;
    console.log = realLog;
});

function fakeSupabase({ row = null, readError = null, writeError = null } = {}) {
    const state = { row, upserts: [], reads: 0 };
    return {
        state,
        from(table) {
            assert.equal(table, "exchange_rates");
            return {
                select: () => ({
                    eq: () => ({
                        maybeSingle: async () => {
                            state.reads++;
                            return readError ? { data: null, error: { message: readError } } : { data: state.row, error: null };
                        },
                    }),
                }),
                upsert: async (payload, opts) => {
                    state.upserts.push({ payload, opts });
                    if (writeError) return { error: { message: writeError } };
                    state.row = { rate: payload.rate, rate_date: payload.rate_date, fetched_at: payload.fetched_at };
                    return { error: null };
                },
            };
        },
    };
}

const NOW = new Date("2026-10-12T04:00:00Z");
const stored = (over = {}) => ({ rate: "12100.5", rate_date: "2026-10-11", fetched_at: "2026-10-11T01:00:00Z", ...over });
const fast = { fetchOptions: { retryDelayMs: 0, timeoutMs: 200 } };

test("парсер: типичный ответ ЦБ (массив, строки, ДД.ММ.ГГГГ)", () => {
    assert.deepEqual(parseCbuUsdResponse([cbuRecord()]), { rate: 12108.12, rateDate: "2026-10-12" });
});

test("парсер: вариации формата — объект без массива, числа, запятая, ISO-дата, лишние валюты", () => {
    assert.equal(parseCbuUsdResponse(cbuRecord()).rate, 12108.12);
    assert.equal(parseCbuUsdResponse([cbuRecord({ Rate: 12108.12, Nominal: 1 })]).rate, 12108.12);
    assert.equal(parseCbuUsdResponse([cbuRecord({ Rate: "12 108,12" })]).rate, 12108.12);
    assert.equal(parseCbuUsdResponse([cbuRecord({ Date: "2026-10-12" })]).rateDate, "2026-10-12");

    const mixed = [cbuRecord({ Ccy: "EUR", Code: "978", Rate: "14000.00" }), cbuRecord()];
    assert.equal(parseCbuUsdResponse(mixed).rate, 12108.12);
});

test("парсер: Nominal делит курс; нет Nominal — считается 1", () => {
    assert.equal(parseCbuUsdResponse([cbuRecord({ Nominal: "10", Rate: "121081.2" })]).rate, 12108.12);
    const { Nominal: _omit, ...noNominal } = cbuRecord();
    assert.equal(parseCbuUsdResponse([noNominal]).rate, 12108.12);
});

test("парсер: некорректные ответы отклоняются с понятным кодом", () => {
    const bad = (payload) => assert.throws(() => parseCbuUsdResponse(payload), (e) => e instanceof RateError);
    const code = (payload) => { try { parseCbuUsdResponse(payload); } catch (e) { return e.code; } };

    bad(null);
    bad(undefined);
    bad([]);
    bad({});
    bad("<html>Service unavailable</html>");
    bad([cbuRecord({ Ccy: "EUR", Code: "978" })]);
    assert.equal(code([cbuRecord({ Rate: "0" })]), "out_of_range");
    assert.equal(code([cbuRecord({ Rate: 0 })]), "out_of_range");
    assert.equal(code([cbuRecord({ Rate: "-12000" })]), "bad_format");
    assert.equal(code([cbuRecord({ Rate: "abc" })]), "bad_format");
    assert.equal(code([cbuRecord({ Rate: null })]), "bad_format");
    assert.equal(code([cbuRecord({ Rate: "12.65" })]), "out_of_range");
    assert.equal(code([cbuRecord({ Rate: "12650000" })]), "out_of_range");
    assert.equal(code([cbuRecord({ Nominal: "0" })]), "bad_format");
    assert.equal(code([cbuRecord({ Date: undefined })]), "bad_format");
    assert.equal(code([cbuRecord({ Date: "31.02.2026" })]), "bad_format");
    assert.equal(code([cbuRecord({ Date: "вчера" })]), "bad_format");
});

test("вспомогательные парсеры чисел и дат", () => {
    assert.equal(parseRateNumber("12 108,12"), 12108.12);
    assert.equal(parseRateNumber("1e5"), null);
    assert.equal(parseRateNumber(NaN), null);
    assert.equal(parseCbuDate("01.01.2026"), "2026-01-01");
    assert.equal(parseCbuDate("2026-13-01"), null);
    assert.equal(parseCbuDate(20260101), null);
});

test("fetch: корректный ответ ЦБ; запрос идёт на официальный адрес с таймаутом", async () => {
    let seenInit;
    cbuBehavior = (init) => { seenInit = init; return json([cbuRecord()]); };

    const r = await fetchCbuUsdRate({ retryDelayMs: 0 });

    assert.deepEqual(r, { rate: 12108.12, rateDate: "2026-10-12" });
    assert.equal(CBU_USD_URL, "https://cbu.uz/ru/arkhiv-kursov-valyut/json/USD/");
    assert.ok(seenInit.signal, "должен быть AbortSignal (таймаут)");
    assert.equal(cbuCalls, 1);
});

test("fetch: временный сбой (503) -> один повтор -> успех", async () => {
    let n = 0;
    cbuBehavior = () => (++n === 1 ? json({ error: "x" }, 503) : json([cbuRecord()]));

    const r = await fetchCbuUsdRate({ retryDelayMs: 0 });

    assert.equal(r.rate, 12108.12);
    assert.equal(cbuCalls, 2);
});

test("fetch: ЦБ недоступен — ограниченное число попыток, затем cbu_unavailable", async () => {
    cbuBehavior = () => new Error("getaddrinfo ENOTFOUND cbu.uz");

    await assert.rejects(fetchCbuUsdRate({ retryDelayMs: 0, attempts: 2 }), (e) => e.code === "cbu_unavailable");
    assert.equal(cbuCalls, 2);
});

test("fetch: таймаут ЦБ прерывает запрос", async () => {
    cbuBehavior = (init) => new Promise((_, reject) => {
        const keepAlive = setTimeout(() => {}, 2000);
        init.signal.addEventListener("abort", () => {
            clearTimeout(keepAlive);
            const e = new Error("t");
            e.name = "TimeoutError";
            reject(e);
        });
    });

    const t0 = Date.now();
    await assert.rejects(fetchCbuUsdRate({ timeoutMs: 50, attempts: 1 }), (e) => e.code === "cbu_unavailable");
    assert.ok(Date.now() - t0 < 1500);
});

test("fetch: ответ не JSON (страница с ошибкой) — bad_format", async () => {
    cbuBehavior = () => new Response("<html>502 Bad Gateway</html>", { status: 200 });

    await assert.rejects(fetchCbuUsdRate({ retryDelayMs: 0, attempts: 1 }), (e) => e.code === "bad_format");
});

test("update: первый успешный курс записывается (одна строка, pair=USD_UZS)", async () => {
    const sb = fakeSupabase({ row: null });

    const r = await updateExchangeRate({ supabase: sb, now: NOW, ...fast });

    assert.equal(r.ok, true);
    assert.equal(r.status, "updated");
    assert.equal(sb.state.upserts.length, 1);
    const { payload, opts } = sb.state.upserts[0];
    assert.equal(payload.pair, "USD_UZS");
    assert.equal(payload.rate, 12108.12);
    assert.equal(payload.rate_date, "2026-10-12");
    assert.equal(opts.onConflict, "pair");
});

test("update: ЦБ недоступен — сохранённый курс остаётся, ничего не пишется", async () => {
    cbuBehavior = () => new Error("network down");
    const sb = fakeSupabase({ row: stored() });

    const r = await updateExchangeRate({ supabase: sb, now: NOW, ...fast });

    assert.equal(r.ok, false);
    assert.equal(r.status, "cbu_unavailable");
    assert.deepEqual(r.kept, { rate: 12100.5, rateDate: "2026-10-11" });
    assert.equal(sb.state.upserts.length, 0);
    assert.equal(sb.state.row.rate, "12100.5");
});

test("update: некорректный ответ (Rate=0, мусор, вне диапазона) не записывается", async () => {
    for (const payload of [[cbuRecord({ Rate: "0" })], [cbuRecord({ Rate: "abc" })], [cbuRecord({ Rate: "12.65" })], [], { error: "oops" }]) {
        cbuBehavior = () => json(payload);
        const sb = fakeSupabase({ row: stored() });

        const r = await updateExchangeRate({ supabase: sb, now: NOW, ...fast });

        assert.equal(r.ok, false, JSON.stringify(payload));
        assert.equal(sb.state.upserts.length, 0);
        assert.equal(sb.state.row.rate, "12100.5");
    }
});

test("update: если курса ещё нет и ЦБ недоступен — ничего не записывается (не 0 и не случайное число)", async () => {
    cbuBehavior = () => json({ error: "x" }, 500);
    const sb = fakeSupabase({ row: null });

    const r = await updateExchangeRate({ supabase: sb, now: NOW, ...fast });

    assert.equal(r.ok, false);
    assert.equal(r.kept, null);
    assert.equal(sb.state.upserts.length, 0);
});

test("update: резкий скачок курса (>20%) отклоняется; порог настраивается", async () => {
    cbuBehavior = () => json([cbuRecord({ Rate: "16000.00" })]);
    const sb = fakeSupabase({ row: stored() });

    const r = await updateExchangeRate({ supabase: sb, now: NOW, ...fast });
    assert.equal(r.ok, false);
    assert.equal(r.status, "implausible_change");
    assert.equal(sb.state.upserts.length, 0);

    const r2 = await updateExchangeRate({ supabase: sb, now: NOW, maxChangePct: 50, ...fast });
    assert.equal(r2.ok, true);
    assert.equal(sb.state.upserts.length, 1);
});

test("update: курс с более старой датой не затирает более свежий", async () => {
    cbuBehavior = () => json([cbuRecord({ Date: "05.10.2026", Rate: "12050.00" })]);
    const sb = fakeSupabase({ row: stored() });

    const r = await updateExchangeRate({ supabase: sb, now: NOW, ...fast });

    assert.equal(r.status, "not_newer");
    assert.equal(sb.state.upserts.length, 0);
});

test("update: дата курса далеко в будущем отклоняется", () => {
    assert.throws(
        () => assertPlausible({ rate: 12100, rateDate: "2026-12-31" }, null, { now: NOW }),
        (e) => e.code === "date_in_future"
    );
});

test("update: ошибка чтения хранилища (например, не применена миграция) — запись вслепую не выполняется", async () => {
    const sb = fakeSupabase({ readError: 'relation "exchange_rates" does not exist' });

    const r = await updateExchangeRate({ supabase: sb, now: NOW, ...fast });

    assert.equal(r.ok, false);
    assert.equal(r.status, "storage_error");
    assert.equal(sb.state.upserts.length, 0);
    assert.equal(cbuCalls, 0, "к ЦБ не ходим, пока нет возможности сохранить");
});

test("update: ошибка записи сообщается, предыдущий курс сохраняется", async () => {
    const sb = fakeSupabase({ row: stored(), writeError: "permission denied" });

    const r = await updateExchangeRate({ supabase: sb, now: NOW, ...fast });

    assert.equal(r.ok, false);
    assert.equal(r.status, "storage_error");
    assert.equal(sb.state.row.rate, "12100.5");
});

test("update: в логах нет секретов", async () => {
    process.env.SUPABASE_SERVICE_KEY = "service-role-key-FAKE-0123456789abcdef";
    const sb = fakeSupabase({ row: stored(), writeError: `denied for key ${process.env.SUPABASE_SERVICE_KEY}` });

    await updateExchangeRate({ supabase: sb, now: NOW, ...fast });

    assert.ok(!logs.join("\n").includes(process.env.SUPABASE_SERVICE_KEY));
    delete process.env.SUPABASE_SERVICE_KEY;
});

const SECRET = "cron-secret-FAKE-0123456789abcdef";

const mockRes = () => ({
    statusCode: 0, body: null, headers: {},
    setHeader(k, v) { this.headers[k] = v; return this; },
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
});

const call = async (req) => {
    const res = mockRes();
    await handler({ method: "GET", headers: {}, query: {}, ...req }, res);
    return res;
};

const SB_URL = "https://fake-project.supabase.co";

function withEndpointEnv() {
    process.env.CRON_SECRET = SECRET;
    process.env.VITE_SUPABASE_URL = SB_URL;
    process.env.SUPABASE_SERVICE_KEY = "service-role-key-FAKE-0123456789abcdef";
}
function clearEndpointEnv() {
    for (const k of ["CRON_SECRET", "VITE_SUPABASE_URL", "SUPABASE_URL", "SUPABASE_SERVICE_KEY", "FX_MAX_CHANGE_PCT"]) delete process.env[k];
}

test("endpoint: без CRON_SECRET закрыт (503), даже если прислан заголовок", async () => {
    clearEndpointEnv();

    for (const authorization of [undefined, "Bearer ", "Bearer undefined", "Bearer"]) {
        const res = await call({ headers: authorization ? { authorization } : {} });
        assert.equal(res.statusCode, 503);
    }
    assert.equal(cbuCalls, 0);
});

test("endpoint: без заголовка / с чужим секретом / секрет в query / не Bearer — 401, ЦБ не вызывается", async () => {
    withEndpointEnv();

    const attempts = [
        {},
        { headers: { authorization: "Bearer wrong-secret" } },
        { headers: { authorization: `Basic ${SECRET}` } },
        { headers: { authorization: SECRET } },
        { headers: { "x-cron-secret": SECRET } },
        { query: { secret: SECRET } },
        { headers: { authorization: `Bearer ${SECRET}x` } },
    ];

    for (const req of attempts) {
        const res = await call(req);
        assert.equal(res.statusCode, 401, JSON.stringify(req));
    }
    assert.equal(cbuCalls, 0, "неавторизованный вызов не должен запускать запрос к ЦБ");
    assert.ok(!logs.join("\n").includes(SECRET), "секрет не должен попасть в лог");
    clearEndpointEnv();
});

test("endpoint: isAuthorized принимает только Bearer с точным секретом", () => {
    assert.equal(isAuthorized({ headers: { authorization: `Bearer ${SECRET}` } }, SECRET), true);
    assert.equal(isAuthorized({ headers: { authorization: `bearer ${SECRET}` } }, SECRET), true);
    assert.equal(isAuthorized({ headers: { authorization: "Bearer nope" } }, SECRET), false);
    assert.equal(isAuthorized({ headers: {} }, SECRET), false);
});

test("endpoint: неподдерживаемый метод — 405", async () => {
    withEndpointEnv();
    const res = await call({ method: "DELETE", headers: { authorization: `Bearer ${SECRET}` } });
    assert.equal(res.statusCode, 405);
    clearEndpointEnv();
});

test("endpoint: авторизованный вызов обновляет курс (Supabase REST подменён)", async () => {
    withEndpointEnv();
    const sbCalls = [];

    const prev = globalThis.fetch;
    globalThis.fetch = async (url, init = {}) => {
        const u = String(url);
        if (u.startsWith(SB_URL)) {
            sbCalls.push({ method: init.method || "GET", url: u, body: init.body ? String(init.body) : "" });
            if ((init.method || "GET") === "GET") return json(stored());
            return new Response(null, { status: 201 });
        }
        return prev(url, init);
    };

    const res = await call({ headers: { authorization: `Bearer ${SECRET}` } });
    globalThis.fetch = prev;

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, "updated");
    assert.equal(res.body.rate, 12108.12);
    assert.equal(res.headers["Cache-Control"], "no-store");

    const write = sbCalls.find((c) => c.method === "POST");
    assert.ok(write, "должна быть запись в exchange_rates");
    assert.match(write.url, /exchange_rates/);
    assert.equal(JSON.parse(write.body).rate, 12108.12);
    assert.ok(!JSON.stringify(res.body).includes(SECRET));
    clearEndpointEnv();
});

test("endpoint: ЦБ недоступен — 502, курс в базе не тронут", async () => {
    withEndpointEnv();
    cbuBehavior = () => new Error("down");
    const writes = [];

    const prev = globalThis.fetch;
    globalThis.fetch = async (url, init = {}) => {
        const u = String(url);
        if (u.startsWith(SB_URL)) {
            if ((init.method || "GET") !== "GET") writes.push(u);
            return json(stored());
        }
        return prev(url, init);
    };

    const res = await call({ headers: { authorization: `Bearer ${SECRET}` } });
    globalThis.fetch = prev;

    assert.equal(res.statusCode, 502);
    assert.equal(res.body.ok, false);
    assert.equal(res.body.kept.rate, 12100.5);
    assert.equal(writes.length, 0);
    clearEndpointEnv();
});

test("endpoint: нет ключа Supabase — 503 без обращения к ЦБ", async () => {
    process.env.CRON_SECRET = SECRET;
    delete process.env.SUPABASE_SERVICE_KEY;
    delete process.env.VITE_SUPABASE_URL;

    const res = await call({ headers: { authorization: `Bearer ${SECRET}` } });

    assert.equal(res.statusCode, 503);
    assert.equal(cbuCalls, 0);
    clearEndpointEnv();
});
