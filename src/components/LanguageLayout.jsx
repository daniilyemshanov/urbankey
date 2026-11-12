import { useEffect } from "react";
import { Outlet, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { isSupportedLang } from "../utils/lang";
import NotFound from "../pages/Error";

const LanguageLayout = () => {
    const { lang } = useParams();
    const { i18n } = useTranslation();
    const valid = isSupportedLang(lang);

    useEffect(() => {
        if (!valid) return;

        if (i18n.language !== lang) {
            i18n.changeLanguage(lang);
        }

        document.documentElement.lang = lang;
    }, [lang, valid, i18n]);

    if (!valid) {
        return <NotFound />;
    }

    return <Outlet />;
};

export default LanguageLayout;
