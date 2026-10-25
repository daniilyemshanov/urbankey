// Есть ли у поля что показывать. Пустые строки, «—», нули (площадь 0, цена 0)
// и «пустые» значения не показываем: блок с таким полем скрывается целиком.

export function hasValue(value) {
    if (value == null) return false;
    if (typeof value === "number") return Number.isFinite(value) && value > 0;
    if (typeof value === "boolean") return value;

    const text = String(value).trim();
    if (!text || /^[—–-]+$/.test(text) || /^(null|undefined|nan)$/i.test(text)) return false;

    // «0», «0.0» — пусто; «68», «2,5» — есть значение
    if (/^[\d\s.,]+$/.test(text)) {
        const n = Number(text.replace(/\s/g, "").replace(",", "."));
        return Number.isFinite(n) && n > 0;
    }
    return true;
}
