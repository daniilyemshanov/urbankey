import { useState } from 'react'
import s from './Realtor.module.css'
import { motion } from "framer-motion"
import { useTranslation } from 'react-i18next'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Keyboard, A11y } from 'swiper/modules'
import 'swiper/css'
import {
    ShieldCheck, Building2, Home, Tag, Wallet, ClipboardCheck,
    Camera, Megaphone, Newspaper, Users, Phone, ChevronLeft, ChevronRight
} from 'lucide-react'

const PHONE = "+998 78 707 04 47"
const PHONE_HREF = "+998787070447"

const MEMBERS = [
    { key: "vladislav", type: "head", photo: "/Vladislav.webp", badge: true, thumbSize: "170% auto", thumbPos: "74.3% 5.6%" },
    { key: "sunnat", type: "agent", photo: "/Sunnat.webp", thumbSize: "230% auto", thumbPos: "50.0% 8.4%" },
    { key: "mamurjon", type: "agent", photo: "/Mamurjon.webp", thumbSize: "220% auto", thumbPos: "50.0% 16.9%" },
    { key: "sarvinoz", type: "agent", photo: "/Sarvinoz.webp", thumbSize: "150% auto", thumbPos: "50.0% 9.0%" },
    { key: "igor", type: "agent", photo: "/Igor.webp", thumbSize: "220% auto", thumbPos: "50.0% 16.9%" },
    { key: "timur", type: "agent", photo: "/Timur.webp", thumbSize: "170% auto", thumbPos: "64.6% 4.4%" },
    { key: "irina", type: "smm", photo: "/Irina.webp", thumbSize: "190% auto", thumbPos: "50.0% 11.8%" },
]

const POINT_ICONS = {
    head: [ShieldCheck, Building2, Tag, ClipboardCheck],
    agent: [Building2, Home, Wallet, ClipboardCheck],
    smm: [Megaphone, Camera, Newspaper, Users],
}

const Realtor = () => {

    const { t } = useTranslation()
    const [swiper, setSwiper] = useState(null)
    const [active, setActive] = useState(0)

    const go = (i) => swiper?.slideTo(i)

    return (
        <section className={s.realtor} id='realtor'>

            <motion.div
                className={s.text}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ amount: 0.2 }}
            >
                <img src="/Abstract Design.svg" alt="" className={s.logo} />

                <h2>{t("realtor.title")}</h2>

                <div className={s.titles}>
                    <p>{t("realtor.subtitle")}</p>
                </div>
            </motion.div>

            <div className={s.content}>

                <Swiper
                    className={s.slider}
                    modules={[Keyboard, A11y]}
                    keyboard={{ enabled: true }}
                    spaceBetween={40}
                    speed={600}
                    grabCursor
                    autoHeight={false}
                    onSwiper={setSwiper}
                    onSlideChange={(sw) => setActive(sw.activeIndex)}
                >
                    {MEMBERS.map((member) => {
                        const base = `realtor.members.${member.key}`
                        const icons = POINT_ICONS[member.type]

                        return (
                            <SwiperSlide key={member.key} className={s.slide}>
                                <div className={s.card}>

                                    <div className={s.photoWrap}>
                                        <img
                                            src={member.photo}
                                            alt={t(`${base}.name`)}
                                            className={s.photo}
                                            draggable={false}
                                        />
                                        {member.badge && (
                                            <div className={s.badge}>
                                                <span>{t("realtor.experienceBadge")}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className={s.info}>
                                        <h2>{t(`${base}.name`)}</h2>
                                        <h3>{t(`${base}.role`)}</h3>

                                        <p className={s.about}>{t(`realtor.about.${member.type}`)}</p>

                                        <div className={s.points}>
                                            {icons.map((Icon, i) => (
                                                <div key={i} className={s.point}>
                                                    <div className={s.icon}><Icon size={22} /></div>
                                                    <div>
                                                        <h4>{t(`realtor.points.${member.type}.${i}.title`)}</h4>
                                                        <p>{t(`realtor.points.${member.type}.${i}.description`)}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className={s.actions}>
                                            <motion.a
                                                className={s.callButton}
                                                href={`tel:${PHONE_HREF}`}
                                                whileHover={{ scale: 1.04 }}
                                                whileTap={{ scale: 0.96 }}
                                            >
                                                <Phone size={18} />
                                                {PHONE}
                                            </motion.a>
                                        </div>
                                    </div>

                                </div>
                            </SwiperSlide>
                        )
                    })}
                </Swiper>

                <div className={s.controls}>

                    <button
                        type="button"
                        className={s.arrow}
                        onClick={() => swiper?.slidePrev()}
                        disabled={active === 0}
                        aria-label="Previous"
                    >
                        <ChevronLeft size={22} />
                    </button>

                    <div className={s.switcher} role="tablist" aria-label={t("realtor.title")}>
                        {MEMBERS.map((m, i) => (
                            <button
                                key={m.key}
                                type="button"
                                role="tab"
                                aria-selected={i === active}
                                className={`${s.thumb} ${i === active ? s.thumbActive : ''}`}
                                onClick={() => go(i)}
                            >
                                <span
                                    className={s.thumbImg}
                                    style={{
                                        backgroundImage: `url(${m.photo})`,
                                        backgroundSize: m.thumbSize,
                                        backgroundPosition: m.thumbPos,
                                    }}
                                />
                                <span>{t(`realtor.members.${m.key}.short`)}</span>
                            </button>
                        ))}
                    </div>

                    <button
                        type="button"
                        className={s.arrow}
                        onClick={() => swiper?.slideNext()}
                        disabled={active === MEMBERS.length - 1}
                        aria-label="Next"
                    >
                        <ChevronRight size={22} />
                    </button>

                </div>

            </div>

        </section>
    )
}

export default Realtor
