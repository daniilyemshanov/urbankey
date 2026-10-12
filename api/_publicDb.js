// Общие хелперы для публичных serverless-функций (sitemap, spa).
// Файл начинается с "_", поэтому Vercel не превращает его в endpoint.
//
// Используется ТОЛЬКО anon-ключ — ровно то, что доступно любому
// посетителю сайта. Флаг is_draft НЕ учитывается: объявления из Telegram
// публикуются сразу (как и раньше), страница считается существующей, если
// у объекта есть строка страницы (villas / commercial_pages).

import { createClient } from "@supabase/supabase-js";

export const SITE_ORIGIN = "https://urbankey.uz";
export const LANGS = ["ru", "en", "uz"];
export const DEFAULT_LANG = "ru";

// timeoutMs: жёсткий предел на КАЖДЫЙ запрос к Supabase. Без него зависшая
// база подвесит функцию до лимита Vercel (по умолчанию 10 с), и каждая
// страница объекта ответит 504. По таймауту supabase-js возвращает error,
// а вызывающий код решает, что делать (spa — пропустить проверку,
// sitemap — вернуть 503).
export function getSupabase({ timeoutMs = 4000 } = {}) {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return null;

    const timedFetch = (input, init = {}) => {
        const timeout = AbortSignal.timeout(timeoutMs);
        const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
        return fetch(input, { ...init, signal });
    };

    return createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: timedFetch },
    });
}

// postgrest-js по умолчанию повторяет упавший запрос до 3 раз с паузами
// 1/2/4 с. Для SEO-проверок это вредно: ответ нужен быстро, в пределах
// таймаута. Отключаем повторы на конкретном запросе.
export function noRetry(query) {
    return typeof query.retry === "function" ? query.retry(false) : query;
}

// id объектов — положительные целые (bigint identity). Всё остальное
// ("abc", "-1", "1e3", "0123abc") — заведомо несуществующий объект.
export function parseListingId(raw) {
    if (typeof raw !== "string" || !/^[1-9]\d{0,17}$/.test(raw)) return null;
    return Number(raw);
}

// Страница жилья существует, если для карточки есть строка в villas —
// ровно то условие, по которому клиент (Context.getVilla) показывает объект.
// Возвращает true / false / null (null — не удалось проверить: ошибка БД).
export async function propertyExists(supabase, id) {
    const { data, error } = await noRetry(
        supabase
            .from("villas")
            .select("card_id")
            .eq("card_id", id)
            .limit(1)
            .maybeSingle()
    );

    if (error) {
        console.error("propertyExists failed:", error.message);
        return null;
    }
    return Boolean(data);
}

// Страница коммерции — зеркало Context.getCommercialById:
//  • есть строка commercial_pages → страница существует;
//  • строки нет → клиент показывает упрощённую страницу из
//    commercials_public, значит существует, если объект есть там.
export async function commercialExists(supabase, id) {
    const { data: page, error } = await noRetry(
        supabase
            .from("commercial_pages")
            .select("commercial_id")
            .eq("commercial_id", id)
            .maybeSingle()
    );

    if (error) {
        console.error("commercialExists(page) failed:", error.message);
        return null;
    }
    if (page) return true;

    const { data: base, error: baseError } = await noRetry(
        supabase
            .from("commercials_public")
            .select("id")
            .eq("id", id)
            .maybeSingle()
    );

    if (baseError) {
        console.error("commercialExists(base) failed:", baseError.message);
        return null;
    }
    return Boolean(base);
}
