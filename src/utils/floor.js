// Подпись этажа для карточек: "5/9 этаж" / "5/9 qavat" / "5/9 floor".
// Возвращает "" если этажа нет — тогда карточка ничего не показывает
// (никаких подстановок и фиктивных значений).

const WORD = { ru: "этаж", uz: "qavat", en: "floor" };

function toInt(value) {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : null;
}

export function formatFloor(floor, totalFloors, language = "ru") {
    const f = toInt(floor);
    if (f == null) return "";

    const total = toInt(totalFloors);
    const word = WORD[language] || WORD.ru;

    return total ? `${f}/${total} ${word}` : `${f} ${word}`;
}

// Этаж из свободного текста (описание объявления): "Этаж 5 из 9", "5/9 этаж",
// "5-й этаж", "5 qavat", "floor 5 of 9". Нужен для карточек, у которых в базе
// нет колонок floor/total_floors (SQL optional_add_card_floor.sql не применён),
// но этаж записан в тексте. Ничего не выдумывает: нет совпадения — null.
export function floorFromText(text) {
    const src = String(text || "");
    if (!src) return null;

    let m = src.match(/(?<![\d./])(\d{1,3})\s*\/\s*(\d{1,3})\s*(?:-?\s*й\s*)?(?:этаж|qavat|floor)/i);
    if (m) return { floor: Number(m[1]), totalFloors: Number(m[2]) };

    m = src.match(/(?:этаж|qavat|floor)\s*:?\s*(\d{1,3})\s*(?:из|of|\/|dan)\s*(\d{1,3})/i);
    if (m) return { floor: Number(m[1]), totalFloors: Number(m[2]) };

    m = src.match(/(?<![\d./])(\d{1,3})\s*[-–]?\s*(?:й\s*)?(?:этаж|qavat|floor)(?![\p{L}])/iu)
        || src.match(/(?:этаж|floor)\s*:?\s*(\d{1,3})(?![\d/])/i);
    if (m) return { floor: Number(m[1]), totalFloors: null };

    return null;
}

// Подпись этажа для карточки жилья: из колонок floor/total_floors, а если их
// нет — из текста описания. "" — этажа нигде нет (тогда пункт не показывается).
export function residentialFloorLabel(item, language = "ru") {
    const fromColumns = formatFloor(item?.floor, item?.totalFloors, language);
    if (fromColumns) return fromColumns;

    const text = item?.description?.[language] || item?.description?.ru || "";
    const found = floorFromText(text);
    if (!found) return "";

    const f = toInt(found.floor);
    const total = toInt(found.totalFloors);
    if (f == null || (total && f > total)) return "";

    return formatFloor(f, total, language);
}

// Пункт "этаж" в карточке жилья: { kind: "floor", label } или { kind: "empty",
// label: "" }. Значка ванны больше нет; данных нет — пункт просто не рисуется.
export function residentialFloorSlot(item, language = "ru") {
    const label = residentialFloorLabel(item, language);
    return label ? { kind: "floor", label } : { kind: "empty", label: "" };
}
