// Хелперы для построения JSON-LD (schema.org). Данные берутся только из реальных
// полей проекта/объекта — никаких выдуманных значений (рейтинги, отзывы и т.п. не добавляем,
// т.к. на сайте нет соответствующих данных).

import { parsePrice } from "./currency.js";

const SITE_ORIGIN = "https://urbankey.uz";

/**
 * Organization + RealEstateAgent — один объект, размещается на главной странице.
 * Использует только реальные контакты компании.
 */
export const buildOrganizationJsonLd = () => ({
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "@id": `${SITE_ORIGIN}/#organization`,
    name: "UrbanKey",
    url: SITE_ORIGIN,
    logo: `${SITE_ORIGIN}/favicon.png`,
    image: `${SITE_ORIGIN}/image%20(16).webp`,
    areaServed: {
        "@type": "City",
        name: "Tashkent",
    },
    address: {
        "@type": "PostalAddress",
        addressLocality: "Tashkent",
        addressCountry: "UZ",
    },
});

/**
 * BreadcrumbList для страниц объектов недвижимости.
 * @param {{name: string, path: string}[]} items - path относительный, без языкового префикса и origin
 * @param {string} lang
 */
export const buildBreadcrumbJsonLd = (items, lang) => ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        item: `${SITE_ORIGIN}/${lang}${item.path}`,
    })),
});

// Offer только из реальной цены объявления: число + валюта, определённые теми же
// правилами, что и в каталоге (parsePrice). Цена за м², пустая или нечитаемая
// цена — Offer не выводим, чтобы не заявить неверную сумму.
const buildOffer = (rawPrice) => {
    const parsed = parsePrice(rawPrice);
    if (!parsed || parsed.perSqm) return undefined;
    return {
        "@type": "Offer",
        price: parsed.amount,
        priceCurrency: parsed.currency,
    };
};

const buildListing = ({ name, description, url, images, price }) => {
    const data = {
        "@context": "https://schema.org",
        "@type": "RealEstateListing",
        name,
        description,
        url,
    };
    if (Array.isArray(images) && images.length > 0) data.image = images;
    const offers = buildOffer(price);
    if (offers) data.offers = offers;
    return data;
};

/**
 * Страница объявления о жилье: schema.org RealEstateListing (страница объявления
 * с предложением). Только поля, которые есть в данных и видны на странице.
 */
export const buildResidenceJsonLd = ({ villa, lang, url }) =>
    buildListing({
        name: villa?.title?.[lang] || villa?.title?.ru,
        description: villa?.about?.[lang] || villa?.about?.ru,
        url,
        images: villa?.images,
        price: villa?.price,
    });

/**
 * Страница объявления о коммерческом объекте.
 */
export const buildCommercialJsonLd = ({ page, lang, url }) =>
    buildListing({
        name: page?.title?.[lang] || page?.title?.ru,
        description: page?.about?.[lang] || page?.about?.ru,
        url,
        images: page?.images,
        price: page?.price,
    });
