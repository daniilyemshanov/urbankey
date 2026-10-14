-- UrbanKey: статус "продано" (заморозка объявления).
-- Выполнить ОДИН РАЗ в Supabase -> SQL Editor, ДО деплоя нового кода.
-- Скрипт идемпотентный (повторный запуск ничего не ломает).
--
-- Как это работает:
--   • Админ канала отвечает на пост словом ПРОДАНО -> бот ставит
--     is_sold = true и sold_at = now() у объявления;
--   • сайт читает объявления через view cardss_public / commercials_public —
--     ниже они переписываются так, что проданные строки в них не попадают:
--     объявление пропадает из каталога, с главной, из sitemap и по прямой
--     ссылке отдаёт 404;
--   • строка в cardss/commercials остаётся: история, ссылка на пост, фото и
--     админка не страдают, а правки поста в Telegram к ней больше не
--     применяются (заморожено).
--
-- Вернуть объявление на сайт (если пометили по ошибке):
--   UPDATE cardss SET is_sold = false, sold_at = NULL WHERE id = <id>;
--   UPDATE commercials SET is_sold = false, sold_at = NULL WHERE id = <id>;

-- 1. Колонки статуса
ALTER TABLE public.cardss
    ADD COLUMN IF NOT EXISTS is_sold boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS sold_at timestamptz;

ALTER TABLE public.commercials
    ADD COLUMN IF NOT EXISTS is_sold boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS sold_at timestamptz;

-- Колонка не секретная; грант нужен на случай, если view работает с правами
-- вызывающего (security_invoker) и JOIN читает cardss от имени anon.
GRANT SELECT (is_sold) ON public.cardss TO anon, authenticated;
GRANT SELECT (is_sold) ON public.commercials TO anon, authenticated;

-- 2. View без проданных объявлений.
-- Текущее определение берётся через pg_get_viewdef, а не переписывается
-- вручную (в Supabase оно могло уйти от файлов репозитория, там могут быть
-- дополнительные колонки). Список и порядок колонок сохраняются.
DO $$
DECLARE
    def text;
BEGIN
    def := rtrim(pg_get_viewdef('public.cardss_public'::regclass, true), E'; \n');

    IF position('is_sold' in def) = 0 THEN
        EXECUTE
            'CREATE OR REPLACE VIEW public.cardss_public AS '
            || 'SELECT pub.* FROM (' || def || ') pub '
            || 'JOIN public.cardss c ON c.id = pub.id '
            || 'WHERE c.is_sold = false';
    END IF;
END $$;

DO $$
DECLARE
    def text;
BEGIN
    def := rtrim(pg_get_viewdef('public.commercials_public'::regclass, true), E'; \n');

    IF position('is_sold' in def) = 0 THEN
        EXECUTE
            'CREATE OR REPLACE VIEW public.commercials_public AS '
            || 'SELECT pub.* FROM (' || def || ') pub '
            || 'JOIN public.commercials c ON c.id = pub.id '
            || 'WHERE c.is_sold = false';
    END IF;
END $$;

-- Проверка: оба запроса должны вернуть строки без is_sold-колонки в списке,
-- а число объявлений в view = числу непроданных в таблице.
--   SELECT count(*) FROM cardss_public;
--   SELECT count(*) FROM cardss WHERE is_sold = false;
