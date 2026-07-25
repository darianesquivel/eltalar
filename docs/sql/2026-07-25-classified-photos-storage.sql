-- Políticas de Storage para las fotos de los avisos de vecinos.
--
-- El bucket `classified-photos` ya está creado (público, 10 MB, solo
-- imágenes). Falta la RLS de storage.objects: cada vecino sube dentro de
-- una carpeta con su propio id de usuario, así nadie puede pisar ni borrar
-- las fotos de otro.
--
-- Mismo criterio que business-photos: lectura pública (el bucket es
-- público) y escritura acotada por carpeta.
--
-- Correr en el SQL Editor de Supabase.

-- Subir: solo logueado y solo dentro de su propia carpeta
drop policy if exists "classified_photos_insert" on storage.objects;
create policy "classified_photos_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'classified-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Borrar: la propia, o cualquiera si es admin (moderación)
drop policy if exists "classified_photos_delete" on storage.objects;
create policy "classified_photos_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'classified-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

-- Reemplazar la propia (por si vuelve a subir la misma ruta)
drop policy if exists "classified_photos_update" on storage.objects;
create policy "classified_photos_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'classified-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
