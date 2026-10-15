import { useContext, useEffect } from "react";
import { MyContext } from "../Context";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
  AdminPage,
  AdminDenied,
  ak as s
} from "./admin/AdminKit";

const ChangeCommercialPage = () => {
  const { t } = useTranslation();

  const {
    profile,
    commercialPages,
    getCommercialPages,
    deleteCommercialPage
  } = useContext(MyContext);

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    getCommercialPages();
  }, []);

  if (!isAdmin) return <AdminDenied />;

  return (
    <AdminPage
      title={t("changeCommercialPageTitle")}
      subtitle="Подробные страницы коммерческих объектов"
      back="/admin"
      backLabel="В админку"
      actions={
        <Link
          className={`${s.btn} ${s.btnPrimary}`}
          to="/admin/createCommercialPage"
        >
          + Новая страница
        </Link>
      }
    >
      {!commercialPages || commercialPages.length === 0 ? (
        <div className={s.empty}>Страниц пока нет</div>
      ) : (
        <div className={s.grid}>
          {commercialPages.map((item) => (
            <div className={s.tile} key={item.id}>
              {item.images?.[0] ? (
                <img className={s.tileImg} src={item.images[0]} alt="" loading="lazy" />
              ) : (
                <div className={s.tileImg} />
              )}

              <div className={s.tileBody}>
                <h2 className={s.tileTitle}>{item.title?.ru}</h2>
                <p className={s.tileText}>{item.location?.ru}</p>
              </div>

              <div className={s.tileActions}>
                <Link
                  className={`${s.btn} ${s.btnSm}`}
                  to={`/commercial/edit/${item.id}`}
                >
                  {t("edit")}
                </Link>

                <button
                  type="button"
                  className={`${s.btn} ${s.btnSm} ${s.btnDanger}`}
                  onClick={async () => {
                    if (confirm(t("deleteCommercialConfirm"))) {
                      await deleteCommercialPage(item.id);
                      toast.success(t("commercialDeleted"));
                    }
                  }}
                >
                  {t("delete")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminPage>
  );
};

export default ChangeCommercialPage;
