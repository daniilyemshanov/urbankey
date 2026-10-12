// Безопасное логирование для цепочки "Telegram -> ИИ -> Supabase".
// Файл начинается с "_", поэтому Vercel не превращает его в endpoint.
//
// Зачем отдельный модуль:
//   • в логах не должно быть ключей и токенов — тело ошибки провайдера или
//     текст исключения могут содержать URL с ?key=..., заголовок Bearer ... и т.п.;
//   • ошибки разных слоёв (модель / разбор ответа / валидация / БД / отображение)
//     должны различаться в логах одним полем `class`, а не растворяться в
//     одинаковых "ERROR:".

// Классы ошибок. Один и тот же набор используется во всех логах.
export const ErrorClass = Object.freeze({
    MODEL: "model",           // провайдер ИИ: сеть, HTTP-ошибка, таймаут, пустой ответ
    PARSE: "parse",           // ответ получен, но это не валидный JSON / не объект
    VALIDATION: "validation", // JSON валиден, но не соответствует схеме/смыслу
    DB: "db",                 // запись/чтение Supabase
    DISPLAY: "display",       // сохранённое значение сайт не сможет показать корректно
});

// Переменные окружения, значения которых нельзя выводить в лог ни при каких
// условиях (даже если они случайно попали в текст ошибки).
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

// Заменяет секреты на [REDACTED]. Работает по значениям из окружения и по
// типичным форматам (на случай, если ключ не из env, а, например, из .env другого окружения).
export function redactSecrets(input) {
    let text = typeof input === "string" ? input : safeStringify(input);

    for (const name of SECRET_ENV_NAMES) {
        const value = process.env[name];
        if (value && value.length >= 8) text = text.split(value).join("[REDACTED]");
    }

    return text
        // ?key=..., &api_key=..., ?token=...
        .replace(/([?&](?:key|api_key|apikey|token|access_token)=)[^&\s"'\\]+/gi, "$1[REDACTED]")
        // Authorization: Bearer xxx
        .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi, "$1[REDACTED]")
        // токен Telegram-бота в URL: /bot123456:AA...
        .replace(/\bbot\d{6,}:[A-Za-z0-9_-]{20,}/g, "bot[REDACTED]")
        // типичные префиксы ключей провайдеров и JWT
        .replace(/\b(AIza[0-9A-Za-z_-]{20,}|gsk_[0-9A-Za-z]{20,}|sk-[A-Za-z0-9_-]{16,}|cfut_[A-Za-z0-9_-]{10,}|eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/g, "[REDACTED]");
}

// Ограничивает длину тела ответа провайдера, которое попадает в лог.
export function shortBody(body, max = 300) {
    const text = redactSecrets(typeof body === "string" ? body : safeStringify(body));
    return text.length > max ? `${text.slice(0, max)}…` : text;
}

// Одна строка лога: "EVENT {json}". Все поля проходят через redactSecrets.
// Тексты объявлений (номера телефонов, имена агентов) сюда не передаём —
// только имена полей, числа и причины.
export function logEvent(event, fields = {}) {
    console.log(`${event} ${redactSecrets(fields)}`);
}
