ALTER TABLE cardss ADD COLUMN IF NOT EXISTS boosted_until timestamptz;
ALTER TABLE commercials ADD COLUMN IF NOT EXISTS boosted_until timestamptz;

