// Мета-теги для страниц объектов, которые вставляются в HTML на сервере.
// ЗАЧЕМ: Telegram, WhatsApp, Facebook и часть поисковиков не выполняют JS,
// поэтому раньше у любой ссылки на объявление было одно и то же превью.
// Файл начинается с "_", поэтому Vercel не превращает его в endpoint.
//
// Теги помечены data-ssr-seo="1": после загрузки React (Seo.jsx) сам
// создаёт такие же теги и удаляет эти, чтобы дублей в DOM не оставалось.

import { SITE_ORIGIN, LANGS, DEFAULT_LANG } from "./_publicDb.js";
import { getDistrictPage, districtBasePath } from "../src/utils/districtPages.js";
import { getStaticPage, staticBasePath } from "../src/utils/staticPages.js";

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

// Описание для сниппета: одна строка, до ~160 символов, обрезка по слову.
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

// meta: { title: {ru,en,uz}, description: {ru,en,uz}, image } — только реальные данные объекта
export function buildListingHead({ kind, id, lang, meta }) {
    const pick = (obj) => (obj && (obj[lang] || obj.ru)) || "";
    const rawTitle = pick(meta?.title);
    const title = rawTitle ? `${rawTitle} — ${SITE_NAME}` : null;
    if (!title) return null; // нечего подставлять — оставляем оболочку как есть

    const description = shortDescription(pick(meta?.description)) || DEFAULT_DESCRIPTION[lang];
    const image = absoluteImage(meta?.image);
    const basePath = `/${kind}/${id}`;
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
        `<meta ${a} property="og:image" content="${escapeHtml(image)}" />`,
        `<meta ${a} property="og:url" content="${escapeHtml(canonical)}" />`,
        `<meta ${a} property="og:locale" content="${OG_LOCALES[lang]}" />`,
        ...LANGS.filter((c) => c !== lang).map((c) => `<meta ${a} property="og:locale:alternate" content="${OG_LOCALES[c]}" />`),
        `<meta ${a} name="twitter:card" content="summary_large_image" />`,
        `<meta ${a} name="twitter:title" content="${escapeHtml(title)}" />`,
        `<meta ${a} name="twitter:description" content="${escapeHtml(description)}" />`,
        `<meta ${a} name="twitter:image" content="${escapeHtml(image)}" />`,
    ];
    return { lines: lines.join("\n  "), lang };
}

// Убирает из оболочки общие title/description/og/twitter и вставляет свои.
export function injectHead(html, head) {
    if (!head) return html;
    let out = html
        .replace(/<title>[\s\S]*?<\/title>\s*/i, "")
        .replace(/<meta\s+name="description"[^>]*>\s*/gi, "")
        .replace(/<meta\s+property="og:[^"]*"[^>]*>\s*/gi, "")
        .replace(/<meta\s+name="twitter:[^"]*"[^>]*>\s*/gi, "");
    if (!/<\/head>/i.test(out)) return html; // нестандартная оболочка — не рискуем
    out = out.replace(/<html lang="[a-z]{2}"/i, `<html lang="${head.lang}"`);
    return out.replace(/<\/head>/i, () => `  ${head.lines}\n</head>`);
}

// ── Страницы без объекта в БД: районы и общие страницы ─────────────────────────
// Серверный <head> для роботов без JS. Теги помечены data-ssr-seo="1" —
// после загрузки React (Seo.jsx) создаёт свои и удаляет эти.
function buildPageHead({ page, basePath, lang }) {
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

    // Видимый текст страницы (h1 + абзац) прямо в HTML: React при старте заменяет
    // содержимое #root своим (createRoot), поэтому дублей у посетителей нет.
    // Цвет светлый: до загрузки React фон сайта тёмный (--black), тема применяется позже.
    const paragraphs = String(page.intro).split(/\n+/).map((t) => `<p>${escapeHtml(t)}</p>`).join("");
    const body = `<main ${a} style="max-width:1440px;margin:0 auto;padding:120px 20px 0;font-family:sans-serif;color:#f5f5f5">` +
        `<h1>${escapeHtml(page.h1)}</h1>${paragraphs}</main>`;

    return { lines: lines.join("\n  "), lang, body };
}

// /:lang/Properties/apartments|commercial/:district
export function buildDistrictHead({ kind, key, lang }) {
    const page = getDistrictPage(kind, key, lang);
    return page ? buildPageHead({ page, basePath: districtBasePath(kind, key), lang }) : null;
}

// /:lang, /:lang/Properties, /:lang/AboutUs, /:lang/Services, /:lang/ContactUs
export function buildStaticHead({ page: pageKey, lang }) {
    const page = getStaticPage(pageKey, lang);
    return page ? buildPageHead({ page, basePath: staticBasePath(pageKey), lang }) : null;
}

// Вставляет готовый HTML внутрь пустого <div id="root"></div>.
export function injectRootContent(html, body) {
    if (!body) return html;
    const re = /<div id="root">\s*<\/div>/i;
    if (!re.test(html)) return html; // нестандартная оболочка — не рискуем
    return html.replace(re, () => `<div id="root">${body}</div>`);
}
