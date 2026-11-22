import test from "node:test";
import assert from "node:assert/strict";

import {
    extractUzLocalDigits,
    formatUzPhone,
    isUzPhoneValid,
    toE164UzPhone
} from "../src/utils/phoneMask.js";

import {
    isLeadModalSuppressed,
    markLeadModalDismissed,
    markLeadModalConverted,
    markLeadModalSessionShown,
    LEAD_DISMISSED_KEY,
    LEAD_CONVERTED_KEY,
    LEAD_SESSION_KEY
} from "../src/utils/leadModal.js";

import {
    trackLeadModalOpen,
    trackLeadFormStart,
    trackLeadFormSubmit,
    trackLeadFormSuccess,
    trackLeadFormError
} from "../src/analytics.js";

// Mock storage
class MemoryStorage {
    constructor() {
        this.data = new Map();
    }
    getItem(key) {
        return this.data.has(key) ? this.data.get(key) : null;
    }
    setItem(key, value) {
        this.data.set(key, String(value));
    }
    removeItem(key) {
        this.data.delete(key);
    }
    clear() {
        this.data.clear();
    }
}

test("phoneMask extracts and formats Uzbekistan phone numbers correctly", () => {
    // Empty
    assert.equal(formatUzPhone(""), "");
    assert.equal(isUzPhoneValid(""), false);

    // Partial input
    assert.equal(formatUzPhone("90"), "+998 (90) ");
    assert.equal(isUzPhoneValid("90"), false);

    // Full 9 digits
    const formatted = formatUzPhone("901234567");
    assert.equal(formatted, "+998 (90) 123-45-67");
    assert.equal(isUzPhoneValid("901234567"), true);
    assert.equal(toE164UzPhone("901234567"), "+998901234567");

    // Full input with country code or dashes pasted
    assert.equal(formatUzPhone("+998 90 123 45 67"), "+998 (90) 123-45-67");
    assert.equal(isUzPhoneValid("+998 90 123 45 67"), true);

    // Local 8-prefix pasted
    assert.equal(formatUzPhone("8901234567"), "+998 (90) 123-45-67");
    assert.equal(isUzPhoneValid("8901234567"), true);

    // Truncates past 9 digits
    assert.equal(formatUzPhone("901234567899999"), "+998 (90) 123-45-67");
});

test("leadModal frequency capping respects dismissal, conversion, and session", () => {
    const localStorage = new MemoryStorage();
    const sessionStorage = new MemoryStorage();

    global.window = {
        localStorage,
        sessionStorage,
        dispatchEvent: () => {}
    };

    // Initially not suppressed
    assert.equal(isLeadModalSuppressed(), false);

    // Mark dismissed for 5 days
    markLeadModalDismissed(5);
    assert.equal(isLeadModalSuppressed(), true);

    // Clear dismissal
    localStorage.removeItem(LEAD_DISMISSED_KEY);
    assert.equal(isLeadModalSuppressed(), false);

    // Mark session shown
    markLeadModalSessionShown();
    assert.equal(isLeadModalSuppressed(), true);

    // Clear session
    sessionStorage.removeItem(LEAD_SESSION_KEY);
    assert.equal(isLeadModalSuppressed(), false);

    // Mark converted
    markLeadModalConverted();
    assert.equal(isLeadModalSuppressed(), true);
});

test("analytics lead modal events are sanitized and contain zero PII", () => {
    let capturedEvent = null;
    let capturedParams = null;

    global.window = {
        gtag: (type, eventName, params) => {
            if (type === "event") {
                capturedEvent = eventName;
                capturedParams = params;
            }
        }
    };

    // lead_modal_open
    trackLeadModalOpen({ trigger: "exit_intent", source: "LeadPopup" });
    assert.equal(capturedEvent, "lead_modal_open");
    assert.equal(capturedParams.trigger_method, "exit_intent");
    assert.equal(capturedParams.lead_source, "LeadPopup");

    // lead_form_start
    trackLeadFormStart({ source: "LeadPopup" });
    assert.equal(capturedEvent, "lead_form_start");
    assert.equal(capturedParams.lead_source, "LeadPopup");

    // lead_form_submit
    trackLeadFormSubmit({ source: "LeadPopup", request_type: "buy" });
    assert.equal(capturedEvent, "lead_form_submit");
    assert.equal(capturedParams.request_type, "buy");

    // lead_form_success
    trackLeadFormSuccess({ source: "LeadPopup", request_type: "buy" });
    assert.equal(capturedEvent, "lead_form_success");
    assert.equal(capturedParams.request_type, "buy");

    // lead_form_error
    trackLeadFormError({ source: "LeadPopup", error_code: "timeout" });
    assert.equal(capturedEvent, "lead_form_error");
    assert.equal(capturedParams.error_code, "timeout");

    // Check PII protection: if any PII keys are passed, they must be stripped
    global.window.gtag = (type, eventName, params) => {
        capturedParams = params;
    };
    trackLeadFormSubmit({
        source: "LeadPopup",
        request_type: "commercial",
        name: "Secret User",
        phone: "+998901234567"
    });
    assert.equal(capturedParams.name, undefined);
    assert.equal(capturedParams.phone, undefined);
});

test("leadIntent correctly detects browsing context and tracks engagement metrics", async () => {
    const {
        recordPageEngagement,
        getEngagementMetrics,
        detectIntentContext
    } = await import("../src/utils/leadIntent.js");

    const sessionStorage = new MemoryStorage();
    global.window = { sessionStorage };

    // Initial metrics
    assert.equal(getEngagementMetrics().pagesViewed, 0);
    assert.equal(getEngagementMetrics().detailsViewed, 0);

    // Visit home page
    recordPageEngagement("/");
    assert.equal(getEngagementMetrics().pagesViewed, 1);

    // Visit property detail page
    recordPageEngagement("/property/42");
    assert.equal(getEngagementMetrics().detailsViewed, 1);

    // Visit commercial detail page
    recordPageEngagement("/commercial/15");
    assert.equal(getEngagementMetrics().detailsViewed, 2);

    // Context detection
    assert.equal(detectIntentContext("/commercial/15").type, "commercial");
    assert.equal(detectIntentContext("/Properties/apartments/chilanzar").type, "buy");
    assert.equal(detectIntentContext("/Properties/rent").type, "rent");
});
