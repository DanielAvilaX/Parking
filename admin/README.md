# Carpeta `admin/`

## Qué contiene

Entradas HTML del módulo administrativo.

## Cómo funciona

Cada archivo HTML carga:

- estilos globales desde `styles/`
- un controlador específico desde `js/pages/`
- la topbar dinámica según rol `admin`

El control de permisos se aplica en el controlador de página mediante `requireRole([APP_ROLES.ADMIN])`.

## Archivos

- `index.html`
  - página principal de residentes
  - usa `js/pages/admin-residents.page.js`
  - permite listar, filtrar, editar y eliminar residentes

- `visitors.html`
  - página administrativa de visitantes
  - usa `js/pages/admin-visitors.page.js`
  - permite filtrar, editar, eliminar, ver históricos, gestionar solicitudes y abrir contactos

- `dashboard.html`
  - panel de métricas
  - usa `js/pages/admin-dashboard.page.js`
  - muestra tráfico de residentes y visitantes, alertas, pedidos y contactos

- `requests.html`
  - módulo de solicitudes, incidencias y novedades
  - usa `js/pages/admin-requests.page.js`
  - permite aprobar, rechazar y eliminar solicitudes

- `guards.html`
  - gestión de cuentas de guardas
  - usa `js/pages/admin-guards.page.js`
  - depende de RPC SQL para crear, editar, resetear y eliminar guardas

## Flujo típico

1. el usuario admin abre una página de esta carpeta
2. el controlador valida sesión y rol
3. se monta la topbar con `activeKey` correspondiente
4. se cargan datos desde `services/`
5. se renderiza la lista o dashboard
6. las acciones abren modales, actualizan Supabase y recargan estado

## Dependencias principales

- `js/pages/`
- `js/services/`
- `js/ui/`
- `styles/`
