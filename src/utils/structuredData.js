import { parsePrice, isValidRate } from "./currency.js";

const SITE_ORIGIN = "https://urbankey.uz";

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

const buildOffer = (rawPrice, rate) => {
    const parsed = parsePrice(rawPrice);
    if (!parsed || parsed.perSqm) return undefined;

    if (parsed.currency === "UZS") {
        return { "@type": "Offer", price: parsed.amount, priceCurrency: "UZS" };
    }

    if (!isValidRate(rate)) return undefined;
    return { "@type": "Offer", price: Math.round(parsed.amount * rate), priceCurrency: "UZS" };
};

const buildListing = ({ name, description, url, images, price, rate }) => {
    const data = {
        "@context": "https://schema.org",
        "@type": "RealEstateListing",
        name,
        description,
        url,
    };
    if (Array.isArray(images) && images.length > 0) data.image = images;
    const offers = buildOffer(price, rate);
    if (offers) data.offers = offers;
    return data;
};

export const buildResidenceJsonLd = ({ villa, lang, url, rate }) =>
    buildListing({
        name: villa?.title?.[lang] || villa?.title?.ru,
        description: villa?.about?.[lang] || villa?.about?.ru,
        url,
        images: villa?.images,
        price: villa?.price,
        rate,
    });

export const buildCommercialJsonLd = ({ page, lang, url, rate }) =>
    buildListing({
        name: page?.title?.[lang] || page?.title?.ru,
        description: page?.about?.[lang] || page?.about?.ru,
        url,
        images: page?.images,
        price: page?.price,
        rate,
    });
