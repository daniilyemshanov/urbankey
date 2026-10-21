// Состояние "загрузка" для detail-страниц (объект ещё не пришёл из базы).
// Намеренно минимальный: без новых стилей и дизайна. <head> здесь не трогаем:
// серверные теги объявления (title, canonical, hreflang — api/spa.js) остаются, а
// noindex на время загрузки НЕ ставим — иначе робот, снявший страницу до ответа
// базы, получил бы noindex у живого объявления. Несуществующие объекты уже
// отдаются сервером как 404 + X-Robots-Tag: noindex, а после загрузки
// ошибку/404 показывает <Error /> (noindex).

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
