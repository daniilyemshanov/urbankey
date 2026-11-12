import { Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import s from "./TelegramFloatButton.module.css";

const TELEGRAM_USERNAME = "VladislavBroker";

const TelegramFloatButton = () => {
    const { t } = useTranslation();
    const label = t("chatAriaLabel");

    return (
        <a
            href={`https://t.me/${TELEGRAM_USERNAME}`}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className={s.button}
            aria-label={label}
            title={label}
        >
            <Send size={22} className={s.icon} strokeWidth={2.2} />
            <span className={s.label}>{t("chatButton")}</span>
        </a>
    );
};

export default TelegramFloatButton;
