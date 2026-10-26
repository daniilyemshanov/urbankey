import { runListingAiChain, configuredProviders } from "./aiProviders.js";
import { ErrorClass, logEvent } from "./_aiLog.js";
import { applyDistrictRules, districtPromptAddendum } from "./_districtRules.js";
import {
    NB, NA,
    detectType,
    extractAmenities,
    extractRooms,
    extractBathrooms,
    extractArea,
    extractFloorInfo,
    extractLocationLine,
    extractPrice,
    extractPriceInfo,
    priceToNumber,
    priceNumberForPage,
    isCommercialPost,
    detectIsRent,
    detectIsSold,
    hasDealMarker,
    hasPositiveMention,
    isContactLine,
    cleanTitle,
    buildFactsParagraph,
    buildNarrativeFromSource,
    isNumberSupported,
    extractNumberValues,
    scriptShare,
    toNumber,
    numToString,
} from "./_listingFacts.js";

export {
    detectType,
    extractAmenities,
    extractRooms,
    extractBathrooms,
    extractArea,
    extractFloorInfo,
    extractLocationLine,
    extractPrice,
    extractPriceInfo,
    priceToNumber,
    priceNumberForPage,
    isCommercialPost,
    detectIsRent,
};

const reU = (source, flags = "iu") => new RegExp(source, flags);

const TRANSLATE_TIMEOUT_MS = 6000;

export async function translateText(text, target) {
    if (!text) return "";

    let lastError = "";

    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=ru&tl=" +
                target + "&dt=t&q=" + encodeURIComponent(text);

            const res = await fetch(url, { signal: AbortSignal.timeout(TRANSLATE_TIMEOUT_MS) });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();
            const out = (data?.[0] || []).map((part) => part?.[0] || "").join("");
            if (out.trim()) return out;
            throw new Error("пустой перевод");
        } catch (e) {
            lastError = e?.name === "TimeoutError" ? "таймаут" : String(e?.message || e).slice(0, 120);
        }
    }

    logEvent("TRANSLATE_FAILED", { class: ErrorClass.MODEL, target, reason: lastError });
    return text;
}

export async function fillMissingTranslations(fieldsObj, bases) {
    const tasks = [];

    for (const base of bases) {
        const ru = fieldsObj[`${base}_ru`];
        if (!ru) continue;

        for (const lang of ["en", "uz"]) {
            const key = `${base}_${lang}`;
            if (fieldsObj[key]) continue;

            tasks.push(
                translateText(ru, lang).then((t) => {
                    fieldsObj[key] = t;
                })
            );
        }
    }

    await Promise.all(tasks);
}

export function slugify(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "listing";
}

const isServiceLine = (line) =>
    /^#/.test(line) ||
    /^(EN|UZ|RU_DESC|EN_DESC|UZ_DESC)\s*:/i.test(line) ||
    /^(Цена|Стоимость|Price|Narxi|Ориентир|Landmark|Mo'ljal|Высота потолков|Площадь|Этаж|Новая)\s*:?/i.test(line) ||
    line.includes("📍");

function titleFromFacts({ rooms, type, isCommercial, location }) {
    const base = isCommercial
        ? "Коммерческое помещение"
        : (rooms ? `${rooms}-комнатная ${type.ru.toLowerCase()}` : type.ru);
    const place = String(location || "").split(",")[0].trim();
    return place && place.length <= 40 ? `${base}, ${place}` : base;
}

function buildAbout(description, factsParagraph, priceNote) {
    const parts = [];
    if (description) parts.push(description);
    if (factsParagraph && factsParagraph !== description) parts.push(factsParagraph);
    if (priceNote) parts.push(`Цена: ${priceNote}.`);
    return parts.join("\n\n").trim();
}

export function countLabelsFor(kind, n) {
    const num = Number(n);
    if (!Number.isInteger(num) || num <= 0) return { ru: "", en: "", uz: "" };

    const mod10 = num % 10;
    const mod100 = num % 100;
    const form = mod10 === 1 && mod100 !== 11 ? 0 : (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 1 : 2);

    if (kind === "bedrooms") {
        return {
            ru: `${num} ${["спальня", "спальни", "спален"][form]}`,
            en: `${num} ${num === 1 ? "bedroom" : "bedrooms"}`,
            uz: `${num} yotoqxona`,
        };
    }
    return {
        ru: `${num} ${["ванная", "ванные", "ванных"][form]}`,
        en: `${num} ${num === 1 ? "bathroom" : "bathrooms"}`,
        uz: `${num} hammom`,
    };
}

export function parseListing(text) {
    const source = String(text || "");
    const lines = source.split("\n").map((l) => l.trim()).filter(Boolean);

    const type = detectType(source);
    const rooms = extractRooms(source);
    const bathrooms = extractBathrooms(source);
    const area = extractArea(source);
    const { floor, totalFloors } = extractFloorInfo(source);
    const priceInfo = extractPriceInfo(source);
    const amenities = extractAmenities(source);
    const locationLine = extractLocationLine(source);
    const isCommercial = isCommercialPost(source);
    const isRent = detectIsRent(source);
    const dealMarker = hasDealMarker(source);
    const isSold = detectIsSold(source);

    const titleCandidate = lines.find((l) => !isServiceLine(l) && !isContactLine(l) && /\p{L}{3}/u.test(l));
    let title = cleanTitle(titleCandidate);
    const titleFromText = Boolean(title);
    if (!title) title = titleFromFacts({ rooms, type, isCommercial, location: locationLine });

    const ruDescMarker = source.match(/RU_DESC\s*:\s*(.+)/i)?.[1]?.trim();
    const factsParagraph = buildFactsParagraph({
        type, rooms, area, floor, totalFloors, location: locationLine,
        isCommercial, amenities, dealMarker, isRent,
    });

    const narrative = buildNarrativeFromSource(source, titleCandidate, isServiceLine);
    const description = ruDescMarker || narrative || factsParagraph;

    const missing = [];
    if (!titleFromText || (title === type.ru && !/квартир/i.test(source))) missing.push("название");
    if (!priceInfo.raw) missing.push("цена");
    if (!rooms && !area) missing.push("комнаты/площадь");

    const parsed = {
        title_ru: title,
        title_en: source.match(/^EN\s*:\s*(.+)/im)?.[1]?.trim() || "",
        title_uz: source.match(/^UZ\s*:\s*(.+)/im)?.[1]?.trim() || "",
        description_ru: description,
        description_en: source.match(/EN_DESC\s*:\s*(.+)/i)?.[1]?.trim() || "",
        description_uz: source.match(/UZ_DESC\s*:\s*(.+)/i)?.[1]?.trim() || "",
        about_ru: buildAbout(description, factsParagraph, priceInfo.perSqmRaw),
        about_en: "",
        about_uz: "",
        price: priceInfo.raw,
        priceNumber: priceNumberForPage(priceInfo),
        currency: priceInfo.currency,
        pricePerSqm: priceInfo.perSqmRaw,
        bedrooms: rooms,
        bathrooms,
        area,
        floor,
        totalFloors,
        type,
        locationLine,
        amenities,
        isCommercial,
        isRent,
        isSold,
        commercialFields: {
            area,
            floor,
            ceiling: source.match(/Высота потолков\s*:\s*([\d.,]+)/i)?.[1]?.replace(",", ".") || "",
            district_ru: source.match(/([А-Яа-яёЁ-]+\s+район\p{L}*)/iu)?.[1]?.trim() || "",
            district_en: "",
            district_uz: "",
            address_ru: locationLine,
            address_en: "",
            address_uz: "",
            landmark_ru: source.match(/Ориентир\s*:\s*(.+)/i)?.[1]?.trim() || "",
            landmark_en: source.match(/Landmark\s*:\s*(.+)/i)?.[1]?.trim() || "",
            landmark_uz: source.match(/Mo'ljal\s*:\s*(.+)/i)?.[1]?.trim() || "",
            class_ru: "",
            class_en: "",
            class_uz: "",
        },
        missing,
    };

    parsed.diagnostics = {
        source: "regex",
        provider: null,
        attempts: [],
        extracted: summarizeExtracted(parsed),
        filledFromRegex: [],
        rejected: [],
        warnings: [],
        errors: [],
    };

    return parsed;
}

function summarizeExtracted(parsed) {
    return {
        title: Boolean(parsed.title_ru),
        description: Boolean(parsed.description_ru),
        price: Boolean(parsed.price),
        rooms: Boolean(parsed.bedrooms),
        bathrooms: Boolean(parsed.bathrooms),
        area: Boolean(parsed.area),
        floor: Boolean(parsed.floor),
        totalFloors: Boolean(parsed.totalFloors),
        location: Boolean(parsed.commercialFields?.address_ru || parsed.commercialFields?.district_ru),
        amenities: (parsed.amenities || []).length,
    };
}

const SCHEMA_STR = { type: "string" };
const SCHEMA_STR_NULL = { type: ["string", "null"] };
const SCHEMA_INT_NULL = { type: ["integer", "null"] };
const SCHEMA_NUM_NULL = { type: ["number", "null"] };

const AI_JSON_SCHEMA = {
    type: "object",
    properties: {
        title_ru: SCHEMA_STR,
        title_en: SCHEMA_STR,
        title_uz: SCHEMA_STR,
        description_ru: SCHEMA_STR,
        description_en: SCHEMA_STR,
        description_uz: SCHEMA_STR,
        price_raw: SCHEMA_STR_NULL,
        price_number: SCHEMA_NUM_NULL,
        bedrooms: SCHEMA_INT_NULL,
        bathrooms: SCHEMA_INT_NULL,
        area: SCHEMA_NUM_NULL,
        floor: SCHEMA_INT_NULL,
        total_floors: SCHEMA_INT_NULL,
        ceiling_height: SCHEMA_NUM_NULL,
        type_ru: SCHEMA_STR,
        district: SCHEMA_STR_NULL,
        address: SCHEMA_STR_NULL,
        landmark: SCHEMA_STR_NULL,
        is_commercial: { type: "boolean" },
        is_rent: { type: "boolean" },
        is_sold: { type: "boolean" },
        amenities: {
            type: "array",
            items: {
                type: "object",
                properties: { ru: SCHEMA_STR, en: SCHEMA_STR, uz: SCHEMA_STR },
                required: ["ru", "en", "uz"],
            },
        },
    },
    required: [
        "title_ru", "title_en", "title_uz",
        "description_ru", "description_en", "description_uz",
        "price_raw", "price_number", "bedrooms", "bathrooms", "area",
        "floor", "total_floors", "ceiling_height",
        "type_ru", "district", "address", "landmark",
        "is_commercial", "is_rent", "is_sold", "amenities",
    ],
};

const GEMINI_RESPONSE_SCHEMA = (() => {
    const g = (t, nullable = false) => (nullable ? { type: t, nullable: true } : { type: t });
    return {
        type: "OBJECT",
        properties: {
            title_ru: g("STRING"), title_en: g("STRING"), title_uz: g("STRING"),
            description_ru: g("STRING"), description_en: g("STRING"), description_uz: g("STRING"),
            price_raw: g("STRING", true), price_number: g("NUMBER", true),
            bedrooms: g("INTEGER", true), bathrooms: g("INTEGER", true),
            area: g("NUMBER", true), floor: g("INTEGER", true), total_floors: g("INTEGER", true),
            ceiling_height: g("NUMBER", true),
            type_ru: g("STRING"),
            district: g("STRING", true), address: g("STRING", true), landmark: g("STRING", true),
            is_commercial: g("BOOLEAN"), is_rent: g("BOOLEAN"), is_sold: g("BOOLEAN"),
            amenities: {
                type: "ARRAY",
                items: {
                    type: "OBJECT",
                    properties: { ru: g("STRING"), en: g("STRING"), uz: g("STRING") },
                    required: ["ru", "en", "uz"],
                },
            },
        },
        required: AI_JSON_SCHEMA.required,
    };
})();

const AI_SYSTEM_PROMPT_BASE = `Ты помощник агентства недвижимости UrbanKey (Ташкент). Тебе дают текст поста с объявлением (чаще всего на русском; бывают узбекский и английский, а также смесь). Извлеки данные и верни ТОЛЬКО валидный JSON-объект по заданной структуре.

ГЛАВНОЕ ПРАВИЛО: используй ТОЛЬКО то, что явно написано в тексте. Ничего не выдумывай и не достраивай. Если характеристики в тексте нет — ставь null (для чисел и строк-необязательных) или пустую строку. Лучше пустое значение, чем догадка.

Правила:
1. title_ru — короткий заголовок (до 80 символов): тип и главные факты из текста (например "2-комнатная квартира в ЖК Dream House"). Без эмодзи, без цены, без телефона. Только факты из поста.
2. title_en, title_uz — точный перевод заголовка на английский и на узбекский (латиница).
3. description_ru — связный абзац из 2–5 предложений, ТОЛЬКО на основе фактов поста: тип объекта, комнаты, площадь, этаж/этажность, расположение, состояние, ремонт, мебель, техника, удобства и любые другие характеристики, которые явно указаны. Если в посте есть условия сделки (залог, предоплата, коммунальные платежи, срок аренды, рассрочка, ипотека, торг, «собственник», «без комиссии») — перескажи их одним предложением, как написано. Если фактов мало — одно-два коротких нейтральных предложения. Не оставляй описание пустым, если в посте есть что пересказать. НЕ включай саму цену объекта, телефоны, имена, ссылки.
4. НЕЛЬЗЯ добавлять оценки и характеристики, которых нет в тексте: "уютная", "светлая", "просторная", "тихий район", "престижный", "отличный вариант", "рядом инфраструктура" и т.п. Если слово есть в посте — можно использовать, если нет — нельзя. Не придумывай расстояния, годы постройки, материалы, виды из окон.
5. description_en, description_uz — точный перевод description_ru (узбекский — латиницей). Не добавляй ничего нового.
6. price_raw — цена объекта так, как написана, с валютой ($, USD, у.е., сум). Для аренды это цена за период, указанный в посте (обычно за месяц), а не залог. Если указаны две валюты (например, «85 000$ или 1 080 млн сум») — берёшь долларовую; если только в сумах — в сумах. Никогда не пересчитывай одну валюту в другую и не выдумывай курс. Если цена указана только за 1 м² (например «1800$ за м2», «1 800 $/кв.м») — price_raw = эта цена вместе с пометкой «за м²» (например «1800$ за м²»), а price_number = null; не умножай её на площадь и не выдавай за итоговую. Если в посте есть и итоговая цена, и цена за м² — price_raw = итоговая. Залог, предоплата и коммунальные — НЕ цена объекта. price_number — число из price_raw в ТОЙ ЖЕ валюте, без конвертации ("85 000$" → 85000, "1,2 млн $" → 1200000, "850 млн сум" → 850000000). Нет цены — null.
7. bedrooms — число КОМНАТ из текста: "2-комнатная", "двухкомнатная", "3 комнаты", "2к" → 2; если указаны именно спальни — их число. "Студия" без числа → null. Нет данных — null.
8. bathrooms — число санузлов/ванных ("2 санузла" → 2). "Раздельный санузел" без числа → null.
9. area — общая площадь в м² числом ("68 м²" → 68, "68,5 кв.м" → 68.5). Площадь кухни/жилая — НЕ общая. Нет данных — null.
10. floor и total_floors: "5/9 этаж", "5/9" (даже без слова "этаж"), "5 из 9", "эт. 5/9", "этаж 5, этажность 9", "qavat 5/9", "5 этаж девятиэтажного дома" → floor=5, total_floors=9. Запись "3/5/9" в объявлении о квартире — это комнаты/этаж/этажность: rooms=3, floor=5, total_floors=9. Этаж никогда не больше этажности и не равен площади, цене или номеру телефона. "9-этажный дом" без этажа квартиры → floor=null, total_floors=9. Только числа из текста.
11. ceiling_height — высота потолков в метрах, если указана, иначе null.
12. type_ru: "Квартира", "Дом" или "Новостройка". Это поле ТИП ЖИЛЬЯ. Вилла/коттедж/резиденция/пентхаус — НЕ отдельные типы, ставь "Квартира" (или "Дом", если это явно частный дом). Название ЖК ("Dream House") не определяет тип.
13. district — район города, address — улица/адрес, landmark — ориентир. Только если указаны в тексте, иначе null.
14. is_commercial = true только для коммерческой недвижимости (офис, магазин, склад, помещение под бизнес). Обычная квартира — false.
15. is_rent = true, если объект сдаётся в аренду ("сдам", "аренда", "ижара"); если продаётся — false.
16. is_sold = true только если в тексте прямо сказано, что объект уже продан/сдан/снят с продажи.
17. amenities — список преимуществ ТОЛЬКО из подтверждённых фактов поста (мебель, техника, балкон, парковка, ремонт, лифт, охрана, вид и т.п.). Не добавляй то, о чём в тексте нет ни слова. Фразы вроде "без мебели" означают, что мебели НЕТ — такой пункт не включай. Для каждого пункта дай ru, en, uz (узбекский латиницей), коротко: 1–3 слова.
18. Узбекский текст — латиницей. Русский — на русском языке.`;

const AI_SYSTEM_PROMPT = `${AI_SYSTEM_PROMPT_BASE}\n${districtPromptAddendum()}`;

function sanitizeAiText(value, maxLength = 1500) {
    if (value == null) return "";
    if (typeof value !== "string") {
        if (typeof value === "number") return String(value);
        return "";
    }

    return value
        .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "")
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/(^|\s)[*_`#]+(?=\S)/g, "$1")
        .replace(/\r/g, "")
        .replace(/[ \t]{2,}/g, " ")
        .trim()
        .slice(0, maxLength);
}

const TEXT_FIELDS = [
    "title_ru", "title_en", "title_uz",
    "description_ru", "description_en", "description_uz",
    "price_raw", "type_ru", "district", "address", "landmark",
];

const LIMITS = {
    bedrooms: [1, 15],
    bathrooms: [1, 10],
    area: [5, 100000],
    floor: [1, 200],
    total_floors: [1, 200],
    ceiling_height: [1.8, 12],
};

function toBoolean(value) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1;
    if (typeof value === "string") return /^(true|да|yes|1)$/i.test(value.trim());
    return false;
}

function coerceNumeric(field, raw) {
    if (raw == null || raw === "") return { value: null, issue: null };

    let value = raw;

    if (typeof value === "string") {
        const m = value.replace(/\s+/g, "").match(/^(\d+(?:[.,]\d+)?)/);
        value = m ? toNumber(m[1]) : NaN;
    }

    if (typeof value !== "number" || !Number.isFinite(value)) {
        return { value: null, issue: `${field}: не число (${typeof raw})` };
    }

    const [min, max] = LIMITS[field];
    if (value < min || value > max) {
        return { value: null, issue: `${field}: ${value} вне диапазона ${min}..${max}` };
    }

    if (["bedrooms", "bathrooms", "floor", "total_floors"].includes(field)) {
        if (!Number.isInteger(value)) return { value: null, issue: `${field}: не целое (${value})` };
    }

    return { value, issue: null };
}

export function validateAiListing(raw, sourceText = "", regexFacts = null) {
    if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
        return { ok: false, reason: "ответ не является JSON-объектом" };
    }

    const issues = [];
    const value = {};

    for (const key of TEXT_FIELDS) {
        const v = raw[key];
        if (v == null) value[key] = "";
        else if (typeof v === "string") value[key] = sanitizeAiText(v);
        else if (typeof v === "number") value[key] = String(v);
        else {
            value[key] = "";
            issues.push(`${key}: ожидалась строка, получен ${Array.isArray(v) ? "массив" : typeof v}`);
        }
    }

    const rawFloor = raw.floor;
    let floorFromSlash = null;
    if (typeof rawFloor === "string" && /^\s*\d+\s*[/\\]\s*\d+\s*$/.test(rawFloor)) {
        const [f, t] = rawFloor.split(/[/\\]/).map((x) => Number(x.trim()));
        floorFromSlash = { floor: f, total: t };
    }

    for (const field of Object.keys(LIMITS)) {
        const input = field === "floor" && floorFromSlash ? floorFromSlash.floor
            : field === "total_floors" && floorFromSlash && raw.total_floors == null ? floorFromSlash.total
            : raw[field];

        const { value: n, issue } = coerceNumeric(field, input);
        value[field] = n;
        if (issue) issues.push(issue);
    }

    if (raw.price_number == null || raw.price_number === "") {
        value.price_number = null;
    } else {
        const n = typeof raw.price_number === "number" ? raw.price_number : toNumber(raw.price_number);
        if (Number.isFinite(n) && n > 0) value.price_number = n;
        else {
            value.price_number = null;
            issues.push("price_number: не положительное число");
        }
    }

    value.is_commercial = toBoolean(raw.is_commercial);
    value.is_rent = toBoolean(raw.is_rent);
    value.is_sold = toBoolean(raw.is_sold);
    value._has_is_commercial = raw.is_commercial != null;

    value.amenities = [];
    if (raw.amenities != null && !Array.isArray(raw.amenities)) {
        issues.push("amenities: ожидался массив");
    } else {
        for (const item of raw.amenities || []) {
            if (typeof item === "string" && item.trim()) {
                value.amenities.push({ ru: sanitizeAiText(item, 60), en: "", uz: "" });
            } else if (item && typeof item === "object") {
                const ru = sanitizeAiText(item.ru, 60);
                const en = sanitizeAiText(item.en, 60);
                const uz = sanitizeAiText(item.uz, 60);
                if (ru || en) value.amenities.push({ ru, en, uz });
            }
        }
    }

    const hasAnything =
        value.title_ru || value.description_ru || value.price_raw ||
        value.bedrooms != null || value.area != null || value.floor != null ||
        value.total_floors != null || value.district || value.address || value.amenities.length > 0;

    if (!hasAnything) {
        return { ok: false, reason: "модель вернула пустую структуру (ни названия, ни описания, ни характеристик)" };
    }

    const source = String(sourceText || "");
    const sourceScript = scriptShare(source);

    if (sourceScript.cyrShare > 0.5) {
        const ruText = `${value.title_ru} ${value.description_ru}`;
        const share = scriptShare(ruText);
        if (share.total >= 12 && share.cyrShare < 0.3) {
            return { ok: false, reason: "title_ru/description_ru написаны не на русском языке" };
        }
    }

    if (regexFacts) {
        const regexHard = [regexFacts.price, regexFacts.bedrooms, regexFacts.area, regexFacts.floor].filter(Boolean).length;
        const modelHard = [value.price_raw, value.bedrooms, value.area, value.floor].filter((x) => x != null && x !== "").length;
        if (regexHard >= 2 && modelHard === 0) {
            return { ok: false, reason: "модель не извлекла характеристики, явно указанные в тексте (цена/комнаты/площадь/этаж)" };
        }
    }

    if (!value.title_ru && !value.description_ru && sourceScript.total >= 30) {
        return { ok: false, reason: "пустые title_ru и description_ru при непустом тексте объявления" };
    }

    return { ok: true, value, issues };
}

const TYPE_BY_RU = {
    "Квартира": { ru: "Квартира", en: "Apartment", uz: "Kvartira" },
    "Дом": { ru: "Дом", en: "House", uz: "Uy" },
    "Новостройка": { ru: "Новостройка", en: "New building", uz: "Yangi qurilish" },
};

function isAmenitySupported(item, source) {
    const words = (item.ru || item.en || "").toLowerCase().match(/\p{L}{4,}/gu) || [];
    if (!words.length) return false;

    return words.some((w) => {
        const stem = w.length > 6 ? w.slice(0, w.length - 2) : w.slice(0, Math.max(4, w.length - 1));
        return hasPositiveMention(source, new RegExp(stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "iu"));
    });
}

function descriptionHasUnsupportedNumbers(description, source, derived = []) {
    const allowed = extractNumberValues(source);
    for (const v of derived) if (v != null) allowed.add(Number(v));

    for (const m of String(description).matchAll(/\d[\d\s.,]*\d|\d/g)) {
        const n = toNumber(m[0].replace(/\s+/g, ""));
        if (Number.isFinite(n) && !allowed.has(n)) return true;
    }
    return false;
}

function dedupeAmenities(list) {
    const seen = new Set();
    const out = [];
    for (const a of list) {
        const key = (a.ru || a.en || "").toLowerCase().trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(a);
    }
    return out.slice(0, 12);
}

export function buildParsedFromAi(validated, regex, sourceText) {
    const source = String(sourceText || "");
    const diag = {
        source: "ai",
        provider: null,
        attempts: [],
        extracted: {},
        filledFromRegex: [],
        rejected: [],
        warnings: [],
        errors: [],
    };

    const reject = (field, reason, value) => diag.rejected.push({ field, reason, value: value ?? null });
    const fill = (field) => diag.filledFromRegex.push(field);

    const pickCount = (field, aiValue, regexValue) => {
        if (aiValue != null) {
            if (!isNumberSupported(source, aiValue, "count")) {
                reject(field, "число_отсутствует_в_тексте", aiValue);
            } else if (regexValue && String(aiValue) !== String(regexValue)) {
                diag.warnings.push(`conflict:${field} ai=${aiValue} regex=${regexValue} -> regex`);
                return String(regexValue);
            } else {
                return String(aiValue);
            }
        }
        if (regexValue) {
            fill(field);
            return String(regexValue);
        }
        return "";
    };

    const bedrooms = pickCount("bedrooms", validated.bedrooms, regex.bedrooms);
    const bathrooms = pickCount("bathrooms", validated.bathrooms, regex.bathrooms);
    let floor = pickCount("floor", validated.floor, regex.floor);
    let totalFloors = pickCount("total_floors", validated.total_floors, regex.totalFloors);
    if (floor && totalFloors && Number(floor) > Number(totalFloors)) {
        diag.warnings.push(`floor_gt_total:${floor}/${totalFloors}`);
        totalFloors = "";
    }

    const pickMeasure = (field, aiValue, regexValue) => {
        if (aiValue != null) {
            if (isNumberSupported(source, aiValue, "measure")) return numToString(aiValue);
            reject(field, "число_отсутствует_в_тексте", aiValue);
        }
        if (regexValue) {
            fill(field);
            return String(regexValue);
        }
        return "";
    };

    const area = pickMeasure("area", validated.area, regex.area);
    const ceiling = pickMeasure("ceiling_height", validated.ceiling_height, regex.commercialFields.ceiling);

    const aiPrice = validated.price_raw ? extractPriceInfo(validated.price_raw) : null;
    let priceInfo = extractPriceInfo("");

    if (aiPrice && aiPrice.raw) {
        if (aiPrice.amount != null && isNumberSupported(source, aiPrice.amount, "amount")) {
            priceInfo = aiPrice;
        } else {
            reject("price", "число_отсутствует_в_тексте", validated.price_raw);
        }
        }

    if (!priceInfo.raw) {
        const regexInfo = extractPriceInfo(source);
        if (regexInfo.raw) {
            priceInfo = regexInfo;
            fill("price");
                }
    }
    

    const typeFromAi = TYPE_BY_RU[validated.type_ru];
    const type = typeFromAi || regex.type;
    if (!typeFromAi && validated.type_ru) reject("type", "неизвестный_тип", validated.type_ru);

    const isCommercial = validated._has_is_commercial ? validated.is_commercial : regex.isCommercial;

    const isRent = hasDealMarker(source) ? detectIsRent(source) : Boolean(validated.is_rent);

    const isSold = detectIsSold(source) ||
        (validated.is_sold && reU(`${NB}сдан(?:о|а)?${NA}|снят(?:о|а)?\\s+с\\s+(?:аренды|публикации)`).test(source));
    if (validated.is_sold && !isSold) reject("is_sold", "нет_подтверждения_в_тексте", true);

    const locationFallback = regex.commercialFields.address_ru;
    const district = validated.district || regex.commercialFields.district_ru || "";
    const address = validated.address || locationFallback || "";
    if (!validated.district && regex.commercialFields.district_ru) fill("district");
    if (!validated.address && locationFallback) fill("address");

    const aiAmenities = [];
    for (const item of validated.amenities) {
        if (isAmenitySupported(item, source)) aiAmenities.push(item);
        else reject("amenity", "нет_подтверждения_в_тексте", item.ru || item.en);
    }
    const amenities = dedupeAmenities([...aiAmenities, ...regex.amenities]);
    for (const a of regex.amenities) if (!aiAmenities.some((x) => (x.ru || "").toLowerCase() === a.ru.toLowerCase())) fill(`amenity:${a.ru}`);

    const titleRuOk = validated.title_ru && scriptShare(validated.title_ru).cyrShare >= 0.3;
    const title_ru = titleRuOk ? validated.title_ru : regex.title_ru;
    if (validated.title_ru && !titleRuOk) reject("title_ru", "не_на_русском", validated.title_ru);
    if (!validated.title_ru) fill("title_ru");

    const factsParagraph = buildFactsParagraph({
        type, rooms: bedrooms, area, floor, totalFloors, location: address || district,
        isCommercial, amenities, dealMarker: hasDealMarker(source), isRent,
    });

    let description_ru = validated.description_ru;
    const descProblems = [];

    if (!description_ru) descProblems.push("пусто");
    else {
        if (scriptShare(description_ru).cyrShare < 0.5 && scriptShare(source).cyrShare > 0.5) descProblems.push("не_на_русском");
        if (descriptionHasUnsupportedNumbers(description_ru, source, [bedrooms, bathrooms, floor, totalFloors, area])) descProblems.push("числа_нет_в_тексте");
    }

    if (descProblems.length) {
        description_ru = regex.description_ru || factsParagraph;
        diag.warnings.push(`description_replaced:${descProblems.join("+")}`);
    }

    const cleanLang = (text, lang, ruText) => {
        if (!text) return "";
        const share = scriptShare(text);
        if (lang === "en" || lang === "uz") {
            if (share.cyrShare > 0.3) return "";
            if (ruText && text.trim() === ruText.trim()) return "";
        }
        return text;
    };

    const description_en = descProblems.length ? "" : cleanLang(validated.description_en, "en", description_ru);
    const description_uz = descProblems.length ? "" : cleanLang(validated.description_uz, "uz", description_ru);
    const title_en = titleRuOk ? cleanLang(validated.title_en, "en", title_ru) : "";
    const title_uz = titleRuOk ? cleanLang(validated.title_uz, "uz", title_ru) : "";

    const priceNote = priceInfo.perSqmRaw || "";

    const locationLine = district && address && !address.toLowerCase().includes(district.toLowerCase())
        ? `${district}, ${address}`
        : (address || district);

    const parsed = {
        title_ru,
        title_en,
        title_uz,
        description_ru,
        description_en,
        description_uz,
        about_ru: buildAbout(description_ru, factsParagraph, priceNote),
        about_en: "",
        about_uz: "",
        price: priceInfo.raw,
        priceNumber: priceNumberForPage(priceInfo),
        currency: priceInfo.currency,
        pricePerSqm: priceInfo.perSqmRaw,
        bedrooms,
        bathrooms,
        area,
        floor,
        totalFloors,
        type,
        locationLine,
        amenities,
        isCommercial,
        isRent,
        isSold,
        commercialFields: {
            area,
            floor,
            ceiling,
            district_ru: district,
            district_en: "",
            district_uz: "",
            address_ru: address,
            address_en: "",
            address_uz: "",
            landmark_ru: validated.landmark || regex.commercialFields.landmark_ru || "",
            landmark_en: regex.commercialFields.landmark_en || "",
            landmark_uz: regex.commercialFields.landmark_uz || "",
            class_ru: "",
            class_en: "",
            class_uz: "",
        },
        missing: [],
    };

    if (!parsed.title_ru || (parsed.title_ru === type.ru && !/квартир/i.test(source))) parsed.missing.push("название");
    if (!parsed.price) parsed.missing.push("цена");
    if (!parsed.bedrooms && !parsed.area) parsed.missing.push("комнаты/площадь");

    diag.extracted = summarizeExtracted(parsed);
    parsed.diagnostics = diag;

    return parsed;
}

async function parseWithAI(text, regexParsed) {
    const source = String(text || "");

    const validate = (raw) => validateAiListing(raw, source, regexParsed);

    let chain;
    try {
        chain = await runListingAiChain({
            systemPrompt: AI_SYSTEM_PROMPT,
            jsonSchema: AI_JSON_SCHEMA,
            geminiResponseSchema: GEMINI_RESPONSE_SCHEMA,
            userText: source,
            validate,
        });
    } catch (e) {
        logEvent("AI_CHAIN_CRASH", { class: ErrorClass.MODEL, reason: String(e?.message || e).slice(0, 200) });
        return { parsed: null, attempts: [], error: { class: ErrorClass.MODEL, reason: "crash" } };
    }

    if (!chain.ok) return { parsed: null, attempts: chain.attempts, error: { class: ErrorClass.MODEL, reason: "all_providers_failed_or_invalid" } };

    try {
        const parsed = buildParsedFromAi(chain.data, regexParsed, source);
        parsed.diagnostics.provider = chain.provider;
        parsed.diagnostics.attempts = chain.attempts.map((a) => ({
            provider: a.provider, attempt: a.attempt, outcome: a.outcome, class: a.class || null, reason: a.reason || null,
        }));
        return { parsed, attempts: chain.attempts, error: null };
    } catch (e) {
        logEvent("AI_MERGE_FAILED", { class: ErrorClass.PARSE, reason: String(e?.message || e).slice(0, 200) });
        return { parsed: null, attempts: chain.attempts, error: { class: ErrorClass.PARSE, reason: "merge_failed" } };
    }
}

export function logParseSummary(diag, extra = {}) {
    logEvent("LISTING_PARSE", {
        source: diag.source,
        provider: diag.provider,
        attempts: (diag.attempts || []).length,
        extracted: diag.extracted,
        filledFromRegex: diag.filledFromRegex,
        rejected: (diag.rejected || []).map((r) => `${r.field}:${r.reason}`),
        warnings: diag.warnings,
        errors: diag.errors,
        ...extra,
    });
}

async function getParsedListingRaw(text) {
    let regexParsed;

    try {
        regexParsed = parseListing(text);
    } catch (e) {
        logEvent("REGEX_PARSE_CRASH", { class: ErrorClass.PARSE, reason: String(e?.message || e).slice(0, 200) });
        regexParsed = emergencyParsed(text);
    }

    const configured = configuredProviders().length > 0;

    if (!configured) {
        regexParsed.diagnostics.warnings.push("ai_not_configured");
        logParseSummary(regexParsed.diagnostics);
        return regexParsed;
    }

    const { parsed, attempts, error } = await parseWithAI(text, regexParsed);

    if (parsed) {
        if (parsed.diagnostics.filledFromRegex.length) parsed.diagnostics.source = "ai+regex";
        logParseSummary(parsed.diagnostics);
        return parsed;
    }

    regexParsed.diagnostics.attempts = (attempts || []).map((a) => ({
        provider: a.provider, attempt: a.attempt, outcome: a.outcome, class: a.class || null, reason: a.reason || null,
    }));
    regexParsed.diagnostics.errors.push(error);
    regexParsed.diagnostics.warnings.push("fallback_to_regex");
    logParseSummary(regexParsed.diagnostics);
    return regexParsed;
}

function emergencyParsed(text) {
    const source = String(text || "");
    const lines = source.split("\n").map((l) => l.trim()).filter(Boolean);
    const body = lines.filter((l) => !isContactLine(l)).join("\n");

    return {
        title_ru: cleanTitle(lines[0]) || "Квартира", title_en: "", title_uz: "",
        description_ru: body, description_en: "", description_uz: "",
        about_ru: body, about_en: "", about_uz: "",
        price: "", priceNumber: null, currency: null, pricePerSqm: "",
        bedrooms: "", bathrooms: "", area: "", floor: "", totalFloors: "",
        type: { ru: "Квартира", en: "Apartment", uz: "Kvartira" }, locationLine: "",
        amenities: [], isCommercial: false, isRent: false, isSold: false,
        commercialFields: {
            area: "", floor: "", ceiling: "",
            district_ru: "", district_en: "", district_uz: "",
            address_ru: "", address_en: "", address_uz: "",
            landmark_ru: "", landmark_en: "", landmark_uz: "",
            class_ru: "", class_en: "", class_uz: "",
        },
        missing: ["цена", "комнаты/площадь"],
        diagnostics: { source: "regex", provider: null, attempts: [], extracted: {}, filledFromRegex: [], rejected: [], warnings: ["emergency_fallback"], errors: [] },
    };
}

export async function getParsedListing(text) {
    const parsed = await getParsedListingRaw(text);
    return applyDistrictRules(parsed, String(text || ""));
}
