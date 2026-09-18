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

## 2. Agregar variables de compilación en Cloudflare

En el proyecto de Cloudflare abre **Settings → Variables and Secrets** y agrega:

- `SUPABASE_URL`: URL del proyecto, por ejemplo `https://xxxx.supabase.co`.
- `SUPABASE_SECRET_KEY`: copia el valor `SUPABASE_SECRET_KEY` que comienza con
  `sb_secret_`. Debe guardarse como **Secret**.

La clave secreta es únicamente para Cloudflare. No debe agregarse al
código del navegador, GitHub ni a variables que empiecen con `VITE_`.

## 3. Configurar y volver a desplegar

En **Build configuration**, puedes conservar estos comandos:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`

Después de guardar, ejecuta un nuevo despliegue desde Cloudflare. Durante la
compilación, la aplicación transfiere automáticamente ambas variables al Worker
como secretos de ejecución sin mostrar sus valores en el código ni en el
registro.

Al seleccionar una foto, la aplicación mostrará `Subiendo…` y luego la vista
previa del producto.

## Seguridad

Como esta aplicación contiene datos de clientes, protege el dominio con
Cloudflare Access antes de usar información real.
