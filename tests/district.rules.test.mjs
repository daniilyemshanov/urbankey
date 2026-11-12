import { test } from "node:test";
import assert from "node:assert/strict";
import { applyDistrictRules, districtPromptAddendum } from "../api/_districtRules.js";
import { detectDistrict } from "../src/utils/districts.js";
import { getDistrictPage, allDistrictPages, districtKeyFromSlug, districtPagePath } from "../src/utils/districtPages.js";

const post = (o = {}) => ({
    title_ru: "2-комнатная квартира", description_ru: "Квартира 68 м², 5 этаж.", description_en: "68 sqm apartment.", description_uz: "",
    locationLine: "", commercialFields: { district_ru: "", address_ru: "", landmark_ru: "" }, ...o,
});

test("ЖК из списка определяет район, даже если район не назван", () => {
    const p = applyDistrictRules(post({ title_ru: "Квартира в ЖК ETALON BUILDING" }), "Продам в ЖК ETALON BUILDING");
    assert.equal(p.locationLine, "Яккасарайский район");
    assert.match(p.description_ru, /Яккасарайский район/);
    assert.match(p.description_en, /Yakkasaray District/);
    assert.equal(p.description_uz, "");
    assert.equal(p.commercialFields.district_ru, "Яккасарайский район");
});

test("краткое название района заменяется официальным, улица сохраняется", () => {
    const p = applyDistrictRules(post({ locationLine: "Яккасарай, ул. Шота Руставели" }), "");
    assert.equal(p.locationLine, "Яккасарайский район, ул. Шота Руставели");
});

test("если район не определяется — объявление не меняется", () => {
    const p = applyDistrictRules(post(), "Продам квартиру");
    assert.equal(p.locationLine, "");
    assert.equal(p.description_ru, "Квартира 68 м², 5 этаж.");
});

test("мусор на входе не вызывает исключений", () => {
    assert.equal(applyDistrictRules(null, "x"), null);
    assert.doesNotThrow(() => applyDistrictRules({}, undefined));
});

test("явно названный район важнее ориентира", () => {
    assert.equal(detectDistrict(["Юнусабад, ЖК ETALON BUILDING"]), "yunusabad");
    assert.equal(detectDistrict(["ЖК ETALON BUILDING"]), "yakkasaray");
    assert.equal(detectDistrict(["просто квартира"]), null);
});

test("район из поста — надёжный: пишется в описание, пометки «проверьте» нет", () => {
    const p = applyDistrictRules(post({ locationLine: "Яккасарайский район, ул. Навои" }), "Продам квартиру, Яккасарайский район, ул. Навои");
    assert.equal(p.districtInferred, false);
    assert.match(p.description_ru, /Яккасарайский район/);
    assert.equal(p.districtNote, "📍 Район: Яккасарайский район");
});

test("район, который ИИ определил сам (в посте не назван): сохраняется, но помечается на проверку", () => {
    const p = applyDistrictRules(
        post({ commercialFields: { district_ru: "Юнусабадский район", address_ru: "", landmark_ru: "" } }),
        "Продам 2к в ЖК Неизвестный, 68 м2"
    );
    assert.equal(p.districtKey, "yunusabad");
    assert.equal(p.districtInferred, true);
    assert.equal(p.commercialFields.district_ru, "Юнусабадский район");
    assert.equal(p.description_ru, "Квартира 68 м², 5 этаж.", "в описание догадку ИИ не дописываем");
    assert.match(p.districtNote, /определён ИИ.*проверьте/);
});

test("район не определён — бот просит указать его вручную", () => {
    const p = applyDistrictRules(post(), "Продам квартиру");
    assert.match(p.districtNote, /Район не определён/);
});

test("добавка к промту ИИ содержит список ЖК", () => {
    assert.match(districtPromptAddendum(), /ETALON BUILDING.*Яккасарайский район/);
});

test("страницы районов: 2 вида × 12 районов × 3 языка, тексты есть", () => {
    const pages = allDistrictPages();
    assert.equal(pages.length, 24);
    for (const { kind, key } of pages) {
        for (const lang of ["ru", "en", "uz"]) {
            const p = getDistrictPage(kind, key, lang);
            assert.ok(p && p.name && p.title && p.h1 && p.description && p.intro, `${kind}/${key}/${lang}`);
        }
    }
});

test("адреса страниц районов", () => {
    assert.equal(districtPagePath("apartments", "mirzo", "ru"), "/ru/Properties/apartments/mirzo-ulugbek");
    assert.equal(districtKeyFromSlug("mirzo-ulugbek"), "mirzo");
    assert.equal(districtKeyFromSlug("junk"), null);
    assert.equal(getDistrictPage("apartments", "yangihayot", "ru").name, "Янгихаётский район");
});
