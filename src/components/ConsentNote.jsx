// Строка под формами со ссылками на Политику конфиденциальности и Условия.
// variant="note"  — «Отправляя форму, вы соглашаетесь с …» (формы без галочки);
// variant="links" — только ссылки (рядом с галочкой согласия).
// Ссылки открываются в новой вкладке, чтобы не потерять заполненную форму.

import { useTranslation } from "react-i18next";
import { localizedPath } from "../utils/lang";
import s from "./ConsentNote.module.css";

const TEXT = {
    ru: { lead: "Отправляя форму, вы соглашаетесь с ", privacy: "Политикой конфиденциальности", and: " и ", terms: "Условиями использования", end: "." },
    en: { lead: "By submitting the form you agree to the ", privacy: "Privacy Policy", and: " and ", terms: "Terms of Use", end: "." },
    uz: { lead: "Shaklni yuborib, siz ", privacy: "Maxfiylik siyosati", and: " va ", terms: "Foydalanish shartlari", end: "ga rozilik bildirasiz." },
};

const ConsentNote = ({ variant = "note" }) => {
    const { i18n } = useTranslation();
    const lang = TEXT[i18n.language] ? i18n.language : "ru";
    const tx = TEXT[lang];

    const links = (
        <>
            <a href={localizedPath("/Privacy", lang)} target="_blank" rel="noopener noreferrer">{tx.privacy}</a>
            {variant === "links" ? " · " : tx.and}
            <a href={localizedPath("/Terms", lang)} target="_blank" rel="noopener noreferrer">{tx.terms}</a>
        </>
    );

    return (
        <p className={s.note}>
            {variant === "links" ? links : <>{tx.lead}{links}{tx.end}</>}
        </p>
    );
};

export default ConsentNote;
