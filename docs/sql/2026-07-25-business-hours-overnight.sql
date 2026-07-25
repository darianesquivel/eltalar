-- Horarios nocturnos (20:00–02:00): el filtro "Abierto ahora" de la guía
-- necesita saber si un tramo cruza la medianoche, y PostgREST no puede
-- comparar una columna contra otra en un filtro (close_time < open_time).
-- Columna generada: se calcula sola en cada insert/update, no hay que
-- tocar el panel ni los formularios.
--
-- IMPORTANTE: correr esta migración ANTES de deployar el código que la usa
-- (business.repository.ts filtra por is_overnight en /negocios?abierto=1).

alter table public.business_hours
  add column if not exists is_overnight boolean
    generated always as (close_time < open_time) stored;

-- El filtro consulta por día + tramo nocturno; este índice parcial cubre
-- la rama "abrió ayer y todavía no cerró" sin escanear toda la tabla.
create index if not exists business_hours_overnight_idx
  on public.business_hours (day_of_week)
  where is_overnight;
