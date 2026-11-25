-- Индексы для быстрых антиспам-проверок в api/lead.js (выполнить в Supabase SQL Editor)
create index if not exists leads_ip_created_idx
  on public.leads ((raw_data->>'_ip'), created_at desc);

create index if not exists leads_phone_created_idx
  on public.leads (phone, created_at desc);
