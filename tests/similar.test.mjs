// Подбор похожих объявлений (src/utils/similarListings.js). Запуск: npm run test:seo

import { test } from "node:test";
import assert from "node:assert/strict";
import { rankSimilar } from "../src/utils/similarListings.js";

const card = (id, rooms, price, floor, rent = false) => ({
    id, bedrooms: { ru: `${rooms} спальни` }, price, floor, totalFloors: 9, is_rent: rent,
    title: { ru: `Квартира ${id}` }, description: { ru: "Описание без района" },
});

const LOCATIONS = {
    1: ["Яккасарайский район, ул. Шота Руставели"], 2: ["Яккасарайский район, ул. Навои"], 3: ["Юнусабадский район"],
    4: ["Яккасарайский район"], 5: ["Мирабадский район"], 6: ["Яккасарайский район"], 7: ["Яккасарайский район"],
    8: ["Яккасарайский район"], 9: ["Яккасарайский район"], 10: ["Юнусабадский район"], 11: ["Юнусабадский район"], 12: ["Мирабадский район"],
};

const LIST = [
    card(1, 3, 95000, 5), card(2, 3, 92000, 6), card(3, 3, 96000, 5), card(4, 2, 90000, 4), card(5, 3, 120000, 5),
    card(6, 3, 95000, 5, true), card(7, 4, 99000, 2), card(8, 3, 100000, 8), card(9, 1, 40000, 1),
    card(10, 2, 70000, 3), card(11, 3, 94000, 5), card(12, 3, 97000, 5),
];

const rank = (extra = {}) => rankSimilar({ current: LIST[0], candidates: LIST, currentId: 1, kind: "residential", locations: LOCATIONS, ...extra });

test("возвращает до 7 объектов, сам объект не включается", () => {
    const r = rank();
    assert.equal(r.length, 7);
    assert.ok(!r.some((x) => x.item.id === 1));
});

test("аренда и продажа не смешиваются", () => {
    assert.ok(!rank().some((x) => x.item.id === 6));
});

test("тот же район и те же комнаты идут выше остальных", () => {
    const r = rank();
    assert.equal(r[0].item.id, 2);
    assert.ok(r[0].reasons.some((x) => x.code === "district"));
    assert.ok(r[0].reasons.some((x) => x.code === "rooms"));
});

test("дорогой объект из другого района не попадает в топ", () => {
    assert.ok(!rank({ limit: 3 }).some((x) => x.item.id === 5));
});

test("без текущего объекта или списка — пустой результат", () => {
    assert.deepEqual(rankSimilar({ current: null, candidates: LIST }), []);
    assert.deepEqual(rankSimilar({ current: LIST[0], candidates: null }), []);
});
