-- Ocultar / volver a mostrar un negocio APROBADO desde el panel admin,
-- sin tocar su estado de moderación (status queda "approved").
-- Mismo patrón que admin_set_business_status / admin_set_featured:
-- SECURITY DEFINER + chequeo de is_admin(), porque los grants por columna
-- no dejan que un usuario común escriba is_active.
--
-- Correr en el SQL Editor de Supabase.

create or replace function public.admin_set_business_active(
  p_business_id uuid,
  p_active boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo admins pueden cambiar la visibilidad';
  end if;

  update public.businesses
     set is_active = p_active
   where id = p_business_id;
end;
$$;

revoke all on function public.admin_set_business_active(uuid, boolean) from public;
grant execute on function public.admin_set_business_active(uuid, boolean) to authenticated;
