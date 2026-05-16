# Carpeta `js/ui/`

## Qué contiene

Utilidades de interfaz compartidas.

## Archivos

- `layout.js`
  - monta la topbar
  - decide navegación según rol
  - muestra logo, nombre del sistema y botón de cierre de sesión

- `modal.js`
  - abre formularios modales
  - muestra confirmaciones
  - soporta modales temporales anidados
  - expone `closeAllModals()` para cerrar todo al confirmar una acción

- `notifications.js`
  - muestra toasts temporales por tono

- `renderers.js`
  - contiene render helpers antiguos o reutilizables para resúmenes de residentes y visitantes

## Observación

La mayoría del render principal hoy vive en `pages/`, pero `ui/` concentra los elementos reutilizables de experiencia de usuario.
