ALTER TABLE bot_pending_albums
    ADD COLUMN IF NOT EXISTS videos text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION append_album_video(p_media_group_id text, p_video text)
RETURNS void
LANGUAGE sql
AS $$
    INSERT INTO bot_pending_albums (media_group_id, videos)
    VALUES (p_media_group_id, ARRAY[p_video])
    ON CONFLICT (media_group_id)
    DO UPDATE SET videos = array_append(bot_pending_albums.videos, p_video);
$$;

