
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, anon;


alter table public.profiles enable row level security;

drop policy if exists "profiles_select_all" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;
drop policy if exists "profiles_no_client_insert" on public.profiles;
drop policy if exists "profiles_no_client_delete" on public.profiles;

create policy "profiles_select_all"
on public.profiles for select
to anon, authenticated
using (true);

create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (
  auth.uid() = id
  and role = (select role from public.profiles where id = auth.uid())
);

create policy "profiles_update_admin"
on public.profiles for update
to authenticated
using (public.is_admin())
with check (true);

create policy "profiles_no_client_insert"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

create policy "profiles_no_client_delete"
on public.profiles for delete
to authenticated
using (false);


alter table public.cardss enable row level security;

drop policy if exists "cardss_select_all" on public.cardss;
drop policy if exists "cardss_write_admin" on public.cardss;

create policy "cardss_select_all"
on public.cardss for select
to anon, authenticated
using (true);

create policy "cardss_write_admin"
on public.cardss for all
to authenticated
using (public.is_admin())
with check (public.is_admin());


alter table public.commercials enable row level security;

drop policy if exists "commercials_select_all" on public.commercials;
drop policy if exists "commercials_write_admin" on public.commercials;

create policy "commercials_select_all"
on public.commercials for select
to anon, authenticated
using (true);

create policy "commercials_write_admin"
on public.commercials for all
to authenticated
using (public.is_admin())
with check (public.is_admin());


alter table public.commercial_pages enable row level security;

drop policy if exists "commercial_pages_select_all" on public.commercial_pages;
drop policy if exists "commercial_pages_write_admin" on public.commercial_pages;

create policy "commercial_pages_select_all"
on public.commercial_pages for select
to anon, authenticated
using (true);

create policy "commercial_pages_write_admin"
on public.commercial_pages for all
to authenticated
using (public.is_admin())
with check (public.is_admin());


alter table public.villas enable row level security;

drop policy if exists "villas_select_all" on public.villas;
drop policy if exists "villas_write_admin" on public.villas;

create policy "villas_select_all"
on public.villas for select
to anon, authenticated
using (true);

create policy "villas_write_admin"
on public.villas for all
to authenticated
using (public.is_admin())
with check (public.is_admin());


alter table public.favorites enable row level security;

drop policy if exists "favorites_select_own" on public.favorites;
drop policy if exists "favorites_insert_own" on public.favorites;
drop policy if exists "favorites_delete_own" on public.favorites;

create policy "favorites_select_own"
on public.favorites for select
to authenticated
using (auth.uid() = user_id);

create policy "favorites_insert_own"
on public.favorites for insert
to authenticated
with check (auth.uid() = user_id);

create policy "favorites_delete_own"
on public.favorites for delete
to authenticated
using (auth.uid() = user_id);


alter table public.reviews enable row level security;

drop policy if exists "reviews_select_all" on public.reviews;
drop policy if exists "reviews_insert_own" on public.reviews;
drop policy if exists "reviews_update_own_or_admin" on public.reviews;
drop policy if exists "reviews_delete_own_or_admin" on public.reviews;

create policy "reviews_select_all"
on public.reviews for select
to anon, authenticated
using (true);

create policy "reviews_insert_own"
on public.reviews for insert
to authenticated
with check (auth.uid() = user_id);

create policy "reviews_update_own_or_admin"
on public.reviews for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "reviews_delete_own_or_admin"
on public.reviews for delete
to authenticated
using (auth.uid() = user_id or public.is_admin());


drop policy if exists "images_public_read" on storage.objects;
drop policy if exists "images_admin_write" on storage.objects;
drop policy if exists "images_admin_delete" on storage.objects;

create policy "images_public_read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'images');

create policy "images_admin_write"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'images'
  and public.is_admin()
);

create policy "images_admin_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'images'
  and public.is_admin()
);


