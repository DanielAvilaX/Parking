# Carpeta `history/`

## Qué contiene

La entrada HTML del historial operativo unificado.

## Archivo

- `index.html`
  - usa `js/pages/history.page.js`
  - comparte navegación tanto con admin como con guard

## Qué resuelve

- historial de movimientos de residentes
- historial de movimientos de visitantes
- filtros por placa, torre, apartamento, residente, visitante, fechas, estado y alertas
- edición y eliminación de movimientos
- acción `No ingresó` para anuncios pendientes de visitantes

## Flujo

1. el controlador valida sesión
2. identifica el rol activo
3. monta topbar con `activeKey = history`
4. carga ambos datasets desde `history.service.js`
5. alterna entre tabs `residents` y `visitors`

## Dependencias principales

- `js/pages/history.page.js`
- `js/services/history.service.js`
- `js/services/resident.service.js`
- `js/services/visitor.service.js`
