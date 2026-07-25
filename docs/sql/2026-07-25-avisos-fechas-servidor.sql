-- Fechas de publicación con el reloj del SERVIDOR.
--
-- Al aprobar un aviso, el panel calculaba published_at y expires_at con
-- new Date() en el navegador del admin: una compu con la hora corrida
-- cambiaba cuándo vencen los avisos de los vecinos. Ahora las pone la base
-- en el momento de la transición a 'published', gane quien gane en el
-- payload del update.
--
-- Correr en el SQL Editor de Supabase (después de classifieds-harden).

create or replace function public.classifieds_publish_dates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Solo en la transición a publicado (aprobar o re-aprobar): publicar
  -- reinicia los 30 días. La renovación del vecino (RPC renovar_aviso)
  -- no cambia el status, así que no pasa por acá.
  if new.status = 'published' and old.status is distinct from 'published' then
    new.published_at := now();
    new.expires_at := now() + interval '30 days';
  end if;
  return new;
end;
$$;

drop trigger if exists classifieds_publish_dates on public.classifieds;
create trigger classifieds_publish_dates
  before update on public.classifieds
  for each row execute function public.classifieds_publish_dates();
