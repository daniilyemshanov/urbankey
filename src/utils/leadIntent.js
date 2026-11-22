/**
 * Intelligent Lead Intent & Engagement Tracker for UrbanKey
 * Evaluates real user interest before presenting the lead modal.
 */

const SESSION_PAGES_KEY = "urbankey_intent_pages_viewed";
const SESSION_START_KEY = "urbankey_intent_start_time";
const SESSION_DETAILS_KEY = "urbankey_intent_details_viewed";

/**
 * Initializes or updates session engagement counters on route changes
 */
export const recordPageEngagement = (pathname = "") => {
    if (typeof window === "undefined" || !window.sessionStorage) return;

    try {
        // Track session start time
        if (!window.sessionStorage.getItem(SESSION_START_KEY)) {
            window.sessionStorage.setItem(SESSION_START_KEY, String(Date.now()));
        }

        // Increment total pages viewed
        const pages = Number(window.sessionStorage.getItem(SESSION_PAGES_KEY) || 0) + 1;
        window.sessionStorage.setItem(SESSION_PAGES_KEY, String(pages));

        // Track detail pages viewed (high intent signal)
        if (pathname.includes("/property/") || pathname.includes("/commercial/")) {
            const details = Number(window.sessionStorage.getItem(SESSION_DETAILS_KEY) || 0) + 1;
            window.sessionStorage.setItem(SESSION_DETAILS_KEY, String(details));
        }
    } catch {
        // Safe failover
    }
};

/**
 * Returns current session engagement metrics
 */
export const getEngagementMetrics = () => {
    if (typeof window === "undefined" || !window.sessionStorage) {
        return { pagesViewed: 0, detailsViewed: 0, secondsOnSite: 0 };
    }

    try {
        const pagesViewed = Number(window.sessionStorage.getItem(SESSION_PAGES_KEY) || 0);
        const detailsViewed = Number(window.sessionStorage.getItem(SESSION_DETAILS_KEY) || 0);
        const startTime = Number(window.sessionStorage.getItem(SESSION_START_KEY) || Date.now());
        const secondsOnSite = Math.max(0, Math.floor((Date.now() - startTime) / 1000));

        return { pagesViewed, detailsViewed, secondsOnSite };
    } catch {
        return { pagesViewed: 0, detailsViewed: 0, secondsOnSite: 0 };
    }
};

/**
 * Detects current browsing context (commercial vs residential vs general)
 */
export const detectIntentContext = (pathname = "") => {
    const lower = String(pathname || "").toLowerCase();

    if (lower.includes("commercial")) {
        return {
            type: "commercial",
            titleKey: "leadPopupTitleCommercial",
            subtitleKey: "leadPopupSubtitleCommercial"
        };
    }

    if (lower.includes("rent")) {
        return {
            type: "rent",
            titleKey: "leadPopupTitleRent",
            subtitleKey: "leadPopupSubtitleRent"
        };
    }

    return {
        type: "buy",
        titleKey: "leadPopupTitle",
        subtitleKey: "leadPopupSubtitle"
    };
};

/**
 * Checks if user is currently typing in an input elsewhere on the page
 */
export const isUserActivelyTyping = () => {
    if (typeof document === "undefined") return false;
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || active.isContentEditable;
};
