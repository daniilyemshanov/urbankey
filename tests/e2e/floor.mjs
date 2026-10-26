import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const T = JSON.parse(fs.readFileSync(process.env.E2E_TOKENS || "./tokens.json"));
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => String(url).includes("translate.googleapis.com")
    ? new Response(JSON.stringify([[["[tr]", "x"]]]), { status: 200 })
    : realFetch(url, init);

const { parseListing, fillMissingTranslations } = await import("../../api/listingParser.js");
const { buildCardRow, insertCardRow, savePage } = await import("../../api/_listingDb.js");
const { residentialFloorSlot } = await import("../../src/utils/floor.js");

const service = createClient("http://localhost:3200", T.service, { auth: { persistSession: false } });
const anon = createClient("http://localhost:3200", T.anon, { auth: { persistSession: false } });

let fail = 0;
const ok = (n, c, e = "") => { console.log((c ? "PASS " : "FAIL ") + n + (e ? "  " + e : "")); if (!c) fail++; };
const quiet = async (fn) => { const log = console.log; console.log = () => {}; try { return await fn(); } finally { console.log = log; } };

process.env.CARD_FLOOR_COLUMNS = "1";
const parsed = parseListing("Продам 2-комнатная квартира\n5/9 этаж, 68 м², 2 санузла\nЦена: 85 000$");
await quiet(() => fillMissingTranslations(parsed, ["title", "description", "about"]));
const { table, row } = buildCardRow(parsed, { image: "", videoUrl: "", tgChatId: 1, tgMessageId: 900 });
const res = await quiet(() => insertCardRow(service, table, row));
ok("с колонками этажа запись проходит БЕЗ отката", res.data && res.degraded === false);
await quiet(() => savePage(service, "villas", "card_id", res.data.id, parsed, [], ""));

const { data: card } = await anon.from("cardss_public").select("*").eq("id", res.data.id).single();
ok("публичный view отдаёт floor и total_floors", card.floor === 5 && card.total_floors === 9, `${card.floor}/${card.total_floors}`);
ok("owner_phone по-прежнему не раскрывается", !("owner_phone" in card));

const item = { floor: card.floor ?? null, totalFloors: card.total_floors ?? null, bathrooms: { ru: card.bathrooms_ru } };
ok("карточка: значок этажа и подпись «5/9 этаж»", JSON.stringify(residentialFloorSlot(item, "ru")) === JSON.stringify({ kind: "floor", label: "5/9 этаж" }));

const { data: all } = await anon.from("cardss_public").select("*").order("id");
const old = all.find((c) => c.floor == null && c.bathrooms_ru);
ok("старые карточки без этажа не ломаются (floor = null)", all.some((c) => c.floor == null));
if (old) ok("старая карточка без этажа: пункт этажа пустой, ванны нет", residentialFloorSlot({ floor: old.floor, totalFloors: old.total_floors, bathrooms: { ru: old.bathrooms_ru } }, "ru").kind === "empty");

console.log(fail ? `\n${fail} FAILED` : "\nВСЕ ПРОВЕРКИ ЭТАЖА ПРОЙДЕНЫ");
process.exit(fail ? 1 : 0);
