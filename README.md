# Registro de Vehículos Davinci

Aplicación web multipágina para **gestión operativa de portería** en un conjunto residencial. El proyecto empezó como control de parqueadero, pero su alcance actual ya cubre residentes, visitantes, históricos, pedidos, contactos y preparación para notificaciones automáticas por WhatsApp.

## Resumen funcional

La aplicación resuelve estos procesos:

- autenticación con Supabase Auth
- control por roles `admin` y `guard`
- búsqueda rápida por placa en portería
- registro y edición de residentes
- registro y edición de visitantes
- anuncios de visitantes
- ingresos y salidas de visitantes
- ingresos y salidas de residentes
- salidas sin ingreso previo, con alerta visible
- historial operativo consolidado
- registro y gestión de pedidos en portería
- llamadas y WhatsApp manual con trazabilidad
- solicitudes, novedades e incidencias del guarda
- administración de cuentas de guardas
- dashboard operativo
- tema claro/oscuro automático o manual
- preparación de Edge Functions para WhatsApp automático

## Stack técnico

- `HTML` multipágina
- `CSS` modular
- `JavaScript` con módulos ES
- `Supabase` para Auth, base de datos, RPC y RLS
- `Chart.js` para dashboard
- `Supabase Edge Functions` preparadas para WhatsApp Cloud API

## Estado actual

### Ya funciona

- login y recuperación de contraseña
- sesión persistente para guardas
- sesión de navegador para administradores
- control de acceso por roles
- búsqueda operativa por placa
- edición de residentes y visitantes
- control de número principal por apartamento
- registro de llamadas y acciones de WhatsApp manual
- histórico de movimientos de residentes y visitantes
- módulo de pedidos
- módulo de solicitudes
- gestión de guardas
- dashboard ampliado a portería
- estructura base de Edge Functions

### Aún no está conectado automáticamente

- envío real de WhatsApp desde Edge Functions
- procesamiento de eventos de entrega/lectura del webhook de Meta

La estructura para esto ya existe en [supabase/README.md](./supabase/README.md) y [supabase/README_WHATSAPP_EDGE_FUNCTIONS.md](./supabase/README_WHATSAPP_EDGE_FUNCTIONS.md).

## Roles y permisos actuales

### Guarda

- puede consultar residentes, visitantes, históricos y pedidos
- puede registrar anuncios, ingresos y salidas
- puede editar residentes, visitantes y movimientos históricos
- puede eliminar movimientos históricos
- puede crear, editar y eliminar pedidos
- puede abrir llamada y WhatsApp manual
- puede registrar solicitudes, novedades e incidencias
- no puede eliminar residentes
- no puede administrar administradores

### Administrador

- tiene todo lo del guarda
- además puede eliminar residentes
- puede gestionar visitantes y guardas
- puede aprobar, rechazar y eliminar solicitudes
- puede administrar dashboard y configuraciones administrativas

## Mapa de páginas

- [index.html](./index.html): login, recuperación y actualización de contraseña por enlace
- [guard/index.html](./guard/index.html): búsqueda operativa por placa
- [guard/register-resident.html](./guard/register-resident.html): alta de residentes desde portería
- [guard/register-visitor.html](./guard/register-visitor.html): alta de visitantes desde portería
- [admin/index.html](./admin/index.html): listado administrativo de residentes
- [admin/visitors.html](./admin/visitors.html): listado administrativo de visitantes
- [admin/dashboard.html](./admin/dashboard.html): métricas operativas
- [admin/requests.html](./admin/requests.html): solicitudes, incidencias y novedades
- [admin/guards.html](./admin/guards.html): gestión de cuentas de guardas
- [history/index.html](./history/index.html): historial operativo con tabs de residentes y visitantes
- [orders/index.html](./orders/index.html): pedidos de portería
- [settings/index.html](./settings/index.html): tema y credenciales propias

## Arquitectura por capas

La carpeta [js/README.md](./js/README.md) documenta la arquitectura completa. Resumen:

- `config/`: configuración de despliegue
- `core/`: utilidades base, rutas, tema, storage, cliente Supabase
- `data/`: repositorios y acceso directo a tablas/RPC
- `services/`: reglas de negocio y orquestación
- `pages/`: controladores de cada vista HTML
- `ui/`: topbar, modales, notificaciones y render helpers

## Estructura del proyecto

```text
admin/
assets/
guard/
history/
js/
orders/
settings/
sql/
styles/
supabase/
index.html
README.md
```

### Documentación por carpeta

- [admin/README.md](./admin/README.md)
- [assets/README.md](./assets/README.md)
- [guard/README.md](./guard/README.md)
- [history/README.md](./history/README.md)
- [js/README.md](./js/README.md)
- [orders/README.md](./orders/README.md)
- [settings/README.md](./settings/README.md)
- [sql/README.md](./sql/README.md)
- [styles/README.md](./styles/README.md)
- [supabase/README.md](./supabase/README.md)

## Base de datos actual

La documentación de base de datos quedó aquí:

- [sql/README.md](./sql/README.md)
- [sql/README_MIGRACION_PORTERIA.md](./sql/README_MIGRACION_PORTERIA.md)
- [sql/ESQUEMA_ACTUAL.md](./sql/ESQUEMA_ACTUAL.md)
- [sql/01_porteria_fase1_estructura.sql](./sql/01_porteria_fase1_estructura.sql)
- [sql/02_porteria_fase1_validacion.sql](./sql/02_porteria_fase1_validacion.sql)

Importante:

- en este workspace **no existe** un `parking_schema.sql` maestro confiable
- el estado actual se documenta como **esquema referencial reconstruido**
- la app ya quedó migrada con la fase incremental ejecutada en Supabase

## Integración con Supabase

La configuración de frontend vive en [js/config/runtime-config.js](./js/config/runtime-config.js).

Valores actuales:

- `SUPABASE_URL`: `https://iptyxsewwcyoatuiigma.supabase.co`
- `SUPABASE_ANON_KEY`: configurada en runtime

Notas:

- la `anon key` sí puede vivir en frontend
- la `service_role key` nunca debe ir al navegador
- la gestión de guardas depende de RPC SQL privilegiadas
- los administradores se crean por SQL manual, no desde la app

## WhatsApp y Edge Functions

La documentación completa quedó separada para que puedas seguirla por fases:

- [supabase/README.md](./supabase/README.md)
- [supabase/README_WHATSAPP_EDGE_FUNCTIONS.md](./supabase/README_WHATSAPP_EDGE_FUNCTIONS.md)

Ahí se explica:

- cómo preparar Meta
- cómo crear templates
- cómo configurar secretos
- cómo desplegar funciones
- cómo verificar el webhook

## Cómo probar la app

### 1. Flujo de autenticación

- iniciar sesión como admin
- iniciar sesión como guarda
- probar recuperación de contraseña
- validar persistencia de sesión del guarda

### 2. Flujo de residentes

- registrar residente nuevo
- agregar varios teléfonos
- validar que el primer teléfono quede principal si no existía uno
- editar residente y cambiar el principal
- registrar ingreso y salida
- registrar salida sin ingreso y validar alerta

### 3. Flujo de visitantes

- registrar visitante nuevo
- anunciar visitante
- registrar ingreso con anuncio previo
- registrar ingreso sin usar el botón anunciar
- registrar salida
- marcar `no ingresó`
- editar histórico
- eliminar histórico

### 4. Flujo de contactos

- abrir llamada desde residente
- abrir WhatsApp desde residente
- abrir llamada desde visitante
- abrir WhatsApp desde visitante
- verificar alerta si el apartamento no tiene número principal

### 5. Flujo de pedidos

- crear pedido
- llamar al apartamento
- abrir WhatsApp manual
- marcar pedido como notificado
- marcar pedido como entregado
- editar y eliminar pedido

### 6. Flujo administrativo

- filtrar residentes
- filtrar visitantes
- revisar solicitudes
- aprobar, rechazar y eliminar solicitudes
- crear y editar guardas
- resetear contraseña de guarda

### 7. Historial y dashboard

- abrir `Historial > Residentes`
- abrir `Historial > Visitantes`
- usar filtros por placa, apartamento, torre, estado y fechas
- revisar dashboard con distintos rangos

## Despliegue

### Frontend

Se despliega como sitio estático. Puedes usar Vercel directamente.

### Backend

Depende de:

- Supabase Auth
- Supabase Database
- RLS
- RPC SQL
- Edge Functions para WhatsApp

## Observaciones operativas

- la aplicación usa `storage` por rol para diferenciar persistencia de sesión
- el número principal es una política por apartamento, no por residente
- los históricos usan snapshots para preservar el contexto del momento
- las llamadas y acciones de WhatsApp manual se registran en base de datos
- la integración automática de WhatsApp aún requiere que tú completes la configuración en Meta y Supabase

## Recomendación de uso documental

Si vas a tocar algo del sistema, sigue este orden:

1. lee este README
2. revisa el README de la carpeta afectada
3. revisa [sql/ESQUEMA_ACTUAL.md](./sql/ESQUEMA_ACTUAL.md) si el cambio toca datos
4. revisa [supabase/README.md](./supabase/README.md) si el cambio toca funciones o WhatsApp
