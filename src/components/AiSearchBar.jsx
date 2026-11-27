import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Search, ArrowRight } from "lucide-react";

import { localizedPath } from "../utils/lang";
import { parsePropertyQuery, searchFiltersToParams } from "../utils/propertySearch";
import { useCurrency } from "../context/CurrencyContext";
import s from "./AiSearchBar.module.css";

const AiSearchBar = ({ className = "" }) => {

    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { currency } = useCurrency();
    const [value, setValue] = useState("");

    const submit = () => {

        const query = value.trim();
        if (!query) return;

        const parsed = parsePropertyQuery(query);
        const params = searchFiltersToParams({
            q: parsed.keywords,
            category: parsed.filters.category || "all",
            type: parsed.filters.type || "",
            dealType: parsed.filters.dealType || "",
            district: parsed.filters.district || "",
            minPrice: parsed.filters.minPrice,
            maxPrice: parsed.filters.maxPrice,
            priceCurrency: parsed.filters.minPrice != null || parsed.filters.maxPrice != null ? parsed.filters.priceCurrency || currency : "",
            minBedrooms: parsed.filters.minBedrooms || "",
            minArea: parsed.filters.minArea || "",
            location: parsed.filters.location || ""
        });
        navigate(`${localizedPath("/Properties", i18n.language)}${params.size ? `?${params}` : ""}`);
    };

    return (
        <div className={`${s.bar} ${className}`}>

            <Search size={22} className={s.icon} />

            <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") submit();
                }}
                placeholder={t("aiSearchBar.placeholder")}
            />

            <button type="button" className={s.submit} onClick={submit}>
                <span>{t("aiSearchBar.button")}</span>
                <ArrowRight size={18} />
            </button>

        </div>
    );
};

export default AiSearchBar;
