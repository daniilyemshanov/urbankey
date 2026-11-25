import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

const getSupabaseAdmin = () => {

    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;

    if (!url || !key) return null;

    return createClient(url, key, {
        auth: { persistSession: false }
    });

};

const buildBitrix24Payload = (source, leadRow) => ({
    fields: {
        TITLE: `Заявка с сайта (${source})`,
        NAME: leadRow.name || "",
        PHONE: leadRow.phone ? [{ VALUE: leadRow.phone, VALUE_TYPE: "WORK" }] : undefined,
        COMMENTS: [
            leadRow.telegram ? `Telegram: ${leadRow.telegram}` : null,
            leadRow.message ? `Сообщение: ${leadRow.message}` : null
        ].filter(Boolean).join("\n"),
        SOURCE_DESCRIPTION: source
    },
    params: { REGISTER_SONET_EVENT: "Y" }
});

const normalizePhoneDigits = (value) => {

    const digits = String(value || "").replace(/\D/g, "");

    if (!digits) return "";

    // Uzbekistan local 9-digit number -> add country code
    if (digits.length === 9) return `998${digits}`;

    return digits;
};

const buildLeadName = (data) =>
    [data.firstname, data.secondname].filter(Boolean).join(" ").trim() ||
    data.name ||
    data.Name ||
    null;

const notifyBinotel = async (source, leadRow) => {

    const key = process.env.BINOTEL_KEY;
    const secret = process.env.BINOTEL_SECRET;

    if (!key || !secret) return false;

    const raw = leadRow.raw_data || {};
    const phone = normalizePhoneDigits(leadRow.phone);

    // Binotel creates a customer only by phone number
    if (!phone) return false;

    // In Binotel customer names are expected to be unique -> append the phone number
    const baseName = leadRow.name || `Заявка с сайта (${source})`;
    const name = `${baseName} +${phone}`.slice(0, 100);

    const description = [
        `Источник: ${source}`,
        raw.inquiry && `Тип запроса: ${raw.inquiry}`,
        raw.request_type && `Тип запроса: ${raw.request_type}`,
        raw.hear && `Откуда узнал: ${raw.hear}`,
        leadRow.message && `Сообщение: ${leadRow.message}`
    ].filter(Boolean).join("\n");

    const res = await fetch("https://api.binotel.com/api/4.0/customers/create.json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            key,
            secret,
            name,
            numbers: [phone],
            email: raw.email || undefined,
            description
        })
    });

    const json = await res.json().catch(() => ({}));

    if (json.status !== "success") {
        console.error("Binotel customers/create error:", res.status, json);
        return false;
    }

    return true;
};

const notifyCrmWebhook = async (source, leadRow) => {

    const crmType = (process.env.CRM_TYPE || "generic").toLowerCase();

    if (crmType === "binotel") {
        try {
            return await notifyBinotel(source, leadRow);
        } catch (err) {
            console.error("Binotel error:", err);
            return false;
        }
    }

    const url = process.env.CRM_WEBHOOK_URL;

    if (!url) return false;

    const payload = crmType === "bitrix24"
        ? buildBitrix24Payload(source, leadRow)
        : { source, ...leadRow };

    try {

        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            console.error("CRM webhook responded with error status:", res.status, await res.text());
            return false;
        }

        return true;

    } catch (err) {
        console.error("CRM webhook error:", err);
        return false;
    }

};

const saveLead = async (source, data, skipCrm, meta = {}) => {

    const supabaseAdmin = getSupabaseAdmin();

    if (!supabaseAdmin) {
        console.warn("SUPABASE_SERVICE_KEY/SUPABASE_URL not set — lead not persisted to CRM table");
        return;
    }

    const leadRow = {
        type: "contact_form",
        source,
        name: buildLeadName(data),
        phone: data.phone || data.Phone || data.tel || null,
        telegram: data.telegram || data.Telegram || null,
        message: data.message || data.Message || data.description || data.comment || null,
        raw_data: meta.ipHash ? { ...data, _ip: meta.ipHash } : data
    };

    try {

        const { data: inserted, error } = await supabaseAdmin
            .from("leads")
            .insert([leadRow])
            .select("id")
            .single();

        if (error) {
            console.error("Failed to save lead to Supabase:", error);
            return;
        }

        if (!skipCrm) {

            const synced = await notifyCrmWebhook(source, leadRow);

            if (synced && inserted?.id) {
                await supabaseAdmin
                    .from("leads")
                    .update({ crm_synced_at: new Date().toISOString() })
                    .eq("id", inserted.id);
            }
        }

    } catch (err) {
        console.error("saveLead unexpected error:", err);
    }

};

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const hits = new Map();

const isRateLimited = (ip) => {

    const now = Date.now();
    const entry = hits.get(ip);

    if (!entry || now - entry.start > RATE_LIMIT_WINDOW_MS) {
        hits.set(ip, { start: now, count: 1 });
        return false;
    }

    entry.count += 1;
    return entry.count > RATE_LIMIT_MAX;
};


const extraAllowedHosts = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);

const isAllowedOrigin = (req) => {

    const origin = req.headers.origin;

    if (!origin) return true;

    try {
        const host = new URL(origin).host;
        return host === req.headers.host || extraAllowedHosts.includes(host);
    } catch {
        return false;
    }
};


const verifyTurnstile = async (token, ip) => {

    const secret = process.env.TURNSTILE_SECRET_KEY;

    if (!secret) {
        // Fail closed in production: without the secret anybody could skip the captcha
        if (process.env.VERCEL_ENV === "production") {
            console.error("TURNSTILE_SECRET_KEY is not set in production - rejecting lead");
            return false;
        }
        return true;
    }

    if (!token) return false;

    try {

        const res = await fetch(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    secret,
                    response: token,
                    remoteip: ip || ""
                })
            }
        );

        const data = await res.json();
        return Boolean(data.success);

    } catch (err) {
        console.error("Turnstile verify error:", err);
        return false;
    }
};


const ALLOWED_SOURCES = ["Connect", "Connect_one", "Happen", "Footer newsletter", "LeadPopup"];

const MAX_FIELDS = 15;
const MAX_FIELD_LENGTH = 1500;
const MAX_KEY_LENGTH = 60;

const sanitizeData = (data) => {

    const entries = Object.entries(data).slice(0, MAX_FIELDS);

    const clean = {};

    for (const [key, value] of entries) {

        if (typeof key !== "string" || key.length > MAX_KEY_LENGTH) continue;

        const strValue = String(value ?? "");

        clean[key] = strValue.length > MAX_FIELD_LENGTH
            ? strValue.slice(0, MAX_FIELD_LENGTH) + "…"
            : strValue;
    }

    return clean;
};


const buildMessage = (source, data) => {

    const lines = Object.entries(data)
        .filter(([key]) => key !== "company")
        .map(([key, value]) => `${key}: ${value || "-"}`);

    const text = `📩 Новая заявка (${source})\n\n${lines.join("\n")}`;

    return text.length > 4000 ? text.slice(0, 4000) + "…" : text;
};



// ---------- Anti-spam helpers ----------

const hashIp = (ip) =>
    createHash("sha256")
        .update(`${ip}|${process.env.LEAD_IP_SALT || "urbankey"}`)
        .digest("hex")
        .slice(0, 24);

const isValidPhone = (value) => {
    const digits = String(value || "").replace(/\D/g, "");
    return digits.length >= 9 && digits.length <= 15;
};

const countLinks = (data) =>
    Object.values(data)
        .map((v) => (String(v).match(/https?:\/\/|www\./gi) || []).length)
        .reduce((a, b) => a + b, 0);

const MAX_LEADS_PER_IP_PER_HOUR = 10;
const DUPLICATE_WINDOW_MIN = 10;

// Persistent limits (work on serverless, unlike the in-memory counter).
// Returns "ok" | "duplicate" | "too_many". Fails open if the DB is unavailable.
const checkLeadLimits = async (ipHash, phone) => {

    const supabaseAdmin = getSupabaseAdmin();

    if (!supabaseAdmin) return "ok";

    try {

        const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

        const { count: ipCount } = await supabaseAdmin
            .from("leads")
            .select("id", { count: "exact", head: true })
            .eq("raw_data->>_ip", ipHash)
            .gte("created_at", hourAgo);

        if ((ipCount || 0) >= MAX_LEADS_PER_IP_PER_HOUR) return "too_many";

        if (phone) {

            const since = new Date(Date.now() - DUPLICATE_WINDOW_MIN * 60 * 1000).toISOString();

            const { count: dupCount } = await supabaseAdmin
                .from("leads")
                .select("id", { count: "exact", head: true })
                .eq("phone", phone)
                .gte("created_at", since);

            if ((dupCount || 0) > 0) return "duplicate";
        }

        return "ok";

    } catch (err) {
        console.error("checkLeadLimits failed:", err);
        return "ok";
    }
};

export default async function handler(req, res) {

    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ error: "Method not allowed" });
    }

    if (!isAllowedOrigin(req)) {
        return res.status(403).json({ error: "Forbidden origin" });
    }

    const ip =
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.socket?.remoteAddress ||
        "unknown";

    if (isRateLimited(ip)) {
        return res.status(429).json({ error: "Too many requests, try again later" });
    }

    const { source, data, captchaToken, company, skipCrm } = req.body || {};

    if (company) {
        return res.status(200).json({ ok: true });
    }

    if (!data || typeof data !== "object" || Array.isArray(data)) {
        return res.status(400).json({ error: "Missing form data" });
    }

    const safeSource = ALLOWED_SOURCES.includes(source) ? source : "unknown";
    const safeData = sanitizeData(data);

    if (Object.keys(safeData).length === 0) {
        return res.status(400).json({ error: "Empty form data" });
    }

    const captchaOk = await verifyTurnstile(captchaToken, ip);

    if (!captchaOk) {
        return res.status(400).json({ error: "Captcha verification failed" });
    }

    // Silent drop (looks like success to bots) for junk submissions
    const needsPhone = safeSource !== "Footer newsletter";

    if (needsPhone && !isValidPhone(safeData.phone)) {
        return res.status(400).json({ error: "Invalid phone number" });
    }

    if (countLinks(safeData) > 2) {
        return res.status(200).json({ ok: true });
    }

    const ipHash = hashIp(ip);
    const limitState = await checkLeadLimits(ipHash, needsPhone ? safeData.phone : null);

    if (limitState === "too_many") {
        return res.status(429).json({ error: "Too many requests, try again later" });
    }

    if (limitState === "duplicate") {
        // Same phone just submitted: do not spam Telegram/CRM again
        return res.status(200).json({ ok: true });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        console.error("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not configured");
        return res.status(500).json({ error: "Server is not configured" });
    }

    try {

        const tgRes = await fetch(
            `https://api.telegram.org/bot${token}/sendMessage`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: buildMessage(safeSource, safeData)
                })
            }
        );

        if (!tgRes.ok) {
            const body = await tgRes.text();
            console.error("Telegram API error:", body);
            return res.status(502).json({ error: "Failed to deliver message" });
        }

        // await: on serverless the function can be frozen right after the response
        await saveLead(safeSource, safeData, skipCrm, { ipHash }).catch((err) =>
            console.error("saveLead call failed:", err)
        );

        return res.status(200).json({ ok: true });

    } catch (err) {
        console.error("Lead submit error:", err);
        return res.status(500).json({ error: "Unexpected server error" });
    }
}
