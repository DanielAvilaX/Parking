# Carpeta `js/core/`

## Qué contiene

Utilidades base del sistema, independientes del dominio de portería.

## Archivos

- `constants.js`
  - define roles, estados, opciones de tema, patrones de placa y rutas
  - también define la navegación por rol

- `supabase-client.js`
  - crea el cliente Supabase
  - configura persistencia de sesión usando storage por rol

- `theme.js`
  - resuelve el tema actual
  - guarda preferencia
  - aplica modo automático según hora del dispositivo

- `storage.js`
  - diferencia la persistencia de sesión:
    - `guard` en `localStorage`
    - `admin` en `sessionStorage`
  - limpia sesiones al cerrar

- `utils.js`
  - utilidades de formato, fechas, placas, teléfonos, filtros y validaciones
  - concentra reglas como:
    - formato de placa
    - validación de apartamentos
    - normalización de teléfono

- `dom.js`
  - helpers simples para DOM:
    - `qs`
    - `qsa`
    - `fillSelect`
    - `setButtonLoading`
    - `renderEmptyState`

## Rol dentro de la arquitectura

`core/` es la base compartida que consumen todas las demás capas.
