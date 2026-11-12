import { useContext, useEffect, useMemo, useState } from "react";
import { MyContext } from "../Context";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
  AdminPage,
  AdminDenied,
  SearchBar,
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

  const [query, setQuery] = useState("");

  useEffect(() => {
    getCommercialPages();
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = commercialPages || [];

    if (!q) return list;

    return list.filter((item) =>
      [
        item.title?.ru,
        item.title?.en,
        item.title?.uz,
        item.location?.ru,
        item.location?.en,
        String(item.id)
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [commercialPages, query]);

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
      <div className={s.toolbar}>
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Поиск по названию, адресу или ID"
        />
      </div>

      {!commercialPages || commercialPages.length === 0 ? (
        <div className={s.empty}>Страниц пока нет</div>
      ) : visible.length === 0 ? (
        <div className={s.empty}>Ничего не найдено</div>
      ) : (
        <div className={s.grid}>
          {visible.map((item) => (
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
