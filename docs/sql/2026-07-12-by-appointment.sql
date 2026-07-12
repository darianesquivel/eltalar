-- Negocios que atienden con turno (peluqueros, estéticas, consultorios...):
-- en vez de cargar horarios fijos, marcan este flag y la ficha muestra
-- "Atiende con turno" en lugar del estado abierto/cerrado.
alter table public.businesses
  add column if not exists by_appointment boolean not null default false;
