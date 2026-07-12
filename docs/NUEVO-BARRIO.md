# Cómo dar de alta un barrio nuevo

El sistema es **multi-barrio**: una sola base de Supabase y un solo proyecto
de Vercel sirven N portales. El barrio se resuelve por el **dominio** del
request (tabla `barrios`); el admin tiene un selector arriba a la izquierda
para cambiar de barrio, y todo lo que cargues (negocios, teléfonos, avisos,
eventos, turnos) queda asociado al barrio elegido.

Requisito único (ya corrido para El Talar): `docs/sql/2026-07-12-multi-barrio.sql`.

## Checklist de alta (ej: Pacheco)

### 1. Crear el barrio en la base

En el SQL Editor de Supabase (ajustá dominio y coordenadas del centro del
barrio; el radio es el área donde el autocompletado acepta direcciones):

```sql
insert into public.barrios (slug, name, partido, domain, url, lat, lng, radius_m)
values (
  'pacheco', 'Pacheco', 'Tigre',
  'pachecoweb.com.ar', 'https://pachecoweb.com.ar',
  -34.4620, -58.6350, 6000
);
```

> El middleware cachea los barrios 5 minutos: el dominio nuevo empieza a
> responder solo, a más tardar, 5 minutos después del insert.

### 2. Apuntar el dominio al MISMO proyecto de Vercel

- Vercel → proyecto eltalar → Settings → **Domains** → Add → el dominio nuevo.
- En el registrador del dominio, configurar los DNS que indica Vercel.
- No se crea otro proyecto ni se toca ninguna variable de entorno.

### 3. Habilitar el login en el dominio nuevo

- Supabase → Authentication → **URL Configuration** → Redirect URLs →
  agregar `https://<dominio-nuevo>/app/auth`.
- Google OAuth no necesita cambios (el callback es el de Supabase, que no
  cambia por dominio).

### 4. Cargar el contenido inicial

Desde `/app/admin` (en cualquier dominio), elegir el barrio nuevo en el
**selector de la barra lateral** y cargar:

- **Teléfonos útiles** (cada barrio tiene los suyos).
- **Negocios** (con "Cargar negocio"; quedan reclamables por sus dueños).
- **Farmacias y turnos** (las farmacias son negocios del barrio con
  categoría "Farmacia").
- Las **categorías** son compartidas entre barrios: no hay que recargarlas.

### 5. Verificar

- Entrar al dominio nuevo: hero, footer y títulos deben decir el nombre del
  barrio; el listado de negocios debe estar vacío (o con lo cargado).
- `https://<dominio-nuevo>/sitemap.xml` debe listar solo URLs del dominio.
- Probar el autocompletado de direcciones al cargar un negocio: tiene que
  sugerir direcciones de la zona del barrio.

## Notas

- **Dev/preview**: localhost y las URLs `*.vercel.app` no matchean ningún
  dominio y caen al barrio default (`PUBLIC_BARRIO_SLUG`, default
  `el-talar`). Para desarrollar "como Pacheco": `PUBLIC_BARRIO_SLUG=pacheco`
  en `.env`.
- **Apagar un barrio**: `update barrios set is_active = false where slug = '…'`
  (su dominio pasa a servir el barrio default; sus datos no se tocan).
- **Límites**: todos los barrios comparten el plan Free de Supabase
  (panel "Límites del plan gratuito" del admin). Si el conjunto crece,
  el upgrade es un solo Supabase Pro para toda la red.
