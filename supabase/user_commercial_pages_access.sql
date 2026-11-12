drop policy if exists "commercial_pages_insert_own" on public.commercial_pages;
drop policy if exists "commercial_pages_update_own" on public.commercial_pages;
drop policy if exists "commercial_pages_delete_own" on public.commercial_pages;

create policy "commercial_pages_insert_own"
on public.commercial_pages for insert
to authenticated
with check (
  commercial_id in (
    select id from public.commercials where created_by = auth.uid()
  )
);

create policy "commercial_pages_update_own"
on public.commercial_pages for update
to authenticated
using (
  commercial_id in (
    select id from public.commercials where created_by = auth.uid()
  )
)
with check (
  commercial_id in (
    select id from public.commercials where created_by = auth.uid()
  )
);

create policy "commercial_pages_delete_own"
on public.commercial_pages for delete
to authenticated
using (
  commercial_id in (
    select id from public.commercials where created_by = auth.uid()
  )
);

