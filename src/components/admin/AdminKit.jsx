import { Link } from "react-router-dom";
import { parsePrice, formatPriceIn } from "../../utils/currency";
import s from "./admin.module.css";

// Единый «скелет» страницы админки: заголовок, ссылка «назад», кнопки справа.
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

// Бейдж «Продажа / Аренда / Продано»
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

// Переключатель Продажа / Аренда
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

// Блок формы с заголовком
export const Section = ({ title, children }) => (
  <div className={s.section}>
    {title && <h2 className={s.sectionTitle}>{title}</h2>}
    {children}
  </div>
);

// Подписанное поле. cols: 1 | 2 | 3 — число колонок в ряду полей.
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

// Три языковых поля подряд (RU / EN / UZ): name + Ru/En/Uz — как в register().
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

// Подсказка под полем цены: как цена будет выглядеть на сайте.
// Понимает "120000$", "1800$ за м2", "1 800 $/м²", "15 000 000 сум".
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

// Миниатюра объекта
export const Thumb = ({ src, className = "" }) =>
  src ? (
    <img className={`${s.thumb} ${className}`} src={src} alt="" loading="lazy" />
  ) : (
    <div className={`${s.thumb} ${s.thumbEmpty} ${className}`}>нет фото</div>
  );

// Строка поиска
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

// Фильтры-«чипсы». options: [{ value, label, count? }]
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
