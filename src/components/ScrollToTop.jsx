import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { stripLangPrefix } from "../utils/lang";

const ScrollToTop = () => {

    const { pathname } = useLocation();

    const pageKey = stripLangPrefix(pathname) || "/";

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pageKey]);

    return null;
};

export default ScrollToTop;
