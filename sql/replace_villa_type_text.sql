-- ОПЦИОНАЛЬНО. Заменяет старые подписи типа «Вилла / Villa / Villasi» в уже
-- сохранённых карточках и страницах на «Квартира / Apartment / Kvartira».
-- Запускайте в Supabase SQL Editor ОДИН раз. Колонки type_* есть у cardss,
-- villas, commercials, commercial_pages; ниже — только жильё.

update cardss set
    type_ru = case when type_ru ~* '^вилла$' then 'Квартира' else type_ru end,
    type_en = case when type_en ~* '^villa$' then 'Apartment' else type_en end,
    type_uz = case when type_uz ~* '^villa$' then 'Kvartira' else type_uz end
where type_ru ~* '^вилла$' or type_en ~* '^villa$' or type_uz ~* '^villa$';

update villas set
    type_ru = case when type_ru ~* '^вилла$' then 'Квартира' else type_ru end,
    type_en = case when type_en ~* '^villa$' then 'Apartment' else type_en end,
    type_uz = case when type_uz ~* '^villa$' then 'Kvartira' else type_uz end
where type_ru ~* '^вилла$' or type_en ~* '^villa$' or type_uz ~* '^villa$';
