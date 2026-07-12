import type { APIRoute } from "astro";

/**
 * Autocompletado de direcciones para el formulario de negocios.
 *
 *   GET /api/direcciones?q=peru 74        → { suggestions: [{ placeId, texto }] }
 *   GET /api/direcciones?placeId=ChIJ...  → { address, lat, lng }
 *
 * Proxy a Places API (New) DEL LADO DEL SERVIDOR: la key de Google nunca
 * llega al navegador. El sesgo geográfico apunta al barrio del dominio.
 */

const json = (body: object, status = 200, cache = false) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      // Las direcciones no cambian: cache larga en el CDN por URL
      ...(cache && { "Cache-Control": "public, s-maxage=86400" }),
    },
  });

export const GET: APIRoute = async ({ url, locals }) => {
  const apiKey = import.meta.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return json({ error: "Geocoding no configurado" }, 500);

  const { barrio } = locals;

  const placeId = url.searchParams.get("placeId");
  const q = url.searchParams.get("q")?.trim() ?? "";

  // --- Resolver una sugerencia elegida → dirección + coordenadas ---
  if (placeId) {
    if (!/^[A-Za-z0-9_-]{10,200}$/.test(placeId)) {
      return json({ error: "placeId inválido" }, 400);
    }
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}?languageCode=es`,
      {
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "shortFormattedAddress,formattedAddress,location",
        },
      },
    );
    if (!res.ok)
      return json({ error: "No pudimos resolver la dirección" }, 502);
    const p = await res.json();
    return json(
      {
        address: p.shortFormattedAddress ?? p.formattedAddress ?? null,
        lat: p.location ? Math.round(p.location.latitude * 1e5) / 1e5 : null,
        lng: p.location ? Math.round(p.location.longitude * 1e5) / 1e5 : null,
      },
      200,
      true,
    );
  }

  // --- Sugerencias mientras se tipea ---
  if (q.length < 4 || q.length > 120)
    return json({ suggestions: [] }, 200, true);

  const res = await fetch(
    "https://places.googleapis.com/v1/places:autocomplete",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey },
      body: JSON.stringify({
        input: q,
        languageCode: "es",
        includedRegionCodes: ["ar"],
        // SOLO la zona del barrio (centro/radio de la tabla barrios): con el
        // sesgo a secas, "Perú 749" sugería primero la calle Perú de CABA
        locationRestriction: {
          circle: {
            center: { latitude: barrio.lat, longitude: barrio.lng },
            radius: barrio.radius_m,
          },
        },
      }),
    },
  );
  if (!res.ok) return json({ suggestions: [] }, 200);

  const data = await res.json();
  const suggestions = (data.suggestions ?? [])
    .map((s: any) => s.placePrediction)
    .filter(Boolean)
    .slice(0, 5)
    .map((p: any) => ({ placeId: p.placeId, texto: p.text?.text ?? "" }));

  return json({ suggestions }, 200, true);
};
