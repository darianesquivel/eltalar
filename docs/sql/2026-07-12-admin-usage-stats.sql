-- Uso del proyecto vs límites del plan Free de Supabase, para el panel
-- "Límites del plan gratuito" del dashboard admin:
--   - db_bytes: tamaño de la base (límite Free: 500 MB)
--   - storage_bytes: total de archivos subidos, fotos (límite Free: 1 GB)
--   - mau: usuarios que iniciaron sesión en los últimos 30 días (límite: 50.000)
--   - total_users: cuentas registradas (informativo)
--
-- SECURITY DEFINER porque lee storage.objects y auth.users, que no son
-- accesibles para usuarios comunes; exige is_admin() como los otros RPCs.
--
-- Correr en el SQL Editor de Supabase.

create or replace function public.admin_usage_stats()
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo admins pueden ver el uso del proyecto';
  end if;

  return json_build_object(
    'db_bytes', pg_database_size(current_database()),
    'storage_bytes', coalesce(
      (select sum((metadata->>'size')::bigint) from storage.objects),
      0
    ),
    'mau', (
      select count(*) from auth.users
      where last_sign_in_at > now() - interval '30 days'
    ),
    'total_users', (select count(*) from auth.users)
  );
end;
$$;

revoke all on function public.admin_usage_stats() from public;
grant execute on function public.admin_usage_stats() to authenticated;
