import s from './Property.module.css'

import { motion } from "framer-motion"
import { useTranslation } from "react-i18next"
import { useCurrency } from "../context/CurrencyContext"
import { formatPriceIn } from "../utils/currency"
import { roomsLabel } from "../utils/rooms"
import { hasValue } from "../utils/hasValue"

import { Swiper, SwiperSlide } from "swiper/react"
import { Navigation, Pagination, Autoplay } from "swiper/modules"

import "swiper/css"
import "swiper/css/navigation"
import "swiper/css/pagination"

import { useState } from "react"





import GalleryModal from "./GalleryModal"

const Property = ({ data }) => {









    const {
        i18n,
        t
    } = useTranslation();

    const { currency, rate } = useCurrency();



    const [open, setOpen] = useState(false);

    const [index, setIndex] = useState(0);









    if (!data) return null;

    const images = data.images || [];

    return (

        <section className={s.property}>


            <div className={s.all}>


                <motion.div

                    className={s.swiperWrapper}

                    initial={{
                        opacity: 0
                    }}

                    animate={{
                        opacity: 1
                    }}

                    transition={{
                        duration: 1
                    }}

                >



                    <Swiper


                        modules={[
                            Navigation,
                            Pagination,
                            Autoplay
                        ]}


                        navigation


                        pagination={{
                            clickable: true
                        }}


                        loop={
                            images.length > 1
                        }


                        autoplay={{
                            delay: 3000,
                            disableOnInteraction: false
                        }}


                        observer
                        observeParents
                        onSwiper={(swiper) => {
                            requestAnimationFrame(() => swiper.update());
                        }}


                        className={s.mySwiper}



                    >



                        {
                            images.map((img, i) => (


                                <SwiperSlide

                                    key={i}

                                    className={s.slide}

                                >



                                    <img

                                        src={img}

                                        alt={`${data?.title?.[i18n.language] || data?.title?.ru || t("properties")} — ${t("photo")} ${i + 1}`}

                                        loading="lazy"

                                        decoding="async"

                                        onClick={() => {

                                            setIndex(i)

                                            setOpen(true)

                                        }}


                                    />


                                </SwiperSlide>


                            ))
                        }



                    </Swiper>



                </motion.div>


                {data.video && (
                    <video
                        className={s.videoPlayer}
                        src={data.video}
                        controls
                        preload="metadata"
                    />
                )}







                <motion.div

                    className={s.texts}


                    initial={{
                        opacity: 0
                    }}


                    animate={{
                        opacity: 1
                    }}


                    transition={{
                        duration: 1
                    }}


                >





                    <h2>

                        {t("features")}

                    </h2>




                    <div className={s.rooms}>


                        <h2>
                            {roomsLabel(data.bedrooms, i18n.language)}
                        </h2>



                        <h2>
                            {data.type?.[i18n.language]}
                        </h2>


                    </div>







                    <div className={s.specifi}>


                        <h2>

                            {t("specifications")}

                        </h2>





                        <div className={s.cards}>


                            {hasValue(roomsLabel(data.bedrooms, i18n.language)) && (
<div className={s.card}>


                                <h4>
                                    {t("bedrooms")}
                                </h4>


                                <h3>

                                    {roomsLabel(data.bedrooms, i18n.language)}

                                </h3>


                            </div>
)}







                            {hasValue(data.type?.[i18n.language]) && (
<div className={s.card}>


                                <h4>

                                    {t("type")}

                                </h4>


                                <h3>

                                    {data.type?.[i18n.language]}

                                </h3>


                            </div>
)}
                          


                            {hasValue(data.square) && (
<div className={s.card}>
                                <h4>{t("square")}</h4>
                                <h3>
                                    {data.square || "—"} m²
                                </h3>
                            </div>
)}







                            {hasValue(data.price) && (
<div className={s.card}>


                                <h4>

                                    {t("price")}

                                </h4>


                                <h3>

                                    {formatPriceIn(data.price, currency, rate)}

                                </h3>


                            </div>
)}




                        </div>



                    </div>





                </motion.div>





            </div>









            <motion.div

                className={s.text}


                initial={{
                    opacity: 0,
                    y: 50
                }}


                whileInView={{
                    opacity: 1,
                    y: 0
                }}


                transition={{
                    duration: 1
                }}


                viewport={{
                    once: true
                }}


            >




                <h2>

                    {t("about")}

                </h2>



                <p>

                    {data.about?.[i18n.language]}

                </p>




            </motion.div>









            {
                open &&


                <GalleryModal


                    images={images}


                    activeIndex={index}


                    onClose={() => setOpen(false)}


                />

            }





        </section>

    )

}



export default Property