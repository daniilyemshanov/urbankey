const UZS_MARKERS = /сум|so'm|som|uzs/i;
const USD_MARKERS = /\$|usd/i;

export const RATE_MIN = 1000;
export const RATE_MAX = 100000;

export const isValidRate = (rate) =>
    typeof rate === "number" && Number.isFinite(rate) && rate >= RATE_MIN && rate <= RATE_MAX;

const PER_SQM_RE = new RegExp(
    "(?:\\s*(?:за|на|per|/)\\s*(?:1\\s*)?)?" +
    "(?:м\\s*²|м\\s*2|м\\.?\\s*кв\\.?|кв\\.?\\s*м\\.?|m\\s*²|m\\s*2|sq\\.?\\s*m\\.?|sqm|kv\\.?\\s*m\\.?)" +
    "(?![\\p{L}\\d])" +
    "|\\s*(?:за|на|per|/)\\s*(?:1\\s*)?м(?![\\p{L}\\d])",
    "iu"
);

export const isPerSqmPrice = (raw) => PER_SQM_RE.test(String(raw ?? ""));

export const parsePrice = (raw) => {
    if (!raw) return null;

    const str = String(raw).trim();
    if (!str) return null;

    const perSqm = PER_SQM_RE.test(str);
    const cleaned = perSqm ? str.replace(PER_SQM_RE, " ") : str;

    const digits = cleaned.replace(/[^\d]/g, "");
    if (!digits) return null;

    const amount = Number(digits);
    if (!amount) return null;

    let currency;

    if (USD_MARKERS.test(cleaned)) currency = "USD";
    else if (UZS_MARKERS.test(cleaned)) currency = "UZS";
    else currency = amount >= 10_000_000 ? "UZS" : "USD";

    return { amount, currency, perSqm };
};

const formatNumber = (value) => Math.round(value).toLocaleString("ru-RU");

const formatIn = (amount, currency) =>
    currency === "USD" ? `$${formatNumber(amount)}` : `${formatNumber(amount)} UZS`;

const sqmUnit = () => {
    const lang = typeof document !== "undefined" ? document.documentElement.lang : "";
    return !lang || lang.startsWith("ru") ? "м²" : "m²";
};

export const formatPriceIn = (raw, displayCurrency, rate) => {
    const parsed = parsePrice(raw);
    if (!parsed) return raw || "—";

    const { amount, currency, perSqm } = parsed;
    const suffix = perSqm ? ` / ${sqmUnit()}` : "";

    if (currency === displayCurrency) return formatIn(amount, currency) + suffix;
    if (!isValidRate(rate)) return formatIn(amount, currency) + suffix;

    const converted = currency === "USD" ? amount * rate : amount / rate;
    return formatIn(converted, displayCurrency) + suffix;
};

export const priceInCurrency = (raw, target, rate, area) => {
    const parsed = parsePrice(raw);
    if (!parsed) return null;

    let { amount } = parsed;
    const { currency, perSqm } = parsed;

    if (perSqm) {
        const sqm = Number(area);
        if (!Number.isFinite(sqm) || sqm <= 0) return null;
        amount *= sqm;
    }

    if (currency === target) return amount;
    if (!isValidRate(rate)) return null;
    return currency === "USD" ? amount * rate : amount / rate;
};

export const usdToCurrency = (usd, target, rate) => {
    if (typeof usd !== "number" || !Number.isFinite(usd)) return null;
    if (target === "USD") return usd;
    if (!isValidRate(rate)) return null;

    return Math.round(usd * rate);
};

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

export const normalizeRateRecord = (record) => {
    if (!record || typeof record !== "object") return null;

    const rate = typeof record.rate === "string" ? Number(record.rate) : record.rate;
    const date = normalizeIsoDate(record.rate_date ?? record.date);

    if (!isValidRate(rate) || !date) return null;

    return { rate, date };
};

export const formatRateDate = (isoDate) => {
    const date = normalizeIsoDate(isoDate);
    if (!date) return "";

    const [y, m, d] = date.split("-");
    return `${d}.${m}.${y}`;
};

export const formatRateValue = (rate) =>
    isValidRate(rate)
        ? rate.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : "";

export const getRateNoteParams = (record) => {
    const normalized = normalizeRateRecord(record);
    if (!normalized) return null;

    return { rate: formatRateValue(normalized.rate), date: formatRateDate(normalized.date) };
};
