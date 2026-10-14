// Справочник районов Ташкента для фильтра на странице недвижимости.
//
// В таблице cardss (жильё) отдельной колонки "район" нет — он живёт только
// в тексте объявления, а у коммерции (commercials) — в district_*. Поэтому
// район определяется по тексту: ищем в нём название района (кириллица,
// латиница, разные написания) и берём то, что упомянуто РАНЬШЕ всего —
// обычно объявление начинается с района ("Юнусабад, 2-комн...").

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
    { key: "yangihayot",  ru: "Янгихаят",       en: "Yangihayot",    uz: "Yangihayot",    aliases: ["янгихаят", "янгиҳаёт", "янгихает", "yangihayot", "yangihayat"] }
];

// нижний регистр, ё→е, апострофы убираем, дефисы/подчёркивания → пробел
const normalize = (text) =>
    String(text || "")
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/[ʼʻ'`’‘]/g, "")
        .replace(/[-_–—]/g, " ")
        .replace(/\s+/g, " ");

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
