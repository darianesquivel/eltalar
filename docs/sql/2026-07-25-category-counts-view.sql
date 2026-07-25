-- Contadores de negocios por rubro, en UNA sola consulta.
--
-- Antes la home y la guía los calculaban con ~25 consultas HEAD en paralelo
-- (una por rubro). Con eso el TTFB de esas dos páginas se iba a 1,4-2,2 s
-- mientras que las páginas sin contadores respondían en 0,22 s.
--
-- La vista respeta la RLS del que consulta (security_invoker), así que el
-- público cuenta exactamente los negocios que puede ver.
--
-- Correr en el SQL Editor de Supabase.

create or replace view public.category_counts
with (security_invoker = on) as
  select
    b.barrio_id,
    c.slug,
    count(*)::int as total
  from public.businesses b
  join public.business_categories bc on bc.business_id = b.id
  join public.categories c on c.id = bc.category_id
  where b.is_active = true
  group by b.barrio_id, c.slug;

grant select on public.category_counts to anon, authenticated;

-- Índices que necesita el group by (si ya existen, no hace nada)
create index if not exists businesses_barrio_active_idx
  on public.businesses (barrio_id, is_active);

create index if not exists business_categories_category_idx
  on public.business_categories (category_id);
