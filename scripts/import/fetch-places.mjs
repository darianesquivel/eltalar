/**
 * Barrido de negocios de El Talar con Google Places API (New).
 *
 * Estrategia en dos fases para minimizar costo:
 *  1. Grilla de búsquedas "nearby" pidiendo campos mínimos (id, ubicación,
 *     tipos, estado). Si una celda devuelve 20 resultados (el máximo), se
 *     subdivide en 4. El progreso se guarda en disco: re-correr retoma
 *     donde quedó sin repetir búsquedas.
 *  2. Antes de pedir detalles (la parte cara, SKU Enterprise) se filtra:
 *     solo lugares dentro del polígono de El Talar, operativos y que no sean
 *     paradas/plazas/escuelas/etc. Los detalles se cachean en disco.
 *
 * Respeta el límite de 600 requests/min de Google con un freno global.
 *
 * Uso:
 *   node scripts/import/fetch-places.mjs
 *
 * Requiere GOOGLE_MAPS_API_KEY en .env (con "Places API (New)" habilitada).
 * Salida: scripts/import/data/places-el-talar.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, "data");
const GRID_FILE = join(DATA_DIR, "grid-cache.json");
const CACHE_FILE = join(DATA_DIR, "details-cache.json");
const POLYGON_FILE = join(DATA_DIR, "el-talar-polygon.json");
const OUT_FILE = join(DATA_DIR, "places-el-talar.json");

// Bounding box del límite administrativo de El Talar (Nominatim/OSM)
const BBOX = {
  south: -34.4889,
  north: -34.4556,
  west: -58.6806,
  east: -58.627,
};
const GRID_STEP_M = 280; // separación entre centros de búsqueda
const MIN_RADIUS_M = 60; // no subdividir más allá de esto
const CONCURRENCY = 4;
const MIN_MS_BETWEEN_REQUESTS = 130; // ~460 req/min, bajo el límite de 600/min

// Lugares que no son comercios: ni siquiera pedimos sus detalles
const SKIP_TYPES = new Set([
  "bus_stop",
  "bus_station",
  "transit_station",
  "train_station",
  "subway_station",
  "taxi_stand",
  "park",
  "playground",
  "plaza",
  "church",
  "place_of_worship",
  "mosque",
  "synagogue",
  "school",
  "primary_school",
  "secondary_school",
  "preschool",
  "university",
  "city_hall",
  "local_government_office",
  "government_office",
  "police",
  "fire_station",
  "courthouse",
  "cemetery",
  "atm",
  "neighborhood",
  "locality",
  "sublocality",
  "route",
  "street_address",
  "premise",
  "subpremise",
  "intersection",
  "apartment_building",
  "apartment_complex",
  "housing_complex",
  "condominium_complex",
  "sports_complex",
  "athletic_field",
  "community_center",
]);

function loadEnv(path) {
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]])
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}
loadEnv(join(HERE, "../../.env"));

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!API_KEY) {
  console.error("Falta GOOGLE_MAPS_API_KEY en .env");
  process.exit(1);
}

const readJson = (path, fallback) =>
  existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : fallback;

async function pool(items, worker, size = CONCURRENCY) {
  const results = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (i < items.length) {
        const idx = i++;
        results[idx] = await worker(items[idx], idx);
      }
    }),
  );
  return results;
}

// Freno global: espacia todos los requests para no pasar el límite por minuto
let nextSlot = 0;
async function throttle() {
  const now = Date.now();
  nextSlot = Math.max(nextSlot + MIN_MS_BETWEEN_REQUESTS, now);
  const wait = nextSlot - now;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

async function apiFetch(url, options, attempt = 0) {
  await throttle();
  const res = await fetch(url, options);
  if ((res.status === 429 || res.status >= 500) && attempt < 5) {
    // 429 = cuota por minuto agotada: esperar bastante antes de reintentar
    const wait = res.status === 429 ? 25000 * (attempt + 1) : 2000 * (attempt + 1);
    console.log(`  (HTTP ${res.status}, reintento en ${wait / 1000}s)`);
    await new Promise((r) => setTimeout(r, wait));
    return apiFetch(url, options, attempt + 1);
  }
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  }
  return res.json();
}

// ---------- Polígono de El Talar (para filtrar vecinos que caen en el bbox) ----------

async function getPolygon() {
  const cached = readJson(POLYGON_FILE, null);
  if (cached) return cached;

  const url =
    "https://nominatim.openstreetmap.org/search?q=El+Talar,+Tigre,+Buenos+Aires,+Argentina&format=json&polygon_geojson=1&limit=5";
  const res = await fetch(url, {
    headers: { "User-Agent": "eltalar-directorio-import" },
  });
  const results = await res.json();
  const admin = results.find((r) => r.type === "administrative");
  if (!admin?.geojson)
    throw new Error("No pude obtener el polígono de El Talar");

  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(POLYGON_FILE, JSON.stringify(admin.geojson));
  return admin.geojson;
}

/** Ray casting punto-en-polígono sobre GeoJSON Polygon/MultiPolygon. */
function pointInPolygon(lng, lat, geojson) {
  const polygons =
    geojson.type === "MultiPolygon"
      ? geojson.coordinates
      : [geojson.coordinates];
  for (const rings of polygons) {
    const outer = rings[0];
    let inside = false;
    for (let i = 0, j = outer.length - 1; i < outer.length; j = i++) {
      const [xi, yi] = outer[i];
      const [xj, yj] = outer[j];
      if (
        yi > lat !== yj > lat &&
        lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
      ) {
        inside = !inside;
      }
    }
    if (inside) return true;
  }
  return false;
}

// ---------- Fase 1: grilla de nearby search (campos mínimos) ----------

async function searchCell(lat, lng, radius) {
  const body = {
    maxResultCount: 20,
    locationRestriction: {
      circle: { center: { latitude: lat, longitude: lng }, radius },
    },
  };
  const data = await apiFetch(
    "https://places.googleapis.com/v1/places:searchNearby",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask":
          "places.id,places.location,places.types,places.businessStatus",
      },
      body: JSON.stringify(body),
    },
  );
  return data.places ?? [];
}

async function sweepGrid() {
  const latStep = GRID_STEP_M / 111320;
  const midLat = (BBOX.south + BBOX.north) / 2;
  const lngStep = GRID_STEP_M / (111320 * Math.cos((midLat * Math.PI) / 180));

  const cells = [];
  for (let lat = BBOX.south; lat <= BBOX.north; lat += latStep) {
    for (let lng = BBOX.west; lng <= BBOX.east; lng += lngStep) {
      // radio con solapamiento para no dejar huecos entre círculos
      cells.push({ lat, lng, radius: GRID_STEP_M * 0.75 });
    }
  }

  // Reanudable: celdas ya barridas y lugares ya vistos quedan en disco
  const grid = readJson(GRID_FILE, { doneCells: {}, places: {} });
  const cellKey = (c) =>
    `${c.lat.toFixed(5)},${c.lng.toFixed(5)},${Math.round(c.radius)}`;
  const pendingCells = cells.filter((c) => !grid.doneCells[cellKey(c)]);
  console.log(
    `Fase 1: ${cells.length} celdas (${cells.length - pendingCells.length} ya barridas, ${pendingCells.length} pendientes)`,
  );

  let done = 0;
  let searches = 0;

  const saveGrid = () => writeFileSync(GRID_FILE, JSON.stringify(grid));

  async function processCell(cell) {
    searches++;
    const found = await searchCell(cell.lat, cell.lng, cell.radius);
    for (const p of found) {
      grid.places[p.id] = {
        location: p.location,
        types: p.types ?? [],
        businessStatus: p.businessStatus ?? null,
      };
    }

    // Celda saturada: hay más de 20 lugares, subdividir
    if (found.length === 20 && cell.radius / 2 >= MIN_RADIUS_M) {
      const d = cell.radius / 2 / 111320;
      const dLng =
        cell.radius / 2 / (111320 * Math.cos((cell.lat * Math.PI) / 180));
      const subs = [
        { lat: cell.lat + d, lng: cell.lng + dLng },
        { lat: cell.lat + d, lng: cell.lng - dLng },
        { lat: cell.lat - d, lng: cell.lng + dLng },
        { lat: cell.lat - d, lng: cell.lng - dLng },
      ]
        .map((c) => ({ ...c, radius: cell.radius / 2 }))
        .filter((c) => !grid.doneCells[cellKey(c)]);
      await pool(subs, processCell, 2);
    }

    grid.doneCells[cellKey(cell)] = true;
  }

  await pool(pendingCells, async (cell) => {
    await processCell(cell);
    done++;
    if (done % 20 === 0) {
      saveGrid();
      console.log(
        `  ${done}/${pendingCells.length} celdas · ${Object.keys(grid.places).length} lugares únicos`,
      );
    }
  });

  saveGrid();
  console.log(
    `Fase 1 lista: ${searches} búsquedas nuevas, ${Object.keys(grid.places).length} lugares únicos`,
  );
  return grid.places;
}

// ---------- Filtro previo a los detalles (la parte cara) ----------

function filterCandidates(placesMeta, polygon) {
  const stats = { total: 0, fuera: 0, noOperativo: 0, tipoSkip: 0, ok: 0 };
  const candidates = [];

  for (const [id, meta] of Object.entries(placesMeta)) {
    stats.total++;
    if (meta.businessStatus && meta.businessStatus !== "OPERATIONAL") {
      stats.noOperativo++;
      continue;
    }
    if (
      !meta.location ||
      !pointInPolygon(meta.location.longitude, meta.location.latitude, polygon)
    ) {
      stats.fuera++;
      continue;
    }
    if ((meta.types ?? []).some((t) => SKIP_TYPES.has(t))) {
      stats.tipoSkip++;
      continue;
    }
    stats.ok++;
    candidates.push(id);
  }

  console.log(
    `\nFiltro: ${stats.total} lugares → ${stats.ok} candidatos ` +
      `(${stats.fuera} fuera de El Talar, ${stats.tipoSkip} no-comercio, ${stats.noOperativo} no operativos)`,
  );
  return candidates;
}

// ---------- Fase 2: detalles por lugar (cacheados) ----------

const DETAIL_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "shortFormattedAddress",
  "location",
  "nationalPhoneNumber",
  "internationalPhoneNumber",
  "websiteUri",
  "regularOpeningHours",
  "types",
  "primaryType",
  "primaryTypeDisplayName",
  "businessStatus",
  "googleMapsUri",
].join(",");

async function fetchDetails(ids) {
  const cache = readJson(CACHE_FILE, {});
  const pending = ids.filter((id) => !(id in cache));
  console.log(
    `Fase 2: ${ids.length} lugares (${pending.length} nuevos, ${ids.length - pending.length} en caché)`,
  );

  let done = 0;
  await pool(pending, async (id) => {
    try {
      cache[id] = await apiFetch(
        `https://places.googleapis.com/v1/places/${id}?languageCode=es`,
        {
          headers: {
            "X-Goog-Api-Key": API_KEY,
            "X-Goog-FieldMask": DETAIL_FIELDS,
          },
        },
      );
    } catch (err) {
      console.error(`  error en ${id}: ${err.message}`);
      cache[id] = { id, _error: String(err.message) };
    }
    done++;
    if (done % 50 === 0) {
      console.log(`  ${done}/${pending.length} detalles`);
      writeFileSync(CACHE_FILE, JSON.stringify(cache)); // guardado parcial
    }
  });

  writeFileSync(CACHE_FILE, JSON.stringify(cache));
  return ids.map((id) => cache[id]).filter((p) => p && !p._error);
}

// ---------- Main ----------

mkdirSync(DATA_DIR, { recursive: true });
const polygon = await getPolygon();
const placesMeta = await sweepGrid();
const candidateIds = filterCandidates(placesMeta, polygon);
const places = await fetchDetails(candidateIds);

// Segundo filtro con datos completos (el details puede corregir estado/ubicación)
const inside = places.filter(
  (p) =>
    (!p.businessStatus || p.businessStatus === "OPERATIONAL") &&
    p.location &&
    pointInPolygon(p.location.longitude, p.location.latitude, polygon),
);

inside.sort(
  (a, b) =>
    (a.primaryType ?? "zz").localeCompare(b.primaryType ?? "zz") ||
    (a.displayName?.text ?? "").localeCompare(b.displayName?.text ?? ""),
);

writeFileSync(OUT_FILE, JSON.stringify(inside, null, 2));

const withPhone = inside.filter((p) => p.nationalPhoneNumber).length;
const withHours = inside.filter(
  (p) => p.regularOpeningHours?.periods?.length,
).length;
const withWeb = inside.filter((p) => p.websiteUri).length;

const byType = {};
for (const p of inside)
  byType[p.primaryType ?? "(sin tipo)"] =
    (byType[p.primaryType ?? "(sin tipo)"] ?? 0) + 1;

console.log(`\n== Resultado ==`);
console.log(`Negocios en El Talar: ${inside.length}`);
console.log(
  `Con teléfono: ${withPhone} · Con horarios: ${withHours} · Con web/IG: ${withWeb}`,
);
console.log(`\nPor tipo:`);
for (const [type, count] of Object.entries(byType).sort(
  (a, b) => b[1] - a[1],
)) {
  console.log(`  ${String(count).padStart(4)}  ${type}`);
}
console.log(`\nArchivo: ${OUT_FILE}`);
