-- Avisos de vecinos (clasificados del barrio).
--
-- Reglas del producto, que también se muestran en la UI:
--  * Solo vecinos del barrio, no es un clasificado nacional.
--  * Si sos comercio, tu lugar es la guía de negocios (y es gratis).
--  * Los avisos vencen a los 30 días.
--  * Nada de armas, medicamentos ni reventa de entradas.
--
-- Se puede publicar con cuenta o sin cuenta: sin cuenta el aviso entra por
-- /api/avisos (honeypot + validación) con la service role, así que la tabla
-- NO tiene policy de insert para anónimos. Todo aviso nace 'pending' y lo
-- publica un admin.
--
-- Correr en el SQL Editor de Supabase.

create table if not exists public.classifieds (
  id uuid primary key default gen_random_uuid(),
  barrio_id uuid not null references public.barrios (id) on delete cascade,
  -- null = publicado sin cuenta
  owner_id uuid references auth.users (id) on delete set null,
  category text not null
    check (category in ('venta', 'servicios', 'pedidos', 'empleo', 'mascotas')),
  title text not null,
  description text,
  -- Texto libre a propósito: "$85.000", "A convenir", "Gratis"
  price_text text,
  whatsapp text,
  author_name text not null,
  photo_url text,
  status text not null default 'pending'
    check (status in ('pending', 'published', 'rejected', 'expired')),
  published_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now()
);

-- El feed público: barrio + estado, del más nuevo al más viejo
create index if not exists classifieds_feed_idx
  on public.classifieds (barrio_id, status, published_at desc);

-- La cola de moderación
create index if not exists classifieds_moderation_idx
  on public.classifieds (status, created_at desc);

/* =======================
   RLS
======================= */

alter table public.classifieds enable row level security;

-- Público: solo publicados y todavía vigentes
drop policy if exists "classifieds_public_read" on public.classifieds;
create policy "classifieds_public_read" on public.classifieds
  for select using (status = 'published' and expires_at > now());

-- El autor ve los suyos aunque estén pendientes o vencidos
drop policy if exists "classifieds_owner_read" on public.classifieds;
create policy "classifieds_owner_read" on public.classifieds
  for select to authenticated using (owner_id = auth.uid());

-- Publicar con cuenta: en nombre propio y siempre como pendiente
drop policy if exists "classifieds_owner_insert" on public.classifieds;
create policy "classifieds_owner_insert" on public.classifieds
  for insert to authenticated
  with check (owner_id = auth.uid() and status = 'pending');

-- Editar el propio: vuelve a la cola de moderación
drop policy if exists "classifieds_owner_update" on public.classifieds;
create policy "classifieds_owner_update" on public.classifieds
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and status = 'pending');

drop policy if exists "classifieds_owner_delete" on public.classifieds;
create policy "classifieds_owner_delete" on public.classifieds
  for delete to authenticated using (owner_id = auth.uid());

-- Admins: ven y moderan todo (mismo patrón que el resto del panel)
drop policy if exists "classifieds_admin_all" on public.classifieds;
create policy "classifieds_admin_all" on public.classifieds
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.classifieds to anon, authenticated;
grant insert, update, delete on public.classifieds to authenticated;

/* =======================
   VENCIMIENTO
======================= */

-- Los avisos vencen a los 30 días. El feed público ya filtra por expires_at,
-- así que esto es solo prolijidad para la cola del admin: se puede llamar
-- desde un cron de Supabase (igual que expirar-destacados).
create or replace function public.expirar_avisos()
returns void
language sql
security definer
set search_path = public
as $$
  update public.classifieds
     set status = 'expired'
   where status = 'published'
     and expires_at <= now();
$$;

revoke all on function public.expirar_avisos() from public;
