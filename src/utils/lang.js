export const SUPPORTED_LANGS = ["ru", "en", "uz"];
export const DEFAULT_LANG = "ru";

export const isSupportedLang = (value) => SUPPORTED_LANGS.includes(value);

export const buildLangPath = (pathname, lang) => {
    const parts = pathname.split("/").filter(Boolean);

    if (parts.length > 0 && isSupportedLang(parts[0])) {
        parts[0] = lang;
        return "/" + parts.join("/");
    }

    return pathname;
};

export const localizedPath = (path, lang) => {
    const safeLang = isSupportedLang(lang) ? lang : DEFAULT_LANG;
    const clean = path.startsWith("/") ? path : `/${path}`;
    return `/${safeLang}${clean === "/" ? "" : clean}`;
};

export const stripLangPrefix = (pathname) => {
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length > 0 && isSupportedLang(parts[0])) {
        const rest = parts.slice(1).join("/");
        return rest ? "/" + rest : "";
    }
    return pathname;
};
