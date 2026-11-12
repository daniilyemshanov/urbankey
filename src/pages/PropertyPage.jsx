
import { useParams } from "react-router-dom";
import { useContext, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import Villa from "../components/Villa";
import Property from "../components/Property";
import Amenities from "../components/Amenities";
import Feautured from "../components/Feautured_one";
import Footer from "../components/Footer";
import Seo from "../components/Seo";

import { MyContext } from "../Context";
import { useCurrency } from "../context/CurrencyContext";

import {
    buildResidenceJsonLd,
    buildBreadcrumbJsonLd,
} from "../utils/structuredData";

import { trackViewItem } from "../analytics";

import Error from "./Error";
import DetailLoading from "../components/DetailLoading";

const PropertyPage = () => {
    const { id } = useParams();
    const { t, i18n } = useTranslation();
    const { rate } = useCurrency() ?? {};

    const { getVilla, villa, villaStatus } = useContext(MyContext);

    const lastTrackedId = useRef(null);

    // Load property
    useEffect(() => {
        if (id) {
            getVilla(id);
        }
    }, [id, getVilla]);

    // Available translations
    const availableLangs = [];

    if (villa?.title?.ru?.trim()) availableLangs.push("ru");
    if (villa?.title?.en?.trim()) availableLangs.push("en");
    if (villa?.title?.uz?.trim()) availableLangs.push("uz");

    if (availableLangs.length === 0) {
        availableLangs.push("ru");
    }

    const effectiveLang = availableLangs.includes(i18n.language)
        ? i18n.language
        : "ru";

    const seoTitle = villa?.title?.[effectiveLang] || villa?.title?.ru;
    const seoDesc = villa?.about?.[effectiveLang] || villa?.about?.ru;
    const seoImage = villa?.images?.[0];
    const seoUrl = `https://urbankey.uz/${effectiveLang}/property/${id}`;

    const isCurrentVilla =
        villaStatus === "ready" &&
        villa &&
        String(villa.card_id) === String(id);

    // Track property view
    useEffect(() => {
        if (!isCurrentVilla || !id) return;

        const propertyId = String(id);

        if (lastTrackedId.current === propertyId) return;

        trackViewItem({
            id: propertyId,
            name: seoTitle,
            category: "property",
            price:
                typeof villa.price === "number"
                    ? villa.price
                    : undefined,
        });

        lastTrackedId.current = propertyId;
    }, [id, isCurrentVilla, villa, seoTitle]);

    // All hooks are above conditional returns
    if (villaStatus === "notfound" || villaStatus === "error") {
        return <Error />;
    }

    if (!isCurrentVilla) {
        return <DetailLoading />;
    }

    const jsonLd = [
        buildResidenceJsonLd({
            villa,
            lang: effectiveLang,
            url: seoUrl,
            rate,
        }),
        buildBreadcrumbJsonLd(
            [
                { name: "UrbanKey", path: "/" },
                { name: t("properties"), path: "/Properties" },
                { name: seoTitle || "", path: `/property/${id}` },
            ],
            effectiveLang
        ),
    ];

    return (
        <>
            <Seo
                title={seoTitle}
                description={seoDesc}
                image={seoImage}
                jsonLd={jsonLd}
                availableLangs={availableLangs}
            />

            <Villa data={villa} />

            <Property data={villa} />

            <Amenities data={villa} />

            <Feautured data={villa} />

            <Footer />
        </>
    );
};

export default PropertyPage;
