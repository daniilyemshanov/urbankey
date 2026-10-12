// Общая цепочка ИИ-провайдеров для разбора объявлений — один и тот же
// список используется в api/listingParser.js (а через него — в
// api/telegram-webhook.js, api/finalize-albums.js и server/bot.js).
//
// Порядок: Anthropic (Claude Haiku) -> Gemini -> Groq -> OpenRouter ->
// Mistral -> SambaNova -> Cloudflare Workers AI. Провайдер без ключа в
// окружении пропускается, так что без ANTHROPIC_API_KEY цепочка работает
// ровно как раньше. Haiku стоит первым ради качества извлечения; при любой
// ошибке (ключ, лимит, таймаут, пустой/невалидный ответ) управление
// переходит к бесплатным провайдерам ниже.
// (OpenAI и Cerebras сознательно не используются.)
//
// Что делает цепочка надёжной:
//   • ответ каждого провайдера ПРОВЕРЯЕТСЯ вызывающим кодом (callback
//     `validate`) ДО того, как цепочка остановится. Раньше первый ответивший
//     провайдер возвращался как есть — даже `{}`, массив или JSON с неверными
//     типами, и до следующего провайдера дело не доходило;
//   • повторы ограничены: на провайдера не больше `maxAttempts` попыток
//     (по умолчанию 2), на всю цепочку — общий лимит времени `budgetMs`
//     (по умолчанию 25 с, AI_TOTAL_BUDGET_MS). Бесконечных повторов нет;
//   • временные сбои (429/5xx/таймаут/сеть) повторяются с паузой, постоянные
//     (401/403/404/400) — нет, цепочка сразу идёт дальше;
//   • при невалидном JSON/нарушении схемы повтор получает короткую подсказку,
//     что именно было не так;
//   • ошибки разных слоёв различаются в логе полем `class`
//     (model | parse | validation) — см. api/_aiLog.js;
//   • в логи не попадают ключи: ключ Gemini передаётся заголовком, а не в URL,
//     и любой текст ошибки проходит через redactSecrets.
//
// Если ни один провайдер не дал валидный ответ — { ok: false, attempts },
// вызывающий код откатывается на регулярный парсер (parseListing) и не
// теряет объявление.

import { ErrorClass, logEvent, shortBody, redactSecrets } from "./_aiLog.js";

// Конфигурация читается при каждом вызове (а не один раз при загрузке
// модуля), чтобы изменения окружения и тесты работали предсказуемо.
function readConfig() {
    const env = process.env;
    const num = (value, fallback) => {
        const n = Number(value);
        return Number.isFinite(n) && n > 0 ? n : fallback;
    };

    return {
        // Модель задаётся ANTHROPIC_MODEL; значение по умолчанию — только запасное.
        anthropic: { key: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL || "claude-haiku-5-5" },
        gemini: { key: env.GEMINI_API_KEY, model: env.GEMINI_MODEL || "gemini-3.6-flash" },
        groq: { key: env.GROQ_API_KEY, model: env.GROQ_MODEL || "llama-3.3-70b-versatile" },
        openrouter: { key: env.OPENROUTER_API_KEY, model: env.OPENROUTER_MODEL || "openai/gpt-4o-mini" },
        mistral: { key: env.MISTRAL_API_KEY, model: env.MISTRAL_MODEL || "mistral-small-latest" },
        sambanova: { key: env.SAMBANOVA_API_KEY, model: env.SAMBANOVA_MODEL || "Meta-Llama-3.3-70B-Instruct" },
        cloudflare: {
            accountId: env.CLOUDFLARE_ACCOUNT_ID,
            token: env.CLOUDFLARE_API_TOKEN,
            model: env.CLOUDFLARE_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        },
        timeoutMs: num(env.AI_TIMEOUT_MS, 20000),
        budgetMs: num(env.AI_TOTAL_BUDGET_MS, 25000),
        maxAttempts: Math.min(3, Math.max(1, Math.round(num(env.AI_MAX_ATTEMPTS, 2)))),
    };
}

// 529 — "overloaded" у Anthropic: временная перегрузка, повтор уместен.
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504, 529]);
const DEFAULT_RETRY_DELAYS_MS = [800, 1800];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Паузы между повторами одного провайдера (мс). Можно переопределить
// переменной AI_RETRY_DELAYS_MS="800,1800" (в тестах — "0,0").
function readRetryDelays() {
    const raw = process.env.AI_RETRY_DELAYS_MS;
    if (!raw) return DEFAULT_RETRY_DELAYS_MS;
    const list = raw.split(",").map((x) => Number(x.trim())).filter((n) => Number.isFinite(n) && n >= 0);
    return list.length ? list : DEFAULT_RETRY_DELAYS_MS;
}

// Ошибка одного обращения к провайдеру. kind: http | timeout | network | empty | json
class AiCallError extends Error {
    constructor(kind, message, { status = null, retryable = false } = {}) {
        super(message);
        this.name = "AiCallError";
        this.kind = kind;
        this.status = status;
        this.retryable = retryable;
    }
}

// Класс ошибки для лога: сетевые/HTTP/пустые ответы — это модель,
// невалидный JSON — разбор.
const classOfCallError = (e) => (e.kind === "json" ? ErrorClass.PARSE : ErrorClass.MODEL);

// Модели иногда оборачивают JSON в ```-фенсы или добавляют текст вокруг.
export function cleanJsonText(text) {
    const raw = String(text || "").trim();
    const noFence = raw.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
    const start = noFence.indexOf("{");
    const end = noFence.lastIndexOf("}");
    if (start >= 0 && end > start) return noFence.slice(start, end + 1).trim();
    return noFence;
}

function parseModelJson(rawText) {
    let value;
    try {
        value = JSON.parse(cleanJsonText(rawText));
    } catch (e) {
        throw new AiCallError("json", `невалидный JSON: ${redactSecrets(e.message)}`, { retryable: true });
    }
    return value;
}

async function fetchWithTimeout(url, init, timeoutMs, label) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } catch (e) {
        if (e?.name === "AbortError" || controller.signal.aborted) {
            throw new AiCallError("timeout", `${label}: таймаут ${timeoutMs} мс`, { retryable: true });
        }
        throw new AiCallError("network", `${label}: ${redactSecrets(e?.message || e)}`, { retryable: true });
    } finally {
        clearTimeout(timer);
    }
}

async function failOnHttpError(res, label) {
    if (res.ok) return;
    const body = shortBody(await res.text().catch(() => ""));
    throw new AiCallError("http", `${label}: HTTP ${res.status} ${body}`, {
        status: res.status,
        retryable: RETRYABLE_STATUSES.has(res.status),
    });
}

// ---------------------------------------------------------------------
// Адаптеры провайдеров. Каждый делает ОДНО обращение и либо возвращает
// разобранный JSON, либо бросает AiCallError. Решение о повторе принимает
// цепочка ниже.
// ---------------------------------------------------------------------

// Anthropic Messages API. JSON получаем через принудительный вызов
// инструмента (tool_choice) со схемой ответа: модель возвращает готовый
// объект в tool_use.input, без markdown-фенсов и лишнего текста. Если
// схемы нет или модель всё же ответила текстом — разбираем текст как JSON.
const ANTHROPIC_MAX_TOKENS = 2048;
const ANTHROPIC_TOOL_NAME = "save_listing";

async function callAnthropic(cfg, { systemPrompt, jsonSchema, userText }, timeoutMs) {
    const body = {
        model: cfg.anthropic.model,
        max_tokens: ANTHROPIC_MAX_TOKENS,
        system: jsonSchema
            ? systemPrompt
            : `${systemPrompt}\n\nОтвечай СТРОГО одним валидным JSON-объектом, без пояснений и без markdown-разметки (без \`\`\`).`,
        messages: [{ role: "user", content: userText }],
    };

    if (jsonSchema) {
        body.tools = [{
            name: ANTHROPIC_TOOL_NAME,
            description: "Сохранить данные объявления, извлечённые из текста поста. Заполняй только то, что явно написано в тексте.",
            input_schema: jsonSchema,
        }];
        body.tool_choice = { type: "tool", name: ANTHROPIC_TOOL_NAME };
    }

    const res = await fetchWithTimeout(
        "https://api.anthropic.com/v1/messages",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                // ключ в заголовке — так он не попадает в URL и логи
                "x-api-key": cfg.anthropic.key,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify(body),
        },
        timeoutMs,
        "ANTHROPIC"
    );

    await failOnHttpError(res, "ANTHROPIC");

    const data = await res.json().catch(() => null);
    const blocks = Array.isArray(data?.content) ? data.content : [];

    if (data?.stop_reason === "max_tokens") {
        throw new AiCallError("json", "ANTHROPIC: ответ обрезан (max_tokens)", { retryable: true });
    }

    const toolBlock = blocks.find((b) => b?.type === "tool_use");
    if (toolBlock) {
        const input = toolBlock.input;
        if (input == null || typeof input !== "object" || Array.isArray(input)) {
            throw new AiCallError("json", "ANTHROPIC: tool_use.input не является объектом", { retryable: true });
        }
        return input;
    }

    const text = blocks.filter((b) => b?.type === "text").map((b) => b.text || "").join("");
    if (!text.trim()) {
        const why = data?.stop_reason || "нет содержимого";
        throw new AiCallError("empty", `ANTHROPIC: пустой ответ (${why})`, { retryable: true });
    }

    return parseModelJson(text);
}

async function callGemini(cfg, { systemPrompt, geminiResponseSchema, userText }, timeoutMs) {
    const res = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${cfg.gemini.model}:generateContent`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                // ключ в заголовке, а не в ?key=... — так он не попадает в URL и логи
                "x-goog-api-key": cfg.gemini.key,
            },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents: [{ parts: [{ text: userText }] }],
                generationConfig: {
                    temperature: 0,
                    responseMimeType: "application/json",
                    responseSchema: geminiResponseSchema,
                },
            }),
        },
        timeoutMs,
        "GEMINI"
    );

    await failOnHttpError(res, "GEMINI");

    const data = await res.json().catch(() => null);
    const candidate = data?.candidates?.[0];
    const raw = candidate?.content?.parts?.map((p) => p?.text || "").join("");

    if (!raw) {
        const why = data?.promptFeedback?.blockReason || candidate?.finishReason || "нет текста";
        throw new AiCallError("empty", `GEMINI: пустой ответ (${why})`, { retryable: true });
    }
    if (candidate?.finishReason === "MAX_TOKENS") {
        throw new AiCallError("json", "GEMINI: ответ обрезан (MAX_TOKENS)", { retryable: true });
    }

    return parseModelJson(raw);
}

// Groq/OpenRouter/Mistral/SambaNova говорят по OpenAI-совместимому
// /chat/completions, но без строгой json_schema — просим json_object и
// подчищаем ответ cleanJsonText.
async function callOpenAICompatible({ providerName, baseUrl, apiKey, model, systemPrompt, userText, extraHeaders = {} }, timeoutMs) {
    const label = providerName.toUpperCase();

    const res = await fetchWithTimeout(
        `${baseUrl.replace(/\/$/, "")}/chat/completions`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
                ...extraHeaders,
            },
            body: JSON.stringify({
                model,
                temperature: 0,
                response_format: { type: "json_object" },
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userText },
                ],
            }),
        },
        timeoutMs,
        label
    );

    await failOnHttpError(res, label);

    const data = await res.json().catch(() => null);
    const raw = data?.choices?.[0]?.message?.content;

    if (!raw) throw new AiCallError("empty", `${label}: пустой ответ`, { retryable: true });

    return parseModelJson(raw);
}

// Cloudflare Workers AI — свой формат: /accounts/{id}/ai/run/{model},
// ответ { success, result: { response } }.
async function callCloudflare(cfg, { systemPrompt, userText }, timeoutMs) {
    const res = await fetchWithTimeout(
        `https://api.cloudflare.com/client/v4/accounts/${cfg.cloudflare.accountId}/ai/run/${cfg.cloudflare.model}`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${cfg.cloudflare.token}`,
            },
            body: JSON.stringify({
                temperature: 0,
                messages: [
                    {
                        role: "system",
                        content: `${systemPrompt}\n\nОтвечай СТРОГО валидным JSON-объектом по описанной структуре, без пояснений и без markdown-разметки (без \`\`\`).`,
                    },
                    { role: "user", content: userText },
                ],
            }),
        },
        timeoutMs,
        "CLOUDFLARE"
    );

    await failOnHttpError(res, "CLOUDFLARE");

    const data = await res.json().catch(() => null);

    if (!data?.success) {
        throw new AiCallError("http", `CLOUDFLARE: success=false ${shortBody(data?.errors ?? "")}`, { retryable: false });
    }

    const raw = data.result?.response;
    if (!raw) throw new AiCallError("empty", "CLOUDFLARE: пустой ответ", { retryable: true });

    return parseModelJson(raw);
}

function buildProviders(cfg) {
    const providers = [];

    if (cfg.anthropic.key) {
        providers.push({ name: "anthropic", call: (input, t) => callAnthropic(cfg, input, t) });
    }

    if (cfg.gemini.key) {
        providers.push({ name: "gemini", call: (input, t) => callGemini(cfg, input, t) });
    }

    const openAiLike = [
        ["groq", "https://api.groq.com/openai/v1", cfg.groq, {}],
        ["openrouter", "https://openrouter.ai/api/v1", cfg.openrouter, {
            "HTTP-Referer": "https://urbankey.uz",
            "X-Title": "UrbanKey listing parser",
        }],
        ["mistral", "https://api.mistral.ai/v1", cfg.mistral, {}],
        ["sambanova", "https://api.sambanova.ai/v1", cfg.sambanova, {}],
    ];

    for (const [providerName, baseUrl, conf, extraHeaders] of openAiLike) {
        if (!conf.key) continue;
        providers.push({
            name: providerName,
            call: (input, t) => callOpenAICompatible({
                providerName,
                baseUrl,
                apiKey: conf.key,
                model: conf.model,
                systemPrompt: input.systemPrompt,
                userText: input.userText,
                extraHeaders,
            }, t),
        });
    }

    if (cfg.cloudflare.accountId && cfg.cloudflare.token) {
        providers.push({ name: "cloudflare", call: (input, t) => callCloudflare(cfg, input, t) });
    }

    return providers;
}

export function isGeminiConfigured() {
    return Boolean(process.env.GEMINI_API_KEY);
}

// Список имён настроенных провайдеров (без ключей) — для логов.
export function configuredProviders() {
    return buildProviders(readConfig()).map((p) => p.name);
}

// Публичная функция цепочки.
//
//   validate(raw) -> { ok: true, value } | { ok: false, reason }
//     Проверка по смыслу/схеме. Если не передана — принимается любой JSON-объект
//     (старое поведение, нужно только для обратной совместимости).
//
// Возвращает { ok, provider, data, attempts }:
//   data     — value из validate (или сырой объект), если ok;
//   attempts — журнал попыток [{ provider, attempt, outcome, class, reason, status, ms }].
//   skipProviders — имена провайдеров, которые для ЭТОГО вызова пропускаем
//     (например, ai-search не тратит платный Anthropic на каждый поисковый запрос).
export async function runListingAiChain({
    systemPrompt,
    geminiResponseSchema,
    jsonSchema,
    userText,
    validate,
    maxAttempts,
    budgetMs,
    skipProviders = [],
    retryDelaysMs = readRetryDelays(),
}) {
    const cfg = readConfig();
    const providers = buildProviders(cfg).filter((p) => !skipProviders.includes(p.name));
    const attemptsLog = [];
    const startedAt = Date.now();
    const totalBudget = budgetMs ?? cfg.budgetMs;
    const perProviderAttempts = Math.min(3, Math.max(1, maxAttempts ?? cfg.maxAttempts));

    const remaining = () => totalBudget - (Date.now() - startedAt);

    if (providers.length === 0) {
        logEvent("AI_CHAIN", { ok: false, reason: "no_providers_configured" });
        return { ok: false, provider: null, data: null, attempts: attemptsLog };
    }

    const check = typeof validate === "function"
        ? validate
        : (raw) => (raw && typeof raw === "object" && !Array.isArray(raw)
            ? { ok: true, value: raw }
            : { ok: false, reason: "ответ не является JSON-объектом" });

    for (const provider of providers) {

        let feedback = "";

        for (let attempt = 1; attempt <= perProviderAttempts; attempt++) {

            if (remaining() <= 500) {
                logEvent("AI_CHAIN", { ok: false, reason: "budget_exhausted", budgetMs: totalBudget, elapsedMs: Date.now() - startedAt });
                return { ok: false, provider: null, data: null, attempts: attemptsLog };
            }

            const t0 = Date.now();
            const record = { provider: provider.name, attempt };

            try {
                const raw = await provider.call(
                    { systemPrompt, geminiResponseSchema, jsonSchema, userText: feedback ? `${userText}\n\n${feedback}` : userText },
                    Math.min(cfg.timeoutMs, remaining())
                );

                const verdict = check(raw);

                if (verdict.ok) {
                    Object.assign(record, { outcome: "ok", ms: Date.now() - t0 });
                    attemptsLog.push(record);
                    logEvent("AI_ATTEMPT", record);
                    logEvent("AI_CHAIN", { ok: true, provider: provider.name, attempts: attemptsLog.length, totalMs: Date.now() - startedAt });
                    return { ok: true, provider: provider.name, data: verdict.value, attempts: attemptsLog };
                }

                // JSON валиден, но не прошёл проверку по смыслу
                Object.assign(record, {
                    outcome: "validation_error",
                    class: ErrorClass.VALIDATION,
                    reason: redactSecrets(String(verdict.reason || "не прошёл валидацию")),
                    ms: Date.now() - t0,
                });
                attemptsLog.push(record);
                logEvent("AI_ATTEMPT", record);

                feedback = `ПРОВЕРКА ПРЕДЫДУЩЕГО ОТВЕТА: ${record.reason}. Верни корректный JSON строго по схеме; значения бери только из текста выше, неизвестное — null.`;
                continue;

            } catch (e) {

                const err = e instanceof AiCallError ? e : new AiCallError("network", redactSecrets(e?.message || e), { retryable: false });

                Object.assign(record, {
                    outcome: err.kind === "json" ? "parse_error" : "model_error",
                    class: classOfCallError(err),
                    kind: err.kind,
                    status: err.status,
                    reason: redactSecrets(err.message).slice(0, 300),
                    ms: Date.now() - t0,
                });
                attemptsLog.push(record);
                logEvent("AI_ATTEMPT", record);

                // постоянная ошибка (401/403/400/404...) — повторять бессмысленно
                if (!err.retryable) break;

                if (err.kind === "json") {
                    feedback = "ПРОВЕРКА ПРЕДЫДУЩЕГО ОТВЕТА: ответ не был валидным JSON. Верни ТОЛЬКО один JSON-объект по схеме, без пояснений и markdown.";
                }

                if (attempt < perProviderAttempts) {
                    const delay = retryDelaysMs[Math.min(attempt - 1, retryDelaysMs.length - 1)] ?? 0;
                    if (delay > 0 && remaining() > delay + 500) await sleep(delay);
                }
            }
        }
    }

    logEvent("AI_CHAIN", {
        ok: false,
        reason: "all_providers_failed",
        providers: providers.map((p) => p.name),
        attempts: attemptsLog.length,
        totalMs: Date.now() - startedAt,
    });

    return { ok: false, provider: null, data: null, attempts: attemptsLog };
}
