-- CotizacionesChina · Esquema inicial para Supabase/PostgreSQL
-- Conserva la estructura actual de cotizaciones y órdenes, usando JSONB para
-- cajas, tarifas, totales y productos.

create extension if not exists pgcrypto;

create table if not exists public.records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  number text not null unique,
  record_type text not null check (record_type in ('quote', 'order')),
  customer_name text not null,
  phone text not null default '',
  description text not null default '',
  boxes jsonb not null default '[]'::jsonb check (jsonb_typeof(boxes) = 'array'),
  rates jsonb not null default '{}'::jsonb check (jsonb_typeof(rates) = 'object'),
  totals jsonb not null default '{}'::jsonb check (jsonb_typeof(totals) = 'object'),
  products jsonb not null default '[]'::jsonb check (jsonb_typeof(products) = 'array'),
  route text not null check (route in ('miami', 'direct')),
  total numeric(14, 2) not null default 0 check (total >= 0),
  total_boxes integer not null default 0 check (total_boxes >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'purchased', 'transit', 'delivered', 'cancelled', 'returned')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create index if not exists records_owner_type_status_idx
  on public.records (owner_id, record_type, status);

create index if not exists records_owner_created_at_idx
  on public.records (owner_id, created_at desc);

create index if not exists records_customer_name_idx
  on public.records (owner_id, lower(customer_name));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists records_set_updated_at on public.records;
create trigger records_set_updated_at
before update on public.records
for each row execute function public.set_updated_at();

alter table public.records enable row level security;

drop policy if exists "Users can read their own records" on public.records;
create policy "Users can read their own records"
on public.records for select
to authenticated
using ((select auth.uid()) = owner_id);

drop policy if exists "Users can create their own records" on public.records;
create policy "Users can create their own records"
on public.records for insert
to authenticated
with check ((select auth.uid()) = owner_id);

drop policy if exists "Users can update their own records" on public.records;
create policy "Users can update their own records"
on public.records for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "Users can delete their own records" on public.records;
create policy "Users can delete their own records"
on public.records for delete
to authenticated
using ((select auth.uid()) = owner_id);

revoke all on table public.records from anon;
grant select, insert, update, delete on table public.records to authenticated;

comment on table public.records is
  'Cotizaciones internas, cotizaciones de clientes y órdenes de CotizacionesChina.';
