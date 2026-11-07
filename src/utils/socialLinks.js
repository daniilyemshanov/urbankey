// Официальные профили UrbanKey. Используются в микроразметке (sameAs): так Google
// связывает сайт с этими профилями и понимает, что это одна и та же компания.
// Личные контакты менеджеров (например, t.me/Vladislav_commercia) сюда не входят:
// они остаются только в подвале сайта.

export const SOCIAL_LINKS = {
    instagram: "https://www.instagram.com/urban_keyuz/",
    telegramChannel: "https://t.me/UrbanKeyNedvizhimost_Tashkent",
    facebook: "https://www.facebook.com/profile.php?id=61586642021148",
};

export const SAME_AS = Object.values(SOCIAL_LINKS);

// Варианты написания названия (для «имени сайта» и бренда в поиске)
export const BRAND_NAME = "UrbanKey";
export const BRAND_ALTERNATE_NAMES = ["Urban Key", "UrbanKey Tashkent", "UrbanKey Ташкент"];
