import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { getStaticPage } from "../src/utils/staticPages.js";
import { TASHKENT_DISTRICTS } from "../src/utils/districts.js";
import { getDistrictPage } from "../src/utils/districtPages.js";

const LANGS = ["ru", "en", "uz"];
const LOCALES = Object.fromEntries(LANGS.map((lang) => [
    lang,
    JSON.parse(fs.readFileSync(new URL(`../src/locales/${lang}/translation.json`, import.meta.url), "utf8")),
]));

const apartmentRentalTerms = {
    ru: /аренд[а-я]* квартир|квартир[а-я]* в аренд|снять квартир/iu,
    en: /apartments? for rent|rent an apartment|rental apartments?/iu,
    uz: /kvartira ijarasi|ijaraga kvartira/iu,
};

test("каталог не обещает только покупку, когда показывает общий каталог", () => {
    const forbiddenBuyOnly = { ru: /купить недвижимость/iu, en: /buy real estate/iu, uz: /ko'chmas mulk sotib olish/iu };
    for (const lang of LANGS) {
        assert.doesNotMatch(LOCALES[lang].seoPropertiesTitle, forbiddenBuyOnly[lang]);
        assert.match(LOCALES[lang].seoPropertiesTitle, /ташкент|tashkent|toshkent/iu);
    }
});

test("страницы квартир по районам не оптимизируются под аренду квартир", () => {
    for (const district of TASHKENT_DISTRICTS) {
        for (const lang of LANGS) {
            const page = getDistrictPage("apartments", district.key, lang);
            const content = `${page.title} ${page.description} ${page.intro}`;
            assert.doesNotMatch(content, apartmentRentalTerms[lang], `${district.key}/${lang}`);
        }
    }
});

test("страницы коммерческой недвижимости сохраняют коммерческую аренду", () => {
    const commercial = getDistrictPage("commercial", "yunusabad", "ru");
    assert.match(commercial.title, /продажа и аренда/iu);
});

test("контакты описывают покупку квартир и аренду коммерческих помещений, без аренды квартир", () => {
    for (const lang of LANGS) {
        const page = getStaticPage("ContactUs", lang);
        assert.doesNotMatch(page.intro, apartmentRentalTerms[lang]);
    }
});
