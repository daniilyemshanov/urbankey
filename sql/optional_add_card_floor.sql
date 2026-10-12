-- ОПЦИОНАЛЬНО. По умолчанию НЕ нужен: сайт и бот работают и без него.
-- Не применялся ни на production, ни где-либо ещё из репозитория.
--
-- ЗАЧЕМ: для жилья в БД нет колонок этажа/этажности (floor и ceiling есть
-- только у commercials). Бот извлекает "5/9 этаж" из поста, но записать его в
-- карточку (cardss) было некуда; этаж сохраняется только текстом в about_*
-- страницы объекта. Если нужно показывать этаж в карточках жилья (там теперь
-- значок этажа), выполните этот файл и включите в окружении бота:
--
--     CARD_FLOOR_COLUMNS=1
--
-- Порядок: сначала этот SQL, потом переменная. Если включить переменную до SQL,
-- запись карточки сначала упадёт на неизвестной колонке и сработает безопасный
-- откат (карточка сохранится урезанным набором полей, в логе DB_INSERT_DEGRADED).
--
-- Что делает (только добавление, ничего не удаляется и не меняется):
--   1. две необязательные колонки в cardss;
--   2. view cardss_public получает эти колонки В КОНЕЦ списка. Текущее
--      определение view берётся через pg_get_viewdef, а не переписывается
--      вручную (в Supabase оно могло уйти от файлов репозитория),
--      GRANT-ы и порядок остальных колонок сохраняются.
-- Скрипт идемпотентный.

ALTER TABLE public.cardss
    ADD COLUMN IF NOT EXISTS floor integer,
    ADD COLUMN IF NOT EXISTS total_floors integer;

DO $$
DECLARE
    def text;
BEGIN
    def := rtrim(pg_get_viewdef('public.cardss_public'::regclass, true), E'; \n');

    IF position('total_floors' in def) = 0 THEN
        EXECUTE
            'CREATE OR REPLACE VIEW public.cardss_public AS '
            || 'SELECT pub.*, c.floor, c.total_floors '
            || 'FROM (' || def || ') pub '
            || 'JOIN public.cardss c ON c.id = pub.id';
    END IF;
END $$;
