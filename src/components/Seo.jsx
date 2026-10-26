import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { DEFAULT_LANG, SUPPORTED_LANGS, stripLangPrefix } from "../utils/lang";

const SITE_NAME = "UrbanKey";
const FALLBACK_IMAGE = "/image%20(16).webp";
const SITE_ORIGIN = "https://urbankey.uz";

const OG_LOCALES = { ru: "ru_RU", en: "en_US", uz: "uz_UZ" };

const DEFAULT_TITLE = {
    ru: "UrbanKey — ключи от вашей недвижимости в Ташкенте",
    en: "UrbanKey — real estate keys in Tashkent",
    uz: "UrbanKey — Toshkentdagi ko'chmas mulk kalitlari",
};

const DEFAULT_DESCRIPTION = {
    ru: "UrbanKey — подбор и продажа недвижимости в Ташкенте: квартиры, коммерческие объекты.",
    en: "UrbanKey — real estate selection and sales in Tashkent: apartments, commercial properties.",
    uz: "UrbanKey — Toshkentda ko'chmas mulk tanlash va sotish: kvartiralar, tijorat obyektlari.",
};

const shortDescription = (text, max = 160) => {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    if (clean.length <= max) return clean;
    const cut = clean.slice(0, max - 1);
    const lastSpace = cut.lastIndexOf(" ");
    return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:!-]+$/, "") + "…";
};

const Seo = ({ title, description, image, noIndex = false, jsonLd }) => {
    const { i18n } = useTranslation();
    const { pathname } = useLocation();
    const lang = SUPPORTED_LANGS.includes(i18n.language) ? i18n.language : DEFAULT_LANG;

    const fullTitle = title ? `${title} — ${SITE_NAME}` : DEFAULT_TITLE[lang];
    const desc = shortDescription(description) || DEFAULT_DESCRIPTION[lang];
    const ogImage = image
        ? (image.startsWith("http") ? image : `${SITE_ORIGIN}${image}`)
        : `${SITE_ORIGIN}${FALLBACK_IMAGE}`;

    const canonicalUrl = `${SITE_ORIGIN}${pathname}`;

    const basePath = stripLangPrefix(pathname);

    useEffect(() => {
        document.querySelectorAll("[data-ssr-seo]").forEach((el) => el.remove());
    }, []);

    const jsonLdList = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

    return (
        <>
            <title>{fullTitle}</title>
            <meta name="description" content={desc} />
            {noIndex && <meta name="robots" content="noindex, nofollow" />}

            <link rel="canonical" href={canonicalUrl} />

            {SUPPORTED_LANGS.map((code) => (
                <link
                    key={code}
                    rel="alternate"
                    hrefLang={code}
                    href={`${SITE_ORIGIN}/${code}${basePath}`}
                />
            ))}
            <link
                rel="alternate"
                hrefLang="x-default"
                href={`${SITE_ORIGIN}/${DEFAULT_LANG}${basePath}`}
            />

            <meta property="og:type" content="website" />
            <meta property="og:site_name" content={SITE_NAME} />
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={desc} />
            <meta property="og:image" content={ogImage} />
            <meta property="og:url" content={canonicalUrl} />
            <meta property="og:locale" content={OG_LOCALES[lang]} />
            {SUPPORTED_LANGS.filter((c) => c !== lang).map((c) => (
                <meta key={c} property="og:locale:alternate" content={OG_LOCALES[c]} />
            ))}

            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={fullTitle} />
            <meta name="twitter:description" content={desc} />
            <meta name="twitter:image" content={ogImage} />

            {jsonLdList.map((obj, i) => (
                <script key={i} type="application/ld+json">
                    {JSON.stringify(obj)}
                </script>
            ))}
        </>
    );
};

export default Seo;
