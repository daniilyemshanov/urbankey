import { ErrorClass, logEvent, shortBody } from "./_aiLog.js";
import { countLabelsFor, extractPriceInfo, fillMissingTranslations, slugify, priceToNumber } from "./listingParser.js";
import { parsePrice } from "../src/utils/currency.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

function floorColumns(parsed) {
    if (process.env.CARD_FLOOR_COLUMNS !== "1") return {};
    return {
        floor: Number(parsed.floor) || null,
        total_floors: Number(parsed.totalFloors) || null,
    };
}

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

        about_ru: parsed.about_ru || "",
        about_en: parsed.about_en || "",
        about_uz: parsed.about_uz || "",

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

export async function savePage(supabase, table, linkIdField, cardId, parsed, images, videoUrl) {
    try {
        const payload = buildPagePayload(parsed, { table, linkIdField, cardId, images, videoUrl });

        await fillMissingTranslations(payload, ["location"]);

        const { ok } = await insertPageRow(supabase, table, payload, { cardId });
        return ok;
    } catch (e) {
        logEvent("DB_PAGE_EXCEPTION", { class: ErrorClass.DB, table, cardId, message: shortBody(e?.message || e, 200) });
        return false;
    }
}

export function classifyDbError(error) {
    const code = String(error?.code || "");
    const message = String(error?.message || "");
    const status = Number(error?.status || 0);

    const transient =
        status >= 500 ||
        /fetch failed|network|timeout|timed out|ECONN|socket|ETIMEDOUT|temporarily/i.test(message) ||
        /^(08|53|57)/.test(code);

    const duplicate = code === "23505";

    const dataRelated =
        !transient && !duplicate &&
        (/^(22|23|42703)/.test(code) || code === "PGRST204" || /column .* does not exist|invalid input|violates/i.test(message));

    return { code, transient, duplicate, dataRelated };
}

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

    const safe = pickSafe(row, CARD_SAFE_KEYS);
    ({ data, error } = await run(safe));

    if (!error) {
        logEvent("DB_INSERT_DEGRADED", { class: ErrorClass.DB, table, dropped: Object.keys(row).filter((k) => !(k in safe)), ...ctx });
        return { data, error: null, degraded: true };
    }

    logEvent("DB_INSERT_LOST", { class: ErrorClass.DB, table, code: classifyDbError(error).code, message: shortBody(error.message, 200), ...ctx });
    return { data: null, error, degraded: false };
}

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

export function checkCardDisplay(parsed) {
    const problems = [];

    if (parsed.price) {
        const shown = parsePrice(parsed.price);
        const expected = extractPriceInfo(parsed.price);

        if (!shown) {
            problems.push("price_unparseable_on_site");
                } else if (expected.perSqm) {
            if (!shown.perSqm || shown.amount !== expected.amount) {
                problems.push(`price_per_sqm_mismatch site=${shown.amount} parsed=${expected.amount}`);
            }
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

export function omitEmpty(obj) {
    const out = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value === "" || value == null) continue;
        out[key] = value;
    }
    return out;
}


const SOLD_WORDS = new Set([
    "продано", "продан", "продана", "проданы",
    "сдано", "сдан", "сдана", "сданы",
    "sold", "rented", "sotildi", "sotilgan", "berildi",
]);
const NEGATION_WORDS = new Set(["не", "нет", "not", "no", "emas", "yoq"]);

export function isSoldKeyword(text) {
    const tokens = String(text || "")
        .toLowerCase()
        .replace(/ё/g, "е")
        .split(/[^\p{L}\p{N}]+/u)
        .filter(Boolean);

    if (tokens.length === 0 || tokens.length > 3) return false;
    if (tokens.some((t) => NEGATION_WORDS.has(t))) return false;

    return tokens.some((t) => SOLD_WORDS.has(t));
}

const COLUMN_MISSING = "42703";

export async function findListingByTelegramMessage(supabase, chatId, messageId) {
    for (const table of ["cardss", "commercials"]) {
        const query = (columns) => supabase
            .from(table)
            .select(columns)
            .eq("tg_chat_id", chatId)
            .eq("tg_message_id", messageId)
            .maybeSingle();

        let { data, error } = await query("id, title_ru, is_rent, is_sold");
        if (error && error.code === COLUMN_MISSING) {
            ({ data, error } = await query("id, title_ru, is_rent"));
        }
        if (error) {
            console.error(`findListingByTelegramMessage(${table}) failed:`, error.message);
            continue;
        }
        if (data) {
            return {
                table,
                id: data.id,
                title: data.title_ru || "",
                isRent: data.is_rent === true,
                isSold: data.is_sold === true,
            };
        }
    }
    return null;
}

export async function findListingForReply(supabase, chatId, repliedMsg) {
    if (!repliedMsg) return null;

    const direct = await findListingByTelegramMessage(supabase, chatId, repliedMsg.message_id);
    if (direct) return direct;

    if (repliedMsg.media_group_id) {
        const { data: album } = await supabase
            .from("bot_pending_albums")
            .select("chat_id, message_id")
            .eq("media_group_id", String(repliedMsg.media_group_id))
            .maybeSingle();

        if (album?.message_id != null) {
            return findListingByTelegramMessage(supabase, album.chat_id ?? chatId, album.message_id);
        }
    }
    return null;
}

export async function markListingSold(supabase, table, id) {
    const { error } = await supabase
        .from(table)
        .update({ is_sold: true, sold_at: new Date().toISOString() })
        .eq("id", id);

    if (error) {
        return { ok: false, missingColumn: error.code === COLUMN_MISSING, error };
    }
    return { ok: true };
}

export function soldReplyText(listing, result) {
    const word = listing.isRent ? "сдан" : "продан";

    if (!result.ok) {
        return result.missingColumn
            ? "⚠️ В базе нет колонки is_sold — выполните sql/add_sold_flag.sql в Supabase и повторите."
            : `❌ Не удалось пометить объект: ${result.error.message}`;
    }
    return `🔒 Объект «${listing.title}» отмечен как ${word}: убран с сайта и заморожен.`;
}
