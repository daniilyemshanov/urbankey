// /api/spa — отдаёт оболочку SPA (index.html) с ПРАВИЛЬНЫМ HTTP-статусом.
//
// ЗАЧЕМ: раньше vercel.json отправлял любой URL на "/" со статусом 200,
// поэтому несуществующие страницы были soft-404 (поисковик видит 200 и
// пустую оболочку). Теперь:
//   kind=property|commercial — проверяем объект в БД: есть → 200,
//                              нет/черновик/мусорный id → 404;
//   kind=notfound            — любой URL, не описанный в vercel.json → 404.
// В обоих случаях тело — тот же index.html, поэтому приложение
// загружается и само рисует свою страницу 404 (дизайн не меняется).
//
// Это НЕ SSR: HTML не рендерится на сервере, меняется только статус.
//
// Отказоустойчивость (страница объекта не должна падать из-за SEO-проверки):
//   • нет env / ошибка БД / таймаут  → проверка пропускается, отдаём 200,
//     клиент сам решит, что показать. Это видно в заголовке
//     X-SPA-Existence-Check (ok | skipped-no-config | skipped-error)
//     и в логах функции;
//   • не удалось получить index.html → 503 + Retry-After.
//
// Env: VITE_SUPABASE_URL / VITE_SUPABASE_KEY (или SUPABASE_URL / SUPABASE_ANON_KEY).
// Опционально VERCEL_AUTOMATION_BYPASS_SECRET — чтобы функция могла прочитать
// index.html на preview-деплоях с включённой Deployment Protection.

import {
    getSupabase,
    parseListingId,
    propertyExists,
    commercialExists,
    getListingMeta,
    LANGS,
    DEFAULT_LANG,
} from "./_publicDb.js";
import { buildListingHead, injectHead } from "./_seoMeta.js";

const SHELL_HEADER = "x-urbankey-shell";

async function loadShell(req) {
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0];

    const headers = { [SHELL_HEADER]: "1" };
    if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
        headers["x-vercel-protection-bypass"] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    }

    // /index.html — реальный статический файл: файловая система в Vercel
    // имеет приоритет над rewrites, зацикливания нет. Если файла вдруг нет,
    // запрос вернётся сюда же с заголовком SHELL_HEADER — см. защиту в handler.
    const response = await fetch(`${proto}://${host}/index.html`, {
        headers,
        signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) throw new Error(`index.html -> ${response.status}`);

    const html = await response.text();
    // Не отдаём вместо приложения чужую страницу (например, окно входа
    // Deployment Protection): в оболочке Vite всегда есть корневой <div id="root">.
    if (!html.includes('id="root"')) throw new Error("index.html is not the app shell");
    return html;
}

export default async function handler(req, res) {
    // Защита от рекурсии: это наш собственный запрос за index.html, который
    // не нашёл статический файл. Отвечаем сразу, не обращаясь снова к loadShell.
    if (req.headers[SHELL_HEADER]) {
        res.status(404).send("Not found");
        return;
    }

    const kind = String(req.query.kind || "notfound");
    const id = parseListingId(String(req.query.id || ""));

    const rawLang = String(req.query.lang || DEFAULT_LANG);
    const lang = LANGS.includes(rawLang) ? rawLang : DEFAULT_LANG;

    let status = 404;
    let checkState = "ok";
    let listingMeta = null;

    if (kind === "property" || kind === "commercial") {
        let exists;

        if (id === null) {
            // мусорный id ("abc", "-1", "0") — объекта точно нет, БД не нужна
            exists = false;
        } else {
            const supabase = getSupabase({ timeoutMs: 3000 });

            if (!supabase) {
                console.error("spa: Supabase env vars not configured, skipping existence check");
                checkState = "skipped-no-config";
                exists = true;
            } else {
                let result = null;
                try {
                    result = kind === "property"
                        ? await propertyExists(supabase, id)
                        : await commercialExists(supabase, id);
                } catch (err) {
                    console.error("spa: existence check threw:", err);
                }

                if (result === true) {
                    // превью ссылки: свои title/description/og:image объекта
                    listingMeta = await getListingMeta(supabase, kind, id);
                }

                if (result === null) {
                    // сбой БД / таймаут: лучше показать страницу (клиент сам
                    // решит), чем отдать 404 и выбросить живую страницу из индекса
                    checkState = "skipped-error";
                    exists = true;
                } else {
                    exists = result;
                }
            }
        }

        status = exists ? 200 : 404;
    }

    let html;
    try {
        html = await loadShell(req);
    } catch (err) {
        console.error("spa: cannot load index.html:", err.message);
        res.setHeader("Retry-After", "30");
        res.setHeader("Cache-Control", "no-store");
        res.status(503).send("Service temporarily unavailable");
        return;
    }

    if (status === 200 && checkState === "ok" && listingMeta) {
        try {
            html = injectHead(html, buildListingHead({ kind, id, lang, meta: listingMeta }));
        } catch (err) {
            // превью не должно ронять страницу — отдаём общую оболочку
            console.error("spa: head injection failed:", err);
        }
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("X-SPA-Existence-Check", checkState);

    if (checkState !== "ok") {
        // ответ получен без проверки — не кэшируем на CDN
        res.setHeader("Cache-Control", "no-store");
    } else {
        res.setHeader(
            "Cache-Control",
            status === 200
                ? "public, s-maxage=60, stale-while-revalidate=300"
                : "public, s-maxage=60"
        );
    }

    if (status === 404) {
        // Страховка: даже если кто-то обработает ответ как страницу —
        // индексировать нечего.
        res.setHeader("X-Robots-Tag", "noindex");
    }
    res.status(status).send(html);
}
