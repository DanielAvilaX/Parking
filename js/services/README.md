# Carpeta `js/services/`

## Qué contiene

La lógica de negocio del proyecto. Aquí se cruzan validaciones, reglas operativas, snapshots, composición de datos y acciones de dominio.

## Archivos

- `auth.service.js`
  - login, logout, recuperación de contraseña, validación de sesión y actualización de credenciales propias

- `resident.service.js`
  - arma residentes completos para UI
  - crea y actualiza residentes con teléfonos, apartamentos y vehículos
  - registra ingresos y salidas de residentes
  - gestiona históricos de residentes

- `visitor.service.js`
  - arma visitantes completos para UI
  - registra visitante
  - anuncia visitante
  - registra ingreso
  - registra salida
  - marca `no ingresó`
  - actualiza históricos y visitante principal

- `apartment-contact.service.js`
  - sincroniza teléfonos de apartamento a partir de teléfonos de residentes
  - obtiene contexto de contacto por apartamento
  - define el número principal
  - asegura que exista principal cuando aplique

- `contact.service.js`
  - arma mensajes de contacto
  - construye `tel:` y `wa.me`
  - registra llamadas y WhatsApp manual en `contact_action_logs`
  - expone texto de alerta cuando un apartamento no tiene principal

- `order.service.js`
  - crea y actualiza pedidos
  - refresca snapshots
  - marca entrega
  - registra notificación manual por WhatsApp

- `request.service.js`
  - crea solicitudes, incidencias y novedades
  - cambia estados
  - elimina solicitudes

- `guard-admin.service.js`
  - fachada simple sobre RPC de guardas

- `history.service.js`
  - transforma históricos de residentes y visitantes a filas listas para tabla

- `dashboard.service.js`
  - convierte snapshot bruto en métricas agregadas y series para gráficos

## Cómo funciona

`services/` es la capa que entiende el dominio de portería.  
Ejemplo:

1. `pages/guard-search.page.js` pide `searchResidentByPlate`
2. `resident.service.js` hidrata teléfonos, apartamentos, vehículos e históricos
3. `resident.service.js` usa varios repositorios de `data/`
4. la página recibe un objeto ya listo para renderizar
