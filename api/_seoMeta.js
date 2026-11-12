import { SITE_ORIGIN, LANGS, DEFAULT_LANG } from "./_publicDb.js";
import { getDistrictPage, districtBasePath } from "../src/utils/districtPages.js";
import { getStaticPage, staticBasePath } from "../src/utils/staticPages.js";
import { detectDistrict, districtLabel } from "../src/utils/districts.js";
import { buildResidenceJsonLd, buildCommercialJsonLd, buildBreadcrumbJsonLd, buildOrganizationJsonLd, buildWebSiteJsonLd } from "../src/utils/structuredData.js";
import { formatPriceIn } from "../src/utils/currency.js";

const SITE_NAME = "UrbanKey";
const FALLBACK_IMAGE = `${SITE_ORIGIN}/image%20(16).webp`;
const OG_LOCALES = { ru: "ru_RU", en: "en_US", uz: "uz_UZ" };

const DEFAULT_DESCRIPTION = {
    ru: "UrbanKey — подбор и продажа недвижимости в Ташкенте: квартиры, коммерческие объекты.",
    en: "UrbanKey — real estate selection and sales in Tashkent: apartments, commercial properties.",
    uz: "UrbanKey — Toshkentda ko'chmas mulk tanlash va sotish: kvartiralar, tijorat obyektlari.",
};

export function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

export function shortDescription(text, max = 160) {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    if (clean.length <= max) return clean;
    const cut = clean.slice(0, max - 1);
    const lastSpace = cut.lastIndexOf(" ");
    return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:!-]+$/, "") + "…";
}

function absoluteImage(url) {
    if (!url || typeof url !== "string") return FALLBACK_IMAGE;
    if (/^https?:\/\//i.test(url)) return encodeURI(decodeURI(url));
    return `${SITE_ORIGIN}${url.startsWith("/") ? "" : "/"}${encodeURI(url)}`;
}

// Absolute image URL, or null when missing/malformed (e.g. a stray "%").
function safeImage(url) {
    if (!url || typeof url !== "string") return null;
    try {
        return absoluteImage(url);
    } catch {
        return null;
    }
}

const PROPERTIES_LABEL = { ru: "Недвижимость", en: "Properties", uz: "Mulk" };
const AREA_UNIT = { ru: "м²", en: "m²", uz: "m²" };
const FACT_LABELS = {
    ru: { district: "Район", area: "Площадь", floor: "Этаж", rooms: "Комнат", price: "Цена" },
    en: { district: "District", area: "Area", floor: "Floor", rooms: "Rooms", price: "Price" },
    uz: { district: "Tuman", area: "Maydon", floor: "Qavat", rooms: "Xonalar", price: "Narx" },
};

export // Реклама цен в иностранной валюте запрещена, поэтому в текст для роботов (HTML,
// description, микроразметка) не попадают предложения со знаком $, USD, «у.е.»,
// «долларов» и т.п., а цена выводится только в сумах (или не выводится вовсе).
const CURRENCY_MENTION = /\$|(?<![\p{L}\d])usd(?![\p{L}\d])|dollar|долл|(?<![\p{L}\d])у\s?\.?\s?е(?![\p{L}\d])|(?<![\p{L}\d])y\.?\s?e(?![\p{L}\d])/iu;

export function stripForeignCurrency(text) {
    return String(text || "")
        .split(/\n+/)
        .map((line) =>
            line
                .split(/(?<=[.!?])\s+(?=[\p{Lu}\d])/u)
                .filter((sentence) => !CURRENCY_MENTION.test(sentence))
                .join(" ")
                .trim()
        )
        .filter(Boolean)
        .join("\n");
}

const stripTrio = (obj) =>
    Object.fromEntries(Object.entries(obj || {}).map(([lang, value]) => [lang, stripForeignCurrency(value)]));

// Цена для текста роботов: только в сумах; без курса цену в долларах не показываем.
export function priceInSoums(rawPrice, rate) {
    try {
        const shown = formatPriceIn(rawPrice, "UZS", rate);
        return shown && shown !== "—" ? String(shown) : "";
    } catch {
        return "";
    }
}

function jsonLdTags(objs) {
    return objs
        .filter(Boolean)
        .map((obj) => {
            const json = JSON.stringify(obj)
                .replace(/</g, "\\u003c")
                .replace(/\u2028/g, "\\u2028")
                .replace(/\u2029/g, "\\u2029");
            return `<script data-ssr-seo="1" type="application/ld+json">${json}</script>`;
        });
}

function buildListingJsonLd({ kind, id, lang, meta, canonical, title, rate }) {
    try {
        const image = safeImage(meta.image);
        const data = {
            title: meta.title,
            about: stripTrio(meta.description),
            images: image ? [image] : [],
            price: meta.price,
        };
        const listing = kind === "property"
            ? buildResidenceJsonLd({ villa: data, lang, url: canonical, rate })
            : buildCommercialJsonLd({ page: data, lang, url: canonical, rate });
        const breadcrumb = buildBreadcrumbJsonLd(
            [
                { name: SITE_NAME, path: "/" },
                { name: PROPERTIES_LABEL[lang], path: "/Properties" },
                { name: title, path: `/${kind}/${id}` },
            ],
            lang
        );
        return [listing, breadcrumb];
    } catch (err) {
        console.error("seo: listing JSON-LD failed:", err);
        return [];
    }
}

export function hasTranslation(field, lang) {
    if (!field || typeof field !== "object") return false;
    const val = field[lang];
    return typeof val === "string" && val.trim().length > 0;
}

export function getAvailableLangs(meta) {
    const ruAvailable = Boolean(meta?.title?.ru?.trim());
    const langs = [];
    if (ruAvailable) langs.push("ru");
    if (hasTranslation(meta?.title, "en")) langs.push("en");
    if (hasTranslation(meta?.title, "uz")) langs.push("uz");
    return langs.length > 0 ? langs : [DEFAULT_LANG];
}

export function buildListingBody({ kind, id, lang, meta, rate = null }) {
    const availableLangs = getAvailableLangs(meta);
    const effectiveLang = availableLangs.includes(lang) ? lang : DEFAULT_LANG;

    const pick = (obj) => (obj && (obj[effectiveLang] || obj.ru)) || "";
    const title = pick(meta?.title);
    if (!title) return "";

    const facts = meta.facts || {};
    const priceText = priceInSoums(meta.price, rate);
    const L = FACT_LABELS[effectiveLang];
    const text = (v) => String(v ?? "").trim();
    const labeled = (label, value) => (text(value) ? `${label}: ${text(value)}` : "");
    const area = text(facts.area) ? `${text(facts.area)} ${AREA_UNIT[effectiveLang]}` : "";
    const factParts = kind === "property"
        ? [
            pick(facts.type),
            labeled(L.district, pick(meta.location)),
            labeled(L.rooms, pick(facts.bedrooms)),
            labeled(L.price, priceText),
        ]
        : [
            pick(facts.class),
            labeled(L.district, pick(facts.district)),
            pick(facts.address),
            labeled(L.area, area),
            labeled(L.floor, facts.floor),
            labeled(L.price, priceText),
        ];
    const factsLine = factParts.map(text).filter(Boolean).join(" · ");
    const image = safeImage(meta.image);

    const description = stripForeignCurrency(pick(meta.description)).replace(/\s+/g, " ").trim().slice(0, 1500);

    const districtKey = detectDistrict([
        pick(meta.location), pick(facts.district), pick(facts.address), title, description,
    ]);
    const districtKind = kind === "commercial" ? "commercial" : "apartments";

    const links = [
        `<a href="/${effectiveLang}">${SITE_NAME}</a>`,
        `<a href="/${effectiveLang}/Properties">${escapeHtml(PROPERTIES_LABEL[effectiveLang])}</a>`,
    ];
    if (districtKey) {
        links.push(`<a href="/${effectiveLang}${districtBasePath(districtKind, districtKey)}">${escapeHtml(districtLabel(districtKey, effectiveLang))}</a>`);
    }

    const a = 'data-ssr-seo="1"';
    return `<main ${a} style="max-width:1440px;margin:0 auto;padding:120px 20px 0;font-family:sans-serif;color:#f5f5f5">` +
        `<h1>${escapeHtml(title)}</h1>` +
        (factsLine ? `<p>${escapeHtml(factsLine)}</p>` : "") +
        (image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" style="max-width:100%;height:auto" />` : "") +
        (description ? `<p>${escapeHtml(description)}</p>` : "") +
        `<nav>${links.join(" | ")}</nav></main>`;
}

export function buildListingHead({ kind, id, lang, meta, rate = null }) {
    const availableLangs = getAvailableLangs(meta);
    const isLangAvailable = availableLangs.includes(lang);
    const effectiveLang = isLangAvailable ? lang : DEFAULT_LANG;

    const pick = (obj) => (obj && (obj[effectiveLang] || obj.ru)) || "";
    const rawTitle = pick(meta?.title);
    const title = rawTitle ? `${rawTitle} — ${SITE_NAME}` : null;
    if (!title) return null;

    const description = shortDescription(stripForeignCurrency(pick(meta?.description))) || DEFAULT_DESCRIPTION[effectiveLang];
    const image = safeImage(meta?.image) || FALLBACK_IMAGE;
    const basePath = `/${kind}/${id}`;
    const canonical = `${SITE_ORIGIN}/${effectiveLang}${basePath}`;
    const a = 'data-ssr-seo="1"';

    const alternateLines = availableLangs.map(
        (code) => `<link ${a} rel="alternate" hreflang="${code}" href="${escapeHtml(`${SITE_ORIGIN}/${code}${basePath}`)}" />`
    );
    alternateLines.push(
        `<link ${a} rel="alternate" hreflang="x-default" href="${escapeHtml(`${SITE_ORIGIN}/${DEFAULT_LANG}${basePath}`)}" />`
    );

    const lines = [
        `<title ${a}>${escapeHtml(title)}</title>`,
        `<meta ${a} name="description" content="${escapeHtml(description)}" />`,
        `<link ${a} rel="canonical" href="${escapeHtml(canonical)}" />`,
        ...alternateLines,
        `<meta ${a} property="og:type" content="website" />`,
        `<meta ${a} property="og:site_name" content="${SITE_NAME}" />`,
        `<meta ${a} property="og:title" content="${escapeHtml(title)}" />`,
        `<meta ${a} property="og:description" content="${escapeHtml(description)}" />`,
        `<meta ${a} property="og:image" content="${escapeHtml(image)}" />`,
        `<meta ${a} property="og:url" content="${escapeHtml(canonical)}" />`,
        `<meta ${a} property="og:locale" content="${OG_LOCALES[effectiveLang]}" />`,
        ...availableLangs.filter((c) => c !== effectiveLang).map((c) => `<meta ${a} property="og:locale:alternate" content="${OG_LOCALES[c]}" />`),
        `<meta ${a} name="twitter:card" content="summary_large_image" />`,
        `<meta ${a} name="twitter:title" content="${escapeHtml(title)}" />`,
        `<meta ${a} name="twitter:description" content="${escapeHtml(description)}" />`,
        `<meta ${a} name="twitter:image" content="${escapeHtml(image)}" />`,
        ...jsonLdTags(buildListingJsonLd({ kind, id, lang: effectiveLang, meta, canonical, title: rawTitle, rate })),
    ];
    return { lines: lines.join("\n  "), lang: effectiveLang, body: buildListingBody({ kind, id, lang: effectiveLang, meta, rate }) };
}

export function injectHead(html, head) {
    if (!head) return html;
    let out = html
        .replace(/<title>[\s\S]*?<\/title>\s*/i, "")
        .replace(/<meta\s+name="description"[^>]*>\s*/gi, "")
        .replace(/<meta\s+property="og:[^"]*"[^>]*>\s*/gi, "")
        .replace(/<meta\s+name="twitter:[^"]*"[^>]*>\s*/gi, "");
    if (!/<\/head>/i.test(out)) return html;
    out = out.replace(/<html lang="[a-z]{2}"/i, `<html lang="${head.lang}"`);
    return out.replace(/<\/head>/i, () => `  ${head.lines}\n</head>`);
}

function buildPageHead({ page, basePath, lang, jsonLd }) {
    const title = `${page.title} — ${SITE_NAME}`;
    const description = shortDescription(page.description);
    const canonical = `${SITE_ORIGIN}/${lang}${basePath}`;
    const a = 'data-ssr-seo="1"';

    const lines = [
        `<title ${a}>${escapeHtml(title)}</title>`,
        `<meta ${a} name="description" content="${escapeHtml(description)}" />`,
        `<link ${a} rel="canonical" href="${escapeHtml(canonical)}" />`,
        ...LANGS.map((code) => `<link ${a} rel="alternate" hreflang="${code}" href="${escapeHtml(`${SITE_ORIGIN}/${code}${basePath}`)}" />`),
        `<link ${a} rel="alternate" hreflang="x-default" href="${escapeHtml(`${SITE_ORIGIN}/${DEFAULT_LANG}${basePath}`)}" />`,
        `<meta ${a} property="og:type" content="website" />`,
        `<meta ${a} property="og:site_name" content="${SITE_NAME}" />`,
        `<meta ${a} property="og:title" content="${escapeHtml(title)}" />`,
        `<meta ${a} property="og:description" content="${escapeHtml(description)}" />`,
        `<meta ${a} property="og:image" content="${escapeHtml(FALLBACK_IMAGE)}" />`,
        `<meta ${a} property="og:url" content="${escapeHtml(canonical)}" />`,
        `<meta ${a} property="og:locale" content="${OG_LOCALES[lang]}" />`,
        ...LANGS.filter((c) => c !== lang).map((c) => `<meta ${a} property="og:locale:alternate" content="${OG_LOCALES[c]}" />`),
        `<meta ${a} name="twitter:card" content="summary_large_image" />`,
        `<meta ${a} name="twitter:title" content="${escapeHtml(title)}" />`,
        `<meta ${a} name="twitter:description" content="${escapeHtml(description)}" />`,
        `<meta ${a} name="twitter:image" content="${escapeHtml(FALLBACK_IMAGE)}" />`,
    ];

    const paragraphs = String(page.intro).split(/\n+/).map((t) => `<p>${escapeHtml(t)}</p>`).join("");
    const body = `<main ${a} style="max-width:1440px;margin:0 auto;padding:120px 20px 0;font-family:sans-serif;color:#f5f5f5">` +
        `<h1>${escapeHtml(page.h1)}</h1>${paragraphs}</main>`;

    return { lines: [...lines, ...jsonLdTags(jsonLd || [])].join("\n  "), lang, body };
}

export function buildDistrictHead({ kind, key, lang }) {
    const page = getDistrictPage(kind, key, lang);
    return page ? buildPageHead({ page, basePath: districtBasePath(kind, key), lang }) : null;
}

export function buildStaticHead({ page: pageKey, lang }) {
    const page = getStaticPage(pageKey, lang);
    if (!page) return null;
    // на главной — Organization и WebSite (имя бренда, соцсети) прямо в HTML для роботов
    const jsonLd = pageKey === "home" ? [buildOrganizationJsonLd(), buildWebSiteJsonLd()] : undefined;
    return buildPageHead({ page, basePath: staticBasePath(pageKey), lang, jsonLd });
}

export function injectRootContent(html, body) {
    if (!body) return html;
    const re = /<div id="root">\s*<\/div>/i;
    if (!re.test(html)) return html;
    return html.replace(re, () => `<div id="root">${body}</div>`);
}
