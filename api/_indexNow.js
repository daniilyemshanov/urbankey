// IndexNow: мгновенное уведомление поисковиков (Яндекс, Bing и др.) о новых и изменённых
// страницах. Google протокол не поддерживает: для него работает sitemap.xml.
// Ключ публичный по задумке протокола: тот же ключ лежит в файле public/e2d9152d87a6c274e322fb6f2521e46b.txt,
// по нему поисковик проверяет, что сайт принадлежит вам.

import { SITE_ORIGIN, LANGS } from "./_publicDb.js";

export const INDEXNOW_KEY = "e2d9152d87a6c274e322fb6f2521e46b";
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const HOST = new URL(SITE_ORIGIN).host;
const MAX_URLS_PER_REQUEST = 10000;

// Три языковые версии страницы объекта
export function listingUrls(isCommercial, id) {
    const segment = isCommercial ? "commercial" : "property";
    return LANGS.map((lang) => `${SITE_ORIGIN}/${lang}/${segment}/${id}`);
}

// Только адреса нашего сайта, без повторов
export function buildIndexNowPayload(urls) {
    const list = [...new Set(urls || [])]
        .filter((url) => {
            try { return new URL(url).host === HOST; } catch { return false; }
        })
        .slice(0, MAX_URLS_PER_REQUEST);

    if (!list.length) return null;

    return {
        host: HOST,
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_ORIGIN}/${INDEXNOW_KEY}.txt`,
        urlList: list,
    };
}

// Автоматически работает на продакшене Vercel (VERCEL_ENV=production). Для локального
// бота включите INDEXNOW_ENABLED=1, отключить везде — INDEXNOW_DISABLED=1.
function isEnabled() {
    if (process.env.INDEXNOW_DISABLED === "1") return false;
    return process.env.VERCEL_ENV === "production" || process.env.INDEXNOW_ENABLED === "1";
}

// Никогда не бросает исключений: сбой IndexNow не должен ломать публикацию объекта.
export async function submitIndexNow(urls, { fetchImpl = globalThis.fetch, timeoutMs = 4000, force = false } = {}) {
    if (process.env.INDEXNOW_DISABLED === "1" || (!force && !isEnabled())) return { ok: false, skipped: true };

    const payload = buildIndexNowPayload(urls);
    if (!payload) return { ok: false, skipped: true, count: 0 };

    try {
        const res = await fetchImpl(INDEXNOW_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json; charset=utf-8" },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(timeoutMs),
        });
        // 200 — принято, 202 — принято, ключ проверяется
        return { ok: res.status === 200 || res.status === 202, status: res.status, count: payload.urlList.length };
    } catch (e) {
        return { ok: false, error: String(e?.message || e).slice(0, 120), count: payload.urlList.length };
    }
}

export const notifyListing = (isCommercial, id, options) => submitIndexNow(listingUrls(isCommercial, id), options);
