export const ErrorClass = Object.freeze({
    MODEL: "model",
    PARSE: "parse",
    VALIDATION: "validation",
    DB: "db",
    DISPLAY: "display",
});

const SECRET_ENV_NAMES = [
    "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "GROQ_API_KEY", "OPENROUTER_API_KEY", "MISTRAL_API_KEY",
    "SAMBANOVA_API_KEY", "CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID",
    "SUPABASE_SERVICE_KEY", "VITE_SUPABASE_KEY", "SUPABASE_ANON_KEY",
    "PARSER_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET", "OPENAI_API_KEY",
    "CRON_SECRET", "FINALIZE_SECRET",
];

function safeStringify(value) {
    try {
        if (value instanceof Error) {
            return JSON.stringify({ name: value.name, message: value.message });
        }
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

export function redactSecrets(input) {
    let text = typeof input === "string" ? input : safeStringify(input);

    for (const name of SECRET_ENV_NAMES) {
        const value = process.env[name];
        if (value && value.length >= 8) text = text.split(value).join("[REDACTED]");
    }

    return text
        .replace(/([?&](?:key|api_key|apikey|token|access_token)=)[^&\s"'\\]+/gi, "$1[REDACTED]")
        .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi, "$1[REDACTED]")
        .replace(/\bbot\d{6,}:[A-Za-z0-9_-]{20,}/g, "bot[REDACTED]")
        .replace(/\b(AIza[0-9A-Za-z_-]{20,}|gsk_[0-9A-Za-z]{20,}|sk-[A-Za-z0-9_-]{16,}|cfut_[A-Za-z0-9_-]{10,}|eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/g, "[REDACTED]");
}

export function shortBody(body, max = 300) {
    const text = redactSecrets(typeof body === "string" ? body : safeStringify(body));
    return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function logEvent(event, fields = {}) {
    console.log(`${event} ${redactSecrets(fields)}`);
}
