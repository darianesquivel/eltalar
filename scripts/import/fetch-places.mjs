/**
 * Barrido de negocios de El Talar con Google Places API (New).
 *
 * Estrategia en dos fases para minimizar costo:
 *  1. Grilla de búsquedas "nearby" pidiendo SOLO el id (SKU Essentials, 10k gratis/mes).
 *     Si una celda devuelve 20 resultados (el máximo), se subdivide en 4.
 *  2. Un "place details" por cada id único con todos los campos (SKU Enterprise,
 *     1k gratis/mes). Los detalles se cachean en disco: re-correr no vuelve a pagar.
 *
 * Filtra los resultados al polígono administrativo real de El Talar (OSM),
 * porque el rectángulo de búsqueda pisa General Pacheco y Ricardo Rojas.
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
const CACHE_FILE = join(DATA_DIR, "details-cache.json");
const POLYGON_FILE = join(DATA_DIR, "el-talar-polygon.json");
const OUT_FILE = join(DATA_DIR, "places-el-talar.json");
const OUT_OUTSIDE_FILE = join(DATA_DIR, "places-fuera-del-talar.json");

// Bounding box del límite administrativo de El Talar (Nominatim/OSM)
const BBOX = {
  south: -34.4889,
  north: -34.4556,
  west: -58.6806,
  east: -58.627,
};
const GRID_STEP_M = 280; // separación entre centros de búsqueda
const MIN_RADIUS_M = 60; // no subdividir más allá de esto
const CONCURRENCY = 5;

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

async function apiFetch(url, options, attempt = 0) {
  const res = await fetch(url, options);
  if ((res.status === 429 || res.status >= 500) && attempt < 4) {
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
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
  const results = await apiFetch(url, {
    headers: { "User-Agent": "eltalar-directorio-import" },
  });
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

// ---------- Fase 1: grilla de nearby search (solo ids) ----------

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
        "X-Goog-FieldMask": "places.id",
      },
      body: JSON.stringify(body),
    },
  );
  return (data.places ?? []).map((p) => p.id);
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
  console.log(`Fase 1: ${cells.length} celdas de búsqueda (${GRID_STEP_M}m)`);

  const ids = new Set();
  let done = 0;
  let searches = 0;

  async function processCell(cell) {
    searches++;
    const found = await searchCell(cell.lat, cell.lng, cell.radius);
    found.forEach((id) => ids.add(id));

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
      ].map((c) => ({ ...c, radius: cell.radius / 2 }));
      await pool(subs, processCell, 2);
    }
  }

  await pool(cells, async (cell) => {
    await processCell(cell);
    done++;
    if (done % 25 === 0)
      console.log(
        `  ${done}/${cells.length} celdas · ${ids.size} lugares únicos`,
      );
  });

  console.log(
    `Fase 1 lista: ${searches} búsquedas, ${ids.size} lugares únicos`,
  );
  return [...ids];
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
const ids = await sweepGrid();
const places = await fetchDetails(ids);

const inside = [];
const outside = [];
for (const p of places) {
  if (p.businessStatus && p.businessStatus !== "OPERATIONAL") continue;
  const target =
    p.location &&
    pointInPolygon(p.location.longitude, p.location.latitude, polygon)
      ? inside
      : outside;
  target.push(p);
}

inside.sort(
  (a, b) =>
    (a.primaryType ?? "zz").localeCompare(b.primaryType ?? "zz") ||
    (a.displayName?.text ?? "").localeCompare(b.displayName?.text ?? ""),
);

writeFileSync(OUT_FILE, JSON.stringify(inside, null, 2));
writeFileSync(OUT_OUTSIDE_FILE, JSON.stringify(outside, null, 2));

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
console.log(
  `Dentro de El Talar: ${inside.length} (afuera: ${outside.length}, descartados no operativos: ${places.length - inside.length - outside.length})`,
);
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
