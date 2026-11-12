import { TASHKENT_DISTRICTS, parseDistrictKey } from "./districts.js";
import { DISTRICT_TEXTS } from "./districtTexts.js";

export const DISTRICT_PAGE_KINDS = ["apartments", "commercial"];

const SLUG_BY_KEY = { mirzo: "mirzo-ulugbek" };
const KEY_BY_SLUG = Object.fromEntries(Object.entries(SLUG_BY_KEY).map(([k, v]) => [v, k]));

export const districtSlug = (key) => SLUG_BY_KEY[key] || key;

export const districtKeyFromSlug = (raw) => {
    if (typeof raw !== "string") return null;
    const slug = raw.trim().toLowerCase();
    return parseDistrictKey(KEY_BY_SLUG[slug] || slug);
};

export const districtBasePath = (kind, key) => `/Properties/${kind}/${districtSlug(key)}`;

export const districtPagePath = (kind, key, lang) => `/${lang}${districtBasePath(kind, key)}`;

const DISTRICTS = {
    yunusabad: {
        name: { ru: "Юнусабадский район", en: "Yunusabad District", uz: "Yunusobod tumani" },
        loc: { ru: "в Юнусабадском районе", en: "in Yunusabad District", uz: "Yunusobod tumanida" },
        about: {
            ru: "Юнусабадский район — один из крупнейших районов севера Ташкента: здесь много жилых комплексов, офисов и магазинов, есть станции метро.",
            en: "Yunusabad District is one of the largest districts in northern Tashkent, with many residential complexes, offices and shops, and several metro stations.",
            uz: "Yunusobod tumani — Toshkent shimolidagi yirik tumanlardan biri: ko'plab turar-joy majmualari, ofislar va do'konlar, metro bekatlari mavjud.",
        },
    },
    chilanzar: {
        name: { ru: "Чиланзарский район", en: "Chilanzar District", uz: "Chilonzor tumani" },
        loc: { ru: "в Чиланзарском районе", en: "in Chilanzar District", uz: "Chilonzor tumanida" },
        about: {
            ru: "Чиланзарский район — крупный жилой район на юго-западе Ташкента с развитой инфраструктурой, рынками и станциями метро.",
            en: "Chilanzar District is a large residential district in south-western Tashkent with well-developed infrastructure, markets and metro stations.",
            uz: "Chilonzor tumani — Toshkentning janubi-g'arbidagi yirik turar-joy tumani: infratuzilma yaxshi rivojlangan, bozorlar va metro bekatlari bor.",
        },
    },
    mirzo: {
        name: { ru: "Мирзо-Улугбекский район", en: "Mirzo-Ulugbek District", uz: "Mirzo Ulug'bek tumani" },
        loc: { ru: "в Мирзо-Улугбекском районе", en: "in Mirzo-Ulugbek District", uz: "Mirzo Ulug'bek tumanida" },
        about: {
            ru: "Мирзо-Улугбекский район расположен на северо-востоке Ташкента: университеты, парки и новые жилые комплексы.",
            en: "Mirzo-Ulugbek District lies in north-eastern Tashkent and combines universities, parks and new residential complexes.",
            uz: "Mirzo Ulug'bek tumani Toshkentning shimoli-sharqida joylashgan: universitetlar, bog'lar va yangi turar-joy majmualari.",
        },
    },
    shaykhantakhur: {
        name: { ru: "Шайхантахурский район", en: "Shaykhantakhur District", uz: "Shayxontohur tumani" },
        loc: { ru: "в Шайхантахурском районе", en: "in Shaykhantakhur District", uz: "Shayxontohur tumanida" },
        about: {
            ru: "Шайхантахурский район — центральный район Ташкента с историческими кварталами, торговлей и оживлённой деловой жизнью.",
            en: "Shaykhantakhur District is a central Tashkent district with historic neighbourhoods, trade and busy business activity.",
            uz: "Shayxontohur tumani — Toshkentning markaziy tumani: tarixiy mahallalar, savdo va faol ish hayoti.",
        },
    },
    yakkasaray: {
        name: { ru: "Яккасарайский район", en: "Yakkasaray District", uz: "Yakkasaroy tumani" },
        loc: { ru: "в Яккасарайском районе", en: "in Yakkasaray District", uz: "Yakkasaroy tumanida" },
        about: {
            ru: "Яккасарайский район — центральный район Ташкента с развитой инфраструктурой и сочетанием старого и нового жилого фонда.",
            en: "Yakkasaray District is a central Tashkent district with developed infrastructure and a mix of older and newer housing.",
            uz: "Yakkasaroy tumani — Toshkentning markaziy tumani: infratuzilma rivojlangan, eski va yangi uy-joylar uyg'unlashgan.",
        },
    },
    mirabad: {
        name: { ru: "Мирабадский район", en: "Mirabad District", uz: "Mirobod tumani" },
        loc: { ru: "в Мирабадском районе", en: "in Mirabad District", uz: "Mirobod tumanida" },
        about: {
            ru: "Мирабадский район — центральный район Ташкента с деловой и жилой застройкой и удобной транспортной доступностью.",
            en: "Mirabad District is a central Tashkent district with business and residential development and convenient transport links.",
            uz: "Mirobod tumani — Toshkentning markaziy tumani: ish va turar-joy binolari, qulay transport aloqasi.",
        },
    },
    sergeli: {
        name: { ru: "Сергелийский район", en: "Sergeli District", uz: "Sergeli tumani" },
        loc: { ru: "в Сергелийском районе", en: "in Sergeli District", uz: "Sergeli tumanida" },
        about: {
            ru: "Сергелийский район — южный район Ташкента, который активно застраивается; жильё здесь, как правило, доступнее, чем в центре.",
            en: "Sergeli District is a southern Tashkent district under active development; housing there is generally more affordable than in the centre.",
            uz: "Sergeli tumani — Toshkentning janubidagi faol qurilayotgan tuman; uy-joy odatda markazga qaraganda arzonroq.",
        },
    },
    yashnabad: {
        name: { ru: "Яшнабадский район", en: "Yashnabad District", uz: "Yashnobod tumani" },
        loc: { ru: "в Яшнабадском районе", en: "in Yashnabad District", uz: "Yashnobod tumanida" },
        about: {
            ru: "Яшнабадский район — восточный район Ташкента с жилыми массивами, торговыми зонами и крупными транспортными магистралями.",
            en: "Yashnabad District is an eastern Tashkent district with residential areas, retail zones and major transport routes.",
            uz: "Yashnobod tumani — Toshkentning sharqiy tumani: turar-joy massivlari, savdo hududlari va yirik transport yo'llari.",
        },
    },
    uchtepa: {
        name: { ru: "Учтепинский район", en: "Uchtepa District", uz: "Uchtepa tumani" },
        loc: { ru: "в Учтепинском районе", en: "in Uchtepa District", uz: "Uchtepa tumanida" },
        about: {
            ru: "Учтепинский район — западный район Ташкента с жилыми массивами и торговыми зонами.",
            en: "Uchtepa District is a western Tashkent district with residential areas and retail zones.",
            uz: "Uchtepa tumani — Toshkentning g'arbiy tumani: turar-joy massivlari va savdo hududlari.",
        },
    },
    almazar: {
        name: { ru: "Алмазарский район", en: "Almazar District", uz: "Olmazor tumani" },
        loc: { ru: "в Алмазарском районе", en: "in Almazar District", uz: "Olmazor tumanida" },
        about: {
            ru: "Алмазарский район — район на северо-западе Ташкента с жилой и коммерческой застройкой.",
            en: "Almazar District is located in north-western Tashkent with residential and commercial development.",
            uz: "Olmazor tumani — Toshkentning shimoli-g'arbidagi tuman: turar-joy va tijorat binolari.",
        },
    },
    bektemir: {
        name: { ru: "Бектемирский район", en: "Bektemir District", uz: "Bektemir tumani" },
        loc: { ru: "в Бектемирском районе", en: "in Bektemir District", uz: "Bektemir tumanida" },
        about: {
            ru: "Бектемирский район — район на юго-востоке Ташкента с промышленными зонами и жилой застройкой.",
            en: "Bektemir District is located in south-eastern Tashkent with industrial zones and housing.",
            uz: "Bektemir tumani — Toshkentning janubi-sharqidagi tuman: sanoat hududlari va turar-joylar.",
        },
    },
    yangihayot: {
        name: { ru: "Янгихаётский район", en: "Yangihayot District", uz: "Yangihayot tumani" },
        loc: { ru: "в Янгихаётском районе", en: "in Yangihayot District", uz: "Yangihayot tumanida" },
        about: {
            ru: "Янгихаётский район — один из новых районов Ташкента с растущей жилой застройкой.",
            en: "Yangihayot District is one of Tashkent's newer districts with growing residential development.",
            uz: "Yangihayot tumani — Toshkentning yangi tumanlaridan biri, turar-joy qurilishi o'sib bormoqda.",
        },
    },
};

const KIND_TEXT = {
    apartments: {
        title: {
            ru: (loc) => `Купить квартиру ${loc}, Ташкент`,
            en: (loc) => `Apartments for sale ${loc}, Tashkent`,
            uz: (loc) => `${loc} kvartira sotib olish, Toshkent`,
        },
        h1: {
            ru: (loc) => `Квартиры ${loc}`,
            en: (loc) => `Apartments ${loc}`,
            uz: (loc) => `${loc} kvartiralar`,
        },
        description: {
            ru: (loc) => `Квартиры ${loc} Ташкента: объявления о продаже и аренде от UrbanKey с ценами, фото и контактами агента.`,
            en: (loc) => `Apartments ${loc}, Tashkent: sale and rental listings from UrbanKey with prices, photos and agent contacts.`,
            uz: (loc) => `${loc} kvartiralar (Toshkent): UrbanKey'dan sotuv va ijara e'lonlari, narxlar, rasmlar va agent aloqasi.`,
        },
        outro: {
            ru: "Ниже — актуальные квартиры UrbanKey в этом районе. Фильтруйте по цене, комнатам и типу сделки.",
            en: "Below are UrbanKey's current apartments in this district. Filter by price, rooms and deal type.",
            uz: "Quyida shu tumandagi UrbanKey kvartiralari. Narx, xonalar soni va bitim turi bo'yicha saralang.",
        },
    },
    commercial: {
        title: {
            ru: (loc) => `Коммерческая недвижимость ${loc}, Ташкент`,
            en: (loc) => `Commercial property ${loc}, Tashkent`,
            uz: (loc) => `${loc} tijorat binolari, Toshkent`,
        },
        h1: {
            ru: (loc) => `Коммерческая недвижимость ${loc}`,
            en: (loc) => `Commercial property ${loc}`,
            uz: (loc) => `${loc} tijorat binolari`,
        },
        description: {
            ru: (loc) => `Коммерческая недвижимость ${loc} Ташкента: офисы, торговые и другие помещения от UrbanKey с ценами и фото.`,
            en: (loc) => `Commercial property ${loc}, Tashkent: offices, retail and other premises from UrbanKey with prices and photos.`,
            uz: (loc) => `${loc} tijorat ko'chmas mulki (Toshkent): UrbanKey'dan ofislar, savdo va boshqa binolar, narxlar va rasmlar.`,
        },
        outro: {
            ru: "Ниже — актуальные коммерческие объекты UrbanKey в этом районе: офисы, торговые и другие помещения.",
            en: "Below are UrbanKey's current commercial listings in this district: offices, retail and other premises.",
            uz: "Quyida shu tumandagi UrbanKey tijorat obyektlari: ofislar, savdo va boshqa binolar.",
        },
    },
};

export function getDistrictPage(kind, key, lang) {
    const d = DISTRICTS[key];
    const k = KIND_TEXT[kind];
    if (!d || !k || !d.loc[lang]) return null;
    const loc = d.loc[lang];
    const custom = DISTRICT_TEXTS[key]?.[kind]?.[lang];
    return {
        name: d.name[lang],
        title: k.title[lang](loc),
        h1: k.h1[lang](loc),
        description: k.description[lang](loc),
        intro: custom ? String(custom).trim() : `${d.about[lang]} ${k.outro[lang]}`,
    };
}

export const allDistrictPages = () =>
    DISTRICT_PAGE_KINDS.flatMap((kind) => TASHKENT_DISTRICTS.map((d) => ({ kind, key: d.key })));
