import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabase";
import { normalizeRateRecord } from "../utils/currency";

const CurrencyContext = createContext(null);

// Последний успешно полученный официальный курс (с датой) на случай, если
// Supabase временно недоступен: лучше показать прошлый курс с его датой,
// чем потерять конвертацию или подставить выдуманную цифру.
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
        // приватный режим/переполнено — кэш необязателен
    }
};

export const CurrencyProvider = ({ children }) => {

    const [currency, setCurrency] = useState(
        () => localStorage.getItem("currency") || "UZS"
    );

    // { rate, date } — официальный курс ЦБ РУз (сумов за 1 USD) и дата курса.
    // null — курс ещё ни разу не был получен: тогда цены показываются в той
    // валюте, в которой сохранены.
    const [rateRecord, setRateRecord] = useState(readCachedRate);

    useEffect(() => {
        localStorage.setItem("currency", currency);
    }, [currency]);

    // Курс читается из нашей базы один раз за загрузку сайта. К ЦБ браузер
    // не обращается: курс обновляет серверный cron (api/update-exchange-rate).
    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const { data, error } = await supabase
                    .from("exchange_rates")
                    .select("rate, rate_date")
                    .eq("pair", "USD_UZS")
                    .maybeSingle();

                if (cancelled || error) return;

                const fresh = normalizeRateRecord(data);
                if (!fresh) return;

                setRateRecord(fresh);
                writeCachedRate(fresh);
            } catch {
                // оставляем последний известный курс (из кэша), если он есть
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
