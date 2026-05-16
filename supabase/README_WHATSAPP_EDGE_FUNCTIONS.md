# Guía Detallada Para Integrar WhatsApp Con Supabase Edge Functions

## Objetivo

Esta guía te lleva desde **cero** hasta dejar listo el backend de WhatsApp para el proyecto.

Al terminar deberías tener:

- una app en Meta
- un número de WhatsApp Business Platform
- dos templates aprobados
- secretos cargados en Supabase
- Edge Functions desplegadas
- webhook verificado

## Estado actual del proyecto

El proyecto ya tiene preparada esta base:

- [functions/send-whatsapp/index.ts](./functions/send-whatsapp/index.ts)
- [functions/whatsapp-webhook/index.ts](./functions/whatsapp-webhook/index.ts)
- [functions/.env.example](./functions/.env.example)

Todavía no están conectadas en producción porque faltan tus credenciales y la configuración en Meta.

---

## Parte 1. Qué debes entender antes de empezar

### Meta y Supabase cumplen funciones distintas

- `Meta`:
  - entrega la API de WhatsApp
  - administra el número emisor
  - administra templates
  - verifica el webhook

- `Supabase Edge Functions`:
  - recibe peticiones desde tu app
  - guarda secretos
  - hace la llamada segura a Meta
  - en el futuro podrá procesar eventos del webhook

### Vercel no participa en el envío

Tu frontend sigue en Vercel, pero el envío de WhatsApp **no debe salir del navegador**.  
Debe salir desde Supabase Edge Functions.

---

## Parte 2. Requisitos previos

Antes de seguir, necesitas:

- una cuenta de Facebook
- acceso a Meta for Developers
- una cuenta de negocio en Meta si el flujo te la pide
- un número celular que puedas verificar
- acceso a tu proyecto Supabase
- Node.js instalado para usar `npx supabase`

Referencias oficiales:

- Meta developer hub: https://whatsappbusiness.com/developers/developer-hub/
- WhatsApp Cloud API get started: https://developers.facebook.com/docs/whatsapp/cloud-api/get-started
- Supabase Edge Functions quickstart: https://supabase.com/docs/guides/functions/quickstart

---

## Parte 3. Crear la app en Meta

### Paso 1. Entrar a Meta for Developers

Abre:

- `https://developers.facebook.com/`

Inicia sesión con tu cuenta.

### Paso 2. Crear la app

En la parte superior:

- `Mis apps`
- `Crear app`

Cuando Meta te pida el tipo, elige la opción orientada a negocio o integración empresarial.

### Paso 3. Completar la información básica

Define:

- nombre de la app
- correo de contacto
- cuenta de negocio si aplica

Sugerencia:

- nombre: `Porteria Davinci`

### Paso 4. Agregar el producto WhatsApp

Dentro del panel de tu app:

- `Agregar producto`
- `WhatsApp`
- `Configurar`

Cuando termines, la app ya tendrá habilitado el módulo de WhatsApp.

---

## Parte 4. Hacer tu primera prueba en Meta

### Paso 5. Entrar a `WhatsApp > API Setup`

En esa pantalla Meta normalmente te muestra:

- un `Temporary access token`
- un `Phone number ID` de prueba
- un número de prueba de Meta
- la opción para agregar receptores de prueba

### Paso 6. Agregar tu celular como número receptor

Agrega tu número personal o de prueba.

Meta lo verificará con código.

### Paso 7. Probar el envío desde el panel de Meta

Todavía sin Supabase.

Usa el envío de prueba del propio panel y confirma que sí recibes el mensaje.

Si esto no funciona, **no sigas** todavía con Supabase.

---

## Parte 5. Pasar a un número real

### Paso 8. Definir el número que usará portería

Debes decidir qué número real usará la operación.

Recomendación:

- usa un número exclusivo para portería
- que puedas verificar por SMS o llamada

### Paso 9. Registrar el número en Meta

Dentro del producto WhatsApp busca:

- `Add phone number`
- o `Manage phone numbers`

Meta te pedirá:

- nombre para mostrar
- categoría del negocio
- datos del negocio
- número

Luego verifica el número.

### Paso 10. Guardar el `Phone Number ID`

Cuando el número quede registrado, Meta te mostrará un identificador técnico.

Ese valor será:

- `WHATSAPP_PHONE_NUMBER_ID`

Guárdalo.

---

## Parte 6. Crear el token correcto para producción

El token temporal del panel solo sirve para pruebas.  
Para producción necesitas un token más estable.

### Paso 11. Entrar a la configuración del negocio

Busca en Meta algo como:

- `Business Settings`
- `Configuración del negocio`

### Paso 12. Crear un `System User`

Ruta típica:

- `Users`
- `System Users`
- `Add`

Créalo con permisos administrativos.

### Paso 13. Asignar acceso al system user

Debes darle acceso a:

- la app de Meta que creaste
- la cuenta de WhatsApp Business correspondiente

### Paso 14. Generar el token

Dentro de ese system user:

- `Generate token`

Selecciona tu app.

Permisos recomendados:

- `whatsapp_business_messaging`
- `whatsapp_business_management`

Ese token será:

- `WHATSAPP_ACCESS_TOKEN`

Guárdalo como secreto.

---

## Parte 7. Crear los templates

Para este proyecto conviene usar templates porque el negocio inicia la conversación.

### Paso 15. Abrir la gestión de templates

En Meta o WhatsApp Manager busca:

- `Message templates`
- `Plantillas`

### Paso 16. Crear template de pedido

Nombre:

- `porteria_pedido_recibido`

Categoría:

- utilidad

Texto:

```text
Hola, te informamos desde portería que tienes un pedido recibido a tu nombre. Se encuentra disponible en portería para su recogida.
```

### Paso 17. Crear template de visitante anunciado

Nombre:

- `porteria_vehiculo_anunciado`

Categoría:

- utilidad

Texto:

```text
Hola, desde portería te informamos que el vehículo de placa {{1}} se encuentra anunciado para la Torre {{2}}, Apartamento {{3}}.
```

Parámetros:

- `{{1}}` = placa
- `{{2}}` = torre
- `{{3}}` = apartamento

### Paso 18. Esperar aprobación

No conectes todavía el envío automático con esos templates hasta que Meta los marque como aprobados.

---

## Parte 8. Preparar el token de verificación del webhook

### Paso 19. Crear tu verify token

Este valor lo inventas tú. Debe ser secreto y único.

Ejemplo:

```text
davinci_whatsapp_verify_2026_xxxxxxxxx
```

Ese valor será:

- `WHATSAPP_VERIFY_TOKEN`

No uses un texto trivial.

---

## Parte 9. Preparar Supabase CLI

### Paso 20. Instalar el CLI

Supabase recomienda usar `npx`.

Referencias:

- https://supabase.com/docs/guides/local-development/cli/getting-started?platform=npx&queryGroups=platform

Instala como dependencia de desarrollo si quieres dejarlo asociado al proyecto:

```powershell
npm install --save-dev supabase
```

### Paso 21. Inicializar Supabase localmente

Si todavía no existe configuración local:

```powershell
npx supabase init
```

---

## Parte 10. Vincular el proyecto Supabase

### Paso 22. Crear access token de Supabase

Ve a:

- `https://supabase.com/dashboard/account/tokens`

Crea un token personal.

### Paso 23. Loguearte en CLI

```powershell
npx supabase login
```

### Paso 24. Enlazar el proyecto

```powershell
npx supabase link --project-ref iptyxsewwcyoatuiigma
```

---

## Parte 11. Crear archivo de secretos local

### Paso 25. Crear `.env`

Copia:

- `supabase/functions/.env.example`

como:

- `supabase/functions/.env`

### Paso 26. Llenar las variables

Debes completar:

```env
SUPABASE_URL=https://iptyxsewwcyoatuiigma.supabase.co
SUPABASE_ANON_KEY=TU_ANON_KEY
WHATSAPP_ACCESS_TOKEN=TU_TOKEN_DE_META
WHATSAPP_PHONE_NUMBER_ID=TU_PHONE_NUMBER_ID
WHATSAPP_VERIFY_TOKEN=TU_VERIFY_TOKEN
WHATSAPP_API_VERSION=v23.0
WHATSAPP_DEFAULT_TEMPLATE_LANGUAGE=es_CO
```

---

## Parte 12. Subir secretos a Supabase

### Paso 27. Cargar secretos

```powershell
npx supabase secrets set --env-file supabase/functions/.env --project-ref iptyxsewwcyoatuiigma
```

Referencia oficial:

- https://supabase.com/docs/guides/functions/secrets

---

## Parte 13. Desplegar Edge Functions

### Paso 28. Desplegar `send-whatsapp`

```powershell
npx supabase functions deploy send-whatsapp --project-ref iptyxsewwcyoatuiigma
```

### Paso 29. Desplegar `whatsapp-webhook`

```powershell
npx supabase functions deploy whatsapp-webhook --project-ref iptyxsewwcyoatuiigma
```

Referencia oficial:

- https://supabase.com/docs/guides/functions/deploy

---

## Parte 14. Configurar el webhook en Meta

### Paso 30. Copiar la URL del webhook

La URL esperada es:

```text
https://iptyxsewwcyoatuiigma.supabase.co/functions/v1/whatsapp-webhook
```

### Paso 31. Pegarla en Meta

En la configuración de webhooks de WhatsApp:

- `Callback URL`:
  - la URL anterior
- `Verify Token`:
  - exactamente el valor de `WHATSAPP_VERIFY_TOKEN`

La función `whatsapp-webhook` responderá al `GET` de verificación.

---

## Parte 15. Qué haremos después desde la app

Cuando todo lo anterior quede listo, el siguiente paso ya me toca a mí:

1. invocar `send-whatsapp` desde `Pedidos`
2. invocar `send-whatsapp` al `Anunciar visitante`
3. guardar la respuesta del proveedor si quieres traza más detallada
4. opcionalmente procesar eventos del webhook

---

## Checklist mínimo de avance

Marca esto cuando lo tengas:

- [ ] creé la app en Meta
- [ ] agregué el producto WhatsApp
- [ ] probé el número de prueba
- [ ] agregué mi número real
- [ ] tengo el `WHATSAPP_PHONE_NUMBER_ID`
- [ ] tengo el `WHATSAPP_ACCESS_TOKEN`
- [ ] creé las plantillas
- [ ] subí secretos a Supabase
- [ ] desplegué `send-whatsapp`
- [ ] desplegué `whatsapp-webhook`
- [ ] verifiqué el webhook

---

## Si te atoras

Cuando te bloquees, dime exactamente cuál de estos puntos fue el último que lograste:

- `ya creé la app`
- `ya agregué WhatsApp`
- `ya tengo el phone number id`
- `ya tengo el access token`
- `ya creé las plantillas`
- `ya desplegué las funciones`
- `ya verifiqué el webhook`

Y desde ahí seguimos sin saltarnos pasos.
