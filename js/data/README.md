# Carpeta `js/data/`

## Qué contiene

Repositorios de acceso a datos y RPC. Aquí no debería vivir lógica de negocio; solo consultas, inserciones, actualizaciones y borrados.

## Archivos

- `auth.repository.js`
  - obtiene el perfil actual autenticado desde `user_profiles`

- `repository-helpers.js`
  - utilidades para repositorios:
    - aplicar filtros `IN`
    - lanzar errores de Supabase

- `residents.repository.js`
  - acceso a:
    - `residents`
    - `resident_phones`
    - `resident_vehicles`
    - `resident_apartments`
    - `apartments`
  - también sincroniza teléfonos, apartamentos y vehículos

- `visitors.repository.js`
  - acceso a:
    - `visitor_vehicles`
    - `visitor_access_logs`

- `resident-access.repository.js`
  - acceso a `resident_access_logs`

- `apartment-phones.repository.js`
  - acceso a `apartment_phone_numbers`
  - permite upsert, limpieza y cambio de principal

- `orders.repository.js`
  - acceso a `porter_orders`

- `contact-actions.repository.js`
  - acceso a `contact_action_logs`
  - soporta filtros por contexto, placa y rango de fechas

- `requests.repository.js`
  - acceso a `change_requests`

- `guards.repository.js`
  - invoca RPC SQL administrativas:
    - `list_guard_accounts`
    - `create_guard_account`
    - `update_guard_account`
    - `reset_guard_password`
    - `delete_guard_account`

- `dashboard.repository.js`
  - reúne datasets base para el dashboard
  - no calcula métricas, solo trae snapshot

## Cómo funciona

Los controladores no llaman a `data/` directamente salvo casos muy básicos. El camino esperado es:

`page -> service -> repository`
