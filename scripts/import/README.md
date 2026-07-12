# Carga masiva de comercios de El Talar

Circuito en dos pasos: barrer los negocios reales de El Talar con Google Places
API y cargarlos en Supabase como negocios administrativos (sin dueño,
reclamables, activos pero no verificados).

## Requisitos

En `.env` (raíz del proyecto):

```
GOOGLE_MAPS_API_KEY=...        # con "Places API (New)" habilitada
PUBLIC_SUPABASE_URL=...        # ya existe
SUPABASE_SERVICE_ROLE_KEY=...  # ya existe
```

### Crear la API key de Google (una sola vez)

1. Entrar a https://console.cloud.google.com y crear un proyecto (ej. "eltalar").
2. Activar facturación (pide tarjeta; el volumen de este barrido entra en el
   nivel gratuito mensual: ~10.000 búsquedas Essentials y ~1.000 detalles
   Enterprise gratis por mes).
3. En "APIs y servicios" → "Biblioteca", habilitar **Places API (New)**
   (la que dice "New"; la vieja no sirve para estos scripts).
4. En "Credenciales" → "Crear credenciales" → "Clave de API".
   Recomendado: restringirla a la API "Places API (New)".
5. Pegar la clave en `.env` como `GOOGLE_MAPS_API_KEY`.

## Paso 1 — Barrido (`fetch-places.mjs`)

```
node scripts/import/fetch-places.mjs
```

- Recorre una grilla de ~300 m sobre el polígono de El Talar; si una celda
  satura (20 resultados) se subdivide sola.
- Pide primero solo ids (barato) y después un "details" por lugar con nombre,
  dirección, teléfono, web/IG, horarios y coordenadas.
- Cachea los detalles en `data/details-cache.json`: re-correrlo no vuelve a
  gastar cuota.
- Filtra al polígono administrativo real (lo que cae en Pacheco/Ricardo Rojas
  queda aparte en `data/places-fuera-del-talar.json` por si sirve).
- Salida: `data/places-el-talar.json` + resumen por rubro en consola.

## Paso 2 — Importación (`import-businesses.mjs`)

```
node scripts/import/import-businesses.mjs                 # dry-run: muestra qué haría
node scripts/import/import-businesses.mjs --limit 30      # dry-run de una tanda
node scripts/import/import-businesses.mjs --type restaurant --apply
node scripts/import/import-businesses.mjs --apply         # todo
```

- **Dry-run por defecto**: sin `--apply` no escribe nada.
- Idempotente: `data/import-ledger.json` registra qué place_id ya se importó,
  y además deduplica por slug y por nombre+dirección contra la base (no pisa
  los negocios cargados a mano).
- Mapea el rubro de Google a las categorías de la tabla `categories`
  (`TYPE_TO_CATEGORY` en el script). Los tipos sin mapeo se importan sin
  categoría y se listan al final para decidir (ej. crear "Indumentaria").
- Saltea lo que no es comercio (paradas, plazas, escuelas, iglesias…):
  lista `SKIP_TYPES` en el script.
- Horarios: convierte los `periods` de Google a filas de `business_hours`
  (día 0=domingo, varios rangos por día, 24 hs y cruces de medianoche
  soportados).

## Flujo sugerido por tandas

1. `node scripts/import/fetch-places.mjs` (una vez).
2. Dry-run de un rubro: `--type restaurant` → revisar la salida.
3. `--type restaurant --apply` → revisar en `/app/admin/negocios` y en el sitio.
4. Repetir por rubro, o `--apply` a secas para todo lo restante.

## Mantenimiento — Chequeo de vigencia

```
node scripts/import/check-vigencia.mjs           # informe (no toca nada)
node scripts/import/check-vigencia.mjs --apply   # desactiva los cerrados
```

Le pregunta a Google el estado actual de cada negocio importado y desactiva
los que figuran "cerrado permanentemente" (o dados de baja de Maps). Los
cerrados temporalmente solo se informan. Correrlo ~una vez por mes; el
volumen entra en la franja gratuita de la API.
