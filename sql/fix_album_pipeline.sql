DELETE FROM public.bot_pending_albums a
USING public.bot_pending_albums b
WHERE a.media_group_id = b.media_group_id
  AND a.ctid < b.ctid;

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

ALTER TABLE public.bot_pending_albums
    ADD COLUMN IF NOT EXISTS photo_file_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

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

REVOKE ALL ON FUNCTION public.append_album_photo(text, text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.append_album_photo(text, text, bigint) TO service_role;

