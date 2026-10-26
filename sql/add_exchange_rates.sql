CREATE TABLE IF NOT EXISTS public.exchange_rates (
    pair        text PRIMARY KEY,
    rate        numeric(14, 4) NOT NULL,
    rate_date   date           NOT NULL,
    source      text           NOT NULL DEFAULT 'cbu.uz',
    fetched_at  timestamptz    NOT NULL DEFAULT now(),
    CONSTRAINT exchange_rates_pair_format CHECK (pair ~ '^[A-Z]{3}_[A-Z]{3}$'),
    CONSTRAINT exchange_rates_rate_positive CHECK (rate > 0)
);

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exchange_rates_public_read" ON public.exchange_rates;
CREATE POLICY "exchange_rates_public_read"
    ON public.exchange_rates
    FOR SELECT
    TO anon, authenticated
    USING (true);

REVOKE ALL ON public.exchange_rates FROM anon, authenticated;
GRANT SELECT ON public.exchange_rates TO anon, authenticated;
