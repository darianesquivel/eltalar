-- Reseñas de vecinos en las fichas de negocio.
--
-- Decisiones:
--  * Hace falta estar logueado para reseñar (Google, que ya está integrado):
--    sin cuenta no hay forma de frenar la reseña falsa ni el spam del
--    competidor de enfrente.
--  * Se moderan antes de publicarse (status = 'pending'). El vecino ve su
--    reseña recién cuando un admin la aprueba desde el panel.
--  * rating_avg / rating_count viven DESNORMALIZADOS en businesses: la
--    grilla los necesita sin join. Los mantiene el trigger de más abajo.
--
-- Correr en el SQL Editor de Supabase.

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  -- Si el usuario borra su cuenta, la reseña queda pero pierde el dueño
  author_id uuid references auth.users (id) on delete set null,
  author_name text not null,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  status text not null default 'pending'
    check (status in ('pending', 'published', 'rejected')),
  created_at timestamptz not null default now()
);

-- Una reseña por persona y por negocio (si la quiere cambiar, la edita)
create unique index if not exists reviews_one_per_user
  on public.reviews (business_id, author_id)
  where author_id is not null;

-- La ficha lee las publicadas de un negocio, de la más nueva a la más vieja
create index if not exists reviews_business_idx
  on public.reviews (business_id, status, created_at desc);

-- La cola de moderación lee las pendientes de todo el sitio
create index if not exists reviews_moderation_idx
  on public.reviews (status, created_at desc);

alter table public.businesses
  add column if not exists rating_avg numeric(2, 1),
  add column if not exists rating_count integer not null default 0;

/* =======================
   RLS
======================= */

alter table public.reviews enable row level security;

-- Público: solo las publicadas
drop policy if exists "reviews_public_read" on public.reviews;
create policy "reviews_public_read" on public.reviews
  for select using (status = 'published');

-- El autor ve las suyas aunque estén pendientes
drop policy if exists "reviews_author_read" on public.reviews;
create policy "reviews_author_read" on public.reviews
  for select to authenticated using (author_id = auth.uid());

-- Escribir: solo logueado, en nombre propio y siempre como pendiente.
-- El status no se puede elegir desde el cliente.
drop policy if exists "reviews_author_insert" on public.reviews;
create policy "reviews_author_insert" on public.reviews
  for insert to authenticated
  with check (author_id = auth.uid() and status = 'pending');

-- Editarla mientras todavía no se publicó
drop policy if exists "reviews_author_update" on public.reviews;
create policy "reviews_author_update" on public.reviews
  for update to authenticated
  using (author_id = auth.uid() and status = 'pending')
  with check (author_id = auth.uid() and status = 'pending');

drop policy if exists "reviews_author_delete" on public.reviews;
create policy "reviews_author_delete" on public.reviews
  for delete to authenticated using (author_id = auth.uid());

-- Los admins ven y moderan todo (mismo patrón que el resto del panel)
drop policy if exists "reviews_admin_all" on public.reviews;
create policy "reviews_admin_all" on public.reviews
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.reviews to anon, authenticated;
grant insert, update, delete on public.reviews to authenticated;

/* =======================
   PROMEDIO DESNORMALIZADO
======================= */

-- Recalcula el promedio de UN negocio sobre sus reseñas publicadas.
-- SECURITY DEFINER porque el vecino que inserta la reseña no tiene permiso
-- para escribir en businesses.
create or replace function public.refresh_business_rating(p_business_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.businesses b
     set rating_count = coalesce(stats.count, 0),
         rating_avg = stats.avg
    from (
      select count(*)::int as count,
             round(avg(rating)::numeric, 1) as avg
        from public.reviews
       where business_id = p_business_id
         and status = 'published'
    ) as stats
   where b.id = p_business_id;
$$;

create or replace function public.reviews_refresh_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- En un UPDATE que cambia de negocio hay que recalcular los dos
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.refresh_business_rating(old.business_id);
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    perform public.refresh_business_rating(new.business_id);
  end if;

  return null;
end;
$$;

drop trigger if exists reviews_refresh_rating_trg on public.reviews;
create trigger reviews_refresh_rating_trg
  after insert or update or delete on public.reviews
  for each row execute function public.reviews_refresh_rating();

-- Backfill por si ya hubiera reseñas cargadas a mano
update public.businesses b
   set rating_count = coalesce(stats.count, 0),
       rating_avg = stats.avg
  from (
    select business_id,
           count(*)::int as count,
           round(avg(rating)::numeric, 1) as avg
      from public.reviews
     where status = 'published'
     group by business_id
  ) as stats
 where b.id = stats.business_id;
