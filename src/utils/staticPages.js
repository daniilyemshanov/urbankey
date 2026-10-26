export const STATIC_PAGES = ["home", "Properties", "AboutUs", "Services", "ContactUs"];

export const staticBasePath = (page) => (page === "home" ? "" : `/${page}`);

const PAGES = {
    home: {
        ru: {
            title: "Агентство недвижимости в Ташкенте",
            h1: "UrbanKey — агентство недвижимости в Ташкенте",
            description: "UrbanKey — подбор и продажа квартир и коммерческой недвижимости в Ташкенте. Ключи от вашей недвижимости.",
            intro: "Подбор и продажа квартир и коммерческой недвижимости в Ташкенте. Откройте каталог, выберите район и свяжитесь с нами.",
        },
        en: {
            title: "Real Estate Agency in Tashkent",
            h1: "UrbanKey — real estate agency in Tashkent",
            description: "UrbanKey — selection and sale of apartments and commercial real estate in Tashkent. The keys to your property.",
            intro: "Selection and sale of apartments and commercial real estate in Tashkent. Open the catalog, pick a district and get in touch.",
        },
        uz: {
            title: "Toshkentda ko'chmas mulk agentligi",
            h1: "UrbanKey — Toshkentdagi ko'chmas mulk agentligi",
            description: "UrbanKey — Toshkentda kvartiralar va tijorat ko'chmas mulkini tanlash va sotish. Sizning ko'chmas mulkingiz kalitlari.",
            intro: "Toshkentda kvartiralar va tijorat ko'chmas mulkini tanlash va sotish. Katalogni oching, tumanni tanlang va biz bilan bog'laning.",
        },
    },
    Properties: {
        ru: {
            title: "Купить недвижимость в Ташкенте",
            h1: "Недвижимость в Ташкенте: квартиры и коммерческие объекты",
            description: "Каталог недвижимости в Ташкенте: квартиры и коммерческие объекты. Актуальные предложения и цены от UrbanKey.",
            intro: "Каталог недвижимости UrbanKey в Ташкенте: квартиры и коммерческие объекты с ценами и фото. Выберите район или воспользуйтесь фильтрами.",
        },
        en: {
            title: "Buy Real Estate in Tashkent",
            h1: "Real estate in Tashkent: apartments and commercial properties",
            description: "Real estate catalog in Tashkent: apartments and commercial properties. Current listings and prices from UrbanKey.",
            intro: "UrbanKey's real estate catalog in Tashkent: apartments and commercial properties with prices and photos. Choose a district or use the filters.",
        },
        uz: {
            title: "Toshkentda ko'chmas mulk sotib olish",
            h1: "Toshkentda ko'chmas mulk: kvartiralar va tijorat obyektlari",
            description: "Toshkentdagi ko'chmas mulk katalogi: kvartiralar va tijorat obyektlari. UrbanKey'dan dolzarb takliflar va narxlar.",
            intro: "UrbanKey'ning Toshkentdagi ko'chmas mulk katalogi: narxlar va rasmlar bilan kvartiralar va tijorat obyektlari. Tumanni tanlang yoki filtrlardan foydalaning.",
        },
    },
    AboutUs: {
        ru: {
            title: "О компании",
            h1: "О компании UrbanKey",
            description: "UrbanKey — агентство недвижимости в Ташкенте: миссия, ценности и команда.",
            intro: "UrbanKey — агентство недвижимости в Ташкенте. Здесь — наша миссия, ценности и команда.",
        },
        en: {
            title: "About Us",
            h1: "About UrbanKey",
            description: "UrbanKey — a real estate agency in Tashkent: mission, values, and team.",
            intro: "UrbanKey is a real estate agency in Tashkent. Here are our mission, values and team.",
        },
        uz: {
            title: "Kompaniya haqida",
            h1: "UrbanKey kompaniyasi haqida",
            description: "UrbanKey — Toshkentdagi ko'chmas mulk agentligi: missiya, qadriyatlar va jamoa.",
            intro: "UrbanKey — Toshkentdagi ko'chmas mulk agentligi. Bu yerda missiyamiz, qadriyatlarimiz va jamoamiz haqida.",
        },
    },
    Services: {
        ru: {
            title: "Услуги",
            h1: "Услуги UrbanKey",
            description: "Услуги UrbanKey в Ташкенте: подбор недвижимости, сопровождение сделок, консультации.",
            intro: "Подбор недвижимости, сопровождение сделок и консультации в Ташкенте.",
        },
        en: {
            title: "Services",
            h1: "UrbanKey services",
            description: "UrbanKey services in Tashkent: property selection, deal support, consultations.",
            intro: "Property selection, deal support and consultations in Tashkent.",
        },
        uz: {
            title: "Xizmatlar",
            h1: "UrbanKey xizmatlari",
            description: "Toshkentda UrbanKey xizmatlari: ko'chmas mulk tanlash, bitimlarni yuritish, konsultatsiyalar.",
            intro: "Toshkentda ko'chmas mulk tanlash, bitimlarni yuritish va konsultatsiyalar.",
        },
    },
    ContactUs: {
        ru: {
            title: "Контакты",
            h1: "Контакты UrbanKey",
            description: "Свяжитесь с UrbanKey в Ташкенте: телефон, адрес офиса, форма обратной связи.",
            intro: "Телефон, адрес офиса и форма обратной связи UrbanKey в Ташкенте.",
        },
        en: {
            title: "Contact Us",
            h1: "Contact UrbanKey",
            description: "Get in touch with UrbanKey in Tashkent: phone, office address, contact form.",
            intro: "Phone, office address and contact form of UrbanKey in Tashkent.",
        },
        uz: {
            title: "Kontaktlar",
            h1: "UrbanKey kontaktlari",
            description: "UrbanKey bilan Toshkentda bog'laning: telefon, ofis manzili, aloqa formasi.",
            intro: "UrbanKey'ning Toshkentdagi telefoni, ofis manzili va aloqa formasi.",
        },
    },
};

export const getStaticPage = (page, lang) => PAGES[page]?.[lang] || null;
