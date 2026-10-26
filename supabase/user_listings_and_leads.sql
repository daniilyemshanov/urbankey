
alter table public.cardss
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists owner_phone text,
  add column if not exists owner_telegram text;

comment on column public.cardss.created_by is
  'null = объявление от админа/агентства; не null = опубликовано самим пользователем';


drop policy if exists "cardss_insert_own" on public.cardss;

create policy "cardss_insert_own"
on public.cardss for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "cardss_update_own" on public.cardss;
drop policy if exists "cardss_delete_own" on public.cardss;

create policy "cardss_update_own"
on public.cardss for update
to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

create policy "cardss_delete_own"
on public.cardss for delete
to authenticated
using (created_by = auth.uid());


create table if not exists public.leads (

  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  type text not null check (type in ('contact_form', 'listing_owner')),

  source text,

  name text,
  phone text,
  telegram text,
  message text,

  related_card_id integer references public.cardss(id) on delete set null,

  status text not null default 'new'
    check (status in ('new', 'in_contact', 'deal', 'closed')),

  raw_data jsonb,

  crm_synced_at timestamptz

);

alter table public.leads enable row level security;

drop policy if exists "leads_admin_all" on public.leads;
drop policy if exists "leads_insert_own_listing" on public.leads;

create policy "leads_admin_all"
on public.leads for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "leads_insert_own_listing"
on public.leads for insert
to authenticated
with check (
  type = 'listing_owner'
  and related_card_id in (
    select id from public.cardss where created_by = auth.uid()
  )
);

create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_related_card_idx on public.leads (related_card_id);


revoke select on public.cardss from anon, authenticated;

grant select (
  id, title_ru, title_en, title_uz,
  description_ru, description_en, description_uz,
  bedrooms_ru, bedrooms_en, bedrooms_uz,
  bathrooms_ru, bathrooms_en, bathrooms_uz,
  type_ru, type_en, type_uz,
  price, image, link, created_by
) on public.cardss to anon, authenticated;

create or replace view public.cardss_public as
  select
    id, title_ru, title_en, title_uz,
    description_ru, description_en, description_uz,
    bedrooms_ru, bedrooms_en, bedrooms_uz,
    bathrooms_ru, bathrooms_en, bathrooms_uz,
    type_ru, type_en, type_uz,
    price, image, link, created_by
  from public.cardss;

grant select on public.cardss_public to anon, authenticated;


drop policy if exists "images_authenticated_write" on storage.objects;

create policy "images_authenticated_write"
on storage.objects for insert
to authenticated
with check (bucket_id = 'images');


alter table public.commercials
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists owner_phone text,
  add column if not exists owner_telegram text;

drop policy if exists "commercials_insert_own" on public.commercials;
drop policy if exists "commercials_update_own" on public.commercials;
drop policy if exists "commercials_delete_own" on public.commercials;

create policy "commercials_insert_own"
on public.commercials for insert
to authenticated
with check (created_by = auth.uid());

create policy "commercials_update_own"
on public.commercials for update
to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

create policy "commercials_delete_own"
on public.commercials for delete
to authenticated
using (created_by = auth.uid());

revoke select on public.commercials from anon, authenticated;

grant select (
  id, title_ru, title_en, title_uz,
  description_ru, description_en, description_uz,
  district_ru, district_en, district_uz,
  address_ru, address_en, address_uz,
  class_ru, class_en, class_uz,
  landmark_ru, landmark_en, landmark_uz,
  floor, ceiling, area,
  price, discount_price, discount,
  status_ru, status_en, status_uz,
  delivery_date, image, created_by
) on public.commercials to anon, authenticated;

create or replace view public.commercials_public as
  select
    id, title_ru, title_en, title_uz,
    description_ru, description_en, description_uz,
    district_ru, district_en, district_uz,
    address_ru, address_en, address_uz,
    class_ru, class_en, class_uz,
    landmark_ru, landmark_en, landmark_uz,
    floor, ceiling, area,
    price, discount_price, discount,
    status_ru, status_en, status_uz,
    delivery_date, image, created_by
  from public.commercials;

grant select on public.commercials_public to anon, authenticated;

drop policy if exists "villas_insert_own_card" on public.villas;
drop policy if exists "villas_update_own_card" on public.villas;
drop policy if exists "villas_delete_own_card" on public.villas;

create policy "villas_insert_own_card"
on public.villas for insert
to authenticated
with check (
  card_id in (select id from public.cardss where created_by = auth.uid())
);

create policy "villas_update_own_card"
on public.villas for update
to authenticated
using (
  card_id in (select id from public.cardss where created_by = auth.uid())
)
with check (
  card_id in (select id from public.cardss where created_by = auth.uid())
);

create policy "villas_delete_own_card"
on public.villas for delete
to authenticated
using (
  card_id in (select id from public.cardss where created_by = auth.uid())
);

alter table public.leads
  add column if not exists related_commercial_id integer references public.commercials(id) on delete set null;

drop policy if exists "leads_insert_own_listing" on public.leads;

create policy "leads_insert_own_listing"
on public.leads for insert
to authenticated
with check (
  (
    type = 'listing_owner'
    and related_card_id in (
      select id from public.cardss where created_by = auth.uid()
    )
  )
  or
  (
    type = 'commercial_owner'
    and related_commercial_id in (
      select id from public.commercials where created_by = auth.uid()
    )
  )
);

alter table public.leads
  drop constraint if exists leads_type_check;

alter table public.leads
  add constraint leads_type_check
  check (type in ('contact_form', 'listing_owner', 'commercial_owner'));

create index if not exists leads_related_commercial_idx on public.leads (related_commercial_id);


