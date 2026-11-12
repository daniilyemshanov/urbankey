// Разовая отправка ВСЕХ адресов из sitemap в IndexNow (Яндекс, Bing).
// Запуск после деплоя:
//   curl -X POST https://urbankey.uz/api/indexnow-sync -H "Authorization: Bearer <CRON_SECRET>"
// Новые и изменённые объекты из бота отправляются автоматически.

import { SITE_ORIGIN } from "./_publicDb.js";
import { isAuthorized } from "./update-exchange-rate.js";
import { submitIndexNow } from "./_indexNow.js";

const BATCH = 10000;

export function extractLocs(xml) {
    return [...String(xml || "").matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
}

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    if (req.method !== "GET" && req.method !== "POST") {
        res.setHeader("Allow", "GET, POST");
        return res.status(405).json({ error: "Method not allowed" });
    }

    const secret = process.env.CRON_SECRET;
    if (!secret) return res.status(503).json({ error: "Endpoint is not configured" });
    if (!isAuthorized(req, secret)) return res.status(401).json({ error: "Unauthorized" });

    try {
        const response = await fetch(`${SITE_ORIGIN}/sitemap.xml`, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) return res.status(502).json({ ok: false, error: `sitemap ${response.status}` });

        const urls = [...new Set(extractLocs(await response.text()))];
        const results = [];

        for (let i = 0; i < urls.length; i += BATCH) {
            results.push(await submitIndexNow(urls.slice(i, i + BATCH), { force: true, timeoutMs: 15000 }));
        }

        const ok = results.length > 0 && results.every((r) => r.ok);
        return res.status(ok ? 200 : 502).json({ ok, urls: urls.length, results });
    } catch (e) {
        return res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 120) });
    }
}
