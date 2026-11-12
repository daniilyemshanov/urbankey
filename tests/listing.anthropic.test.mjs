import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";

import { runListingAiChain, configuredProviders } from "../api/aiProviders.js";
import { getParsedListing, validateAiListing } from "../api/listingParser.js";
import aiSearch from "../api/ai-search.js";

const realFetch = globalThis.fetch;
const realLog = console.log;

const ENV_KEYS = [
    "ANTHROPIC_API_KEY", "ANTHROPIC_MODEL",
    "GEMINI_API_KEY", "GROQ_API_KEY", "OPENROUTER_API_KEY", "MISTRAL_API_KEY",
    "SAMBANOVA_API_KEY", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN",
    "AI_RETRY_DELAYS_MS", "AI_TOTAL_BUDGET_MS", "AI_MAX_ATTEMPTS", "AI_TIMEOUT_MS",
];

const FAKE_ANTHROPIC_KEY = "sk-ant-api03-FAKE_KEY_FOR_TESTS_0123456789abcdefghij";
const FAKE_GEMINI_KEY = "AIzaSyFAKE_KEY_FOR_TESTS_0123456789abcd";

let script;
let calls;
let logs;

const providerOf = (url) =>
    url.includes("anthropic.com") ? "anthropic" : url.includes("googleapis") ? "gemini" : "other";

const anthropicTool = (obj, extra = {}) => ({
    status: 200,
    body: {
        id: "msg_test", type: "message", role: "assistant",
        content: [{ type: "tool_use", id: "toolu_test", name: "save_listing", input: obj }],
        stop_reason: "tool_use",
        ...extra,
    },
});
const anthropicText = (text, extra = {}) => ({
    status: 200,
    body: { type: "message", role: "assistant", content: [{ type: "text", text }], stop_reason: "end_turn", ...extra },
});
const geminiOk = (obj) => ({ status: 200, body: { candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] }, finishReason: "STOP" }] } });

beforeEach(() => {
    for (const k of ENV_KEYS) delete process.env[k];
    process.env.AI_RETRY_DELAYS_MS = "0,0";
    script = { anthropic: [], gemini: [] };
    calls = [];
    logs = [];

    console.log = (...args) => { logs.push(args.join(" ")); };

    globalThis.fetch = async (url, init = {}) => {
        const provider = providerOf(String(url));
        calls.push({
            provider, url: String(url), headers: init.headers || {},
            body: init.body ? String(init.body) : "",
        });

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

const useAnthropic = () => { process.env.ANTHROPIC_API_KEY = FAKE_ANTHROPIC_KEY; };
const useGemini = () => { process.env.GEMINI_API_KEY = FAKE_GEMINI_KEY; };

const hang = (init) => new Promise((_, reject) => {
    init.signal?.addEventListener("abort", () => {
        const e = new Error("aborted");
        e.name = "AbortError";
        reject(e);
    });
});

const POST = [
    "Продам 2-комнатная квартира",
    "📍 Юнусабад, ул. Навои 12",
    "5/9 этаж, 68 м²",
    "С мебелью, балкон, лифт",
    "Цена: 85 000$",
    "Тел: +998 90 123 45 67",
].join("\n");

const goodAi = (over = {}) => ({
    title_ru: "2-комнатная квартира в Юнусабаде",
    title_en: "2-room apartment in Yunusabad",
    title_uz: "Yunusobodda 2 xonali kvartira",
    description_ru: "Двухкомнатная квартира площадью 68 м² на 5 этаже 9-этажного дома в Юнусабаде. Есть мебель, балкон и лифт.",
    description_en: "Two-room apartment of 68 sq.m on the 5th floor of a 9-storey building in Yunusabad. Furniture, balcony and elevator.",
    description_uz: "Yunusobodda 9 qavatli uyning 5-qavatida 68 kv.m 2 xonali kvartira. Mebel, balkon va lift bor.",
    price_raw: "85 000$",
    price_number: 85000,
    bedrooms: 2, bathrooms: null, area: 68, floor: 5, total_floors: 9, ceiling_height: null,
    type_ru: "Квартира", district: "Юнусабад", address: "ул. Навои 12", landmark: null,
    is_commercial: false, is_rent: false, is_sold: false,
    amenities: [
        { ru: "Мебель", en: "Furniture", uz: "Mebel" },
        { ru: "Балкон", en: "Balcony", uz: "Balkon" },
        { ru: "Лифт", en: "Elevator", uz: "Lift" },
    ],
    ...over,
});

const runChain = (extra = {}) => runListingAiChain({
    systemPrompt: "x",
    jsonSchema: { type: "object", properties: { title_ru: { type: "string" } } },
    geminiResponseSchema: {},
    userText: POST,
    validate: (raw) => validateAiListing(raw, POST),
    ...extra,
});

test("anthropic: корректный ответ принимается; запрос соответствует Messages API", async () => {
    useAnthropic();
    script.anthropic = [anthropicTool(goodAi())];

    const chain = await runChain();

    assert.equal(chain.ok, true);
    assert.equal(chain.provider, "anthropic");
    assert.equal(chain.data.bedrooms, 2);
    assert.equal(calls.length, 1);

    const [call] = calls;
    assert.equal(call.url, "https://api.anthropic.com/v1/messages");
    assert.equal(call.headers["x-api-key"], FAKE_ANTHROPIC_KEY);
    assert.equal(call.headers["anthropic-version"], "2023-06-01");
    assert.ok(!call.url.includes(FAKE_ANTHROPIC_KEY), "ключ не должен быть в URL");

    const body = JSON.parse(call.body);
    assert.ok(body.max_tokens > 0);
    assert.equal(body.messages[0].role, "user");
    assert.equal(body.messages[0].content, POST);
    assert.equal(body.tools[0].name, "save_listing");
    assert.deepEqual(body.tool_choice, { type: "tool", name: "save_listing" });
    assert.equal(body.tools[0].input_schema.type, "object");
});

test("anthropic: название модели берётся из ANTHROPIC_MODEL, запасное значение — Haiku", async () => {
    useAnthropic();

    script.anthropic = [anthropicTool(goodAi())];
    await runChain();
    assert.equal(JSON.parse(calls[0].body).model, "claude-haiku-5-5");

    process.env.ANTHROPIC_MODEL = "claude-test-model-from-env";
    script.anthropic = [anthropicTool(goodAi())];
    await runChain();
    assert.equal(JSON.parse(calls[1].body).model, "claude-test-model-from-env");
});

test("anthropic: без jsonSchema ответ-текст с JSON (в ```-фенсе) тоже разбирается", async () => {
    useAnthropic();
    script.anthropic = [anthropicText("```json\n" + JSON.stringify(goodAi()) + "\n```")];

    const chain = await runChain({ jsonSchema: undefined });

    assert.equal(chain.ok, true);
    const body = JSON.parse(calls[0].body);
    assert.equal(body.tools, undefined, "без схемы инструмент не передаётся");
    assert.match(body.system, /валидным JSON-объектом/);
});

test("порядок: Anthropic первый, затем остальные; без ключа Anthropic его нет в списке", () => {
    useAnthropic(); useGemini();
    process.env.GROQ_API_KEY = "gsk_FAKEGROQKEYFORTESTS0123456789abcd";
    assert.deepEqual(configuredProviders(), ["anthropic", "gemini", "groq"]);

    delete process.env.ANTHROPIC_API_KEY;
    assert.deepEqual(configuredProviders(), ["gemini", "groq"]);
});

test("без ANTHROPIC_API_KEY запросов к Anthropic нет, цепочка работает как раньше", async () => {
    useGemini();
    script.gemini = [geminiOk(goodAi())];

    const chain = await runChain();

    assert.equal(chain.ok, true);
    assert.equal(chain.provider, "gemini");
    assert.ok(calls.every((c) => c.provider === "gemini"));
});

test("fallback: Anthropic 500 дважды -> Gemini; число попыток ограничено", async () => {
    useAnthropic(); useGemini();
    script.anthropic = [{ status: 500, body: "boom" }, { status: 500, body: "boom" }];
    script.gemini = [geminiOk(goodAi())];

    const chain = await runChain();

    assert.equal(chain.ok, true);
    assert.equal(chain.provider, "gemini");
    assert.deepEqual(chain.attempts.map((a) => `${a.provider}:${a.outcome}`), ["anthropic:model_error", "anthropic:model_error", "gemini:ok"]);
    assert.equal(calls.filter((c) => c.provider === "anthropic").length, 2);
});

test("fallback: 401 (неверный ключ) — без повторов, сразу Gemini", async () => {
    useAnthropic(); useGemini();
    script.anthropic = [{ status: 401, body: { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } } }];
    script.gemini = [geminiOk(goodAi())];

    const chain = await runChain();

    assert.equal(chain.provider, "gemini");
    assert.equal(calls.filter((c) => c.provider === "anthropic").length, 1);
});

test("529 (перегрузка Anthropic) повторяется, затем успех", async () => {
    useAnthropic();
    script.anthropic = [{ status: 529, body: { type: "error", error: { type: "overloaded_error", message: "Overloaded" } } }, anthropicTool(goodAi())];

    const chain = await runChain();

    assert.equal(chain.ok, true);
    assert.equal(chain.provider, "anthropic");
    assert.equal(calls.length, 2);
});

test("таймаут Anthropic: запрос прерывается, цепочка идёт к Gemini", async () => {
    useAnthropic(); useGemini();
    process.env.AI_TIMEOUT_MS = "60";
    process.env.AI_MAX_ATTEMPTS = "1";
    script.anthropic = [hang];
    script.gemini = [geminiOk(goodAi())];

    const t0 = Date.now();
    const chain = await runChain();

    assert.equal(chain.provider, "gemini");
    assert.equal(chain.attempts[0].kind, "timeout");
    assert.ok(Date.now() - t0 < 2000, "не должно ждать дольше таймаута");
});

test("общий лимит времени соблюдается и когда Anthropic висит", async () => {
    useAnthropic(); useGemini();
    process.env.AI_TIMEOUT_MS = "10000";
    process.env.AI_MAX_ATTEMPTS = "3";
    script.anthropic = [hang, hang, hang];
    script.gemini = [geminiOk(goodAi())];

    const t0 = Date.now();
    const chain = await runChain({ budgetMs: 700 });
    const elapsed = Date.now() - t0;

    assert.equal(chain.ok, false, "бюджет исчерпан раньше, чем дошли до Gemini");
    assert.ok(elapsed < 2500, `ушло ${elapsed} мс при бюджете 700 мс`);
    assert.ok(logs.some((l) => l.includes("budget_exhausted")));
});

test("пустой content -> повтор; затем успех", async () => {
    useAnthropic();
    script.anthropic = [{ status: 200, body: { content: [], stop_reason: "end_turn" } }, anthropicTool(goodAi())];

    const chain = await runChain();

    assert.equal(chain.ok, true);
    assert.equal(chain.attempts[0].kind, "empty");
    assert.equal(chain.attempts[0].class, "model");
});

test("невалидный JSON текстом -> повтор с подсказкой; класс ошибки = parse", async () => {
    useAnthropic();
    script.anthropic = [anthropicText("Вот данные: {title_ru: без кавычек"), anthropicTool(goodAi())];

    const chain = await runChain({ jsonSchema: undefined });

    assert.equal(chain.ok, true);
    assert.equal(chain.attempts[0].class, "parse");
    assert.match(calls[1].body, /не был валидным JSON/);
});

test("ответ обрезан (max_tokens) считается невалидным и повторяется", async () => {
    useAnthropic();
    script.anthropic = [anthropicTool({ title_ru: "обрез" }, { stop_reason: "max_tokens" }), anthropicTool(goodAi())];

    const chain = await runChain();

    assert.equal(chain.ok, true);
    assert.equal(chain.attempts[0].outcome, "parse_error");
});

test("tool_use.input не объект -> ошибка разбора, не падение", async () => {
    useAnthropic(); useGemini();
    script.anthropic = [anthropicTool("строка вместо объекта"), anthropicTool([1, 2])];
    script.gemini = [geminiOk(goodAi())];

    const chain = await runChain();

    assert.equal(chain.provider, "gemini");
    assert.deepEqual(chain.attempts.slice(0, 2).map((a) => a.outcome), ["parse_error", "parse_error"]);
});

test("валидный JSON не по смыслу ({}): validation -> повтор -> следующий провайдер", async () => {
    useAnthropic(); useGemini();
    script.anthropic = [anthropicTool({}), anthropicTool({})];
    script.gemini = [geminiOk(goodAi())];

    const chain = await runChain();

    assert.equal(chain.provider, "gemini");
    assert.equal(chain.attempts[0].class, "validation");
});

test("ключ Anthropic не попадает в логи, даже если провайдер вернул его в теле ошибки", async () => {
    useAnthropic();
    script.anthropic = [{ status: 400, body: `{"error":"bad request for x-api-key ${FAKE_ANTHROPIC_KEY}"}` }];

    await runChain();

    const all = logs.join("\n");
    assert.ok(!all.includes(FAKE_ANTHROPIC_KEY), "ключ Anthropic в логе");
    assert.ok(all.includes("[REDACTED]"));
});

test("getParsedListing: Haiku успешно -> данные из ответа, провайдер anthropic в диагностике", async () => {
    useAnthropic();
    script.anthropic = [anthropicTool(goodAi())];

    const p = await getParsedListing(POST);

    assert.equal(p.diagnostics.provider, "anthropic");
    assert.equal(p.bedrooms, "2");
    assert.equal(p.floor, "5");
    assert.equal(p.totalFloors, "9");
    assert.equal(p.area, "68");
    assert.equal(p.currency, "USD");
    assert.ok(!logs.join("\n").includes("998 90 123"), "телефон из поста не должен попасть в лог");
});

test("getParsedListing: Haiku и Gemini недоступны — объявление не теряется (regex)", async () => {
    useAnthropic(); useGemini();
    script.anthropic = [{ status: 500, body: "x" }, { status: 500, body: "x" }];
    script.gemini = [{ status: 500, body: "x" }, { status: 500, body: "x" }];

    const p = await getParsedListing(POST);

    assert.equal(p.diagnostics.source, "regex");
    assert.ok(p.diagnostics.warnings.includes("fallback_to_regex"));
    assert.equal(p.price, "85 000$");
    assert.equal(p.bedrooms, "2");
    assert.ok(p.description_ru.length > 20);
});

test("getParsedListing: Haiku вернул мусор -> Gemini подхватывает", async () => {
    useAnthropic(); useGemini();
    script.anthropic = [anthropicText("не json"), anthropicText("[1,2,3]")];
    script.gemini = [geminiOk(goodAi())];

    const p = await getParsedListing(POST);

    assert.equal(p.diagnostics.provider, "gemini");
    assert.equal(p.bedrooms, "2");
});

test("пост с ценой в $ и в сумах: в базу идёт долларовая цена", async () => {
    const post = "Продам 3-комнатная квартира, Чиланзар, 75 м², 3/9 этаж\nЦена: 90 000$ (1 080 000 000 сум)";
    useAnthropic();
    script.anthropic = [anthropicTool(goodAi({
        title_ru: "3-комнатная квартира в Чиланзаре",
        description_ru: "Трёхкомнатная квартира площадью 75 м² на 3 этаже 9-этажного дома в Чиланзаре.",
        price_raw: "90 000$", price_number: 90000, bedrooms: 3, area: 75, floor: 3, total_floors: 9,
        district: "Чиланзар", address: null, amenities: [],
    }))];

    const p = await getParsedListing(post);

    assert.equal(p.currency, "USD");
    assert.equal(p.priceNumber, 90000);
    assert.equal(p.bedrooms, "3");
});

test("аренда в сумах: валюта UZS, is_rent, залог в описании не считается ценой", async () => {
    const post = "Сдам 2-комнатная квартира, Мирзо-Улугбек, 55 м², 4/9 этаж\nАренда: 4 500 000 сум в месяц, залог 4 500 000 сум, коммунальные отдельно";
    useAnthropic();
    script.anthropic = [anthropicTool(goodAi({
        title_ru: "2-комнатная квартира в аренду, Мирзо-Улугбек",
        description_ru: "Двухкомнатная квартира площадью 55 м² на 4 этаже 9-этажного дома. Условия: залог 4 500 000 сум, коммунальные платежи оплачиваются отдельно.",
        price_raw: "4 500 000 сум", price_number: 4500000, bedrooms: 2, area: 55, floor: 4, total_floors: 9,
        district: "Мирзо-Улугбек", address: null, is_rent: true, amenities: [],
    }))];

    const p = await getParsedListing(post);

    assert.equal(p.isRent, true);
    assert.equal(p.currency, "UZS");
    assert.match(p.description_ru, /залог/i, "условия аренды сохраняются в описании");
    assert.equal(p.diagnostics.provider, "anthropic");
});

test("выдуманная моделью цена, которой нет в тексте, отбрасывается", async () => {
    useAnthropic();
    script.anthropic = [anthropicTool(goodAi({ price_raw: "120 000$", price_number: 120000 }))];

    const p = await getParsedListing(POST);

    assert.equal(p.price, "85 000$", "берётся цена из текста, а не выдуманная");
    assert.ok(p.diagnostics.rejected.some((r) => r.field === "price"));
});

test("ai-search: Anthropic пропускается (публичный эндпоинт не расходует кредиты)", async () => {
    useAnthropic(); useGemini();
    script.gemini = [geminiOk({
        category: "residential", type: null, deal_type: "sale", min_price: null,
        max_price: 80000, min_bedrooms: 3, keywords: "",
    })];

    const res = {
        statusCode: 0, body: null, headers: {},
        setHeader(k, v) { this.headers[k] = v; return this; },
        status(c) { this.statusCode = c; return this; },
        json(b) { this.body = b; return this; },
    };

    await aiSearch({
        method: "POST", headers: { "x-forwarded-for": "203.0.113.77" },
        body: { query: "3-комнатная до 80000$", lang: "ru" },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.provider, "gemini");
    assert.equal(calls.filter((c) => c.provider === "anthropic").length, 0);
});
