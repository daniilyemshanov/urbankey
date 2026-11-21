import { useState, useEffect } from "react";

const STORAGE_KEY = "urbankey_viewed_listings";

const getViewedSet = () => {
    if (typeof window === "undefined" || !window.localStorage) {
        return new Set();
    }
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return new Set();
        const parsed = JSON.parse(raw);
        return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
        return new Set();
    }
};

export const isListingViewed = (id, type) => {
    if (!id) return false;
    const set = getViewedSet();
    const strId = String(id);
    if (type) {
        if (set.has(`${type}_${strId}`) || set.has(strId)) return true;
    }
    return (
        set.has(strId) ||
        set.has(`residential_${strId}`) ||
        set.has(`commercial_${strId}`) ||
        set.has(`card_${strId}`)
    );
};

export const markListingViewed = (id, type) => {
    if (!id || typeof window === "undefined" || !window.localStorage) return;
    try {
        const set = getViewedSet();
        const strId = String(id);
        if (type) {
            set.add(`${type}_${strId}`);
        }
        set.add(strId);

        const arr = Array.from(set);
        if (arr.length > 1000) {
            arr.splice(0, arr.length - 1000);
        }
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));

        window.dispatchEvent(
            new CustomEvent("urbankey_viewed_update", {
                detail: { id, type }
            })
        );
    } catch {
        // Storage fail-safe (quota/private browsing)
    }
};

export const useIsListingNew = (id, type, enabled = true) => {
    const [isNew, setIsNew] = useState(() => {
        if (!enabled || !id) return false;
        return !isListingViewed(id, type);
    });

    useEffect(() => {
        if (!enabled || !id) {
            setIsNew(false);
            return;
        }

        setIsNew(!isListingViewed(id, type));

        const handler = () => {
            setIsNew(!isListingViewed(id, type));
        };

        window.addEventListener("urbankey_viewed_update", handler);
        window.addEventListener("storage", handler);

        return () => {
            window.removeEventListener("urbankey_viewed_update", handler);
            window.removeEventListener("storage", handler);
        };
    }, [id, type, enabled]);

    return isNew;
};
