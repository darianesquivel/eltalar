-- Sección Eventos: tabla + RLS
-- El público solo lee eventos activos; las escrituras del admin van por
-- /api/admin/eventos con service role (valida is_admin), así que no
-- necesitan políticas propias.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  location text,
  date date not null,
  end_date date,          -- para eventos de varios días (opcional)
  start_time time,        -- "20:00" (opcional)
  end_time time,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;

drop policy if exists "eventos_public_read" on public.events;
create policy "eventos_public_read" on public.events
  for select using (is_active = true);
