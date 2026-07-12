/**
 * Geocodifica los negocios activos que tienen dirección pero no coordenadas
 * (cargados a mano: sin lat/lng no aparecen en el mapa).
 *
 * Usa Text Search de Places API (New) con "direccion, El Talar, Tigre" y
 * solo guarda el resultado si cae dentro de la zona (bbox de El Talar con
 * un margen), para no clavar un pin en cualquier lado.
 *
 * Uso:
 *   node scripts/import/geocode-faltantes.mjs           # dry-run
 *   node scripts/import/geocode-faltantes.mjs --apply   # guarda lat/lng
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const HERE = dirname(fileURLToPath(import.meta.url));

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
const db = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const APPLY = process.argv.includes("--apply");

// El Talar + margen (el bbox exacto deja afuera bordes legítimos)
const BBOX = { south: -34.5, north: -34.44, west: -58.7, east: -58.61 };

const { data: pending, error } = await db
  .from("businesses")
  .select("id, name, address")
  .eq("is_active", true)
  .is("lat", null)
  .not("address", "is", null);
if (error) throw error;

console.log(`${pending.length} negocios sin coordenadas${APPLY ? "" : " (dry-run)"}`);

let ok = 0;
for (const b of pending) {
  const query = `${b.address.split(",")[0]}, El Talar, Tigre, Buenos Aires`;
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": "places.location,places.formattedAddress",
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 1 }),
  });
  const data = await res.json();
  const loc = data.places?.[0]?.location;

  if (
    !loc ||
    loc.latitude < BBOX.south ||
    loc.latitude > BBOX.north ||
    loc.longitude < BBOX.west ||
    loc.longitude > BBOX.east
  ) {
    console.log(`  ✗ ${b.name} — "${b.address}" → sin resultado confiable`);
    continue;
  }

  const lat = Math.round(loc.latitude * 1e5) / 1e5;
  const lng = Math.round(loc.longitude * 1e5) / 1e5;
  console.log(`  ✓ ${b.name} — ${b.address} → ${lat}, ${lng}`);
  ok++;

  if (APPLY) {
    await db.from("businesses").update({ lat, lng }).eq("id", b.id);
  }
  await new Promise((r) => setTimeout(r, 150));
}

console.log(`\nGeocodificados: ${ok}/${pending.length}${APPLY ? " (guardado)" : " — corré con --apply para guardar"}`);
