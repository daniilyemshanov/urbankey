import { trackGenerateLead } from "../analytics.js";
import { supabase } from "../supabase.js";

const generateIdempotencyKey = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return `lead-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const sendLead = async ({ source, data, captchaToken, honeypot, skipCrm, idempotencyKey }) => {
    const headers = { "Content-Type": "application/json" };
    const effectiveKey = idempotencyKey || generateIdempotencyKey();
    headers["X-Idempotency-Key"] = effectiveKey;

    if (skipCrm && supabase?.auth?.getSession) {
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;
            if (token) {
                headers.Authorization = `Bearer ${token}`;
            }
        } catch {
            // Safe fallback: server will treat as non-admin
        }
    }

    const response = await fetch("/api/lead", {
        method: "POST",
        headers,
        body: JSON.stringify({
            source,
            data,
            captchaToken,
            company: honeypot || "",
            skipCrm: Boolean(skipCrm),
            idempotencyKey: effectiveKey,
        }),
    });

    if (!response.ok) {
        let message = "Request failed";

        try {
            const body = await response.json();
            message = body?.error || message;
        } catch {
            // ignore parse error
        }

        throw new Error(message);
    }

    try {
        trackGenerateLead({ source });
    } catch {
        // Analytics failure should never break lead submission
    }

    return response.json();
};
