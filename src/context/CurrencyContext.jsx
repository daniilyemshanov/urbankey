import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabase";
import { normalizeRateRecord } from "../utils/currency";

const CurrencyContext = createContext(null);

const RATE_CACHE_KEY = "usdRateCache";

const readCachedRate = () => {
    try {
        return normalizeRateRecord(JSON.parse(localStorage.getItem(RATE_CACHE_KEY)));
    } catch {
        return null;
    }
};

const writeCachedRate = (record) => {
    try {
        localStorage.setItem(RATE_CACHE_KEY, JSON.stringify(record));
    } catch {
    }
};

export const CurrencyProvider = ({ children }) => {

    const [currency, setCurrency] = useState(
        () => localStorage.getItem("currency") || "UZS"
    );

    const [rateRecord, setRateRecord] = useState(readCachedRate);

    useEffect(() => {
        localStorage.setItem("currency", currency);
    }, [currency]);

    useEffect(() => {
        let cancelled = false;

        const apply = (record) => {
            const fresh = normalizeRateRecord(record);
            if (!fresh || cancelled) return false;
            setRateRecord(fresh);
            writeCachedRate(fresh);
            return true;
        };

        (async () => {
            try {
                const { data, error } = await supabase
                    .from("exchange_rates")
                    .select("rate, rate_date")
                    .eq("pair", "USD_UZS")
                    .maybeSingle();

                if (!error && apply(data)) return;
            } catch {
            }

            try {
                const res = await fetch("/api/exchange-rate");
                if (res.ok) apply(await res.json());
            } catch {
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    const toggleCurrency = () => {
        setCurrency(prev => (prev === "UZS" ? "USD" : "UZS"));
    };

    return (
        <CurrencyContext.Provider
            value={{
                currency,
                setCurrency,
                toggleCurrency,
                rate: rateRecord?.rate ?? null,
                rateDate: rateRecord?.date ?? null,
            }}
        >
            {children}
        </CurrencyContext.Provider>
    );
};

export const useCurrency = () => useContext(CurrencyContext);
