# Portería 360

Aplicación web para la gestión operativa de portería en conjuntos residenciales:
control de residentes y visitantes, pedidos, historial de movimientos, y
comunicación (llamada/WhatsApp) entre guardas, residentes y administración.

## Funcionalidades

- Autenticación con roles diferenciados (`admin` y `guarda`), cada uno con su
  propio nivel de acceso.
- Búsqueda rápida por placa desde portería, con registro de ingresos y
  salidas de residentes y visitantes.
- Anuncio de visitantes y alerta visible cuando se registra una salida sin
  ingreso previo.
- Gestión de pedidos: creación, notificación al residente y seguimiento hasta
  la entrega.
- Llamadas y mensajes de WhatsApp iniciados desde la app (vía `wa.me`, sin
  envío automático) con registro de la acción para trazabilidad.
- Historial operativo consolidado y dashboard con métricas por rango de
  fechas.
- Solicitudes, novedades e incidencias reportadas por el guarda, con flujo de
  aprobación para el administrador.
- Tema claro/oscuro.

## Stack técnico

HTML multipágina + JavaScript (módulos ES nativos, sin framework) + Supabase
(autenticación, base de datos, RLS y funciones RPC) + Chart.js para el
dashboard.

La arquitectura del frontend está organizada por capas:

- `core/` — utilidades base, rutas, tema, storage, cliente de Supabase.
- `data/` — repositorios y acceso a tablas/RPC.
- `services/` — reglas de negocio y orquestación.
- `pages/` — controladores de cada vista.
- `ui/` — topbar, modales, notificaciones y helpers de render.

## Credenciales y variables de entorno

Las credenciales de Supabase no viven en el código: [`js/core/supabase-client.js`](js/core/supabase-client.js)
las obtiene en tiempo de ejecución desde una función serverless de Vercel
([`api/config.js`](api/config.js)), que las lee de las variables de entorno
del proyecto:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

La `anon key` es pública por diseño (la seguridad real la dan las políticas
RLS); mantenerla fuera del repo permite rotar de proyecto sin tocar código.
La `service_role key` nunca se usa en el frontend.

## Ejecutar en local

```bash
npx serve .
```

Para probar contra Supabase en local hace falta la función de `api/`, lo más
simple es correr `npx vercel dev` en su lugar.

## Desplegar

1. Importa el repositorio en Vercel (sitio estático, sin build step; `api/`
   se detecta automáticamente como función serverless).
2. Agrega `SUPABASE_URL` y `SUPABASE_ANON_KEY` en Environment Variables.
3. Ejecuta el esquema SQL de [`sql/`](sql/) en el SQL Editor de tu proyecto de
   Supabase.
