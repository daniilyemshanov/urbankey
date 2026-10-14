// Мета-теги для страниц объектов, которые вставляются в HTML на сервере.
// ЗАЧЕМ: Telegram, WhatsApp, Facebook и часть поисковиков не выполняют JS,
// поэтому раньше у любой ссылки на объявление было одно и то же превью.
// Файл начинается с "_", поэтому Vercel не превращает его в endpoint.
//
// Теги помечены data-ssr-seo="1": после загрузки React (Seo.jsx) сам
// создаёт такие же теги и удаляет эти, чтобы дублей в DOM не оставалось.

import { SITE_ORIGIN, LANGS, DEFAULT_LANG } from "./_publicDb.js";

const SITE_NAME = "UrbanKey";
const FALLBACK_IMAGE = `${SITE_ORIGIN}/image%20(16).webp`;
const OG_LOCALES = { ru: "ru_RU", en: "en_US", uz: "uz_UZ" };

const DEFAULT_DESCRIPTION = {
    ru: "UrbanKey — подбор и продажа недвижимости в Ташкенте: виллы, квартиры, коммерческие объекты.",
    en: "UrbanKey — real estate selection and sales in Tashkent: villas, apartments, commercial properties.",
    uz: "UrbanKey — Toshkentda ko'chmas mulk tanlash va sotish: villalar, kvartiralar, tijorat obyektlari.",
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
