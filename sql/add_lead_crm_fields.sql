-- Migration: Add CRM routing, Binotel sync status, manager assignment, and idempotency columns to leads

alter table public.leads
  add column if not exists direction text,
  add column if not exists operation text,
  add column if not exists property_type text,
  add column if not exists budget numeric,
  add column if not exists assigned_manager_name text,
  add column if not exists assigned_manager_id text,
  add column if not exists binotel_customer_id text,
  add column if not exists binotel_deal_id text,
  add column if not exists binotel_status text,
  add column if not exists binotel_error text,
  add column if not exists idempotency_key text,
  add column if not exists dedup_key text;

create index if not exists leads_direction_idx on public.leads (direction);
create index if not exists leads_phone_idx on public.leads (phone);
create index if not exists leads_idempotency_key_idx on public.leads (idempotency_key) where idempotency_key is not null;
create index if not exists leads_dedup_key_idx on public.leads (dedup_key) where dedup_key is not null;

-- Atomic counter table and RPC for race-condition-free round-robin manager assignment
create table if not exists public.crm_runtime_state (
  key text primary key,
  counter_value bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.crm_runtime_state enable row level security;

create or replace function public.next_lead_manager_index(pool_size integer)
returns integer
language plpgsql
security definer
as $$
declare
  next_val bigint;
begin
  if pool_size is null or pool_size <= 0 then
    return 0;
  end if;

  insert into public.crm_runtime_state (key, counter_value, updated_at)
  values ('lead_manager_rr', 0, now())
  on conflict (key) do update
    set counter_value = public.crm_runtime_state.counter_value + 1,
        updated_at = now()
  returning counter_value into next_val;

  return (next_val % pool_size)::integer;
end;
$$;

revoke all on function public.next_lead_manager_index(integer) from public, anon, authenticated;
grant execute on function public.next_lead_manager_index(integer) to service_role;
