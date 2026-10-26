import { getSupabase, noRetry, getDistrictsWithListings, SITE_ORIGIN, LANGS, DEFAULT_LANG } from "./_publicDb.js";
import { allDistrictPages, districtBasePath } from "../src/utils/districtPages.js";

const STATIC_PATHS = [
    { path: "", priority: "1.0", changefreq: "daily" },
    { path: "/Properties", priority: "0.9", changefreq: "daily" },
    { path: "/AboutUs", priority: "0.5", changefreq: "monthly" },
    { path: "/Services", priority: "0.5", changefreq: "monthly" },
    { path: "/ContactUs", priority: "0.5", changefreq: "monthly" },
];

const PAGE_SIZE = 1000;

function xmlEscape(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function buildAlternates(basePath) {
    const alternates = LANGS.map((lang) => ({
        lang,
        href: `${SITE_ORIGIN}/${lang}${basePath}`,
    }));
    alternates.push({ lang: "x-default", href: `${SITE_ORIGIN}/${DEFAULT_LANG}${basePath}` });
    return alternates;
}

function buildUrlBlocks(basePath, priority, changefreq) {
    const alternates = buildAlternates(basePath);
    return LANGS.map((lang) => {
        let block = `  <url>\n    <loc>${xmlEscape(`${SITE_ORIGIN}/${lang}${basePath}`)}</loc>\n`;
        block += `    <changefreq>${changefreq}</changefreq>\n`;
        block += `    <priority>${priority}</priority>\n`;
        for (const alt of alternates) {
            block += `    <xhtml:link rel="alternate" hreflang="${alt.lang}" href="${xmlEscape(alt.href)}" />\n`;
        }
        return block + `  </url>\n`;
    });
}

async function fetchAll(supabase, table, columns, orderColumn) {
    const rows = [];
    for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await noRetry(
            supabase
                .from(table)
                .select(columns)
                .order(orderColumn, { ascending: true })
                .range(from, from + PAGE_SIZE - 1)
        );

        if (error) throw new Error(`${table}: ${error.message}`);
        rows.push(...data);
        if (data.length < PAGE_SIZE) break;
    }
    return rows;
}

async function publishedPropertyIds(supabase) {
    const [cards, villas] = await Promise.all([
        fetchAll(supabase, "cardss_public", "id", "id"),
        fetchAll(supabase, "villas", "id, card_id", "id"),
    ]);

    const visibleCards = new Set(cards.map((c) => c.id));

    const ids = new Set();
    for (const villa of villas) {
        if (villa.card_id != null && visibleCards.has(villa.card_id)) ids.add(villa.card_id);
    }
    return [...ids].sort((a, b) => a - b);
}

async function publishedCommercialIds(supabase) {
    const [commercials, pages] = await Promise.all([
        fetchAll(supabase, "commercials_public", "id", "id"),
        fetchAll(supabase, "commercial_pages", "id, commercial_id", "id"),
    ]);

    const visible = new Set(commercials.map((c) => c.id));
    const ids = new Set();

    for (const page of pages) {
        if (page.commercial_id != null && visible.has(page.commercial_id)) {
            ids.add(page.commercial_id);
        }
    }
    return [...ids].sort((a, b) => a - b);
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

    let propertyIds;
    let commercialIds;

    try {
        [propertyIds, commercialIds] = await Promise.all([
            publishedPropertyIds(supabase),
            publishedCommercialIds(supabase),
        ]);
    } catch (err) {
        console.error("sitemap: failed to read listings:", err.message);
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Retry-After", "300");
        res.status(503).send("Sitemap temporarily unavailable");
        return;
    }

    const blocks = [];

    for (const { path, priority, changefreq } of STATIC_PATHS) {
        blocks.push(...buildUrlBlocks(path, priority, changefreq));
    }
    const withListings = await getDistrictsWithListings(supabase);
    for (const { kind, key } of allDistrictPages()) {
        if (withListings && !withListings[kind === "commercial" ? "commercial" : "apartments"].has(key)) continue;
        blocks.push(...buildUrlBlocks(districtBasePath(kind, key), "0.7", "weekly"));
    }
    for (const id of propertyIds) {
        blocks.push(...buildUrlBlocks(`/property/${id}`, "0.8", "weekly"));
    }
    for (const id of commercialIds) {
        blocks.push(...buildUrlBlocks(`/commercial/${id}`, "0.8", "weekly"));
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
