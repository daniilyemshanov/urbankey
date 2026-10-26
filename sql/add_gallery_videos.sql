ALTER TABLE villas
    ADD COLUMN IF NOT EXISTS videos text[] NOT NULL DEFAULT '{}';

ALTER TABLE commercial_pages
    ADD COLUMN IF NOT EXISTS videos text[] NOT NULL DEFAULT '{}';

