# Registro de Vehículos Davinci

Aplicación web multipágina para control vehicular en un conjunto residencial, orientada a dos perfiles:

- `Guarda de seguridad`
- `Administrador`

La solución está construida con:

- `HTML`
- `CSS`
- `JavaScript`
- `Supabase` como autenticación, base de datos y RLS

## Qué incluye

- Login con correo y contraseña
- Recuperación de contraseña con Supabase
- Página rápida de portería para búsqueda por placa
- Registro de residentes
- Registro de visitantes
- Registro de ingresos y salidas de visitantes
- Soporte para salida sin ingreso previo con alerta visible para el administrador
- Solicitudes/novedades del guarda hacia el administrador
- Panel administrativo de residentes
- Panel administrativo de visitantes
- Dashboard con métricas de visitantes
- Gestión de guardas desde la app
- Configuración de tema claro/oscuro
- Persistencia de tema en navegador
- Modo claro/oscuro automático según la hora del dispositivo
- Auditoría de cambios en base de datos

## Estructura del proyecto

```text
assets/
admin/
guard/
js/
  config/
  core/
  data/
  pages/
  services/
  ui/
settings/
sql/
styles/
index.html
README.md
```

## Arquitectura por capas

### `views`

Las vistas HTML están separadas por página:

- [index.html](/c:/Andres/Programacion/Parking/index.html)
- [guard/index.html](/c:/Andres/Programacion/Parking/guard/index.html)
- [guard/register-resident.html](/c:/Andres/Programacion/Parking/guard/register-resident.html)
- [guard/register-visitor.html](/c:/Andres/Programacion/Parking/guard/register-visitor.html)
- [admin/index.html](/c:/Andres/Programacion/Parking/admin/index.html)
- [admin/visitors.html](/c:/Andres/Programacion/Parking/admin/visitors.html)
- [admin/dashboard.html](/c:/Andres/Programacion/Parking/admin/dashboard.html)
- [admin/requests.html](/c:/Andres/Programacion/Parking/admin/requests.html)
- [admin/guards.html](/c:/Andres/Programacion/Parking/admin/guards.html)
- [settings/index.html](/c:/Andres/Programacion/Parking/settings/index.html)

### `core`

Lógica transversal reutilizable:

- configuración de rutas y roles
- utilidades
- tema dinámico
- cliente Supabase
- helpers del DOM

### `data`

Acceso a datos y RPC:

- consultas a tablas
- funciones SQL expuestas por Supabase
- adaptadores de acceso por dominio

### `services`

Reglas de negocio:

- autenticación
- gestión de residentes
- gestión de visitantes
- métricas
- solicitudes
- gestión de guardas

### `ui`

Comportamientos compartidos de interfaz:

- topbar
- notificaciones
- modales

## Flujos principales

### Guarda

1. Busca una placa.
2. Si es residente, el sistema muestra información resumida y detalle expandible.
3. Si es visitante, el sistema muestra el historial y permite registrar ingreso, salida o novedad.
4. Si no existe, el sistema permite registrar residente o visitante.

### Administrador

1. Revisa residentes con filtros por torre, propietario, apartamento, placa y teléfono.
2. Revisa visitantes con filtros e histórico.
3. Consulta solicitudes del guarda.
4. Gestiona cuentas de guardas.
5. Consulta métricas del día o por rango.

### Tablas principales

- `user_profiles`
- `apartments`
- `residents`
- `resident_phones`
- `resident_apartments`
- `resident_vehicles`
- `visitor_vehicles`
- `visitor_access_logs`
- `change_requests`
- `audit_logs`

### Reglas importantes del esquema

- Un residente puede tener varios apartamentos.
- Un apartamento puede tener varios residentes.
- Un residente puede tener varios teléfonos.
- Un residente puede tener varios vehículos.
- Una placa de residente no puede existir al mismo tiempo como visitante.
- Los apartamentos válidos están limitados a:
  - torres `1` a `6`
  - pisos `1` a `6`
  - apartamentos `101-104`, `201-204`, `301-304`, `401-404`, `501-504`, `601-604`
- Los históricos de visitantes conservan snapshots de nombres, teléfonos y apartamento del momento del registro.

## Administrador inicial

El SQL ya incluye la siembra del primer administrador con estas credenciales:

- correo: `danielo57097@gmail.com`
- contraseña: `Santiago570x_o`

Después podrás cambiar las credenciales desde la app en `Configuración`.

## Integración con Supabase

La configuración del frontend está en:

- [js/config/runtime-config.js](/c:/Andres/Programacion/Parking/js/config/runtime-config.js)

Actualmente usa:

- `project URL`: `https://iptyxsewwcyoatuiigma.supabase.co`
- `anon key`: la que nos compartiste

### Importante

- La `anon key` es pública por diseño y sí puede estar en frontend.
- No se usa `service_role` en el navegador.
- La gestión de guardas se resuelve con funciones SQL privilegiadas controladas por rol administrador.
- Los administradores solo se crean o eliminan por SQL manual, no desde la app.

## Cómo ejecutar el SQL

1. Abre tu proyecto de Supabase.
2. Ve a `SQL Editor`.
3. Ejecuta completo el contenido de [sql/parking_schema.sql](/c:/Andres/Programacion/Parking/sql/parking_schema.sql).
4. Verifica que se hayan creado:
   - tablas
   - políticas
   - funciones
   - apartamentos
   - administrador inicial

## Despliegue en Vercel

Este proyecto es estático del lado frontend, así que puedes desplegarlo directamente.

### Opción simple

1. Sube este repositorio a GitHub.
2. En Vercel, crea un nuevo proyecto importando ese repositorio.
3. No necesitas framework específico.
4. Deja el despliegue como estático.
5. Publica.

### Qué revisar después del despliegue

- que las rutas multipágina carguen correctamente
- que Supabase permita el dominio de Vercel
- que la recuperación de contraseña funcione con el `Site URL` configurado en Supabase Auth

## Configuración recomendada en Supabase

En `Authentication > URL Configuration` revisa:

- `Site URL` apuntando a tu dominio de Vercel
- `Redirect URLs` incluyendo:
  - tu dominio principal
  - `/index.html`

Para recuperación de contraseña, Supabase debe conocer el dominio final desde el que se abre la app.

## Assets reemplazables

Puedes reemplazar los archivos dentro de [assets/README.md](/c:/Andres/Programacion/Parking/assets/README.md):

- `logo-placeholder.png`
- `login-background-placeholder.svg`
- `guard-background-placeholder.svg`

La interfaz ya trae animaciones y filtros para transición entre claro y oscuro.

## Observaciones de esta primera entrega

- La edición administrativa de residentes y visitantes quedó funcional, pero prioriza claridad y mantenibilidad sobre complejidad visual extrema.
- Las solicitudes del guarda se manejan como un único módulo con estados `pending`, `approved` y `rejected`.
- La sesión del guarda persiste entre aperturas porque usa almacenamiento persistente.
- La sesión del administrador se conserva solo en sesión del navegador.
