
import { useParams } from "react-router-dom";
import { useContext, useEffect, useRef } from "react";

import { MyContext } from "../Context";

import CommercialHero from "../components/CommercialHero";
import CommercialProperty from "../components/CommercialProperty";
import CommercialAmenities from "../components/CommercialAmenities";

import Feautured from "../components/Feautured_one";
import Footer from "../components/Footer";
import Connect from "../components/Connect_one";
import Seo from "../components/Seo";
import { useTranslation } from "react-i18next";
import Error from "./Error";
import DetailLoading from "../components/DetailLoading";
import {
    buildCommercialJsonLd,
    buildBreadcrumbJsonLd
} from "../utils/structuredData";
import { trackViewItem } from "../analytics";
import { useCurrency } from "../context/CurrencyContext";

const CommercialPage = () => {
    const { id } = useParams();
    const { t, i18n } = useTranslation();
    const { rate } = useCurrency() ?? {};

    const {
        getCommercialById,
        commercialPage,
        commercialStatus
    } = useContext(MyContext);

    const lastTrackedId = useRef(null);

    // Загружаем коммерческий объект
    useEffect(() => {
        if (id) {
            getCommercialById(id);
        }
    }, [id, getCommercialById]);

    // Проверяем, что загружен именно текущий объект
    const isCurrentCommercial =
        commercialStatus === "ready" &&
        commercialPage &&
        String(commercialPage.commercial_id) === String(id);

    // Доступные языки
    const availableLangs = [];

    if (commercialPage?.title?.ru?.trim()) availableLangs.push("ru");
    if (commercialPage?.title?.en?.trim()) availableLangs.push("en");
    if (commercialPage?.title?.uz?.trim()) availableLangs.push("uz");

    if (availableLangs.length === 0) availableLangs.push("ru");

    const effectiveLang = availableLangs.includes(i18n.language)
        ? i18n.language
        : "ru";

    const seoTitle =
        commercialPage?.title?.[effectiveLang] ||
        commercialPage?.title?.ru;

    const seoDesc =
        commercialPage?.about?.[effectiveLang] ||
        commercialPage?.about?.ru;

    const seoImage = commercialPage?.images?.[0];
    const seoUrl = `https://urbankey.uz/${effectiveLang}/commercial/${id}`;

    // GA4: просмотр коммерческого объекта
    useEffect(() => {
        if (!isCurrentCommercial || !id) return;

        const propertyId = String(id);

        if (lastTrackedId.current === propertyId) return;

        trackViewItem({
            id: propertyId,
            name: seoTitle,
            category: "commercial",
            price:
                typeof commercialPage.price === "number"
                    ? commercialPage.price
                    : undefined,
        });

        lastTrackedId.current = propertyId;
    }, [id, isCurrentCommercial, commercialPage, seoTitle]);

    // Structured Data
    const jsonLd = commercialPage
        ? [
            buildCommercialJsonLd({
                page: commercialPage,
                lang: effectiveLang,
                url: seoUrl,
                rate
            }),
            buildBreadcrumbJsonLd(
                [
                    { name: "UrbanKey", path: "/" },
                    { name: t("properties"), path: "/Properties" },
                    {
                        name: seoTitle || "",
                        path: `/commercial/${id}`
                    }
                ],
                effectiveLang
            )
        ]
        : [];

    // Все хуки объявлены выше условных return
    if (
        commercialStatus === "notfound" ||
        commercialStatus === "error"
    ) {
        return <Error />;
    }

    if (!isCurrentCommercial) {
        return <DetailLoading />;
    }

    return (
        <>
            <Seo
                title={seoTitle}
                description={seoDesc}
                image={seoImage}
                jsonLd={jsonLd}
                availableLangs={availableLangs}
            />

            <CommercialHero data={commercialPage} />
            <CommercialProperty data={commercialPage} />
            <CommercialAmenities data={commercialPage} />
            <Feautured data={commercialPage} commercial={true} />
            <Connect />
            <Footer />
        </>
    );
};

export default CommercialPage;
