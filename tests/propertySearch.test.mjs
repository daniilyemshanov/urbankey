import test from "node:test";
import assert from "node:assert/strict";
import { parsePropertyQuery, searchFiltersFromUrl, searchFiltersToParams } from "../src/utils/propertySearch.js";

test("RU natural query extracts apartment sale, price, rooms and district alias", () => {
    const result = parsePropertyQuery("Купить квартиру в Юнусабаде до 100 тысяч долларов, 2 комнаты");
    assert.equal(result.filters.category, "residential");
    assert.equal(result.filters.type, "apartment");
    assert.equal(result.filters.dealType, "sale");
    assert.equal(result.filters.maxPrice, 100000);
    assert.equal(result.filters.minBedrooms, 2);
    assert.equal(result.filters.district, "yunusabad");
});

test("UZ natural query extracts rent, commercial type and area", () => {
    const result = parsePropertyQuery("ijara commercial ofis 100 sqm dan");
    assert.equal(result.filters.category, "commercial");
    assert.equal(result.filters.type, "office");
    assert.equal(result.filters.dealType, "rent");
    assert.equal(result.filters.minArea, 100);
});

test("EN query extracts apartment type and price without inventing a deal", () => {
    const result = parsePropertyQuery("Apartment up to $80k in Yunusabad");
    assert.equal(result.filters.category, "residential");
    assert.equal(result.filters.type, "apartment");
    assert.equal(result.filters.maxPrice, 80000);
    assert.equal(result.filters.district, "yunusabad");
    assert.equal(result.filters.dealType, undefined);
});

test("area is not mistaken for a price and a budget range inherits its unit", () => {
    const area = parsePropertyQuery("Офис от 100 квадратных метров");
    assert.equal(area.filters.minArea, 100);
    assert.equal(area.filters.minPrice, undefined);
    const range = parsePropertyQuery("50-80 тысяч долларов");
    assert.equal(range.filters.minPrice, 50000);
    assert.equal(range.filters.maxPrice, 80000);
});

test("central commercial search and district adjective are normalized", () => {
    const center = parsePropertyQuery("Коммерческое помещение возле центра");
    assert.equal(center.filters.category, "commercial");
    assert.equal(center.filters.location, "center");
    const district = parsePropertyQuery("Купить квартиру в Мирзо-Улугбекском районе");
    assert.equal(district.filters.district, "mirzo");
    assert.equal(district.filters.dealType, "sale");
});

test("room and new-build intent do not create a price filter", () => {
    const result = parsePropertyQuery("2-комнатная новостройка с ремонтом");
    assert.equal(result.filters.minBedrooms, 2);
    assert.equal(result.filters.type, "newbuilding");
    assert.equal(result.filters.maxPrice, undefined);
});

test("URL filters round trip and discard pagination state", () => {
    const source = new URLSearchParams("district=mirabad&page=8&utm_source=test");
    const filters = { q: "office", category: "commercial", type: "all", dealType: "rent", district: "mirabad", minPrice: "500", maxPrice: "", priceCurrency: "USD", minBedrooms: "", minArea: "100", maxArea: "", minFloor: "" };
    const params = searchFiltersToParams(filters, source);
    assert.equal(params.get("q"), "office");
    assert.equal(params.get("deal"), "rent");
    assert.equal(params.get("area"), "100");
    assert.equal(params.get("pc"), "USD");
    assert.equal(searchFiltersFromUrl(params).priceCurrency, "USD");
    assert.equal(params.get("page"), null);
    assert.equal(params.get("utm_source"), "test");
    assert.equal(searchFiltersFromUrl(params).district, "mirabad");
});

