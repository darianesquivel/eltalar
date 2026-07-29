-- 1) Orden del listado público: pagos primero, después reclamados, después
--    el resto. "Reclamado" = tiene dueño (owner_id). PostgREST no puede
--    ordenar por una expresión (owner_id is not null), y ordenar por el
--    uuid crudo rompería el orden alfabético dentro del grupo: columna
--    generada, como is_overnight en business_hours.
--
-- 2) Datos del dueño para el panel admin: el email vive en auth.users, que
--    no es legible para usuarios comunes. RPC SECURITY DEFINER con chequeo
--    de is_admin(), como admin_usage_stats.
--
-- IMPORTANTE: correr esta migración ANTES de deployar el código que la usa
-- (business.repository.ts ordena por has_owner y AdminBusinesses llama al RPC).
--
-- Correr en el SQL Editor de Supabase.

alter table public.businesses
  add column if not exists has_owner boolean
    generated always as (owner_id is not null) stored;

-- Cubre el orden del listado público (destacados > reclamados > resto,
-- alfabético adentro de cada grupo) sin escanear los inactivos.
create index if not exists businesses_listing_order_idx
  on public.businesses (barrio_id, is_featured desc, has_owner desc, priority desc, name)
  where is_active = true;

-- Datos del dueño de una tanda de negocios (una llamada por página del
-- panel). claimed_at = fecha del reclamo aprobado; null cuando el dueño
-- cargó el negocio él mismo (nunca hubo reclamo) o el reclamo se limpió.
create or replace function public.admin_business_owner_info(p_business_ids uuid[])
returns table (
  business_id uuid,
  owner_email text,
  owner_name text,
  claimed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo admins pueden ver los datos del dueño';
  end if;

  return query
  select
    b.id,
    u.email::text,
    p.full_name,
    (
      select max(c.created_at)
      from public.business_claims c
      where c.business_id = b.id
        and c.user_id = b.owner_id
        and c.status = 'approved'
    )
  from public.businesses b
  join auth.users u on u.id = b.owner_id
  left join public.profiles p on p.id = b.owner_id
  where b.id = any(p_business_ids);
end;
$$;

revoke all on function public.admin_business_owner_info(uuid[]) from public;
grant execute on function public.admin_business_owner_info(uuid[]) to authenticated;
