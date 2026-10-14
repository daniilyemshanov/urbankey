import test from "node:test";
import assert from "node:assert/strict";
import { detectDistrict, districtLabel } from "../src/utils/districts.js";

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
