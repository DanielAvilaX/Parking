# Carpeta `sql/`

## Qué contiene

La documentación y los scripts SQL disponibles en este workspace.

## Estado importante

En este repositorio **no existe** un archivo maestro `parking_schema.sql` confiable.  
Por eso la documentación de base actual se reconstruyó con:

- los scripts de migración de portería ya ejecutados
- las tablas y columnas consumidas por el frontend
- las RPC y políticas inferidas desde la app actual

## Archivos

- `01_porteria_fase1_estructura.sql`
  - migración incremental ejecutada sobre el esquema existente
  - agrega:
    - `apartment_phone_numbers`
    - `resident_access_logs`
    - `porter_orders`
    - `contact_action_logs`
  - amplía `visitor_access_logs`
  - crea índices, triggers y políticas RLS adicionales

- `02_porteria_fase1_validacion.sql`
  - script de verificación posterior a la migración
  - no modifica datos
  - sirve para revisar tablas nuevas, columnas nuevas, teléfonos por apartamento y conteos base

- `03_porteria_fase2_preservar_historial.sql`
  - cambia las FK de `resident_access_logs` y `visitor_access_logs` de `on delete cascade` a `on delete set null`
  - hace nullable las columnas afectadas
  - garantiza que el historial operativo se preserva aun cuando se elimina el residente, su vehículo o el vehículo visitante original
  - los snapshots (`resident_name_snapshot`, `apartment_snapshots`, `visitor_name`, `plate_display`, etc.) son la fuente de verdad para la auditoría

- `README_MIGRACION_PORTERIA.md`
  - explica por qué se eligió migración incremental
  - describe el orden de ejecución y cómo actuar si algo falla

- `ESQUEMA_ACTUAL.md`
  - documento técnico del esquema actual usado por la app
  - resume tablas, columnas, relaciones, snapshots y permisos operativos

## Cómo usar esta carpeta

### Si ya ejecutaste la migración

Usa `ESQUEMA_ACTUAL.md` como referencia funcional.

### Si necesitas revisar lo ejecutado

1. abre `01_porteria_fase1_estructura.sql`
2. confirma en Supabase qué partes ya están aplicadas
3. usa `02_porteria_fase1_validacion.sql` como checklist

## Recomendación

No uses esta carpeta como si fuera un esquema base recreable de cero.  
Úsala como:

- referencia operativa
- documentación de migración
- base para futuras migraciones incrementales
