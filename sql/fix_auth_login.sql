-- Corrige usuarios creados manualmente en auth.users
-- para evitar el error:
-- "Database error querying schema"

update auth.users
set
  confirmation_token = coalesce(confirmation_token, ''),
  email_change = coalesce(email_change, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  recovery_token = coalesce(recovery_token, '')
where lower(email) = 'danielo57097@gmail.com';

-- Si tu función private.create_auth_account ya existe,
-- recrea la inserción para que futuros usuarios no salgan dañados.

create or replace function private.create_auth_account(
  p_email text,
  p_password text,
  p_role public.app_role,
  p_is_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_user_id uuid := gen_random_uuid();
  v_email text := lower(trim(p_email));
begin
  if v_email = '' then
    raise exception 'El correo es obligatorio.';
  end if;

  if length(p_password) < 8 then
    raise exception 'La contraseña debe tener al menos 8 caracteres.';
  end if;

  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'Ya existe un usuario con ese correo.';
  end if;

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token,
    raw_app_meta_data,
    raw_user_meta_data,
    banned_until,
    created_at,
    updated_at
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    jsonb_build_object(
      'provider', 'email',
      'providers', jsonb_build_array('email'),
      'role', p_role::text,
      'is_active', p_is_active
    ),
    jsonb_build_object('email', v_email),
    case when p_is_active then null else now() + interval '100 years' end,
    now(),
    now()
  );

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    created_at,
    updated_at,
    last_sign_in_at
  )
  values (
    gen_random_uuid(),
    v_user_id,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', v_email,
      'email_verified', true
    ),
    'email',
    v_user_id::text,
    now(),
    now(),
    now()
  );

  return v_user_id;
end;
$$;

-- =========================================================
-- Corrige permisos de funciones usadas en policies RLS
-- Error típico:
-- permission denied for function is_admin
-- =========================================================

grant usage on schema private to authenticated;

grant execute on function private.current_role() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_staff() to authenticated;

-- =========================================================
-- Corrige RPC de guardas
-- Error típico:
-- structure of query does not match function result type
-- =========================================================

create or replace function public.list_guard_accounts()
returns table (
  id uuid,
  email text,
  is_active boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform private.assert_admin();

  return query
  select
    u.id::uuid,
    u.email::text,
    p.is_active::boolean,
    u.created_at::timestamptz,
    u.last_sign_in_at::timestamptz
  from auth.users u
  join public.user_profiles p on p.id = u.id
  where p.role = 'guard'
  order by u.created_at desc;
end;
$$;

create or replace function public.create_guard_account(
  p_email text,
  p_password text
)
returns table (
  id uuid,
  email text,
  is_active boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_user_id uuid;
begin
  perform private.assert_admin();
  v_user_id := private.create_auth_account(p_email, p_password, 'guard', true);

  return query
  select
    u.id::uuid,
    u.email::text,
    p.is_active::boolean,
    u.created_at::timestamptz,
    u.last_sign_in_at::timestamptz
  from auth.users u
  join public.user_profiles p on p.id = u.id
  where u.id = v_user_id;
end;
$$;

create or replace function public.update_guard_account(
  p_guard_id uuid,
  p_email text,
  p_is_active boolean
)
returns table (
  id uuid,
  email text,
  is_active boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text := lower(trim(p_email));
begin
  perform private.assert_admin();

  if not exists (
    select 1
    from public.user_profiles
    where id = p_guard_id
      and role = 'guard'
  ) then
    raise exception 'La cuenta indicada no pertenece a un guarda.';
  end if;

  if exists (
    select 1
    from auth.users
    where lower(email) = v_email
      and id <> p_guard_id
  ) then
    raise exception 'Ya existe otro usuario con ese correo.';
  end if;

  update auth.users
  set email = v_email,
      raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'guard', 'is_active', p_is_active),
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('email', v_email),
      banned_until = case when p_is_active then null else now() + interval '100 years' end,
      updated_at = now()
  where id = p_guard_id;

  update auth.identities
  set identity_data = coalesce(identity_data, '{}'::jsonb) || jsonb_build_object(
        'sub', p_guard_id::text,
        'email', v_email,
        'email_verified', true
      ),
      updated_at = now()
  where user_id = p_guard_id
    and provider = 'email';

  update public.user_profiles
  set email = v_email,
      is_active = p_is_active,
      updated_at = now()
  where id = p_guard_id;

  return query
  select
    u.id::uuid,
    u.email::text,
    p.is_active::boolean,
    u.created_at::timestamptz,
    u.last_sign_in_at::timestamptz
  from auth.users u
  join public.user_profiles p on p.id = u.id
  where u.id = p_guard_id;
end;
$$;

grant execute on function public.list_guard_accounts() to authenticated;
grant execute on function public.create_guard_account(text, text) to authenticated;
grant execute on function public.update_guard_account(uuid, text, boolean) to authenticated;
