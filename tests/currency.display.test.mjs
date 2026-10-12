// Отображение курса: пересчёт цен по сохранённому официальному курсу, дата курса
// в интерфейсе, поведение без курса (никаких выдуманных цифр). Компоненты
// рендерятся по-настоящему (Vite SSR + react-dom/server), без браузера и сети.
// Запуск: npm run test:fx

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createServer } from "vite";

import {
    formatPriceIn, parsePrice, normalizeRateRecord, getRateNoteParams,
    formatRateDate, formatRateValue, isValidRate, priceInCurrency, usdToCurrency,
} from "../src/utils/currency.js";

// toLocaleString("ru-RU") разделяет разряды неразрывным пробелом — сравниваем с обычным.
const sp = (s) => String(s).replace(/[\u00a0\u202f]/g, " ");
const price = (...args) => sp(formatPriceIn(...args));

// ---- чистые функции -------------------------------------------------------------------

test("пересчёт USD -> UZS и UZS -> USD по официальному курсу", () => {
    assert.equal(price("85 000$", "UZS", 12000), "1 020 000 000 UZS");
    assert.equal(price("1 200 000 000 сум", "USD", 12000), "$100 000");
    assert.equal(price("85000 USD", "UZS", 12108.12), "1 029 190 200 UZS");
});

test("валюта цены совпадает с выбранной — курс не используется", () => {
    assert.equal(price("85 000$", "USD", 12000), "$85 000");
    assert.equal(price("85 000$", "USD"), "$85 000");
    assert.equal(price("1 200 000 000 сум", "UZS"), "1 200 000 000 UZS");
});

test("курса нет: цена остаётся в сохранённой валюте, подставного курса нет", () => {
    for (const rate of [undefined, null, 0, -5, NaN, "12650", 12.65, 99999999]) {
        assert.equal(price("85 000$", "UZS", rate), "$85 000", `rate=${rate}`);
        assert.equal(price("1 200 000 000 сум", "USD", rate), "1 200 000 000 UZS", `rate=${rate}`);
    }
});

test("пустая и нечисловая цена не ломаются", () => {
    assert.equal(formatPriceIn("", "USD", 12000), "—");
    assert.equal(formatPriceIn(null, "UZS", 12000), "—");
    assert.equal(formatPriceIn("договорная", "UZS", 12000), "договорная");
});

test("parsePrice не изменился (его использует серверный api/_listingDb.js)", () => {
    assert.deepEqual(parsePrice("85 000$"), { amount: 85000, currency: "USD" });
    assert.deepEqual(parsePrice("850 млн сум"), { amount: 850, currency: "UZS" });
    assert.deepEqual(parsePrice("1200000000"), { amount: 1200000000, currency: "UZS" });
    assert.equal(parsePrice(""), null);
});

test("запись курса: строка Supabase и кэш приводятся к { rate, date }; мусор отклоняется", () => {
    assert.deepEqual(normalizeRateRecord({ rate: "12108.1200", rate_date: "2026-10-12" }), { rate: 12108.12, date: "2026-10-12" });
    assert.deepEqual(normalizeRateRecord({ rate: 12108.12, date: "2026-10-12" }), { rate: 12108.12, date: "2026-10-12" });
    assert.deepEqual(normalizeRateRecord({ rate: 12108.12, rate_date: "2026-10-12T00:00:00Z" }), { rate: 12108.12, date: "2026-10-12" });

    for (const bad of [null, undefined, "x", 5, {}, { rate: 0, date: "2026-10-12" }, { rate: -1, date: "2026-10-12" },
        { rate: "abc", date: "2026-10-12" }, { rate: 12.65, date: "2026-10-12" }, { rate: 12108, date: "вчера" },
        { rate: 12108, date: "2026-02-31" }, { rate: 12108 }]) {
        assert.equal(normalizeRateRecord(bad), null, JSON.stringify(bad));
    }
    assert.equal(isValidRate(12108.12), true);
    assert.equal(isValidRate(0), false);
});

test("дата и значение курса форматируются для подписи", () => {
    assert.equal(formatRateDate("2026-10-12"), "12.10.2026");
    assert.equal(formatRateDate("мусор"), "");
    assert.equal(formatRateValue(12108.12).replace(/\s/g, " "), "12 108,12");
    assert.equal(formatRateValue(0), "");

    const note = getRateNoteParams({ rate: 12108.12, date: "2026-10-12" });
    assert.equal(note.date, "12.10.2026");
    assert.equal(getRateNoteParams(null), null);
    assert.equal(getRateNoteParams({ rate: 0, date: "2026-10-12" }), null);
});

// ---- реальный рендер компонентов -----------------------------------------------------

const store = {};
let server;
let CurrencyProvider, useCurrency, Gray, i18n;

before(async () => {
    globalThis.localStorage = {
        getItem: (k) => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: (k) => { delete store[k]; },
    };
    process.env.VITE_SUPABASE_URL = "https://fake-project.supabase.co";
    process.env.VITE_SUPABASE_KEY = "anon-key-for-tests";

    server = await createServer({ root: process.cwd(), appType: "custom", server: { middlewareMode: true }, logLevel: "silent" });

    i18n = (await server.ssrLoadModule("/src/i18n.js")).default;
    ({ CurrencyProvider, useCurrency } = await server.ssrLoadModule("/src/context/CurrencyContext.jsx"));
    Gray = (await server.ssrLoadModule("/src/components/Gray.jsx")).default;
}, { timeout: 60000 });

after(async () => {
    await server?.close();
});

const reset = (entries = {}) => {
    for (const k of Object.keys(store)) delete store[k];
    Object.assign(store, entries);
};
const normalizeSpaces = (s) => s.replace(/[\u00a0\u202f]/g, " ");
const renderFooter = () => renderToString(createElement(CurrencyProvider, null, createElement(Gray)));
const noteOf = (html) => normalizeSpaces(html.match(/<p class="[^"]*rateNote[^"]*">(.*?)<\/p>/)?.[1] ?? "");

// Компонент-«зонд» делает ровно то, что делают карточки сайта: берёт валюту и курс
// из useCurrency и форматирует цену через formatPriceIn.
const PriceProbe = ({ price }) => {
    const { currency, rate } = useCurrency();
    return createElement("span", null, formatPriceIn(price, currency, rate));
};
const renderPrice = (price) => normalizeSpaces(renderToString(createElement(CurrencyProvider, null, createElement(PriceProbe, { price }))).replace(/<[^>]+>/g, ""));

test("футер: показывает курс ЦБ и его дату (ru)", async () => {
    await i18n.changeLanguage("ru");
    reset({ usdRateCache: JSON.stringify({ rate: 12108.12, date: "2026-10-12" }) });

    assert.equal(noteOf(renderFooter()), "Курс ЦБ РУз: 1 USD = 12 108,12 сум на 12.10.2026");
});

test("футер: подпись на en и uz содержит курс и дату", async () => {
    reset({ usdRateCache: JSON.stringify({ rate: 12108.12, date: "2026-10-12" }) });

    await i18n.changeLanguage("en");
    const en = noteOf(renderFooter());
    assert.match(en, /CBU rate/);
    assert.ok(en.includes("12 108,12") && en.includes("12.10.2026"), en);

    await i18n.changeLanguage("uz");
    const uz = noteOf(renderFooter());
    assert.match(uz, /MB kursi/);
    assert.ok(uz.includes("12 108,12") && uz.includes("12.10.2026"), uz);

    await i18n.changeLanguage("ru");
});

test("футер: устаревший курс показывается со своей (старой) датой, а не с сегодняшней", async () => {
    reset({ usdRateCache: JSON.stringify({ rate: 12050.5, date: "2026-09-01" }) });

    const note = noteOf(renderFooter());
    assert.ok(note.includes("01.09.2026"), note);
    assert.ok(!note.includes("12.10.2026"));
});

test("футер: курса нет — подпись не выводится (никаких выдуманных цифр)", async () => {
    reset();
    assert.equal(noteOf(renderFooter()), "");

    reset({ usdRateCache: "не json" });
    assert.equal(noteOf(renderFooter()), "");

    reset({ usdRateCache: JSON.stringify({ rate: 0, date: "2026-10-12" }) });
    assert.equal(noteOf(renderFooter()), "");
});

test("цены в карточках: пересчёт по сохранённому курсу из контекста", () => {
    reset({ currency: "UZS", usdRateCache: JSON.stringify({ rate: 12000, date: "2026-10-12" }) });
    assert.equal(renderPrice("85 000$"), "1 020 000 000 UZS");

    reset({ currency: "USD", usdRateCache: JSON.stringify({ rate: 12000, date: "2026-10-12" }) });
    assert.equal(renderPrice("1 200 000 000 сум"), "$100 000");
});

test("цены в карточках: курса нет — цена в исходной валюте, не по выдуманному курсу", () => {
    reset({ currency: "UZS" });
    assert.equal(renderPrice("85 000$"), "$85 000");

    reset({ currency: "USD" });
    assert.equal(renderPrice("1 200 000 000 сум"), "1 200 000 000 UZS");
});

test("в коде сайта не осталось зашитого курса", async () => {
    const { readFileSync, readdirSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");

    const hits = [];
    const walk = (dir) => {
        for (const name of readdirSync(dir)) {
            const full = join(dir, name);
            if (statSync(full).isDirectory()) walk(full);
            else if (/\.(jsx?|mjs)$/.test(name) && /USD_TO_UZS_RATE|\b12650\b/.test(readFileSync(full, "utf8"))) hits.push(full);
        }
    };
    walk("src");
    walk("api");

    assert.deepEqual(hits, []);
});


// ---- сравнение цен в одной валюте (фильтр и сортировка каталога) ----

test("priceInCurrency: та же валюта — как есть, курс не нужен", () => {
    assert.equal(priceInCurrency("$50 000", "USD", null), 50000);
    assert.equal(priceInCurrency("600 000 000 UZS", "UZS", null), 600000000);
});

test("priceInCurrency: другая валюта пересчитывается по сохранённому курсу", () => {
    assert.equal(priceInCurrency("$50 000", "UZS", 12000), 600000000);
    assert.equal(priceInCurrency("600 000 000 UZS", "USD", 12000), 50000);
});

test("priceInCurrency: без курса другая валюта НЕ сравнивается (null), а не подставная цифра", () => {
    assert.equal(priceInCurrency("$50 000", "UZS", null), null);
    assert.equal(priceInCurrency("600 000 000 UZS", "USD", undefined), null);
    assert.equal(priceInCurrency("$50 000", "UZS", 0), null);
    assert.equal(priceInCurrency("$50 000", "UZS", 12.65), null);
});

test("priceInCurrency: нет цены — null", () => {
    assert.equal(priceInCurrency("", "USD", 12000), null);
    assert.equal(priceInCurrency(null, "USD", 12000), null);
    assert.equal(priceInCurrency("договорная", "USD", 12000), null);
});

test("смешанные USD и UZS сортируются и фильтруются как одна величина", () => {
    const rate = 12000;
    const items = [
        { id: "a", price: "$80 000" },            // 960 млн UZS
        { id: "b", price: "600 000 000 UZS" },    // 50 000 USD
        { id: "c", price: "$55 000" },            // 660 млн UZS
    ];

    const inUsd = items.map((i) => ({ id: i.id, v: priceInCurrency(i.price, "USD", rate) }));
    assert.deepEqual(inUsd.sort((x, y) => x.v - y.v).map((i) => i.id), ["b", "c", "a"]);

    const inUzs = items.map((i) => ({ id: i.id, v: priceInCurrency(i.price, "UZS", rate) }));
    assert.deepEqual(inUzs.sort((x, y) => x.v - y.v).map((i) => i.id), ["b", "c", "a"]);

    // "до $60 000" оставляет b и c независимо от того, в чём сохранена цена
    const max = 60000;
    assert.deepEqual(items.filter((i) => priceInCurrency(i.price, "USD", rate) <= max).map((i) => i.id), ["b", "c"]);
});

test("usdToCurrency: цены из ИИ-поиска (всегда USD) приводятся к валюте отображения", () => {
    assert.equal(usdToCurrency(80000, "USD", null), 80000);
    assert.equal(usdToCurrency(80000, "UZS", 12000), 960000000);
    assert.equal(usdToCurrency(80000, "UZS", null), null);
    assert.equal(usdToCurrency(null, "USD", 12000), null);
    assert.equal(usdToCurrency(Number.NaN, "USD", 12000), null);
});

test("Catalog.jsx: цены сравниваются через priceInCurrency, а не голыми цифрами строки", () => {
    const src = readFileSync("src/components/Catalog.jsx", "utf8");
    assert.match(src, /priceInCurrency\(item\.price, currency, rate\)/);
    assert.doesNotMatch(src, /parsePriceValue/);
});
