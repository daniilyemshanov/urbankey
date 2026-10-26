import s from './Gray.module.css'
import { motion } from "framer-motion"
import { useTranslation } from 'react-i18next'
import { useCurrency } from '../context/CurrencyContext'
import { getRateNoteParams } from '../utils/currency'
import {
    RiInstagramFill,
    RiTelegram2Fill,
    RiFacebookFill,
} from "react-icons/ri";
const Gray = () => {

    const { t } = useTranslation()

    const { rate, rateDate } = useCurrency() ?? {}
    const rateNote = getRateNoteParams({ rate, date: rateDate })

    return (
        <motion.footer
            className={s.gray}

            initial={{
                opacity: 0,
                y: 50
            }}

            whileInView={{
                opacity: 1,
                y: 0
            }}

            transition={{
                duration: 0.8
            }}

            viewport={{
                once: false,
                amount: 0.2
            }}
        >

            <div className={s.texts}>

                <motion.div
                    className={s.text}

                    initial={{
                        opacity: 0,
                        x: -40
                    }}

                    whileInView={{
                        opacity: 1,
                        x: 0
                    }}

                    transition={{
                        delay: 0.2,
                        duration: 0.7
                    }}

                    viewport={{
                        once: false
                    }}
                >

                    <motion.p
                        className={s.legalLink}
                        whileHover={{
                            y: -2
                        }}
                    >
                        {t("rights")}
                    </motion.p>

                    <motion.p
                        className={s.legalLink}
                        whileHover={{
                            y: -2
                        }}
                    >
                        {t("terms")}
                    </motion.p>

                </motion.div>

                <motion.div
                    className={s.links}
                    initial={{ opacity: 0, x: 40 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3, duration: 0.7 }}
                    viewport={{ once: false }}
                >
                    <motion.a
                        href="https://www.instagram.com/urban_keyuz/"
                        aria-label="Instagram"
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ y: -6, scale: 1.08 }}
                    >
                        <RiInstagramFill size={22} />
                    </motion.a>

                    <motion.a
                        href="https://t.me/UrbanKeyNedvizhimost_Tashkent"
                        aria-label="UrbanKey on Telegram"
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ y: -6, scale: 1.08 }}
                    >
                        <RiTelegram2Fill size={22} />
                    </motion.a>

                    <motion.a
                        href="https://t.me/Vladislav_commercia"
                        aria-label="UrbanKey commercial listings on Telegram"
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ y: -6, scale: 1.08 }}
                    >
                        <RiTelegram2Fill size={22} />
                    </motion.a>

                    <motion.a
                        href="https://www.facebook.com/profile.php?id=61586642021148"
                        aria-label="UrbanKey on Facebook"
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ y: -6, scale: 1.08 }}
                    >
                        <RiFacebookFill size={22} />
                    </motion.a>
                </motion.div>

            </div>

            {rateNote && (
                <p className={s.rateNote}>{t("exchangeRateNote", rateNote)}</p>
            )}

        </motion.footer>
    )
}

export default Gray