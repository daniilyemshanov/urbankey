-- Хранилище официального курса USD/UZS (Центральный банк Узбекистана).
-- Запустить ОДИН РАЗ в Supabase -> SQL Editor (сначала на Preview/Staging).
-- Скрипт идемпотентен: повторный запуск ничего не ломает и не стирает.
--
-- Зачем:
--   api/update-exchange-rate.js (Vercel Cron, раз в сутки) забирает курс с
--   cbu.uz и записывает его сюда. Сайт читает ТОЛЬКО эту таблицу — к ЦБ
--   при открытии страницы никто не обращается. Сервер Vercel не хранит курс
--   в памяти между вызовами, поэтому "последний успешный курс" живёт здесь.
--
-- Что хранится: ровно одна строка на пару валют (pair = 'USD_UZS'),
-- которая перезаписывается при каждом успешном получении курса:
--   rate       — сумов за 1 USD (уже поделено на Nominal из ответа ЦБ);
--   rate_date  — дата, на которую ЦБ установил курс (показывается на сайте);
--   fetched_at — когда мы последний раз успешно получили курс;
--   source     — откуда курс.
-- Цены объявлений (cardss.price, commercials.price) НЕ затрагиваются.
--
-- Права:
--   чтение — любой посетитель (anon/authenticated), как у публичных view;
--   запись — только service_role (ключ SUPABASE_SERVICE_KEY на сервере).
--   Политик на INSERT/UPDATE/DELETE нет, поэтому из браузера курс изменить нельзя.
--
-- Начальных данных нет: до первого успешного запуска api/update-exchange-rate
-- сайт не конвертирует валюты и показывает цену в той валюте, в которой она
-- сохранена (вместо выдуманной цифры).

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
