# Carpeta `js/config/`

## Qué contiene

Configuración runtime del frontend.

## Archivos

- `runtime-config.js`
  - define:
    - nombre del sitio
    - URL de Supabase
    - anon key de Supabase
    - storage key de autenticación
  - es el punto de arranque de configuración que luego consume `core/supabase-client.js`

## Cómo participa en el flujo

1. el cliente Supabase lee esta configuración
2. la topbar toma el nombre del sitio desde aquí
3. el sistema de sesión usa la `authStorageKey`
