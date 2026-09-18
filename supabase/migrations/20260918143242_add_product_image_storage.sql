-- Permite que el Worker de Cloudflare cree registros mediante la clave de
-- servicio. La columna sigue aceptando un usuario cuando se usa Supabase Auth.
alter table public.records
  alter column owner_id drop not null;

-- Contenedor privado para las fotografías de productos.
-- Las imágenes se entregan únicamente a través del Worker; la clave de
-- servicio nunca se expone en el navegador.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'product-images',
  'product-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
