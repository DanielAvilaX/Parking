# Carpeta `supabase/`

## Qué contiene

La documentación y la estructura base de Edge Functions para integraciones externas, especialmente WhatsApp.

## Archivos

- `README_WHATSAPP_EDGE_FUNCTIONS.md`
  - guía paso a paso para configurar Meta, secretos y despliegue de funciones

- `.gitignore`
  - evita versionar archivos de entorno locales de funciones

## Subcarpetas

- [functions/README.md](./functions/README.md)

## Estado actual

### Ya existe

- estructura base para `send-whatsapp`
- estructura base para `whatsapp-webhook`
- ejemplo de `.env`

### Aún falta conectar en producción

- crear app de Meta
- obtener token permanente
- obtener phone number id
- desplegar funciones en Supabase
- verificar webhook
- conectar la UI del proyecto con la Edge Function

## Recomendación de lectura

1. lee primero este archivo
2. luego abre [README_WHATSAPP_EDGE_FUNCTIONS.md](./README_WHATSAPP_EDGE_FUNCTIONS.md)
3. después revisa [functions/README.md](./functions/README.md)
