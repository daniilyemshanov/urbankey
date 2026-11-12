import { Navigate, useLocation } from "react-router-dom";
import { DEFAULT_LANG } from "../utils/lang";

const LegacyRedirect = () => {
    const { pathname, search, hash } = useLocation();

    return <Navigate to={`/${DEFAULT_LANG}${pathname}${search}${hash}`} replace />;
};

export default LegacyRedirect;
