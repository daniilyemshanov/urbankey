import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { parsePrice, formatPriceIn } from "../../utils/currency";
import s from "./admin.module.css";

export const AdminPage = ({
  title,
  subtitle,
  back,
  backLabel = "Назад",
  actions,
  narrow = false,
  children
}) => (
  <section className={s.page}>
    <div className={`${s.shell} ${narrow ? s.shellNarrow : ""}`}>
      <div className={s.head}>
        <div>
          {back && (
            <Link className={s.back} to={back}>
              ← {backLabel}
            </Link>
          )}

          <h1 className={s.title}>{title}</h1>

          {subtitle && <p className={s.subtitle}>{subtitle}</p>}
        </div>

        {actions && <div className={s.headActions}>{actions}</div>}
      </div>

      {children}
    </div>
  </section>
);

export const AdminDenied = () => (
  <section className={s.page}>
    <p className={s.denied}>Доступ только для администраторов.</p>
  </section>
);

export const DealBadge = ({ isRent }) => (
  <span className={`${s.badge} ${isRent ? s.badgeRent : s.badgeSale}`}>
    {isRent ? "Аренда" : "Продажа"}
  </span>
);

export const SoldBadge = ({ isSold }) =>
  isSold ? (
    <span className={`${s.badge} ${s.badgeSold}`}>Продано</span>
  ) : (
    <span className={`${s.badge} ${s.badgeOk}`}>На сайте</span>
  );

export const DealSwitch = ({ value, onChange }) => (
  <div className={s.segment} role="group" aria-label="Тип сделки">
    <button
      type="button"
      className={`${s.segmentBtn} ${value !== "rent" ? s.segmentActive : ""}`}
      onClick={() => onChange("sale")}
    >
      Продажа
    </button>

    <button
      type="button"
      className={`${s.segmentBtn} ${
        value === "rent" ? `${s.segmentActive} ${s.segmentActiveRent}` : ""
      }`}
      onClick={() => onChange("rent")}
    >
      Аренда
    </button>
  </div>
);

export const Section = ({ title, children }) => (
  <div className={s.section}>
    {title && <h2 className={s.sectionTitle}>{title}</h2>}
    {children}
  </div>
);

export const Fields = ({ cols = 3, children }) => (
  <div
    className={`${s.fields} ${cols === 2 ? s.fields2 : ""} ${
      cols === 1 ? s.fields1 : ""
    }`}
  >
    {children}
  </div>
);

export const Field = ({ label, children }) => (
  <label className={s.field}>
    <span className={s.label}>{label}</span>
    {children}
  </label>
);

export const TriFields = ({ label, name, register, textarea = false }) => (
  <Fields cols={textarea ? 1 : 3}>
    {["Ru", "En", "Uz"].map((lang) => (
      <Field key={lang} label={`${label} ${lang.toUpperCase()}`}>
        {textarea ? (
          <textarea className={s.textarea} {...register(`${name}${lang}`)} />
        ) : (
          <input
            className={s.input}
            type="text"
            {...register(`${name}${lang}`)}
          />
        )}
      </Field>
    ))}
  </Fields>
);

export const PriceHint = ({ value }) => {
  const parsed = parsePrice(value);

  return (
    <span className={s.label} style={{ fontSize: 12 }}>
      {parsed
        ? `На сайте: ${formatPriceIn(value, parsed.currency, null)}`
        : "Например: 120 000$ или 1 800$ за м²"}
    </span>
  );
};

export const ObjectPicker = ({
  items = [],
  value,
  onSelect,
  placeholder = "Поиск по названию…",
  emptyText = "Ничего не найдено",
  collapsible = false
}) => {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(!value);

  const selected = items.find((i) => String(i.id) === String(value));

  const visible = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return items;

    return items.filter((i) =>
      [i.title?.ru, i.title?.en, i.title?.uz, i.subtitle, String(i.id)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(query))
    );
  }, [items, q]);

  const pick = (item) => {
    onSelect(item.id);
    setQ("");
    setOpen(false);
  };

  const label = (i) => i.title?.ru || i.title?.en || i.title?.uz || `#${i.id}`;

  if (collapsible && selected && !open) {
    return (
      <div className={s.pickerChosen}>
        <Thumb src={selected.image} className={s.pickerThumb} />

        <div className={s.pickerText}>
          <div className={s.pickerTitle}>{label(selected)}</div>
          {selected.subtitle ? (
            <div className={s.pickerSub}>{selected.subtitle}</div>
          ) : null}
        </div>

        <div
          className={s.pickerChange}
          role="button"
          tabIndex={0}
          onClick={() => setOpen(true)}
          onKeyDown={(e) => e.key === "Enter" && setOpen(true)}
        >
          Сменить
        </div>
      </div>
    );
  }

  return (
    <div className={s.picker}>
      <div className={s.pickerSearch}>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#d4af37"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>

        <input
          className={s.pickerInput}
          type="text"
          value={q}
          placeholder={placeholder}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (visible[0]) pick(visible[0]);
            }
          }}
        />
      </div>

      <div className={s.pickerMeta}>
        <span>
          Найдено: {visible.length} из {items.length}
        </span>
        <span>Enter — выбрать первый</span>
      </div>

      <div className={s.pickerList}>
        {visible.length === 0 ? (
          <div className={s.pickerRow} style={{ cursor: "default" }}>
            <span className={s.pickerSub}>{emptyText}</span>
          </div>
        ) : (
          visible.slice(0, 100).map((item) => (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              className={`${s.pickerRow} ${
                String(item.id) === String(value) ? s.pickerRowActive : ""
              }`}
              onClick={() => pick(item)}
              onKeyDown={(e) => e.key === "Enter" && pick(item)}
            >
              <Thumb src={item.image} className={s.pickerThumb} />

              <div className={s.pickerText}>
                <div className={s.pickerTitle}>{label(item)}</div>
                {item.subtitle ? (
                  <div className={s.pickerSub}>{item.subtitle}</div>
                ) : null}
              </div>

              <DealBadge isRent={item.is_rent} />
            </div>
          ))
        )}

        {visible.length > 100 && (
          <div className={s.pickerMeta}>
            Показаны первые 100 — уточните поиск
          </div>
        )}
      </div>
    </div>
  );
};

export const Thumb = ({ src, className = "" }) =>
  src ? (
    <img className={`${s.thumb} ${className}`} src={src} alt="" loading="lazy" />
  ) : (
    <div className={`${s.thumb} ${s.thumbEmpty} ${className}`}>нет фото</div>
  );

export const SearchBar = ({ value, onChange, placeholder = "Поиск…" }) => (
  <div className={s.search}>
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#d4af37"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>

    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

export const Chips = ({ options, value, onChange }) => (
  <div className={s.chips}>
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        className={`${s.chip} ${value === o.value ? s.chipActive : ""}`}
        onClick={() => onChange(o.value)}
      >
        {o.label}
        {typeof o.count === "number" ? ` · ${o.count}` : ""}
      </button>
    ))}
  </div>
);

export { s as ak };
