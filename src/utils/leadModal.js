/**
 * Helpers and event dispatchers for the UrbanKey Lead Modal
 */

export const LEAD_DISMISSED_KEY = "urbankey_lead_modal_dismissed_until";
export const LEAD_CONVERTED_KEY = "urbankey_lead_modal_converted";
export const LEAD_SESSION_KEY = "urbankey_lead_modal_session_shown";

const DEFAULT_DISMISS_DAYS = 5;

export const openLeadModal = (options = {}) => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
        new CustomEvent("urbankey_open_lead_modal", {
            detail: {
                source: options.source || "cta_button",
                type: options.type || "buy",
                title: options.title,
                ...options
            }
        })
    );
};

export const isLeadModalSuppressed = () => {
    if (typeof window === "undefined" || !window.localStorage) return false;

    try {
        // Converted users should never see automatic popups
        if (window.localStorage.getItem(LEAD_CONVERTED_KEY) === "true") {
            return true;
        }

        // Dismissed users (3-7 days rule; default 5 days)
        const dismissedUntil = Number(window.localStorage.getItem(LEAD_DISMISSED_KEY) || 0);
        if (dismissedUntil > Date.now()) {
            return true;
        }

        // Already shown in this session
        if (window.sessionStorage && window.sessionStorage.getItem(LEAD_SESSION_KEY)) {
            return true;
        }

        return false;
    } catch {
        return false;
    }
};

export const markLeadModalDismissed = (days = DEFAULT_DISMISS_DAYS) => {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
        const ms = days * 24 * 60 * 60 * 1000;
        window.localStorage.setItem(LEAD_DISMISSED_KEY, String(Date.now() + ms));
    } catch {
        // Safe failover for private browsing
    }
};

export const markLeadModalConverted = () => {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
        window.localStorage.setItem(LEAD_CONVERTED_KEY, "true");
    } catch {
        // Safe failover
    }
};

export const markLeadModalSessionShown = () => {
    if (typeof window === "undefined" || !window.sessionStorage) return;
    try {
        window.sessionStorage.setItem(LEAD_SESSION_KEY, "1");
    } catch {
        // Safe failover
    }
};
