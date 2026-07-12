-- Job diario: apagar destacados cuyo período pagado ya venció.
--
-- Va de la mano con el cambio en el webhook de Mercado Pago: cancelar la
-- suscripción ya NO quita el destacado al instante — el comerciante pagó
-- el mes y lo conserva hasta `featured_until`. Este job es quien apaga los
-- vencidos, y de paso cubre webhooks perdidos (MP caído, deploy justo en
-- ese momento, etc.).
--
-- Los destacados puestos A MANO por el admin (estrellita, featured_until
-- en null) no se tocan: no vencen nunca hasta que el admin los saque.
--
-- Usa pg_cron (extensión oficial de Supabase). Corre todos los días a las
-- 03:17 UTC (00:17 de Argentina). cron.schedule con el mismo nombre es
-- idempotente: re-correr este script solo actualiza el job.
--
-- Correr en el SQL Editor de Supabase.

create extension if not exists pg_cron;

select cron.schedule(
  'expirar-destacados',
  '17 3 * * *',
  $$
  update public.businesses
     set is_featured = false,
         plan = 'free',
         featured_until = null
   where is_featured = true
     and featured_until is not null
     and featured_until < now()
  $$
);

-- Para verificar que quedó agendado:
--   select jobname, schedule, active from cron.job;
-- Para ver las últimas corridas:
--   select * from cron.job_run_details order by start_time desc limit 5;
