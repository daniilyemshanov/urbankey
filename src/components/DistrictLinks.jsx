// Ссылки на страницы районов (квартиры и коммерция). Обычные <a>-ссылки в HTML —
// так роботы находят страницы районов, а посетители быстро переходят между ними.

import { Link } from "react-router-dom";
import { TASHKENT_DISTRICTS } from "../utils/districts";
import { getDistrictPage, districtPagePath } from "../utils/districtPages";
import s from "./DistrictLinks.module.css";

const HEADINGS = {
    apartments: {
        ru: "Квартиры по районам Ташкента",
        en: "Apartments by district in Tashkent",
        uz: "Toshkent tumanlari bo'yicha kvartiralar",
    },
    commercial: {
        ru: "Коммерческая недвижимость по районам Ташкента",
        en: "Commercial property by district in Tashkent",
        uz: "Toshkent tumanlari bo'yicha tijorat binolari",
    },
};

const DistrictLinks = ({ lang, kinds = ["apartments", "commercial"], currentKey = null, currentKind = null }) => (
    <nav className={s.wrap} aria-label={HEADINGS.apartments[lang] || HEADINGS.apartments.ru}>
        {kinds.map((kind) => (
            <div className={s.group} key={kind}>
                <h2>{(HEADINGS[kind][lang] || HEADINGS[kind].ru)}</h2>
                <ul className={s.list}>
                    {TASHKENT_DISTRICTS.map((d) => {
                        const page = getDistrictPage(kind, d.key, lang);
                        if (!page) return null;
                        const isCurrent = kind === currentKind && d.key === currentKey;
                        return (
                            <li key={d.key}>
                                <Link
                                    className={`${s.chip} ${isCurrent ? s.chipActive : ""}`}
                                    to={districtPagePath(kind, d.key, lang)}
                                    title={page.h1}
                                    aria-label={page.h1}
                                    aria-current={isCurrent ? "page" : undefined}
                                >
                                    {page.name}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </div>
        ))}
    </nav>
);

export default DistrictLinks;
