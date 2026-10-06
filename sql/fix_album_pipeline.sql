-- Выполнить один раз в Supabase -> SQL Editor. Идемпотентно (можно
-- перезапускать).
--
-- ЗАЧЕМ:
-- 1) Лечит ошибку 42P10 "there is no unique or exclusion constraint
--    matching the ON CONFLICT specification". RPC append_album_image /
--    append_album_video делают INSERT ... ON CONFLICT (media_group_id),
--    а для этого на bot_pending_albums.media_group_id ОБЯЗАТЕЛЬНО должен
--    быть UNIQUE-индекс/констрейнт. Если его нет — Postgres падает на
--    КАЖДОМ вызове (ещё на этапе планирования запроса), и ни одно фото
--    альбома не сохраняется. Одиночные посты RPC не используют — поэтому
--    с 1 фото всё работало, а с 2+ нет.
--
-- 2) Бот теперь НЕ скачивает/не грузит фото внутри webhook. Webhook лишь
--    регистрирует file_id каждого фото альбома (быстро, атомарно,
--    идемпотентно), а скачивание+загрузку в Storage (с ограничением
--    параллелизма 4) делает api/finalize-albums.js, когда альбом
--    "дозрел". Для этого нужна колонка photo_file_ids и RPC
--    append_album_photo.

-- ---------------------------------------------------------------------
-- 1. Убираем возможные дубли media_group_id (иначе UNIQUE не создастся).
--    Оставляем физически последнюю строку группы.
-- ---------------------------------------------------------------------
DELETE FROM public.bot_pending_albums a
USING public.bot_pending_albums b
WHERE a.media_group_id = b.media_group_id
  AND a.ctid < b.ctid;

-- ---------------------------------------------------------------------
-- 2. UNIQUE на media_group_id — только если подходящего ещё нет.
-- ---------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_index i
        WHERE i.indrelid = 'public.bot_pending_albums'::regclass
          AND i.indisunique
          AND i.indpred IS NULL
          AND i.indexprs IS NULL
          AND i.indnatts = 1
          AND i.indkey[0] = (
              SELECT attnum FROM pg_attribute
              WHERE attrelid = 'public.bot_pending_albums'::regclass
                AND attname = 'media_group_id'
          )
    ) THEN
        ALTER TABLE public.bot_pending_albums
            ADD CONSTRAINT bot_pending_albums_media_group_id_key
            UNIQUE (media_group_id);
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- 3. Колонка под file_id фото альбома: [{file_id, message_id}, ...]
-- ---------------------------------------------------------------------
ALTER TABLE public.bot_pending_albums
    ADD COLUMN IF NOT EXISTS photo_file_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Если images — text[] без DEFAULT, INSERT из новых RPC (которые images
-- не задают) упал бы на NOT NULL. Безопасно ставим пустой массив.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'bot_pending_albums'
          AND column_name = 'images'
          AND data_type = 'ARRAY'
    ) THEN
        ALTER TABLE public.bot_pending_albums
            ALTER COLUMN images SET DEFAULT '{}';
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- 4. Атомарная и ИДЕМПОТЕНТНАЯ регистрация фото альбома.
--    * один INSERT .. ON CONFLICT DO UPDATE — строка группы создаётся
--      или дополняется атомарно, параллельные вызовы сериализуются
--      блокировкой строки и ничего не перезаписывают;
--    * повторная доставка того же апдейта Telegram (ретрай при таймауте
--      webhook) не создаёт дубль — фото определяется по message_id;
--    * уже обработанный альбом (processed) не изменяется.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.append_album_photo(
    p_media_group_id text,
    p_file_id        text,
    p_message_id     bigint
)
RETURNS void
LANGUAGE sql
SET search_path = public
AS $$
    INSERT INTO public.bot_pending_albums AS t (media_group_id, photo_file_ids, updated_at)
    VALUES (
        p_media_group_id,
        jsonb_build_array(jsonb_build_object('file_id', p_file_id, 'message_id', p_message_id)),
        now()
    )
    ON CONFLICT (media_group_id) DO UPDATE
    SET photo_file_ids = t.photo_file_ids
            || jsonb_build_array(jsonb_build_object('file_id', p_file_id, 'message_id', p_message_id)),
        updated_at = now()
    WHERE t.processed IS NOT TRUE
      AND NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(t.photo_file_ids) e
          WHERE (e ->> 'message_id')::bigint = p_message_id
      );
$$;

-- Функция нужна только серверу (service_role). Закрываем от anon/authenticated.
REVOKE ALL ON FUNCTION public.append_album_photo(text, text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.append_album_photo(text, text, bigint) TO service_role;

-- =====================================================================
-- ПРОВЕРКА ПОСЛЕ ЗАПУСКА (обе должны вернуть строки):
--   select conname from pg_constraint
--     where conrelid = 'public.bot_pending_albums'::regclass and contype in ('u','p');
--   select proname from pg_proc where proname = 'append_album_photo';
--
-- ДИАГНОСТИКА 42P10, если после миграции ошибка всё ещё есть — значит
-- ON CONFLICT сидит в каком-то ДРУГОМ объекте БД (триггер/функция на
-- commercials / commercial_pages), которого нет в репозитории:
--   select p.proname from pg_proc p
--     join pg_namespace n on n.oid = p.pronamespace
--     where n.nspname = 'public' and p.prosrc ilike '%on conflict%';
--   select tgname, tgrelid::regclass from pg_trigger
--     where not tgisinternal
--       and tgrelid in ('public.commercials'::regclass,
--                       'public.commercial_pages'::regclass);
-- =====================================================================
