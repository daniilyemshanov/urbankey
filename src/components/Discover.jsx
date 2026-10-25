import { Link } from 'react-router-dom'
import FloorIcon from "./FloorIcon";
import { residentialFloorSlot } from "../utils/floor";
import { itemRoomsLabel } from "../utils/rooms";
import s from './Featured.module.css'
import { motion } from "framer-motion"
import { useTranslation } from 'react-i18next'
import { useContext, useEffect } from "react";
import { Swiper, SwiperSlide } from 'swiper/react'
import { Navigation, Autoplay, Mousewheel } from 'swiper/modules'

import 'swiper/css'
import 'swiper/css/navigation'

import { MyContext } from '../Context';
import { useCurrency } from '../context/CurrencyContext';
import { formatPriceIn } from '../utils/currency';
import FavoriteButton from './FavoriteButton';
import { hasValue } from "../utils/hasValue"

const Feautured = () => {

    const {
        properties,
        getCards,
        profile,
        deleteCard
    } = useContext(MyContext);

    useEffect(() => {
        getCards();
    }, []);

    const { t, i18n } = useTranslation();
    const { currency, rate } = useCurrency();
    const isAdmin = profile?.role === "admin";
    return (
        <section
            className={s.feautured}
            id='feautured'
        >

            <div className={s.text}>

                <div className={s.text}>

                    <img
                        src="/Abstract Design.svg"
                        alt=""
                        className={s.logo}
                    />

                    <h1>
                        {t("discoverTitle")}
                    </h1>

                    <div className={s.titles}>

                        <p>
                            {t("discoverText")}
                        </p>

                    </div>

                </div>

            </div>

            <Swiper
                modules={[Navigation, Autoplay, Mousewheel]}
                spaceBetween={30}
                slidesPerView={3}
                loop={properties.length > 3}
                navigation={true}

                mousewheel={{
                    forceToAxis: true,
                }}

                autoplay={{
                    delay: 5500,
                    disableOnInteraction: false,
                }}

                breakpoints={{
                    0: {
                        slidesPerView: 1,
                    },

                    768: {
                        slidesPerView: 2,
                    },

                    1200: {
                        slidesPerView: 3,
                    }
                }}

                className={s.cards}
            >

                {properties.map((item) => (

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

                            <FavoriteButton
                                item={{
                                    id: item.id,
                                    type: "card",
                                    title: item.title?.[i18n.language],
                                    image: item.image,
                                    price: item.price,
                                    link: item.link
                                }}
                            />

                            <img
                                src={item.image}
                                alt={item.title?.[i18n.language]}
                                className={s.image}
                                loading="lazy"
                                decoding="async"
                            />

                            <h2>
                                {item.title?.[i18n.language]}
                            </h2>

                            <p>
                                {item.description?.[i18n.language]}
                            </p>

                            <div className={s.info}>

                                {hasValue(itemRoomsLabel(item, i18n.language)) && (
<span>

                                    <img
                                        src="/BACKGROUND_2.svg"
                                        alt=""
                                    />

                                    {itemRoomsLabel(item, i18n.language) || "—"}

                                </span>
)}

                                {residentialFloorSlot(item, i18n.language).label && (
                                    <span>
                                        <FloorIcon size={22} stroke="#FFFFFF" />
                                        {residentialFloorSlot(item, i18n.language).label}
                                    </span>
                                )}

                                <span>

                                    <img
                                        src="/Icon (1).svg"
                                        alt=""
                                    />

                                    {item.type?.[i18n.language]}

                                </span>

                            </div>

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
                                    to={item.link}
                                    className={s.linkk}
                                >
                                    {t("viewProperty")}
                                </Link>

                            </div>

                            {isAdmin && (

                                <button
                                    className={s.btn}
                                    onClick={() => deleteCard(item.id)}
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