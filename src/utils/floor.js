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

// Содержимое пункта "этаж/санузлы" в карточке жилья.
//   floor  — этаж известен: значок этажа + "5/9 этаж";
//   bath   — этажа нет, но есть санузлы: значок ванны + "2 ванные";
//   empty  — нет ничего: значок этажа + "—" (как раньше показывался прочерк).
// Никаких подстановок: если данных нет, число не выдумывается.
export function residentialFloorSlot(item, language = "ru") {
    const floor = formatFloor(item?.floor, item?.totalFloors, language);
    if (floor) return { kind: "floor", label: floor };

    const bath = item?.bathrooms?.[language] || item?.bathrooms?.ru || "";
    if (bath) return { kind: "bath", label: bath };

    return { kind: "empty", label: "—" };
}
