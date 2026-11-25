-- Очистка старых лидов (опционально). Выполнить в Supabase SQL Editor.
-- 1) Тяжёлый raw_data обнуляем через 90 дней
-- 2) Сами заявки со статусом new/closed удаляем через 12 месяцев
create extension if not exists pg_cron;

select cron.schedule(
  'leads-trim-raw-data',
  '0 3 * * *',
  $$ update public.leads set raw_data = null
     where created_at < now() - interval '90 days' and raw_data is not null $$
);

select cron.schedule(
  'leads-delete-old',
  '15 3 * * *',
  $$ delete from public.leads
     where created_at < now() - interval '12 months'
       and status in ('new', 'closed') $$
);
