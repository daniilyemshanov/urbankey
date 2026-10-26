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

export function residentialFloorSlot(item, language = "ru") {
    const label = residentialFloorLabel(item, language);
    return label ? { kind: "floor", label } : { kind: "empty", label: "" };
}
