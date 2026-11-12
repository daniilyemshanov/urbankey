import { getSupabase, noRetry, getDistrictsWithListings, fetchAllRows, SITE_ORIGIN, LANGS, DEFAULT_LANG } from "./_publicDb.js";
import { allDistrictPages, districtBasePath } from "../src/utils/districtPages.js";
import { getAvailableLangs } from "./_seoMeta.js";

const STATIC_PATHS = [
    { path: "", priority: "1.0", changefreq: "daily" },
    { path: "/Properties", priority: "0.9", changefreq: "daily" },
    { path: "/AboutUs", priority: "0.5", changefreq: "monthly" },
    { path: "/Services", priority: "0.5", changefreq: "monthly" },
    { path: "/Privacy", priority: "0.3", changefreq: "yearly" },
    { path: "/Terms", priority: "0.3", changefreq: "yearly" },
    { path: "/ContactUs", priority: "0.5", changefreq: "monthly" },
];

function xmlEscape(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function buildAlternates(basePath, langs = LANGS) {
    const alternates = langs.map((lang) => ({
        lang,
        href: `${SITE_ORIGIN}/${lang}${basePath}`,
    }));
    alternates.push({ lang: "x-default", href: `${SITE_ORIGIN}/${DEFAULT_LANG}${basePath}` });
    return alternates;
}

function buildUrlBlocks(basePath, priority, changefreq, langs = LANGS, lastmod = null) {
    const alternates = buildAlternates(basePath, langs);
    return langs.map((lang) => {
        let block = `  <url>\n    <loc>${xmlEscape(`${SITE_ORIGIN}/${lang}${basePath}`)}</loc>\n`;
        if (lastmod) {
            block += `    <lastmod>${xmlEscape(lastmod)}</lastmod>\n`;
        }
        block += `    <changefreq>${changefreq}</changefreq>\n`;
        block += `    <priority>${priority}</priority>\n`;
        for (const alt of alternates) {
            block += `    <xhtml:link rel="alternate" hreflang="${alt.lang}" href="${xmlEscape(alt.href)}" />\n`;
        }
        return block + `  </url>\n`;
    });
}

async function publishedProperties(supabase) {
    const [cards, villas] = await Promise.all([
        fetchAllRows(supabase, "cardss_public", "id, title_ru, title_en, title_uz", "id"),
        fetchAllRows(supabase, "villas", "id, card_id", "id"),
    ]);

    const visibleCards = new Map(cards.map((c) => [c.id, c]));

    const seen = new Set();
    const items = [];
    for (const villa of villas) {
        if (villa.card_id != null && visibleCards.has(villa.card_id) && !seen.has(villa.card_id)) {
            seen.add(villa.card_id);
            items.push(visibleCards.get(villa.card_id));
        }
    }
    return items.sort((a, b) => a.id - b.id);
}

async function publishedCommercials(supabase) {
    // Commercials can be rendered with or without commercial_pages row.
    // Any active, non-sold commercial listing in commercials_public is public & indexable.
    const commercials = await fetchAllRows(
        supabase,
        "commercials_public",
        "id, title_ru, title_en, title_uz, delivery_date",
        "id"
    );

    const seen = new Set();
    const items = [];
    for (const com of commercials) {
        if (!seen.has(com.id)) {
            seen.add(com.id);
            items.push(com);
        }
    }
    return items.sort((a, b) => a.id - b.id);
}

export default async function handler(req, res) {
    const supabase = getSupabase({ timeoutMs: 6000 });

    if (!supabase) {
        console.error("sitemap: Supabase env vars not configured");
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Retry-After", "300");
        res.status(503).send("Sitemap temporarily unavailable");
        return;
    }

    let properties;
    let commercials;

    try {
        [properties, commercials] = await Promise.all([
            publishedProperties(supabase),
            publishedCommercials(supabase),
        ]);
    } catch (err) {
        console.error("sitemap: failed to read listings:", err?.message || err);
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Retry-After", "300");
        res.status(503).send("Sitemap temporarily unavailable");
        return;
    }

    const blocks = [];

    // 1. Static pages (all languages translated)
    for (const { path, priority, changefreq } of STATIC_PATHS) {
        blocks.push(...buildUrlBlocks(path, priority, changefreq, LANGS));
    }

    // 2. District pages (only those with listings)
    const withListings = await getDistrictsWithListings(supabase);
    for (const { kind, key } of allDistrictPages()) {
        if (withListings && !withListings[kind === "commercial" ? "commercial" : "apartments"].has(key)) continue;
        blocks.push(...buildUrlBlocks(districtBasePath(kind, key), "0.7", "weekly", LANGS));
    }

    // 3. Properties (only emit URLs for languages that actually have content for this listing)
    for (const item of properties) {
        const langs = getAvailableLangs({ title: { ru: item.title_ru, en: item.title_en, uz: item.title_uz } });
        blocks.push(...buildUrlBlocks(`/property/${item.id}`, "0.8", "weekly", langs));
    }

    // 4. Commercials (only emit URLs for languages that actually have content for this listing)
    for (const item of commercials) {
        const langs = getAvailableLangs({ title: { ru: item.title_ru, en: item.title_en, uz: item.title_uz } });
        const lastmod = item.delivery_date ? String(item.delivery_date).slice(0, 10) : null;
        blocks.push(...buildUrlBlocks(`/commercial/${item.id}`, "0.8", "weekly", langs, lastmod));
    }

    const xml =
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
        blocks.join("") +
        `</urlset>\n`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).send(xml);
}
