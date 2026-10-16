// Сохранение в Supabase (на поддельном клиенте): безопасный откат, повторы,
// различение ошибок БД, сборка строк карточки и страницы, совместимость
// формы результата разбора с потребителями, утилиты отображения этажа.
// Проверка на настоящей БД с RLS — tests/e2e/persist.mjs.

import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";

import { parseListing, buildParsedFromAi, validateAiListing } from "../api/listingParser.js";
import {
    insertCardRow,
    insertPageRow,
    savePage,
    buildCardRow,
    buildPagePayload,
    residentialCardFields,
    checkCardDisplay,
    classifyDbError,
    omitEmpty,
} from "../api/_listingDb.js";
import { formatFloor, residentialFloorSlot } from "../src/utils/floor.js";
import { roomsLabel } from "../src/utils/rooms.js";

const realFetch = globalThis.fetch;
const realLog = console.log;
let logs;

beforeEach(() => {
    logs = [];
    console.log = (...a) => { logs.push(a.join(" ")); };
    delete process.env.CARD_FLOOR_COLUMNS;
    // перевод: Google Translate подменён
    globalThis.fetch = async (url) => {
        if (String(url).includes("translate.googleapis.com")) {
            return new Response(JSON.stringify([[["translated", "src"]]]), { status: 200 });
        }
        throw new Error(`unexpected fetch ${url}`);
    };
});
after(() => { globalThis.fetch = realFetch; console.log = realLog; });

// Поддельный клиент Supabase: каждый insert берёт следующий шаг из очереди.
function fakeSupabase(steps = []) {
    const inserts = [];
    return {
        inserts,
        from(table) {
            return {
                insert(payload) {
                    inserts.push({ table, payload });
                    const step = steps.shift() ?? {};
                    const result = step.error ? { data: null, error: step.error } : { data: step.data ?? { id: 77 }, error: null };
                    const promise = Promise.resolve(result);
                    promise.select = () => ({ single: () => Promise.resolve(result) });
                    return promise;
                },
            };
        },
    };
}

const POST = "Продам 2-комнатная квартира\n📍 Юнусабад, ул. Навои 12\n5/9 этаж, 68 м², 2 санузла\nС мебелью, балкон\nЦена: 85 000$\nТел: +998 90 123 45 67";
const CTX = { image: "https://x/y.webp", videoUrl: "", tgChatId: 5, tgMessageId: 9 };

// ---- классификация ---------------------------------------------------------------

test("классификация ошибок БД: временная / данные / дубликат", () => {
    assert.equal(classifyDbError({ message: "fetch failed" }).transient, true);
    assert.equal(classifyDbError({ status: 503, message: "x" }).transient, true);
    assert.equal(classifyDbError({ code: "23505", message: "duplicate" }).duplicate, true);
    assert.equal(classifyDbError({ code: "22P02", message: "invalid input" }).dataRelated, true);
    assert.equal(classifyDbError({ code: "PGRST204", message: "column x" }).dataRelated, true);
    assert.equal(classifyDbError({ code: "42703", message: "column does not exist" }).dataRelated, true);
    assert.equal(classifyDbError({ code: "42501", message: "permission denied" }).dataRelated, false);
});

// ---- insertCardRow ----------------------------------------------------------------

test("успешная запись: один запрос, без деградации", async () => {
    const sb = fakeSupabase([{ data: { id: 5 } }]);
    const { table, row } = buildCardRow(parseListing(POST), CTX);
    const res = await insertCardRow(sb, table, row);
    assert.equal(res.data.id, 5);
    assert.equal(res.degraded, false);
    assert.equal(sb.inserts.length, 1);
});

test("ошибка данных: повтор урезанным набором — объявление не теряется", async () => {
    const sb = fakeSupabase([{ error: { code: "22P02", message: "invalid input syntax" } }, { data: { id: 8 } }]);
    const { table, row } = buildCardRow(parseListing(POST), CTX);

    const res = await insertCardRow(sb, table, row, { tgChatId: 5 });

    assert.equal(res.data.id, 8);
    assert.equal(res.degraded, true);
    assert.equal(sb.inserts.length, 2);
    const safe = sb.inserts[1].payload;
    assert.ok(safe.title_ru && safe.price === "85 000$" && safe.tg_message_id === 9, "основные поля и связь с постом сохранены");
    assert.ok(!("bedrooms_ru" in safe), "второстепенные поля убраны");
    assert.ok(logs.some((l) => l.startsWith("DB_INSERT_FAILED") && l.includes('"class":"db"')));
    assert.ok(logs.some((l) => l.startsWith("DB_INSERT_DEGRADED")));
});

test("временная ошибка: тот же запрос повторяется один раз", async () => {
    const sb = fakeSupabase([{ error: { message: "fetch failed" } }, { data: { id: 9 } }]);
    const { table, row } = buildCardRow(parseListing(POST), CTX);

    const res = await insertCardRow(sb, table, row);

    assert.equal(res.data.id, 9);
    assert.equal(res.degraded, false);
    assert.deepEqual(sb.inserts[0].payload, sb.inserts[1].payload, "повтор без урезания");
});

test("дубликат (23505): без повторов", async () => {
    const sb = fakeSupabase([{ error: { code: "23505", message: "duplicate key" } }]);
    const { table, row } = buildCardRow(parseListing(POST), CTX);
    const res = await insertCardRow(sb, table, row);
    assert.ok(res.error);
    assert.equal(sb.inserts.length, 1);
});

test("полный отказ БД: ошибка возвращается, число попыток ограничено, класс db в логе", async () => {
    const err = { code: "XX000", message: "boom" };
    const sb = fakeSupabase([{ error: err }, { error: err }, { error: err }, { error: err }]);
    const { table, row } = buildCardRow(parseListing(POST), CTX);

    const res = await insertCardRow(sb, table, row);

    assert.ok(res.error);
    assert.ok(sb.inserts.length <= 3);
    assert.ok(logs.some((l) => l.startsWith("DB_INSERT_LOST") && l.includes('"class":"db"')));
});

test("в логах БД нет секретов", async () => {
    process.env.SUPABASE_SERVICE_KEY = "service-key-should-never-be-logged-123456";
    const sb = fakeSupabase([{ error: { code: "XX", message: "failed with service-key-should-never-be-logged-123456" } }, { error: { code: "XX", message: "x" } }]);
    const { table, row } = buildCardRow(parseListing(POST), CTX);
    await insertCardRow(sb, table, row);
    assert.ok(!logs.join("\n").includes("service-key-should-never-be-logged"));
    delete process.env.SUPABASE_SERVICE_KEY;
});

// ---- insertPageRow / savePage -----------------------------------------------------

test("страница объекта: откат урезанным набором при ошибке данных", async () => {
    const sb = fakeSupabase([{ error: { code: "22P02", message: "invalid" } }, {}]);
    const payload = buildPagePayload(parseListing(POST), { table: "villas", linkIdField: "card_id", cardId: 3, images: ["a"], videoUrl: "" });

    const res = await insertPageRow(sb, "villas", payload, { cardId: 3 });

    assert.equal(res.ok, true);
    assert.equal(res.degraded, true);
    const safe = sb.inserts[1].payload;
    assert.equal(safe.card_id, 3);
    assert.ok(safe.about_ru, "about сохранён даже в урезанной записи");
    assert.ok(!("amenities" in safe) && !("square" in safe));
});

test("savePage никогда не бросает исключение", async () => {
    const broken = { from() { throw new Error("db is down"); } };
    const ok = await savePage(broken, "villas", "card_id", 1, parseListing(POST), [], "");
    assert.equal(ok, false);
    assert.ok(logs.some((l) => l.startsWith("DB_PAGE_EXCEPTION")));
});

test("savePage: страница создаётся, location переведён на en/uz", async () => {
    const sb = fakeSupabase([{}]);
    const ok = await savePage(sb, "villas", "card_id", 12, parseListing(POST), ["img1"], "");
    assert.equal(ok, true);
    const p = sb.inserts[0].payload;
    assert.equal(p.card_id, 12);
    assert.equal(p.location_ru, "Юнусабад, ул. Навои 12");
    assert.equal(p.location_en, "translated");
    assert.equal(p.location_uz, "translated");
});

// ---- сборка строк ----------------------------------------------------------------------

test("карточка жилья: правильные подписи, цена и тип; публикуется сразу", () => {
    const { table, row } = buildCardRow(parseListing(POST), CTX);
    assert.equal(table, "cardss");
    assert.equal(row.bedrooms_ru, "2 спальни");
    assert.equal(row.bathrooms_ru, "2 ванные");
    assert.equal(row.price, "85 000$");
    assert.equal(row.type_ru, "Квартира");
    assert.equal(row.tg_message_id, 9);
    assert.ok(!("is_draft" in row), "на карточке нет флагов модерации");
});

test("подпись комнат без данных — пустая строка, а не ноль или заглушка", () => {
    const { row } = buildCardRow(parseListing("Продам квартиру"), CTX);
    assert.equal(row.bedrooms_ru, "");
    assert.equal(row.bathrooms_ru, "");
    assert.equal(row.price, "");
});

test("колонки этажа пишутся только при CARD_FLOOR_COLUMNS=1", () => {
    const parsed = parseListing(POST);
    assert.ok(!("floor" in buildCardRow(parsed, CTX).row));

    process.env.CARD_FLOOR_COLUMNS = "1";
    const row = buildCardRow(parsed, CTX).row;
    assert.equal(row.floor, 5);
    assert.equal(row.total_floors, 9);

    const empty = buildCardRow(parseListing("Продам квартиру"), CTX).row;
    assert.equal(empty.floor, null);
});

test("карточка коммерции: поля коммерции и фиксированная категория", () => {
    const { table, row } = buildCardRow(parseListing("Сдаётся офис\nЭтаж: 3\nПлощадь: 120 м²\nЦена: 2 500$"), CTX);
    assert.equal(table, "commercials");
    assert.equal(row.floor, "3");
    assert.equal(row.area, "120");
    assert.equal(row.class_ru, "Коммерция");
    assert.equal(row.is_rent, true);
});

test("страница жилья: about не пустой, этаж сохранён, числа — числа", () => {
    const p = buildPagePayload(parseListing(POST), { table: "villas", linkIdField: "card_id", cardId: 4, images: ["a", "b"], videoUrl: "" });
    assert.ok(p.about_ru.length > 20, "about_ru пуст");
    assert.ok(p.about_ru.includes("Этаж 5 из 9"));
    assert.equal(p.price, 85000);
    assert.equal(p.bedrooms, 2);
    assert.equal(p.square, 68);
    assert.equal(p.is_draft, true);
    assert.equal(p.slug.endsWith("-4"), true);
    assert.ok(Array.isArray(p.amenities) && p.amenities.length > 0);
});

test("страница: сумма в сумах < 10 млн не записывается числом (сайт принял бы её за доллары)", () => {
    const small = buildPagePayload(parseListing("Сдам 2-комнатную\nЦена: 5 000 000 сум/мес"), { table: "villas", linkIdField: "card_id", cardId: 1, images: [], videoUrl: "" });
    assert.equal(small.price, null);

    const big = buildPagePayload(parseListing("Продам\nЦена: 850 млн сум"), { table: "villas", linkIdField: "card_id", cardId: 1, images: [], videoUrl: "" });
    assert.equal(big.price, 850000000);

    // результат старого формата (без поля priceNumber) по-прежнему разбирается
    const legacy = buildPagePayload({ ...parseListing("Продам\nЦена: 85 000$"), priceNumber: undefined }, { table: "villas", linkIdField: "card_id", cardId: 1, images: [], videoUrl: "" });
    assert.equal(legacy.price, 85000);
});

test("страница без данных: числа null, а не 0 или выдуманные значения", () => {
    const p = buildPagePayload(parseListing("Продам квартиру"), { table: "villas", linkIdField: "card_id", cardId: 4, images: [], videoUrl: "" });
    assert.equal(p.price, null);
    assert.equal(p.bedrooms, null);
    assert.equal(p.square, null);
    assert.deepEqual(p.amenities, []);
});

test("страница коммерции", () => {
    const p = buildPagePayload(parseListing("Сдаётся офис\nЭтаж: 3\nПлощадь: 120 м²\nВысота потолков: 3,2"), { table: "commercial_pages", linkIdField: "commercial_id", cardId: 6, images: [], videoUrl: "" });
    assert.equal(p.commercial_id, 6);
    assert.equal(p.floor, 3);
    assert.equal(p.area, 120);
    assert.equal(p.ceiling_height, 3.2);
});

// ---- совместимость формы результата ------------------------------------------------------

test("любой путь разбора даёт форму, пригодную для сборки строк (type, locationLine и т.д.)", () => {
    const ai = {
        title_ru: "Квартира в Юнусабаде", title_en: "", title_uz: "", description_ru: "Квартира в Юнусабаде.", description_en: "", description_uz: "",
        price_raw: "85 000$", price_number: 85000, bedrooms: 2, bathrooms: null, area: 68, floor: 5, total_floors: 9, ceiling_height: null,
        type_ru: "Квартира", district: "Юнусабад", address: null, landmark: null, is_commercial: false, is_rent: false, is_sold: false, amenities: [],
    };
    const regex = parseListing(POST);
    const merged = buildParsedFromAi(validateAiListing(ai, POST, regex).value, regex, POST);

    for (const parsed of [regex, merged, parseListing(""), parseListing(null)]) {
        const { row } = buildCardRow(parsed, CTX);
        const page = buildPagePayload(parsed, { table: parsed.isCommercial ? "commercial_pages" : "villas", linkIdField: "card_id", cardId: 1, images: [], videoUrl: "" });
        assert.ok(row && page);
        assert.equal(typeof parsed.locationLine, "string");
        assert.ok(parsed.diagnostics && Array.isArray(parsed.diagnostics.warnings));
    }
});

test("residentialCardFields и omitEmpty: правка поста не затирает существующие данные", () => {
    const fields = residentialCardFields(parseListing("Продам квартиру"));
    assert.equal(fields.bedrooms_ru, "");
    assert.deepEqual(omitEmpty({ ...fields, price: "", title_ru: "Новое", is_rent: false, n: 0 }), { title_ru: "Новое", is_rent: false, n: 0 });
});

// ---- отображение ----------------------------------------------------------------------------

test("проверка отображения: нормальная цена без замечаний, \"за м²\" и конфликт фиксируются", () => {
    assert.deepEqual(checkCardDisplay({ price: "85 000$" }), []);
    assert.deepEqual(checkCardDisplay({ price: "850 000 000 сум" }), []);
    assert.deepEqual(checkCardDisplay({ price: "" }), []);

    // цена за м² — допустимое значение: сайт распознаёт пометку и не клеит "2" из "м2"
    assert.deepEqual(checkCardDisplay({ price: "1400$ за 1м²" }), []);
    assert.deepEqual(checkCardDisplay({ price: "1 800$ за м2" }), []);

    const conflict = checkCardDisplay({ price: "85 000$ или 1 000 000 сум" });
    assert.ok(Array.isArray(conflict));
});

test("утилиты этажа для карточек", () => {
    assert.equal(formatFloor(5, 9, "ru"), "5/9 этаж");
    assert.equal(formatFloor("5", "9", "uz"), "5/9 qavat");
    assert.equal(formatFloor(5, null, "en"), "5 floor");
    assert.equal(formatFloor(null, 9, "ru"), "");
    assert.equal(formatFloor("", "", "ru"), "");
    assert.equal(formatFloor(0, 9, "ru"), "");
    assert.equal(formatFloor("abc", 9, "ru"), "");

    assert.deepEqual(residentialFloorSlot({ floor: 5, totalFloors: 9 }, "ru"), { kind: "floor", label: "5/9 этаж" });
    // ванн в карточках больше нет: нет этажа — пункт пустой и не рисуется
    assert.deepEqual(residentialFloorSlot({ bathrooms: { ru: "2 ванные", en: "2 bathrooms" } }, "ru"), { kind: "empty", label: "" });
    assert.deepEqual(residentialFloorSlot({}, "ru"), { kind: "empty", label: "" });
    // этаж берётся из текста описания, если колонок нет
    assert.deepEqual(residentialFloorSlot({ description: { ru: "Квартира. Этаж 5 из 9." } }, "ru"), { kind: "floor", label: "5/9 этаж" });
    assert.equal(residentialFloorSlot({ floor: 3, bathrooms: { ru: "1 ванная" } }, "ru").kind, "floor");
    // комнаты вместо спален
    assert.equal(roomsLabel("2 спальни", "ru"), "2 комнаты");
    assert.equal(roomsLabel("5 спален", "ru"), "5 комнат");
    assert.equal(roomsLabel("1 спальня", "ru"), "1 комната");
    assert.equal(roomsLabel("3 bedrooms", "en"), "3 rooms");
    assert.equal(roomsLabel("4 ta yotoqxona", "uz"), "4 ta xona");
});
