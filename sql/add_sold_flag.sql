ALTER TABLE public.cardss
    ADD COLUMN IF NOT EXISTS is_sold boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS sold_at timestamptz;

ALTER TABLE public.commercials
    ADD COLUMN IF NOT EXISTS is_sold boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS sold_at timestamptz;

GRANT SELECT (is_sold) ON public.cardss TO anon, authenticated;
GRANT SELECT (is_sold) ON public.commercials TO anon, authenticated;

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

