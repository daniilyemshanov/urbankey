import { Phone } from "lucide-react";
import { useTranslation } from "react-i18next";
import s from "./CallFloatButton.module.css";

const PHONE_NUMBER = "+998 78 707 04 47";
const PHONE_HREF = "+998787070447";

const CallFloatButton = () => {
    const { t } = useTranslation();
    const label = t("callAriaLabel", { phone: PHONE_NUMBER });

    return (
        <a
            href={`tel:${PHONE_HREF}`}
            className={s.button}
            aria-label={label}
            title={label}
        >
            <Phone size={22} className={s.icon} strokeWidth={2.2} />
            <span className={s.label}>{t("callButton")}</span>
        </a>
    );
};

export default CallFloatButton;
