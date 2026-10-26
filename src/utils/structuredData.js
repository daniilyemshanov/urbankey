import { parsePrice } from "./currency.js";

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

export const buildResidenceJsonLd = ({ villa, lang, url }) =>
    buildListing({
        name: villa?.title?.[lang] || villa?.title?.ru,
        description: villa?.about?.[lang] || villa?.about?.ru,
        url,
        images: villa?.images,
        price: villa?.price,
    });

export const buildCommercialJsonLd = ({ page, lang, url }) =>
    buildListing({
        name: page?.title?.[lang] || page?.title?.ru,
        description: page?.about?.[lang] || page?.about?.ru,
        url,
        images: page?.images,
        price: page?.price,
    });
