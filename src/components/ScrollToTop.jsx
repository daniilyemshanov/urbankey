import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { stripLangPrefix } from "../utils/lang";

const ScrollToTop = () => {

    const { pathname } = useLocation();

    // Смена языка меняет только префикс (/ru/AboutUs -> /en/AboutUs),
    // это та же страница, поэтому позицию прокрутки не сбрасываем.
    const pageKey = stripLangPrefix(pathname) || "/";

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pageKey]);

    return null;
};

export default ScrollToTop;
