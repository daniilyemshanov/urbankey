import { useContext, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { toast } from "react-toastify";
import { MapPin, Ruler, BedDouble, SlidersHorizontal, X, Trash2 } from "lucide-react";
import FloorIcon from "./FloorIcon";
import { residentialFloorLabel } from "../utils/floor";
import { itemRoomsLabel } from "../utils/rooms";

import { MyContext } from "../Context";
import { localizedPath } from "../utils/lang";
import { useCurrency } from "../context/CurrencyContext";
import { formatPriceIn, priceInCurrency, usdToCurrency } from "../utils/currency";
import { fuzzyScore, highlightSegments } from "../utils/search";
import { aiSearchCatalog } from "../utils/aiSearch";
import {
    TASHKENT_DISTRICTS, DISTRICT_PARAM, detectDistrict, districtLabel,
    parseDistrictKey, districtCatalogPath
} from "../utils/districts";
import FavoriteButton from "./FavoriteButton";
import { SkeletonGrid } from "./SkeletonCard";
import s from "./Catalog.module.css";


const parseFirstNumber = (str) => {

    const match = String(str || "").match(/\d+/);

    return match ? Number(match[0]) : null;
};


const BEDROOM_OPTIONS = [1, 2, 3, 4, 5];
const PAGE_SIZE = 9;


// Категории жилья — тот же словарь, что и в бэкенд-парсере
// (api/listingParser.js, TYPE_DICT/detectType), на всех 3 языках. Вилла/
// Коттедж/Резиденция/Пентхаус убраны по прямому запросу — такого жилья
// в Ташкенте нет.
// Фильтр по типу берёт эти значения СТАТИЧЕСКИ, а не только из уже
// существующих объявлений в базе — иначе "Дом"/"Новостройка" не
// появлялись бы в выпадающем списке, пока не создастся хотя бы одно
// такое объявление (а появляться они должны сразу, до первого
// реального объявления этого типа).
const RESIDENTIAL_TYPE_LABELS = {
    ru: ["Квартира", "Дом", "Новостройка"],
    en: ["Apartment", "House", "New building"],
    uz: ["Kvartira", "Uy", "Yangi qurilish"]
};


const Catalog = () => {

    const {
        properties,
        getCards,
        commercials,
        getCommercials,
        profile,
        deleteCard,
        deleteCommercial
    } = useContext(MyContext);

    const isAdmin = profile?.role === "admin";

    const [deletingId, setDeletingId] = useState(null);

    const { t, i18n } = useTranslation();
    const [searchParams, setSearchParams] = useSearchParams();

    const handleDelete = async (item) => {

        const confirmed = window.confirm(t("catalogDeleteConfirm"));

        if (!confirmed) return;

        setDeletingId(`${item.category}-${item.id}`);

        if (item.category === "residential") {
            await deleteCard(item.id);
        } else {
            await deleteCommercial(item.id);
        }

        setDeletingId(null);
        toast.success(t("cardDeleted"));

    };

    const { currency, rate } = useCurrency();
    const lang = i18n.language;

    const [loading, setLoading] = useState(true);

    useEffect(() => {

        let cancelled = false;

        Promise.all([getCards(), getCommercials()]).finally(() => {
            if (!cancelled) setLoading(false);
        });

        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    const [category, setCategory] = useState("all");
    const [type, setType] = useState("all");
    const [dealType, setDealType] = useState("all");
    // Район хранится в URL (?district=<key>): ссылка открывается сразу с выбранным
    // районом, он переживает обновление страницы и новую вкладку. Значение
    // валидируется по справочнику; мусор = "нет фильтра". Остальные параметры
    // (например q) не трогаем.
    const district = parseDistrictKey(searchParams.get(DISTRICT_PARAM)) || "all";

    const setDistrict = (value) => {
        const next = new URLSearchParams(searchParams);
        const key = parseDistrictKey(value);
        if (key) next.set(DISTRICT_PARAM, key);
        else next.delete(DISTRICT_PARAM);
        setSearchParams(next, { replace: true });
    };
    const [minPrice, setMinPrice] = useState("");
    const [maxPrice, setMaxPrice] = useState("");
    const [bedrooms, setBedrooms] = useState("all");
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [suggestionsOpen, setSuggestionsOpen] = useState(false);
    const [aiSearchLoading, setAiSearchLoading] = useState(false);
    const [aiSearchApplied, setAiSearchApplied] = useState(false);
    const [sort, setSort] = useState("newest");
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    useEffect(() => {

        const id = setTimeout(() => {
            setDebouncedSearch(search);
        }, 250);

        return () => clearTimeout(id);

    }, [search]);


    const items = useMemo(() => {

        const residential = properties.map((item) => ({
            id: item.id,
            category: "residential",
            title: item.title?.[lang] || item.title?.ru || "",
            description: item.description?.[lang] || item.description?.ru || "",
            image: item.image,
            price: item.price,
            typeLabel: item.type?.[lang] || item.type?.ru || "",
            isRent: item.is_rent === true,
            bedroomsLabel: itemRoomsLabel(item, lang),
            bedroomsValue: parseFirstNumber(item.bedrooms?.ru),
            floorLabel: residentialFloorLabel(item, lang),
            link: localizedPath(`/property/${item.id}`, i18n.language),
            boostedUntil: item.boostedUntil || item.boosted_until,
            // у жилья отдельной колонки "район" нет — определяем по тексту
            districtKey: detectDistrict([
                item.district?.ru, item.district?.en, item.district?.uz,
                item.title?.ru, item.title?.en, item.title?.uz,
                item.description?.ru, item.description?.en, item.description?.uz
            ]),
            raw: item
        }));

        const commercial = commercials.map((item) => ({
            id: item.id,
            category: "commercial",
            title: item.title?.[lang] || item.title?.ru || "",
            description: item.description?.[lang] || item.description?.ru || "",
            image: item.image,
            price: item.price,
            typeLabel:
                item.class?.[lang] || item.class?.ru
                || t("catalog.commercial"),
            isRent: item.is_rent === true,
            district: item.district?.[lang] || item.district?.ru || "",
            area: item.area || "",
            floor: item.floor || "",
            link: localizedPath(`/commercial/${item.id}`, i18n.language),
            boostedUntil: item.boostedUntil || item.boosted_until,
            districtKey: detectDistrict([
                item.district?.ru, item.district?.en, item.district?.uz,
                item.address?.ru, item.address?.en, item.address?.uz,
                item.title?.ru, item.title?.en, item.title?.uz,
                item.description?.ru, item.description?.en, item.description?.uz
            ]),
            raw: item
        }));

        // название района на текущем языке — чтобы искался и текстовым поиском
        return [...residential, ...commercial].map((item) => ({
            ...item,
            districtName: item.districtKey ? districtLabel(item.districtKey, lang) : ""
        }));

    }, [properties, commercials, lang, t]);


    const availableTypes = useMemo(() => {

        const scoped =
            category === "all"
                ? items
                : items.filter((i) => i.category === category);

        const observed = new Set(scoped.map((i) => i.typeLabel).filter(Boolean));

        // Для "Все" и "Жильё" сначала фиксированный словарь (в нужном
        // порядке), затем — то, что реально встретилось в данных, но в
        // словарь не входит (старые/нестандартные значения жилья, а для
        // "Все" ещё и типы коммерции вроде "Коммерция").
        if (category === "residential" || category === "all") {

            const canonical = RESIDENTIAL_TYPE_LABELS[lang] || RESIDENTIAL_TYPE_LABELS.ru;
            const extra = [...observed].filter((label) => !canonical.includes(label));

            return [...canonical, ...extra];
        }

        return [...observed];

    }, [items, category, lang]);


    // Районы, в которых реально есть объявления выбранной категории, со
    // счётчиками — чтобы не предлагать районы, где ничего нет.
    const availableDistricts = useMemo(() => {

        const scoped =
            category === "all"
                ? items
                : items.filter((i) => i.category === category);

        const counts = new Map();
        for (const i of scoped) {
            if (i.districtKey) counts.set(i.districtKey, (counts.get(i.districtKey) || 0) + 1);
        }

        return TASHKENT_DISTRICTS
            .filter((d) => counts.has(d.key))
            .map((d) => ({ key: d.key, label: d[lang] || d.ru, count: counts.get(d.key) }));

    }, [items, category, lang]);

    // Район из URL остаётся выбранным, даже если в нём сейчас нет объявлений:
    // тогда показывается пустой результат, а не весь каталог под чужим URL.
    const activeDistrict = district;

    // Если выбранного района нет в списке (прямая ссылка на пустой район) —
    // добавляем его в select, чтобы значение не расходилось с отображением.
    const districtOptions =
        activeDistrict !== "all" && !availableDistricts.some((d) => d.key === activeDistrict)
            ? [...availableDistricts, { key: activeDistrict, label: districtLabel(activeDistrict, lang), count: 0 }]
            : availableDistricts;

    // Переключение вкладки категории: как и раньше, район сбрасывается, если
    // в новой категории в нём нет объявлений. Не срабатывает на «Все» и пока
    // данные грузятся, иначе прямая ссылка потеряла бы параметр.
    useEffect(() => {
        if (
            !loading && category !== "all" && district !== "all" &&
            !availableDistricts.some((d) => d.key === district)
        ) {
            setDistrict("all");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [category]);

    // Неизвестное значение ?district= убираем из адресной строки.
    useEffect(() => {
        const raw = searchParams.get(DISTRICT_PARAM);
        if (raw !== null && !parseDistrictKey(raw)) setDistrict("all");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);


    useEffect(() => {
        if (type !== "all" && !availableTypes.includes(type)) {
            setType("all");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [category]);


    const filtered = useMemo(() => {

        const min = minPrice ? Number(minPrice) : null;
        const max = maxPrice ? Number(maxPrice) : null;
        const minBeds = bedrooms === "all" ? null : Number(bedrooms);
        const query = debouncedSearch.trim();

        let result = items
            .map((item) => {

                const score = query
                    ? fuzzyScore(query, [
                        item.title,
                        item.typeLabel,
                        item.description,
                        item.district,
                        item.districtName,
                        item.bedroomsLabel
                    ])
                    : 1;

                // Цена в валюте отображения — именно в ней человек вводит границы
                // и видит цены на карточках. null — сравнить нельзя (нет цены или
                // нет курса для перевода): такие объявления при фильтре по цене
                // скрываются, а в сортировке идут в конец.
                return { ...item, searchScore: score, priceValue: priceInCurrency(item.price, currency, rate, parseFloat(String(item.area ?? "").replace(",", "."))) };
            })
            .filter((item) => {

                if (category !== "all" && item.category !== category) return false;

                if (type !== "all" && item.typeLabel !== type) return false;

                if (dealType !== "all" && (item.isRent ? "rent" : "sale") !== dealType) return false;

                if (activeDistrict !== "all" && item.districtKey !== activeDistrict) return false;

                if (min !== null && (item.priceValue === null || item.priceValue < min)) return false;
                if (max !== null && (item.priceValue === null || item.priceValue > max)) return false;

                if (
                    minBeds !== null &&
                    item.category === "residential" &&
                    (item.bedroomsValue === null || item.bedroomsValue < minBeds)
                ) return false;

                if (query && item.searchScore <= 0) return false;

                return true;
            });

        if (sort === "priceAsc") {
            result = [...result].sort((a, b) => (a.priceValue ?? Infinity) - (b.priceValue ?? Infinity));
        } else if (sort === "priceDesc") {
            result = [...result].sort((a, b) => (b.priceValue ?? -Infinity) - (a.priceValue ?? -Infinity));
        } else if (query) {
            result = [...result].sort((a, b) => b.searchScore - a.searchScore);
        } else {
            result = [...result].sort((a, b) => Number(b.id) - Number(a.id));
        }

        // Платные объявления "в топе" — поднимаем над остальными, не ломая
        // при этом выбранную сортировку внутри каждой группы (Array.sort
        // стабильна, поэтому относительный порядок сохраняется)
        const isBoosted = (item) => {
            const until = item.boostedUntil || item.boosted_until;
            return Boolean(until) && new Date(until).getTime() > Date.now();
        };
        result = [...result].sort((a, b) => Number(isBoosted(b)) - Number(isBoosted(a)));

        return result;

    }, [items, category, type, dealType, activeDistrict, minPrice, maxPrice, bedrooms, debouncedSearch, sort, currency, rate]);


    const suggestions = useMemo(() => {

        const query = search.trim();
        if (!query) return [];

        return items
            .map((item) => ({
                item,
                score: fuzzyScore(query, [
                    item.title,
                    item.typeLabel,
                    item.description,
                    item.district,
                    item.districtName,
                    item.bedroomsLabel
                ])
            }))
            .filter((x) => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map((x) => x.item);

    }, [items, search]);


    useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [category, type, dealType, activeDistrict, minPrice, maxPrice, bedrooms, debouncedSearch, sort]);


    const hasActiveFilters =
        category !== "all" || type !== "all" || dealType !== "all" || activeDistrict !== "all" || minPrice || maxPrice ||
        bedrooms !== "all" || search;


    const resetFilters = () => {
        setCategory("all");
        setType("all");
        setDealType("all");
        setDistrict("all");
        setMinPrice("");
        setMaxPrice("");
        setBedrooms("all");
        setSearch("");
        setSort("newest");
        setAiSearchApplied(false);
    };


    // ИИ-поиск: человек пишет запрос свободным текстом в БОЛЬШУЮ строку
    // поиска на главной (Hero) или над каталогом (Find) — она переходит
    // сюда через URL-параметр ?q=, эффект ниже его подхватывает.
    // Эндпоинт /api/ai-search разбирает запрос в структурные фильтры
    // (category/type/dealType/price/bedrooms) через ту же цепочку
    // провайдеров, что и разбор объявлений бота, и мы применяем их к
    // уже существующим ручным фильтрам. Остаток текста (keywords)
    // уходит в обычный текстовый search — та же fuzzy-логика, что и
    // при ручном наборе. Если ИИ не смог разобрать (нет ключей/сеть
    // легла) — просто продолжаем работать как обычный текстовый поиск,
    // без ошибок в интерфейсе.
    const runAiSearch = async (queryOverride) => {

        const query = (queryOverride ?? search).trim();
        if (!query || aiSearchLoading) return;

        setSearch(query);
        setAiSearchLoading(true);
        setSuggestionsOpen(false);

        try {

            const result = await aiSearchCatalog(query, i18n.language);

            if (!result?.ok) {
                setAiSearchApplied(false);
                return;
            }

            const f = result.filters || {};

            if (f.category) setCategory(f.category);
            if (f.type) setType(f.type);
            if (f.dealType) setDealType(f.dealType);
            // ИИ-поиск возвращает цены в долларах, а поля фильтра — в валюте
            // отображения. Без курса переводить в сумы нечем — тогда ценовой
            // фильтр не применяем, чтобы не показать заведомо неверную выборку.
            const aiMin = usdToCurrency(f.minPrice, currency, rate);
            const aiMax = usdToCurrency(f.maxPrice, currency, rate);
            if (aiMin != null) setMinPrice(String(aiMin));
            if (aiMax != null) setMaxPrice(String(aiMax));
            if (f.minBedrooms != null) {
                const clamped = Math.min(Math.max(Math.round(f.minBedrooms), 1), 5);
                setBedrooms(String(clamped));
            }

            setSearch(f.keywords || "");
            setAiSearchApplied(true);

        } finally {
            setAiSearchLoading(false);
        }

    };


    // Большая строка поиска на главной (Hero) и над каталогом (Find)
    // передаёт запрос через URL: /Properties?q=.... Подхватываем его
    // здесь один раз и сразу чистим параметр, чтобы повторный переход
    // на эту же страницу (например, по логотипу) не запускал поиск
    // заново. Эффект перезапускается при каждом изменении searchParams
    // — значит сработает и повторно, если Find-бар уже на этой же
    // странице выставит новый ?q= без полного перехода.
    useEffect(() => {

        const q = searchParams.get("q");

        if (q && q.trim()) {
            runAiSearch(q);
            // убираем только q — выбранный район в URL должен сохраниться
            const next = new URLSearchParams(searchParams);
            next.delete("q");
            setSearchParams(next, { replace: true });
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);


    return (
        <section className={s.catalog} id='discover'>

            {/* Пустая выборка по району — не страница для индекса (soft 404).
                Только когда каталог в целом загружен и не пуст: при сбое загрузки
                основной каталог noindex получить не должен. */}
            {!loading && items.length > 0 && activeDistrict !== "all" && filtered.length === 0 && (
                <meta name="robots" content="noindex, follow" />
            )}

            <div className={s.container}>

                <div className={s.topBar}>

                    <div className={s.tabs}>

                        {[
                            { key: "all", label: t("catalog.allCategories") },
                            { key: "residential", label: t("catalog.residential") },
                            { key: "commercial", label: t("catalog.commercial") }
                        ].map((tab) => (

                            <button
                                key={tab.key}
                                type="button"
                                className={`${s.tab} ${category === tab.key ? s.tabActive : ""}`}
                                onClick={() => setCategory(tab.key)}
                            >
                                {tab.label}
                            </button>
                        ))}

                    </div>

                    <button
                        type="button"
                        className={s.filtersToggle}
                        onClick={() => setFiltersOpen((v) => !v)}
                    >
                        <SlidersHorizontal size={18} />
                        {t("catalog.filtersTitle")}
                    </button>

                </div>


                {/* Районы: обычные ссылки на этот же каталог с выбранным районом
                    (не отдельные страницы). Только районы, где есть объявления. */}
                {availableDistricts.length > 0 && (
                    <nav className={s.districtNav} aria-label={t("catalog.district")}>
                        <Link
                            to={districtCatalogPath(null, lang)}
                            className={`${s.districtChip} ${activeDistrict === "all" ? s.districtChipActive : ""}`}
                            aria-current={activeDistrict === "all" ? "true" : undefined}
                        >
                            {t("catalog.allDistricts")}
                        </Link>
                        {availableDistricts.map((d) => (
                            <Link
                                key={d.key}
                                to={districtCatalogPath(d.key, lang)}
                                className={`${s.districtChip} ${activeDistrict === d.key ? s.districtChipActive : ""}`}
                                aria-current={activeDistrict === d.key ? "true" : undefined}
                            >
                                {d.label} <span className={s.districtCount}>{d.count}</span>
                            </Link>
                        ))}
                    </nav>
                )}

                <div className={`${s.filtersPanel} ${filtersOpen ? s.filtersPanelOpen : ""}`}>

                    <div className={`${s.field} ${s.searchField}`}>
                        <label>{t("catalog.search")}</label>
                        <div className={s.searchBox}>
                            <input
                                type="text"
                                value={search}
                                placeholder={t("catalog.searchPlaceholder")}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    if (aiSearchApplied) setAiSearchApplied(false);
                                }}
                                onFocus={() => setSuggestionsOpen(true)}
                                onBlur={() => setTimeout(() => setSuggestionsOpen(false), 150)}
                                autoComplete="off"
                            />

                            {suggestionsOpen && search.trim() && (

                                <div className={s.suggestions}>

                                    {suggestions.length === 0 ? (

                                        <p className={s.suggestionEmpty}>
                                            {t("catalog.noResults")}
                                        </p>

                                    ) : (

                                        suggestions.map((item) => (

                                            <Link
                                                key={`${item.category}-${item.id}`}
                                                to={item.link}
                                                className={s.suggestionItem}
                                                onMouseDown={(e) => e.preventDefault()}
                                            >
                                                {item.image && (
                                                    <img
                                                        src={item.image}
                                                        alt=""
                                                        className={s.suggestionImg}
                                                        loading="lazy"
                                                    />
                                                )}

                                                <span className={s.suggestionText}>
                                                    <span className={s.suggestionTitle}>
                                                        {highlightSegments(item.title, search).map((seg, i) => (
                                                            seg.match
                                                                ? <mark key={i} className={s.mark}>{seg.text}</mark>
                                                                : <span key={i}>{seg.text}</span>
                                                        ))}
                                                    </span>
                                                    {item.typeLabel && (
                                                        <span className={s.suggestionMeta}>{item.typeLabel}</span>
                                                    )}
                                                </span>
                                            </Link>
                                        ))
                                    )}

                                </div>
                            )}
                        </div>
                    </div>

                    <div className={s.field}>
                        <label>{t("type")}</label>
                        <select value={type} onChange={(e) => setType(e.target.value)}>
                            <option value="all">{t("catalog.allTypes")}</option>
                            {availableTypes.map((tp) => (
                                <option key={tp} value={tp}>{tp}</option>
                            ))}
                        </select>
                    </div>

                    <div className={s.field}>
                        <label>{t("dealType.label")}</label>
                        <select value={dealType} onChange={(e) => setDealType(e.target.value)}>
                            <option value="all">{t("dealType.all")}</option>
                            <option value="sale">{t("dealType.sale")}</option>
                            <option value="rent">{t("dealType.rent")}</option>
                        </select>
                    </div>

                    <div className={s.field}>
                        <label>{t("catalog.district")}</label>
                        <select value={activeDistrict} onChange={(e) => setDistrict(e.target.value)}>
                            <option value="all">{t("catalog.allDistricts")}</option>
                            {districtOptions.map((d) => (
                                <option key={d.key} value={d.key}>{d.label} ({d.count})</option>
                            ))}
                        </select>
                    </div>

                    <div className={s.field}>
                        <label>{t("catalog.priceFrom")}, {currency}</label>
                        <input
                            type="number"
                            min="0"
                            value={minPrice}
                            placeholder="0"
                            onChange={(e) => setMinPrice(e.target.value)}
                        />
                    </div>

                    <div className={s.field}>
                        <label>{t("catalog.priceTo")}, {currency}</label>
                        <input
                            type="number"
                            min="0"
                            value={maxPrice}
                            placeholder="∞"
                            onChange={(e) => setMaxPrice(e.target.value)}
                        />
                    </div>

                    {category !== "commercial" && (

                        <div className={s.field}>
                            <label>{t("bedrooms")}</label>
                            <select value={bedrooms} onChange={(e) => setBedrooms(e.target.value)}>
                                <option value="all">{t("catalog.bedroomsAny")}</option>
                                {BEDROOM_OPTIONS.map((n) => (
                                    <option key={n} value={n}>
                                        {t("catalog.bedroomsPlus", { n })}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className={s.field}>
                        <label>{t("catalog.sort")}</label>
                        <select value={sort} onChange={(e) => setSort(e.target.value)}>
                            <option value="newest">{t("catalog.sortNewest")}</option>
                            <option value="priceAsc">{t("catalog.sortPriceAsc")}</option>
                            <option value="priceDesc">{t("catalog.sortPriceDesc")}</option>
                        </select>
                    </div>

                    {hasActiveFilters && (

                        <button
                            type="button"
                            className={s.resetBtn}
                            onClick={resetFilters}
                        >
                            <X size={16} />
                            {t("catalog.resetFilters")}
                        </button>
                    )}

                </div>


                {aiSearchLoading ? (
                    <p className={s.resultsCount}>
                        <span className={s.aiSearchBadge}>
                            {t("catalog.aiSearchLoading")}
                        </span>
                    </p>
                ) : (
                    <p className={s.resultsCount}>
                        {t("catalog.resultsCount", { count: filtered.length })}
                        {aiSearchApplied && (
                            <span className={s.aiSearchBadge}>
                                {t("catalog.aiSearchApplied")}
                            </span>
                        )}
                    </p>
                )}


                {loading ? (

                    <SkeletonGrid count={6} gridClassName={s.grid} />

                ) : filtered.length === 0 ? (

                    <p className={s.noResults}>
                        {t("catalog.noResults")}
                    </p>

                ) : (

                    <>

                        <div className={s.grid}>

                            {filtered.slice(0, visibleCount).map((item) => (

                            <motion.article
                                key={`${item.category}-${item.id}`}
                                className={s.card}

                                initial={{ opacity: 0, y: 40 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ amount: 0.2, once: true }}
                                transition={{ duration: 0.5 }}
                            >

                                <div className={s.imageBox}>

                                    {Boolean(item.boostedUntil || item.boosted_until) &&
                                        new Date(item.boostedUntil || item.boosted_until).getTime() > Date.now() && (
                                        <span className={s.boostBadge}>{t("boostBadge")}</span>
                                    )}

                                    <img
                                        src={item.image}
                                        alt={item.title}
                                        className={s.image}
                                        loading="lazy"
                                        decoding="async"
                                    />

                                    <span className={s.categoryBadge}>
                                        {item.category === "residential"
                                            ? t("catalog.residential")
                                            : t("catalog.commercial")}
                                    </span>

                                    <span className={s.dealBadge}>
                                        {item.isRent ? t("dealType.rent") : t("dealType.sale")}
                                    </span>

                                    <FavoriteButton
                                        item={{
                                            id: item.id,
                                            type: item.category === "residential" ? "card" : "commercial",
                                            title: item.title,
                                            image: item.image,
                                            price: item.price,
                                            link: item.link
                                        }}
                                        className={s.heart}
                                    />

                                    {isAdmin && (

                                        <button
                                            type="button"
                                            className={s.deleteBtn}
                                            title="Удалить карточку"
                                            disabled={deletingId === `${item.category}-${item.id}`}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleDelete(item);
                                            }}
                                        >
                                            <Trash2 size={16} />
                                        </button>

                                    )}

                                </div>

                                <div className={s.content}>

                                    <h3 className={s.cardTitle}>{item.title}</h3>

                                    {item.category === "residential" ? (

                                        <div className={s.info}>

                                            {item.bedroomsLabel && (
                                                <span>
                                                    <BedDouble size={15} />
                                                    {item.bedroomsLabel}
                                                </span>
                                            )}

                                            {item.floorLabel && (
                                                <span>
                                                    <FloorIcon size={15} />
                                                    {item.floorLabel}
                                                </span>
                                            )}

                                            {item.typeLabel && (
                                                <span>{item.typeLabel}</span>
                                            )}

                                        </div>

                                    ) : (

                                        <div className={s.info}>

                                            {item.district && (
                                                <span>
                                                    <MapPin size={15} />
                                                    {item.district}
                                                </span>
                                            )}

                                            {item.floor && (
                                                <span>
                                                    <FloorIcon size={15} />
                                                    {item.floor}
                                                </span>
                                            )}

                                            {item.area && (
                                                <span>
                                                    <Ruler size={15} />
                                                    {item.area}
                                                </span>
                                            )}

                                        </div>
                                    )}

                                    <div className={s.bottom}>

                                        <span className={s.price}>{formatPriceIn(item.price, currency, rate)}</span>

                                        <Link to={item.link} className={s.link}>
                                            {t("viewProperty")}
                                        </Link>

                                    </div>

                                </div>

                            </motion.article>
                        ))}

                        </div>

                        {visibleCount < filtered.length && (

                            <div className={s.loadMoreWrap}>

                                <button
                                    type="button"
                                    className={s.loadMoreBtn}
                                    onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                                >
                                    {t("catalog.loadMore")}
                                </button>

                            </div>
                        )}

                    </>
                )}

            </div>

        </section>
    );
};

export default Catalog;
