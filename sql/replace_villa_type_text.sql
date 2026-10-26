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
