# Carpeta `supabase/functions/`

## Qué contiene

La base de Supabase Edge Functions del proyecto.

## Archivos y carpetas

- `_shared/`
  - utilidades compartidas entre funciones

- `send-whatsapp/`
  - función para enviar mensajes a la API oficial de WhatsApp

- `whatsapp-webhook/`
  - función para verificación y recepción de eventos de webhook

- `.env.example`
  - ejemplo de variables necesarias para ejecutar o desplegar funciones

## Flujo esperado

1. definir secretos en `.env`
2. subir secretos con `supabase secrets set`
3. desplegar funciones
4. conectar webhook en Meta
5. después integrar la invocación desde la app
