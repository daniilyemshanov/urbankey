import { test } from "node:test";
import assert from "node:assert/strict";
import { hasValue } from "../src/utils/hasValue.js";

test("пустые значения: нет что показывать", () => {
    for (const v of [undefined, null, "", "   ", "—", "-", "–", 0, "0", "0.0", " 0 ", NaN, "null", "undefined", false]) {
        assert.equal(hasValue(v), false, JSON.stringify(v));
    }
});

test("значения, которые показываем", () => {
    for (const v of [68, "68", "2,5", 95000, "Яккасарайский район", "3 спальни", true, "Офис"]) {
        assert.equal(hasValue(v), true, JSON.stringify(v));
    }
});
