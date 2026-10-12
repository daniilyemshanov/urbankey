// Цены и курс валют. Модуль ЧИСТЫЙ (без браузерных API): его импортирует и
// сайт, и сервер (api/_listingDb.js использует parsePrice).
//
// Курс USD/UZS больше не зашит в код. Единственный источник — официальный
// курс ЦБ РУз, сохранённый в Supabase (таблица exchange_rates, её обновляет
// api/update-exchange-rate.js раз в сутки). CurrencyContext читает его один
// раз и передаёт во все места, где цена показывается в другой валюте, чем
// сохранена. Цены объявлений в базе при этом не меняются.

const UZS_MARKERS = /сум|so'm|som|uzs/i;
const USD_MARKERS = /\$|usd/i;

// Те же границы, что и на сервере (api/_exchangeRate.js): мусор вроде 0 или
// 12.65 никогда не используется как курс.
export const RATE_MIN = 1000;
export const RATE_MAX = 100000;

export const isValidRate = (rate) =>
    typeof rate === "number" && Number.isFinite(rate) && rate >= RATE_MIN && rate <= RATE_MAX;

export const parsePrice = (raw) => {
    if (!raw) return null;

    const str = String(raw).trim();
    if (!str) return null;

    const digits = str.replace(/[^\d]/g, "");
    if (!digits) return null;

    const amount = Number(digits);
    if (!amount) return null;

    let currency;

    if (USD_MARKERS.test(str)) currency = "USD";
    else if (UZS_MARKERS.test(str)) currency = "UZS";
    else currency = amount >= 10_000_000 ? "UZS" : "USD";

    return { amount, currency };
};

const formatNumber = (value) => Math.round(value).toLocaleString("ru-RU");

const formatIn = (amount, currency) =>
    currency === "USD" ? `$${formatNumber(amount)}` : `${formatNumber(amount)} UZS`;

// rate — сумов за 1 USD (официальный курс ЦБ). Если конвертация нужна, а
// курса нет (ещё не загружен/не сохранялся), цена показывается в ТОЙ ВАЛЮТЕ,
// в которой сохранена, — без подставного курса.
export const formatPriceIn = (raw, displayCurrency, rate) => {
    const parsed = parsePrice(raw);

    if (!parsed) return raw || "—";

    const { amount, currency } = parsed;

    if (currency === displayCurrency) return formatIn(amount, currency);
    if (!isValidRate(rate)) return formatIn(amount, currency);

    const converted = currency === "USD" ? amount * rate : amount / rate;

    return formatIn(converted, displayCurrency);
};

// Цена объявления в валюте `target` — для СРАВНЕНИЯ (фильтр по цене, сортировка).
// Числа в разных валютах напрямую сравнивать нельзя ($50 000 и 600 000 000 UZS —
// это почти одно и то же, а не 50 тысяч против 600 миллионов).
//  • валюта цены совпала с target — берётся как есть, курс не нужен;
//  • иначе нужен корректный сохранённый курс; без него возвращается null
//    ("сравнить нельзя"), а не подставная цифра.
export const priceInCurrency = (raw, target, rate) => {
    const parsed = parsePrice(raw);
    if (!parsed) return null;

    const { amount, currency } = parsed;
    if (currency === target) return amount;
    if (!isValidRate(rate)) return null;

    return currency === "USD" ? amount * rate : amount / rate;
};

// Сумма в долларах -> валюта target (для цен из ИИ-поиска, они всегда в USD).
// Нет курса, а нужны сумы — null (фильтр по такой цене не применяется).
export const usdToCurrency = (usd, target, rate) => {
    if (typeof usd !== "number" || !Number.isFinite(usd)) return null;
    if (target === "USD") return usd;
    if (!isValidRate(rate)) return null;

    return Math.round(usd * rate);
};

// ---- запись курса (из Supabase или из локального кэша браузера) ----

// "2026-10-12" (или ISO-время) -> "2026-10-12"; иначе null
const normalizeIsoDate = (value) => {
    if (typeof value !== "string") return null;
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;

    const [, y, mo, d] = m;
    const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
    const ok = date.getUTCFullYear() === Number(y)
        && date.getUTCMonth() === Number(mo) - 1
        && date.getUTCDate() === Number(d);

    return ok ? `${y}-${mo}-${d}` : null;
};

// Принимает строку exchange_rates ({ rate, rate_date }) либо кэш ({ rate, date }).
// Возвращает { rate, date } или null, если запись непригодна.
export const normalizeRateRecord = (record) => {
    if (!record || typeof record !== "object") return null;

    const rate = typeof record.rate === "string" ? Number(record.rate) : record.rate;
    const date = normalizeIsoDate(record.rate_date ?? record.date);

    if (!isValidRate(rate) || !date) return null;

    return { rate, date };
};

// "2026-10-12" -> "12.10.2026"
export const formatRateDate = (isoDate) => {
    const date = normalizeIsoDate(isoDate);
    if (!date) return "";

    const [y, m, d] = date.split("-");
    return `${d}.${m}.${y}`;
};

// 12108.12 -> "12 108,12"
export const formatRateValue = (rate) =>
    isValidRate(rate)
        ? rate.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : "";

// Данные для подписи под сайтом: { rate: "12 108,12", date: "12.10.2026" }
// или null, если курса нет (тогда подпись не показывается — никаких выдуманных цифр).
export const getRateNoteParams = (record) => {
    const normalized = normalizeRateRecord(record);
    if (!normalized) return null;

    return { rate: formatRateValue(normalized.rate), date: formatRateDate(normalized.date) };
};
