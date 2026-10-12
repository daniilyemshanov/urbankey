// Официальный курс USD/UZS (Центральный банк Узбекистана): получение,
// проверка и сохранение. Файл начинается с "_", поэтому Vercel не
// превращает его в endpoint; точка входа — api/update-exchange-rate.js.
//
// Формат ответа ЦБ (https://cbu.uz/ru/arkhiv-kursov-valyut/veb-masteram/):
// JSON-массив записей с полями Ccy (код валюты), Nominal (количество
// единиц), Rate (курс в сумах) и Date (дата курса, "ДД.ММ.ГГГГ"), например
//   [{"Ccy":"USD","Nominal":"1","Rate":"12088.98","Date":"28.05.2025", ...}]
// Парсер терпим к вариациям: запись может прийти не в массиве, числа — строкой
// или числом (в т.ч. с запятой/пробелами), дата — "ДД.ММ.ГГГГ" или "ГГГГ-ММ-ДД",
// записей может быть несколько (берём USD).
//
// Правила безопасности курса:
//   • ноль, отрицательное, нечисло и значения вне разумного диапазона не
//     записываются никогда;
//   • резкий скачок относительно сохранённого курса (по умолчанию > 20 %)
//     считается подозрительным и отклоняется (FX_MAX_CHANGE_PCT);
//   • курс с датой СТАРШЕ сохранённой не перезаписывает более свежий;
//   • при любой неудаче сохранённый курс остаётся как есть.

import { logEvent, redactSecrets } from "./_aiLog.js";

export const PAIR = "USD_UZS";
export const CBU_USD_URL = "https://cbu.uz/ru/arkhiv-kursov-valyut/json/USD/";

// Сумов за 1 USD. Границы заведомо шире любого реального курса — их цель
// поймать мусор (0, 1, 12.65, 12650000), а не оценивать рынок.
export const RATE_MIN = 1000;
export const RATE_MAX = 100000;

const DEFAULT_TIMEOUT_MS = 7000;
const DEFAULT_ATTEMPTS = 2;
const DEFAULT_MAX_CHANGE_PCT = 20;
const MAX_FUTURE_DAYS = 3;

// Ошибка с машинным кодом: по ней endpoint отвечает, а лог различает причины.
export class RateError extends Error {
    constructor(code, message) {
        super(message || code);
        this.name = "RateError";
        this.code = code;
    }
}

// "12088.98" | 12088.98 | "12 088,98" -> 12088.98; иначе null
export function parseRateNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value !== "string") return null;

    const cleaned = value.replace(/[\s\u00a0]/g, "").replace(",", ".");
    if (!/^\d+(?:\.\d+)?$/.test(cleaned)) return null;

    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
}

// "28.05.2025" | "2025-05-28" -> "2025-05-28" (проверяется календарная корректность); иначе null
export function parseCbuDate(value) {
    if (typeof value !== "string") return null;
    const text = value.trim();

    let y, m, d;
    let match = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (match) {
        [, d, m, y] = match;
    } else if ((match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/))) {
        [, y, m, d] = match;
    } else {
        return null;
    }

    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    const valid = date.getUTCFullYear() === Number(y)
        && date.getUTCMonth() === Number(m) - 1
        && date.getUTCDate() === Number(d);

    return valid ? `${y}-${m}-${d}` : null;
}

// Достаёт USD из ответа ЦБ. Возвращает { rate, rateDate } или бросает RateError.
export function parseCbuUsdResponse(payload) {
    const list = Array.isArray(payload) ? payload : (payload && typeof payload === "object" ? [payload] : []);

    if (!list.length) throw new RateError("bad_format", "ответ ЦБ не содержит записей");

    const record = list.find((item) =>
        item && typeof item === "object" &&
        (String(item.Ccy || "").toUpperCase() === "USD" || String(item.Code || "") === "840")
    );

    if (!record) throw new RateError("bad_format", "в ответе ЦБ нет записи USD");

    const rawRate = parseRateNumber(record.Rate);
    if (rawRate == null) throw new RateError("bad_format", "поле Rate отсутствует или не число");

    // Nominal — за сколько единиц валюты указан курс. Нет поля — считаем 1.
    let nominal = 1;
    if (record.Nominal != null && record.Nominal !== "") {
        nominal = parseRateNumber(record.Nominal);
        if (nominal == null || nominal <= 0) throw new RateError("bad_format", "поле Nominal некорректно");
    }

    const rate = Math.round((rawRate / nominal) * 10000) / 10000;
    if (!(rate > 0)) throw new RateError("out_of_range", "курс не положителен");
    if (rate < RATE_MIN || rate > RATE_MAX) {
        throw new RateError("out_of_range", `курс ${rate} вне диапазона ${RATE_MIN}..${RATE_MAX}`);
    }

    const rateDate = parseCbuDate(record.Date);
    if (!rateDate) throw new RateError("bad_format", "поле Date отсутствует или некорректно");

    return { rate, rateDate };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Один запрос к ЦБ с таймаутом; при сбое — ограниченное число повторов.
// Бросает RateError("cbu_unavailable" | "bad_format" | "out_of_range").
export async function fetchCbuUsdRate({
    url = CBU_USD_URL,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    attempts = DEFAULT_ATTEMPTS,
    retryDelayMs = 500,
} = {}) {
    let lastError = null;

    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            const res = await fetch(url, {
                headers: { Accept: "application/json" },
                signal: AbortSignal.timeout(timeoutMs),
            });

            if (!res.ok) throw new RateError("cbu_unavailable", `HTTP ${res.status}`);

            let payload;
            try {
                payload = await res.json();
            } catch {
                throw new RateError("bad_format", "ответ ЦБ не является JSON");
            }

            return parseCbuUsdResponse(payload);
        } catch (e) {
            if (e instanceof RateError) {
                lastError = e;
            } else if (e?.name === "TimeoutError" || e?.name === "AbortError") {
                lastError = new RateError("cbu_unavailable", `таймаут ${timeoutMs} мс`);
            } else {
                lastError = new RateError("cbu_unavailable", redactSecrets(e?.message || e).slice(0, 120));
            }

            logEvent("FX_RATE_ATTEMPT", { attempt, code: lastError.code, reason: lastError.message });
            if (attempt < attempts && retryDelayMs > 0) await sleep(retryDelayMs);
        }
    }

    throw lastError || new RateError("cbu_unavailable");
}

// Сравнение с уже сохранённым курсом. Бросает RateError("implausible_change" | "date_in_future").
export function assertPlausible(next, previous, { now = new Date(), maxChangePct } = {}) {
    const limit = Number.isFinite(maxChangePct) && maxChangePct > 0 ? maxChangePct : DEFAULT_MAX_CHANGE_PCT;

    const futureLimit = new Date(now.getTime() + MAX_FUTURE_DAYS * 86_400_000).toISOString().slice(0, 10);
    if (next.rateDate > futureLimit) {
        throw new RateError("date_in_future", `дата курса ${next.rateDate} слишком далеко в будущем`);
    }

    if (previous && previous.rate > 0) {
        const change = Math.abs(next.rate / previous.rate - 1) * 100;
        if (change > limit) {
            throw new RateError("implausible_change", `изменение ${change.toFixed(1)}% > ${limit}% (было ${previous.rate}, пришло ${next.rate})`);
        }
    }
}

// ---- хранилище (Supabase, таблица exchange_rates; см. sql/add_exchange_rates.sql) ----

export async function loadStoredRate(supabase) {
    const { data, error } = await supabase
        .from("exchange_rates")
        .select("rate, rate_date, fetched_at")
        .eq("pair", PAIR)
        .maybeSingle();

    if (error) throw new RateError("storage_error", redactSecrets(error.message || "ошибка чтения").slice(0, 160));
    if (!data) return null;

    const rate = parseRateNumber(data.rate);
    const rateDate = parseCbuDate(String(data.rate_date || ""));
    if (rate == null || rate <= 0 || !rateDate) return null;

    return { rate, rateDate, fetchedAt: data.fetched_at || null };
}

export async function saveRate(supabase, { rate, rateDate }, now = new Date()) {
    const { error } = await supabase
        .from("exchange_rates")
        .upsert(
            { pair: PAIR, rate, rate_date: rateDate, source: "cbu.uz", fetched_at: now.toISOString() },
            { onConflict: "pair" }
        );

    if (error) throw new RateError("storage_error", redactSecrets(error.message || "ошибка записи").slice(0, 160));
}

// Полный цикл: прочитать сохранённое -> получить у ЦБ -> проверить -> записать.
// Не бросает. Любая неудача оставляет сохранённый курс нетронутым.
// Возвращает { ok, status, rate?, rateDate?, kept? }.
export async function updateExchangeRate({
    supabase,
    now = new Date(),
    maxChangePct = Number(process.env.FX_MAX_CHANGE_PCT),
    fetchOptions = {},
} = {}) {
    let previous;

    try {
        previous = await loadStoredRate(supabase);
    } catch (e) {
        // Без чтения нельзя применить защиту от скачка — писать вслепую не будем.
        logEvent("FX_RATE", { ok: false, code: e.code || "storage_error", reason: e.message });
        return { ok: false, status: "storage_error", kept: null };
    }

    const kept = previous ? { rate: previous.rate, rateDate: previous.rateDate } : null;

    let next;
    try {
        next = await fetchCbuUsdRate(fetchOptions);
        assertPlausible(next, previous, { now, maxChangePct });
    } catch (e) {
        const code = e instanceof RateError ? e.code : "unexpected";
        logEvent("FX_RATE", { ok: false, code, reason: e?.message, keptRate: kept?.rate ?? null, keptDate: kept?.rateDate ?? null });
        return { ok: false, status: code, kept };
    }

    if (previous && next.rateDate < previous.rateDate) {
        logEvent("FX_RATE", { ok: true, status: "not_newer", cbuDate: next.rateDate, keptDate: previous.rateDate });
        return { ok: true, status: "not_newer", kept };
    }

    try {
        await saveRate(supabase, next, now);
    } catch (e) {
        logEvent("FX_RATE", { ok: false, code: e.code || "storage_error", reason: e.message });
        return { ok: false, status: "storage_error", kept };
    }

    logEvent("FX_RATE", { ok: true, status: "updated", rate: next.rate, rateDate: next.rateDate });
    return { ok: true, status: "updated", rate: next.rate, rateDate: next.rateDate };
}
