# Esquema Actual De La Base De Datos

## Alcance del documento

Este documento describe el **esquema actual usado por la aplicación** a partir de:

- tablas consultadas por el frontend
- columnas visibles en repositorios
- migración `01_porteria_fase1_estructura.sql`

No reemplaza un `schema.sql` completo de reconstrucción desde cero, porque ese archivo no existe en este workspace.

## Módulos de datos

### 1. Autenticación y perfiles

#### `auth.users`

Gestionada por Supabase Auth.

La app depende de:

- `id`
- `email`
- `created_at`
- `updated_at`
- `last_sign_in_at`
- `banned_until`

#### `public.user_profiles`

Perfil operativo enlazado a `auth.users`.

Columnas usadas por la app:

- `id`
- `email`
- `role`
- `is_active`
- `created_at`
- `updated_at`

Relación:

- `user_profiles.id -> auth.users.id`

### 2. Catálogo físico del conjunto

#### `public.apartments`

Catálogo fijo de apartamentos válidos.

Columnas usadas:

- `id`
- `tower`
- `floor`
- `apartment_number`

Reglas operativas:

- torres válidas: `1..6`
- pisos válidos: `1..6`
- apartamentos válidos por piso: `01..04`
- ejemplos:
  - `101`
  - `204`
  - `304`
  - `604`

### 3. Residentes

#### `public.residents`

Columnas usadas:

- `id`
- `full_name`
- `created_at`
- `updated_at`

#### `public.resident_phones`

Columnas usadas:

- `id`
- `resident_id`
- `phone`
- `phone_normalized`

Relación:

- `resident_phones.resident_id -> residents.id`

#### `public.resident_apartments`

Tabla pivote entre residentes y apartamentos.

Columnas usadas:

- `id`
- `resident_id`
- `apartment_id`
- `created_at`

Relaciones:

- `resident_apartments.resident_id -> residents.id`
- `resident_apartments.apartment_id -> apartments.id`

#### `public.resident_vehicles`

Columnas usadas:

- `id`
- `resident_id`
- `plate_display`
- `plate_normalized`
- `vehicle_type`
- `created_at`

Relación:

- `resident_vehicles.resident_id -> residents.id`

Regla operativa:

- una placa de residente no debe existir al mismo tiempo como visitante activo

### 4. Visitantes

#### `public.visitor_vehicles`

Columnas usadas:

- `id`
- `plate_display`
- `plate_normalized`
- `vehicle_type`
- `last_known_name`
- `last_apartment_id`
- `created_at`
- `updated_at`

Relación:

- `visitor_vehicles.last_apartment_id -> apartments.id`

#### `public.visitor_access_logs`

Histórico de visitantes con snapshots.

Columnas usadas:

- `id`
- `visitor_vehicle_id`
- `plate_display`
- `plate_normalized`
- `visitor_name`
- `apartment_id`
- `tower_snapshot`
- `apartment_number_snapshot`
- `resident_names_snapshot`
- `apartment_phones_snapshot`
- `primary_apartment_phone_snapshot`
- `announced_at`
- `entry_at`
- `exit_at`
- `no_entry_at`
- `entry_missing`
- `created_at`
- `updated_at`

Relaciones:

- `visitor_access_logs.visitor_vehicle_id -> visitor_vehicles.id`
- `visitor_access_logs.apartment_id -> apartments.id`

Estados derivados por la app:

- `announced`
- `inside`
- `completed`
- `no-entry`
- `exit-without-entry`
- `created`

### 5. Teléfonos por apartamento

#### `public.apartment_phone_numbers`

Tabla agregada en fase de portería para consolidar teléfonos de apartamento.

Columnas:

- `id`
- `apartment_id`
- `phone`
- `phone_normalized`
- `is_primary`
- `created_at`
- `updated_at`

Relación:

- `apartment_phone_numbers.apartment_id -> apartments.id`

Reglas:

- un apartamento puede tener varios teléfonos
- solo puede haber un `is_primary = true` por apartamento
- la app alerta cuando hay teléfonos pero no hay principal

### 6. Historial de residentes

#### `public.resident_access_logs`

Histórico de ingreso/salida de residentes.

Columnas:

- `id`
- `resident_id`
- `resident_vehicle_id`
- `plate_display`
- `plate_normalized`
- `resident_name_snapshot`
- `apartment_snapshots`
- `primary_apartment_phone_snapshot`
- `entry_at`
- `exit_at`
- `entry_missing`
- `created_at`
- `updated_at`

Relaciones:

- `resident_access_logs.resident_id -> residents.id`
- `resident_access_logs.resident_vehicle_id -> resident_vehicles.id`

Estados derivados por la app:

- `inside`
- `completed`
- `exit-without-entry`
- `unknown`

### 7. Pedidos

#### `public.porter_orders`

Tabla de pedidos recibidos en portería.

Columnas:

- `id`
- `apartment_id`
- `status`
- `resident_names_snapshot`
- `apartment_phones_snapshot`
- `principal_phone_snapshot`
- `notification_count`
- `last_notified_phone`
- `last_notification_message`
- `received_at`
- `notified_at`
- `delivered_at`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`

Relaciones:

- `porter_orders.apartment_id -> apartments.id`
- `porter_orders.created_by -> auth.users.id`
- `porter_orders.updated_by -> auth.users.id`

Estados válidos:

- `in_porteria_unnotified`
- `notified_in_porteria`
- `delivered`

### 8. Historial de contactos

#### `public.contact_action_logs`

Bitácora de llamadas y acciones de WhatsApp manual.

Columnas:

- `id`
- `action_type`
- `context_type`
- `apartment_id`
- `resident_id`
- `visitor_vehicle_id`
- `porter_order_id`
- `plate_display`
- `plate_normalized`
- `target_name`
- `phone`
- `phone_normalized`
- `is_primary_phone`
- `message_text`
- `initiated_by`
- `initiated_by_role`
- `created_at`

Relaciones:

- `apartment_id -> apartments.id`
- `resident_id -> residents.id`
- `visitor_vehicle_id -> visitor_vehicles.id`
- `porter_order_id -> porter_orders.id`
- `initiated_by -> auth.users.id`

Valores válidos:

- `action_type`: `call`, `whatsapp`
- `context_type`: `resident`, `visitor`, `order`, `general`

### 9. Solicitudes / incidencias

#### `public.change_requests`

Tabla usada por el módulo de solicitudes, novedades e incidencias.

Columnas usadas:

- `id`
- `plate_display`
- `plate_normalized`
- `context_type`
- `related_record_id`
- `message`
- `status`
- `created_at`
- `updated_at`
- `resolved_at`
- `resolution_note`
- `created_by`

Estados usados:

- `pending`
- `approved`
- `rejected`

## Relaciones de alto nivel

### Residentes

- un residente puede tener varios teléfonos
- un residente puede tener varios apartamentos
- un residente puede tener varios vehículos
- un apartamento puede tener varios residentes

### Visitantes

- un vehículo visitante puede tener muchos logs históricos
- cada log guarda snapshot del apartamento, residentes y teléfonos del momento

### Contacto

- el número principal es por apartamento
- llamadas y WhatsApp manual quedan registrados en `contact_action_logs`

### Pedidos

- el pedido se asocia a un apartamento
- también guarda snapshot de residentes y teléfonos del momento

## Índices relevantes visibles en la migración

Se confirmaron índices sobre:

- `apartment_phone_numbers`
- `resident_access_logs`
- `visitor_access_logs`
- `porter_orders`
- `contact_action_logs`

Objetivos:

- búsqueda por placa
- búsquedas por estado o fechas
- detección rápida de movimientos abiertos

## RLS y permisos operativos

La app trabaja con RLS en Supabase.

### Resumen funcional

- `private.is_staff()` habilita acceso operativo para guardas y administradores
- `private.is_admin()` reserva operaciones críticas de administración

### Efecto visible en negocio

- guardas y admins pueden consultar y operar módulos de portería
- solo admin elimina residentes
- guardas y admins pueden manipular visitantes, pedidos, históricos y contactos según el flujo actual de la app

## RPC conocidas

La app usa RPC para gestión de guardas:

- `list_guard_accounts`
- `create_guard_account`
- `update_guard_account`
- `reset_guard_password`
- `delete_guard_account`

## Observación final

Este documento representa el **esquema funcional actual que la aplicación espera**.  
Si en el futuro reconstruyes un `schema.sql` maestro, este archivo debe servirte como referencia de negocio y de columnas consumidas por el frontend.
