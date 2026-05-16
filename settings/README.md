# Carpeta `settings/`

## Qué contiene

La entrada HTML de configuración del usuario autenticado.

## Archivo

- `index.html`
  - usa `js/pages/settings.page.js`

## Qué resuelve

- cambio de preferencia visual:
  - `auto`
  - `light`
  - `dark`
- actualización de credenciales propias del administrador
- explicación operativa para guardas sobre persistencia de sesión

## Reglas importantes

- el administrador puede actualizar su correo y contraseña
- el guarda solo gestiona tema; no edita credenciales desde aquí
- el modo `auto` cambia según la hora del dispositivo

## Dependencias principales

- `js/pages/settings.page.js`
- `js/core/theme.js`
- `js/services/auth.service.js`
