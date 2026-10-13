// Общие функции сохранения объявлений в Supabase для webhook, finalize-albums
// и server/bot.js. Файл начинается с "_", поэтому Vercel не превращает его
// в endpoint.
//
// Что решает:
//   • объявление не теряется из-за единичного сбоя записи: временная ошибка
//     повторяется один раз; при ошибке, связанной с данными, запись
//     повторяется "безопасным" урезанным набором колонок (заголовок,
//     описание, цена, фото, связь с постом Telegram);
//   • ошибки БД различаются в логе (class=db, код PostgREST/Postgres,
//     временная ли, какой этап) и не содержат секретов;
//   • проверка "сайт сможет это показать": цена, записанная в карточку,
//     разбирается тем же parsePrice, что и на сайте (src/utils/currency.js),
//     и расхождение логируется как class=display;
//   • подписи комнат/санузлов склоняются ("1 спальня", "5 спален");
//   • при редактировании поста пустые результаты разбора не затирают
//     значения, которые уже есть в базе.

import { ErrorClass, logEvent, shortBody } from "./_aiLog.js";
import { countLabelsFor, extractPriceInfo, fillMissingTranslations, slugify, priceToNumber } from "./listingParser.js";
import { parsePrice } from "../src/utils/currency.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------
// Подписи комнат и санузлов для карточки жилья (со склонением)
// ---------------------------------------------------------------------
// Публичная ссылка на объявление на сайте (для ответа бота в канале).
// Маршруты сайта: /:lang/property/:id (жильё) и /:lang/commercial/:id (коммерция),
// где id — id карточки (cardss / commercials).
export const SITE_ORIGIN = "https://urbankey.uz";

export function buildListingUrl(isCommercial, id, lang = "ru") {
    return `${SITE_ORIGIN}/${lang}/${isCommercial ? "commercial" : "property"}/${id}`;
}

export function residentialCardFields(parsed) {
    const bedrooms = countLabelsFor("bedrooms", parsed.bedrooms);
    const bathrooms = countLabelsFor("bathrooms", parsed.bathrooms);

    return {
        bedrooms_ru: bedrooms.ru,
        bedrooms_en: bedrooms.en,
        bedrooms_uz: bedrooms.uz,
        bathrooms_ru: bathrooms.ru,
        bathrooms_en: bathrooms.en,
        bathrooms_uz: bathrooms.uz,
        ...floorColumns(parsed),
    };
}

// Колонки этажа в cardss — ОПЦИОНАЛЬНЫЕ (sql/optional_add_card_floor.sql).
// По умолчанию бот их не пишет: схема БД не меняется, пока владелец сам не
// применит SQL и не включит CARD_FLOOR_COLUMNS=1.
function floorColumns(parsed) {
    if (process.env.CARD_FLOOR_COLUMNS !== "1") return {};
    return {
        floor: Number(parsed.floor) || null,
        total_floors: Number(parsed.totalFloors) || null,
    };
}

// ---------------------------------------------------------------------
// Сборка строк для записи (общая для webhook, finalize-albums и bot.js)
// ---------------------------------------------------------------------

// Строка карточки каталога: cardss (жильё) или commercials (коммерция).
// Объявление публикуется сразу — никаких флагов модерации здесь нет.
export function buildCardRow(parsed, { image, videoUrl, tgChatId, tgMessageId }) {
    const baseFields = {
        title_ru: parsed.title_ru,
        title_en: parsed.title_en,
        title_uz: parsed.title_uz,
        description_ru: parsed.description_ru,
        description_en: parsed.description_en,
        description_uz: parsed.description_uz,
        image,
        video: videoUrl || "",
        price: parsed.price,
        is_rent: Boolean(parsed.isRent),
        tg_chat_id: tgChatId,
        tg_message_id: tgMessageId,
    };

    if (parsed.isCommercial) {
        return {
            table: "commercials",
            row: {
                ...baseFields,
                ...parsed.commercialFields,
                // "Категория" на сайте (CommercialHero: text("class")) — фиксированное "Коммерция"
                class_ru: "Коммерция",
                class_en: "Commercial",
                class_uz: "Tijorat",
            },
        };
    }

    return {
        table: "cardss",
        row: {
            ...baseFields,
            ...residentialCardFields(parsed),
            type_ru: parsed.type.ru,
            type_en: parsed.type.en,
            type_uz: parsed.type.uz,
        },
    };
}

// Страница объекта: villas (жильё) или commercial_pages (коммерция).
// is_draft: true — как и раньше (на публикацию не влияет, сайт показывает
// такие страницы сразу; флаг нужен только админке для отметки "дозаполнить").
export function buildPagePayload(parsed, { table, linkIdField, cardId, images, videoUrl }) {
    const basePayload = {
        [linkIdField]: cardId,
        slug: `${slugify(parsed.title_en || parsed.title_ru)}-${cardId}`,

        title_ru: parsed.title_ru,
        title_en: parsed.title_en,
        title_uz: parsed.title_uz,

        description_ru: parsed.description_ru,
        description_en: parsed.description_en,
        description_uz: parsed.description_uz,

        // Главный текст страницы жилья (Property.jsx выводит именно about_*,
        // SEO-описание тоже берётся оттуда). Раньше здесь всегда писалась
        // пустая строка — основной блок страницы был пуст.
        about_ru: parsed.about_ru || "",
        about_en: parsed.about_en || "",
        about_uz: parsed.about_uz || "",

        // priceNumber уже учитывает правило "неоднозначную сумму в сумах не пишем";
        // priceToNumber — только для результатов без этого поля (старый формат).
        price: parsed.priceNumber !== undefined ? parsed.priceNumber : priceToNumber(parsed.price),

        images: images || [],
        video: videoUrl || "",
        amenities: parsed.amenities || [],
        is_rent: Boolean(parsed.isRent),

        is_draft: true,
    };

    if (table === "commercial_pages") {
        return {
            ...basePayload,
            location_ru: parsed.commercialFields.district_ru || parsed.locationLine,
            location_en: "",
            location_uz: "",
            type_ru: "",
            type_en: "",
            type_uz: "",
            class_ru: "Коммерция",
            class_en: "Commercial",
            class_uz: "Tijorat",
            purpose_ru: "",
            purpose_en: "",
            purpose_uz: "",
            area: Number(parsed.commercialFields.area) || null,
            ceiling_height: Number(parsed.commercialFields.ceiling) || null,
            floor: Number(parsed.commercialFields.floor) || null,
        };
    }

    return {
        ...basePayload,
        location_ru: parsed.locationLine,
        location_en: "",
        location_uz: "",
        type_ru: parsed.type.ru,
        type_en: parsed.type.en,
        type_uz: parsed.type.uz,
        bedrooms: Number(parsed.bedrooms) || null,
        year: null,
        square: Number(parsed.area) || null,
    };
}

// Создаёт страницу объекта. Никогда не бросает: возвращает false при неудаче
// (карточка уже создана и не теряется; бот сообщает, что страницу нужно завести вручную).
export async function savePage(supabase, table, linkIdField, cardId, parsed, images, videoUrl) {
    try {
        const payload = buildPagePayload(parsed, { table, linkIdField, cardId, images, videoUrl });

        // location переводим на en/uz, about — если ещё не переведён
        await fillMissingTranslations(payload, ["location"]);

        const { ok } = await insertPageRow(supabase, table, payload, { cardId });
        return ok;
    } catch (e) {
        logEvent("DB_PAGE_EXCEPTION", { class: ErrorClass.DB, table, cardId, message: shortBody(e?.message || e, 200) });
        return false;
    }
}

// ---------------------------------------------------------------------
// Классификация ошибок БД
// ---------------------------------------------------------------------
// transient — имеет смысл повторить тот же запрос (сеть, таймаут, 5xx);
// dataRelated — проблема в значениях/колонках, помогает урезанный набор.
export function classifyDbError(error) {
    const code = String(error?.code || "");
    const message = String(error?.message || "");
    const status = Number(error?.status || 0);

    const transient =
        status >= 500 ||
        /fetch failed|network|timeout|timed out|ECONN|socket|ETIMEDOUT|temporarily/i.test(message) ||
        /^(08|53|57)/.test(code); // 08 connection, 53 resources, 57 operator intervention

    const duplicate = code === "23505";

    const dataRelated =
        !transient && !duplicate &&
        (/^(22|23|42703)/.test(code) || code === "PGRST204" || /column .* does not exist|invalid input|violates/i.test(message));

    return { code, transient, duplicate, dataRelated };
}

// ---------------------------------------------------------------------
// Урезанные наборы колонок (только то, что код и так всегда пишет)
// ---------------------------------------------------------------------
const CARD_SAFE_KEYS = [
    "title_ru", "title_en", "title_uz",
    "description_ru", "description_en", "description_uz",
    "image", "video", "price", "is_rent", "tg_chat_id", "tg_message_id",
    "type_ru", "type_en", "type_uz", "class_ru", "class_en", "class_uz",
];

const PAGE_SAFE_KEYS = [
    "slug", "card_id", "commercial_id",
    "title_ru", "title_en", "title_uz",
    "description_ru", "description_en", "description_uz",
    "about_ru", "about_en", "about_uz",
    "price", "images", "video", "is_rent", "is_draft",
];

function pickSafe(row, keys) {
    const out = {};
    for (const key of keys) {
        if (!(key in row)) continue;
        const v = row[key];
        if (typeof v === "string") out[key] = v.slice(0, 4000);
        else if (v === null || typeof v === "number" || typeof v === "boolean" || Array.isArray(v)) out[key] = v;
    }
    return out;
}

// ---------------------------------------------------------------------
// Запись карточки (cardss / commercials)
// ---------------------------------------------------------------------
// -> { data, error, degraded }   data = { id }
export async function insertCardRow(supabase, table, row, ctx = {}) {
    const run = (payload) => supabase.from(table).insert(payload).select("id").single();

    let { data, error } = await run(row);
    if (!error) return { data, error: null, degraded: false };

    let info = classifyDbError(error);
    logEvent("DB_INSERT_FAILED", { class: ErrorClass.DB, table, stage: "full", code: info.code, transient: info.transient, duplicate: info.duplicate, message: shortBody(error.message, 200), ...ctx });

    if (info.duplicate) return { data: null, error, degraded: false };

    if (info.transient) {
        await sleep(600);
        ({ data, error } = await run(row));
        if (!error) {
            logEvent("DB_INSERT_RECOVERED", { table, stage: "retry", ...ctx });
            return { data, error: null, degraded: false };
        }
        info = classifyDbError(error);
        logEvent("DB_INSERT_FAILED", { class: ErrorClass.DB, table, stage: "retry", code: info.code, message: shortBody(error.message, 200), ...ctx });
    }

    // Последняя попытка: урезанный набор колонок. Лучше карточка без
    // второстепенных полей, чем потерянное объявление.
    const safe = pickSafe(row, CARD_SAFE_KEYS);
    ({ data, error } = await run(safe));

    if (!error) {
        logEvent("DB_INSERT_DEGRADED", { class: ErrorClass.DB, table, dropped: Object.keys(row).filter((k) => !(k in safe)), ...ctx });
        return { data, error: null, degraded: true };
    }

    logEvent("DB_INSERT_LOST", { class: ErrorClass.DB, table, code: classifyDbError(error).code, message: shortBody(error.message, 200), ...ctx });
    return { data: null, error, degraded: false };
}

// ---------------------------------------------------------------------
// Запись страницы объекта (villas / commercial_pages)
// ---------------------------------------------------------------------
// -> { ok, degraded }
export async function insertPageRow(supabase, table, payload, ctx = {}) {
    const run = (row) => supabase.from(table).insert(row);

    let { error } = await run(payload);
    if (!error) return { ok: true, degraded: false };

    const info = classifyDbError(error);
    logEvent("DB_PAGE_INSERT_FAILED", { class: ErrorClass.DB, table, stage: "full", code: info.code, transient: info.transient, message: shortBody(error.message, 200), ...ctx });

    if (info.duplicate) return { ok: false, degraded: false };

    if (info.transient) {
        await sleep(600);
        ({ error } = await run(payload));
        if (!error) return { ok: true, degraded: false };
    }

    const safe = pickSafe(payload, PAGE_SAFE_KEYS);
    ({ error } = await run(safe));

    if (!error) {
        logEvent("DB_PAGE_INSERT_DEGRADED", { class: ErrorClass.DB, table, dropped: Object.keys(payload).filter((k) => !(k in safe)), ...ctx });
        return { ok: true, degraded: true };
    }

    logEvent("DB_PAGE_INSERT_LOST", { class: ErrorClass.DB, table, code: classifyDbError(error).code, message: shortBody(error.message, 200), ...ctx });
    return { ok: false, degraded: false };
}

// ---------------------------------------------------------------------
// Проверка "сайт сможет это показать"
// ---------------------------------------------------------------------
// Цена из карточки на сайте разбирается parsePrice (убирает все нецифровые
// символы). Если результат не совпадает с тем, что извлёк парсер, на сайте
// будет показано неверное число — это ошибка отображения, не парсинга.
export function checkCardDisplay(parsed) {
    const problems = [];

    if (parsed.price) {
        const shown = parsePrice(parsed.price);
        const expected = extractPriceInfo(parsed.price);

        if (!shown) {
            problems.push("price_unparseable_on_site");
        } else if (expected.perSqm) {
            // сайт склеит цифры "1400$ за 1м²" в 14001 — это не цена объекта
            problems.push("price_is_per_sqm");
        } else if (expected.amount != null && shown.amount !== expected.amount) {
            problems.push(`price_mismatch site=${shown.amount} parsed=${expected.amount}`);
        } else if (expected.currency && shown.currency !== expected.currency) {
            problems.push(`currency_mismatch site=${shown.currency} parsed=${expected.currency}`);
        }
    }

    if (parsed.floor && parsed.totalFloors && Number(parsed.floor) > Number(parsed.totalFloors)) {
        problems.push("floor_greater_than_total");
    }

    if (problems.length) {
        logEvent("LISTING_DISPLAY_RISK", { class: ErrorClass.DISPLAY, problems });
    }
    return problems;
}

// ---------------------------------------------------------------------
// Редактирование поста: не затираем существующие данные пустыми
// ---------------------------------------------------------------------
// Если в отредактированном посте цена/комнаты/описание не распознались,
// старое значение в базе остаётся.
export function omitEmpty(obj) {
    const out = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value === "" || value == null) continue;
        out[key] = value;
    }
    return out;
}
