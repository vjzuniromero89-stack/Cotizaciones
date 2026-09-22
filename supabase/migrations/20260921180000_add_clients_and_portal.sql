-- Clientes con un enlace público ("casillero") para ver su historial de
-- cotizaciones sin necesidad de iniciar sesión.
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null default '',
  token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, phone)
);

create index if not exists clients_token_idx on public.clients (token);

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

alter table public.clients enable row level security;
revoke all on table public.clients from anon, authenticated;
grant select, insert, update, delete on table public.clients to service_role;

comment on table public.clients is
  'Un renglón por cliente (nombre + teléfono). El "token" arma el enlace público /portal/<token> donde el cliente ve su historial de cotizaciones, como su casillero.';
