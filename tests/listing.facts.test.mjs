import { test } from "node:test";
import assert from "node:assert/strict";

import {
    extractRooms,
    extractBathrooms,
    extractArea,
    extractFloorInfo,
    extractPriceInfo,
    extractAmenities,
    detectType,
    detectIsRent,
    detectIsSold,
    cleanTitle,
    isNumberSupported,
    parseAmountToken,
    priceNumberForPage,
} from "../api/_listingFacts.js";
import { parseListing, countLabelsFor } from "../api/listingParser.js";

const table = (fn, rows) => {
    for (const [input, expected] of rows) {
        assert.deepEqual(fn(input), expected, `вход: ${JSON.stringify(input)}`);
    }
};

test("комнаты: распространённые форматы", () => {
    table(extractRooms, [
        ["Продам 2-комнатная квартира", "2"],
        ["2 комнатная", "2"],
        ["3х комнатная квартира", "3"],
        ["3-х комнатная", "3"],
        ["3-комн. кв", "3"],
        ["2 комн", "2"],
        ["продам 2к кв", "2"],
        ["2к.", "2"],
        ["двухкомнатная квартира", "2"],
        ["трёхкомнатная", "3"],
        ["однокомнатная", "1"],
        ["двушка в центре", "2"],
        ["Комнат: 4", "4"],
        ["Количество комнат - 3", "3"],
        ["3 спальни", "3"],
    ]);
});

test("комнаты: нет данных — пустая строка, ничего не выдумывается", () => {
    table(extractRooms, [
        ["Квартира в центре, рядом метро", ""],
        ["Студия", ""],
        ["Цена 85к$", ""],
        ["", ""],
        [null, ""],
    ]);
});

test("санузлы", () => {
    table(extractBathrooms, [
        ["2 санузла", "2"],
        ["Санузел: 2", "2"],
        ["санузлов - 3", "3"],
        ["1 с/у", "1"],
        ["раздельный санузел", ""],
        ["5/9 этаж", ""],
    ]);
});

test("этаж: форматы 5/9, 5 из 9, раздельные поля", () => {
    table(extractFloorInfo, [
        ["5/9 этаж", { floor: "5", totalFloors: "9" }],
        ["5/9 эт.", { floor: "5", totalFloors: "9" }],
        ["Этаж: 5/9", { floor: "5", totalFloors: "9" }],
        ["Этаж 5/9", { floor: "5", totalFloors: "9" }],
        ["5 этаж из 9", { floor: "5", totalFloors: "9" }],
        ["5-й этаж из 9", { floor: "5", totalFloors: "9" }],
        ["Этаж: 5 из 9", { floor: "5", totalFloors: "9" }],
        ["1 этаж 4-этажного дома", { floor: "1", totalFloors: "4" }],
        ["Этаж: 12\nЭтажность: 14", { floor: "12", totalFloors: "14" }],
        ["Этаж - 3, этажность - 9", { floor: "3", totalFloors: "9" }],
    ]);
});

test("этаж: только этаж, только этажность, словами", () => {
    table(extractFloorInfo, [
        ["квартира на 5 этаже", { floor: "5", totalFloors: "" }],
        ["5 этаж", { floor: "5", totalFloors: "" }],
        ["пятый этаж", { floor: "5", totalFloors: "" }],
        ["в 9-этажном доме", { floor: "", totalFloors: "9" }],
        ["9-этажный дом", { floor: "", totalFloors: "9" }],
        ["Этажность: 16", { floor: "", totalFloors: "16" }],
    ]);
});

test("этаж: нет данных / противоречие не принимаются на веру", () => {
    table(extractFloorInfo, [
        ["просторная квартира", { floor: "", totalFloors: "" }],
        ["", { floor: "", totalFloors: "" }],
        ["9/5 этаж", { floor: "9", totalFloors: "" }],
    ]);
});

test("площадь: форматы и единицы", () => {
    table(extractArea, [
        ["68 м²", "68"],
        ["68м2", "68"],
        ["68 кв.м", "68"],
        ["68 кв. м.", "68"],
        ["Площадь: 68,5 м²", "68.5"],
        ["Площадь 68.50 м2", "68.5"],
        ["Общая площадь, кв.м. -49.31", "49.31"],
        ["Площадь 120 квадратных метров", "120"],
    ]);
});

test("площадь: общая важнее кухни и жилой; цена за м² — не площадь", () => {
    assert.equal(extractArea("Кухня 12 м², общая площадь 68 м²"), "68");
    assert.equal(extractArea("Жилая 40 м², общая 68 м²"), "68");
    assert.equal(extractArea("1400$ за 1м²"), "");
    assert.equal(extractArea("Цена 1400$ за 1 м²"), "");
    assert.equal(extractArea("Площадь кухни 12 м²"), "");
    assert.equal(extractArea("Квартира без указания площади"), "");
});

test("цена: пробелы и разные обозначения валют", () => {
    const usd = (input) => {
        const i = extractPriceInfo(input);
        return [i.raw, i.amount, i.currency];
    };
    assert.deepEqual(usd("Цена: 85 000$"), ["85 000$", 85000, "USD"]);
    assert.deepEqual(usd("85000 у.е."), ["85 000$", 85000, "USD"]);
    assert.deepEqual(usd("85 000 usd"), ["85 000$", 85000, "USD"]);
    assert.deepEqual(usd("USD 85 000"), ["85 000$", 85000, "USD"]);
    assert.deepEqual(usd("$85,000"), ["85 000$", 85000, "USD"]);
    assert.deepEqual(usd("85.000$"), ["85 000$", 85000, "USD"]);
    assert.deepEqual(usd("85 тыс. $"), ["85 000$", 85000, "USD"]);
    assert.deepEqual(usd("1,2 млн $"), ["1 200 000$", 1200000, "USD"]);
    assert.deepEqual(usd("долларов 85000"), ["", null, null].map((x, i) => (i === 0 ? extractPriceInfo("долларов 85000").raw : x)));
});

test("цена: сумы, курс и итог в долларах", () => {
    const i = extractPriceInfo("Цена 850 млн сум");
    assert.deepEqual([i.raw, i.amount, i.currency], ["850 000 000 сум", 850000000, "UZS"]);

    const both = extractPriceInfo("Цена: 8 659 000 000 сум/12000=722.000$");
    assert.deepEqual([both.raw, both.currency], ["722 000$", "USD"]);

    assert.equal(extractPriceInfo("общая сумма 85 000").currency, null);
});

test("цена: за м² сохраняется как есть, итоговой не становится; проценты и телефон — не цена", () => {
    const perSqm = extractPriceInfo("1400$ за 1м²");
    assert.equal(perSqm.raw, "1 400$ за м²");
    assert.equal(perSqm.perSqm, true);
    assert.equal(perSqm.amount, 1400);
    assert.equal(perSqm.perSqmRaw, "1 400$ за м²");

    const both = extractPriceInfo("Цена 85 000$ (1400$ за м²)");
    assert.equal(both.raw, "85 000$");
    assert.equal(both.perSqm, false);

    assert.equal(extractPriceInfo("скидка 5% при оплате").raw, "");
    assert.equal(extractPriceInfo("тел +998 90 123 45 67").raw, "");
    assert.equal(extractPriceInfo("Квартира в центре").raw, "");
});

test("цена: число для страницы не вводит сайт в заблуждение", () => {
    assert.equal(priceNumberForPage(extractPriceInfo("85 000$")), 85000);
    assert.equal(priceNumberForPage(extractPriceInfo("850 млн сум")), 850000000);
    assert.equal(priceNumberForPage(extractPriceInfo("5 000 000 сум")), null);
    assert.equal(priceNumberForPage(extractPriceInfo("нет цены")), null);
});

test("parseAmountToken", () => {
    assert.equal(parseAmountToken("85 000"), 85000);
    assert.equal(parseAmountToken("83.000"), 83000);
    assert.equal(parseAmountToken("85,5"), 85.5);
    assert.equal(parseAmountToken("1,200,000"), 1200000);
    assert.equal(parseAmountToken("abc"), null);
});

test("аренда и продажа: слова с кириллицей (раньше \\b не срабатывал)", () => {
    assert.equal(detectIsRent("Сдам квартиру"), true);
    assert.equal(detectIsRent("Сдаю 2-комнатную"), true);
    assert.equal(detectIsRent("Сдаётся офис"), true);
    assert.equal(detectIsRent("В аренду помещение"), true);
    assert.equal(detectIsRent("Продам квартиру"), false);
    assert.equal(detectIsRent("Сдан в эксплуатацию дом, продаётся квартира"), false);
    assert.equal(detectIsSold("ПРОДАНО"), true);
    assert.equal(detectIsSold("Продан!"), true);
    assert.equal(detectIsSold("Продам квартиру"), false);
});

test("тип жилья", () => {
    assert.equal(detectType("Продам частный дом").ru, "Дом");
    assert.equal(detectType("Продам дом на участке").ru, "Дом");
    assert.equal(detectType("Квартира в 9-этажном доме").ru, "Квартира");
    assert.equal(detectType("Продам 2-комнатную квартиру в ЖК Dream House").ru, "Квартира");
    assert.equal(detectType("Новостройка, 3 комнаты").ru, "Новостройка");
    assert.equal(detectType("Продам виллу").ru, "Квартира");
    assert.equal(detectType("Пентхаус в центре").ru, "Квартира");
});

test("преимущества: только подтверждённые, отрицания не считаются", () => {
    const names = (t) => extractAmenities(t).map((a) => a.ru);
    assert.deepEqual(names("Квартира без мебели, есть охрана"), ["Охрана"]);
    assert.deepEqual(names("Мебель: нет, парковка есть"), ["Парковка"]);
    assert.deepEqual(names("Требует ремонта, балкон"), ["Балкон"]);
    assert.ok(names("С мебелью и бытовой техникой, лифт, балкон").includes("Мебель"));
    assert.ok(names("С мебелью и бытовой техникой, лифт, балкон").includes("Бытовая техника"));
    assert.ok(names("Евроремонт, кондиционер").includes("Свежий ремонт"));
    assert.deepEqual(names("Просторная квартира в центре"), []);
    assert.ok(names("вид на море").includes("Вид на море"));
    assert.ok(!names("вид на море").includes("Вид на город"));
});

test("заголовок: эмодзи, хештеги, глагол сделки", () => {
    assert.equal(cleanTitle("🔥 Продам 2-комнатная квартира"), "2-комнатная квартира");
    assert.equal(cleanTitle("Сдаётся — офис в центре"), "Офис в центре");
    assert.equal(cleanTitle("#срочно Квартира в Юнусабаде"), "Квартира в Юнусабаде");
    assert.equal(cleanTitle("Продаётся"), "");
    assert.ok(cleanTitle("А".repeat(200)).length <= 91);
});

test("число подтверждается цифрой или словом", () => {
    assert.equal(isNumberSupported("двухкомнатная квартира", 2, "count"), true);
    assert.equal(isNumberSupported("трёхкомнатная", 3, "count"), true);
    assert.equal(isNumberSupported("пятый этаж", 5, "count"), true);
    assert.equal(isNumberSupported("5/9 этаж", 9, "count"), true);
    assert.equal(isNumberSupported("квартира без чисел", 4, "count"), false);
    assert.equal(isNumberSupported("площадь 68.50 м²", 68.5, "measure"), true);
    assert.equal(isNumberSupported("площадь 68 м²", 72, "measure"), false);
    assert.equal(isNumberSupported("цена 1,2 млн $", 1200000, "amount"), true);
    assert.equal(isNumberSupported("цена 85 000$", 90000, "amount"), false);
});

test("подписи количества склоняются", () => {
    assert.equal(countLabelsFor("bedrooms", 1).ru, "1 спальня");
    assert.equal(countLabelsFor("bedrooms", 2).ru, "2 спальни");
    assert.equal(countLabelsFor("bedrooms", 5).ru, "5 спален");
    assert.equal(countLabelsFor("bedrooms", 21).ru, "21 спальня");
    assert.equal(countLabelsFor("bedrooms", 12).ru, "12 спален");
    assert.equal(countLabelsFor("bathrooms", 1).ru, "1 ванная");
    assert.equal(countLabelsFor("bathrooms", 2).en, "2 bathrooms");
    assert.deepEqual(countLabelsFor("bedrooms", ""), { ru: "", en: "", uz: "" });
    assert.deepEqual(countLabelsFor("bedrooms", null), { ru: "", en: "", uz: "" });
});

test("parseListing: полный пост — все характеристики, контакты не попадают в текст", () => {
    const p = parseListing([
        "🔥 Продам 2-комнатная квартира",
        "📍 Юнусабад, ул. Навои 12",
        "5/9 этаж, 68 м², 2 санузла",
        "С мебелью, балкон, лифт. Без ремонта.",
        "Цена: 85 000$",
        "Тел: +998 90 123 45 67 @agent_name",
    ].join("\n"));

    assert.equal(p.title_ru, "2-комнатная квартира");
    assert.equal(p.bedrooms, "2");
    assert.equal(p.bathrooms, "2");
    assert.equal(p.area, "68");
    assert.equal(p.floor, "5");
    assert.equal(p.totalFloors, "9");
    assert.equal(p.price, "85 000$");
    assert.equal(p.priceNumber, 85000);
    assert.equal(p.locationLine, "Юнусабад, ул. Навои 12");
    assert.equal(p.isRent, false);
    assert.deepEqual(p.type, { ru: "Квартира", en: "Apartment", uz: "Kvartira" });
    assert.ok(p.amenities.some((a) => a.ru === "Мебель"));
    assert.ok(!p.amenities.some((a) => a.ru === "С ремонтом" || a.ru === "Свежий ремонт"));
    assert.ok(!/998|@agent/.test(p.description_ru + p.about_ru), "контакты в описании");
    assert.ok(p.description_ru.length > 20, "описание не пустое");
    assert.ok(/Этаж 5 из 9/.test(p.about_ru), "этаж сохранён в about_*");
    assert.deepEqual(p.missing, []);
});

test("parseListing: мало данных — пусто, но не выдумано; описание нейтральное", () => {
    const p = parseListing("Продам квартиру");

    assert.equal(p.bedrooms, "");
    assert.equal(p.bathrooms, "");
    assert.equal(p.area, "");
    assert.equal(p.floor, "");
    assert.equal(p.totalFloors, "");
    assert.equal(p.price, "");
    assert.equal(p.priceNumber, null);
    assert.deepEqual(p.amenities, []);
    assert.ok(p.missing.includes("цена"));
    assert.ok(p.missing.includes("комнаты/площадь"));
    assert.ok(!/\d/.test(p.description_ru + p.about_ru), "в описании не должно быть выдуманных чисел");
});

test("parseListing: пустой/мусорный ввод не падает", () => {
    for (const input of ["", "   ", null, undefined, "!!!", "123", "\n\n"]) {
        const p = parseListing(input);
        assert.equal(typeof p.title_ru, "string", JSON.stringify(input));
        assert.ok(p.type && p.type.ru, "type обязателен для потребителей");
        assert.equal(typeof p.locationLine, "string");
        assert.ok(Array.isArray(p.missing));
    }
});

test("parseListing: аренда в сумах — валюта не подменяется долларом", () => {
    const p = parseListing("Сдам 2-комнатную\nЦена: 5 000 000 сум/мес");
    assert.equal(p.isRent, true);
    assert.equal(p.price, "5 000 000 сум");
    assert.equal(p.currency, "UZS");
    assert.equal(p.priceNumber, null);
});

test("parseListing: цена за м² сохраняется как цена «за м²», а не итоговая", () => {
    const p = parseListing("Квартира 68 м²\n1400$ за 1м²");
    assert.equal(p.price, "1 400$ за м²");
    assert.equal(p.priceNumber, null);
    assert.equal(p.pricePerSqm, "1 400$ за м²");
    assert.equal(p.area, "68");
    assert.ok(p.about_ru.includes("1 400$ за м²"), "информация о цене за м² не потеряна");
});

test("parseListing: коммерция", () => {
    const p = parseListing("Сдаётся офисное помещение\nЭтаж: 3\nПлощадь: 120 м²\nВысота потолков: 3,2\nЦена: 2 500$");
    assert.equal(p.isCommercial, true);
    assert.equal(p.isRent, true);
    assert.equal(p.commercialFields.floor, "3");
    assert.equal(p.commercialFields.area, "120");
    assert.equal(p.commercialFields.ceiling, "3.2");
    assert.equal(p.price, "2 500$");
});
