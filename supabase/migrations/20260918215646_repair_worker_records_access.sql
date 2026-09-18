-- Repara instalaciones donde solo se ejecutó la migración inicial.
-- El Worker usa SUPABASE_SECRET_KEY, por lo que no existe un usuario de
-- Supabase Auth asociado a cada registro y owner_id debe aceptar NULL.
alter table public.records
  alter column owner_id drop not null;

-- El acceso sigue siendo exclusivamente del backend: la clave secreta vive
-- en Cloudflare y nunca se entrega al navegador.
grant usage on schema public to service_role;
grant select, insert, update, delete on table public.records to service_role;
