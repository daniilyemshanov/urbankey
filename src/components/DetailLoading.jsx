// Состояние "загрузка" для detail-страниц (объект ещё не пришёл из базы).
// Намеренно минимальный: без новых стилей и дизайна, noindex —
// чтобы пустая оболочка не попала в индекс.

import { useTranslation } from "react-i18next";
import Seo from "./Seo";

const DetailLoading = () => {
    const { t } = useTranslation();

    return (
        <div
            role="status"
            aria-live="polite"
            style={{ minHeight: "60vh", display: "grid", placeItems: "center", color: "inherit" }}
        >
            <Seo noIndex />
            <p>{t("loading")}</p>
        </div>
    );
};

export default DetailLoading;
