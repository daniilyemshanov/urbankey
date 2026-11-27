import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { toast } from "react-toastify";
import { MapPin, Ruler, BedDouble, SlidersHorizontal, X, Trash2, RotateCcw } from "lucide-react";
import FloorIcon from "./FloorIcon";
import { residentialFloorLabel } from "../utils/floor";
import { itemRoomsLabel } from "../utils/rooms";
import { MyContext } from "../Context";
import { localizedPath } from "../utils/lang";
import { useCurrency } from "../context/CurrencyContext";
import { formatPriceIn, convertCurrencyAmount, isValidRate, priceInCurrency } from "../utils/currency";
import { TASHKENT_DISTRICTS, detectDistrict, parseDistrictKey, districtCatalogPath } from "../utils/districts";
import { districtPagePath } from "../utils/districtPages";
import { parsePropertyQuery, searchFiltersFromUrl, searchFiltersToParams } from "../utils/propertySearch";
import { searchPublicListings, PROPERTY_SEARCH_PAGE_SIZE } from "../api/propertySearch";
import FavoriteButton from "./FavoriteButton";
import { SkeletonGrid } from "./SkeletonCard";
import { isListingViewed, markListingViewed } from "../utils/viewedListings";
import useVillaLocations from "../hooks/useVillaLocations";
import s from "./Catalog.module.css";

const RESIDENTIAL_TYPE_LABELS = {
    ru: { apartment: "Квартира", house: "Дом", newbuilding: "Новостройка" },
    en: { apartment: "Apartment", house: "House", newbuilding: "New building" },
    uz: { apartment: "Kvartira", house: "Uy", newbuilding: "Yangi qurilish" }
};
const RUSSIAN_DISTRICT_NAMES = {
    yunusabad: "Юнусабадский район", chilanzar: "Чиланзарский район", mirzo: "Мирзо-Улугбекский район",
    shaykhantakhur: "Шайхантахурский район", yakkasaray: "Яккасарайский район", mirabad: "Мирабадский район",
    sergeli: "Сергелийский район", yashnabad: "Яшнабадский район", uchtepa: "Учтепинский район",
    almazar: "Алмазарский район", bektemir: "Бектемирский район", yangihayot: "Янгихаётский район"
};
const quickQueries = {
    ru: ["Квартира до $100k", "Аренда в Юнусабаде", "Офис от 100 м²"],
    en: ["Apartment under $100k", "Rent in Yunusabad", "Office from 100 sqm"],
    uz: ["$100 ming gacha kvartira", "Yunusobodda ijara", "100 kv.m dan ofis"]
};

const matchesPropertyType = (item, type) => {
    const haystack = `${item.typeLabel || ""} ${item.searchText || ""} ${item.class_ru || ""}`.toLocaleLowerCase();
    const patterns = {
        apartment: /(квартир|apartment|flat|kvartir)/u,
        house: /(дом|house|uy)/u,
        newbuilding: /(новостро|new build|yangi qurilish)/u,
        office: /(офис|office|ofis)/u
    };
    return patterns[type] ? patterns[type].test(haystack) : haystack.includes(type.toLocaleLowerCase());
};

const firstInteger = (value) => {
    const match = String(value ?? "").match(/\d+/);
    return match ? Number(match[0]) : null;
};

const toItem = (row, lang) => {
    const category = row.category;
    const raw = row;
    const title = raw[`title_${lang}`] || raw.title_ru || raw.title_en || raw.title_uz || "";
    const description = raw[`description_${lang}`] || raw.description_ru || raw.description_en || raw.description_uz || "";
    const typeLabel = category === "commercial"
        ? raw[`class_${lang}`] || raw.class_ru || raw.class_en || raw.class_uz || ""
        : raw[`type_${lang}`] || raw.type_ru || raw.type_en || raw.type_uz || "";
    const districtText = [raw.district_ru, raw.district_en, raw.district_uz, raw.address_ru, raw.address_en, raw.address_uz];
    const rentValue = raw.search_is_rent ?? raw.is_rent;
    return {
        ...raw,
        id: raw.id,
        category,
        title,
        description,
        typeLabel,
        image: raw.image,
        price: raw.discount_price || raw.price,
        isRent: rentValue === true || rentValue === "true",
        is_rent: rentValue,
        bedroomsLabel: itemRoomsLabel({ bedrooms: { ru: raw.bedrooms_ru, en: raw.bedrooms_en, uz: raw.bedrooms_uz } }, lang),
        bathroomsValue: firstInteger(raw.bathrooms_ru || raw.bathrooms_en || raw.bathrooms_uz),
        bedroomsValue: firstInteger(raw.bedrooms_ru || raw.bedrooms_en || raw.bedrooms_uz),
        floor: raw.search_floor ?? raw.floor,
        totalFloors: raw.search_total_floors ?? raw.total_floors,
        area: raw.area,
        address: raw[`address_${lang}`] || raw.address_ru || raw.address_en || raw.address_uz || "",
        statusLabel: raw[`status_${lang}`] || raw.status_ru || raw.status_en || raw.status_uz || "",
        district: raw[`district_${lang}`] || raw.district_ru || raw.address_ru || raw.address_en || "",
        districtKey: detectDistrict([
            ...districtText, raw.search_location_ru, raw.search_location_en, raw.search_location_uz, raw.landmark_ru, raw.landmark_en, raw.landmark_uz,
            raw.title_ru, raw.title_en, raw.title_uz, raw.description_ru, raw.description_en, raw.description_uz
        ]),
        boostedUntil: raw.boosted_until,
        isBoosted: Boolean(raw.boosted_until) && new Date(raw.boosted_until).getTime() > Date.now(),
        link: localizedPath(category === "residential" ? `/property/${raw.id}` : `/commercial/${raw.id}`, lang)
    };
};

const Catalog = ({ presetCategory = null, presetKind = null, presetDistrict = null } = {}) => {
    const { profile, deleteCard, deleteCommercial, getCards, getCommercials, properties = [], commercials = [] } = useContext(MyContext);
    const { t, i18n } = useTranslation();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const { currency, rate } = useCurrency();
    const lang = i18n.language?.split("-")[0] || "ru";
    const urlFilters = useMemo(() => searchFiltersFromUrl(searchParams), [searchParams]);
    const urlMinPrice = urlFilters.minPrice;
    const urlMaxPrice = urlFilters.maxPrice;
    const urlPriceCurrency = urlFilters.priceCurrency;
    const category = presetCategory || (urlFilters.category === "residential" || urlFilters.category === "commercial" ? urlFilters.category : "all");
    const activeDistrict = presetDistrict || parseDistrictKey(urlFilters.district) || "all";
    const requestedType = urlFilters.type || "all";
    const typeFilter = (category === "commercial" && !["all", "office"].includes(requestedType)) || (category === "residential" && requestedType === "office") ? "all" : requestedType;
    const storedPriceCurrency = urlFilters.priceCurrency || currency;
    const filterCurrency = isValidRate(rate) || storedPriceCurrency === currency ? currency : storedPriceCurrency;
    const displayMinPrice = convertCurrencyAmount(urlFilters.minPrice, storedPriceCurrency, filterCurrency, rate);
    const displayMaxPrice = convertCurrencyAmount(urlFilters.maxPrice, storedPriceCurrency, filterCurrency, rate);
    const displayDistrictName = (district) => lang === "ru" ? RUSSIAN_DISTRICT_NAMES[district.key] : district[lang] || district.ru;
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [page, setPage] = useState(1);
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [legacySearchEnabled, setLegacySearchEnabled] = useState(false);
    const villaLocations = useVillaLocations(legacySearchEnabled);
    const [deletingId, setDeletingId] = useState(null);
    const [refreshToken, setRefreshToken] = useState(0);
    const requestId = useRef(0);
    const rpcUnavailable = useRef(false);
    const legacyRequested = useRef(false);
    const previousPriceContext = useRef({ currency, rate });
    const getCardsRef = useRef(getCards);
    const getCommercialsRef = useRef(getCommercials);
    useEffect(() => {
        getCardsRef.current = getCards;
        getCommercialsRef.current = getCommercials;
    }, [getCards, getCommercials]);
    const isAdmin = profile?.role === "admin";

    const updateFilters = useCallback((patch, { replace = false } = {}) => {
        const current = searchFiltersFromUrl(searchParams);
        const next = { ...current, ...patch };
        if (presetCategory) next.category = presetCategory;
        setSearchParams(searchFiltersToParams(next, searchParams), { replace, preventScrollReset: true });
        setPage(1);
    }, [searchParams, setSearchParams, presetCategory]);

    useEffect(() => {
        const previous = previousPriceContext.current;
        if (previous.currency !== currency || previous.rate !== rate) {
            previousPriceContext.current = { currency, rate };
            setPage(1);
            setRows([]);
            setTotal(0);
            setLoading(true);
        }
    }, [currency, rate]);

    useEffect(() => {
        if ((urlMinPrice || urlMaxPrice) && !urlPriceCurrency) {
            const params = new URLSearchParams(searchParams);
            params.set("pc", currency);
            setSearchParams(params, { replace: true, preventScrollReset: true });
        }
    }, [urlMinPrice, urlMaxPrice, urlPriceCurrency, currency, searchParams, setSearchParams]);

    const districtAliases = useMemo(() => {
        const entry = TASHKENT_DISTRICTS.find((d) => d.key === activeDistrict);
        return entry ? [entry.ru, entry.en, entry.uz, ...(entry.aliases || [])] : [];
    }, [activeDistrict]);

    const requestFilters = useMemo(() => ({
        q: urlFilters.q.trim(),
        category: category === "all" ? "all" : category,
        type: typeFilter === "all" ? "" : typeFilter,
        dealType: urlFilters.dealType,
        district: activeDistrict === "all" ? "" : activeDistrict,
        minPrice: convertCurrencyAmount(urlFilters.minPrice, storedPriceCurrency, filterCurrency, rate),
        maxPrice: convertCurrencyAmount(urlFilters.maxPrice, storedPriceCurrency, filterCurrency, rate),
        minBedrooms: category === "commercial" ? "" : urlFilters.minBedrooms,
        minArea: category === "residential" ? "" : urlFilters.minArea,
        maxArea: category === "residential" ? "" : urlFilters.maxArea,
        minFloor: urlFilters.minFloor,
        location: urlFilters.location || ""
    }), [urlFilters, category, activeDistrict, storedPriceCurrency, filterCurrency, rate, typeFilter]);

    useEffect(() => {
        const id = ++requestId.current;
        const timer = setTimeout(async () => {
            setLoading(true);
            setError(false);
            try {
                let result;
                if (!rpcUnavailable.current) {
                    try {
                        result = await searchPublicListings({ filters: requestFilters, sort: urlFilters.sort || (requestFilters.q ? "relevance" : "newest"), page, currency: filterCurrency, rate, districtAliases });
                    } catch (rpcError) {
                        if (!/search_public_listings|function.*not found|could not find the function/i.test(`${rpcError?.message || ""} ${rpcError?.code || ""}`)) throw rpcError;
                        rpcUnavailable.current = true;
                        setLegacySearchEnabled(true);
                    }
                }
                if (id !== requestId.current) return;
                if (result) {
                    const mapped = result.items.map((row) => toItem(row, lang));
                    setRows((current) => page === 1 ? mapped : [...current, ...mapped]);
                    setTotal(result.total);
                } else {
                    // Compatibility path while the optional RPC migration has not been applied.
                    // Load through the same public views used by the previous catalog implementation.
                    if (!legacyRequested.current) {
                        legacyRequested.current = true;
                        const loaders = [];
                        if (!properties.length) loaders.push(getCardsRef.current());
                        if (!commercials.length) loaders.push(getCommercialsRef.current());
                        if (loaders.length) {
                            await Promise.all(loaders);
                            return;
                        }
                    }
                    const legacy = [
                        ...properties.map((item) => {
                            const locations = villaLocations[item.id] || [];
                            const titleText = Object.values(item.title || {}).join(" ");
                            const descriptionText = Object.values(item.description || {}).join(" ");
                            const typeText = Object.values(item.type || {}).join(" ");
                            const locationIndex = { ru: 0, en: 1, uz: 2 }[lang] ?? 0;
                            const district = locations[locationIndex] || locations.find((value) => value) || "";
                            return { ...item, category: "residential", title: item.title?.[lang] || item.title?.ru || "", description: item.description?.[lang] || item.description?.ru || "", typeLabel: item.type?.[lang] || item.type?.ru || "", searchText: `${titleText} ${descriptionText} ${typeText} ${locations.join(" ")}`, bedroomsLabel: itemRoomsLabel(item, lang), bathroomsValue: firstInteger(item.bathrooms?.ru || item.bathrooms?.en || item.bathrooms?.uz), price: item.price, isRent: item.is_rent === true || item.is_rent === "true", is_rent: item.is_rent, bedroomsValue: firstInteger(item.bedrooms?.ru || item.bedrooms?.en || item.bedrooms?.uz), district, districtKey: detectDistrict(locations), link: localizedPath(`/property/${item.id}`, lang) };
                        }),
                        ...commercials.map((item) => {
                            const localized = (value) => typeof value === "object" && value !== null ? value[lang] || value.ru || value.en || value.uz || "" : value || "";
                            const district = localized(item.district);
                            const address = localized(item.address);
                            const typeLabel = localized(item.class);
                            const title = localized(item.title);
                            const description = localized(item.description);
                            return { ...item, category: "commercial", title, description, typeLabel, searchText: `${Object.values(item.title || {}).join(" ")} ${Object.values(item.description || {}).join(" ")} ${Object.values(item.district || {}).join(" ")} ${Object.values(item.address || {}).join(" ")} ${Object.values(item.class || {}).join(" ")} ${Object.values(item.landmark || {}).join(" ")}`, price: item.discount_price || item.price, isRent: item.is_rent === true || item.is_rent === "true", district, address, statusLabel: localized(item.status), districtKey: detectDistrict([district, address, localized(item.landmark)]), link: localizedPath(`/commercial/${item.id}`, lang) };
                        })
                    ].filter((item) => category === "all" || item.category === category)
                        .filter((item) => !requestFilters.dealType || item.isRent === (requestFilters.dealType === "rent"))
                        .filter((item) => activeDistrict === "all" || item.districtKey === activeDistrict || districtAliases.some((alias) => `${item.district || ""} ${item.address || item.address_ru || ""} ${item.title || ""}`.toLocaleLowerCase().includes(alias.toLocaleLowerCase())))
                        .filter((item) => !requestFilters.type || matchesPropertyType(item, requestFilters.type))
                        .filter((item) => !requestFilters.q || `${item.searchText || ""} ${item.title || ""} ${item.description || ""} ${item.typeLabel || ""} ${item.district || ""} ${item.address || item.address_ru || ""}`.toLocaleLowerCase().includes(requestFilters.q.toLocaleLowerCase()))
                        .filter((item) => !requestFilters.location || requestFilters.location !== "center" || /(центр|markaz|downtown|city centre|city center)/iu.test(`${item.searchText || ""} ${item.address || ""} ${item.district || ""}`))
                        .filter((item) => !requestFilters.minBedrooms || (item.category === "residential" && (item.bedroomsValue || 0) >= Number(requestFilters.minBedrooms)))
                        .filter((item) => !requestFilters.minArea || (item.category === "commercial" && Number(item.area) >= Number(requestFilters.minArea)))
                        .filter((item) => !requestFilters.maxArea || (item.category === "commercial" && Number(item.area) <= Number(requestFilters.maxArea)))
                        .filter((item) => !requestFilters.minFloor || (firstInteger(item.floor) || 0) >= Number(requestFilters.minFloor))
                        .filter((item) => {
                            if (!requestFilters.minPrice && !requestFilters.maxPrice) return true;
                            const amount = priceInCurrency(item.price, filterCurrency, rate, item.area);
                            if (amount == null) return false;
                            return (!requestFilters.minPrice || amount >= Number(requestFilters.minPrice)) && (!requestFilters.maxPrice || amount <= Number(requestFilters.maxPrice));
                        });
                    const sort = urlFilters.sort || (requestFilters.q ? "relevance" : "newest");
                    legacy.sort((a, b) => sort === "priceAsc" ? (priceInCurrency(a.price, filterCurrency, rate, a.area) ?? Infinity) - (priceInCurrency(b.price, filterCurrency, rate, b.area) ?? Infinity) : sort === "priceDesc" ? (priceInCurrency(b.price, filterCurrency, rate, b.area) ?? -Infinity) - (priceInCurrency(a.price, filterCurrency, rate, a.area) ?? -Infinity) : Number(b.id) - Number(a.id));
                    const totalLegacy = legacy.length;
                    const mapped = legacy.slice((page - 1) * PROPERTY_SEARCH_PAGE_SIZE, page * PROPERTY_SEARCH_PAGE_SIZE);
                    setRows((current) => page === 1 ? mapped : [...current, ...mapped]);
                    setTotal(totalLegacy);
                }
            } catch (err) {
                if (id !== requestId.current) return;
                console.error("Catalog search failed:", err);
                setRows([]);
                setTotal(0);
                setError(true);
            } finally {
                if (id === requestId.current) setLoading(false);
            }
        }, 220);
        return () => clearTimeout(timer);
    }, [requestFilters, urlFilters.sort, page, currency, filterCurrency, rate, districtAliases, lang, refreshToken, properties, commercials, activeDistrict, category, villaLocations]);

    const setDistrict = (value) => {
        if (presetCategory) {
            const picked = parseDistrictKey(value);
            navigate(picked
                ? districtPagePath(presetKind || "apartments", picked, lang)
                : localizedPath("/Properties", lang));
            return;
        }
        updateFilters({ district: parseDistrictKey(value) || "", category });
    };

    const setCategory = (value) => updateFilters({
        category: value,
        type: "",
        district: activeDistrict === "all" ? "" : activeDistrict,
        minBedrooms: value === "commercial" ? "" : urlFilters.minBedrooms,
        minArea: value === "residential" ? "" : urlFilters.minArea,
        maxArea: value === "residential" ? "" : urlFilters.maxArea
    });

    const updatePriceRange = (field, value) => {
        const min = convertCurrencyAmount(urlFilters.minPrice, storedPriceCurrency, filterCurrency, rate);
        const max = convertCurrencyAmount(urlFilters.maxPrice, storedPriceCurrency, filterCurrency, rate);
        updateFilters({
            minPrice: field === "minPrice" ? value : min,
            maxPrice: field === "maxPrice" ? value : max,
            priceCurrency: (field === "minPrice" ? value : min) || (field === "maxPrice" ? value : max) ? filterCurrency : ""
        });
    };

    const updateAreaRange = (field, value) => {
        let min = field === "minArea" ? value : urlFilters.minArea;
        let max = field === "maxArea" ? value : urlFilters.maxArea;
        if (min && max && Number(min) > Number(max)) {
            if (field === "minArea") max = min;
            else min = max;
        }
        updateFilters({ minArea: min, maxArea: max });
    };

    const applyNaturalQuery = (query, replace = false) => {
        const parsed = parsePropertyQuery(query);
        const next = {
            ...urlFilters,
            ...parsed.filters,
            category: presetCategory || parsed.filters.category || category,
            district: presetDistrict || parsed.filters.district || (activeDistrict === "all" ? "" : activeDistrict),
            q: parsed.keywords,
            minPrice: parsed.filters.minPrice != null ? String(Math.round(parsed.filters.minPrice)) : urlFilters.minPrice,
            maxPrice: parsed.filters.maxPrice != null ? String(Math.round(parsed.filters.maxPrice)) : urlFilters.maxPrice,
            priceCurrency: parsed.filters.minPrice != null || parsed.filters.maxPrice != null ? (parsed.filters.priceCurrency || urlFilters.priceCurrency || filterCurrency) : urlFilters.priceCurrency,
            minBedrooms: parsed.filters.minBedrooms != null ? String(parsed.filters.minBedrooms) : urlFilters.minBedrooms,
            minArea: parsed.filters.minArea != null ? String(parsed.filters.minArea) : urlFilters.minArea,
            location: parsed.filters.location || ""
        };
        updateFilters(next, { replace });
    };

    const clearFilters = () => {
        const next = { q: "", category: presetCategory || "all", type: "", dealType: "", district: presetDistrict || "", minPrice: "", maxPrice: "", minBedrooms: "", minArea: "", maxArea: "", minFloor: "", location: "", sort: "" };
        setSearchParams(searchFiltersToParams(next, searchParams), { replace: true, preventScrollReset: true });
        setPage(1);
    };

    const handleDelete = async (item) => {
        if (!window.confirm(t("catalogDeleteConfirm"))) return;
        setDeletingId(`${item.category}-${item.id}`);
        const ok = item.category === "residential" ? await deleteCard(item.id) : await deleteCommercial(item.id);
        setDeletingId(null);
        if (ok !== false) {
            toast.success(t("cardDeleted"));
            setRefreshToken((value) => value + 1);
        }
    };

    const quick = quickQueries[lang] || quickQueries.ru;
    const typeValues = RESIDENTIAL_TYPE_LABELS[lang] || RESIDENTIAL_TYPE_LABELS.ru;
    const setChip = (patch) => updateFilters(patch);
    const chipList = [
        urlFilters.q && { label: urlFilters.q, patch: { q: "" } },
        category !== "all" && !presetCategory && { label: t(`catalog.${category}`), patch: { category: "all", type: "" } },
        urlFilters.dealType && { label: t(`dealType.${urlFilters.dealType}`), patch: { dealType: "" } },
        activeDistrict !== "all" && !presetDistrict && { label: displayDistrictName(TASHKENT_DISTRICTS.find((district) => district.key === activeDistrict) || { key: activeDistrict, ru: activeDistrict }), patch: { district: "" } },
        displayMinPrice !== "" && { label: `${t("catalog.priceFrom")} ${displayMinPrice} ${filterCurrency}`, patch: { minPrice: "", priceCurrency: displayMaxPrice !== "" ? storedPriceCurrency : "" } },
        displayMaxPrice !== "" && { label: `${t("catalog.priceTo")} ${displayMaxPrice} ${filterCurrency}`, patch: { maxPrice: "", priceCurrency: displayMinPrice !== "" ? storedPriceCurrency : "" } },
        urlFilters.minBedrooms && category !== "commercial" && { label: `${urlFilters.minBedrooms}+ ${t("bedrooms")}`, patch: { minBedrooms: "" } },
        urlFilters.minArea && category !== "residential" && { label: `${t("catalog.areaFrom")} ${urlFilters.minArea} m²`, patch: { minArea: "" } },
        urlFilters.maxArea && category !== "residential" && { label: `${t("catalog.areaTo")} ${urlFilters.maxArea} m²`, patch: { maxArea: "" } },
        urlFilters.minFloor && { label: `${t("catalog.floorFrom")} ${urlFilters.minFloor}`, patch: { minFloor: "" } }
    ].filter(Boolean);

    return (
        <section className={s.catalog} id="discover">
            <div className={s.container}>
                {!loading && rows.length > 0 && activeDistrict !== "all" && total === 0 && <meta name="robots" content="noindex, follow" />}
                <div className={s.topBar}>
                    {!presetCategory && <div className={s.tabs} role="group" aria-label={t("catalog.category")}>
                        {["all", "residential", "commercial"].map((value) => (
                            <button key={value} type="button" className={`${s.tab} ${category === value ? s.tabActive : ""}`} onClick={() => setCategory(value)} aria-pressed={category === value}>{t(value === "all" ? "catalog.allCategories" : `catalog.${value}`)}</button>
                        ))}
                    </div>}
                    <button type="button" className={s.filtersToggle} onClick={() => setFiltersOpen((value) => !value)} aria-expanded={filtersOpen}>
                        <SlidersHorizontal size={18} />{t("catalog.filtersTitle")}
                    </button>
                </div>

                <div className={s.quickSearches} aria-label={t("catalog.popularSearches")}>
                    <span>{t("catalog.popularSearches")}:</span>
                    {quick.map((query) => <button type="button" key={query} onClick={() => applyNaturalQuery(query)}>{query}</button>)}
                </div>

                {TASHKENT_DISTRICTS.length > 0 && <nav className={s.districtNav} aria-label={t("catalog.district")}>
                    <Link to={presetCategory ? localizedPath("/Properties", lang) : districtCatalogPath(null, lang)} onClick={(event) => { if (!presetCategory) { event.preventDefault(); setDistrict("all"); } }} className={`${s.districtChip} ${activeDistrict === "all" ? s.districtChipActive : ""}`}>{t("catalog.allDistricts")}</Link>
                    {TASHKENT_DISTRICTS.map((district) => <Link key={district.key} to={presetCategory ? districtPagePath(presetKind || "apartments", district.key, lang) : districtCatalogPath(district.key, lang)} onClick={(event) => { if (!presetCategory) { event.preventDefault(); setDistrict(district.key); } }} className={`${s.districtChip} ${activeDistrict === district.key ? s.districtChipActive : ""}`} aria-current={activeDistrict === district.key ? "true" : undefined}>{displayDistrictName(district)}</Link>)}
                </nav>}

                <div className={`${s.filtersPanel} ${filtersOpen ? s.filtersPanelOpen : ""}`}>
                    <div className={s.field}><label htmlFor="catalog-type">{t("type")}</label><select id="catalog-type" value={typeFilter} onChange={(event) => updateFilters({ type: event.target.value === "all" ? "" : event.target.value })}>
                        <option value="all">{t("catalog.allTypes")}</option>
                        {category !== "commercial" && Object.entries(typeValues).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                        {category !== "residential" && <option value="office">{t("catalog.office")}</option>}
                    </select></div>
                    <div className={s.field}><label htmlFor="catalog-deal">{t("dealType.label")}</label><select id="catalog-deal" value={urlFilters.dealType || "all"} onChange={(event) => updateFilters({ dealType: event.target.value === "all" ? "" : event.target.value })}><option value="all">{t("dealType.all")}</option><option value="sale">{t("dealType.sale")}</option><option value="rent">{t("dealType.rent")}</option></select></div>
                    <div className={s.field}><label htmlFor="catalog-district">{t("catalog.district")}</label><select id="catalog-district" value={activeDistrict} onChange={(event) => setDistrict(event.target.value)}><option value="all">{t("catalog.allDistricts")}</option>{TASHKENT_DISTRICTS.map((district) => <option key={district.key} value={district.key}>{displayDistrictName(district)}</option>)}</select></div>
                    <div className={s.field}><label htmlFor="catalog-min-price">{t("catalog.priceFrom")} · {filterCurrency}</label><input id="catalog-min-price" type="number" min="0" inputMode="decimal" value={displayMinPrice} placeholder="0" max={displayMaxPrice || undefined} onChange={(event) => updatePriceRange("minPrice", event.target.value)} /></div>
                    <div className={s.field}><label htmlFor="catalog-max-price">{t("catalog.priceTo")} · {filterCurrency}</label><input id="catalog-max-price" type="number" inputMode="decimal" value={displayMaxPrice} placeholder="∞" min={displayMinPrice || 0} onChange={(event) => updatePriceRange("maxPrice", event.target.value)} /></div>
                    {category !== "commercial" && <div className={s.field}><label htmlFor="catalog-beds">{t("bedrooms")}</label><select id="catalog-beds" value={urlFilters.minBedrooms || "all"} onChange={(event) => updateFilters({ minBedrooms: event.target.value === "all" ? "" : event.target.value })}><option value="all">{t("catalog.bedroomsAnyShort")}</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{t("catalog.bedroomsPlus", { n })}</option>)}</select></div>}
                    {category !== "residential" && <>
                        <div className={s.field}><label htmlFor="catalog-area-min">{t("catalog.areaFrom")} (m²)</label><input id="catalog-area-min" type="number" min="0" value={urlFilters.minArea} max={urlFilters.maxArea || undefined} onChange={(event) => updateAreaRange("minArea", event.target.value)} /></div>
                        <div className={s.field}><label htmlFor="catalog-area-max">{t("catalog.areaTo")} (m²)</label><input id="catalog-area-max" type="number" min="0" value={urlFilters.maxArea} min={urlFilters.minArea || 0} onChange={(event) => updateAreaRange("maxArea", event.target.value)} /></div>
                    </>}
                    <div className={s.field}><label htmlFor="catalog-floor">{t("catalog.floorFrom")}</label><input id="catalog-floor" type="number" min="0" value={urlFilters.minFloor} onChange={(event) => updateFilters({ minFloor: event.target.value })} /></div>
                    <div className={s.field}><label htmlFor="catalog-sort">{t("catalog.sort")}</label><select id="catalog-sort" value={urlFilters.sort || (urlFilters.q ? "relevance" : "newest")} onChange={(event) => updateFilters({ sort: event.target.value })}><option value="relevance">{t("catalog.sortRelevance")}</option><option value="newest">{t("catalog.sortNewest")}</option><option value="priceAsc">{t("catalog.sortPriceAsc")}</option><option value="priceDesc">{t("catalog.sortPriceDesc")}</option></select></div>
                    <button type="button" className={s.resetBtn} onClick={clearFilters}><RotateCcw size={16} />{t("catalog.resetFilters")}</button>
                </div>

                {chipList.length > 0 && <div className={s.activeChips} aria-label={t("catalog.activeFilters")}>{chipList.map((chip, index) => <button type="button" key={`${chip.label}-${index}`} onClick={() => { setChip(chip.patch); }} className={s.activeChip}>{chip.label}<X size={13} /></button>)}</div>}

                <div className={s.resultHeader}><p className={s.resultsCount}>{loading ? t("catalog.searching") : t("catalog.resultsCount", { count: total })}</p>{total > 0 && <span className={s.pageMeta}>{t("catalog.showingCount", { count: rows.length, total })}</span>}</div>

                {loading && page === 1 ? <SkeletonGrid count={6} gridClassName={s.grid} /> : error ? <div className={s.noResults}><h3>{t("catalog.searchUnavailable")}</h3><p>{t("catalog.searchUnavailableHint")}</p></div> : rows.length === 0 ? <div className={s.noResults}><h3>{t("catalog.noResults")}</h3><p>{t("catalog.refineSearch")}</p><button type="button" className={s.resetBtn} onClick={clearFilters}><RotateCcw size={16} />{t("catalog.resetFilters")}</button><div className={s.quickSearches}>{quick.map((query) => <button type="button" key={query} onClick={() => { updateFilters({ q: query }); }}>{query}</button>)}</div></div> : <>
                    <div className={s.grid}>{rows.map((item) => <motion.article key={`${item.category}-${item.id}`} className={s.card} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ amount: 0.15, once: true }} transition={{ duration: 0.25 }}>
                        <div className={s.imageBox}>
                            {item.isBoosted && <span className={s.boostBadge}>{t("boostBadge")}</span>}
                            {item.image && <img src={item.image} alt={item.title} className={s.image} loading="lazy" decoding="async" />}
                            <span className={s.categoryBadge}>{item.category === "residential" ? t("catalog.residential") : t("catalog.commercial")}</span>
                            {item.is_rent != null && <span className={s.dealBadge}>{item.isRent ? t("dealType.rent") : t("dealType.sale")}</span>}
                            {!isListingViewed(item.id, item.category) && <span className={s.newBadge}>NEW</span>}
                            <FavoriteButton item={{ id: item.id, type: item.category === "residential" ? "card" : "commercial", title: item.title, image: item.image, price: item.price, link: item.link }} className={s.heart} />
                            {isAdmin && <button type="button" className={s.deleteBtn} title={t("catalog.deleteListing")} disabled={deletingId === `${item.category}-${item.id}`} onClick={() => handleDelete(item)}><Trash2 size={16} /></button>}
                        </div>
                        <div className={s.content}><h3 className={s.cardTitle}>{item.title}</h3>
                            {item.description && <p className={s.cardDescription}>{item.description}</p>}
                            <div className={s.info}>
                                {item.category === "residential" && item.bedroomsLabel && <span><BedDouble size={15} />{item.bedroomsLabel}</span>}
                                {item.category === "residential" && item.bathroomsValue > 1 && item.bathroomsValue <= 4 && <span>{t(`bathroom${item.bathroomsValue}`)}</span>}
                                {item.district && <span><MapPin size={15} />{item.district}</span>}
                                {item.address && <span className={s.addressInfo}>{item.address}</span>}
                                {item.floor && <span><FloorIcon size={15} />{residentialFloorLabel({ floor: item.floor, totalFloors: item.totalFloors }, lang)}</span>}
                                {item.area && <span><Ruler size={15} />{item.area} m²</span>}
                                {item.typeLabel && <span>{item.typeLabel}</span>}
                                {item.statusLabel && <span>{item.statusLabel}</span>}
                            </div>
                            <div className={s.bottom}><span className={s.price}>{formatPriceIn(item.price, currency, rate)}</span><Link to={item.link} className={s.link} onClick={() => markListingViewed(item.id, item.category)}>{t("viewProperty")}</Link></div>
                        </div>
                    </motion.article>)}</div>
                    {rows.length < total && <div className={s.loadMoreWrap}><button type="button" className={s.loadMoreBtn} disabled={loading} onClick={() => setPage((value) => value + 1)}>{loading ? t("catalog.searching") : t("catalog.loadMore")}</button></div>}
                </>}
            </div>
        </section>
    );
};

export default Catalog;
