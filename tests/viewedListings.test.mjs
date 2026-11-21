import test from "node:test";
import assert from "node:assert/strict";

import {
    isListingViewed,
    markListingViewed
} from "../src/utils/viewedListings.js";

// Mock localStorage in global window environment
class MockLocalStorage {
    constructor() {
        this.store = {};
    }
    getItem(key) {
        return this.store[key] || null;
    }
    setItem(key, value) {
        this.store[key] = String(value);
    }
    clear() {
        this.store = {};
    }
}

test("viewedListings tracks residential and commercial listings", () => {
    global.window = {
        localStorage: new MockLocalStorage(),
        dispatchEvent: () => {}
    };

    assert.equal(isListingViewed(10, "residential"), false);
    assert.equal(isListingViewed(20, "commercial"), false);

    markListingViewed(10, "residential");
    assert.equal(isListingViewed(10, "residential"), true);
    assert.equal(isListingViewed(10), true);
    assert.equal(isListingViewed(20, "commercial"), false);

    markListingViewed(20, "commercial");
    assert.equal(isListingViewed(20, "commercial"), true);
    assert.equal(isListingViewed(20), true);
});
