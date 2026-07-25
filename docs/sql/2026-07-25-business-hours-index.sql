-- Índice que le faltaba a business_hours.
--
-- Medido contra producción, pidiendo 24 negocios de la guía:
--   negocios solos ............ 0,11 s
--   + categorías .............. 0,14 s
--   + fotos ................... 0,12 s
--   + ofertas ................. 0,12 s
--   + horarios ................ 1,32 s   <-- acá estaba el problema
--
-- La tabla tiene ~11.000 filas (1.568 negocios x 7 días) y no tenía índice
-- por business_id: cada consulta con horarios embebidos la recorría entera.
-- El índice compuesto sirve para los dos accesos que hacemos: traer la
-- semana de un negocio (ficha) y el día de hoy de todos (mapa, home).
--
-- Correr en el SQL Editor de Supabase.

create index if not exists business_hours_business_idx
  on public.business_hours (business_id, day_of_week);

-- Mismo criterio para las otras tablas hijas que se embeben en los
-- listados: si ya tienen índice, estas líneas no hacen nada.
create index if not exists business_photos_business_idx
  on public.business_photos (business_id);

create index if not exists business_offers_business_idx
  on public.business_offers (business_id, expires_at);

create index if not exists business_categories_business_idx
  on public.business_categories (business_id);

-- Deja las estadísticas al día para que el planner use los índices nuevos
analyze public.business_hours;
analyze public.business_photos;
analyze public.business_offers;
analyze public.business_categories;
