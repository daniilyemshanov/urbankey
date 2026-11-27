import { TASHKENT_DISTRICTS } from "./districts.js";
import { detectDistrict } from "./districts.js";

const SEARCH_ALIASES = {
    apartment: ["квартира", "квартиру", "квартиры", "kvartira", "kvartira", "apartment", "flat"],
    house: ["дом", "дома", "уй", "uy", "house", "home"],
    newbuilding: ["новостройка", "новостройку", "новостройке", "новострой", "yangi qurilish", "yangi bino", "new building", "new build"],
    commercial: ["коммерческая", "коммерческое", "коммерцию", "коммерческой", "помещение", "помещения", "premise", "premises", "business space", "commercial space", "тижорат", "tijorat", "commercial", "property"],
    office: ["офис", "офиса", "офисное", "офисни", "ofis", "office"],
    rent: ["аренда", "аренду", "снять", "сниму", "сдается", "сдаётся", "ижара", "ijara", "rent", "rental", "lease"],
    sale: ["купить", "куплю", "покупка", "продажа", "продается", "продаётся", "sotib olish", "sotaman", "buy", "purchase", "sale"],
    center: ["центр", "центре", "центра", "markaz", "markazda", "center", "centre", "downtown"]
};

const normalize = (value) => String(value ?? "")
    .toLocaleLowerCase()
    .replace(/ё/g, "е")
    .replace(/[ʼʻ'`’‘]/g, "")
    .replace(/[-_–—]/g, " ")
    .replace(/[^\p{L}\p{N}.$\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const includesPhrase = (query, aliases) => aliases.some((alias) =>
    new RegExp(`(^|\\s)${normalize(alias).replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}(?=$|\\s)`, "u").test(query)
);

const removePhrases = (query, phrases) => {
    let result = query;
    for (const phrase of [...phrases].sort((a, b) => b.length - a.length)) {
        const escaped = normalize(phrase).replace(/[.*+?^${}()|[\\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
        result = result.replace(new RegExp(`(^|\\s)${escaped}(?=$|\\s)`, "giu"), " ");
    }
    return result.replace(/\s+/g, " ").trim();
};

const parseAmount = (raw) => {
    const digits = String(raw).replace(/[\s,_]/g, "");
    const amount = Number(digits);
    return Number.isFinite(amount) && amount > 0 ? amount : null;
};

export function parsePropertyQuery(input) {
    const original = String(input ?? "").trim().slice(0, 240);
    let query = normalize(original);
    const priceQuery = original.toLocaleLowerCase().replace(/ё/g, "е").replace(/[ʼʻ'`’‘]/g, "").replace(/\s+/g, " ").trim();
    const filters = {};
    const consumed = [];

    const priceUnitMultiplier = (unit) => {
        const normalizedUnit = normalize(unit);
        if (["тыс", "тысяч", "тысяча", "к", "k", "ming"].includes(normalizedUnit)) return 1000;
        if (["млн", "m", "million"].includes(normalizedUnit)) return 1_000_000;
        return 1;
    };
    const rangeMatch = priceQuery.match(/(?:[$€]\s*)?(\d[\d\s,_]*(?:\.\d+)?)\s*(тыс(?:яч)?|млн|k|m|million|ming)?(?![\p{L}])\s*[-–—]\s*(?:[$€]\s*)?(\d[\d\s,_]*(?:\.\d+)?)\s*(тыс(?:яч)?|млн|k|m|million|ming)?(?![\p{L}])\s*(?:доллар(?:ов)?|usd|uzs|сум)?/iu);
    if (rangeMatch) {
        const lowerUnit = rangeMatch[2] || rangeMatch[4];
        const upperUnit = rangeMatch[4] || rangeMatch[2];
        const lower = parseAmount(rangeMatch[1]) * priceUnitMultiplier(lowerUnit);
        const upper = parseAmount(rangeMatch[3]) * priceUnitMultiplier(upperUnit);
        if (lower && upper) {
            filters.minPrice = Math.min(lower, upper);
            filters.maxPrice = Math.max(lower, upper);
            consumed.push(rangeMatch[0]);
        }
    }
    const pricePatterns = [
        { regex: /(?:до|максимум|не дороже|up to|under|less than|gacha|oshmaydigan)\s*[$€]?\s*(\d[\d\s,_]*(?:\.\d+)?)\s*(тыс(?:яч)?|млн|к|k|m|million|ming)?\s*(?![\p{L}])\s*(?:доллар(?:ов)?|usd|uzs|сум)?/iu, bound: "maxPrice" },
        { regex: /(?:от|минимум|не дешевле|from|over|at least|dan|boshlab)\s*[$€]?\s*(\d[\d\s,_]*(?:\.\d+)?)\s*(тыс(?:яч)?|млн|к|k|m|million|ming)?\s*(?![\p{L}])\s*(?:доллар(?:ов)?|usd|uzs|сум)?/iu, bound: "minPrice" },
        { regex: /[$€]?\s*(\d[\d\s,_]*(?:\.\d+)?)\s*(тыс(?:яч)?|млн|к|k|m|million|ming)(?![\p{L}])\s*(?:доллар(?:ов)?|usd)?/iu, bound: "maxPrice" }
    ];
    for (const { regex, bound } of pricePatterns) {
        const match = priceQuery.match(regex);
        if (rangeMatch && match && match.index >= rangeMatch.index && match.index < rangeMatch.index + rangeMatch[0].length) continue;
        if (!match) continue;
        const followingText = priceQuery.slice(match.index + match[0].length);
        if (/^\s*(?:кв\.?\s*м|квадратных\s+метров|sqm|sq\.?\s*m|м\s*(?:²|2))/iu.test(followingText)) continue;
        let amount = parseAmount(match[1]);
        amount *= priceUnitMultiplier(match[2]);
        if (amount) filters[bound] = amount;
        consumed.push(match[0]);
    }
    if (filters.minPrice != null || filters.maxPrice != null) {
        filters.priceCurrency = /\b(?:uzs|сум|сўм|so.?m|som)\b/iu.test(query) ? "UZS" : "USD";
    }

    const area = query.match(/(?:от|более|больше|минимум|from|over|at least|dan|boshlab)?\s*(\d{2,5})\s*(?:м\s*(?:²|2)|кв\.?\s*м|квадратных\s+метров|square\s+met(?:er|re)s?|sqm|sq\.?\s*m|m²|kv\.?\s*m)/iu);
    if (area) {
        const prefix = normalize(area[0]).split(" ")[0];
        filters[prefix === "от" || prefix === "более" || prefix === "больше" || prefix === "минимум" || prefix === "from" || prefix === "over" || prefix === "dan" || prefix === "boshlab" ? "minArea" : "minArea"] = Number(area[1]);
        consumed.push(area[0]);
    }

    const roomMatch = query.match(/(?:^|\s)(\d+)\s*(?:-\s*)?(?:комнат\p{L}*|комн\.?|xonal\p{L}*|xona|bed\s*-?\s*rooms?|bedrooms?)(?=$|\s)/iu)
        || query.match(/(?:^|\s)(\d+)\s*(?:-\s*)?(?:спальн\p{L}*)(?=$|\s)/iu);
    if (roomMatch) {
        filters.minBedrooms = Math.max(1, Number(roomMatch[1]));
        consumed.push(roomMatch[0]);
    }

    const dealPhrase = Object.entries({ rent: SEARCH_ALIASES.rent, sale: SEARCH_ALIASES.sale })
        .find(([, aliases]) => includesPhrase(query, aliases));
    if (dealPhrase) {
        filters.dealType = dealPhrase[0];
        consumed.push(...dealPhrase[1].filter((alias) => query.includes(normalize(alias))));
    }

    const isOffice = includesPhrase(query, SEARCH_ALIASES.office);
    const isCommercial = isOffice || includesPhrase(query, SEARCH_ALIASES.commercial);
    const isApartment = includesPhrase(query, SEARCH_ALIASES.apartment);
    const isHouse = includesPhrase(query, SEARCH_ALIASES.house);
    const isNew = includesPhrase(query, SEARCH_ALIASES.newbuilding);
    if (isCommercial) filters.category = "commercial";
    else if (isApartment || isHouse || isNew) filters.category = "residential";
    if (isOffice) filters.type = "office";
    else if (isApartment) filters.type = "apartment";
    else if (isHouse) filters.type = "house";
    else if (isNew) filters.type = "newbuilding";
    for (const key of ["commercial", "office", "apartment", "house", "newbuilding", "center"]) {
        consumed.push(...SEARCH_ALIASES[key].filter((alias) => query.includes(normalize(alias))));
    }

    const detectedDistrict = detectDistrict([query]);
    const district = TASHKENT_DISTRICTS
        .map((entry) => ({ ...entry, phrases: [entry.ru, entry.en, entry.uz, ...(entry.aliases || [])] }))
        .sort((a, b) => Math.max(...b.phrases.map((phrase) => normalize(phrase).length)) - Math.max(...a.phrases.map((phrase) => normalize(phrase).length)))
        .find((entry) => entry.key === detectedDistrict);
    if (district) {
        filters.district = district.key;
        consumed.push(...query.split(" ").filter((word) => district.phrases.some((alias) => normalize(alias).split(" ").some((part) => part.length > 2 && word.includes(part)))));
        const suffix = query.match(/(?:район\w*|district|tumani|tuman)/iu);
        if (suffix) consumed.push(suffix[0]);
    }

    const center = includesPhrase(query, SEARCH_ALIASES.center);
    if (center) {
        filters.location = "center";
        consumed.push(...SEARCH_ALIASES.center.filter((alias) => query.includes(normalize(alias))));
        consumed.push(...query.split(" ").filter((word) => ["near", "around", "возле", "около", "рядом", "yaqinida", "yaqin", "markazida"].includes(word)));
    }

    const stopWords = new Set(["в", "во", "на", "из", "для", "по", "до", "от", "in", "at", "near", "with", "from", "to", "the", "a", "an", "dan", "gacha", "bilan", "район", "районе", "района", "district", "tumani", "tuman"]);
    const keywords = removePhrases(query, consumed).replace(/(?:\$|€)?\b\d+(?:[.,]\d+)?\s*(?:k|тыс(?:яч)?|млн|million|ming)\b/giu, " ").trim().split(" ").filter((word) => word && !stopWords.has(word)).join(" ");
    return { query: original, filters, keywords };
}

export function searchFiltersFromUrl(params) {
    const get = (key) => params.get(key) || "";
    return {
        q: get("q"), category: get("category") || "all", type: get("type") || "all",
        dealType: get("deal"), district: get("district") || "all",
        minPrice: get("min"), maxPrice: get("max"), priceCurrency: get("pc"), minBedrooms: get("beds"),
        minArea: get("area"), maxArea: get("areaTo"), minFloor: get("floor"),
        location: get("location"), sort: get("sort")
    };
}

export function searchFiltersToParams(filters, current = new URLSearchParams()) {
    const params = new URLSearchParams(current);
    const keys = { q: "q", category: "category", type: "type", dealType: "deal", district: "district", minPrice: "min", maxPrice: "max", priceCurrency: "pc", minBedrooms: "beds", minArea: "area", maxArea: "areaTo", minFloor: "floor", location: "location", sort: "sort" };
    for (const [field, key] of Object.entries(keys)) {
        const value = filters[field];
        if (value && value !== "all") params.set(key, String(value));
        else params.delete(key);
    }
    params.delete("page");
    return params;
}

