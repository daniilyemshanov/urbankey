// Строка «Расположение» страниц жилья (villas.location_*) для всех объявлений.
// Нужна, чтобы определять район квартиры («Яккасарайский район, ул. …»): в карточках
// (cardss_public) такого поля нет. Запрос выполняется один раз на сессию, результат
// общий для каталога и блока «Похожие объявления». Ошибка не критична — тогда район
// определяется по названию и описанию.

import { useEffect, useState } from "react";
import { supabase } from "../supabase";

let cache = null;      // { [card_id]: [location_ru, location_en, location_uz] }
let inflight = null;

function load() {
    if (cache) return Promise.resolve(cache);
    if (inflight) return inflight;

    inflight = (async () => {
        try {
            const { data, error } = await supabase
                .from("villas")
                .select("card_id, location_ru, location_en, location_uz");

            if (error || !data) return {};

            const map = {};
            for (const row of data) {
                if (row.card_id == null || map[row.card_id]) continue;
                map[row.card_id] = [row.location_ru, row.location_en, row.location_uz];
            }
            cache = map;
            return map;
        } catch {
            return {};
        } finally {
            inflight = null;
        }
    })();

    return inflight;
}

export default function useVillaLocations() {
    const [locations, setLocations] = useState(cache || {});

    useEffect(() => {
        let cancelled = false;
        load().then((map) => {
            if (!cancelled) setLocations(map);
        });
        return () => { cancelled = true; };
    }, []);

    return locations;
}
