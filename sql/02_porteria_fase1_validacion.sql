-- =========================================================
-- FASE 1 - VALIDACION
-- Ejecutar despues de 01_porteria_fase1_estructura.sql
-- No modifica datos
-- =========================================================

-- 1. Confirmar nuevas tablas
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'apartment_phone_numbers',
    'resident_access_logs',
    'porter_orders',
    'contact_action_logs'
  )
order by table_name;

-- 2. Confirmar nuevas columnas en visitor_access_logs
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'visitor_access_logs'
  and column_name in (
    'announced_at',
    'no_entry_at',
    'primary_apartment_phone_snapshot'
  )
order by column_name;

-- 3. Ver telefonos de apartamento cargados
select
  a.tower,
  a.apartment_number,
  apn.phone,
  apn.is_primary
from public.apartment_phone_numbers apn
join public.apartments a
  on a.id = apn.apartment_id
order by a.tower, a.apartment_number, apn.phone;

-- 4. Detectar apartamentos sin numero principal
select
  a.id as apartment_id,
  a.tower,
  a.apartment_number,
  count(apn.id) as total_numbers,
  bool_or(coalesce(apn.is_primary, false)) as has_primary
from public.apartments a
left join public.apartment_phone_numbers apn
  on apn.apartment_id = a.id
group by a.id, a.tower, a.apartment_number
having count(apn.id) > 0
   and bool_or(coalesce(apn.is_primary, false)) = false
order by a.tower, a.apartment_number;

-- 5. Detectar apartamentos sin ningun telefono asociado
select
  a.id as apartment_id,
  a.tower,
  a.apartment_number
from public.apartments a
left join public.apartment_phone_numbers apn
  on apn.apartment_id = a.id
group by a.id, a.tower, a.apartment_number
having count(apn.id) = 0
order by a.tower, a.apartment_number;

-- 6. Ver conteo rapido de historicos actuales
select
  (select count(*) from public.visitor_access_logs) as visitor_logs,
  (select count(*) from public.resident_access_logs) as resident_logs,
  (select count(*) from public.porter_orders) as porter_orders,
  (select count(*) from public.contact_action_logs) as contact_logs;
