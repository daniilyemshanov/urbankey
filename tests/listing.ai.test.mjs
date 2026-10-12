// Цепочка ИИ-провайдеров, проверка ответа модели, слияние с регулярным
// разбором и резервный путь. fetch подменён — ни сети, ни ключей не нужно.

import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";

import { runListingAiChain, configuredProviders } from "../api/aiProviders.js";
import { getParsedListing, validateAiListing, buildParsedFromAi, parseListing } from "../api/listingParser.js";
import { redactSecrets } from "../api/_aiLog.js";

const realFetch = globalThis.fetch;
const realLog = console.log;

const ENV_KEYS = [
    "GEMINI_API_KEY", "GROQ_API_KEY", "OPENROUTER_API_KEY", "MISTRAL_API_KEY",
    "SAMBANOVA_API_KEY", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN",
    "AI_RETRY_DELAYS_MS", "AI_TOTAL_BUDGET_MS", "AI_MAX_ATTEMPTS", "AI_TIMEOUT_MS",
];

const FAKE_GEMINI_KEY = "AIzaSyFAKE_KEY_FOR_TESTS_0123456789abcd";
const FAKE_GROQ_KEY = "gsk_FAKEGROQKEYFORTESTS0123456789abcd";

let script;   // { gemini: [...], groq: [...] } — очередь ответов на каждого провайдера
let calls;    // журнал запросов { provider, url, headers, body }
let logs;     // перехваченные console.log

const providerOf = (url) => (url.includes("googleapis") ? "gemini" : url.includes("groq.com") ? "groq" : "other");

const geminiOk = (obj) => ({ status: 200, body: { candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] }, finishReason: "STOP" }] } });
const geminiText = (text) => ({ status: 200, body: { candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }] } });
const openaiOk = (obj) => ({ status: 200, body: { choices: [{ message: { content: JSON.stringify(obj) } }] } });

beforeEach(() => {
    for (const k of ENV_KEYS) delete process.env[k];
    process.env.AI_RETRY_DELAYS_MS = "0,0";
    script = { gemini: [], groq: [] };
    calls = [];
    logs = [];

    console.log = (...args) => { logs.push(args.join(" ")); };

    globalThis.fetch = async (url, init = {}) => {
        const provider = providerOf(String(url));
        calls.push({ provider, url: String(url), headers: init.headers || {}, body: init.body ? String(init.body) : "" });

        const step = script[provider]?.shift();
        if (step === undefined) throw new Error(`непредусмотренный запрос к ${provider}`);
        if (typeof step === "function") return step(init);
        if (step instanceof Error) throw step;

        return new Response(typeof step.body === "string" ? step.body : JSON.stringify(step.body), {
            status: step.status,
            headers: { "Content-Type": "application/json" },
        });
    };
});

after(() => {
    globalThis.fetch = realFetch;
    console.log = realLog;
});

const useGemini = () => { process.env.GEMINI_API_KEY = FAKE_GEMINI_KEY; };
const useGroq = () => { process.env.GROQ_API_KEY = FAKE_GROQ_KEY; };

const POST = [
    "Продам 2-комнатная квартира",
    "📍 Юнусабад, ул. Навои 12",
    "5/9 этаж, 68 м²",
    "С мебелью, балкон, лифт",
    "Цена: 85 000$",
    "Тел: +998 90 123 45 67",
].join("\n");

// Хороший ответ модели для POST
const goodAi = (over = {}) => ({
    title_ru: "2-комнатная квартира в Юнусабаде",
    title_en: "2-room apartment in Yunusabad",
    title_uz: "Yunusobodda 2 xonali kvartira",
    description_ru: "Двухкомнатная квартира площадью 68 м² на 5 этаже 9-этажного дома в Юнусабаде. Есть мебель, балкон и лифт.",
    description_en: "Two-room apartment of 68 sq.m on the 5th floor of a 9-storey building in Yunusabad. Furniture, balcony and elevator.",
    description_uz: "Yunusobodda 9 qavatli uyning 5-qavatida 68 kv.m 2 xonali kvartira. Mebel, balkon va lift bor.",
    price_raw: "85 000$",
    price_number: 85000,
    bedrooms: 2,
    bathrooms: null,
    area: 68,
    floor: 5,
    total_floors: 9,
    ceiling_height: null,
    type_ru: "Квартира",
    district: "Юнусабад",
    address: "ул. Навои 12",
    landmark: null,
    is_commercial: false,
    is_rent: false,
    is_sold: false,
    amenities: [
        { ru: "Мебель", en: "Furniture", uz: "Mebel" },
        { ru: "Балкон", en: "Balcony", uz: "Balkon" },
        { ru: "Лифт", en: "Elevator", uz: "Lift" },
    ],
    ...over,
});

// ---- validateAiListing -------------------------------------------------------

test("validate: хороший ответ принимается и приводится к схеме", () => {
    const v = validateAiListing(goodAi(), POST, parseListing(POST));
    assert.equal(v.ok, true);
    assert.equal(v.value.bedrooms, 2);
    assert.equal(v.value.area, 68);
});

test("validate: не объект / массив / null / пустая структура отклоняются", () => {
    assert.equal(validateAiListing(null, POST).ok, false);
    assert.equal(validateAiListing([], POST).ok, false);
    assert.equal(validateAiListing("текст", POST).ok, false);
    assert.equal(validateAiListing(42, POST).ok, false);
    const empty = validateAiListing({}, POST);
    assert.equal(empty.ok, false);
    assert.match(empty.reason, /пуст/);
});

test("validate: все null/пусто при явных фактах в тексте — подозрительный ответ", () => {
    const v = validateAiListing({ title_ru: "Квартира", price_raw: null, bedrooms: null, area: null, floor: null, amenities: [] }, POST, parseListing(POST));
    assert.equal(v.ok, false);
    assert.match(v.reason, /не извлекла/);
});

test("validate: типы приводятся, диапазоны проверяются, мусор не ломает", () => {
    const v = validateAiListing(goodAi({ bedrooms: "2", area: "68,5", floor: "5/9", total_floors: null, bathrooms: 99, ceiling_height: 0.5, price_number: "abc" }), POST);
    assert.equal(v.ok, true);
    assert.equal(v.value.bedrooms, 2);
    assert.equal(v.value.area, 68.5);
    assert.equal(v.value.floor, 5);
    assert.equal(v.value.total_floors, 9);          // из "5/9"
    assert.equal(v.value.bathrooms, null);          // 99 санузлов — вне диапазона
    assert.equal(v.value.ceiling_height, null);
    assert.equal(v.value.price_number, null);
    assert.ok(v.issues.length >= 3);
});

test("validate: русские поля на английском при русском посте — отклоняются", () => {
    const v = validateAiListing(goodAi({ title_ru: "Two room apartment in Yunusabad", description_ru: "Two room apartment with furniture and balcony in Yunusabad district" }), POST);
    assert.equal(v.ok, false);
    assert.match(v.reason, /не на русском/);
});

// ---- цепочка: повторы и переход между провайдерами ----------------------------

test("пустой ответ Gemini -> повтор -> успех со второй попытки", async () => {
    useGemini();
    script.gemini = [{ status: 200, body: { candidates: [] } }, geminiOk(goodAi())];

    const chain = await runListingAiChain({
        systemPrompt: "x", geminiResponseSchema: {}, userText: POST,
        validate: (raw) => validateAiListing(raw, POST),
    });

    assert.equal(chain.ok, true);
    assert.equal(calls.length, 2);
    assert.deepEqual(chain.attempts.map((a) => a.outcome), ["model_error", "ok"]);
    assert.equal(chain.attempts[0].class, "model");
});

test("невалидный JSON -> повтор с подсказкой -> успех; класс ошибки = parse", async () => {
    useGemini();
    script.gemini = [geminiText("вот ваш JSON: {title_ru: 'без кавычек'"), geminiOk(goodAi())];

    const chain = await runListingAiChain({
        systemPrompt: "x", geminiResponseSchema: {}, userText: POST,
        validate: (raw) => validateAiListing(raw, POST),
    });

    assert.equal(chain.ok, true);
    assert.equal(chain.attempts[0].class, "parse");
    assert.match(calls[1].body, /не был валидным JSON/, "повторный запрос должен нести подсказку");
});

test("JSON не по смыслу ({}): повтор, затем следующий провайдер; класс = validation", async () => {
    useGemini(); useGroq();
    script.gemini = [geminiOk({}), geminiOk({})];
    script.groq = [openaiOk(goodAi())];

    const chain = await runListingAiChain({
        systemPrompt: "x", geminiResponseSchema: {}, userText: POST,
        validate: (raw) => validateAiListing(raw, POST),
    });

    assert.equal(chain.ok, true);
    assert.equal(chain.provider, "groq");
    assert.deepEqual(chain.attempts.map((a) => `${a.provider}:${a.outcome}`), ["gemini:validation_error", "gemini:validation_error", "groq:ok"]);
    assert.equal(chain.attempts[0].class, "validation");
});

test("раньше первый провайдер возвращался без проверки: теперь {} не останавливает цепочку", async () => {
    useGemini(); useGroq();
    script.gemini = [geminiOk({}), geminiOk({})];
    script.groq = [openaiOk(goodAi())];
    const chain = await runListingAiChain({ systemPrompt: "x", geminiResponseSchema: {}, userText: POST, validate: (raw) => validateAiListing(raw, POST) });
    assert.notEqual(chain.provider, "gemini");
});

test("постоянная ошибка (401) — без повторов, сразу следующий провайдер", async () => {
    useGemini(); useGroq();
    script.gemini = [{ status: 401, body: { error: { message: "API key not valid" } } }];
    script.groq = [openaiOk(goodAi())];

    const chain = await runListingAiChain({ systemPrompt: "x", geminiResponseSchema: {}, userText: POST, validate: (raw) => validateAiListing(raw, POST) });

    assert.equal(chain.ok, true);
    assert.equal(calls.filter((c) => c.provider === "gemini").length, 1, "401 не повторяется");
    assert.equal(chain.provider, "groq");
});

test("временная ошибка (503) повторяется ограниченно, потом следующий провайдер", async () => {
    useGemini(); useGroq();
    script.gemini = [{ status: 503, body: "busy" }, { status: 503, body: "busy" }];
    script.groq = [openaiOk(goodAi())];

    const chain = await runListingAiChain({ systemPrompt: "x", geminiResponseSchema: {}, userText: POST, validate: (raw) => validateAiListing(raw, POST) });

    assert.equal(chain.provider, "groq");
    assert.equal(calls.filter((c) => c.provider === "gemini").length, 2, "не больше AI_MAX_ATTEMPTS (2) попыток на провайдера");
});

test("все провайдеры дали мусор: конечное число попыток, ok=false, без зависания", async () => {
    useGemini(); useGroq();
    script.gemini = [geminiOk([]), geminiOk("строка")];
    script.groq = [openaiOk({}), openaiOk({ x: 1 })];

    const chain = await runListingAiChain({ systemPrompt: "x", geminiResponseSchema: {}, userText: POST, validate: (raw) => validateAiListing(raw, POST) });

    assert.equal(chain.ok, false);
    assert.ok(calls.length <= 4, `попыток: ${calls.length}`);
    assert.ok(logs.some((l) => l.startsWith("AI_CHAIN") && l.includes("all_providers_failed")));
});

test("AI_MAX_ATTEMPTS ограничивает число попыток (верхняя граница 3)", async () => {
    useGemini();
    process.env.AI_MAX_ATTEMPTS = "50";
    script.gemini = Array.from({ length: 10 }, () => geminiOk({}));

    await runListingAiChain({ systemPrompt: "x", geminiResponseSchema: {}, userText: POST, validate: (raw) => validateAiListing(raw, POST) });

    assert.equal(calls.length, 3);
});

test("общий бюджет времени: цепочка останавливается, а не ждёт всех провайдеров", async () => {
    useGemini(); useGroq();
    process.env.AI_TOTAL_BUDGET_MS = "600";
    script.gemini = [(init) => new Promise((resolve, reject) => init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))))];
    script.groq = [openaiOk(goodAi())];

    const keepAlive = setInterval(() => {}, 50);
    const t0 = Date.now();
    const chain = await runListingAiChain({ systemPrompt: "x", geminiResponseSchema: {}, userText: POST, validate: (raw) => validateAiListing(raw, POST) });
    clearInterval(keepAlive);

    assert.equal(chain.ok, false);
    assert.ok(Date.now() - t0 < 3000, `ушло ${Date.now() - t0} мс`);
    assert.ok(logs.some((l) => l.includes("budget_exhausted")));
});

test("без настроенных провайдеров: ok=false сразу, без запросов", async () => {
    const chain = await runListingAiChain({ systemPrompt: "x", geminiResponseSchema: {}, userText: POST });
    assert.equal(chain.ok, false);
    assert.equal(calls.length, 0);
    assert.deepEqual(configuredProviders(), []);
});

// ---- секреты --------------------------------------------------------------------

test("секреты не попадают в логи; ключ Gemini передаётся заголовком, а не в URL", async () => {
    useGemini(); useGroq();
    // ошибка с ключом внутри текста, тело ответа с ключом, сетевая ошибка с URL и ключом
    script.gemini = [
        { status: 400, body: `{"error":"bad request for key=${FAKE_GEMINI_KEY}"}` },
    ];
    script.groq = [
        new Error(`connect ECONNREFUSED https://api.groq.com/?api_key=${FAKE_GROQ_KEY} Authorization: Bearer ${FAKE_GROQ_KEY}`),
        new Error(`again ${FAKE_GROQ_KEY}`),
    ];

    await runListingAiChain({ systemPrompt: "x", geminiResponseSchema: {}, userText: POST, validate: (raw) => validateAiListing(raw, POST) });

    const all = logs.join("\n");
    assert.ok(all.length > 0, "логи должны быть");
    assert.ok(!all.includes(FAKE_GEMINI_KEY), "ключ Gemini в логе");
    assert.ok(!all.includes(FAKE_GROQ_KEY), "ключ Groq в логе");

    const geminiCall = calls.find((c) => c.provider === "gemini");
    assert.ok(!geminiCall.url.includes("key="), "ключ не должен быть в URL");
    assert.equal(geminiCall.headers["x-goog-api-key"], FAKE_GEMINI_KEY);
});

test("redactSecrets маскирует типичные форматы", () => {
    process.env.GROQ_API_KEY = "gsk_SECRET_VALUE_0123456789";
    const out = redactSecrets("url https://x?key=abc123def456&a=1 header Bearer abcdefghijklmnop token bot123456789:AAAAAAAAAAAAAAAAAAAAAAAAAAAAA env gsk_SECRET_VALUE_0123456789");
    assert.ok(!/abc123def456|abcdefghijklmnop|AAAAAAAAAAAA|SECRET_VALUE/.test(out), out);
});

// ---- слияние: проверка чисел и описания ----------------------------------------

test("\"двухкомнатная\": число слова принимается (раньше терялось)", () => {
    const text = "Продам двухкомнатная квартира, 68 м², цена 85 000$";
    const v = validateAiListing(goodAi({ floor: null, total_floors: null }), text, parseListing(text));
    const p = buildParsedFromAi(v.value, parseListing(text), text);
    assert.equal(p.bedrooms, "2");
    assert.ok(!p.diagnostics.rejected.some((r) => r.field === "bedrooms"));
});

test("выдуманные моделью числа отбрасываются; найденное регуляркой подставляется", () => {
    const text = "Продам 2-комнатная квартира 68 м², 5/9 этаж, 85 000$";
    const v = validateAiListing(goodAi({ area: 120, floor: 7, total_floors: 12, price_raw: "99 000$", bathrooms: 3 }), text, parseListing(text));
    const p = buildParsedFromAi(v.value, parseListing(text), text);

    assert.equal(p.area, "68", "площадь 120 нет в тексте");
    assert.equal(p.floor, "5");
    assert.equal(p.totalFloors, "9");
    assert.equal(p.price, "85 000$", "цену 99 000$ модель выдумала");
    assert.equal(p.bathrooms, "", "санузлов в тексте нет — не выдумываем");

    const rejected = p.diagnostics.rejected.map((r) => r.field);
    assert.ok(rejected.includes("area") && rejected.includes("price") && rejected.includes("bathrooms"));
    assert.ok(p.diagnostics.filledFromRegex.includes("area"));
});

test("преимущества: только подтверждённые текстом; \"без мебели\" не превращается в \"Мебель\"", () => {
    const text = "Продам 2-комнатная квартира, 68 м², без мебели, есть лифт. 85 000$";
    const ai = goodAi({
        amenities: [
            { ru: "Мебель", en: "Furniture", uz: "Mebel" },
            { ru: "Бассейн", en: "Pool", uz: "Basseyn" },
            { ru: "Лифт", en: "Elevator", uz: "Lift" },
        ],
    });
    const v = validateAiListing(ai, text, parseListing(text));
    const p = buildParsedFromAi(v.value, parseListing(text), text);
    const names = p.amenities.map((a) => a.ru);

    assert.deepEqual(names, ["Лифт"]);
});

test("описание с выдуманными числами заменяется описанием из фактов", () => {
    const text = "Продам 2-комнатная квартира, 68 м², 85 000$";
    const ai = goodAi({ description_ru: "Квартира площадью 120 м² с видом на горы, построена в 2019 году." });
    const v = validateAiListing(ai, text, parseListing(text));
    const p = buildParsedFromAi(v.value, parseListing(text), text);

    assert.ok(!/120|2019/.test(p.description_ru));
    assert.ok(p.description_ru.length > 10);
    assert.ok(p.diagnostics.warnings.some((w) => w.startsWith("description_replaced")));
});

test("пустое описание от модели не остаётся пустым, если факты есть", () => {
    const text = "Продам 2-комнатная квартира, 68 м², 5/9 этаж, 85 000$";
    const v = validateAiListing(goodAi({ description_ru: "", description_en: "", description_uz: "" }), text, parseListing(text));
    const p = buildParsedFromAi(v.value, parseListing(text), text);
    assert.ok(p.description_ru.length > 10);
    assert.ok(p.about_ru.includes("Этаж 5 из 9"));
});

test("en/uz с русским текстом очищаются (будут переведены), а не сохраняются как есть", () => {
    const text = POST;
    const ai = goodAi({ description_en: "Двухкомнатная квартира в Юнусабаде", title_uz: "2-комнатная квартира" });
    const v = validateAiListing(ai, text, parseListing(text));
    const p = buildParsedFromAi(v.value, parseListing(text), text);
    assert.equal(p.description_en, "");
    assert.equal(p.title_uz, "");
});

test("\"продано\" одной оценкой модели не блокирует публикацию", () => {
    const text = POST;
    const v = validateAiListing(goodAi({ is_sold: true }), text, parseListing(text));
    const p = buildParsedFromAi(v.value, parseListing(text), text);
    assert.equal(p.isSold, false);
    assert.ok(p.diagnostics.rejected.some((r) => r.field === "is_sold"));

    const sold = "ПРОДАНО! 2-комнатная квартира";
    const v2 = validateAiListing(goodAi({ is_sold: true }), sold, parseListing(sold));
    assert.equal(buildParsedFromAi(v2.value, parseListing(sold), sold).isSold, true);
});

test("явные слова \"сдам\" главнее оценки модели", () => {
    const text = "Сдам 2-комнатная квартира, 68 м², 500$";
    const v = validateAiListing(goodAi({ is_rent: false, price_raw: "500$", price_number: 500 }), text, parseListing(text));
    assert.equal(buildParsedFromAi(v.value, parseListing(text), text).isRent, true);
});

// ---- getParsedListing целиком ----------------------------------------------------

test("getParsedListing: успех ИИ -> диагностика с провайдером и числом попыток", async () => {
    useGemini();
    script.gemini = [geminiOk(goodAi())];

    const p = await getParsedListing(POST);

    assert.equal(p.bedrooms, "2");
    assert.equal(p.floor, "5");
    assert.equal(p.totalFloors, "9");
    assert.equal(p.diagnostics.provider, "gemini");
    assert.ok(["ai", "ai+regex"].includes(p.diagnostics.source));
    assert.ok(logs.some((l) => l.startsWith("LISTING_PARSE") && l.includes('"provider":"gemini"')));
    // форма результата, которую читают webhook/finalize/bot
    assert.ok(p.type.ru && typeof p.locationLine === "string" && p.commercialFields);
    assert.ok(!logs.join("\n").includes("998 90 123"), "телефон из поста не должен попасть в лог");
});

test("getParsedListing: ИИ недоступен — объявление не теряется, текст и факты сохранены", async () => {
    useGemini(); useGroq();
    script.gemini = [{ status: 500, body: "x" }, { status: 500, body: "x" }];
    script.groq = [{ status: 500, body: "x" }, { status: 500, body: "x" }];

    const p = await getParsedListing(POST);

    assert.equal(p.diagnostics.source, "regex");
    assert.ok(p.diagnostics.warnings.includes("fallback_to_regex"));
    assert.equal(p.diagnostics.errors[0].class, "model");
    assert.equal(p.price, "85 000$");
    assert.equal(p.bedrooms, "2");
    assert.equal(p.floor, "5");
    assert.ok(p.description_ru.length > 20);
    assert.ok(!/998/.test(p.description_ru));
});

test("getParsedListing: ИИ вернул мусор на всех попытках — резервный разбор", async () => {
    useGemini();
    script.gemini = [geminiText("не json"), geminiText("[1,2,3]")];

    const p = await getParsedListing(POST);

    assert.equal(p.diagnostics.source, "regex");
    assert.equal(p.price, "85 000$");
    assert.ok(p.diagnostics.attempts.length >= 2);
});

test("getParsedListing: ИИ не настроен — регулярный разбор без запросов", async () => {
    const p = await getParsedListing(POST);
    assert.equal(calls.length, 0);
    assert.ok(p.diagnostics.warnings.includes("ai_not_configured"));
    assert.equal(p.price, "85 000$");
});

test("getParsedListing: отсутствующие характеристики остаются пустыми (никаких подстановок)", async () => {
    useGemini();
    const text = "Продам квартиру в центре";
    script.gemini = [geminiOk({
        title_ru: "Квартира в центре", title_en: "", title_uz: "", description_ru: "Квартира в центре города.",
        description_en: "", description_uz: "", price_raw: null, price_number: null, bedrooms: null, bathrooms: null,
        area: null, floor: null, total_floors: null, ceiling_height: null, type_ru: "Квартира",
        district: null, address: null, landmark: null, is_commercial: false, is_rent: false, is_sold: false, amenities: [],
    })];

    const p = await getParsedListing(text);

    assert.equal(p.price, "");
    assert.equal(p.priceNumber, null);
    assert.equal(p.bedrooms, "");
    assert.equal(p.area, "");
    assert.equal(p.floor, "");
    assert.deepEqual(p.amenities, []);
});

test("getParsedListing не бросает даже при странных входах", async () => {
    useGemini();
    for (const input of ["", null, undefined, "   ", "😀😀😀"]) {
        script.gemini = [geminiOk(goodAi()), geminiOk(goodAi())];
        const p = await getParsedListing(input);
        assert.ok(p.type && p.title_ru !== undefined, JSON.stringify(input));
    }
});
