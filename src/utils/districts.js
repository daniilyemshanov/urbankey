// Справочник районов Ташкента для фильтра на странице недвижимости.
//
// В таблице cardss (жильё) отдельной колонки "район" нет — он живёт только
// в тексте объявления, а у коммерции (commercials) — в district_*. Поэтому
// район определяется по тексту: ищем в нём название района (кириллица,
// латиница, разные написания) и берём то, что упомянуто РАНЬШЕ всего —
// обычно объявление начинается с района ("Юнусабад, 2-комн...").

import { localizedPath } from "./lang.js";
import { LANDMARK_DISTRICTS } from "./landmarks.js";

export const TASHKENT_DISTRICTS = [
    { key: "yunusabad",   ru: "Юнусабад",       en: "Yunusabad",     uz: "Yunusobod",     aliases: ["юнусабад", "юнусобод", "yunusabad", "yunusobod"] },
    { key: "chilanzar",   ru: "Чиланзар",       en: "Chilanzar",     uz: "Chilonzor",     aliases: ["чиланзар", "чилонзор", "chilanzar", "chilonzor"] },
    { key: "mirzo",       ru: "Мирзо-Улугбек",  en: "Mirzo-Ulugbek", uz: "Mirzo Ulug'bek", aliases: ["мирзо улугбек", "мирзо-улугбек", "улугбек", "улугбекск", "mirzo ulugbek", "mirzo ulug", "ulugbek"] },
    { key: "shaykhantakhur", ru: "Шайхантахур", en: "Shaykhantakhur", uz: "Shayxontohur", aliases: ["шайхантахур", "шайхонтохур", "шейхантахур", "shaykhantakhur", "shayxontohur", "shaykhontohur", "shaykhantahur"] },
    { key: "yakkasaray",  ru: "Яккасарай",      en: "Yakkasaray",    uz: "Yakkasaroy",    aliases: ["яккасарай", "яккасарой", "yakkasaray", "yakkasaroy"] },
    { key: "mirabad",     ru: "Мирабад",        en: "Mirabad",       uz: "Mirobod",       aliases: ["мирабад", "миробод", "mirabad", "mirobod"] },
    { key: "sergeli",     ru: "Сергели",        en: "Sergeli",       uz: "Sergeli",       aliases: ["сергели", "sergeli"] },
    { key: "yashnabad",   ru: "Яшнабад",        en: "Yashnabad",     uz: "Yashnobod",     aliases: ["яшнабад", "яшнобод", "yashnabad", "yashnobod"] },
    { key: "uchtepa",     ru: "Учтепа",         en: "Uchtepa",       uz: "Uchtepa",       aliases: ["учтепа", "учтепинск", "uchtepa"] },
    { key: "almazar",     ru: "Алмазар",        en: "Almazar",       uz: "Olmazor",       aliases: ["алмазар", "олмазор", "almazar", "olmazor"] },
    { key: "bektemir",    ru: "Бектемир",       en: "Bektemir",      uz: "Bektemir",      aliases: ["бектемир", "bektemir"] },
    { key: "yangihayot",  ru: "Янгихаёт",       en: "Yangihayot",    uz: "Yangihayot",    aliases: ["янгихаят", "янгихаёт", "янгиҳаёт", "янгихает", "yangihayot", "yangihayat"] }
];

// нижний регистр, ё→е, апострофы убираем, дефисы/подчёркивания → пробел
const normalize = (text) =>
    String(text || "")
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/[ʼʻ'`’‘]/g, "")
        .replace(/[-_–—]/g, " ")
        .replace(/\s+/g, " ");

const NORMALIZED_LANDMARKS = LANDMARK_DISTRICTS.flatMap((l) =>
    l.names.map((name) => ({ key: l.district, alias: normalize(name) })).filter((x) => x.alias)
);

const NORMALIZED = TASHKENT_DISTRICTS.map((d) => ({
    key: d.key,
    aliases: d.aliases.map(normalize)
}));

// Район по одному тексту: ключ района, упомянутого раньше всех, или null.
function detectInText(text) {

    const haystack = normalize(text);
    if (!haystack) return null;

    let best = null;

    for (const d of NORMALIZED) {
        for (const alias of d.aliases) {
            const idx = haystack.indexOf(alias);
            if (idx !== -1 && (best === null || idx < best.idx)) {
                best = { key: d.key, idx };
            }
        }
    }

    if (best) return best.key;

    // Район в тексте не назван — ищем известный ЖК/ориентир (src/utils/landmarks.js).
    for (const l of NORMALIZED_LANDMARKS) {
        const idx = haystack.indexOf(l.alias);
        if (idx !== -1 && (best === null || idx < best.idx)) {
            best = { key: l.key, idx };
        }
    }

    return best ? best.key : null;
}

// Принимает список текстов В ПОРЯДКЕ ПРИОРИТЕТА (сначала явное поле района,
// потом заголовок, потом описание) и возвращает ключ первого найденного района.
export function detectDistrict(texts) {

    for (const text of texts) {
        const key = detectInText(text);
        if (key) return key;
    }

    return null;
}

export function districtLabel(key, lang) {

    const d = TASHKENT_DISTRICTS.find((x) => x.key === key);
    if (!d) return "";

    return d[lang] || d.ru;
}


// ── Ссылки на каталог с заранее выбранным районом ───────────────────────────
// Район в URL — это ?district=<key>, где key — существующий стабильный ключ из
// TASHKENT_DISTRICTS (например "yunusabad", "mirzo"). Отдельных страниц
// районов нет: открывается обычный каталог, фильтр уже выбран.

export const DISTRICT_PARAM = "district";

// Безопасный разбор значения из URL: известный ключ (без учёта регистра и
// пробелов) или null. Любой мусор → null (каталог покажется без фильтра).
export function parseDistrictKey(raw) {
    if (typeof raw !== "string") return null;
    const key = raw.trim().toLowerCase();
    return TASHKENT_DISTRICTS.some((d) => d.key === key) ? key : null;
}

// Путь каталога с выбранным районом: "/ru/Properties?district=chilanzar".
// Для null/неизвестного ключа — путь каталога без параметра.
export function districtCatalogPath(key, lang) {
    const base = localizedPath("/Properties", lang);
    const valid = parseDistrictKey(key);
    return valid ? `${base}?${DISTRICT_PARAM}=${valid}` : base;
}
