-- =========================================================
-- FASE 1 - ESTRUCTURA BASE DE PORTERIA
-- Ejecutar en Supabase SQL Editor
-- No elimina datos actuales
-- =========================================================

create extension if not exists pgcrypto;

-- =========================================================
-- FUNCIONES AUXILIARES
-- =========================================================

create or replace function public.touch_updated_at_porteria()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.normalize_phone_porteria()
returns trigger
language plpgsql
as $$
begin
  if new.phone is not null then
    new.phone_normalized = regexp_replace(new.phone, '\D', '', 'g');
  end if;

  if to_jsonb(new) ? 'updated_at' then
    new.updated_at = now();
  end if;

  return new;
end;
$$;

-- =========================================================
-- NUMEROS DE CONTACTO POR APARTAMENTO
-- =========================================================

create table if not exists public.apartment_phone_numbers (
  id uuid primary key default gen_random_uuid(),
  apartment_id uuid not null references public.apartments(id) on delete cascade,
  phone text not null,
  phone_normalized text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists apartment_phone_numbers_apartment_phone_uidx
  on public.apartment_phone_numbers(apartment_id, phone_normalized);

create unique index if not exists apartment_phone_numbers_primary_uidx
  on public.apartment_phone_numbers(apartment_id)
  where is_primary;

create index if not exists apartment_phone_numbers_phone_idx
  on public.apartment_phone_numbers(phone_normalized);

drop trigger if exists apartment_phone_numbers_before_write on public.apartment_phone_numbers;
create trigger apartment_phone_numbers_before_write
before insert or update on public.apartment_phone_numbers
for each row
execute function public.normalize_phone_porteria();

-- Backfill inicial desde telefonos actuales de residentes
insert into public.apartment_phone_numbers (
  apartment_id,
  phone,
  phone_normalized,
  is_primary
)
select distinct
  ra.apartment_id,
  rp.phone,
  coalesce(nullif(rp.phone_normalized, ''), regexp_replace(rp.phone, '\D', '', 'g')),
  false
from public.resident_apartments ra
join public.resident_phones rp
  on rp.resident_id = ra.resident_id
where rp.phone is not null
  and trim(rp.phone) <> ''
on conflict (apartment_id, phone_normalized) do update
set phone = excluded.phone,
    updated_at = now();

-- =========================================================
-- HISTORIAL DE INGRESO / SALIDA DE RESIDENTES
-- =========================================================

create table if not exists public.resident_access_logs (
  id uuid primary key default gen_random_uuid(),
  resident_id uuid not null references public.residents(id) on delete cascade,
  resident_vehicle_id uuid not null references public.resident_vehicles(id) on delete cascade,
  plate_display text not null,
  plate_normalized text not null,
  resident_name_snapshot text not null,
  apartment_snapshots jsonb not null default '[]'::jsonb,
  primary_apartment_phone_snapshot text null,
  entry_at timestamptz null,
  exit_at timestamptz null,
  entry_missing boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint resident_access_logs_apartment_snapshots_is_array
    check (jsonb_typeof(apartment_snapshots) = 'array')
);

create index if not exists resident_access_logs_plate_idx
  on public.resident_access_logs(plate_normalized);

create index if not exists resident_access_logs_resident_idx
  on public.resident_access_logs(resident_id);

create index if not exists resident_access_logs_vehicle_idx
  on public.resident_access_logs(resident_vehicle_id);

create index if not exists resident_access_logs_entry_idx
  on public.resident_access_logs(entry_at desc nulls last);

create index if not exists resident_access_logs_exit_idx
  on public.resident_access_logs(exit_at desc nulls last);

create index if not exists resident_access_logs_open_idx
  on public.resident_access_logs(resident_vehicle_id)
  where entry_at is not null and exit_at is null;

drop trigger if exists resident_access_logs_touch_updated_at on public.resident_access_logs;
create trigger resident_access_logs_touch_updated_at
before update on public.resident_access_logs
for each row
execute function public.touch_updated_at_porteria();

-- =========================================================
-- AJUSTES A HISTORIAL DE VISITANTES PARA ANUNCIO / NO INGRESO
-- =========================================================

alter table public.visitor_access_logs
  add column if not exists announced_at timestamptz null,
  add column if not exists no_entry_at timestamptz null,
  add column if not exists primary_apartment_phone_snapshot text null;

create index if not exists visitor_access_logs_announced_idx
  on public.visitor_access_logs(announced_at desc nulls last);

create index if not exists visitor_access_logs_no_entry_idx
  on public.visitor_access_logs(no_entry_at desc nulls last);

create index if not exists visitor_access_logs_plate_idx
  on public.visitor_access_logs(plate_normalized);

create index if not exists visitor_access_logs_entry_missing_idx
  on public.visitor_access_logs(entry_missing);

-- Backfill: todo ingreso historico previo se considera anunciado
update public.visitor_access_logs
set announced_at = coalesce(announced_at, entry_at)
where announced_at is null
  and entry_at is not null;

-- =========================================================
-- PEDIDOS EN PORTERIA
-- =========================================================

create table if not exists public.porter_orders (
  id uuid primary key default gen_random_uuid(),
  apartment_id uuid not null references public.apartments(id) on delete restrict,
  status text not null default 'in_porteria_unnotified',
  resident_names_snapshot text[] not null default '{}'::text[],
  apartment_phones_snapshot text[] not null default '{}'::text[],
  principal_phone_snapshot text null,
  notification_count integer not null default 0,
  last_notified_phone text null,
  last_notification_message text null,
  received_at timestamptz not null default now(),
  notified_at timestamptz null,
  delivered_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint porter_orders_status_chk
    check (status in ('in_porteria_unnotified', 'notified_in_porteria', 'delivered'))
);

create index if not exists porter_orders_apartment_idx
  on public.porter_orders(apartment_id);

create index if not exists porter_orders_status_idx
  on public.porter_orders(status);

create index if not exists porter_orders_received_idx
  on public.porter_orders(received_at desc);

drop trigger if exists porter_orders_touch_updated_at on public.porter_orders;
create trigger porter_orders_touch_updated_at
before update on public.porter_orders
for each row
execute function public.touch_updated_at_porteria();

-- =========================================================
-- LOG GENERAL DE CONTACTOS
-- =========================================================

create table if not exists public.contact_action_logs (
  id uuid primary key default gen_random_uuid(),
  action_type text not null,
  context_type text not null,
  apartment_id uuid null references public.apartments(id) on delete set null,
  resident_id uuid null references public.residents(id) on delete set null,
  visitor_vehicle_id uuid null references public.visitor_vehicles(id) on delete set null,
  porter_order_id uuid null references public.porter_orders(id) on delete set null,
  plate_display text null,
  plate_normalized text null,
  target_name text null,
  phone text not null,
  phone_normalized text not null,
  is_primary_phone boolean not null default false,
  message_text text null,
  initiated_by uuid null references auth.users(id) on delete set null,
  initiated_by_role text null,
  created_at timestamptz not null default now(),
  constraint contact_action_logs_action_type_chk
    check (action_type in ('call', 'whatsapp')),
  constraint contact_action_logs_context_type_chk
    check (context_type in ('resident', 'visitor', 'order', 'general')),
  constraint contact_action_logs_initiated_by_role_chk
    check (initiated_by_role in ('admin', 'guard') or initiated_by_role is null)
);

create index if not exists contact_action_logs_created_idx
  on public.contact_action_logs(created_at desc);

create index if not exists contact_action_logs_apartment_idx
  on public.contact_action_logs(apartment_id);

create index if not exists contact_action_logs_phone_idx
  on public.contact_action_logs(phone_normalized);

create index if not exists contact_action_logs_context_idx
  on public.contact_action_logs(context_type, action_type);

drop trigger if exists contact_action_logs_normalize_phone on public.contact_action_logs;
create trigger contact_action_logs_normalize_phone
before insert or update on public.contact_action_logs
for each row
execute function public.normalize_phone_porteria();

-- =========================================================
-- RLS Y PERMISOS PARA TABLAS NUEVAS
-- =========================================================

alter table public.apartment_phone_numbers enable row level security;
alter table public.resident_access_logs enable row level security;
alter table public.porter_orders enable row level security;
alter table public.contact_action_logs enable row level security;

grant select, insert, update, delete on public.apartment_phone_numbers to authenticated;
grant select, insert, update, delete on public.resident_access_logs to authenticated;
grant select, insert, update, delete on public.porter_orders to authenticated;
grant select, insert, update, delete on public.contact_action_logs to authenticated;

drop policy if exists apartment_phone_numbers_staff_select on public.apartment_phone_numbers;
create policy apartment_phone_numbers_staff_select
on public.apartment_phone_numbers
for select
to authenticated
using (private.is_staff());

drop policy if exists apartment_phone_numbers_staff_insert on public.apartment_phone_numbers;
create policy apartment_phone_numbers_staff_insert
on public.apartment_phone_numbers
for insert
to authenticated
with check (private.is_staff());

drop policy if exists apartment_phone_numbers_staff_update on public.apartment_phone_numbers;
create policy apartment_phone_numbers_staff_update
on public.apartment_phone_numbers
for update
to authenticated
using (private.is_staff())
with check (private.is_staff());

drop policy if exists apartment_phone_numbers_staff_delete on public.apartment_phone_numbers;
create policy apartment_phone_numbers_staff_delete
on public.apartment_phone_numbers
for delete
to authenticated
using (private.is_staff());

drop policy if exists resident_access_logs_staff_select on public.resident_access_logs;
create policy resident_access_logs_staff_select
on public.resident_access_logs
for select
to authenticated
using (private.is_staff());

drop policy if exists resident_access_logs_staff_insert on public.resident_access_logs;
create policy resident_access_logs_staff_insert
on public.resident_access_logs
for insert
to authenticated
with check (private.is_staff());

drop policy if exists resident_access_logs_staff_update on public.resident_access_logs;
create policy resident_access_logs_staff_update
on public.resident_access_logs
for update
to authenticated
using (private.is_staff())
with check (private.is_staff());

drop policy if exists resident_access_logs_staff_delete on public.resident_access_logs;
create policy resident_access_logs_staff_delete
on public.resident_access_logs
for delete
to authenticated
using (private.is_staff());

drop policy if exists porter_orders_staff_select on public.porter_orders;
create policy porter_orders_staff_select
on public.porter_orders
for select
to authenticated
using (private.is_staff());

drop policy if exists porter_orders_staff_insert on public.porter_orders;
create policy porter_orders_staff_insert
on public.porter_orders
for insert
to authenticated
with check (private.is_staff());

drop policy if exists porter_orders_staff_update on public.porter_orders;
create policy porter_orders_staff_update
on public.porter_orders
for update
to authenticated
using (private.is_staff())
with check (private.is_staff());

drop policy if exists porter_orders_staff_delete on public.porter_orders;
create policy porter_orders_staff_delete
on public.porter_orders
for delete
to authenticated
using (private.is_staff());

drop policy if exists contact_action_logs_staff_select on public.contact_action_logs;
create policy contact_action_logs_staff_select
on public.contact_action_logs
for select
to authenticated
using (private.is_staff());

drop policy if exists contact_action_logs_staff_insert on public.contact_action_logs;
create policy contact_action_logs_staff_insert
on public.contact_action_logs
for insert
to authenticated
with check (private.is_staff());

drop policy if exists contact_action_logs_staff_update on public.contact_action_logs;
create policy contact_action_logs_staff_update
on public.contact_action_logs
for update
to authenticated
using (private.is_staff())
with check (private.is_staff());

drop policy if exists contact_action_logs_staff_delete on public.contact_action_logs;
create policy contact_action_logs_staff_delete
on public.contact_action_logs
for delete
to authenticated
using (private.is_staff());

-- =========================================================
-- POLITICAS ADICIONALES PARA TABLAS EXISTENTES
-- Estas politicas no reemplazan las actuales.
-- Solo agregan permisos nuevos para la fase de porteria.
-- =========================================================

grant select, insert, update on public.residents to authenticated;
grant select, insert, update, delete on public.resident_phones to authenticated;
grant select, insert, update, delete on public.resident_apartments to authenticated;
grant select, insert, update, delete on public.resident_vehicles to authenticated;
grant select, insert, update, delete on public.visitor_vehicles to authenticated;
grant select, insert, update, delete on public.visitor_access_logs to authenticated;

drop policy if exists residents_staff_select_phase1 on public.residents;
create policy residents_staff_select_phase1
on public.residents
for select
to authenticated
using (private.is_staff());

drop policy if exists residents_staff_insert_phase1 on public.residents;
create policy residents_staff_insert_phase1
on public.residents
for insert
to authenticated
with check (private.is_staff());

drop policy if exists residents_staff_update_phase1 on public.residents;
create policy residents_staff_update_phase1
on public.residents
for update
to authenticated
using (private.is_staff())
with check (private.is_staff());

drop policy if exists residents_admin_delete_phase1 on public.residents;
create policy residents_admin_delete_phase1
on public.residents
for delete
to authenticated
using (private.is_admin());

drop policy if exists resident_phones_staff_select_phase1 on public.resident_phones;
create policy resident_phones_staff_select_phase1
on public.resident_phones
for select
to authenticated
using (private.is_staff());

drop policy if exists resident_phones_staff_insert_phase1 on public.resident_phones;
create policy resident_phones_staff_insert_phase1
on public.resident_phones
for insert
to authenticated
with check (private.is_staff());

drop policy if exists resident_phones_staff_update_phase1 on public.resident_phones;
create policy resident_phones_staff_update_phase1
on public.resident_phones
for update
to authenticated
using (private.is_staff())
with check (private.is_staff());

drop policy if exists resident_phones_staff_delete_phase1 on public.resident_phones;
create policy resident_phones_staff_delete_phase1
on public.resident_phones
for delete
to authenticated
using (private.is_staff());

drop policy if exists resident_apartments_staff_select_phase1 on public.resident_apartments;
create policy resident_apartments_staff_select_phase1
on public.resident_apartments
for select
to authenticated
using (private.is_staff());

drop policy if exists resident_apartments_staff_insert_phase1 on public.resident_apartments;
create policy resident_apartments_staff_insert_phase1
on public.resident_apartments
for insert
to authenticated
with check (private.is_staff());

drop policy if exists resident_apartments_staff_update_phase1 on public.resident_apartments;
create policy resident_apartments_staff_update_phase1
on public.resident_apartments
for update
to authenticated
using (private.is_staff())
with check (private.is_staff());

drop policy if exists resident_apartments_staff_delete_phase1 on public.resident_apartments;
create policy resident_apartments_staff_delete_phase1
on public.resident_apartments
for delete
to authenticated
using (private.is_staff());

drop policy if exists resident_vehicles_staff_select_phase1 on public.resident_vehicles;
create policy resident_vehicles_staff_select_phase1
on public.resident_vehicles
for select
to authenticated
using (private.is_staff());

drop policy if exists resident_vehicles_staff_insert_phase1 on public.resident_vehicles;
create policy resident_vehicles_staff_insert_phase1
on public.resident_vehicles
for insert
to authenticated
with check (private.is_staff());

drop policy if exists resident_vehicles_staff_update_phase1 on public.resident_vehicles;
create policy resident_vehicles_staff_update_phase1
on public.resident_vehicles
for update
to authenticated
using (private.is_staff())
with check (private.is_staff());

drop policy if exists resident_vehicles_staff_delete_phase1 on public.resident_vehicles;
create policy resident_vehicles_staff_delete_phase1
on public.resident_vehicles
for delete
to authenticated
using (private.is_staff());

drop policy if exists visitor_vehicles_staff_select_phase1 on public.visitor_vehicles;
create policy visitor_vehicles_staff_select_phase1
on public.visitor_vehicles
for select
to authenticated
using (private.is_staff());

drop policy if exists visitor_vehicles_staff_insert_phase1 on public.visitor_vehicles;
create policy visitor_vehicles_staff_insert_phase1
on public.visitor_vehicles
for insert
to authenticated
with check (private.is_staff());

drop policy if exists visitor_vehicles_staff_update_phase1 on public.visitor_vehicles;
create policy visitor_vehicles_staff_update_phase1
on public.visitor_vehicles
for update
to authenticated
using (private.is_staff())
with check (private.is_staff());

drop policy if exists visitor_vehicles_staff_delete_phase1 on public.visitor_vehicles;
create policy visitor_vehicles_staff_delete_phase1
on public.visitor_vehicles
for delete
to authenticated
using (private.is_staff());

drop policy if exists visitor_access_logs_staff_select_phase1 on public.visitor_access_logs;
create policy visitor_access_logs_staff_select_phase1
on public.visitor_access_logs
for select
to authenticated
using (private.is_staff());

drop policy if exists visitor_access_logs_staff_insert_phase1 on public.visitor_access_logs;
create policy visitor_access_logs_staff_insert_phase1
on public.visitor_access_logs
for insert
to authenticated
with check (private.is_staff());

drop policy if exists visitor_access_logs_staff_update_phase1 on public.visitor_access_logs;
create policy visitor_access_logs_staff_update_phase1
on public.visitor_access_logs
for update
to authenticated
using (private.is_staff())
with check (private.is_staff());

drop policy if exists visitor_access_logs_staff_delete_phase1 on public.visitor_access_logs;
create policy visitor_access_logs_staff_delete_phase1
on public.visitor_access_logs
for delete
to authenticated
using (private.is_staff());
