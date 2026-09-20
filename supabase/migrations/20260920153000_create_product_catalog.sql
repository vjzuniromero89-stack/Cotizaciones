-- Catálogo permanente de productos de CotizacionesChina.
create table if not exists public.catalog_products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  image_url text not null default '',
  unit_price numeric(14, 4) not null default 0 check (unit_price >= 0),
  default_quantity numeric(14, 2) not null default 1 check (default_quantity >= 0),
  boxes jsonb not null default '[]'::jsonb check (jsonb_typeof(boxes) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists catalog_products_name_idx
  on public.catalog_products (lower(name));

drop trigger if exists catalog_products_set_updated_at on public.catalog_products;
create trigger catalog_products_set_updated_at
before update on public.catalog_products
for each row execute function public.set_updated_at();

alter table public.catalog_products enable row level security;
revoke all on table public.catalog_products from anon, authenticated;
grant select, insert, update, delete on table public.catalog_products to service_role;

comment on table public.catalog_products is
  'Catálogo permanente con foto, precio y cajas propias de cada producto.';
