import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const T = JSON.parse(fs.readFileSync(process.env.E2E_TOKENS || "./tokens.json"));
process.env.VITE_SUPABASE_URL = "http://localhost:3200";
process.env.VITE_SUPABASE_KEY = T.anon;
process.env.AI_RETRY_DELAYS_MS = "0,0";

const realFetch = globalThis.fetch;
let aiResponses = [];
globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes("translate.googleapis.com")) return new Response(JSON.stringify([[["[tr]", "x"]]]), { status: 200 });
    if (u.includes("generativelanguage.googleapis.com")) {
        const next = aiResponses.shift();
        if (!next) throw new Error("нет заготовленного ответа ИИ");
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(next) }] }, finishReason: "STOP" }] }), { status: 200 });
    }
    return realFetch(url, init);
};

const { parseListing, getParsedListing, fillMissingTranslations } = await import("../../api/listingParser.js");
const { buildCardRow, insertCardRow, savePage } = await import("../../api/_listingDb.js");
const sitemap = (await import("../../api/sitemap.js")).default;
const { parsePrice } = await import("../../src/utils/currency.js");
const { residentialFloorSlot } = await import("../../src/utils/floor.js");

const service = createClient("http://localhost:3200", T.service, { auth: { persistSession: false } });
const anon = createClient("http://localhost:3200", T.anon, { auth: { persistSession: false } });

let fail = 0;
const ok = (n, c, e = "") => { console.log((c ? "PASS " : "FAIL ") + n + (e ? "  " + e : "")); if (!c) fail++; };
const quiet = async (fn) => { const log = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = log; } };

async function saveLikeBot(parsed, n) {
    await quiet(() => fillMissingTranslations(parsed, ["title", "description", "about"]));
    const { table, row } = buildCardRow(parsed, { image: "https://x/y.webp", videoUrl: "", tgChatId: 100, tgMessageId: n });
    const { data, error, degraded } = await quiet(() => insertCardRow(service, table, row, { n }));
    if (error) return { error };
    const link = parsed.isCommercial ? `/commercial/${data.id}` : `/property/${data.id}`;
    await service.from(table).update({ link }).eq("id", data.id);
    const pageOk = await quiet(() => savePage(service, parsed.isCommercial ? "commercial_pages" : "villas", parsed.isCommercial ? "commercial_id" : "card_id", data.id, parsed, ["https://x/y.webp"], ""));
    return { id: data.id, table, pageOk, degraded };
}

const FULL = "🔥 Продам 2-комнатная квартира\n📍 Юнусабад, ул. Навои 12\n5/9 этаж, 68 м², 2 санузла\nС мебелью, балкон, лифт. Без ремонта.\nЦена: 85 000$\nТел: +998 90 123 45 67";

let r = await saveLikeBot(parseListing(FULL), 1);
ok("полный пост сохранён (карточка + страница)", r.id && r.pageOk && !r.degraded);

let { data: card } = await anon.from("cardss_public").select("*").eq("id", r.id).single();
ok("новая карточка сразу видна посетителю в публичном view", card && card.title_ru === "2-комнатная квартира", JSON.stringify(card?.title_ru));
ok("подписи комнат/санузлов со склонением", card.bedrooms_ru === "2 спальни" && card.bathrooms_ru === "2 ванные", `${card.bedrooms_ru} | ${card.bathrooms_ru}`);
ok("цена записана в каноничном виде", card.price === "85 000$");
const shown = parsePrice(card.price);
ok("сайт (parsePrice) показывает ту же сумму и валюту", shown.amount === 85000 && shown.currency === "USD", JSON.stringify(shown));
ok("телефон не попал в карточку", !/998/.test(JSON.stringify(card)));
ok("owner_phone не раскрывается через view", !("owner_phone" in card));

let { data: page } = await anon.from("villas").select("*").eq("card_id", r.id).single();
ok("страница объекта читается посетителем", !!page);
ok("about_ru не пустой и содержит этаж/этажность", page.about_ru && page.about_ru.includes("Этаж 5 из 9"), (page.about_ru || "").slice(0, 60));
ok("числовые поля страницы: цена, комнаты, площадь", Number(page.price) === 85000 && page.bedrooms === 2 && Number(page.square) === 68);
ok("преимущества сохранены как массив", Array.isArray(page.amenities) && page.amenities.some((a) => a.ru === "Мебель") && !page.amenities.some((a) => /ремонт/i.test(a.ru)));
ok("расположение переведено на en/uz", page.location_ru === "Юнусабад, ул. Навои 12" && page.location_en === "[tr]");
ok("about переведён на en/uz", page.about_en && page.about_uz);

r = await saveLikeBot(parseListing("Продам квартиру"), 2);
({ data: card } = await anon.from("cardss_public").select("*").eq("id", r.id).single());
({ data: page } = await anon.from("villas").select("*").eq("card_id", r.id).single());
ok("минимальный пост: карточка есть, пустые поля пустые (без заглушек)", card.price === "" && card.bedrooms_ru === "" && card.bathrooms_ru === "");
ok("минимальный пост: числа страницы null, а не 0", page.price === null && page.bedrooms === null && page.square === null);
ok("минимальный пост: описание не пустое и без выдуманных чисел", page.about_ru && !/\d/.test(page.about_ru));

r = await saveLikeBot(parseListing("Квартира 68 м²\n1400$ за 1м²"), 3);
({ data: card } = await anon.from("cardss_public").select("*").eq("id", r.id).single());
({ data: page } = await anon.from("villas").select("*").eq("card_id", r.id).single());
ok("цена за м² не записана как цена объекта", card.price === "" && page.price === null);
ok("но информация о ней не потеряна (about)", page.about_ru.includes("1 400$ за м²"));

r = await saveLikeBot(parseListing("Сдам 2-комнатную\nЦена: 5 000 000 сум/мес"), 4);
({ data: card } = await anon.from("cardss_public").select("*").eq("id", r.id).single());
({ data: page } = await anon.from("villas").select("*").eq("card_id", r.id).single());
const uz = parsePrice(card.price);
ok("аренда в сумах: валюта в карточке не подменена долларом", card.is_rent === true && uz.currency === "UZS" && uz.amount === 5000000, JSON.stringify(uz));
ok("аренда в сумах: число страницы не вводит сайт в заблуждение (null)", page.price === null);

r = await saveLikeBot(parseListing("Сдаётся офисное помещение\nЭтаж: 3\nПлощадь: 120 м²\nВысота потолков: 3,2\nЦена: 2 500$"), 5);
const { data: com } = await anon.from("commercials_public").select("*").eq("id", r.id).single();
const { data: cpage } = await anon.from("commercial_pages").select("*").eq("commercial_id", r.id).single();
ok("коммерция: карточка видна и поля на месте", com && Number(com.floor) === 3 && Number(com.area) === 120 && Number(com.ceiling) === 3.2 && com.class_ru === "Коммерция");
ok("коммерция: страница создана", cpage && cpage.floor === 3 && Number(cpage.area) === 120 && Number(cpage.ceiling_height) === 3.2);

aiResponses = [{
    title_ru: "2-комнатная квартира в Юнусабаде", title_en: "2-room apartment in Yunusabad", title_uz: "Yunusobodda 2 xonali kvartira",
    description_ru: "Двухкомнатная квартира площадью 68 м² на 5 этаже 9-этажного дома. Есть мебель и балкон.",
    description_en: "Two-room apartment of 68 sq.m on the 5th floor of a 9-storey building. Furniture and balcony.",
    description_uz: "9 qavatli uyning 5-qavatida 68 kv.m 2 xonali kvartira. Mebel va balkon bor.",
    price_raw: "85 000$", price_number: 85000, bedrooms: 2, bathrooms: 7 , area: 68, floor: 5, total_floors: 9, ceiling_height: null,
    type_ru: "Квартира", district: "Юнусабад", address: "ул. Навои 12", landmark: null, is_commercial: false, is_rent: false, is_sold: false,
    amenities: [{ ru: "Мебель", en: "Furniture", uz: "Mebel" }, { ru: "Бассейн", en: "Pool", uz: "Basseyn" }, { ru: "Балкон", en: "Balcony", uz: "Balkon" }],
}];
process.env.GEMINI_API_KEY = "AIza_FAKE_E2E_KEY_0123456789abcdef";
const aiParsed = await quiet(() => getParsedListing(FULL));
delete process.env.GEMINI_API_KEY;
ok("ИИ: источник и провайдер в диагностике", aiParsed.diagnostics.provider === "gemini" && aiParsed.diagnostics.source.startsWith("ai"));
ok("ИИ: выдуманные санузлы (7) и бассейн отброшены", aiParsed.bathrooms === "2" && !aiParsed.amenities.some((a) => a.ru === "Бассейн"), `bath=${aiParsed.bathrooms}`);
r = await saveLikeBot(aiParsed, 6);
({ data: card } = await anon.from("cardss_public").select("*").eq("id", r.id).single());
({ data: page } = await anon.from("villas").select("*").eq("card_id", r.id).single());
ok("ИИ: карточка и страница сохранены, описание из модели", card.description_ru.startsWith("Двухкомнатная") && page.about_ru.startsWith("Двухкомнатная"));

const res = { h: {}, status(c) { this.code = c; return this; }, setHeader() {}, send(b) { this.body = b; return this; } };
await quiet(() => sitemap({ headers: {} }, res));
const locs = [...res.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const inMap = (kind, id) => locs.includes(`https://urbankey.uz/ru/${kind}/${id}`);
const { data: cardsAll } = await anon.from("cardss_public").select("id,title_ru").order("id");
const ids = cardsAll.filter((c) => ["2-комнатная квартира", "2-комнатная квартира в Юнусабаде"].includes(c.title_ru)).map((c) => c.id);
ok("новые объявления из бота есть в sitemap (есть страница объекта)", ids.length >= 2 && ids.every((id) => inMap("property", id)));
ok("коммерция из бота есть в sitemap", inMap("commercial", r.id - 0) || locs.some((l) => /\/commercial\/\d+$/.test(l)));

const noPage = buildCardRow(parseListing("Продам 3-комнатную\nЦена: 90 000$"), { image: "", videoUrl: "", tgChatId: 100, tgMessageId: 7 });
const { data: np } = await service.from(noPage.table).insert(noPage.row).select("id").single();
const res2 = { ...res, body: "" };
await quiet(() => sitemap({ headers: {} }, res2));
ok("карточка без страницы остаётся в каталоге, но не попадает в sitemap", !res2.body.includes(`/property/${np.id}<`));

process.env.CARD_FLOOR_COLUMNS = "1";
r = await saveLikeBot(parseListing(FULL), 8);
ok("CARD_FLOOR_COLUMNS=1 без SQL: безопасный откат, объявление не потеряно", r.id && r.degraded === true);
({ data: card } = await anon.from("cardss_public").select("*").eq("id", r.id).single());
ok("откат: основные поля на месте (заголовок, цена)", card.title_ru === "2-комнатная квартира" && card.price === "85 000$");
delete process.env.CARD_FLOOR_COLUMNS;

console.log(fail ? `\n${fail} FAILED` : "\nВСЕ ПРОВЕРКИ СОХРАНЕНИЯ ПРОЙДЕНЫ");
process.exit(fail ? 1 : 0);
