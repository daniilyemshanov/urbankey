import { detectDistrict } from "../src/utils/districts.js";
import { getDistrictPage } from "../src/utils/districtPages.js";
import { LANDMARK_DISTRICTS } from "../src/utils/landmarks.js";

const official = (key, lang) => getDistrictPage("apartments", key, lang)?.name || "";

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
    if (!text) return description;
    if (detectDistrict([text]) === key) return description;
    const name = official(key, lang);
    return name ? `${text} ${SENTENCE[lang](name)}` : description;
}

export function applyDistrictRules(parsed, source) {
    try {
        if (!parsed || typeof parsed !== "object") return parsed;

        const cf = parsed.commercialFields || {};

        const aiKey = detectDistrict([
            cf.district_ru, cf.address_ru, cf.landmark_ru,
            parsed.locationLine, parsed.title_ru,
        ]);
        const textKey = detectDistrict([source]);

        const key = aiKey || textKey;
        if (!key) {
            parsed.districtNote = NOTE_NONE;
            return parsed;
        }

        const certain = textKey === key;

        const ruName = official(key, "ru");
        if (!ruName) return parsed;

        if (parsed.commercialFields) {
            cf.district_ru = ruName;
            cf.district_en = official(key, "en");
            cf.district_uz = official(key, "uz");
        }

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
            parsed.description_ru = withDistrict(parsed.description_ru, "ru", key);
            parsed.description_en = withDistrict(parsed.description_en, "en", key);
            parsed.description_uz = withDistrict(parsed.description_uz, "uz", key);
            parsed.districtNote = `📍 Район: ${ruName}`;
        } else {
            parsed.districtNote = `📍 Район: ${ruName} — определён ИИ (в посте не назван), проверьте в админке.`;
        }

        return parsed;
    } catch (err) {
        console.error("applyDistrictRules failed:", err);
        return parsed;
    }
}
