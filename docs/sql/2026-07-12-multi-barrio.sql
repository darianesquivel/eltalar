-- ============================================================
-- MULTI-BARRIO: una sola base para N portales de barrio.
--
--  - Tabla `barrios`: identidad de cada portal (nombre, dominio,
--    centro geográfico para el autocompletado y el mapa).
--  - Columna `barrio_id` en las tablas de contenido, backfill con
--    El Talar y NOT NULL.
--  - El slug de negocios pasa a ser único POR BARRIO (dos barrios
--    pueden tener "kiosco-central").
--
--  pharmacy_turns NO lleva barrio_id: referencia a businesses y el
--  barrio viene implícito por la farmacia.
--
--  Correr en el SQL Editor de Supabase.
-- ============================================================

create table if not exists public.barrios (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,                    -- "el-talar"
  name text not null,                           -- "El Talar"
  partido text not null default 'Tigre',
  domain text not null unique,                  -- "eltalar.com.ar" (sin https)
  url text not null,                            -- "https://eltalar.com.ar"
  lat double precision not null,
  lng double precision not null,
  radius_m integer not null default 6000,       -- sesgo del autocompletado
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.barrios enable row level security;

drop policy if exists "barrios_public_read" on public.barrios;
create policy "barrios_public_read" on public.barrios
  for select using (is_active = true);

-- Seed: el barrio original
insert into public.barrios (slug, name, partido, domain, url, lat, lng, radius_m)
values (
  'el-talar', 'El Talar', 'Tigre',
  'eltalar.com.ar', 'https://eltalar.com.ar',
  -34.4716, -58.655, 6000
)
on conflict (slug) do nothing;

-- barrio_id en las tablas de contenido + backfill + índice
do $$
declare
  v_barrio uuid;
  t text;
begin
  select id into v_barrio from public.barrios where slug = 'el-talar';

  foreach t in array array[
    'businesses', 'events', 'site_alerts', 'directory_entries', 'contact_messages'
  ] loop
    execute format(
      'alter table public.%I add column if not exists barrio_id uuid references public.barrios(id)',
      t
    );
    execute format('update public.%I set barrio_id = $1 where barrio_id is null', t)
      using v_barrio;
    execute format('alter table public.%I alter column barrio_id set not null', t);
    execute format(
      'create index if not exists %I on public.%I (barrio_id)',
      t || '_barrio_idx', t
    );
  end loop;
end $$;

-- Slug de negocio único por barrio (antes era único global)
alter table public.businesses drop constraint if exists businesses_slug_key;
drop index if exists public.businesses_slug_key;
create unique index if not exists businesses_barrio_slug_key
  on public.businesses (barrio_id, slug);

-- Los dueños crean negocios desde el formulario con el cliente de sesión:
-- businesses tiene grants POR COLUMNA, así que la columna nueva hay que
-- habilitarla explícitamente para INSERT (regla de docs/sql/…grant-insert…)
grant insert (barrio_id) on public.businesses to authenticated;
