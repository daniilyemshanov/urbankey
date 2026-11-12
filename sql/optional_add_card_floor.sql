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
