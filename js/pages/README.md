# Carpeta `js/pages/`

## Qué contiene

Controladores de cada vista HTML.

## Archivos

- `login.page.js`
  - controla el login
  - abre la cortina del formulario
  - maneja recuperación y actualización de contraseña

- `guard-search.page.js`
  - corazón operativo de portería
  - busca placas
  - distingue residente, visitante o no registrado
  - controla anuncios, ingresos, salidas, llamadas, WhatsApp, solicitudes y edición rápida

- `guard-register-resident.page.js`
  - formulario de alta de residentes
  - soporta varios apartamentos y varios teléfonos
  - detecta residentes existentes en el primer apartamento

- `guard-register-visitor.page.js`
  - formulario de alta de visitantes
  - carga contexto del apartamento destino

- `admin-residents.page.js`
  - listado administrativo de residentes
  - filtros
  - edición
  - eliminación
  - detalle de apartamentos y contactos

- `admin-visitors.page.js`
  - listado administrativo de visitantes
  - filtros, alertas, solicitudes, históricos y contactos

- `admin-dashboard.page.js`
  - dashboard con métricas y gráficos

- `admin-requests.page.js`
  - gestión centralizada de solicitudes

- `admin-guards.page.js`
  - gestión de cuentas de guardas

- `history.page.js`
  - historial unificado con tabs
  - soporta edición y eliminación por fila

- `orders.page.js`
  - pedidos de portería
  - soporta llamada, WhatsApp, edición, entrega y eliminación

- `settings.page.js`
  - configuración de tema
  - actualización de credenciales para admin

## Patrón común

Casi todos los controladores siguen este proceso:

1. `initTheme()`
2. `requireRole(...)`
3. `mountTopbar(...)`
4. carga inicial
5. listeners de formularios o tabla
6. render
