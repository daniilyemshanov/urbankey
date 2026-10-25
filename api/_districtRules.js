// Правила района для разбора постов из Telegram (используется api/listingParser.js).
// 1) Если район не назван, но в тексте есть известный ЖК/ориентир
//    (src/utils/landmarks.js) — район определяется по нему.
// 2) Район записывается официальным названием («Яккасарайский район»).
// 3) Район всегда присутствует в строке «Расположение» и в описании.
// Функции не бросают исключений: при любой неожиданности объявление остаётся как есть.

import { detectDistrict } from "../src/utils/districts.js";
import { getDistrictPage } from "../src/utils/districtPages.js";
import { LANDMARK_DISTRICTS } from "../src/utils/landmarks.js";

const official = (key, lang) => getDistrictPage("apartments", key, lang)?.name || "";

// Добавка к системному промту ИИ: список известных ЖК и просьба упоминать район.
export function districtPromptAddendum() {
    const known = LANDMARK_DISTRICTS
        .map((l) => `- ${l.names.join(" / ")} → ${official(l.district, "ru")}`)
        .join("\n");

    return [
        "",
        "ДОПОЛНЕНИЕ (приоритетнее правила 13):",
        "19. district — официальное название района Ташкента: «Яккасарайский район», «Юнусабадский район» и т.п. Заполняй, если район назван в тексте или в тексте назван ЖК/ориентир из списка ниже. Если района нет в тексте и ЖК нет в списке, но ты ТОЧНО знаешь, в каком районе Ташкента находится этот ЖК, бизнес-центр или улица — укажи этот район. Если есть хоть малейшие сомнения — null: неверный район хуже, чем пустой.",
        known ? `Известные ЖК и ориентиры:\n${known}` : "",
        "20. Если район известен, обязательно назови его в description_ru (например «…расположена в Яккасарайском районе») и сохрани его в description_en и description_uz.",
    ].filter((x) => x !== "").join("\n");
}

const NOTE_NONE = "⚠️ Район не определён — укажите его в админке (без района объявление не попадёт в фильтр и на страницы районов).";

const SENTENCE = {
    ru: (name) => `Расположение: ${name}.`,
    en: (name) => `Location: ${name}.`,
    uz: (name) => `Joylashuvi: ${name}.`,
};

function withDistrict(description, lang, key) {
    const text = String(description || "").trim();
    if (!text) return description;                       // пусто — переведётся позже из русского
    if (detectDistrict([text]) === key) return description; // район уже назван
    const name = official(key, lang);
    return name ? `${text} ${SENTENCE[lang](name)}` : description;
}

export function applyDistrictRules(parsed, source) {
    try {
        if (!parsed || typeof parsed !== "object") return parsed;

        const cf = parsed.commercialFields || {};

        // Район, который назвал ИИ или который виден в полях объявления
        const aiKey = detectDistrict([
            cf.district_ru, cf.address_ru, cf.landmark_ru,
            parsed.locationLine, parsed.title_ru,
        ]);
        // Район, названный в самом посте (или известный ЖК из landmarks.js)
        const textKey = detectDistrict([source]);

        const key = aiKey || textKey;
        if (!key) {
            parsed.districtNote = NOTE_NONE;
            return parsed;
        }

        // «Надёжно» — район назван в посте или это ЖК из нашего списка. Всё остальное
        // (ИИ узнал район по ЖК/улице сам, либо в посте два разных района) — на проверку.
        const certain = textKey === key;

        const ruName = official(key, "ru");
        if (!ruName) return parsed;

        // поле «район» (коммерция) — официальным названием на трёх языках
        if (parsed.commercialFields) {
            cf.district_ru = ruName;
            cf.district_en = official(key, "en");
            cf.district_uz = official(key, "uz");
        }

        // строка «Расположение»: «Яккасарайский район, ул. Шота Руставели»
        const line = String(parsed.locationLine || "").trim();
        if (!line) {
            parsed.locationLine = ruName;
        } else {
            const [first, ...rest] = line.split(",");
            parsed.locationLine = detectDistrict([first]) === key
                ? [ruName, ...rest].join(",")
                : `${ruName}, ${line}`;
        }

        parsed.districtKey = key;
        parsed.districtInferred = !certain;

        if (certain) {
            // район обязательно в описании (для поиска и для людей)
            parsed.description_ru = withDistrict(parsed.description_ru, "ru", key);
            parsed.description_en = withDistrict(parsed.description_en, "en", key);
            parsed.description_uz = withDistrict(parsed.description_uz, "uz", key);
            parsed.districtNote = `📍 Район: ${ruName}`;
        } else {
            // Определён ИИ без опоры на текст поста: в описание не дописываем,
            // чтобы при ошибке не править сразу два места; просим проверить.
            parsed.districtNote = `📍 Район: ${ruName} — определён ИИ (в посте не назван), проверьте в админке.`;
        }

        return parsed;
    } catch (err) {
        console.error("applyDistrictRules failed:", err);
        return parsed;
    }
}
