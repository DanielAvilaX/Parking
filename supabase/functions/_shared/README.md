# Carpeta `supabase/functions/_shared/`

## Qué contiene

Utilidades compartidas por varias Edge Functions.

## Archivos

- `cors.ts`
  - exporta cabeceras CORS comunes
  - evita repetir configuración en cada función

## Cómo se usa

Cada función importa `corsHeaders` para responder a:

- `OPTIONS`
- respuestas JSON
- accesos desde navegador o desde la app
