/**
 * Importador masivo de negocios a Supabase.
 *
 * Lee el JSON generado por fetch-places.mjs y crea negocios como "carga
 * administrativa": sin dueño (owner_id null, reclamables), aprobados y activos
 * pero NO verificados. Inserta negocio + horarios + categoría.
 *
 * Es idempotente: lleva un ledger (data/import-ledger.json) de place_id →
 * business_id, y además deduplica por slug y por nombre+dirección contra lo
 * que ya existe en la base (no pisa los negocios cargados a mano).
 *
 * Uso:
 *   node scripts/import/import-businesses.mjs                  # dry-run (no escribe)
 *   node scripts/import/import-businesses.mjs --apply          # escribe en la base
 *   node scripts/import/import-businesses.mjs --type restaurant --apply
 *   node scripts/import/import-businesses.mjs --limit 20 --apply
 *
 * Requiere PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, "data");
const LEDGER_FILE = join(DATA_DIR, "import-ledger.json");
const DEFAULT_INPUT = join(DATA_DIR, "places-el-talar.json");

// Tipo de Google (primaryType) → slug de categoría en la tabla `categories`.
// Los tipos que no figuran acá se importan sin categoría y se listan al final.
const TYPE_TO_CATEGORY = {
  restaurant: "gastronomia",
  pizza_restaurant: "gastronomia",
  hamburger_restaurant: "gastronomia",
  fast_food_restaurant: "gastronomia",
  sandwich_shop: "gastronomia",
  meal_takeaway: "gastronomia",
  meal_delivery: "gastronomia",
  ice_cream_shop: "gastronomia",
  bakery: "gastronomia",
  bar: "gastronomia",
  cake_shop: "gastronomia",
  pastry_shop: "gastronomia",
  dessert_shop: "gastronomia",
  salad_shop: "gastronomia",
  barbecue_restaurant: "gastronomia",
  brunch_restaurant: "gastronomia",
  pizza_delivery: "gastronomia",
  food_delivery: "gastronomia",
  lounge_bar: "gastronomia",
  cafe: "cafeteria",
  coffee_shop: "cafeteria",
  pharmacy: "farmacia",
  drugstore: "farmacia",
  gym: "gimnasio",
  fitness_center: "gimnasio",
  hair_salon: "peluqueria",
  hair_care: "peluqueria",
  barber_shop: "peluqueria",
  beauty_salon: "peluqueria",
  nail_salon: "peluqueria",
  beautician: "peluqueria",
  makeup_artist: "peluqueria",
  hardware_store: "ferreteria",
  butcher_shop: "carniceria",
  book_store: "libreria",
  stationery_store: "libreria",
  supermarket: "almacen",
  grocery_store: "almacen",
  convenience_store: "almacen",
  market: "almacen",
  liquor_store: "almacen",
  food_store: "almacen",
  pet_store: "mascotas",
  veterinary_care: "mascotas",
  pet_groomer: "mascotas",
  pet_care: "mascotas",
  pet_boarding_service: "mascotas",
  car_repair: "automotor",
  car_wash: "automotor",
  car_dealer: "automotor",
  auto_parts_store: "automotor",
  tire_shop: "automotor",
  gas_station: "automotor",
  motorcycle_dealer: "automotor",
  motorcycle_repair: "automotor",
  truck_dealer: "automotor",
  doctor: "salud",
  dentist: "salud",
  dental_clinic: "salud",
  medical_lab: "salud",
  physiotherapist: "salud",
  hospital: "salud",
  chiropractor: "salud",
  skin_care_clinic: "salud",
  medical_clinic: "salud",
  medical_center: "salud",
  health: "salud",
  wellness_center: "salud",
  electrician: "construccion",
  plumber: "construccion",
  painter: "construccion",
  roofing_contractor: "construccion",
  general_contractor: "construccion",
  home_improvement_store: "construccion",
  building_materials_store: "construccion",
  laundry: "servicios",
  locksmith: "servicios",
  real_estate_agency: "servicios",
  insurance_agency: "servicios",
  lawyer: "servicios",
  accounting: "servicios",
  travel_agency: "servicios",
  bank: "servicios",
  courier_service: "servicios",
  storage: "servicios",
  moving_company: "servicios",
  florist: "servicios",
  tailor: "servicios",
  service: "servicios",
  massage: "servicios",
  massage_spa: "servicios",
  body_art_service: "servicios",
  finance: "servicios",
  taxi_service: "servicios",
  chauffeur_service: "servicios",
  shipping_service: "servicios",
  employment_agency: "servicios",
  child_care_agency: "servicios",
  funeral_home: "servicios",
  consultant: "servicios",
  tour_agency: "servicios",
  business_center: "servicios",
  general_store: "almacen",
  clothing_store: "indumentaria",
  womens_clothing_store: "indumentaria",
  shoe_store: "indumentaria",
  sportswear_store: "indumentaria",
  jewelry_store: "indumentaria",
  cosmetics_store: "indumentaria",
  home_goods_store: "hogar-y-muebles",
  furniture_store: "hogar-y-muebles",
  gift_shop: "hogar-y-muebles",
  garden_center: "hogar-y-muebles",
  educational_institution: "educacion-y-deporte",
  sports_club: "educacion-y-deporte",
  sports_school: "educacion-y-deporte",
  cultural_center: "educacion-y-deporte",
  hotel: "alojamiento-y-eventos",
  lodging: "alojamiento-y-eventos",
  hostel: "alojamiento-y-eventos",
  motel: "alojamiento-y-eventos",
  guest_house: "alojamiento-y-eventos",
  private_guest_room: "alojamiento-y-eventos",
  camping_cabin: "alojamiento-y-eventos",
  event_venue: "alojamiento-y-eventos",
  night_club: "alojamiento-y-eventos",
  manufacturer: "industria-y-mayoristas",
  wholesaler: "industria-y-mayoristas",
  supplier: "industria-y-mayoristas",
  corporate_office: "industria-y-mayoristas",
  transportation_service: "industria-y-mayoristas",
};

// primaryTypes que no son comercios cargables en el directorio
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
  "post_office",
  "cemetery",
  "atm",
  "neighborhood",
  "locality",
  "apartment_building",
  "apartment_complex",
  "housing_complex",
  "condominium_complex",
  "real_estate_developer",
  "sports_complex",
  "athletic_field",
  "community_center",
  "historical_landmark",
  "tourist_attraction",
  "sculpture",
  "castle",
  "museum",
  "toll_station",
  "parking_lot",
  "parking_garage",
  "transit_depot",
  "association_or_organization",
  "non_profit_organization",
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

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Faltan PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env",
  );
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// ---------- Argumentos ----------

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const INPUT = flag("--file") ?? DEFAULT_INPUT;
const ONLY_TYPE = flag("--type");
const ONLY_CATEGORY = flag("--category"); // slug de la tabla categories
const LIMIT = flag("--limit") ? Number(flag("--limit")) : Infinity;

// ---------- Helpers de mapeo ----------

const slugify = (text) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const normalize = (text) =>
  (text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** "Av. Casacuberta 1234, B1618 El Talar, ..." → "Av. Casacuberta 1234, El Talar" */
function cleanAddress(place) {
  const addr = place.shortFormattedAddress ?? place.formattedAddress;
  if (!addr) return null;
  const street = addr.split(",")[0].trim();
  return street ? `${street}, El Talar` : addr;
}

/** Separa websiteUri en instagram vs web propia. */
function splitWebsite(uri) {
  if (!uri) return { website: null, instagram: null };
  const ig = uri.match(/instagram\.com\/([A-Za-z0-9_.]+)/);
  if (ig) return { website: null, instagram: ig[1] };
  return { website: uri, instagram: null };
}

const two = (n) => String(n).padStart(2, "0");

/**
 * regularOpeningHours.periods de Google → filas de business_hours.
 * Google usa day 0=domingo igual que la tabla. Los horarios que cruzan
 * medianoche se parten en dos filas (hours.ts soporta varias por día).
 */
function mapHours(place) {
  const periods = place.regularOpeningHours?.periods;
  if (!periods?.length) return [];

  // Abierto 24/7: un solo period con open day 0 00:00 y sin close
  if (periods.length === 1 && periods[0].open && !periods[0].close) {
    return Array.from({ length: 7 }, (_, day) => ({
      day_of_week: day,
      open_time: null,
      close_time: null,
      is_closed: false,
      is_open_24: true,
    }));
  }

  const rows = [];
  for (const p of periods) {
    if (!p.open || !p.close) continue;
    const openTime = `${two(p.open.hour)}:${two(p.open.minute)}:00`;
    const closeTime = `${two(p.close.hour)}:${two(p.close.minute)}:00`;

    if (p.close.day === p.open.day) {
      rows.push({
        day_of_week: p.open.day,
        open_time: openTime,
        close_time: closeTime,
        is_closed: false,
        is_open_24: false,
      });
    } else {
      // Cruza medianoche: cerrar 23:59 el día de apertura y abrir 00:00 el siguiente
      rows.push({
        day_of_week: p.open.day,
        open_time: openTime,
        close_time: "23:59:00",
        is_closed: false,
        is_open_24: false,
      });
      if (!(p.close.hour === 0 && p.close.minute === 0)) {
        rows.push({
          day_of_week: p.close.day,
          open_time: "00:00:00",
          close_time: closeTime,
          is_closed: false,
          is_open_24: false,
        });
      }
    }
  }
  return rows;
}

// ---------- Main ----------

if (!existsSync(INPUT)) {
  console.error(`No existe ${INPUT}. Corré antes fetch-places.mjs`);
  process.exit(1);
}
const places = JSON.parse(readFileSync(INPUT, "utf8"));
mkdirSync(DATA_DIR, { recursive: true });
const ledger = existsSync(LEDGER_FILE)
  ? JSON.parse(readFileSync(LEDGER_FILE, "utf8"))
  : {};

// Estado actual de la base para deduplicar
const { data: existing, error: exErr } = await db
  .from("businesses")
  .select("id, slug, name, address");
if (exErr) throw exErr;
const existingSlugs = new Set(existing.map((b) => b.slug));
const existingNames = new Map(
  existing.map((b) => [
    `${normalize(b.name)}|${normalize(b.address).slice(0, 20)}`,
    b.id,
  ]),
);

const { data: categories, error: catErr } = await db
  .from("categories")
  .select("id, slug");
if (catErr) throw catErr;
const categoryBySlug = new Map(categories.map((c) => [c.slug, c.id]));

const stats = { imported: 0, skippedType: 0, dupes: 0, errors: 0 };
const unmappedTypes = {};
const exportRows = []; // en dry-run: filas para revisión manual (--export)
let processed = 0;

for (const place of places) {
  if (processed >= LIMIT) break;

  const name = place.displayName?.text?.trim();
  const type = place.primaryType ?? null;
  if (!name) continue;
  if (place.businessStatus && place.businessStatus !== "OPERATIONAL") continue;
  if (type && SKIP_TYPES.has(type)) {
    stats.skippedType++;
    continue;
  }
  if (ONLY_TYPE && type !== ONLY_TYPE) continue;
  if (ONLY_CATEGORY && (type ? TYPE_TO_CATEGORY[type] : null) !== ONLY_CATEGORY)
    continue;

  // Dedup: ya importado antes, o ya existe en la base
  const nameKey = `${normalize(name)}|${normalize(cleanAddress(place)).slice(0, 20)}`;
  if (ledger[place.id] || existingNames.has(nameKey)) {
    stats.dupes++;
    continue;
  }

  processed++;

  const categorySlug = type ? (TYPE_TO_CATEGORY[type] ?? null) : null;
  if (type && !categorySlug) {
    unmappedTypes[type] = (unmappedTypes[type] ?? 0) + 1;
  }
  const categoryId = categorySlug ? categoryBySlug.get(categorySlug) : null;

  const { website, instagram } = splitWebsite(place.websiteUri);
  const hours = mapHours(place);

  let slug = slugify(name);
  if (existingSlugs.has(slug))
    slug = `${slug}-${slugify(cleanAddress(place) ?? "").split("-")[0] || "2"}`;
  while (existingSlugs.has(slug)) slug = `${slug}-x`;

  const row = {
    name,
    slug,
    address: cleanAddress(place),
    phone: place.nationalPhoneNumber ?? null,
    website,
    instagram,
    lat: place.location?.latitude ?? null,
    lng: place.location?.longitude ?? null,
    owner_id: null, // carga administrativa, reclamable
    status: "approved",
    is_active: true,
    is_verified: false,
  };

  if (!APPLY) {
    console.log(
      `[dry-run] ${name} · ${row.address ?? "sin dirección"} · cat=${categorySlug ?? "—"} · tel=${row.phone ?? "—"} · horarios=${hours.length ? "sí" : "no"}`,
    );
    exportRows.push({
      place_id: place.id,
      name,
      address: row.address,
      category: categorySlug,
      google_type: type,
      phone: row.phone,
      website,
      instagram,
      has_hours: hours.length > 0,
      maps_url: place.googleMapsUri ?? null,
    });
    stats.imported++;
    existingSlugs.add(slug);
    existingNames.set(nameKey, "dry");
    continue;
  }

  const { data: created, error: insErr } = await db
    .from("businesses")
    .insert(row)
    .select("id")
    .single();

  if (insErr) {
    console.error(`ERROR insertando "${name}": ${insErr.message}`);
    stats.errors++;
    continue;
  }

  if (categoryId) {
    const { error } = await db
      .from("business_categories")
      .insert({ business_id: created.id, category_id: categoryId });
    if (error)
      console.error(`  aviso: categoría de "${name}": ${error.message}`);
  }

  if (hours.length) {
    const { error } = await db
      .from("business_hours")
      .insert(hours.map((h) => ({ ...h, business_id: created.id })));
    if (error)
      console.error(`  aviso: horarios de "${name}": ${error.message}`);
  }

  ledger[place.id] = created.id;
  existingSlugs.add(slug);
  existingNames.set(nameKey, created.id);
  stats.imported++;
  console.log(`OK  ${name} → ${slug}`);

  if (stats.imported % 20 === 0)
    writeFileSync(LEDGER_FILE, JSON.stringify(ledger, null, 2));
}

if (APPLY) writeFileSync(LEDGER_FILE, JSON.stringify(ledger, null, 2));

// --export: guarda lo que se importaría (solo dry-run) en JSON y CSV
if (!APPLY && args.includes("--export")) {
  const jsonPath = join(DATA_DIR, "pendientes-revision.json");
  const csvPath = join(DATA_DIR, "pendientes-revision.csv");
  writeFileSync(jsonPath, JSON.stringify(exportRows, null, 2));

  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = [
    "nombre",
    "direccion",
    "categoria",
    "tipo_google",
    "telefono",
    "web",
    "instagram",
    "tiene_horarios",
    "google_maps",
  ];
  const csv = [
    header.join(","),
    ...exportRows.map((r) =>
      [
        esc(r.name),
        esc(r.address),
        esc(r.category),
        esc(r.google_type),
        esc(r.phone),
        esc(r.website),
        esc(r.instagram),
        r.has_hours ? "si" : "no",
        esc(r.maps_url),
      ].join(","),
    ),
  ].join("\n");
  writeFileSync(csvPath, "﻿" + csv); // BOM para que Excel abra bien los acentos
  console.log(`\nExport para revisión:\n  ${jsonPath}\n  ${csvPath}`);
}

console.log(
  `\n== Resumen ${APPLY ? "(APLICADO)" : "(dry-run, nada se escribió)"} ==`,
);
console.log(`Importados: ${stats.imported}`);
console.log(`Duplicados salteados: ${stats.dupes}`);
console.log(`Salteados por tipo (no comercios): ${stats.skippedType}`);
console.log(`Errores: ${stats.errors}`);

if (Object.keys(unmappedTypes).length) {
  console.log(
    `\nTipos sin categoría asignada (importados igual, revisar en admin):`,
  );
  for (const [type, count] of Object.entries(unmappedTypes).sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`  ${String(count).padStart(4)}  ${type}`);
  }
  console.log(
    `Sugerencia: crear categorías nuevas (ej. Indumentaria) o ampliar TYPE_TO_CATEGORY.`,
  );
}
