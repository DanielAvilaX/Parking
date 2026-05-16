# Carpeta `supabase/functions/send-whatsapp/`

## Qué contiene

La Edge Function encargada de enviar mensajes a WhatsApp Cloud API.

## Archivo

- `index.ts`
  - valida método HTTP
  - valida sesión del usuario que invoca la función
  - lee secretos de entorno
  - soporta modo:
    - `template`
    - `text`
  - normaliza número destino
  - envía `POST` a Graph API de Meta
  - devuelve la respuesta del proveedor

## Qué espera recibir

Payload JSON con:

- `to`
- `mode`
- `text` o `templateName`
- `templateLanguageCode`
- `templateParameters`
- `metadata`

## Qué hace falta para usarla de verdad

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- templates aprobados en Meta
