do $$ begin
 if not exists(select 1 from pg_roles where rolname='authenticator') then create role authenticator noinherit login password 'pw'; end if;
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
grant anon, authenticated, service_role to authenticator;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true),''),
                  (nullif(current_setting('request.jwt.claims', true),'')::jsonb ->> 'sub'))::uuid $$;
create table public.profiles(id uuid primary key, role text default 'user');
-- is_admin: дословно как в supabase/security_hardening.sql
create or replace function public.is_admin() returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'); $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, anon;

create table public.cardss(id integer generated always as identity primary key,
 title_ru text,title_en text,title_uz text,description_ru text,description_en text,description_uz text,
 bedrooms_ru text,bedrooms_en text,bedrooms_uz text,bathrooms_ru text,bathrooms_en text,bathrooms_uz text,
 type_ru text,type_en text,type_uz text,price text,image text,link text,
 created_by uuid,owner_phone text,owner_telegram text,boosted_until timestamptz,is_rent boolean,
 tg_chat_id bigint,tg_message_id bigint, video text);
create table public.commercials(id integer generated always as identity primary key,
 title_ru text,title_en text,title_uz text,description_ru text,description_en text,description_uz text,
 district_ru text,district_en text,district_uz text,address_ru text,address_en text,address_uz text,
 class_ru text,class_en text,class_uz text,landmark_ru text,landmark_en text,landmark_uz text,
 floor int,ceiling numeric,area numeric,price text,discount_price text,discount text,
 status_ru text,status_en text,status_uz text,delivery_date date,image text,
 created_by uuid,owner_phone text,owner_telegram text,boosted_until timestamptz,is_rent boolean,
 link text,tg_chat_id bigint,tg_message_id bigint, video text);
create table public.villas(id integer generated always as identity primary key,card_id integer,slug text,
 title_ru text,title_en text,title_uz text,description_ru text,description_en text,description_uz text,
 about_ru text,about_en text,about_uz text,location_ru text,location_en text,location_uz text,
 type_ru text,type_en text,type_uz text,price numeric,images text[],video text,amenities jsonb,is_rent boolean,
 bedrooms integer,year integer,square numeric,is_draft boolean);
create table public.commercial_pages(id integer generated always as identity primary key,commercial_id integer,slug text,
 title_ru text,title_en text,title_uz text,description_ru text,description_en text,description_uz text,
 about_ru text,about_en text,about_uz text,location_ru text,location_en text,location_uz text,
 type_ru text,type_en text,type_uz text,class_ru text,class_en text,class_uz text,purpose_ru text,purpose_en text,purpose_uz text,
 price numeric,images text[],video text,amenities jsonb,is_rent boolean,area numeric,ceiling_height numeric,floor integer,is_draft boolean);

-- RLS как в supabase/*.sql
alter table cardss enable row level security; alter table commercials enable row level security;
alter table villas enable row level security; alter table commercial_pages enable row level security;
alter table profiles enable row level security;
create policy profiles_select_all on profiles for select to anon,authenticated using(true);
create policy cardss_select_all on cardss for select to anon,authenticated using(true);
create policy cardss_write_admin on cardss for all to authenticated using(is_admin()) with check(is_admin());
create policy commercials_select_all on commercials for select to anon,authenticated using(true);
create policy commercials_write_admin on commercials for all to authenticated using(is_admin()) with check(is_admin());
create policy villas_select_all on villas for select to anon,authenticated using(true);
create policy villas_write_admin on villas for all to authenticated using(is_admin()) with check(is_admin());
create policy villas_update_own_card on villas for update to authenticated
  using (card_id in (select id from cardss where created_by = auth.uid()))
  with check (card_id in (select id from cardss where created_by = auth.uid()));
create policy commercial_pages_select_all on commercial_pages for select to anon,authenticated using(true);
create policy commercial_pages_write_admin on commercial_pages for all to authenticated using(is_admin()) with check(is_admin());

-- колоночные GRANT как в user_listings_and_leads.sql: owner_phone закрыт
grant usage on schema public to anon, authenticated;
revoke select on cardss from anon, authenticated;
grant select (id,title_ru,title_en,title_uz,description_ru,description_en,description_uz,bedrooms_ru,bedrooms_en,bedrooms_uz,
 bathrooms_ru,bathrooms_en,bathrooms_uz,type_ru,type_en,type_uz,price,image,link,created_by,boosted_until,is_rent) on cardss to anon, authenticated;
revoke select on commercials from anon, authenticated;
grant select (id,title_ru,title_en,title_uz,description_ru,description_en,description_uz,district_ru,district_en,district_uz,
 address_ru,address_en,address_uz,class_ru,class_en,class_uz,landmark_ru,landmark_en,landmark_uz,floor,ceiling,area,price,
 discount_price,discount,status_ru,status_en,status_uz,delivery_date,image,created_by,boosted_until,is_rent) on commercials to anon, authenticated;
grant select, insert, update, delete on villas, commercial_pages to anon, authenticated;
grant select on profiles to anon, authenticated;
grant update on cardss, commercials to authenticated;

create view cardss_public as select id,title_ru,title_en,title_uz,description_ru,description_en,description_uz,
 bedrooms_ru,bedrooms_en,bedrooms_uz,bathrooms_ru,bathrooms_en,bathrooms_uz,type_ru,type_en,type_uz,price,image,link,created_by,boosted_until,is_rent from cardss;
create view commercials_public as select id,title_ru,title_en,title_uz,description_ru,description_en,description_uz,district_ru,district_en,district_uz,
 address_ru,address_en,address_uz,class_ru,class_en,class_uz,landmark_ru,landmark_en,landmark_uz,floor,ceiling,area,price,discount_price,discount,
 status_ru,status_en,status_uz,delivery_date,image,created_by,boosted_until,is_rent from commercials;
grant select on cardss_public, commercials_public to anon, authenticated;

-- ДАННЫЕ. Идентификаторы:
insert into profiles values ('aaaaaaaa-0000-0000-0000-000000000001','admin'),('bbbbbbbb-0000-0000-0000-000000000002','user');
-- Существующие объекты из Telegram: бот всегда ставит is_draft=true — как в проде.
-- Они должны оставаться публичными (is_draft ничего не скрывает).
insert into cardss(title_ru,owner_phone,tg_chat_id,tg_message_id) values ('TG villa A','+998901',1,1),('TG villa B','+998902',1,2);
insert into villas(card_id,slug,title_ru,is_draft) values (1,'a-1','TG villa A',true),(2,'b-2','TG villa B',true);
insert into commercials(title_ru,tg_chat_id,tg_message_id) values ('TG office C',1,3);
insert into commercial_pages(commercial_id,slug,title_ru,is_draft) values (1,'c-1','TG office C',true);
-- 1 объект, созданный пользователем (is_draft не задаётся -> NULL, как у старых/ручных записей)
insert into cardss(title_ru,created_by,owner_phone) values ('User villa D','bbbbbbbb-0000-0000-0000-000000000002','+998903');
insert into villas(card_id,slug,title_ru) values (3,'d-3','User villa D');

-- как service_role в Supabase: обходит RLS (бот пишет именно этим ключом)
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
