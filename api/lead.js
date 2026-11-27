import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import { classifyLead } from "./_leadRouting.js";
import { assignManager } from "./_leadManagers.js";
import { syncLeadToBinotel } from "./_binotel.js";

const getSupabaseAdmin = () => {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;

    if (!url || !key) return null;

    return createClient(url, key, {
        auth: { persistSession: false },
    });
};

const verifyAdminSkipCrm = async (req, supabaseAdmin, requestedSkipCrm) => {
    if (!requestedSkipCrm || !supabaseAdmin) return false;

    const authHeader = req.headers?.authorization || req.headers?.Authorization || "";
    const token = typeof authHeader === "string" && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : "";

    if (!token) return false;

    try {
        const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !userData?.user?.id) return false;

        const { data: profile, error: profileError } = await supabaseAdmin
            .from("profiles")
            .select("role")
            .eq("id", userData.user.id)
            .single();

        if (profileError || !profile) return false;
        return profile.role === "admin";
    } catch {
        return false;
    }
};

const computeDedupKey = (classified) => {
    const contact = classified.phone?.e164 || classified.email || classified.telegram || "anon";
    const bucket = Math.floor(Date.now() / (5 * 60 * 1000)); // 5-minute window
    const raw = [
        contact,
        classified.source,
        classified.direction.key,
        classified.operation,
        classified.propertyType,
        classified.message || "",
        String(bucket),
    ].join("|");

    return crypto.createHash("sha256").update(raw).digest("hex");
};

const checkDuplicateLead = async (supabaseAdmin, idempotencyKey, dedupKey) => {
    if (!supabaseAdmin) return false;

    try {
        if (idempotencyKey) {
            const { data } = await supabaseAdmin
                .from("leads")
                .select("id")
                .eq("idempotency_key", idempotencyKey)
                .limit(1);
            if (data && data.length > 0) return true;
        }

        if (dedupKey) {
            const { data } = await supabaseAdmin
                .from("leads")
                .select("id")
                .eq("dedup_key", dedupKey)
                .limit(1);
            if (data && data.length > 0) return true;
        }
    } catch {
        // Ignore if migration columns are not yet present
    }

    return false;
};

const buildBitrix24Payload = (source, leadRow, classified, manager) => ({
    fields: {
        TITLE: classified?.dealTitle || `Заявка с сайта (${source})`,
        NAME: leadRow.name || "",
        PHONE: leadRow.phone ? [{ VALUE: leadRow.phone, VALUE_TYPE: "WORK" }] : undefined,
        COMMENTS: [
            classified?.direction?.label ? `Направление: ${classified.direction.label}` : null,
            classified?.operation ? `Операция: ${classified.operation}` : null,
            classified?.propertyType ? `Тип: ${classified.propertyType}` : null,
            classified?.budget ? `Бюджет: ${classified.budget}` : null,
            manager?.name ? `Менеджер: ${manager.name}` : null,
            leadRow.telegram ? `Telegram: ${leadRow.telegram}` : null,
            leadRow.message ? `Сообщение: ${leadRow.message}` : null,
        ]
            .filter(Boolean)
            .join("\n"),
        SOURCE_DESCRIPTION: source,
    },
    params: { REGISTER_SONET_EVENT: "Y" },
});

const notifyCrmWebhook = async (source, leadRow, classified, manager) => {
    const url = process.env.CRM_WEBHOOK_URL;
    if (!url) return;

    const crmType = (process.env.CRM_TYPE || "generic").toLowerCase();

    const payload =
        crmType === "bitrix24"
            ? buildBitrix24Payload(source, leadRow, classified, manager)
            : {
                  source,
                  ...leadRow,
                  direction: classified.direction.key,
                  directionLabel: classified.direction.label,
                  operation: classified.operation,
                  propertyType: classified.propertyType,
                  budget: classified.budget,
                  dealTitle: classified.dealTitle,
                  manager: manager?.name || null,
                  managerEmployeeNumber: manager?.employeeNumber || null,
              };

    const headers = { "Content-Type": "application/json" };
    if (process.env.CRM_WEBHOOK_SECRET) {
        headers["X-Webhook-Secret"] = process.env.CRM_WEBHOOK_SECRET;
    }

    try {
        const res = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            console.error("CRM webhook responded with error status:", res.status, await res.text());
        }
    } catch (err) {
        console.error("CRM webhook error:", err);
    }
};

const insertLeadSafe = async (supabaseAdmin, fullRow, baseRow) => {
    if (!supabaseAdmin) return null;

    const { data: inserted, error } = await supabaseAdmin
        .from("leads")
        .insert([fullRow])
        .select("id")
        .single();

    if (!error) return inserted?.id || null;

    // Graceful fallback if new CRM columns are not yet migrated in Supabase
    if (error.message && /column .* does not exist/i.test(error.message)) {
        const { data: fallbackInserted, error: fallbackErr } = await supabaseAdmin
            .from("leads")
            .insert([baseRow])
            .select("id")
            .single();

        if (fallbackErr) {
            console.error("Failed to save lead to Supabase (fallback):", fallbackErr);
            return null;
        }
        return fallbackInserted?.id || null;
    }

    console.error("Failed to save lead to Supabase:", error);
    return null;
};

const updateLeadCrmResult = async (supabaseAdmin, leadId, binotelRes) => {
    if (!supabaseAdmin || !leadId) return;

    try {
        await supabaseAdmin
            .from("leads")
            .update({
                binotel_customer_id: binotelRes.customerId || null,
                binotel_deal_id: binotelRes.dealId || null,
                binotel_status: binotelRes.status || null,
                binotel_error: binotelRes.error || null,
                crm_synced_at: binotelRes.ok ? new Date().toISOString() : null,
            })
            .eq("id", leadId);
    } catch {
        // Ignore if migration columns are not yet present
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
    if (!secret) return true;
    if (!token) return false;

    try {
        const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                secret,
                response: token,
                remoteip: ip || "",
            }),
        });

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
        clean[key] =
            strValue.length > MAX_FIELD_LENGTH
                ? strValue.slice(0, MAX_FIELD_LENGTH) + "…"
                : strValue;
    }

    return clean;
};

const buildMessage = (source, data, classified, manager, skipCrm) => {
    const metaLines = [
        `Направление: ${classified.direction.label}${classified.requiresManualReview ? " ⚠️" : ""}`,
        `Операция: ${classified.operation}`,
        `Тип объекта: ${classified.propertyType}`,
        classified.phone?.e164 ? `Телефон (норм.): ${classified.phone.e164}` : null,
        classified.budget ? `Бюджет: ${classified.budget}` : null,
        manager?.name ? `Менеджер: ${manager.name}` : null,
        skipCrm ? "🧪 Режим теста (skipCrm)" : null,
    ].filter(Boolean);

    const fieldLines = Object.entries(data)
        .filter(([key]) => key !== "company")
        .map(([key, value]) => `${key}: ${value || "-"}`);

    const text = `📩 Новая заявка (${source})\n\n${metaLines.join("\n")}\n\n${fieldLines.join("\n")}`;
    return text.length > 4000 ? text.slice(0, 4000) + "…" : text;
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

    const { source, data, captchaToken, company, skipCrm, idempotencyKey: bodyIdemKey } =
        req.body || {};

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

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        console.error("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not configured");
        return res.status(500).json({ error: "Server is not configured" });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const classified = classifyLead({ source: safeSource, data: safeData });

    const rawIdemKey = bodyIdemKey || req.headers["x-idempotency-key"];
    const idempotencyKey =
        typeof rawIdemKey === "string" && rawIdemKey.trim()
            ? rawIdemKey.trim().slice(0, 80)
            : null;
    const dedupKey = computeDedupKey(classified);

    const isDuplicate = await checkDuplicateLead(supabaseAdmin, idempotencyKey, dedupKey);
    if (isDuplicate) {
        return res.status(200).json({ ok: true, deduplicated: true });
    }

    const effectiveSkipCrm = await verifyAdminSkipCrm(req, supabaseAdmin, Boolean(skipCrm));

    const manager = await assignManager({
        supabaseAdmin,
        directionKey: classified.direction.key,
        phoneE164: classified.phone?.e164,
        email: classified.email,
    });

    const baseRow = {
        type: "contact_form",
        source: safeSource,
        name: classified.name,
        phone: classified.phone?.e164 || classified.phone?.raw || null,
        telegram: classified.telegram,
        message: classified.message,
        raw_data: safeData,
    };

    const fullRow = {
        ...baseRow,
        direction: classified.direction.key,
        operation: classified.operation,
        property_type: classified.propertyType,
        budget: classified.budget,
        assigned_manager_name: manager?.name || null,
        assigned_manager_id: manager?.employeeNumber || null,
        binotel_status: effectiveSkipCrm ? "skipped_admin_test" : "pending",
        idempotency_key: idempotencyKey,
        dedup_key: dedupKey,
    };

    try {
        const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                text: buildMessage(safeSource, safeData, classified, manager, effectiveSkipCrm),
            }),
        });

        if (!tgRes.ok) {
            const body = await tgRes.text();
            console.error("Telegram API error:", body);
            return res.status(502).json({ error: "Failed to deliver message" });
        }

        const leadId = await insertLeadSafe(supabaseAdmin, fullRow, baseRow);

        if (!effectiveSkipCrm) {
            const [binotelRes] = await Promise.all([
                syncLeadToBinotel({ classified, manager }).catch((err) => ({
                    ok: false,
                    status: "error",
                    error: String(err?.message || err),
                })),
                notifyCrmWebhook(safeSource, baseRow, classified, manager).catch((err) =>
                    console.error("notifyCrmWebhook failed:", err)
                ),
            ]);

            if (leadId && binotelRes) {
                await updateLeadCrmResult(supabaseAdmin, leadId, binotelRes);
            }
        }

        return res.status(200).json({
            ok: true,
            direction: classified.direction.key,
        });
    } catch (err) {
        console.error("Lead submit error:", err);
        return res.status(500).json({ error: "Unexpected server error" });
    }
}
