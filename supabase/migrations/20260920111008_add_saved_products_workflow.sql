-- Agrega el estado previo a la cotización: un cálculo de producto guardado.
alter table public.records
  drop constraint if exists records_record_type_check;

alter table public.records
  add constraint records_record_type_check
  check (record_type in ('product', 'quote', 'order'));

grant usage on schema public to service_role;
grant select, insert, update, delete on table public.records to service_role;
