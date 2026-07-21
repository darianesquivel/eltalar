import type { APIRoute } from "astro";

/**
 * Autocompletado de direcciones para el formulario de negocios.
 *
 *   GET /api/direcciones?q=yrigoyen 12    → { suggestions: [{ placeId, texto }] }
 *   GET /api/direcciones?placeId=eyJh...  → { address, lat, lng }
 *
 * Backend: Photon (photon.komoot.io), un geocoder gratuito y sin API key
 * construido sobre datos de OpenStreetMap y pensado para autocompletar.
 *
 * Como Photon ya devuelve coordenadas en la misma búsqueda, no hace falta un
 * segundo pedido para "resolver" la sugerencia: metemos dirección + lat/lng
 * dentro del propio placeId (token base64url) y el paso de resolución solo lo
 * decodifica. El contrato con el frontend (dos pasos) queda igual que antes.
 */

const PHOTON_URL = "https://photon.komoot.io/api/";
// Identificarse es buena práctica con instancias públicas de OSM/Photon.
const UA = "eltalar.com.ar (autocompletado de direcciones)";

const json = (body: object, status = 200, cache = false) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      // Las direcciones no cambian: cache larga en el CDN por URL
      ...(cache && { "Cache-Control": "public, s-maxage=86400" }),
    },
  });

type Resolved = { a: string | null; lat: number | null; lng: number | null };

const encodeToken = (r: Resolved) =>
  Buffer.from(JSON.stringify(r), "utf8").toString("base64url");

const decodeToken = (token: string): Resolved =>
  JSON.parse(Buffer.from(token, "base64url").toString("utf8"));

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

/**
 * Arma "Calle 749, Localidad" a partir de las properties de Photon.
 * `altura` es el número que tipeó el usuario: OSM en Argentina casi no tiene
 * alturas, así que si Photon no la trae la reponemos con la del texto.
 */
function formatAddress(p: Record<string, any>, altura?: string | null): string {
  const calle = p.street ?? p.name ?? "";
  const nro = p.housenumber ?? altura ?? "";
  const linea1 = [calle, nro].filter(Boolean).join(" ").trim();
  const localidad = p.district ?? p.city ?? p.locality ?? p.town ?? p.village;
  return [linea1, localidad].filter(Boolean).join(", ");
}

/** Consulta Photon restringida al barrio; [] si algo falla. */
async function searchPhoton(q: string, bbox: string, lat: number, lng: number) {
  const photon = new URL(PHOTON_URL);
  photon.searchParams.set("q", q);
  photon.searchParams.set("limit", "8");
  photon.searchParams.set("lang", "default");
  photon.searchParams.set("bbox", bbox);
  // Sesgo de ranking hacia el centro del barrio.
  photon.searchParams.set("lat", String(lat));
  photon.searchParams.set("lon", String(lng));
  try {
    const res = await fetch(photon, { headers: { "User-Agent": UA } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features ?? []) as any[];
  } catch {
    return [];
  }
}

export const GET: APIRoute = async ({ url, locals }) => {
  const { barrio } = locals;

  const placeId = url.searchParams.get("placeId");
  const q = url.searchParams.get("q")?.trim() ?? "";

  // --- Resolver una sugerencia elegida → dirección + coordenadas ---
  // El token ya trae todo (lo generamos nosotros al sugerir): solo decodificar.
  if (placeId) {
    if (!/^[A-Za-z0-9_-]{10,600}$/.test(placeId)) {
      return json({ error: "placeId inválido" }, 400);
    }
    try {
      const r = decodeToken(placeId);
      return json({ address: r.a ?? null, lat: r.lat, lng: r.lng }, 200, true);
    } catch {
      return json({ error: "placeId inválido" }, 400);
    }
  }

  // --- Sugerencias mientras se tipea ---
  if (q.length < 4 || q.length > 120)
    return json({ suggestions: [] }, 200, true);

  // Caja geográfica alrededor del centro del barrio (radio en metros → grados).
  // Restringe los resultados a la zona, como hacía locationRestriction.
  const dLat = barrio.radius_m / 111_320;
  const dLng =
    barrio.radius_m / (111_320 * Math.cos((barrio.lat * Math.PI) / 180));
  const bbox = [
    barrio.lng - dLng,
    barrio.lat - dLat,
    barrio.lng + dLng,
    barrio.lat + dLat,
  ]
    .map((n) => n.toFixed(6))
    .join(",");

  // Primer intento con el texto tal cual. Si viene vacío y el usuario escribió
  // una altura al final (ej "H. Yrigoyen 1234"), reintentamos solo con la calle y
  // después le devolvemos la altura que tipeó.
  let features = await searchPhoton(q, bbox, barrio.lat, barrio.lng);
  let altura: string | null = null;
  const conAltura = q.match(/^(.+?)[\s,]+(\d{1,6})[a-zA-Z]?$/);
  if (features.length === 0 && conAltura) {
    altura = conAltura[2];
    features = await searchPhoton(conAltura[1], bbox, barrio.lat, barrio.lng);
  }

  const vistos = new Set<string>();
  const suggestions: { placeId: string; texto: string }[] = [];
  for (const f of features) {
    const texto = formatAddress(f.properties ?? {}, altura);
    if (!texto || vistos.has(texto)) continue; // dedup de segmentos repetidos
    vistos.add(texto);
    const [lon, lat] = f.geometry?.coordinates ?? [];
    suggestions.push({
      placeId: encodeToken({
        a: texto,
        lat: typeof lat === "number" ? round5(lat) : null,
        lng: typeof lon === "number" ? round5(lon) : null,
      }),
      texto,
    });
    if (suggestions.length >= 5) break;
  }

  return json({ suggestions }, 200, true);
};
