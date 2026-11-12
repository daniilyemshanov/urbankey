ALTER TABLE cardss
    ADD COLUMN IF NOT EXISTS video text;

ALTER TABLE commercials
    ADD COLUMN IF NOT EXISTS video text;

ALTER TABLE villas
    ADD COLUMN IF NOT EXISTS video text;

ALTER TABLE commercial_pages
    ADD COLUMN IF NOT EXISTS video text;

ALTER TABLE bot_pending_albums
    ADD COLUMN IF NOT EXISTS video text;
