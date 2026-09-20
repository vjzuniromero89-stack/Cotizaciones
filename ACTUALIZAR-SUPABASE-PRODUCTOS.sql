-- Ejecuta este archivo una sola vez en Supabase > SQL Editor.
-- Permite guardar cálculos en Productos antes de crear la cotización.

alter table public.records
  drop constraint if exists records_record_type_check;

alter table public.records
  add constraint records_record_type_check
  check (record_type in ('product', 'quote', 'order'));

alter table public.records
  alter column owner_id drop not null;

grant usage on schema public to service_role;
grant select, insert, update, delete on table public.records to service_role;
