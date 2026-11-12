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
    return Boolean(base);
}

// Optional SEO fields must never break the primary listing meta: any error,
// exception or missing row simply yields null.
async function optionalRow(run) {
    try {
        const { data, error } = await run();
        if (error || !data) return null;
        return data;
    } catch {
        return null;
    }
}

const trio = (row, base) => ({ ru: row[`${base}_ru`], en: row[`${base}_en`], uz: row[`${base}_uz`] });

export async function getListingMeta(supabase, kind, id) {
    const view = kind === "property" ? "cardss_public" : "commercials_public";
    try {
        const [primary, extra, villa] = await Promise.all([
            noRetry(
                supabase
                    .from(view)
                    .select("title_ru, title_en, title_uz, description_ru, description_en, description_uz, image")
                    .eq("id", id)
                    .maybeSingle()
            ),
            optionalRow(() => noRetry(
                supabase
                    .from(view)
                    .select(
                        kind === "property"
                            ? "bedrooms_ru, bedrooms_en, bedrooms_uz, type_ru, type_en, type_uz, price"
                            : "district_ru, district_en, district_uz, address_ru, address_en, address_uz, " +
                              "class_ru, class_en, class_uz, area, floor, price"
                    )
                    .eq("id", id)
                    .maybeSingle()
            )),
            kind === "property"
                ? optionalRow(() => noRetry(
                    supabase
                        .from("villas")
                        .select("location_ru, location_en, location_uz")
                        .eq("card_id", id)
                        .limit(1)
                        .maybeSingle()
                ))
                : null,
        ]);

        const { data, error } = primary;
        if (error || !data) return null;

        const meta = {
            title: { ru: data.title_ru, en: data.title_en, uz: data.title_uz },
            description: { ru: data.description_ru, en: data.description_en, uz: data.description_uz },
            image: data.image,
        };

        if (extra) {
            meta.price = extra.price;
            meta.facts = kind === "property"
                ? { bedrooms: trio(extra, "bedrooms"), type: trio(extra, "type") }
                : {
                    district: trio(extra, "district"),
                    address: trio(extra, "address"),
                    class: trio(extra, "class"),
                    area: extra.area,
                    floor: extra.floor,
                };
        }
        if (villa) meta.location = trio(villa, "location");

        return meta;
    } catch (err) {
        console.error("getListingMeta failed:", err);
        return null;
    }
}

export async function fetchAllRows(supabase, table, columns, orderColumn = "id", pageSize = 1000) {
    const rows = [];
    for (let from = 0; ; from += pageSize) {
        const { data, error } = await noRetry(
            supabase
                .from(table)
                .select(columns)
                .order(orderColumn, { ascending: true })
                .range(from, from + pageSize - 1)
        );

        if (error) throw new Error(`${table}: ${error.message}`);
        if (!data || !Array.isArray(data)) break;
        rows.push(...data);
        if (data.length < pageSize) break;
    }
    return rows;
}

export async function getDistrictsWithListings(supabase) {
    try {
        const [homes, commercials, villas] = await Promise.all([
            fetchAllRows(
                supabase,
                "cardss_public",
                "id, title_ru, title_en, title_uz, description_ru, description_en, description_uz",
                "id"
            ),
            fetchAllRows(
                supabase,
                "commercials_public",
                "title_ru, title_en, title_uz, description_ru, description_en, description_uz, " +
                "district_ru, district_en, district_uz, address_ru, address_en, address_uz",
                "id"
            ),
            fetchAllRows(
                supabase,
                "villas",
                "card_id, location_ru, location_en, location_uz",
                "id"
            ),
        ]);

        const locationByCard = new Map();
        for (const v of villas) {
            if (v.card_id != null && !locationByCard.has(v.card_id)) {
                locationByCard.set(v.card_id, [v.location_ru, v.location_en, v.location_uz]);
            }
        }

        const apartments = new Set();
        for (const r of homes) {
            const key = detectDistrict([
                ...(locationByCard.get(r.id) || []),
                r.title_ru, r.title_en, r.title_uz,
                r.description_ru, r.description_en, r.description_uz,
            ]);
            if (key) apartments.add(key);
        }

        const commercial = new Set();
        for (const r of commercials) {
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
        console.error("getDistrictsWithListings failed:", err?.message || err);
        return null;
    }
}
