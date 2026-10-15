import { Link } from "react-router-dom";
import { useContext } from "react";
import { MyContext } from "../Context";
import { AdminPage, AdminDenied, ak as s } from "../components/admin/AdminKit";

const Icon = ({ d }) => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {d.map((p, i) => (
      <path key={i} d={p} />
    ))}
  </svg>
);

const ICONS = {
  list: ["M8 6h12", "M8 12h12", "M8 18h12", "M4 6h.01", "M4 12h.01", "M4 18h.01"],
  plus: ["M12 5v14", "M5 12h14"],
  page: ["M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z", "M14 3v5h5"],
  users: [
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
    "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
    "M22 21v-2a4 4 0 0 0-3-3.87",
    "M16 3.13a4 4 0 0 1 0 7.75"
  ],
  inbox: [
    "M22 12h-6l-2 3h-4l-2-3H2",
    "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"
  ]
};

const GROUPS = [
  {
    title: "Квартиры",
    items: [
      {
        to: "/admin/changeCard",
        icon: "list",
        name: "Каталог квартир",
        desc: "Правка карточек, Продажа / Аренда, статус «Продано»"
      },
      {
        to: "/admin/createCard",
        icon: "plus",
        name: "Новая карточка",
        desc: "Добавить квартиру в каталог"
      },
      {
        to: "/admin/CreateVilla",
        icon: "page",
        name: "Новая страница квартиры",
        desc: "Подробная страница объекта"
      },
      {
        to: "/admin/changeVilla",
        icon: "page",
        name: "Страницы квартир",
        desc: "Изменить подробные страницы"
      }
    ]
  },
  {
    title: "Коммерция",
    items: [
      {
        to: "/admin/commercials",
        icon: "list",
        name: "Каталог коммерции",
        desc: "Правка карточек, Продажа / Аренда, статус «Продано»"
      },
      {
        to: "/admin/createCommercialPage",
        icon: "plus",
        name: "Новая страница коммерции",
        desc: "Добавить коммерческий объект"
      },
      {
        to: "/admin/changeCommercialPage",
        icon: "page",
        name: "Страницы коммерции",
        desc: "Изменить или удалить страницы"
      }
    ]
  },
  {
    title: "Люди и заявки",
    items: [
      {
        to: "/admin/users",
        icon: "users",
        name: "Пользователи",
        desc: "Роли и доступ администраторов"
      },
      {
        to: "/admin/leads",
        icon: "inbox",
        name: "Заявки (CRM)",
        desc: "Обращения клиентов и их статусы"
      }
    ]
  }
];

const Admin = () => {
  const { profile } = useContext(MyContext);

  const isAdmin = profile?.role === "admin";

  if (!isAdmin) return <AdminDenied />;

  return (
    <AdminPage title="Админ-панель" subtitle="Управление объектами, пользователями и заявками">
      {GROUPS.map((group) => (
        <div key={group.title} className={s.hubGroup}>
          <h2 className={s.hubGroupTitle}>{group.title}</h2>

          <div className={s.hubGrid}>
            {group.items.map((item) => (
              <Link key={item.to} className={s.hubCard} to={item.to}>
                <span className={s.hubIcon}>
                  <Icon d={ICONS[item.icon]} />
                </span>

                <span className={s.hubName}>{item.name}</span>
                <span className={s.hubDesc}>{item.desc}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </AdminPage>
  );
};

export default Admin;
