import { Link, useParams } from 'react-router-dom'
import s from './Featured.module.css'
import { motion } from "framer-motion"
import { useTranslation } from 'react-i18next'
import { useContext, useEffect, useState, useRef, useLayoutEffect, useMemo } from "react";
import { Swiper, SwiperSlide } from 'swiper/react'
import { Navigation, Autoplay, Mousewheel } from 'swiper/modules'

import 'swiper/css'
import 'swiper/css/navigation'

import { MyContext } from '../Context';
import { localizedPath } from '../utils/lang';
import { useCurrency } from '../context/CurrencyContext';
import { formatPriceIn } from '../utils/currency';
import { Ruler, Tag } from 'lucide-react';
import FloorIcon from "./FloorIcon";
import { residentialFloorSlot } from "../utils/floor";
import useVillaLocations from "../hooks/useVillaLocations";
import { rankSimilar } from "../utils/similarListings";
import { itemRoomsLabel } from "../utils/rooms";

const readMoreLabels = {
    ru: { more: "Подробнее", less: "Скрыть" },
    en: { more: "Show more", less: "Show less" },
    uz: { more: "Batafsil", less: "Yopish" },
};


// Почему объявление показано как похожее (см. utils/similarListings.js).
const REASON_LABELS = {
    district: { ru: "Тот же район", en: "Same district", uz: "Shu tuman" },
    rooms: { ru: (n) => `${n} комн.`, en: (n) => `${n} rooms`, uz: (n) => `${n} xona` },
    roomsNear: { ru: (n) => `${n} комн.`, en: (n) => `${n} rooms`, uz: (n) => `${n} xona` },
    price: { ru: "Похожая цена", en: "Similar price", uz: "Narxi yaqin" },
    priceNear: { ru: "Близкая цена", en: "Close price", uz: "Narxi yaqin" },
    area: { ru: "Похожая площадь", en: "Similar area", uz: "Maydoni yaqin" },
    floor: { ru: "Близкий этаж", en: "Similar floor", uz: "Qavati yaqin" },
    type: { ru: "Тот же тип", en: "Same type", uz: "Shu turdagi" },
    class: { ru: "Тот же класс", en: "Same class", uz: "Shu sinf" },
};

const reasonLabel = (reason, language) => {
    const entry = REASON_LABELS[reason.code]?.[language] || REASON_LABELS[reason.code]?.ru;
    return typeof entry === "function" ? entry(reason.value) : entry || "";
};

const Feautured = ({ data, commercial, items }) => {


    const {
        properties,
        commercials,
        profile,
        getCards,
        getCommercials,
        deleteCard,
        deleteCommercial
    } = useContext(MyContext);

    // isAdmin в контексте никогда не существовал (всегда был undefined) —
    // из-за этого кнопка "Удалить" тут не отображалась вообще никогда.
    // Считаем так же, как в Catalog.jsx/CommercialSection.jsx.
    const isAdmin = profile?.role === "admin";



    useEffect(() => {

        // Раньше здесь всегда грузились ЖИЛЫЕ объекты (getCards/properties),
        // даже на странице коммерческой недвижимости — из-за этого "похожие
        // объекты" под коммерческим объявлением на самом деле были виллами.
        // Теперь берём правильный источник в зависимости от типа страницы.
        if (commercial) {
            getCommercials();
        } else {
            getCards();
        }

    }, [commercial]);




    const { t, i18n } = useTranslation();
    const { currency, rate } = useCurrency();

    const [expanded, setExpanded] = useState({});
    const [overflowing, setOverflowing] = useState({});
    const descRefs = useRef({});

    const toggleExpanded = (id) => {
        setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const setDescRef = (id) => (el) => {
        descRefs.current[id] = el;
    };

    const labels = readMoreLabels[i18n.language] || readMoreLabels.ru;







    const list = items || (commercial ? commercials : properties);

    // Самый надёжный источник "какой объект сейчас открыт" — id из самого URL
    // (/property/:id, /commercial/:id), а не поля из связанных таблиц:
    // villa.id — это id строки в таблице villas, а не в cardss (откуда properties).
    // commercialPage.id (если страница открыта через getCommercialById) — это id
    // строки в commercial_pages, а не в commercials. Оба поля ненадёжны (могут
    // быть не тем id или не заполнены), поэтому берём id прямо из адресной строки.
    const { id: routeId } = useParams();
    const routeIdNum = routeId !== undefined ? Number(routeId) : undefined;

    const currentId = !Number.isNaN(routeIdNum) && routeIdNum !== undefined
        ? routeIdNum
        : commercial
            ? (data?.commercial_id ?? data?.id)
            : (data?.card_id ?? data?.id);

    // Строка «Расположение» всех объявлений — по ней определяется район квартир.
    const locations = useVillaLocations();

    // Открытый объект в списке (у него те же поля, что у кандидатов).
    const currentItem = useMemo(
        () => (list || []).find((item) => String(item.id) === String(currentId)),
        [list, currentId]
    );

    // 7 самых похожих: район, комнаты, цена, площадь, этаж (коммерция: район, тип,
    // класс, площадь, цена). Аренда и продажа не смешиваются.
    const similar = useMemo(() => rankSimilar({
        current: { ...(data || {}), ...(currentItem || {}) },
        candidates: list || [],
        currentId,
        kind: commercial ? "commercial" : "residential",
        locations: commercial ? {} : locations,
        limit: 7,
    }).map((r) => ({ ...r.item, reasons: r.reasons })), [list, currentId, currentItem, data, commercial, locations]);

    useLayoutEffect(() => {
        const next = {};
        Object.entries(descRefs.current).forEach(([id, el]) => {
            if (!el) return;
            next[id] = el.scrollHeight - el.clientHeight > 1;
        });
        setOverflowing((prev) => {
            const prevKeys = Object.keys(prev);
            const nextKeys = Object.keys(next);
            const same =
                prevKeys.length === nextKeys.length &&
                nextKeys.every((k) => prev[k] === next[k]);
            return same ? prev : next;
        });
    }, [similar, i18n.language]);

    if (similar.length === 0) {
        return null;
    }

    return (

        <section
            className={s.feautured}
            id='feautured'
        >


            <div className={s.text}>


                <img
                    src="/Abstract Design.svg"
                    alt=""
                    className={s.logo}
                />


                <h2>
                    {t("featuredTitle")}
                </h2>


                <div className={s.titles}>


                    <p>
                        {t("featuredText")}
                    </p>


                    <Link
                        className={s.link}
                        to={localizedPath("/Properties", i18n.language)}
                    >

                        {t("viewAll")}

                    </Link>


                </div>


            </div>





            <Swiper

                modules={[
                    Navigation,
                    Autoplay,
                    Mousewheel
                ]}

                spaceBetween={30}

                slidesPerView={3}

                loop={similar.length > 3}

                navigation={true}


                mousewheel={{
                    forceToAxis: true
                }}


                autoplay={{
                    delay: 5500,
                    disableOnInteraction: false
                }}



                breakpoints={{

                    0: {
                        slidesPerView: 1
                    },


                    768: {
                        slidesPerView: 2
                    },


                    1200: {
                        slidesPerView: 3
                    }

                }}


                className={s.cards}

            >




                {similar.map((item) => (


                    <SwiperSlide
                        key={item.id}
                    >


                        <motion.div

                            className={s.card}


                            initial={{
                                opacity: 0,
                                y: 80
                            }}


                            whileInView={{
                                opacity: 1,
                                y: 0
                            }}


                            transition={{
                                duration: 0.8
                            }}


                            viewport={{
                                amount: 0.2
                            }}


                            whileHover={{
                                y: -10
                            }}

                        >



                            <div className={s.imageWrap}>

                                <img

                                    src={item.image}

                                    alt={
                                        item.title?.[i18n.language]
                                    }

                                    className={s.image}

                                    loading="lazy"

                                    decoding="async"

                                />

                            </div>



                            {item.reasons?.length > 0 && (
                                <div className={s.reasons}>
                                    {item.reasons.map((r) => (
                                        <span key={r.code} className={s.reason}>
                                            {reasonLabel(r, i18n.language)}
                                        </span>
                                    ))}
                                </div>
                            )}

                            <h2>

                                {item.title?.[i18n.language]}

                            </h2>


                            <div className={s.meta}>

                                {commercial ? (

                                    <>

                                        <span className={s.metaItem}>
                                            <FloorIcon size={16} className={s.metaIcon} />
                                            <span>
                                                {item.floor}
                                                {i18n.language === "ru" ? " этаж" : i18n.language === "uz" ? " qavat" : " floor"}
                                            </span>
                                        </span>

                                        <span className={s.metaItem}>
                                            <Ruler size={16} className={s.metaIcon} />
                                            <span>{item.area ? `${item.area} m²` : "—"}</span>
                                        </span>

                                        {item.class?.[i18n.language] && (
                                            <span className={s.metaItem}>
                                                <Tag size={16} className={s.metaIcon} />
                                                <span>{item.class[i18n.language]}</span>
                                            </span>
                                        )}

                                    </>

                                ) : (

                                    <>

                                        <span className={s.metaItem}>

                                            <svg className={s.metaIcon} width="20" height="17" viewBox="0 0 20 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M10.0119 15.4597C7.01369 15.4597 4.01627 15.4597 1.01806 15.4597C0.714934 15.4597 0.574786 15.5984 0.574786 15.8977C0.574786 15.9752 0.578723 16.0527 0.573999 16.1295C0.5677 16.2225 0.558252 16.3155 0.54093 16.4062C0.476368 16.7372 0.159068 17.0023 -0.220432 16.9984C-0.601507 16.9946 -0.917233 16.7116 -0.974709 16.3481C-0.988094 16.2628 -0.99518 16.1752 -0.99518 16.0891C-0.995967 14.3279 -1.00778 12.5659 -0.991243 10.8046C-0.981795 9.77829 -0.602295 8.88527 0.125212 8.14186C0.566913 7.69069 1.09207 7.36976 1.69282 7.16511C2.16522 7.00465 2.65338 6.95581 3.15098 6.95581C7.76246 6.95736 12.3739 6.95348 16.9854 6.95891C18.3365 6.96046 19.4309 7.4969 20.2419 8.56356C20.6403 9.08837 20.8781 9.68449 20.9592 10.3357C20.9867 10.555 20.9985 10.7783 20.9993 11C21.0025 12.7101 21.0017 14.4202 21.0009 16.1302C21.0009 16.3977 20.934 16.6411 20.7104 16.8178C20.4741 17.0046 20.2104 17.0535 19.9293 16.9395C19.66 16.8295 19.49 16.6271 19.4514 16.338C19.4317 16.1922 19.4341 16.0426 19.4301 15.8953C19.4238 15.6574 19.3238 15.5139 19.1239 15.4698C19.0798 15.4597 19.0333 15.4605 18.9876 15.4605C15.9965 15.4605 13.0054 15.4605 10.0135 15.4605L10.0119 15.4597Z" fill="currentColor" />
                                                <path d="M9.90246 0C11.8472 0 13.7912 0 15.7351 0C16.3862 0 16.9949 0.143411 17.52 0.539535C18.1956 1.04884 18.59 1.71938 18.6231 2.56124C18.6514 3.27519 18.6388 3.9907 18.642 4.70543C18.6444 5.16589 18.642 5.62636 18.642 6.08682C18.642 6.12791 18.6396 6.17132 18.6286 6.21085C18.5948 6.33566 18.5263 6.38527 18.3971 6.36124C18.2562 6.33488 18.12 6.27829 17.979 6.26279C17.6476 6.22713 17.3153 6.20233 16.9823 6.18527C16.7602 6.17364 16.6917 6.13411 16.6602 5.91938C16.5595 5.23876 15.9194 4.62636 15.1005 4.63566C14.1872 4.64574 13.2739 4.63798 12.3613 4.63798C11.6819 4.63798 11.1016 5.03643 10.8709 5.66434C10.8378 5.75426 10.8252 5.85194 10.8079 5.94651C10.7756 6.11628 10.7119 6.17984 10.5402 6.18217C10.1804 6.18605 9.81979 6.18605 9.45997 6.18217C9.29463 6.18062 9.22928 6.11628 9.19936 5.92791C9.15763 5.66357 9.0537 5.42791 8.88364 5.22093C8.57579 4.84574 8.17739 4.64186 7.68609 4.63953C6.74363 4.63488 5.80118 4.63721 4.85794 4.63876C4.06587 4.63953 3.44623 5.24884 3.34545 5.91783C3.31317 6.13411 3.24782 6.17209 3.02579 6.18605C2.6581 6.21008 2.29041 6.24419 1.92351 6.28295C1.81092 6.29457 1.70305 6.34264 1.59125 6.36124C1.47078 6.38062 1.41488 6.34031 1.38103 6.22403C1.36764 6.17829 1.36134 6.12946 1.36134 6.0814C1.36055 4.97674 1.3456 3.87209 1.36449 2.76744C1.38418 1.61163 1.92666 0.762016 2.988 0.248062C3.40844 0.0457364 3.86431 0 4.3257 0C6.18462 0 8.04354 0 9.90246 0Z" fill="currentColor" />
                                            </svg>

                                            <span>{itemRoomsLabel(item, i18n.language) || "—"}</span>

                                        </span>

                                        {residentialFloorSlot(item, i18n.language).label && (
                                            <span className={s.metaItem}>
                                                <FloorIcon size={20} className={s.metaIcon} />
                                                <span>{residentialFloorSlot(item, i18n.language).label}</span>
                                            </span>
                                        )}

                                        <span className={s.metaItem}>

                                            <svg className={s.metaIcon} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path fillRule="evenodd" clipRule="evenodd" d="M4 16.5V3.5H3.75C3.33579 3.5 3 3.16421 3 2.75C3 2.33579 3.33579 2 3.75 2H16.25C16.6642 2 17 2.33579 17 2.75C17 3.16421 16.6642 3.5 16.25 3.5H16V16.5H16.25C16.6642 16.5 17 16.8358 17 17.25C17 17.6642 16.6642 18 16.25 18H12.75C12.3358 18 12 17.6642 12 17.25V14.75C12 14.3358 11.6642 14 11.25 14H8.75C8.33579 14 8 14.3358 8 14.75V17.25C8 17.6642 7.66421 18 7.25 18H3.75C3.33579 18 3 17.6642 3 17.25C3 16.8358 3.33579 16.5 3.75 16.5H4ZM7 5.5C7 5.22386 7.22386 5 7.5 5H8.5C8.77614 5 9 5.22386 9 5.5V6.5C9 6.77614 8.77614 7 8.5 7H7.5C7.22386 7 7 6.77614 7 6.5V5.5ZM7.5 9C7.22386 9 7 9.22386 7 9.5V10.5C7 10.7761 7.22386 11 7.5 11H8.5C8.77614 11 9 10.7761 9 10.5V9.5C9 9.22386 8.77614 9 8.5 9H7.5ZM11 5.5C11 5.22386 11.2239 5 11.5 5H12.5C12.7761 5 13 5.22386 13 5.5V6.5C13 6.77614 12.7761 7 12.5 7H11.5C11.2239 7 11 6.77614 11 6.5V5.5ZM11.5 9C11.2239 9 11 9.22386 11 9.5V10.5C11 10.7761 11.2239 11 11.5 11H12.5C12.7761 11 13 10.7761 13 10.5V9.5C13 9.22386 12.7761 9 12.5 9H11.5Z" fill="currentColor" />
                                            </svg>

                                            <span>{item.type?.[i18n.language] || "—"}</span>

                                        </span>

                                    </>

                                )}

                            </div>


                            <div className={s.descriptionWrap}>

                                <p
                                    ref={setDescRef(item.id)}
                                    className={`${s.description} ${expanded[item.id] ? s.expanded : ''}`}
                                >

                                    {item.description?.[i18n.language]}

                                </p>

                                {(overflowing[item.id] || expanded[item.id]) && (
                                    <button
                                        type="button"
                                        className={s.readMore}
                                        onClick={() => toggleExpanded(item.id)}
                                    >
                                        {expanded[item.id] ? labels.less : labels.more}
                                    </button>
                                )}

                            </div>


                            <div className={s.divider} />




                            <div className={s.bottom}>


                                <div className={s.prc}>


                                    <p>
                                        {t("price")}
                                    </p>


                                    <h3>

                                        {formatPriceIn(item.price, currency, rate)}

                                    </h3>


                                </div>




                                <Link

                                    to={localizedPath(commercial ? `/commercial/${item.id}` : `/property/${item.id}`, i18n.language)}

                                    className={s.linkk}

                                >

                                    {t("viewProperty")}

                                    <svg className={s.linkkArrow} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M5 12h14" />
                                        <path d="m13 6 6 6-6 6" />
                                    </svg>

                                </Link>


                            </div>




                            {isAdmin && (


                                <button

                                    className={s.btn}

                                    onClick={() =>
                                        commercial ? deleteCommercial(item.id) : deleteCard(item.id)
                                    }

                                >

                                    Delete

                                </button>


                            )}



                        </motion.div>



                    </SwiperSlide>


                ))}



            </Swiper>



        </section>

    )

}



export default Feautured