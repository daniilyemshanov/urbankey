import { useParams } from "react-router-dom";
import Catalog from "../components/Catalog";
import DistrictLinks from "../components/DistrictLinks";
import Footer from "../components/Footer";
import Seo from "../components/Seo";
import NotFound from "./Error";
import { isSupportedLang, DEFAULT_LANG } from "../utils/lang";
import { districtKeyFromSlug, getDistrictPage } from "../utils/districtPages";
import s from "./DistrictListings.module.css";

const DistrictListings = ({ kind }) => {
    const { lang: rawLang, district } = useParams();
    const lang = isSupportedLang(rawLang) ? rawLang : DEFAULT_LANG;

    const key = districtKeyFromSlug(district);
    const page = key ? getDistrictPage(kind, key, lang) : null;

    if (!page) return <NotFound />;

    return (
        <>
            <Seo title={page.title} description={page.description} />

            <header className={s.header}>
                <h1>{page.h1}</h1>
                {page.intro.split(/\n+/).map((text, i) => (
                    <p key={i}>{text}</p>
                ))}
            </header>

            <Catalog
                presetCategory={kind === "commercial" ? "commercial" : "residential"}
                presetKind={kind}
                presetDistrict={key}
            />

            <DistrictLinks lang={lang} currentKey={key} currentKind={kind} />
            <Footer />
        </>
    );
};

export default DistrictListings;
