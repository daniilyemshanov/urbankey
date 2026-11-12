import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const T = JSON.parse(fs.readFileSync(process.env.E2E_TOKENS || "./tokens.json"));
process.env.VITE_SUPABASE_URL = "http://localhost:3200";
process.env.VITE_SUPABASE_KEY = T.anon;
process.env.SUPABASE_SERVICE_KEY = T.service;
process.env.PARSER_BOT_TOKEN = "123456:FAKE_TELEGRAM_TOKEN_FOR_TESTS_ONLY_abcdef";
delete process.env.TELEGRAM_WEBHOOK_SECRET;
process.env.AI_RETRY_DELAYS_MS = "0,0";

const realFetch = globalThis.fetch;
const telegram = [];
let aiQueue = [];
globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes("api.telegram.org")) {
        telegram.push({ url: u.replace(process.env.PARSER_BOT_TOKEN, "<TOKEN>"), body: init?.body ? String(init.body) : "" });
        return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), { status: 200 });
    }
    if (u.includes("translate.googleapis.com")) return new Response(JSON.stringify([[["[tr]", "x"]]]), { status: 200 });
    if (u.includes("generativelanguage.googleapis.com")) {
        const next = aiQueue.shift();
        if (!next) return new Response("{}", { status: 500 });
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(next) }] }, finishReason: "STOP" }] }), { status: 200 });
    }
    return realFetch(url, init);
};

const logs = [];
const realLog = console.log;
console.log = (...a) => { logs.push(a.join(" ")); };

const webhook = (await import("../../api/telegram-webhook.js")).default;
const anon = createClient("http://localhost:3200", T.anon, { auth: { persistSession: false } });
const service = createClient("http://localhost:3200", T.service, { auth: { persistSession: false } });

let fail = 0;
const ok = (n, c, e = "") => { realLog((c ? "PASS " : "FAIL ") + n + (e ? "  " + e : "")); if (!c) fail++; };

async function send(update) {
    const res = { code: 0, headers: {}, setHeader() {}, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
    await webhook({ method: "POST", headers: {}, body: update }, res);
    return res;
}
const channelPost = (id, text) => ({ channel_post: { chat: { id: -1001234, title: "UrbanKey" }, message_id: id, date: 1, text } });
const editedPost = (id, text) => ({ edited_channel_post: { chat: { id: -1001234, title: "UrbanKey" }, message_id: id, date: 1, edit_date: 2, text } });
const cardByTg = async (id) => (await service.from("cardss").select("*").eq("tg_message_id", id).maybeSingle()).data;
const replies = () => telegram.map((t) => decodeURIComponent(t.body)).join("\n");

const FULL = "🔥 Продам 2-комнатная квартира\n📍 Юнусабад, ул. Навои 12\n5/9 этаж, 68 м², 2 санузла\nС мебелью, балкон, лифт. Без ремонта.\nЦена: 85 000$\nТел: +998 90 123 45 67";

delete process.env.GEMINI_API_KEY;
let r = await send(channelPost(501, FULL));
ok("webhook отвечает 200", r.code === 200);
let card = await cardByTg(501);
ok("новый пост создал карточку", !!card, JSON.stringify(card?.title_ru));
const { data: pub } = await anon.from("cardss_public").select("*").eq("id", card.id).maybeSingle();
ok("карточка СРАЗУ видна в публичном каталоге (публикация без модерации)", !!pub && pub.price === "85 000$");
ok("подписи комнат со склонением", pub.bedrooms_ru === "2 спальни" && pub.bathrooms_ru === "2 ванные");
ok("ссылка на страницу объекта проставлена", card.link === `/property/${card.id}`);
let { data: page } = await anon.from("villas").select("*").eq("card_id", card.id).maybeSingle();
ok("страница объекта создана и about_ru не пустой", !!page && /Этаж 5 из 9/.test(page.about_ru || ""));
ok("перевод about на en/uz выполнен до записи", page.about_en === "[tr]" && page.about_uz === "[tr]");
ok("бот ответил администратору без ошибки", telegram.length > 0 && !/❌/.test(replies()), replies().slice(0, 80).replace(/\n/g, " "));
ok("секреты (токен бота) не попали в логи", !logs.join("\n").includes("FAKE_TELEGRAM_TOKEN"));

await send(editedPost(501, "🔥 Продам 2-комнатная квартира\n5/9 этаж, 68 м²\nЦена: 90 000$"));
card = await cardByTg(501);
ok("правка поста обновила цену", card.price === "90 000$", card.price);
await send(editedPost(501, "🔥 Продам 2-комнатная квартира, обновлено\n5/9 этаж, 68 м²"));
card = await cardByTg(501);
ok("правка без цены НЕ стирает цену в базе", card.price === "90 000$", JSON.stringify(card.price));
ok("но заголовок обновился", /обновлено/.test(card.title_ru), card.title_ru);

process.env.GEMINI_API_KEY = "AIza_FAKE_E2E_KEY_0123456789abcdef";
aiQueue = [{
    title_ru: "3-комнатная квартира у метро", title_en: "3-room apartment near metro", title_uz: "Metro yaqinida 3 xonali kvartira",
    description_ru: "Трёхкомнатная квартира площадью 90 м² на 3 этаже. Есть балкон.",
    description_en: "Three-room apartment of 90 sq.m on the 3rd floor. Balcony.", description_uz: "3-qavatda 90 kv.m 3 xonali kvartira. Balkon bor.",
    price_raw: "120 000$", price_number: 120000, bedrooms: 3, bathrooms: null, area: 90, floor: 3, total_floors: null, ceiling_height: null,
    type_ru: "Квартира", district: null, address: null, landmark: null, is_commercial: false, is_rent: false, is_sold: false,
    amenities: [{ ru: "Балкон", en: "Balcony", uz: "Balkon" }, { ru: "Паркинг", en: "Parking", uz: "Parking" }],
}];
await send(channelPost(502, "Продам трёхкомнатная квартира у метро, 90 м², 3 этаж, балкон. 120 000$"));
card = await cardByTg(502);
ok("пост через ИИ сохранён", !!card && card.title_ru === "3-комнатная квартира у метро");
({ data: page } = await anon.from("villas").select("*").eq("card_id", card.id).maybeSingle());
const names = page.amenities.map((a) => a.ru);
ok("ИИ: выдуманный \"Паркинг\" отброшен, подтверждённые \"Балкон\" и \"Рядом метро\" (\"у метро\" в тексте) оставлены", !names.includes("Паркинг") && names.includes("Балкон") && names.includes("Рядом метро"), names.join(", "));
ok("ИИ: число из слова (\"трёхкомнатная\") сохранено", card.bedrooms_ru === "3 спальни");
ok("ИИ: цена и площадь на странице", Number(page.price) === 120000 && Number(page.square) === 90);

aiQueue = [];
await send(channelPost(503, "Продам 2-комнатная квартира\n5/9 этаж, 68 м²\nЦена: 85 000$"));
card = await cardByTg(503);
ok("ИИ недоступен: объявление всё равно опубликовано (резервный разбор)", !!card && card.price === "85 000$");
ok("в логе видно причину и класс ошибки", logs.some((l) => l.startsWith("LISTING_PARSE") && l.includes("fallback_to_regex")) && logs.some((l) => l.startsWith("AI_ATTEMPT") && l.includes('"class":"model"')));
delete process.env.GEMINI_API_KEY;

await send(channelPost(504, "ПРОДАНО! 2-комнатная квартира 85 000$"));
ok("пост \"ПРОДАНО\" не публикуется (как и раньше)", (await cardByTg(504)) === null);

const all = logs.join("\n");
ok("телефон из постов не попал в логи", !/998 ?90 ?123/.test(all));
ok("ключи не попали в логи", !all.includes("AIza_FAKE_E2E_KEY") && !all.includes("FAKE_TELEGRAM_TOKEN"));

realLog(fail ? `\n${fail} FAILED` : "\nВСЕ ПРОВЕРКИ WEBHOOK ПРОЙДЕНЫ");
process.exit(fail ? 1 : 0);
