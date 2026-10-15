import { useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MyContext } from "../../Context";
import {
  AdminPage,
  AdminDenied,
  SearchBar,
  Chips,
  Thumb,
  DealBadge,
  SoldBadge,
  ak as s
} from "./AdminKit";

// Список объектов админки (квартиры или коммерция) с поиском, фильтрами и
// быстрыми кнопками «Продано» / «Вернуть».
const CONFIG = {
  card: {
    title: "Квартиры",
    subtitle: "Каталог карточек: правка, статус сделки и «Продано»",
    editPath: (id) => `/admin/changeCard/${id}`,
    pagePath: (id) => `/admin/CreateVilla/${id}`,
    createPath: "/admin/createCard",
    createLabel: "+ Новая карточка"
  },
  commercial: {
    title: "Коммерция",
    subtitle: "Каталог коммерческих объектов: правка, статус сделки и «Продано»",
    editPath: (id) => `/admin/changeCommercial/${id}`,
    pagePath: (id) => `/admin/createCommercialPage/${id}`,
    createPath: "/admin/createCommercialPage",
    createLabel: "+ Новый объект"
  }
};

const ListingsManager = ({ kind = "card" }) => {
  const cfg = CONFIG[kind];

  const { profile, getAdminListings, setListingSold } = useContext(MyContext);

  const isAdmin = profile?.role === "admin";

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    setItems(await getAdminListings(kind));
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [kind, isAdmin]);

  const counts = useMemo(
    () => ({
      all: items.length,
      sale: items.filter((i) => !i.is_sold && !i.is_rent).length,
      rent: items.filter((i) => !i.is_sold && i.is_rent).length,
      sold: items.filter((i) => i.is_sold).length
    }),
    [items]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();

    return items.filter((i) => {
      if (filter === "sale" && (i.is_sold || i.is_rent)) return false;
      if (filter === "rent" && (i.is_sold || !i.is_rent)) return false;
      if (filter === "sold" && !i.is_sold) return false;

      if (!q) return true;

      return [i.title?.ru, i.title?.en, i.title?.uz, i.subtitle, String(i.id)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [items, query, filter]);

  const toggleSold = async (item) => {
    const makeSold = !item.is_sold;

    const ok = window.confirm(
      makeSold
        ? `Отметить «${item.title?.ru || item.id}» как проданный? Объект пропадёт с сайта.`
        : `Вернуть «${item.title?.ru || item.id}» на сайт?`
    );

    if (!ok) return;

    setBusyId(item.id);

    const done = await setListingSold(kind, item.id, makeSold);

    if (done) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_sold: makeSold } : i))
      );
    }

    setBusyId(null);
  };

  if (!isAdmin) return <AdminDenied />;

  return (
    <AdminPage
      title={cfg.title}
      subtitle={cfg.subtitle}
      back="/admin"
      backLabel="В админку"
      actions={
        <Link className={`${s.btn} ${s.btnPrimary}`} to={cfg.createPath}>
          {cfg.createLabel}
        </Link>
      }
    >
      <div className={s.toolbar}>
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Поиск по названию или ID"
        />

        <Chips
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "Все", count: counts.all },
            { value: "sale", label: "Продажа", count: counts.sale },
            { value: "rent", label: "Аренда", count: counts.rent },
            { value: "sold", label: "Проданные", count: counts.sold }
          ]}
        />
      </div>

      {loading ? (
        <div className={s.empty}>Загрузка…</div>
      ) : visible.length === 0 ? (
        <div className={s.empty}>Ничего не найдено</div>
      ) : (
        <div className={s.list}>
          {visible.map((item) => (
            <div
              key={item.id}
              className={`${s.item} ${item.is_sold ? s.itemSold : ""}`}
            >
              <Thumb src={item.image} />

              <div className={s.itemBody}>
                <div className={s.itemTitle}>
                  {item.title?.ru || item.title?.en || `#${item.id}`}
                </div>

                <div className={s.itemMeta}>
                  <DealBadge isRent={item.is_rent} />
                  <SoldBadge isSold={item.is_sold} />

                  {item.price ? (
                    <span className={s.price}>{item.price}</span>
                  ) : null}
                </div>
              </div>

              <div className={s.itemActions}>
                {!item.is_sold && (
                  <>
                    <Link
                      className={`${s.btn} ${s.btnSm}`}
                      to={cfg.editPath(item.id)}
                    >
                      Изменить
                    </Link>

                    <Link
                      className={`${s.btn} ${s.btnSm}`}
                      to={cfg.pagePath(item.id)}
                    >
                      Страница
                    </Link>
                  </>
                )}

                <button
                  type="button"
                  disabled={busyId === item.id}
                  className={`${s.btn} ${s.btnSm} ${
                    item.is_sold ? s.btnSuccess : s.btnDanger
                  }`}
                  onClick={() => toggleSold(item)}
                >
                  {item.is_sold ? "Вернуть" : "Продано"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminPage>
  );
};

export default ListingsManager;
