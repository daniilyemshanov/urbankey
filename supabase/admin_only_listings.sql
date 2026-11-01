-- Объявлениями управляет только админ. УЖЕ применено в проекте (bmwhimqdlcvejtdjzwzm).
--
-- 1) Убраны политики, позволявшие любому вошедшему пользователю создавать,
--    менять и удалять «свои» объекты (cardss, commercials, villas, commercial_pages).
--    Политики для админа (*_write_admin, "Only admins can ...") остались.
-- 2) В Storage убраны две широкие политики загрузки: любой (даже без входа) и любой
--    вошедший мог загрузить любой файл в бакет images. Остались: админ — любые файлы,
--    пользователь — только свой аватар (имя файла «<uid>-...»).
-- Бот и webhook работают через service key и этим не затронуты.

drop policy if exists cardss_insert_own on public.cardss;
drop policy if exists cardss_update_own on public.cardss;
drop policy if exists cardss_delete_own on public.cardss;
drop policy if exists commercials_insert_own on public.commercials;
drop policy if exists commercials_update_own on public.commercials;
drop policy if exists commercials_delete_own on public.commercials;
drop policy if exists villas_insert_own_card on public.villas;
drop policy if exists villas_update_own_card on public.villas;
drop policy if exists villas_delete_own_card on public.villas;
drop policy if exists commercial_pages_insert_own on public.commercial_pages;
drop policy if exists commercial_pages_update_own on public.commercial_pages;
drop policy if exists commercial_pages_delete_own on public.commercial_pages;
drop policy if exists "Allow uploads 1ffg0oo_0" on storage.objects;
drop policy if exists images_authenticated_write on storage.objects;

-- ОТКАТ (вернуть как было) — снимите комментарии нужных строк:
-- create policy cardss_insert_own on public.cardss for insert to authenticated with check (created_by = auth.uid());
-- create policy cardss_update_own on public.cardss for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
-- create policy cardss_delete_own on public.cardss for delete to authenticated using (created_by = auth.uid());
-- create policy commercials_insert_own on public.commercials for insert to authenticated with check (created_by = auth.uid());
-- create policy commercials_update_own on public.commercials for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
-- create policy commercials_delete_own on public.commercials for delete to authenticated using (created_by = auth.uid());
-- create policy villas_insert_own_card on public.villas for insert to authenticated with check (card_id in (select id from public.cardss where created_by = auth.uid()));
-- create policy villas_update_own_card on public.villas for update to authenticated using (card_id in (select id from public.cardss where created_by = auth.uid())) with check (card_id in (select id from public.cardss where created_by = auth.uid()));
-- create policy villas_delete_own_card on public.villas for delete to authenticated using (card_id in (select id from public.cardss where created_by = auth.uid()));
-- create policy commercial_pages_insert_own on public.commercial_pages for insert to authenticated with check (commercial_id in (select id from public.commercials where created_by = auth.uid()));
-- create policy commercial_pages_update_own on public.commercial_pages for update to authenticated using (commercial_id in (select id from public.commercials where created_by = auth.uid())) with check (commercial_id in (select id from public.commercials where created_by = auth.uid()));
-- create policy commercial_pages_delete_own on public.commercial_pages for delete to authenticated using (commercial_id in (select id from public.commercials where created_by = auth.uid()));
-- create policy images_authenticated_write on storage.objects for insert to authenticated with check (bucket_id = 'images');
