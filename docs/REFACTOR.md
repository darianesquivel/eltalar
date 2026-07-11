# El Talar — Plan de Refactor

> Documento vivo. Sirve como hoja de ruta para llevar el proyecto desde su estado
> actual (MVP funcional) a una plataforma barrial sólida, con panel de auto‑gestión
> para negocios, monetización por suscripción y mapa interactivo.
>
> Última revisión: 2026-07-11 (v2 — segunda pasada de verificación: el fallo de build
> fue reproducido ejecutando `astro build`, y se agregaron hallazgos nuevos: bug de
> zona horaria, código muerto y correcciones sobre el formulario de contacto)

---

## 0. TL;DR — Veredicto rápido

- **¿Cambiar de framework? No.** Astro es la elección correcta para este proyecto y
  no hay que reescribir todo. Lo que se necesita "en tiempo real" (que un negocio
  edite su info y se vea al instante, avisos, farmacias de turno, destacados) **no es
  realtime de verdad** — es contenido que cambia seguido. Astro con render híbrido
  (estático + SSR + revalidación) + Supabase cubre eso perfecto, y mantiene el SEO
  que te importa. Donde hace falta interactividad (filtros, panel, mapa), Astro usa
  "islas" de React. Ya lo estás haciendo.
- **El problema no es el framework, es la arquitectura interna.** Hoy hay: render mal
  distribuido (páginas que deberían ser estáticas son SSR y viceversa), datos que se
  bajan en el cliente y matan el SEO justo en la página de negocios, lógica duplicada,
  y sobre todo **falta toda la capa que hace realidad tu visión**: autenticación, panel
  del dueño de negocio, permisos (RLS), pagos y mapa.
- **Orden recomendado:** primero estabilizar y arreglar lo roto (Fase 0-1), después
  construir la capa de auto‑gestión + seguridad (Fase 2), y recién ahí monetización
  y mapa (Fase 3-4). No al revés.

---

## 1. Estado actual (diagnóstico)

### 1.1 Lo que está bien 👍

- Stack moderno y coherente: Astro 5, React 19, Tailwind 4, Supabase.
- Separación incipiente por dominios: `negocios`, `farmacias`, `telefonos`, `home`.
- Ya existe un repositorio de datos (`business.repository.ts`) — buen instinto.
- Sistema de design tokens en `global.css` (`@theme`) — prolijo.
- `.env` correctamente ignorado en git. Fuentes propias cargadas con `font-display: swap`.
- El modelo de datos en Supabase ya contempla lo importante: `businesses`,
  `categories`, `business_hours`, `business_photos`, `pharmacy_turns`, `site_alerts`,
  `contact_messages`, y campos `is_featured` / `priority` (base para monetización).

### 1.2 Problemas críticos 🔴 (rompen o bloquean)

| #   | Problema                                                                                                              | Dónde                                                              | Impacto                                                                                                                                                                                                                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | **`output: "server"` sin adapter instalado**                                                                          | `astro.config.mjs`                                                 | El build de producción **falla** (verificado: `astro build` → error `[NoAdapterInstalled]`). Astro necesita un adapter (Vercel/Node/Cloudflare) para SSR. Hoy solo funciona en `dev`.                                                                                                                                                        |
| C5  | **Bug de zona horaria en "abierto/cerrado" y turnos**                                                                 | `businessHours.ts`, `getTodayBusinessStatus.ts`, `NextTurns.astro` | Toda la lógica usa `new Date()` con la hora **del servidor**. En deploy real (Vercel/CF corren en UTC) el estado abierto/cerrado y el día de los turnos quedan corridos **3 horas** para Argentina. Hoy "funciona" solo porque `dev` corre en tu máquina. Fix: calcular con TZ explícita (`America/Argentina/Buenos_Aires`) o en el cliente. |
| C2  | **La página de negocios baja los datos en el cliente** (`BusinessGrid.client.tsx` con `client:load` + `useEffect`)    | `pages/negocios/index.astro`                                       | El listado principal **no tiene HTML en el server → Google no lo indexa bien**. Es exactamente lo contrario a por qué elegiste Astro.                                                                                                                                                                                                        |
| C3  | **Sin autenticación ni panel de administración**                                                                      | (no existe)                                                        | Toda tu visión (negocios que se cargan solos, suscripciones, destacados) depende de esto. Hoy solo se puede cargar data a mano en el dashboard de Supabase.                                                                                                                                                                                  |
| C4  | **Sin RLS / seguridad de datos** (se usa la `anon key` para insertar en `contact_messages` y potencialmente escribir) | `api/contact.ts`, `contactForm.ts`                                 | Sin Row Level Security, la anon key puede leer/escribir de más. Riesgo real cuando haya datos de negocios reales.                                                                                                                                                                                                                            |

### 1.3 Problemas importantes 🟠 (deuda que escala mal)

- **Clientes de Supabase duplicados:** `lib/supabase.ts` y `lib/supabaseClient.ts` son
  idénticos. Consolidar en uno.
- **Lógica de horarios triplicada y redundante:** `businessHours.ts` (`getBusinessStatus`),
  `getTodayBusinessStatus.ts` y `getBusinessHours.ts` hacen cosas que se pisan. Además
  el repositorio calcula el estado con `getBusinessStatus` y lo mete en el objeto, y
  después `BusinessCard` **vuelve a calcular** el estado con `getTodayBusinessStatus`.
  Doble cómputo, dos fuentes de verdad. Unificar en **un solo módulo** `lib/hours/`.
- **`any` en todo el data layer.** No hay tipos generados de Supabase. Se pierde todo
  el chequeo de tipos justo en la capa más frágil (la de datos).
- **SEO incompleto en el `<head>`:** falta `meta description`, Open Graph, canonical,
  `robots.txt`, `sitemap.xml`, `initial-scale=1` en el viewport, y **datos
  estructurados JSON‑LD `LocalBusiness`** (esto último es oro para SEO local de negocios).
- **Imágenes sin optimizar:** se usan `<img>` crudos en vez de `astro:assets` o las
  transformaciones de imagen de Supabase Storage. Fotos pesadas = peor Core Web Vitals = peor SEO.
- **Íconos SVG inline duplicados** por todos lados (teléfono, instagram, whatsapp...).
  `@lucide/astro` ya está instalado pero casi no se usa. Extraer a componentes.
- **Render mal asignado:** `telefonos` y `home` son prácticamente estáticos pero se
  sirven SSR por el `output: server` global. Deberían ser estáticos/ISR.
- **Formulario de contacto: protección solo del lado del cliente.** Ya existe un
  honeypot (campo `company` oculto en `Contact.astro`) — bien pensado — pero se chequea
  **solo en el navegador**: un bot que postee directo a `/api/contact` lo saltea. El
  endpoint tampoco valida formato de email ni tiene rate‑limit. Mover honeypot +
  validación al endpoint. (Detalle menor: si el honeypot se dispara, el botón queda
  colgado en "Enviando…" porque el `return` ocurre después de deshabilitarlo.)
- **Código muerto:** `lib/contactForm.ts` (nadie lo importa; además insertaba directo
  desde el cliente, el camino que ganó fue `/api/contact`) y
  `components/telefonos/Filters.astro` (mock estático con botones que no hacen nada,
  no está importado en ninguna página). Borrar ambos.
- **Dominio hardcodeado:** `BusinessDetail.astro` arma la URL de compartir con
  `https://eltalar.com.ar/...` fijo. Usar `Astro.url` / `Astro.site` (configurando
  `site` en `astro.config.mjs`, que además lo requiere el sitemap).
- **Un iframe de Google Maps por card de farmacia** (`PharmacyCard` siempre renderiza
  `MapPreview`): la página de farmacias carga 6+ iframes pesados. Mostrar el mapa solo
  para la de turno, o cargarlo on‑demand.
- **Datos hardcodeados** que deberían estar en la DB para poder editarlos sin deploy:
  teléfonos útiles (`Directory.astro`), emergencias (`Emergencies.astro`), el subtítulo
  fijo "Hoy · hasta las 8 hs" en farmacias de turno (ignora el `ends_at` real).

### 1.4 Problemas menores 🟡 (higiene)

- README es el template por defecto de Astro.
- Sin `.prettierrc` / linter / CI. Sin tests.
- Import de imágenes desde `../../../public/...` (anti‑patrón; los assets de `public/`
  se referencian por URL `/images/...`, no se importan).
- Sin página `404.astro` propia (se redirige a `/404` que no existe como página custom).
- `.DS_Store` presentes en el árbol (ya están en `.gitignore`, ok).

---

## 2. Arquitectura objetivo

### 2.1 Estrategia de render (la decisión clave)

Astro permite elegir el modo de render **página por página**. Esta es la asignación propuesta:

| Página                       | Modo                                                         | Por qué                                                                                                              |
| ---------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `/` (home)                   | **Estática con revalidación (ISR)**                          | Contenido semi‑fijo; alertas/destacados se revalidan cada X min.                                                     |
| `/negocios` (listado)        | **SSR (o estático + ISR)** con HTML renderizado en el server | Indexable. Los filtros/búsqueda son una isla de React que hidrata **sobre** el HTML ya renderizado, no lo reemplaza. |
| `/negocios/[slug]` (detalle) | **SSR con revalidación** o `getStaticPaths` + ISR            | Cada negocio necesita su URL indexable con JSON‑LD.                                                                  |
| `/farmacias`                 | **SSR** (cambia el turno según fecha/hora)                   | Dinámico por naturaleza.                                                                                             |
| `/telefonos`                 | **Estática**                                                 | Es casi contenido fijo.                                                                                              |
| Panel `/app/*` (privado)     | **SSR** detrás de auth                                       | No indexable, siempre fresco.                                                                                        |

Para lograr esto:

1. Instalar un adapter (recomendado **`@astrojs/vercel`** si vas a deployar en Vercel, o
   `@astrojs/node` si vas a self‑host). Cambiar `output` a `"static"` **por defecto** y
   marcar como dinámicas solo las páginas que lo necesitan con `export const prerender = false`.
   (Hoy es al revés: todo SSR.)
2. La página `/negocios` deja de bajar data en el cliente: el `.astro` hace el fetch en
   el server (como ya hace `FeaturedBusinesses.astro`) y le pasa los datos a la isla de
   React como props. React solo maneja filtros/búsqueda sobre esos datos.

### 2.2 Capa de datos

- **Un solo cliente Supabase** en `lib/supabase/`, con dos exports:
  - `supabase` (browser, anon key) para lecturas públicas desde islas.
  - `supabaseServer` para el server (con `SUPABASE_SERVICE_ROLE_KEY` **solo** en endpoints
    de servidor, nunca expuesta al cliente).
- **Tipos generados**: `supabase gen types typescript` → `lib/database.types.ts`. Adiós `any`.
- **Repositorios por dominio**: `business.repository.ts`, `pharmacy.repository.ts`,
  `alerts.repository.ts`, `directory.repository.ts`. Todos devuelven tipos, no `any`.
- **Un solo módulo de horarios** `lib/hours/` que exponga: `getTodayStatus()` (badge
  abierto/cerrado) y `getWeekSchedule()` (grilla semanal). Se calcula **una vez** y se
  reutiliza; el badge se calcula en el cliente (depende de la hora del visitante) o se
  marca la card con `client:idle` para que el "abierto/cerrado" sea correcto por zona horaria.

### 2.3 Autenticación y roles (la pieza que falta)

Usar **Supabase Auth**. Tres roles:

- **`visitor`** (anónimo): navega, busca, contacta. Solo lectura pública.
- **`owner`** (dueño de negocio): registra su negocio, edita su ficha, sube fotos,
  carga horarios, gestiona su suscripción. Solo puede tocar **sus** negocios.
- **`admin`** (vos): aprueba negocios nuevos, gestiona alertas/teléfonos/turnos de
  farmacia, ve todo.

Rutas privadas bajo `/app` (o `/panel`), protegidas por middleware de Astro
(`src/middleware.ts`) que valida la sesión de Supabase y redirige si no hay login.

### 2.4 Seguridad (RLS)

Activar **Row Level Security** en todas las tablas. Políticas base:

- `businesses`: lectura pública solo si `is_active = true`; escritura solo por el
  `owner_id` dueño o `admin`. (Hay que agregar la columna `owner_id`.)
- `business_photos` / `business_hours`: escritura solo por el owner del negocio padre.
- `contact_messages`: `insert` público, **sin** `select` público (solo admin lee).
- `categories`, `site_alerts`, `pharmacy_turns`: lectura pública, escritura solo admin.

### 2.5 Modelo de datos — cambios propuestos

Agregar / ajustar:

```
businesses
  + owner_id            uuid  → auth.users(id)   (dueño)
  + status              enum('draft','pending','approved','rejected')  (moderación)
  + lat, lng            double precision          (para el mapa)
  + plan                enum('free','destacado')  (monetización)
  + featured_until      timestamptz               (destacado con vencimiento)

subscriptions (nueva)
  id, business_id, provider('mercadopago'), external_id,
  status('active','past_due','canceled'), current_period_end, created_at

directory_entries (nueva)   ← reemplaza el hardcode de telefonos/emergencias
  id, category('emergencia'|'servicio'|'salud'), title, subtitle, phone,
  is_priority, order, is_active
```

> Nota: `is_featured` actual pasa a derivarse de `plan = 'destacado' AND featured_until > now()`.

### 2.6 Monetización (Fase 3)

**Mecánica de cobro:** **Mercado Pago** (es Argentina) con **suscripciones (preapproval)**.
Webhook a un endpoint `/api/webhooks/mercadopago` que actualiza `subscriptions.status` y
`businesses.plan` / `featured_until`. Sin pago activo, el negocio vuelve a `free`
automáticamente. Empezar simple: un solo plan pago. No sobre‑diseñar tiers todavía.

**Menú de ideas de monetización** (ordenadas por relación esfuerzo/retorno para un
portal barrial; las dos primeras son las que conviene lanzar):

1. **Plan "Destacado" mensual** ⭐ _(la base, ya prevista)_
   Badge visual + primero en el listado + carrusel del home. Simple de entender y
   de vender puerta a puerta.
2. **Estadísticas para el dueño** ⭐ _(el gancho de retención)_
   Trackear vistas de ficha y clicks a WhatsApp/teléfono (una tabla `business_events`
   simple; se implementa en horas). El plan gratis muestra "este mes: 214 personas
   vieron tu negocio"; el plan pago muestra el detalle. **Esto es lo que hace que un
   comerciante entienda el valor y no cancele**: ve gente real llegándole por la página.
3. **Promos / Cupones de la semana**
   Sección "Ofertas del barrio". Publicar una promo está incluido en el plan Destacado
   (o se vende suelto). Genera visitas recurrentes de vecinos → más valor para todos.
4. **Sponsor de sección**
   "Farmacias de turno — presentado por [negocio]". Un solo sponsor por sección, precio
   fijo mensual, cero desarrollo (un banner discreto). Ideal para los 2-3 negocios más
   grandes de la zona.
5. **Servicio de carga inicial** _(one-time, sin código)_
   Muchos comerciantes no van a cargar su ficha solos. Cobrar un fijo único por dejarles
   la ficha armada (fotos, horarios, descripción). Monetiza desde el día 1, incluso
   antes de tener pagos online: se cobra en mano/transferencia.
6. **Clasificados de vecinos** _(más adelante)_
   Gratis publicar, pago destacar. Trae tráfico recurrente pero requiere moderación.

**Qué NO hacer:** banners de redes publicitarias (AdSense) — pagan centavos con este
tráfico y ensucian la página; comisión por pedidos/reservas — demasiada complejidad
operativa para el tamaño actual.

**Camino sugerido:** lanzar con (5) para validar interés sin escribir código de pagos →
implementar (1)+(2) juntos → sumar (3) y (4) cuando haya masa de usuarios.

### 2.7 Deploy y flujo de trabajo (requisito: actualizar tiene que ser trivial)

**Regla de oro: subir cambios = `git push`. Nada más.**

- **Hosting: Vercel** (decidido). Se conecta el repo de GitHub una sola vez y a partir
  de ahí:
  - `git push` a `main` → **deploy automático a producción** (~1-2 min).
  - Cada Pull Request → **preview deploy** con URL propia para probar antes de mergear.
  - Rollback con un click desde el dashboard si algo sale mal.
- **Los cambios de CONTENIDO no necesitan deploy.** Como las páginas con datos son SSR,
  editar un negocio, cargar una alerta o un turno de farmacia en Supabase (o, en el
  futuro, desde el panel) **se ve al instante en la web sin tocar el repo**. Deploy es
  solo para cambios de código.
- **Variables de entorno** (`PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`) se cargan
  una vez en el dashboard de Vercel (Settings → Environment Variables). Nunca van al repo.
- **Dominio:** apuntar `eltalar.com.ar` a Vercel desde el dashboard (agregar dominio +
  un registro DNS en el proveedor del dominio).
- Setup inicial (una sola vez): crear cuenta en vercel.com con GitHub → "Add New Project"
  → importar el repo `eltalar` → cargar las 2 env vars → Deploy. Vercel detecta Astro solo.

### 2.8 Mapa interactivo (Fase 4)

- Guardar `lat`/`lng` por negocio (geocodificar la dirección al guardar, con Nominatim
  o Google Geocoding).
- Mapa con **MapLibre GL** o **Leaflet** (gratis, sin costo por vista como Google Maps
  Platform). Isla de React/Astro con `client:visible`.
- Cada marker abre un popup con la mini‑ficha y link a `/negocios/[slug]`.
- El `MapPreview.astro` actual (iframe de Google) sirve como fallback del detalle, pero
  el mapa "de todos los negocios" es un componente nuevo alimentado por lat/lng.

---

## 3. Plan por fases (con checklist)

### Fase 0 — Estabilizar y quick wins ✅ COMPLETADA (2026-07-11)

- [x] Instalar adapter `@astrojs/vercel` y arreglar el build de producción (requirió Astro 5→7).
- [x] Estrategia de render: SSR por defecto (contenido al instante sin deploy) + `prerender = true` en páginas fijas (404). _(Se optó por SSR-default en vez de static-default: el requisito "editar contenido sin deploy" pesa más.)_
- [x] Unificar los dos clientes Supabase en uno.
- [x] Unificar la lógica de horarios en `lib/hours.ts` (borrados los 3 duplicados).
- [x] Renderizar `/negocios` en el server → **SEO arreglado** (verificado en producción).
- [x] `<head>` completo en `Layout.astro`: `description`, OG, canonical, `initial-scale=1`.
- [x] `robots.txt` + sitemap dinámico (`/sitemap.xml` endpoint propio: suma negocios sin deploy).
- [x] Página `404.astro` propia (y rewrite con status 404 real en fichas inexistentes).
- [x] Fix de zona horaria con TZ `America/Argentina/Buenos_Aires` explícita.
- [x] Honeypot + validación movidos al endpoint `/api/contact`.
- [x] Borrado código muerto: `lib/contactForm.ts`, `components/telefonos/Filters.astro`.
- [x] `site` en `astro.config.mjs`; dominio hardcodeado reemplazado por `Astro.site`.
- [x] README real del proyecto.

> Nota post-fase: el proyecto Supabase original murió pausado >90 días; se migró
> completo (datos + storage + RLS) a un proyecto nuevo el 2026-07-11.

### Fase 1 — Calidad y datos ✅ COMPLETADA (2026-07-11)

- [x] Tipos generados de Supabase (`lib/database.types.ts`) → `any` eliminado del data layer.
- [x] Repositorios tipados (`business.repository`, `directory.repository`). _(El tipado ya cazó un bug: `business.tag` no existía en la DB.)_
- [x] Teléfonos/emergencias migrados a tabla `directory_entries` (RLS lectura pública; editable sin deploy). _(De paso se arregló el `tel:+5411...` hardcodeado que rompía los 0800.)_
- [x] Optimización de imágenes: Vercel Image Service + `<Image>` en el detalle + lazy/dimensions en cards.
- [ ] Extraer íconos SVG repetidos a componentes — hecho en telefonos (`@lucide/astro`); falta el resto (baja prioridad).
- [x] JSON‑LD `LocalBusiness` en el detalle de negocio (con horarios, dirección y geo si hay lat/lng).
- [x] Prettier + `astro check` + build en CI (GitHub Actions). _(ESLint queda opcional para más adelante.)_

### Fase 2 — Auth + panel + seguridad (1-2 semanas) 🔐 ← **el corazón del proyecto**

- [ ] Supabase Auth (login/registro para owners; magic link o email+password).
- [ ] Columnas `owner_id`, `status` en `businesses`.
- [ ] Middleware de Astro para proteger `/app/*`.
- [ ] Panel del owner: alta de negocio, editar ficha, subir fotos, cargar horarios.
- [ ] Panel admin: moderar altas (`pending → approved`), gestionar alertas, turnos, directorio.
- [ ] Activar RLS en todas las tablas con las políticas de §2.4.

### Fase 3 — Monetización (1 semana) 💳

- [ ] Tablas `subscriptions`, campos `plan`/`featured_until`.
- [ ] Integración Mercado Pago (preapproval) + webhook.
- [ ] Lógica de "destacado" derivada del plan activo.
- [ ] UI de "Destacá tu negocio" en el panel del owner.

### Fase 4 — Mapa (3-5 días) 🗺️

- [ ] `lat`/`lng` + geocoding al guardar.
- [ ] Mapa con markers (MapLibre/Leaflet) + popups → link al detalle.
- [ ] Filtro por categoría sobre el mapa.

---

## 4. Decisiones tomadas

> Estaban abiertas; se resolvieron con los defaults recomendados (pedido del dueño:
> "solucioname todo"). Cualquiera se puede revisar más adelante.

1. **Hosting: Vercel.** ✅ Push a `main` = deploy automático; previews por PR; ISR
   disponible para optimizar después. Ver §2.7.
2. **Login de negocios: magic link** (email sin contraseña). Es lo más simple para
   comerciantes no técnicos: ponen su email, les llega un link, listo. Se puede sumar
   contraseña opcional después.
3. **Pagos: Mercado Pago, un solo plan "Destacado" mensual.** Tiers recién cuando haya
   demanda real. Ver menú completo de ideas en §2.6.
4. **Moderación: aprobación manual.** Los negocios entran en `pending` y los aprobás
   desde el panel admin. Cuida la calidad y evita spam/carga basura al principio.
5. **Mapa: MapLibre/Leaflet con OpenStreetMap** (gratis, sin API key ni tarjeta de
   crédito). Google Maps queda solo como el embed del detalle que ya existe.

---

## 5. Lo que NO hay que hacer

- ❌ No migrar de Astro a Next/otro framework. No resuelve ningún problema real acá y
  perdés el SEO estático que ganaste.
- ❌ No meter realtime (websockets/Supabase Realtime) todavía. No lo necesitás; SSR +
  revalidación alcanza y sobra para "que se vea al instante".
- ❌ No construir monetización ni mapa antes de tener auth + panel + RLS. Serían castillos
  sin cimientos.
