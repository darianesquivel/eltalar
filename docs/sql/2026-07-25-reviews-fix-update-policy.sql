-- Parche de la migración de reseñas (2026-07-25-reviews.sql).
--
-- La policy de UPDATE original exigía status = 'pending' también en el USING,
-- así que el vecino no podía corregir una reseña YA PUBLICADA: la fila
-- quedaba fuera de la policy y el update no tocaba nada (sin error).
--
-- Con este cambio puede editar siempre la suya, pero la reseña editada vuelve
-- a la cola de moderación (el WITH CHECK sigue forzando 'pending').
--
-- Correr en el SQL Editor de Supabase, después de 2026-07-25-reviews.sql.

drop policy if exists "reviews_author_update" on public.reviews;
create policy "reviews_author_update" on public.reviews
  for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid() and status = 'pending');
