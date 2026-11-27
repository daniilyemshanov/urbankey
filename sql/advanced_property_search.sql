-- Advanced public catalog search. Apply only after reviewing against the target
-- Supabase schema. This migration is not applied by the application or build.
-- It reads from existing sold-filtered public views and preserves their RLS/access boundary.

create extension if not exists pg_trgm with schema extensions;

alter table public.cardss add column if not exists is_rent boolean;
alter table public.commercials add column if not exists is_rent boolean;

create or replace view public.property_search_residential_public as
select
  public_listing.*,
  base_listing.is_rent as search_is_rent,
  to_jsonb(base_listing)->>'floor' as search_floor,
  to_jsonb(base_listing)->>'total_floors' as search_total_floors,
  villa.location_ru as search_location_ru,
  villa.location_en as search_location_en,
  villa.location_uz as search_location_uz
from public.cardss_public as public_listing
left join public.cardss as base_listing on base_listing.id = public_listing.id
left join lateral (
  select v.location_ru, v.location_en, v.location_uz
  from public.villas v
  where v.card_id = public_listing.id
  order by v.id desc
  limit 1
) villa on true;

create or replace view public.property_search_commercial_public as
select
  public_listing.*,
  base_listing.is_rent as search_is_rent
from public.commercials_public as public_listing
left join public.commercials as base_listing on base_listing.id = public_listing.id;

grant select on public.property_search_residential_public to anon, authenticated;
grant select on public.property_search_commercial_public to anon, authenticated;

create index if not exists cardss_public_search_title_trgm
  on public.cardss using gin (title_ru extensions.gin_trgm_ops);
create index if not exists cardss_public_search_description_trgm
  on public.cardss using gin (description_ru extensions.gin_trgm_ops);
create index if not exists cardss_public_search_type_trgm
  on public.cardss using gin (type_ru extensions.gin_trgm_ops);
create index if not exists cardss_public_search_all_trgm
  on public.cardss using gin ((coalesce(title_ru, '') || ' ' || coalesce(title_en, '') || ' ' || coalesce(title_uz, '') || ' ' || coalesce(description_ru, '') || ' ' || coalesce(description_en, '') || ' ' || coalesce(description_uz, '') || ' ' || coalesce(type_ru, '') || ' ' || coalesce(type_en, '') || ' ' || coalesce(type_uz, '') || ' ' || coalesce(bedrooms_ru, '') || ' ' || coalesce(bedrooms_en, '') || ' ' || coalesce(bedrooms_uz, '')) extensions.gin_trgm_ops);
create index if not exists commercials_public_search_title_trgm
  on public.commercials using gin (title_ru extensions.gin_trgm_ops);
create index if not exists commercials_public_search_description_trgm
  on public.commercials using gin (description_ru extensions.gin_trgm_ops);
create index if not exists commercials_public_search_location_trgm
  on public.commercials using gin (address_ru extensions.gin_trgm_ops);

create index if not exists commercials_public_search_all_trgm
  on public.commercials using gin ((coalesce(title_ru, '') || ' ' || coalesce(title_en, '') || ' ' || coalesce(title_uz, '') || ' ' || coalesce(description_ru, '') || ' ' || coalesce(description_en, '') || ' ' || coalesce(description_uz, '') || ' ' || coalesce(district_ru, '') || ' ' || coalesce(district_en, '') || ' ' || coalesce(district_uz, '') || ' ' || coalesce(address_ru, '') || ' ' || coalesce(address_en, '') || ' ' || coalesce(address_uz, '') || ' ' || coalesce(class_ru, '') || ' ' || coalesce(class_en, '') || ' ' || coalesce(class_uz, '') || ' ' || coalesce(landmark_ru, '') || ' ' || coalesce(landmark_en, '') || ' ' || coalesce(landmark_uz, '')) extensions.gin_trgm_ops);
create index if not exists villas_public_search_location_trgm
  on public.villas using gin ((coalesce(location_ru, '') || ' ' || coalesce(location_en, '') || ' ' || coalesce(location_uz, '')) extensions.gin_trgm_ops);

create or replace function public.uk_search_normalize(value text)
returns text
language sql
immutable
parallel safe
as $$
  select trim(regexp_replace(translate(lower(coalesce(value, '')), 'ё', 'е'), '[^[:alnum:]]+', ' ', 'g'));
$$;

create or replace function public.uk_search_price_value(raw_price text, raw_area text, display_currency text, exchange_rate numeric)
returns numeric
language plpgsql
immutable
parallel safe
as $$
declare
  amount numeric;
  area_value numeric;
  is_uzs boolean;
  price_text text := lower(coalesce(raw_price, ''));
begin
  amount := nullif(regexp_replace(price_text, '[^0-9]', '', 'g'), '')::numeric;
  if amount is null or amount <= 0 then return null; end if;
  is_uzs := price_text ~ '(uzs|сум|сўм|so.?m|som)' or (price_text !~ '(usd|\$)' and amount >= 10000000);
  if price_text ~ '(м2|м²|кв\.?\s*м|sqm|sq\.?\s*m|m²)' then
    area_value := nullif(regexp_replace(coalesce(raw_area, ''), '[^0-9.]', '', 'g'), '')::numeric;
    if area_value is null or area_value <= 0 then return null; end if;
    amount := amount * area_value;
  end if;
  if upper(coalesce(display_currency, 'USD')) = 'UZS' then
    if is_uzs then return amount; end if;
    if exchange_rate is null or exchange_rate <= 0 then return null; end if;
    return amount * exchange_rate;
  end if;
  if not is_uzs then return amount; end if;
  if exchange_rate is null or exchange_rate <= 0 then return null; end if;
  return amount / exchange_rate;
end;
$$;

create or replace function public.search_public_listings(
  p_filters jsonb default '{}'::jsonb,
  p_sort text default 'newest',
  p_page integer default 1,
  p_page_size integer default 12,
  p_currency text default 'USD',
  p_rate numeric default null,
  p_district_aliases text[] default '{}'
)
returns jsonb
language sql
stable
security invoker
set search_path = public, extensions
as $$
with source_rows as (
  select to_jsonb(c) || jsonb_build_object('category', 'residential') as item
  from public.property_search_residential_public c
  where coalesce(p_filters->>'q', '') = '' or
    concat_ws(' ', c.title_ru, c.title_en, c.title_uz, c.description_ru, c.description_en, c.description_uz, c.type_ru, c.type_en, c.type_uz, c.bedrooms_ru, c.bedrooms_en, c.bedrooms_uz) % public.uk_search_normalize(p_filters->>'q') or
    coalesce(c.search_location_ru, '') % public.uk_search_normalize(p_filters->>'q') or
    coalesce(c.search_location_en, '') % public.uk_search_normalize(p_filters->>'q') or
    coalesce(c.search_location_uz, '') % public.uk_search_normalize(p_filters->>'q') or
    exists (select 1 from unnest(string_to_array(public.uk_search_normalize(p_filters->>'q'), ' ')) term where public.uk_search_normalize(concat_ws(' ', c.title_ru, c.title_en, c.title_uz, c.description_ru, c.description_en, c.description_uz, c.type_ru, c.type_en, c.type_uz, c.bedrooms_ru, c.bedrooms_en, c.bedrooms_uz)) like '%' || term || '%')
  union all
  select to_jsonb(c) || jsonb_build_object('category', 'commercial') as item
  from public.property_search_commercial_public c
  where coalesce(p_filters->>'q', '') = '' or
    concat_ws(' ', c.title_ru, c.title_en, c.title_uz, c.description_ru, c.description_en, c.description_uz, c.district_ru, c.district_en, c.district_uz, c.address_ru, c.address_en, c.address_uz, c.class_ru, c.class_en, c.class_uz, c.landmark_ru, c.landmark_en, c.landmark_uz) % public.uk_search_normalize(p_filters->>'q') or
    exists (select 1 from unnest(string_to_array(public.uk_search_normalize(p_filters->>'q'), ' ')) term where public.uk_search_normalize(concat_ws(' ', c.title_ru, c.title_en, c.title_uz, c.description_ru, c.description_en, c.description_uz, c.district_ru, c.district_en, c.district_uz, c.address_ru, c.address_en, c.address_uz, c.class_ru, c.class_en, c.class_uz, c.landmark_ru, c.landmark_en, c.landmark_uz)) like '%' || term || '%')
), prepared as (
  select
    item,
    concat_ws(' ',
      item->>'title_ru', item->>'title_en', item->>'title_uz',
      item->>'description_ru', item->>'description_en', item->>'description_uz',
      item->>'type_ru', item->>'type_en', item->>'type_uz',
      item->>'bedrooms_ru', item->>'bedrooms_en', item->>'bedrooms_uz',
      item->>'district_ru', item->>'district_en', item->>'district_uz',
      item->>'address_ru', item->>'address_en', item->>'address_uz',
      item->>'class_ru', item->>'class_en', item->>'class_uz',
      item->>'landmark_ru', item->>'landmark_en', item->>'landmark_uz',
      item->>'search_location_ru', item->>'search_location_en', item->>'search_location_uz'
    ) as search_text,
    coalesce(item->>'title_ru', item->>'title_en', item->>'title_uz', '') as title,
    public.uk_search_price_value(coalesce(item->>'discount_price', item->>'price'), item->>'area', p_currency, p_rate) as price_value,
    nullif(regexp_replace(coalesce(item->>'area', ''), '[^0-9.]', '', 'g'), '')::numeric as area_value,
    nullif((regexp_match(coalesce(item->>'bedrooms_ru', item->>'bedrooms_en', item->>'bedrooms_uz', ''), '[0-9]+'))[1], '')::integer as bedrooms_value,
    nullif((regexp_match(coalesce(item->>'search_floor', item->>'floor', ''), '[0-9]+'))[1], '')::integer as floor_value
  from source_rows
), matched as (
  select prepared.*,
    case
      when public.uk_search_normalize(title) = public.uk_search_normalize(p_filters->>'q') then 100
      when public.uk_search_normalize(search_text) like '%' || public.uk_search_normalize(p_filters->>'q') || '%' then 60
      else (select count(*) * 10 from unnest(string_to_array(public.uk_search_normalize(p_filters->>'q'), ' ')) term where length(term) > 1 and public.uk_search_normalize(search_text) like '%' || term || '%')
    end
    + case when p_filters->>'district' is not null then 30 else 0 end
    + case when p_filters->>'category' is not null then 15 else 0 end as relevance
  from prepared
  where
    (coalesce(p_filters->>'category', 'all') = 'all' or item->>'category' = p_filters->>'category')
    and (coalesce(p_filters->>'dealType', '') = '' or
      case when jsonb_typeof(coalesce(item->'search_is_rent', item->'is_rent')) = 'boolean' then coalesce(item->>'search_is_rent', item->>'is_rent')::boolean
           when lower(coalesce(item->>'search_is_rent', item->>'is_rent', '')) in ('true','1','rent') then true
           when lower(coalesce(item->>'search_is_rent', item->>'is_rent', '')) in ('false','0','sale') then false
           else null end = (p_filters->>'dealType' = 'rent'))
    and (coalesce(p_filters->>'minBedrooms', '') = '' or
      (item->>'category' = 'residential' and bedrooms_value >= (p_filters->>'minBedrooms')::integer))
    and (coalesce(p_filters->>'minArea', '') = '' or area_value >= (p_filters->>'minArea')::numeric)
    and (coalesce(p_filters->>'maxArea', '') = '' or area_value <= (p_filters->>'maxArea')::numeric)
    and (coalesce(p_filters->>'minFloor', '') = '' or floor_value >= (p_filters->>'minFloor')::integer)
    and (coalesce(p_filters->>'minPrice', '') = '' or price_value >= (p_filters->>'minPrice')::numeric)
    and (coalesce(p_filters->>'maxPrice', '') = '' or price_value <= (p_filters->>'maxPrice')::numeric)
    and (coalesce(p_filters->>'district', '') = '' or exists (
      select 1 from unnest(coalesce(p_district_aliases, '{}')) alias
      where public.uk_search_normalize(concat_ws(' ',
        item->>'district_ru', item->>'district_en', item->>'district_uz',
        item->>'address_ru', item->>'address_en', item->>'address_uz',
        item->>'landmark_ru', item->>'landmark_en', item->>'landmark_uz', item->>'search_location_ru', item->>'search_location_en', item->>'search_location_uz',
        item->>'title_ru', item->>'title_en', item->>'title_uz',
        item->>'description_ru', item->>'description_en', item->>'description_uz'
      )) like '%' || public.uk_search_normalize(alias) || '%'
    ))
    and (coalesce(p_filters->>'location', '') <> 'center' or public.uk_search_normalize(concat_ws(' ', item->>'address_ru', item->>'address_en', item->>'address_uz', item->>'landmark_ru', item->>'landmark_en', item->>'landmark_uz', item->>'search_location_ru', item->>'search_location_en', item->>'search_location_uz', item->>'district_ru', item->>'district_en', item->>'district_uz')) ~ '(центр|markaz|downtown|city centre|city center)')
    and (coalesce(p_filters->>'type', '') = '' or
      case p_filters->>'type'
        when 'office' then public.uk_search_normalize(concat_ws(' ', item->>'class_ru', item->>'class_en', item->>'class_uz', item->>'title_ru', item->>'title_en', item->>'title_uz')) ~ '(офис|office|ofis)'
        when 'apartment' then public.uk_search_normalize(concat_ws(' ', item->>'type_ru', item->>'type_en', item->>'type_uz')) ~ '(квартир|apartment|flat|kvartira)'
        when 'house' then public.uk_search_normalize(concat_ws(' ', item->>'type_ru', item->>'type_en', item->>'type_uz')) ~ '(дом|house|uy)'
        when 'newbuilding' then public.uk_search_normalize(concat_ws(' ', item->>'type_ru', item->>'type_en', item->>'type_uz', item->>'title_ru', item->>'title_en', item->>'title_uz')) ~ '(новостро|new build|new building|yangi qurilish)'
        else public.uk_search_normalize(concat_ws(' ', item->>'class_ru', item->>'class_en', item->>'class_uz', item->>'type_ru', item->>'type_en', item->>'type_uz')) like '%' || public.uk_search_normalize(p_filters->>'type') || '%'
      end)
    and (coalesce(p_filters->>'q', '') = '' or
      public.uk_search_normalize(search_text) like '%' || public.uk_search_normalize(p_filters->>'q') || '%' or
      (length(public.uk_search_normalize(p_filters->>'q')) >= 3 and public.uk_search_normalize(search_text) % public.uk_search_normalize(p_filters->>'q')) or
      not exists (
        select 1 from unnest(string_to_array(public.uk_search_normalize(p_filters->>'q'), ' ')) term
        where length(term) > 1 and public.uk_search_normalize(search_text) not like '%' || term || '%'
      ))
), totals as (
  select count(*)::integer as total from matched
), page_rows as (
  select matched.* from matched
  order by
    case when p_sort = 'relevance' then relevance end desc,
    case when p_sort = 'priceAsc' then price_value end asc nulls last,
    case when p_sort = 'priceDesc' then price_value end desc nulls last,
    case when p_sort = 'newest' or p_sort not in ('relevance','priceAsc','priceDesc') then coalesce(nullif(item->>'id','')::bigint, 0) end desc,
    coalesce(nullif(item->>'id','')::bigint, 0) desc
  limit greatest(1, least(coalesce(p_page_size, 12), 48))
  offset (greatest(1, least(coalesce(p_page, 1), 100000))::bigint - 1) * greatest(1, least(coalesce(p_page_size, 12), 48))
)
select jsonb_build_object(
  'items', coalesce((select jsonb_agg(item) from page_rows), '[]'::jsonb),
  'total', (select total from totals),
  'page', greatest(1, least(coalesce(p_page, 1), 100000)),
  'pageSize', greatest(1, least(coalesce(p_page_size, 12), 48))
);
$$;

revoke all on function public.search_public_listings(jsonb, text, integer, integer, text, numeric, text[]) from public;
grant execute on function public.search_public_listings(jsonb, text, integer, integer, text, numeric, text[]) to anon, authenticated;

