import { createClient } from "@supabase/supabase-js";
import { detectDistrict } from "../src/utils/districts.js";

export const SITE_ORIGIN = "https://urbankey.uz";
export const LANGS = ["ru", "en", "uz"];
export const DEFAULT_LANG = "ru";

export function getSupabase({ timeoutMs = 4000 } = {}) {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return null;

    const timedFetch = (input, init = {}) => {
        const timeout = AbortSignal.timeout(timeoutMs);
        const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
        return fetch(input, { ...init, signal });
    };

    return createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: timedFetch },
    });
}

export function noRetry(query) {
    return typeof query.retry === "function" ? query.retry(false) : query;
}

export function parseListingId(raw) {
    if (typeof raw !== "string" || !/^[1-9]\d{0,17}$/.test(raw)) return null;
    return Number(raw);
}

export async function propertyExists(supabase, id) {
    const { data, error } = await noRetry(
        supabase
            .from("villas")
            .select("card_id")
            .eq("card_id", id)
            .limit(1)
            .maybeSingle()
    );

    if (error) {
        console.error("propertyExists failed:", error.message);
        return null;
    }
    if (!data) return false;

    const { data: card, error: cardError } = await noRetry(
        supabase
            .from("cardss_public")
            .select("id")
            .eq("id", id)
            .maybeSingle()
    );

    if (cardError) {
        if (cardError.code === "42P01") return true;
        console.error("propertyExists(card) failed:", cardError.message);
        return null;
    }
    return Boolean(card);
}

export async function commercialExists(supabase, id) {
    const { data: page, error } = await noRetry(
        supabase
            .from("commercial_pages")
            .select("commercial_id")
            .eq("commercial_id", id)
            .maybeSingle()
    );

    if (error) {
        console.error("commercialExists(page) failed:", error.message);
        return null;
    }
    const { data: base, error: baseError } = await noRetry(
        supabase
            .from("commercials_public")
            .select("id")
            .eq("id", id)
            .maybeSingle()
    );

    if (baseError) {
        console.error("commercialExists(base) failed:", baseError.message);
        return null;
    }
    if (page && !base) return false;
    return Boolean(base);
}

export async function getListingMeta(supabase, kind, id) {
    const view = kind === "property" ? "cardss_public" : "commercials_public";
    try {
        const { data, error } = await noRetry(
            supabase
                .from(view)
                .select("title_ru, title_en, title_uz, description_ru, description_en, description_uz, image")
                .eq("id", id)
                .maybeSingle()
        );
        if (error || !data) return null;
        return {
            title: { ru: data.title_ru, en: data.title_en, uz: data.title_uz },
            description: { ru: data.description_ru, en: data.description_en, uz: data.description_uz },
            image: data.image,
        };
    } catch (err) {
        console.error("getListingMeta failed:", err);
        return null;
    }
}

export async function getDistrictsWithListings(supabase) {
    try {
        const [homes, commercials, villas] = await Promise.all([
            noRetry(
                supabase
                    .from("cardss_public")
                    .select("id, title_ru, title_en, title_uz, description_ru, description_en, description_uz")
                    .limit(2000)
            ),
            noRetry(
                supabase
                    .from("commercials_public")
                    .select(
                        "title_ru, title_en, title_uz, description_ru, description_en, description_uz, " +
                        "district_ru, district_en, district_uz, address_ru, address_en, address_uz"
                    )
                    .limit(2000)
            ),
            noRetry(
                supabase
                    .from("villas")
                    .select("card_id, location_ru, location_en, location_uz")
                    .limit(5000)
            ),
        ]);
        if (homes.error || commercials.error) {
            console.error("getDistrictsWithListings failed:", (homes.error || commercials.error).message);
            return null;
        }

        const locationByCard = new Map();
        if (!villas.error) {
            for (const v of villas.data || []) {
                if (v.card_id != null && !locationByCard.has(v.card_id)) {
                    locationByCard.set(v.card_id, [v.location_ru, v.location_en, v.location_uz]);
                }
            }
        }

        const apartments = new Set();
        for (const r of homes.data || []) {
            const key = detectDistrict([
                ...(locationByCard.get(r.id) || []),
                r.title_ru, r.title_en, r.title_uz,
                r.description_ru, r.description_en, r.description_uz,
            ]);
            if (key) apartments.add(key);
        }

        const commercial = new Set();
        for (const r of commercials.data || []) {
            const key = detectDistrict([
                r.district_ru, r.district_en, r.district_uz,
                r.address_ru, r.address_en, r.address_uz,
                r.title_ru, r.title_en, r.title_uz,
                r.description_ru, r.description_en, r.description_uz,
            ]);
            if (key) commercial.add(key);
        }
        return { apartments, commercial };
    } catch (err) {
        console.error("getDistrictsWithListings threw:", err);
        return null;
    }
}
