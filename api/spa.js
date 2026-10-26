import {
    getSupabase,
    parseListingId,
    propertyExists,
    commercialExists,
    getListingMeta,
    getDistrictsWithListings,
    LANGS,
    DEFAULT_LANG,
} from "./_publicDb.js";
import { buildListingHead, buildDistrictHead, buildStaticHead, injectHead, injectRootContent } from "./_seoMeta.js";
import { DISTRICT_PAGE_KINDS, districtKeyFromSlug } from "../src/utils/districtPages.js";
import { STATIC_PAGES } from "../src/utils/staticPages.js";

const SHELL_HEADER = "x-urbankey-shell";

const HERO_POSTER = "/hero-poster.webp";

export function injectHeroPreload(html) {
    if (!/<\/head>/i.test(html)) return html;
    const tags = [HERO_POSTER]
        .map((href) => `<link rel="preload" as="image" href="${href}" fetchpriority="high" />`)
        .join("\n  ");
    return html.replace(/<\/head>/i, () => `  ${tags}\n</head>`);
}

async function loadShell(req) {
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0];

    const headers = { [SHELL_HEADER]: "1" };
    if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
        headers["x-vercel-protection-bypass"] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    }

    const response = await fetch(`${proto}://${host}/index.html`, {
        headers,
        signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) throw new Error(`index.html -> ${response.status}`);

    const html = await response.text();
    if (!html.includes('id="root"')) throw new Error("index.html is not the app shell");
    return html;
}

export default async function handler(req, res) {
    if (req.headers[SHELL_HEADER]) {
        res.status(404).send("Not found");
        return;
    }

    const kind = String(req.query.kind || "notfound");
    const id = parseListingId(String(req.query.id || ""));

    const rawLang = String(req.query.lang || DEFAULT_LANG);
    const lang = LANGS.includes(rawLang) ? rawLang : DEFAULT_LANG;

    let status = 404;
    let checkState = "ok";
    let listingMeta = null;
    let emptyDistrict = false;
    let pageHead = null;

    if (kind === "property" || kind === "commercial") {
        let exists;

        if (id === null) {
            exists = false;
        } else {
            const supabase = getSupabase({ timeoutMs: 3000 });

            if (!supabase) {
                console.error("spa: Supabase env vars not configured, skipping existence check");
                checkState = "skipped-no-config";
                exists = true;
            } else {
                let result = null;
                try {
                    result = kind === "property"
                        ? await propertyExists(supabase, id)
                        : await commercialExists(supabase, id);
                } catch (err) {
                    console.error("spa: existence check threw:", err);
                }

                if (result === true) {
                    listingMeta = await getListingMeta(supabase, kind, id);
                }

                if (result === null) {
                    checkState = "skipped-error";
                    exists = true;
                } else {
                    exists = result;
                }
            }
        }

        status = exists ? 200 : 404;
    }

    if (kind === "district") {
        const dtype = String(req.query.dtype || "");
        const key = districtKeyFromSlug(String(req.query.district || ""));
        if (DISTRICT_PAGE_KINDS.includes(dtype) && key) {
            pageHead = buildDistrictHead({ kind: dtype, key, lang });
            status = pageHead ? 200 : 404;

            if (status === 200) {
                const supabase = getSupabase({ timeoutMs: 3000 });
                const found = supabase ? await getDistrictsWithListings(supabase) : null;
                if (found && !found[dtype === "commercial" ? "commercial" : "apartments"].has(key)) {
                    emptyDistrict = true;
                }
            }
        }
    }

    if (kind === "page") {
        const page = String(req.query.page || "");
        if (STATIC_PAGES.includes(page)) {
            pageHead = buildStaticHead({ page, lang });
            status = pageHead ? 200 : 404;
        }
    }

    let html;
    try {
        html = await loadShell(req);
    } catch (err) {
        console.error("spa: cannot load index.html:", err.message);
        res.setHeader("Retry-After", "30");
        res.setHeader("Cache-Control", "no-store");
        res.status(503).send("Service temporarily unavailable");
        return;
    }

    if (status === 200 && checkState === "ok" && listingMeta) {
        try {
            html = injectHead(html, buildListingHead({ kind, id, lang, meta: listingMeta }));
        } catch (err) {
            console.error("spa: head injection failed:", err);
        }
    }

    if (status === 200 && pageHead) {
        try {
            html = injectRootContent(injectHead(html, pageHead), pageHead.body);
        } catch (err) {
            console.error("spa: page head injection failed:", err);
        }
    }

    if (status === 200 && kind === "page" && String(req.query.page || "") === "home") {
        html = injectHeroPreload(html);
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("X-SPA-Existence-Check", checkState);

    const sharedShellPage = kind === "page" || kind === "district";

    if (checkState !== "ok") {
        res.setHeader("Cache-Control", "no-store");
    } else if (sharedShellPage && status === 200) {
        res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    } else {
        res.setHeader("Cache-Control", "public, s-maxage=60");
    }

    if (emptyDistrict) {
        res.setHeader("X-Robots-Tag", "noindex, follow");
    }

    if (status === 404) {
        res.setHeader("X-Robots-Tag", "noindex");
    }
    res.status(status).send(html);
}
