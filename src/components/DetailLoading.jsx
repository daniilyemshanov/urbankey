import { useTranslation } from "react-i18next";

const DetailLoading = () => {
    const { t } = useTranslation();

    return (
        <div
            role="status"
            aria-live="polite"
            style={{ minHeight: "60vh", display: "grid", placeItems: "center", color: "inherit" }}
        >
            <p>{t("loading")}</p>
        </div>
    );
};

export default DetailLoading;
