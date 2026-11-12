import { createHash, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { logEvent } from "./_aiLog.js";
import { updateExchangeRate } from "./_exchangeRate.js";

const SUPABASE_TIMEOUT_MS = 8000;

function secretsMatch(provided, expected) {
    const a = createHash("sha256").update(String(provided)).digest();
    const b = createHash("sha256").update(String(expected)).digest();
    return timingSafeEqual(a, b);
}

export function isAuthorized(req, secret) {
    const header = req.headers?.authorization;
    if (typeof header !== "string") return false;

    const match = header.match(/^Bearer\s+(.+)$/i);
    return Boolean(match) && secretsMatch(match[1].trim(), secret);
}

function getServiceClient() {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) return null;

    return createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: (input, init = {}) => fetch(input, { ...init, signal: AbortSignal.timeout(SUPABASE_TIMEOUT_MS) }) },
    });
}

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    if (req.method !== "GET" && req.method !== "POST") {
        res.setHeader("Allow", "GET, POST");
        return res.status(405).json({ error: "Method not allowed" });
    }

    const secret = process.env.CRON_SECRET;

    if (!secret) {
        logEvent("FX_RATE_AUTH", { ok: false, reason: "cron_secret_not_configured" });
        return res.status(503).json({ error: "Endpoint is not configured" });
    }

    if (!isAuthorized(req, secret)) {
        logEvent("FX_RATE_AUTH", { ok: false, reason: "unauthorized" });
        return res.status(401).json({ error: "Unauthorized" });
    }

    const supabase = getServiceClient();

    if (!supabase) {
        logEvent("FX_RATE", { ok: false, code: "storage_not_configured" });
        return res.status(503).json({ ok: false, status: "storage_not_configured" });
    }

    try {
        const result = await updateExchangeRate({ supabase });
        return res.status(result.ok ? 200 : 502).json(result);
    } catch (e) {
        logEvent("FX_RATE", { ok: false, code: "unexpected", reason: String(e?.message || e).slice(0, 160) });
        return res.status(500).json({ ok: false, status: "unexpected" });
    }
}
