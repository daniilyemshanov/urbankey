-- UrbanKey: надёжная очередь Telegram -> сайт.
-- Выполнить один раз в Supabase SQL Editor.
-- Скрипт идемпотентный.

-- 1. Гарантируем структуру очереди альбомов.
ALTER TABLE bot_pending_albums
    ADD COLUMN IF NOT EXISTS images text[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS videos text[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS video text,
    ADD COLUMN IF NOT EXISTS chat_id bigint,
    ADD COLUMN IF NOT EXISTS message_id bigint,
    ADD COLUMN IF NOT EXISTS caption text,
    ADD COLUMN IF NOT EXISTS processed boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS processing boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_error text,
    ADD COLUMN IF NOT EXISTS locked_at timestamptz,
    ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS bot_pending_albums_media_group_id_uidx
    ON bot_pending_albums (media_group_id);

CREATE INDEX IF NOT EXISTS bot_pending_albums_finalize_idx
    ON bot_pending_albums (processed, processing, updated_at);

-- 2. Идемпотентность обычных Telegram-постов.
-- Удаляем старые дубли, оставляя самую раннюю запись.
DELETE FROM cardss a
USING cardss b
WHERE a.ctid > b.ctid
  AND a.tg_chat_id IS NOT NULL
  AND a.tg_message_id IS NOT NULL
  AND a.tg_chat_id = b.tg_chat_id
  AND a.tg_message_id = b.tg_message_id;

DELETE FROM commercials a
USING commercials b
WHERE a.ctid > b.ctid
  AND a.tg_chat_id IS NOT NULL
  AND a.tg_message_id IS NOT NULL
  AND a.tg_chat_id = b.tg_chat_id
  AND a.tg_message_id = b.tg_message_id;

CREATE UNIQUE INDEX IF NOT EXISTS cardss_telegram_message_uidx
    ON cardss (tg_chat_id, tg_message_id)
    WHERE tg_chat_id IS NOT NULL AND tg_message_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS commercials_telegram_message_uidx
    ON commercials (tg_chat_id, tg_message_id)
    WHERE tg_chat_id IS NOT NULL AND tg_message_id IS NOT NULL;

-- 3. Атомарное добавление фото альбома.
-- p_message_id защищает от повторной доставки одного webhook Telegram.
ALTER TABLE bot_pending_albums
    ADD COLUMN IF NOT EXISTS source_message_ids text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION append_album_image(
    p_media_group_id text,
    p_image text,
    p_message_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO bot_pending_albums (
        media_group_id,
        images,
        source_message_ids,
        processed,
        processing,
        updated_at
    )
    VALUES (
        p_media_group_id,
        CASE WHEN p_image IS NULL OR p_image = '' THEN '{}'::text[] ELSE ARRAY[p_image] END,
        CASE WHEN p_message_id IS NULL THEN '{}'::text[] ELSE ARRAY[p_message_id] END,
        false,
        false,
        now()
    )
    ON CONFLICT (media_group_id)
    DO UPDATE SET
        images = CASE
            WHEN p_image IS NULL OR p_image = '' THEN bot_pending_albums.images
            WHEN p_message_id IS NOT NULL
                 AND p_message_id = ANY(COALESCE(bot_pending_albums.source_message_ids, '{}'::text[]))
                THEN bot_pending_albums.images
            ELSE array_append(COALESCE(bot_pending_albums.images, '{}'::text[]), p_image)
        END,
        source_message_ids = CASE
            WHEN p_message_id IS NULL THEN bot_pending_albums.source_message_ids
            WHEN p_message_id = ANY(COALESCE(bot_pending_albums.source_message_ids, '{}'::text[]))
                THEN bot_pending_albums.source_message_ids
            ELSE array_append(COALESCE(bot_pending_albums.source_message_ids, '{}'::text[]), p_message_id)
        END,
        updated_at = now();
END;
$$;

-- 4. Атомарное добавление видео. Видео пишем и в videos, и в legacy video,
-- чтобы старый код/данные продолжили работать.
CREATE OR REPLACE FUNCTION append_album_video(
    p_media_group_id text,
    p_video text,
    p_message_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO bot_pending_albums (
        media_group_id,
        videos,
        video,
        source_message_ids,
        processed,
        processing,
        updated_at
    )
    VALUES (
        p_media_group_id,
        CASE WHEN p_video IS NULL OR p_video = '' THEN '{}'::text[] ELSE ARRAY[p_video] END,
        NULLIF(p_video, ''),
        CASE WHEN p_message_id IS NULL THEN '{}'::text[] ELSE ARRAY[p_message_id] END,
        false,
        false,
        now()
    )
    ON CONFLICT (media_group_id)
    DO UPDATE SET
        videos = CASE
            WHEN p_video IS NULL OR p_video = '' THEN bot_pending_albums.videos
            WHEN p_message_id IS NOT NULL
                 AND p_message_id = ANY(COALESCE(bot_pending_albums.source_message_ids, '{}'::text[]))
                THEN bot_pending_albums.videos
            ELSE array_append(COALESCE(bot_pending_albums.videos, '{}'::text[]), p_video)
        END,
        video = COALESCE(bot_pending_albums.video, NULLIF(p_video, '')),
        source_message_ids = CASE
            WHEN p_message_id IS NULL THEN bot_pending_albums.source_message_ids
            WHEN p_message_id = ANY(COALESCE(bot_pending_albums.source_message_ids, '{}'::text[]))
                THEN bot_pending_albums.source_message_ids
            ELSE array_append(COALESCE(bot_pending_albums.source_message_ids, '{}'::text[]), p_message_id)
        END,
        updated_at = now();
END;
$$;

-- 5. Атомарный claim очереди.
-- Позволяет параллельным cron-запускам не обработать один альбом дважды.
-- Зависшие lock'и старше p_stale_lock_seconds автоматически возвращаются в очередь.
CREATE OR REPLACE FUNCTION claim_pending_album(
    p_media_group_id text,
    p_settle_seconds integer DEFAULT 20,
    p_stale_lock_seconds integer DEFAULT 600,
    p_max_attempts integer DEFAULT 8
)
RETURNS SETOF bot_pending_albums
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    UPDATE bot_pending_albums
    SET
        processing = true,
        locked_at = now(),
        attempts = COALESCE(attempts, 0) + 1
    WHERE media_group_id = p_media_group_id
      AND processed = false
      AND caption IS NOT NULL
      AND length(trim(caption)) > 0
      AND updated_at <= now() - make_interval(secs => p_settle_seconds)
      AND (
          processing = false
          OR locked_at IS NULL
          OR locked_at <= now() - make_interval(secs => p_stale_lock_seconds)
      )
      AND (next_retry_at IS NULL OR next_retry_at <= now())
      AND COALESCE(attempts, 0) < p_max_attempts
    RETURNING *;
END;
$$;

-- 6. Если старые записи зависли в processing после предыдущей версии бота,
-- сразу возвращаем их в очередь.
UPDATE bot_pending_albums
SET processing = false,
    locked_at = NULL
WHERE processed = false
  AND processing = true
  AND (locked_at IS NULL OR locked_at < now() - interval '10 minutes');

-- Проверка:
-- SELECT media_group_id, processed, processing, attempts, last_error, updated_at
-- FROM bot_pending_albums
-- ORDER BY updated_at DESC
-- LIMIT 20;
