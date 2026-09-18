# Configuración de Supabase y fotografías

La aplicación guarda las cotizaciones, órdenes y fotografías en Supabase. Las
fotografías se almacenan en un contenedor privado y se entregan mediante el
Worker de Cloudflare.

## 1. Ejecutar las migraciones

En Supabase abre **SQL Editor**, copia y ejecuta los archivos de
`supabase/migrations` en orden:

1. `20260918133436_create_rutasmart_schema.sql`
2. `20260918143242_add_product_image_storage.sql`

La segunda migración crea el contenedor privado `product-images` y limita cada
imagen a 5 MB.

## 2. Agregar variables en Cloudflare

En el proyecto de Cloudflare abre **Settings → Variables and Secrets** y agrega:

- `SUPABASE_URL`: URL del proyecto, por ejemplo `https://xxxx.supabase.co`.
- `SUPABASE_SERVICE_ROLE_KEY`: clave `service_role` de Supabase. Debe guardarse
  como **Secret**.

La clave `service_role` es únicamente para Cloudflare. No debe agregarse al
código del navegador, GitHub ni a variables que empiecen con `VITE_`.

## 3. Volver a desplegar

Después de guardar las variables, ejecuta un nuevo despliegue desde Cloudflare.
Al seleccionar una foto, la aplicación mostrará `Subiendo…` y luego la vista
previa del producto.

## Seguridad

Como esta aplicación contiene datos de clientes, protege el dominio con
Cloudflare Access antes de usar información real.
