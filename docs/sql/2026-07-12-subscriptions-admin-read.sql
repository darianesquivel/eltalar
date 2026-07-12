-- El dashboard admin cuenta las "Suscripciones activas" con la sesión del
-- admin (cliente normal, no service role), y la RLS de subscriptions no
-- tenía política de lectura para admins: la card daba siempre 0.
--
-- Correr en el SQL Editor de Supabase.

drop policy if exists "subscriptions_admin_read" on public.subscriptions;
create policy "subscriptions_admin_read" on public.subscriptions
  for select using (public.is_admin());
