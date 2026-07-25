-- Endurecer avisos: la RLS de update solo exigía owner_id + status='pending',
-- así que un vecino hablándole directo a PostgREST (la anon key es pública)
-- podía mover su aviso a otro barrio, estirarse expires_at o apuntar
-- photo_url a una imagen externa. La validación de /api/avisos no aplica ahí:
-- estas reglas tienen que vivir en la base.
--
-- Correr en el SQL Editor de Supabase.

/* =======================
   LÍMITES DE LARGO
   (los mismos que valida /api/avisos; NOT VALID para no fallar si alguna
   fila vieja se pasara — se exigen solo en escrituras nuevas)
======================= */

alter table public.classifieds
  drop constraint if exists classifieds_title_len,
  add constraint classifieds_title_len
    check (char_length(title) <= 120) not valid;

alter table public.classifieds
  drop constraint if exists classifieds_author_len,
  add constraint classifieds_author_len
    check (char_length(author_name) <= 80) not valid;

alter table public.classifieds
  drop constraint if exists classifieds_description_len,
  add constraint classifieds_description_len
    check (description is null or char_length(description) <= 1500) not valid;

alter table public.classifieds
  drop constraint if exists classifieds_price_len,
  add constraint classifieds_price_len
    check (price_text is null or char_length(price_text) <= 40) not valid;

alter table public.classifieds
  drop constraint if exists classifieds_whatsapp_format,
  add constraint classifieds_whatsapp_format
    check (whatsapp is null or whatsapp ~ '^[0-9]{8,15}$') not valid;

/* =======================
   COLUMNAS QUE EL DUEÑO NO PUEDE TOCAR
======================= */

create or replace function public.classifieds_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- El service role (cron) y los admins (moderación) no tienen restricción
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role'
     or public.is_admin() then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- El dueño edita el contenido, no la identidad ni la vigencia del aviso
    new.barrio_id  := old.barrio_id;
    new.owner_id   := old.owner_id;
    new.created_at := old.created_at;
    new.expires_at := old.expires_at;
  end if;

  -- La foto tiene que vivir en NUESTRO bucket, en la carpeta del dueño:
  -- si no, la card del feed mostraría una imagen de cualquier otro sitio.
  if new.photo_url is not null
     and (tg_op = 'INSERT' or new.photo_url is distinct from old.photo_url)
     and new.photo_url !~ ('^https://[a-z0-9]+[.]supabase[.]co/storage/v1/object/public/classified-photos/'
                           || new.owner_id::text || '/')
  then
    raise exception 'photo_url inválida';
  end if;

  return new;
end;
$$;

drop trigger if exists classifieds_guard on public.classifieds;
create trigger classifieds_guard
  before insert or update on public.classifieds
  for each row execute function public.classifieds_guard();
