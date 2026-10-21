import test from "node:test";
import assert from "node:assert/strict";
import {
    detectDistrict, districtLabel, parseDistrictKey, districtCatalogPath, TASHKENT_DISTRICTS
} from "../src/utils/districts.js";
import { buildResidenceJsonLd, buildCommercialJsonLd } from "../src/utils/structuredData.js";

test("находит район по русскому тексту", () => {
    assert.equal(detectDistrict(["2-комнатная квартира в Юнусабадском районе"]), "yunusabad");
    assert.equal(detectDistrict(["Чиланзар, 3-комн, 5/9"]), "chilanzar");
    assert.equal(detectDistrict(["Мирзо-Улугбекский район, ор-р Ойбек"]), "mirzo");
    assert.equal(detectDistrict(["Новостройка Яшнабад"]), "yashnabad");
});

test("находит район латиницей и в узбекском написании", () => {
    assert.equal(detectDistrict(["Chilonzor tumani, 2 xonali"]), "chilanzar");
    assert.equal(detectDistrict(["Apartment in Mirabad district"]), "mirabad");
    assert.equal(detectDistrict(["Mirzo Ulug'bek tumani"]), "mirzo");
    assert.equal(detectDistrict(["Olmazor"]), "almazar");
});

test("берёт район, упомянутый раньше (а не ориентир рядом)", () => {
    assert.equal(detectDistrict(["Юнусабад, рядом с метро Чиланзарская"]), "yunusabad");
});

test("учитывает приоритет текстов и пустые значения", () => {
    assert.equal(detectDistrict([undefined, "", "Сергели", "Юнусабад"]), "sergeli");
    assert.equal(detectDistrict(["Квартира в центре", "Юнусабад"]), "yunusabad");
    assert.equal(detectDistrict([undefined, null, ""]), null);
    assert.equal(detectDistrict(["Просто квартира"]), null);
});

test("подписи районов на трёх языках", () => {
    assert.equal(districtLabel("chilanzar", "ru"), "Чиланзар");
    assert.equal(districtLabel("chilanzar", "uz"), "Chilonzor");
    assert.equal(districtLabel("chilanzar", "en"), "Chilanzar");
    assert.equal(districtLabel("nope", "ru"), "");
});


test("?district=: принимает только известные ключи, регистр и пробелы не важны", () => {
    assert.equal(parseDistrictKey("yunusabad"), "yunusabad");
    assert.equal(parseDistrictKey("  ChilanZar "), "chilanzar");
    for (const bad of [null, undefined, "", "all", "unknown", "<script>", "yunusabad,mirabad", "../etc", 5, ["mirzo"]]) {
        assert.equal(parseDistrictKey(bad), null, String(bad));
    }
});

test("ссылка на каталог с районом: все ключи справочника дают рабочий путь", () => {
    for (const d of TASHKENT_DISTRICTS) {
        assert.equal(districtCatalogPath(d.key, "ru"), `/ru/Properties?district=${d.key}`);
        assert.equal(parseDistrictKey(new URLSearchParams(districtCatalogPath(d.key, "en").split("?")[1]).get("district")), d.key);
    }
    assert.equal(districtCatalogPath("chilanzar", "uz"), "/uz/Properties?district=chilanzar");
    // неизвестный район и «все районы» — каталог без параметра
    assert.equal(districtCatalogPath("nope", "ru"), "/ru/Properties");
    assert.equal(districtCatalogPath(null, "en"), "/en/Properties");
});

test("JSON-LD объявления: тип, числовая цена и валюта из данных", () => {
    const base = { title: { ru: "Квартира" }, about: { ru: "Описание" }, images: ["https://x.test/1.jpg"] };
    const usd = buildResidenceJsonLd({ villa: { ...base, price: "$85 000" }, lang: "ru", url: "https://urbankey.uz/ru/property/1" });
    assert.equal(usd["@type"], "RealEstateListing");
    assert.deepEqual(usd.offers, { "@type": "Offer", price: 85000, priceCurrency: "USD" });
    assert.equal("address" in usd, false);

    const uzs = buildCommercialJsonLd({ page: { ...base, price: "950 000 000 сум" }, lang: "ru", url: "u" });
    assert.equal(uzs.offers.priceCurrency, "UZS");
    assert.equal(uzs.offers.price, 950000000);
});

test("JSON-LD: цена за м² или нечитаемая цена не превращается в Offer", () => {
    const base = { title: { ru: "Квартира" }, about: { ru: "x" } };
    assert.equal("offers" in buildResidenceJsonLd({ villa: { ...base, price: "1800$ за м2" }, lang: "ru", url: "u" }), false);
    assert.equal("offers" in buildResidenceJsonLd({ villa: { ...base, price: "договорная" }, lang: "ru", url: "u" }), false);
    assert.equal("offers" in buildResidenceJsonLd({ villa: base, lang: "ru", url: "u" }), false);
});
