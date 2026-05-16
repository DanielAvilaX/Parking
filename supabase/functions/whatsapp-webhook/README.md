# Carpeta `supabase/functions/whatsapp-webhook/`

## Qué contiene

La Edge Function para verificación del webhook y recepción de eventos de Meta.

## Archivo

- `index.ts`
  - responde al `GET` de verificación usando `hub.challenge`
  - compara el token recibido contra `WHATSAPP_VERIFY_TOKEN`
  - recibe `POST` de eventos y los deja listos para procesamiento futuro

## Estado actual

Hoy la función:

- valida el webhook
- recibe payloads
- hace `console.log` del evento

## Posibles evoluciones futuras

- guardar estados de entrega
- guardar estados de lectura
- marcar errores de envío
- sincronizar notificaciones con tablas del sistema
