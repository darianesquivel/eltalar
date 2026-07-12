-- FIX URGENTE: los usuarios logueados no podían crear negocios.
--
-- Causa: businesses tiene permisos POR COLUMNA para el rol authenticated
-- (endurecimiento deliberado: un dueño no puede tocar is_featured, status,
-- plan, etc.). Cuando se agregó la columna `services` al formulario de alta,
-- se la agregó al grant de UPDATE pero NO al de INSERT → todo INSERT del
-- formulario moría con "permission denied for table businesses".
--
-- Regla para el futuro: cada columna nueva de businesses que edite el dueño
-- debe agregarse a los grants de INSERT y UPDATE de authenticated.

grant insert (services, by_appointment), update (by_appointment)
  on public.businesses to authenticated;
