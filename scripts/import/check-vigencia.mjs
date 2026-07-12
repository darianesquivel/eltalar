/**
 * Chequeo de vigencia de los negocios importados de Google Places.
 *
 * Recorre el ledger (place_id → business_id) y le pregunta a Google el
 * businessStatus actual de cada lugar. Los que figuran CERRADOS
 * PERMANENTEMENTE se desactivan (is_active=false, reversible); los cerrados
 * temporalmente solo se informan.
 *
 * Correrlo cada tanto (ej. una vez por mes) mantiene el directorio al día.
 * Costo: ~1700 consultas con campo mínimo, entra en la franja gratuita.
 *
 * Uso:
 *   node scripts/import/check-vigencia.mjs           # dry-run: solo informa
 *   node scripts/import/check-vigencia.mjs --apply   # desactiva los cerrados
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const HERE = dirname(fileURLToPath(import.meta.url));
const LEDGER_FILE = join(HERE, "data", "import-ledger.json");
const REPORT_FILE = join(HERE, "data", "vigencia-report.json");
const MIN_MS_BETWEEN_REQUESTS = 140; // bajo el límite de 600/min de Google

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
const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!API_KEY || !SUPABASE_URL || !SERVICE_KEY) {
  console.error("Faltan GOOGLE_MAPS_API_KEY / PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!existsSync(LEDGER_FILE)) {
  console.error(`No existe ${LEDGER_FILE}`);
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");
const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});
const ledger = JSON.parse(readFileSync(LEDGER_FILE, "utf8"));
const entries = Object.entries(ledger); // [placeId, businessId]
console.log(`Chequeando ${entries.length} negocios importados${APPLY ? "" : " (dry-run)"}…`);

let nextSlot = 0;
async function throttle() {
  const now = Date.now();
  nextSlot = Math.max(nextSlot + MIN_MS_BETWEEN_REQUESTS, now);
  const wait = nextSlot - now;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

async function getStatus(placeId, attempt = 0) {
  await throttle();
  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: { "X-Goog-Api-Key": API_KEY, "X-Goog-FieldMask": "businessStatus" },
  });
  if ((res.status === 429 || res.status >= 500) && attempt < 4) {
    await new Promise((r) => setTimeout(r, 25000 * (attempt + 1)));
    return getStatus(placeId, attempt + 1);
  }
  // 404: Google dio de baja la ficha → tratarlo como cerrado permanente
  if (res.status === 404) return "REMOVED_FROM_GOOGLE";
  if (!res.ok) return `ERROR_${res.status}`;
  const data = await res.json();
  return data.businessStatus ?? "UNKNOWN";
}

const closed = [];
const temporary = [];
const errors = [];
let done = 0;

// concurrencia baja: el throttle global es el que manda
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (entries.length) {
      const [placeId, businessId] = entries.pop();
      const status = await getStatus(placeId);
      if (status === "CLOSED_PERMANENTLY" || status === "REMOVED_FROM_GOOGLE") {
        closed.push({ placeId, businessId, status });
      } else if (status === "CLOSED_TEMPORARILY") {
        temporary.push({ placeId, businessId });
      } else if (status.startsWith("ERROR_")) {
        errors.push({ placeId, businessId, status });
      }
      done++;
      if (done % 200 === 0) console.log(`  ${done} chequeados…`);
    }
  }),
);

// nombres para el informe
async function names(list) {
  if (!list.length) return [];
  const { data } = await db
    .from("businesses")
    .select("id, name, slug, is_active")
    .in("id", list.map((x) => x.businessId));
  return data ?? [];
}
const closedInfo = await names(closed);
const tempInfo = await names(temporary);

console.log(`\n== Resultado ==`);
console.log(`Cerrados permanentemente / dados de baja: ${closed.length}`);
closedInfo.forEach((b) => console.log(`  • ${b.name} (${b.slug})${b.is_active ? "" : " [ya inactivo]"}`));
console.log(`Cerrados temporalmente (solo aviso): ${temporary.length}`);
tempInfo.forEach((b) => console.log(`  • ${b.name} (${b.slug})`));
if (errors.length) console.log(`Errores de consulta: ${errors.length}`);

writeFileSync(
  REPORT_FILE,
  JSON.stringify({ checked_at: new Date().toISOString(), closed: closedInfo, temporary: tempInfo, errors }, null, 1),
);
console.log(`Informe: ${REPORT_FILE}`);

if (APPLY && closed.length) {
  const ids = closed.map((x) => x.businessId);
  const { error } = await db.from("businesses").update({ is_active: false }).in("id", ids);
  if (error) console.error("Error desactivando:", error.message);
  else console.log(`Desactivados ${ids.length} negocios cerrados. ✓`);
} else if (closed.length) {
  console.log(`\nDry-run: nada se tocó. Para desactivarlos: node scripts/import/check-vigencia.mjs --apply`);
}
