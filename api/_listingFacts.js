export const NB = "(?<![\\p{L}\\p{N}])";
export const NA = "(?![\\p{L}\\p{N}])";

const re = (source, flags = "iu") => new RegExp(source, flags);

export function toNumber(value) {
    if (typeof value === "number") return value;
    const s = String(value ?? "").trim().replace(/\s+/g, "").replace(",", ".");
    return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

export function numToString(n) {
    return Number.isFinite(n) ? String(Number(n.toFixed(2))) : "";
}

export function parseAmountToken(token) {
    const raw = String(token ?? "").trim().replace(/\s+/g, "");
    if (!/^\d[\d.,]*$/.test(raw)) return null;

    if (/^\d{1,3}([.,]\d{3})+$/.test(raw)) return Number(raw.replace(/[.,]/g, ""));
    if (/^\d+[.,]\d{1,2}$/.test(raw)) return Number(raw.replace(",", "."));
    if (/^\d+$/.test(raw)) return Number(raw);

    const digits = raw.replace(/[.,]/g, "");
    return digits ? Number(digits) : null;
}

export function extractNumberValues(text) {
    const values = new Set();
    const source = String(text || "");

    for (const m of source.matchAll(/\d[\d\s.,]*\d|\d/g)) {
        const whole = parseAmountToken(m[0]);
        if (whole != null) values.add(whole);

        for (const part of m[0].split(/\s+/)) {
            const v = parseAmountToken(part);
            if (v != null) values.add(v);
        }
        for (const part of m[0].split(/[.,]/)) {
            const v = parseAmountToken(part);
            if (v != null) values.add(v);
        }
    }

    for (const m of source.matchAll(/(\d+)\s*[/\\]\s*(\d+)/g)) {
        values.add(Number(m[1]));
        values.add(Number(m[2]));
    }

    return values;
}

const ROOM_WORD_STEMS = [
    [/(?:одно|одна|один|odno)/i, 1],
    [/(?:двух|две|два|dvuh)/i, 2],
    [/(?:трёх|трех|три|trex)/i, 3],
    [/(?:четырёх|четырех|четыре)/i, 4],
    [/(?:пяти|пять)/i, 5],
    [/(?:шести|шесть)/i, 6],
    [/(?:семи|семь)/i, 7],
    [/(?:восьми|восемь)/i, 8],
];

const ORDINAL_STEMS = [
    [/перв/i, 1], [/втор/i, 2], [/трет/i, 3], [/четв[её]рт/i, 4], [/пят(?:ый|ого|ом|ому|ая|ое)/i, 5],
    [/шест/i, 6], [/седьм/i, 7], [/восьм/i, 8], [/девят/i, 9], [/десят/i, 10],
];

export function isNumberSupported(text, value, kind = "count") {
    if (value == null) return false;
    const n = typeof value === "number" ? value : toNumber(value);
    if (!Number.isFinite(n)) return false;

    const source = String(text || "");
    const numbers = extractNumberValues(source);

    if (kind === "measure") {
        for (const v of numbers) if (Math.abs(v - n) < 0.011) return true;
        return false;
    }

    if (kind === "amount") {
        for (const v of numbers) {
            if (Math.abs(v - n) < 0.5) return true;
            if (Math.abs(v * 1_000 - n) < 0.5 || Math.abs(v * 1_000_000 - n) < 0.5 || Math.abs(v * 1_000_000_000 - n) < 0.5) return true;
        }
        for (const m of source.matchAll(/(\d+(?:[.,]\d+)?)\s*(тыс|млн|млрд)/giu)) {
            const base = toNumber(m[1]);
            const mult = /тыс/i.test(m[2]) ? 1e3 : /млн/i.test(m[2]) ? 1e6 : 1e9;
            if (Number.isFinite(base) && Math.abs(base * mult - n) < 0.5) return true;
        }
        return false;
    }

    if (numbers.has(n)) return true;
    if (Number.isInteger(n)) {
        if (n >= 1 && n <= 8) {
            for (const [rx, v] of ROOM_WORD_STEMS) if (v === n && re(`${NB}${rx.source}`).test(source)) return true;
        }
        if (n >= 1 && n <= 10) {
            for (const [rx, v] of ORDINAL_STEMS) if (v === n && re(`${rx.source}\\p{L}*\\s+этаж`).test(source)) return true;
        }
        if (n === 1 && re(`${NB}студи`).test(source)) return true;
        if (n === 1 && re(`${NB}однушк`).test(source)) return true;
        if (n === 2 && re(`${NB}двушк`).test(source)) return true;
        if (n === 3 && re(`${NB}тр[её]шк`).test(source)) return true;
    }
    return false;
}

export function scriptShare(text) {
    let cyr = 0;
    let lat = 0;
    for (const ch of String(text || "")) {
        if (/\p{Script=Cyrillic}/u.test(ch)) cyr++;
        else if (/\p{Script=Latin}/u.test(ch)) lat++;
    }
    const total = cyr + lat;
    return { cyr, lat, total, cyrShare: total ? cyr / total : 0, latShare: total ? lat / total : 0 };
}

const TYPE_DICT = [
    { test: re("новостройк|yangi\\s*qurilgan|new\\s*building|off[\\s-]?plan"), ru: "Новостройка", en: "New building", uz: "Yangi qurilish" },
    { test: re(`${NB}(?:дом|house|uy)${NA}`), ru: "Дом", en: "House", uz: "Uy" },
];

export function detectType(text) {
    if (/квартир|kvartira|apartment/iu.test(text)) {
        return { ru: "Квартира", en: "Apartment", uz: "Kvartira" };
    }

    for (const t of TYPE_DICT) {
        if (t.test.test(text)) return { ru: t.ru, en: t.en, uz: t.uz };
    }

    return { ru: "Квартира", en: "Apartment", uz: "Kvartira" };
}

const NEGATION_BEFORE = re(`${NB}(?:без|нет|отсутству\\p{L}*|не|требует|требуется|нужен|нужна)\\s+(?:\\p{L}+\\s+)?$`);
const NEGATION_AFTER = re(`^\\p{L}*\\s*[:\\-–—]\\s*(?:нет|отсутству|no)${NA}`);

export function hasPositiveMention(text, pattern) {
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    const global = new RegExp(pattern.source, flags);

    for (const m of String(text).matchAll(global)) {
        const before = text.slice(Math.max(0, m.index - 24), m.index);
        const after = text.slice(m.index + m[0].length, m.index + m[0].length + 14);
        if (NEGATION_BEFORE.test(before)) continue;
        if (NEGATION_AFTER.test(after)) continue;
        return true;
    }
    return false;
}

const AMENITY_DICT = [
    { test: re("парковк|паркинг|parking"), ru: "Парковка", en: "Parking", uz: "Parking" },
    { test: re("мебел|mebel|furnished"), ru: "Мебель", en: "Furniture", uz: "Mebel" },
    { test: re("бытов\\p{L}*\\s+техник|техник\\p{L}*\\s+(?:есть|вся|в\\s+комплекте)|с\\s+техникой"), ru: "Бытовая техника", en: "Appliances", uz: "Maishiy texnika" },
    { test: re("кондиционер"), ru: "Кондиционер", en: "Air conditioning", uz: "Konditsioner" },
    { test: re(`${NB}лифт`), ru: "Лифт", en: "Elevator", uz: "Lift" },
    { test: re("детск\\p{L}*\\s+площад"), ru: "Детская площадка", en: "Playground", uz: "Bolalar maydonchasi" },
    { test: re("тих\\p{L}*\\s+двор|зел[её]н\\p{L}*\\s+двор|ухожен\\p{L}*\\s+двор"), ru: "Тихий двор", en: "Quiet courtyard", uz: "Tinch hovli" },
    { test: re("гардеробн"), ru: "Гардеробная", en: "Walk-in closet", uz: "Kiyim xonasi" },
    { test: re("раздельн\\p{L}*\\s+санузел|раздельн\\p{L}*\\s+с/у"), ru: "Раздельный санузел", en: "Separate bathroom", uz: "Alohida hammom" },
    { test: re("панорамн\\p{L}*\\s+вид"), ru: "Панорамный вид", en: "Panoramic view", uz: "Panorama manzara" },
    { test: re("вид\\s+на\\s+город"), ru: "Вид на город", en: "City view", uz: "Shahar manzarasi" },
    { test: re("вид\\s+на\\s+море"), ru: "Вид на море", en: "Sea view", uz: "Dengiz manzarasi" },
    { test: re(`${NB}охран`), ru: "Охрана", en: "Security", uz: "Xavfsizlik" },
    { test: re("видеонаблюден"), ru: "Видеонаблюдение", en: "CCTV", uz: "Videokuzatuv" },
    { test: re("консьерж"), ru: "Консьерж", en: "Concierge", uz: "Konsyerj" },
    { test: re("закрыт\\p{L}*\\s+территор"), ru: "Закрытая территория", en: "Gated area", uz: "Yopiq hudud" },
    { test: re("бассейн"), ru: "Бассейн", en: "Pool", uz: "Basseyn" },
    { test: re("террас"), ru: "Терраса", en: "Terrace", uz: "Terrasa" },
    { test: re("балкон"), ru: "Балкон", en: "Balcony", uz: "Balkon" },
    { test: re("лоджи"), ru: "Лоджия", en: "Loggia", uz: "Lodjiya" },
    { test: re("кладов"), ru: "Кладовая", en: "Storage room", uz: "Ombor xonasi" },
    { test: re("стиральн\\p{L}*\\s+машин"), ru: "Стиральная машина", en: "Washing machine", uz: "Kir yuvish mashinasi" },
    { test: re("холодильник"), ru: "Холодильник", en: "Refrigerator", uz: "Muzlatgich" },
    { test: re("телевизор"), ru: "Телевизор", en: "TV", uz: "Televizor" },
    { test: re("дизайнерск\\p{L}*\\s+ремонт|евро.?ремонт|качественн\\p{L}*\\s+ремонт|нов\\p{L}*\\s+ремонт|свеж\\p{L}*\\s+ремонт"), ru: "Свежий ремонт", en: "Fresh renovation", uz: "Yangi ta'mir" },
    { test: re("с\\s+ремонтом|ремонт\\s+(?:есть|сделан|выполнен)|отличн\\p{L}*\\s+ремонт|хорош\\p{L}*\\s+ремонт"), ru: "С ремонтом", en: "Renovated", uz: "Ta'mirlangan" },
    { test: re("новостройк"), ru: "Новостройка", en: "New building", uz: "Yangi qurilgan" },
    { test: re("панорамн\\p{L}*\\s+окн|четыре\\s+окна|больш\\p{L}*\\s+окна"), ru: "Панорамные окна", en: "Panoramic windows", uz: "Panorama derazalar" },
    { test: re("высок\\p{L}*\\s+потолк"), ru: "Высокие потолки", en: "High ceilings", uz: "Baland shiftlar" },
    { test: re("централизованн\\p{L}*\\s+отоплен|центральн\\p{L}*\\s+отоплен"), ru: "Центральное отопление", en: "Central heating", uz: "Markaziy isitish" },
    { test: re("автономн\\p{L}*\\s+отоплен"), ru: "Автономное отопление", en: "Autonomous heating", uz: "Avtonom isitish" },
    { test: re("гор[яч]+\\p{L}*\\s+вод"), ru: "Горячая вода", en: "Hot water", uz: "Issiq suv" },
    { test: re(`${NB}(?:природный\\s+)?газ${NA}`), ru: "Газ", en: "Gas", uz: "Gaz" },
    { test: re(`${NB}интернет`), ru: "Интернет", en: "Internet", uz: "Internet" },
    { test: re("пожарн\\p{L}*\\s+безопасн|вентиляц"), ru: "Система вентиляции и пожарной безопасности", en: "Ventilation & fire safety system", uz: "Ventilyatsiya va yong'in xavfsizligi tizimi" },
    { test: re(`${NB}метро${NA}`), ru: "Рядом метро", en: "Metro nearby", uz: "Metro yaqin" },
    { test: re(`${NB}школ`), ru: "Рядом школа", en: "School nearby", uz: "Maktab yaqin" },
    { test: re("детск\\p{L}*\\s+сад"), ru: "Рядом детский сад", en: "Kindergarten nearby", uz: "Bog'cha yaqin" },
];

export function extractAmenities(text) {
    const source = String(text || "");
    const found = [];

    for (const item of AMENITY_DICT) {
        if (hasPositiveMention(source, item.test)) {
            found.push({ ru: item.ru, en: item.en, uz: item.uz });
        }
    }

    return found;
}

const ROOMS_MAX = 15;

export function extractRooms(text) {
    const t = String(text || "");
    const accept = (v) => {
        const n = Number(v);
        return Number.isInteger(n) && n >= 1 && n <= ROOMS_MAX ? String(n) : "";
    };
    let m;

    m = t.match(re("(\\d{1,2})\\s*[-–—]?\\s*(?:х|x)?\\s*[-–—]?\\s*(?:комнат|комн(?![\\p{L}]))"));
    if (m && accept(m[1])) return accept(m[1]);

    m = t.match(re(`(?<![\\d.,])(\\d)\\s*[-–—]?\\s*к(?:\\.|\\s*кв|\\s*ком|${NA})(?!\\s*\\$)`));
    if (m && accept(m[1])) return accept(m[1]);

    m = t.match(re("(одно|одна|двух|две|трёх|трех|три|четырёх|четырех|четыре|пяти|пять|шести|шесть|семи|восьми)\\s*[-–—]?\\s*(?:комнат|комн(?![\\p{L}]))"));
    if (m) {
        const stem = m[1].toLowerCase();
        for (const [rx, v] of ROOM_WORD_STEMS) if (rx.test(stem)) return accept(v);
    }

    m = t.match(re(`${NB}(одн|дв(?:у|ух)|тр[её]|четыр[её])шк`));
    if (m) {
        const s = m[1].toLowerCase();
        if (s.startsWith("одн")) return "1";
        if (s.startsWith("дв")) return "2";
        if (s.startsWith("тр")) return "3";
        return "4";
    }

    m = t.match(re("комнат\\p{L}*\\s*[-:—–]\\s*(\\d{1,2})"));
    if (m && accept(m[1])) return accept(m[1]);

    m = t.match(re("(\\d{1,2})\\s*[-–—]?\\s*спальн"));
    if (m && accept(m[1])) return accept(m[1]);

    return "";
}

export function extractBathrooms(text) {
    const t = String(text || "");
    let m = t.match(re("(?<![\\d.,/])(\\d{1,2})\\s*(?:санузл\\p{L}*|санузел|с/у|ванн\\p{L}*|bathroom\\p{L}*|hammom\\p{L}*)"));
    if (!m) m = t.match(re("(?:санузл\\p{L}*|санузел|с/у|ванн\\p{L}*|bathroom\\p{L}*|hammom\\p{L}*)\\s*[-:—–]\\s*(\\d{1,2})"));
    if (!m) return "";
    const n = Number(m[1]);
    return Number.isInteger(n) && n >= 1 && n <= 10 ? String(n) : "";
}

const AREA_UNIT = "(?:м²|м2|м\\^2|кв\\.?\\s*м(?![\\p{L}])|кв\\.?\\s*метр\\p{L}*|квадрат\\p{L}*\\s+метр\\p{L}*|sq\\.?\\s*m(?![\\p{L}])|m2|m²)";
const AREA_NOT_TOTAL = "кухн|жил\\p{L}*|спальн|гостин|комнат|санузл|ванн|балкон|лоджи|участ|прихож|холл";

export function extractArea(text) {
    const t = String(text || "");
    const candidates = [];

    for (const m of t.matchAll(re(`(\\d{1,5}(?:[.,]\\d{1,2})?)\\s*${AREA_UNIT}`, "giu"))) {
        const value = toNumber(m[1]);
        if (!Number.isFinite(value) || value < 5 || value > 100000) continue;

        const before = t.slice(Math.max(0, m.index - 30), m.index);

        if (/(?:за|по|на|\/)\s*$/iu.test(before)) continue;
        if (re(`(?:${AREA_NOT_TOTAL})\\p{L}*[\\s:\\-–—=]{0,3}$`).test(before)) continue;

        const score = /общ\p{L}*[^\n]{0,20}$/iu.test(before) ? 3 : /площад\p{L}*[^\n]{0,20}$/iu.test(before) ? 2 : 1;
        candidates.push({ value, score });
    }

    if (candidates.length) {
        candidates.sort((a, b) => b.score - a.score);
        return numToString(candidates[0].value);
    }

    const m = t.match(re("площад\\p{L}*([^\\d\\n]{0,35}?)(\\d{1,5}(?:[.,]\\d{1,2})?)"));
    if (m && !re(AREA_NOT_TOTAL).test(m[1])) {
        const value = toNumber(m[2]);
        if (Number.isFinite(value) && value >= 5 && value <= 100000) return numToString(value);
    }

    return "";
}

const FLOOR_WORD = "этаж\\p{L}*";

const TOTAL_WORDS = [
    ["одно", 1], ["двух", 2], ["трех", 3], ["трёх", 3], ["четырех", 4], ["четырёх", 4], ["пяти", 5],
    ["шести", 6], ["семи", 7], ["восьми", 8], ["девяти", 9], ["десяти", 10], ["одиннадцати", 11],
    ["двенадцати", 12], ["тринадцати", 13], ["четырнадцати", 14], ["пятнадцати", 15],
    ["шестнадцати", 16], ["семнадцати", 17], ["восемнадцати", 18], ["девятнадцати", 19], ["двадцати", 20],
];
const TOTAL_WORD_ALT = TOTAL_WORDS.map(([w]) => w).join("|");

const ORDINAL_FLOOR_STEMS = [
    ["одиннадцат", 11], ["двенадцат", 12], ["тринадцат", 13], ["четырнадцат", 14], ["пятнадцат", 15],
    ["шестнадцат", 16], ["десят", 10], ["девят", 9], ["восьм", 8], ["седьм", 7], ["шест", 6],
    ["пят", 5], ["четверт", 4], ["трет", 3], ["втор", 2], ["перв", 1],
];
const ORDINAL_FLOOR_ALT = "одиннадцат|двенадцат|тринадцат|четырнадцат|пятнадцат|шестнадцат|десят|девят|восьм|седьм|шест|пят|четв[её]рт|трет|втор|перв";

const wordToNumber = (word, table) => {
    const w = String(word || "").toLowerCase().replace(/ё/g, "е");
    const hit = table.find(([k]) => (table === TOTAL_WORDS ? w === k.replace(/ё/g, "е") : w.startsWith(k)));
    return hit ? hit[1] : 0;
};

const FLOOR_LABEL = String.raw`(?:этаж(?!н|ей)\p{L}*|эт(?![\p{L}])\.?|qavat(?!li|lik)\p{L}*|floor)`;
const OF = String.raw`(?:/|из|of|dan)`;

export function extractFloorInfo(text) {
    const t = String(text || "").replace(/\\/g, "/");
    const R = (src) => new RegExp(src, "iu");
    const num = (v) => {
        const n = Number(v);
        return Number.isInteger(n) && n >= 1 && n <= 200 ? String(n) : "";
    };
    const done = (floor, total) => {
        const f = num(floor);
        let tot = num(total);
        if (f && tot && Number(f) > Number(tot)) tot = "";
        return { floor: f, totalFloors: tot };
    };
    let m;

    m = t.match(R(String.raw`(\d{1,3})\s*${OF}\s*(\d{1,3})\s*${FLOOR_LABEL}`));
    if (m) return done(m[1], m[2]);

    m = t.match(R(String.raw`${FLOOR_LABEL}\s*[:\-–—]?\s*(\d{1,3})\s*\(?\s*${OF}\s*(\d{1,3})`));
    if (m) return done(m[1], m[2]);

    m = t.match(R(String.raw`(\d{1,3})\s*-?\s*(?:й|ой|ый|ий|st|nd|rd|th)?\s*${FLOOR_LABEL}\s*\(?\s*${OF}\s*(\d{1,3})`));
    if (m) return done(m[1], m[2]);

    m = t.match(R(String.raw`(\d{1,3})\s*-?\s*(?:й|ой|ый|ий)?\s*${FLOOR_LABEL}\s*,?\s*(\d{1,3})\s*-?\s*(?:ти\s*)?(?:этажн|qavatli)`));
    if (m) return done(m[1], m[2]);

    let total = "";
    const tryTotal = (rx) => {
        if (total) return;
        const mm = t.match(R(rx));
        if (mm) total = mm[1];
    };
    tryTotal(String.raw`этажност\p{L}*(?:\s+(?:здания|дома))?\s*[:\-–—]?\s*(\d{1,3})`);
    tryTotal(String.raw`(?:всего\s+)?этажей(?:\s+в\s+(?:доме|здании))?\s*[:\-–—]?\s*(\d{1,3})`);
    tryTotal(String.raw`(\d{1,3})\s*[-–—]?\s*(?:ти\s*)?(?:этажн\p{L}*|этажей|этажка|этажност\p{L}*|qavatli\p{L}*|qavatlik)`);
    if (!total) {
        const mm = t.match(R(String.raw`(${TOTAL_WORD_ALT})\s*-?\s*этажн\p{L}*`));
        if (mm) total = String(wordToNumber(mm[1], TOTAL_WORDS) || "");
    }
    if (!total) {
        const mm = t.match(R(String.raw`${FLOOR_LABEL}\s+из\s+(${TOTAL_WORD_ALT})`));
        if (mm) total = String(wordToNumber(mm[1], TOTAL_WORDS) || "");
    }

    let floor = "";
    const tryFloor = (rx) => {
        if (floor) return;
        const mm = t.match(R(rx));
        if (mm) floor = mm[1];
    };
    tryFloor(String.raw`${FLOOR_LABEL}\s*[:\-–—]?\s*(\d{1,3})(?![\d/])`);
    tryFloor(String.raw`(\d{1,3})\s*-?\s*(?:й|ой|ый|ий|м|ом|st|nd|rd|th)?\s*${FLOOR_LABEL}`);
    if (!floor) {
        let mm = t.match(R(String.raw`((?:${ORDINAL_FLOOR_ALT})\p{L}*)\s+${FLOOR_LABEL}`));
        if (!mm) mm = t.match(R(String.raw`${FLOOR_LABEL}\s*[:\-–—]?\s*((?:${ORDINAL_FLOOR_ALT})\p{L}*)`));
        if (mm) floor = String(wordToNumber(mm[1], ORDINAL_FLOOR_STEMS) || "");
    }
    if (!floor && /этаж|квартир|дом/i.test(t)) {
        tryFloor(String.raw`(?:^|[\s,.;(])на\s+(\d{1,2})\s*-?\s*(?:м|й|ом)(?![\p{L}\d])`);
    }

    if (!floor) {
        const notUnit = String.raw`(?!\s*(?:м|кв|сот|%|\$|usd|у\.?\s?е|сум|тыс|млн|дол|част|комн|ком\b|k\b|к\b))`;
        const triple = t.match(R(String.raw`(?<![\d/.,])(\d)\s*/\s*(\d{1,2})\s*/\s*(\d{1,2})(?![\d/])${notUnit}`));
        if (triple && Number(triple[2]) >= 1 && Number(triple[2]) <= Number(triple[3]) && Number(triple[3]) <= 45) {
            return done(triple[2], triple[3]);
        }
        const pairRx = new RegExp(String.raw`(?<![\d/.,])(\d{1,2})\s*/\s*(\d{1,2})(?![\d/])${notUnit}`, "giu");
        for (const pair of t.matchAll(pairRx)) {
            const f = Number(pair[1]);
            const tt = Number(pair[2]);
            const before = t.slice(Math.max(0, pair.index - 14), pair.index);
            if (/(?:торг|скидк\p{L}*|дол[яиь]\p{L}*)\s*:?\s*$/iu.test(before)) continue;
            if (f >= 1 && f <= tt && tt <= 60) return done(f, tt);
        }
    }

    return done(floor, total);
}

export function extractLocationLine(text) {
    const lines = String(text || "").split("\n").map((l) => l.trim()).filter(Boolean);
    const line = lines.find((l) => l.includes("📍"));
    if (!line) return "";

    return line
        .replace(/📍/g, "")
        .replace(/^Адрес\s*:\s*/i, "")
        .trim();
}

const USD_MARK = "(?:\\$|usd|us\\s*\\$|долл\\p{L}*|у\\.\\s?е\\.?|y\\.\\s?e\\.?|уе(?![\\p{L}]))";
const UZS_MARK = "(?:сум(?:ов|ы|ах)?(?![\\p{L}])|сўм|so['’ʻ`]?m(?![\\p{L}])|uzs)";
const MULT = "(?:(тыс|млн|млрд)\\p{L}*\\.?)";

const PER_SQM_AFTER = re("^\\s*(?:за|/|на|per)\\s*(?:1\\s*)?(?:м²|м2|м(?![\\p{L}])|кв|sq|m2|m²)");

function formatGrouped(amount) {
    const rounded = Number.isInteger(amount) ? amount : Number(amount.toFixed(2));
    const [int, frac] = String(rounded).split(".");
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return frac ? `${grouped}.${frac}` : grouped;
}

export function extractPriceInfo(text) {
    const source = String(text || "");
    const empty = { raw: "", amount: null, currency: null, perSqm: false, perSqmRaw: "" };
    if (!source.trim()) return empty;

    const clean = source.replace(/\d+(?:[.,]\d+)?\s*%/g, " ");

    const cutAfterOld = /~~/.test(clean) ? (clean.match(/Новая[^\d\n]*[\s\S]*$/i)?.[0] ?? clean) : clean;

    const lines = cutAfterOld.split("\n");
    const candidates = [];
    let offset = 0;

    for (const line of lines) {
        const lineHasLabel = re(`${NB}(?:цена|стоимость|price|narx\\p{L}*)${NA}`).test(line);

        for (const m of line.matchAll(/(\d[\d\s.,]*\d|\d)/g)) {
            const token = m[0];
            const start = m.index;
            const end = start + token.length;
            const after = line.slice(end, end + 28);
            const before = line.slice(Math.max(0, start - 8), start);

            let currency = null;
            let multiplier = 1;
            let tail = after;

            const mult = after.match(re(`^\\s*${MULT}`));
            if (mult) {
                multiplier = /тыс/i.test(mult[1]) ? 1e3 : /млн/i.test(mult[1]) ? 1e6 : 1e9;
                tail = after.slice(mult[0].length);
            }

            if (re(`^\\s*${USD_MARK}`).test(tail)) currency = "USD";
            else if (re(`^\\s*${UZS_MARK}`).test(tail)) currency = "UZS";
            else if (re(`${USD_MARK}\\s*$`).test(before)) currency = "USD";
            else if (re(`${UZS_MARK}\\s*$`).test(before)) currency = "UZS";

            const base = parseAmountToken(token.trim());
            if (base == null) continue;

            const rest = tail.replace(re(`^\\s*(?:${USD_MARK}|${UZS_MARK})`), "");
            const perSqm = PER_SQM_AFTER.test(rest);

            candidates.push({
                amount: base * multiplier,
                currency,
                perSqm,
                lineHasLabel,
                order: offset + start,
            });
        }
        offset += line.length + 1;
    }

    const withCurrency = candidates.filter((c) => c.currency);
    const total = withCurrency.filter((c) => !c.perSqm);
    const perSqmOnly = withCurrency.filter((c) => c.perSqm);

    const pick = (list) => {
        if (!list.length) return null;
        const labelled = list.filter((c) => c.lineHasLabel);
        const pool = labelled.length ? labelled : list;
        return pool[pool.length - 1];
    };

    const usd = pick(total.filter((c) => c.currency === "USD"));
    const uzs = pick(total.filter((c) => c.currency === "UZS"));
    const chosen = usd || uzs;

    if (chosen) {
        const raw = chosen.currency === "USD"
            ? `${formatGrouped(chosen.amount)}$`
            : `${formatGrouped(chosen.amount)} сум`;
        return { raw, amount: chosen.amount, currency: chosen.currency, perSqm: false, perSqmRaw: "" };
    }

    if (perSqmOnly.length) {
        const p = perSqmOnly[perSqmOnly.length - 1];
        const symbol = p.currency === "USD" ? "$" : " сум";
        const perSqmRaw = `${formatGrouped(p.amount)}${symbol} за м²`;
        return { raw: perSqmRaw, amount: p.amount, currency: p.currency, perSqm: true, perSqmRaw };
    }

    const label = clean.match(re(`${NB}(?:цена|стоимость|price|narx\\p{L}*)${NA}[^\\d\\n]*(\\d[\\d\\s.,]*\\d|\\d)`));
    if (label) {
        const amount = parseAmountToken(label[1].trim());
        if (amount != null && amount > 0) return { ...empty, raw: formatGrouped(amount), amount };
    }

    return empty;
}

export function extractPrice(text) {
    return extractPriceInfo(text).raw;
}

export function priceToNumber(raw) {
    if (raw == null || raw === "") return null;
    if (typeof raw === "number") return Number.isFinite(raw) && raw > 0 ? raw : null;

        const info = extractPriceInfo(String(raw));
    if (info.perSqm) return null;
    if (info.amount != null) return info.amount;

    const leading = String(raw).replace(/^[^\d]*/, "").match(/^\d[\d\s.,]*/);
    if (!leading) return null;
    const amount = parseAmountToken(leading[0].trim());
    return amount != null && amount > 0 ? amount : null;
}

export function priceNumberForPage(info) {
        if (!info || info.amount == null) return null;
    if (info.perSqm) return null;
    if (info.currency === "UZS" && info.amount < 10_000_000) return null;
    return info.amount;
}

const COMMERCIAL_KEYWORDS = re(`коммерц|коммерч|помещени|${NB}офис|${NB}склад${NA}|витрин|арендатор|фудкорт|бизнес|цоколь`);

export function isCommercialPost(text) {
    return COMMERCIAL_KEYWORDS.test(String(text || ""));
}

const RENT_KEYWORDS = re(
    `${NB}(?:сдам|сдаю|сдаётся|сдается|сдаются|сдадим)${NA}|в\\s*аренду|аренда\\s+(?:на|от|помещени|квартир)|долгосрочн\\p{L}*\\s+аренд|посуточно|ижарага|ijaraga|for\\s*rent|${NB}rent(?:al)?${NA}`
);
const SALE_KEYWORDS = re(
    `${NB}(?:продам|продаётся|продается|продажа)${NA}|на\\s*продажу|sotiladi|sotuvda|for\\s*sale`
);

export function detectIsRent(text) {
    const t = String(text || "");
    if (RENT_KEYWORDS.test(t)) return true;
    if (SALE_KEYWORDS.test(t)) return false;
    return false;
}

export function hasDealMarker(text) {
    const t = String(text || "");
    return RENT_KEYWORDS.test(t) || SALE_KEYWORDS.test(t);
}

export function detectIsSold(text) {
    return re(`${NB}продан(?:о|а|ы)?${NA}|снят(?:о|а|ы)?\\s+с\\s+продажи`).test(String(text || ""));
}

export function isPhoneLine(line) {
    const digits = String(line).replace(/\D/g, "");
    return digits.length >= 7 && /\+?\d[\d\s\-()]{5,}\d/.test(line);
}

export function isContactLine(line) {
    const s = String(line);
    return isPhoneLine(s) || /@\w{3,}|t\.me\/|instagram|инстаграм|https?:\/\/|www\./iu.test(s);
}

const DEAL_VERB_PREFIX = re(`^(?:продам|продаю|продаётся|продается|сдам|сдаю|сдаётся|сдается)${NA}[\\s,:\\-–—]*`);

export function cleanTitle(line, maxLength = 90) {
    let s = String(line || "")
        .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, " ")
        .replace(/#[\p{L}\p{N}_]+/gu, " ")
        .replace(/(\*\*|__|\*|_|`)/g, "")
        .replace(/^[\s\-–—•:|]+/, "")
        .replace(DEAL_VERB_PREFIX, "")
        .replace(/\s{2,}/g, " ")
        .trim();

    if (s) s = s.charAt(0).toUpperCase() + s.slice(1);

    if (s.length > maxLength) s = `${s.slice(0, maxLength).replace(/\s+\S*$/, "").trim()}…`;
    return s;
}

export function buildFactsParagraph(facts) {
    const sentences = [];

    const typeRu = facts.isCommercial ? "Коммерческое помещение" : (facts.type?.ru || "Квартира");
    const lead = facts.rooms && !facts.isCommercial
        ? `${facts.rooms}-комнатная ${typeRu.toLowerCase()}`
        : typeRu;
    sentences.push(facts.area ? `${lead}, площадь ${facts.area} м².` : `${lead}.`);

    if (facts.floor) {
        sentences.push(facts.totalFloors ? `Этаж ${facts.floor} из ${facts.totalFloors}.` : `Этаж ${facts.floor}.`);
    } else if (facts.totalFloors) {
        sentences.push(`Этажность здания: ${facts.totalFloors}.`);
    }

    if (facts.location) sentences.push(`Расположение: ${facts.location}.`);

    if (facts.dealMarker) sentences.push(facts.isRent ? "Объект сдаётся в аренду." : "Объект продаётся.");

    const amenityNames = (facts.amenities || []).map((a) => a.ru).filter(Boolean);
    if (amenityNames.length) sentences.push(`${amenityNames.join(", ")}.`);

    return sentences.length > 1 || facts.area ? sentences.join(" ") : "";
}

export function buildNarrativeFromSource(text, titleLine, isServiceLine) {
    const lines = String(text || "").split("\n").map((l) => l.trim()).filter(Boolean);

    return lines
        .filter((line) =>
            line !== titleLine &&
            !(isServiceLine && isServiceLine(line)) &&
            !isContactLine(line) &&
            !/^#/.test(line)
        )
        .map((line) => line.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "").replace(/\s{2,}/g, " ").trim())
        .filter(Boolean)
        .join("\n")
        .trim();
}
