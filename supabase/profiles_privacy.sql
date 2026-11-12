-- Закрываем телефон в profiles от анонимов и других пользователей.
-- Уже применено в проекте (bmwhimqdlcvejtdjzwzm). Файл — для истории и повторного запуска.
--
-- Было: таблицу profiles читал кто угодно без входа, включая phone.
-- Стало: все (anon и authenticated) читают только безопасные колонки;
-- телефон отдаёт функция get_profile_phone() — только владельцу профиля и админу.
-- ВАЖНО: select("*") и пустой .select() по profiles больше не работают —
-- запрашивайте колонки явно (id, uuid, name, surname, city, role, avatar_url, bio, created_at).

revoke select on public.profiles from anon, authenticated;
grant select (id, uuid, name, surname, city, role, avatar_url, bio, created_at)
    on public.profiles to anon, authenticated;

create or replace function public.get_profile_phone(p_id uuid)
returns text
language sql stable security definer
set search_path = public, pg_temp
as $$
    select pr.phone
    from public.profiles pr
    where pr.id = p_id
      and (auth.uid() = p_id or public.is_admin())
$$;

revoke all on function public.get_profile_phone(uuid) from public, anon;
grant execute on function public.get_profile_phone(uuid) to authenticated;

-- ОТКАТ (вернуть как было — телефон снова виден всем):
-- grant select on public.profiles to anon, authenticated;
