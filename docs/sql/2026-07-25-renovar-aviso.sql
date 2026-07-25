-- Renovar un aviso de vecino por 30 días más.
--
-- No puede ser un UPDATE común: la policy del dueño obliga a que cualquier
-- cambio suyo deje el aviso en 'pending' (así una edición vuelve a
-- moderarse). Renovar no cambia el contenido, así que no tiene sentido
-- volver a revisarlo: va por esta función, que valida dueño y estado.
--
-- Solo se renueva lo que YA pasó por moderación (publicado o vencido); un
-- aviso rechazado no se puede revivir así.
--
-- Correr en el SQL Editor de Supabase.

create or replace function public.renovar_aviso(p_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  nueva_fecha timestamptz;
begin
  update public.classifieds
     set status = 'published',
         expires_at = now() + interval '30 days',
         published_at = coalesce(published_at, now())
   where id = p_id
     and owner_id = auth.uid()
     and status in ('published', 'expired')
  returning expires_at into nueva_fecha;

  if nueva_fecha is null then
    raise exception 'No se puede renovar este aviso';
  end if;

  return nueva_fecha;
end;
$$;

revoke all on function public.renovar_aviso(uuid) from public;
grant execute on function public.renovar_aviso(uuid) to authenticated;
