// В тексте для роботов (HTML, description, микроразметка) нет цен в иностранной валюте.
// Запуск: node --test tests/listing.currency.test.mjs (входит в npm run test:all)

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildListingHead, stripForeignCurrency, priceInSoums } from "../api/_seoMeta.js";

const META = {
    title: { ru: "Квартира в ЖК New Life", en: "Apartment in New Life", uz: "New Life TTda kvartira" },
    description: {
        ru: "Просторная 2-комнатная квартира. Цена 95 000 $, торг. Рядом метро и школа.\nЕвроремонт, мебель остаётся.",
        en: "Spacious 2-room apartment. Price USD 95,000. Metro nearby.",
        uz: "Keng 2 xonali kvartira. Narxi 95 000 dollar. Metro yaqin.",
    },
    price: "$95 000",
    image: "",
};

const ld = (lines) =>
    [...lines.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");

test("описание в HTML, мета и микроразметке очищено от цен в валюте на всех языках", () => {
    for (const lang of ["ru", "en", "uz"]) {
        const head = buildListingHead({ kind: "property", id: 94, lang, meta: META, rate: 12000 });
        assert.doesNotMatch(head.body, /\$|USD|usd|долл|dollar|95 000|95,000/i, `body ${lang}`);
        assert.doesNotMatch(head.lines.replace(/<script[\s\S]*?<\/script>/g, ""), /\$|USD|долл|dollar/i, `meta ${lang}`);
        assert.doesNotMatch(ld(head.lines), /\$|USD|долл|dollar/i, `json-ld ${lang}`);
    }
});

test("обычные предложения описания сохраняются", () => {
    const head = buildListingHead({ kind: "property", id: 94, lang: "ru", meta: META, rate: 12000 });
    assert.match(head.body, /Просторная 2-комнатная квартира\./);
    assert.match(head.body, /Евроремонт, мебель остаётся\./);
});

test("цена в тексте для роботов — только в сумах, без курса не выводится", () => {
    const withRate = buildListingHead({ kind: "property", id: 94, lang: "ru", meta: META, rate: 12000 });
    assert.match(withRate.body, /1\s?140\s?000\s?000 UZS|1[\s\u00a0]140[\s\u00a0]000[\s\u00a0]000/);
    const noRate = buildListingHead({ kind: "property", id: 94, lang: "ru", meta: META });
    assert.doesNotMatch(noRate.body, /Цена|UZS|\$/);
});

test("stripForeignCurrency", () => {
    assert.equal(stripForeignCurrency("Рядом метро. Цена: 85 000 у.е. Евроремонт."), "Рядом метро. Евроремонт.");
    assert.equal(stripForeignCurrency("Квартира 68 м², 5 этаж."), "Квартира 68 м², 5 этаж.");
    assert.equal(stripForeignCurrency("Цена 1 200 000 000 сум. Торг."), "Цена 1 200 000 000 сум. Торг.");
    assert.equal(stripForeignCurrency(""), "");
    assert.equal(stripForeignCurrency("Продаётся за 120 000 USD. Торг."), "Торг.");
    assert.equal(stripForeignCurrency("Qimmati 95 000 dollar. Metro yaqin."), "Metro yaqin.");
    assert.equal(stripForeignCurrency("Участок и уехал. Уютный двор."), "Участок и уехал. Уютный двор.");
    assert.equal(
        stripForeignCurrency("Парковка на 3-4 машины. Это готовый бизнес, арендатор платит 1.700 у.е. в месяц. Удобная локация."),
        "Парковка на 3-4 машины. Удобная локация."
    );
});

test("priceInSoums", () => {
    assert.equal(priceInSoums("$95 000", null), "");
    assert.equal(priceInSoums("1 200 000 000 сум", null).replace(/\s/g, " "), "1 200 000 000 UZS");
    assert.equal(priceInSoums("", 12000), "");
});
