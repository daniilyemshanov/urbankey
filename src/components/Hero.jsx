import { Link } from 'react-router-dom'
import s from './Hero.module.css'
import { motion } from "framer-motion"
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { localizedPath } from '../utils/lang'
import AiSearchBar from './AiSearchBar'

const Hero = () => {

    const { t, i18n } = useTranslation()

    const [propertiesCount, setPropertiesCount] = useState(null)

    const [videoSrc, setVideoSrc] = useState(undefined)

    useEffect(() => {

        let idleId
        let timerId
        let cancelled = false

        const start = () => {
            if (!cancelled) setVideoSrc("/hero-bg.mp4")
        }

        const schedule = () => {
            if ("requestIdleCallback" in window) {
                idleId = window.requestIdleCallback(start, { timeout: 3000 })
            } else {
                timerId = setTimeout(start, 1500)
            }
        }

        if (document.readyState === "complete") {
            schedule()
        } else {
            window.addEventListener("load", schedule, { once: true })
        }

        return () => {
            cancelled = true
            window.removeEventListener("load", schedule)
            if (idleId !== undefined) window.cancelIdleCallback(idleId)
            if (timerId !== undefined) clearTimeout(timerId)
        }

    }, [])

    useEffect(() => {

        const fetchCount = async () => {

            const countOf = async (view, table) => {
                const res = await supabase.from(view).select("id", { count: "exact", head: true })
                if (!res.error) return res
                return supabase.from(table).select("id", { count: "exact", head: true })
            }

            const [cards, commercials] = await Promise.all([
                countOf("cardss_public", "cardss"),
                countOf("commercials_public", "commercials"),
            ])

            const total = (cards.count || 0) + (commercials.count || 0)

            if (total > 0) setPropertiesCount(total)
        }

        fetchCount()

    }, [])

    return (
        <section className={s.hero} id='HeroSection'>


            <video
                className={s.bgVideo}
                autoPlay
                muted
                loop
                playsInline
                preload="none"
                poster="/hero-poster.webp"
                src={videoSrc}
            />


            <div className={s.overlay}></div>


            <motion.div
                className={s.text}
                initial={{ opacity: 0, x: -80 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.9 }}
                viewport={{ amount: 0.2 }}
            >

                <div className={s.titles}>

                    <motion.h1
                        className={s.titl}
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7 }}
                        viewport={{ amount: 0.2 }}
                    >
                        {t("heroTitle1")}
                    </motion.h1>

                    <motion.h2
                        className={s.titl}
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, delay: 0.15 }}
                        viewport={{ amount: 0.2 }}
                    >
                        {t("heroTitle2")}
                    </motion.h2>

                    <motion.h3
                        className={s.subtitle}
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, delay: 0.3 }}
                        viewport={{ amount: 0.2 }}
                    >
                        {t("heroSubtitle")}
                    </motion.h3>

                </div>

                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.4 }}
                    viewport={{ amount: 0.2 }}
                >
                    <AiSearchBar className={s.aiSearchBar} />
                </motion.div>

                <motion.div
                    className={s.btns}
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.45 }}
                    viewport={{ amount: 0.2 }}
                >

                    <Link className={s.link1} to={localizedPath("/AboutUs", i18n.language)}>
                        {t("learnMore")}
                    </Link>

                    <Link className={s.link2} to={localizedPath("/Properties", i18n.language)}>
                        {t("browseProperties")}
                    </Link>

                </motion.div>

                <div className={s.info}>

                    <motion.div
                        className={s.card}
                        initial={{ opacity: 0, scale: 0.8 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6 }}
                        viewport={{ amount: 0.2 }}
                        whileHover={{ y: -10, scale: 1.03 }}
                    >
                        <p className={s.statValue}>{propertiesCount ? `${propertiesCount}+` : "—"}</p>
                        <p>{t("propertiesForClients")}</p>
                    </motion.div>

                    <motion.div
                        className={s.card}
                        initial={{ opacity: 0, scale: 0.8 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6, delay: 0.15 }}
                        viewport={{ amount: 0.2 }}
                        whileHover={{ y: -10, scale: 1.03 }}
                    >
                        <p className={s.statValue}>6+</p>
                        <p>{t("yearsExperience")}</p>
                    </motion.div>

                    <motion.div
                        className={s.card}
                        initial={{ opacity: 0, scale: 0.8 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        viewport={{ amount: 0.2 }}
                        whileHover={{ y: -10, scale: 1.03 }}
                    >
                        <p className={s.statValue}>3</p>
                        <p>{t("languagesSupported")}</p>
                    </motion.div>

                </div>

            </motion.div>
            <motion.img
                src="/c3383124-8cd3-4f72-9ab0-7fd2f40c9fcc.webp"
                alt=""
                className={s.imgg}
                fetchPriority="high"
                decoding="async"

                initial={{ opacity: 0, x: 100, scale: 0.9 }}
                whileInView={{ opacity: 1, x: 0, scale: 1 }}
                transition={{
                    duration: 1,
                    ease: [0.22, 1, 0.36, 1]
                }}
                viewport={{ amount: 0.2 }}

                whileHover={{
                    scale: 1.02
                }}
            />

        </section>
    )
}

export default Hero