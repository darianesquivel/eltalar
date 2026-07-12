import type { APIRoute } from "astro";
import { supabase } from "../lib/supabase";

// Sitemap dinámico: incluye las páginas fijas + una URL por negocio activo
// DEL BARRIO del dominio consultado. Al ser SSR, se actualiza sin re-deploy.
export const GET: APIRoute = async ({ locals }) => {
  const { barrio } = locals;
  const base = barrio.url.replace(/\/$/, "");

  const staticPaths = [
    "/",
    "/negocios",
    "/farmacias",
    "/telefonos",
    "/mapa",
    "/anunciate",
    "/ofertas",
    "/eventos",
  ];

  // En páginas de a 1000: Supabase corta cualquier consulta en 1000 filas y
  // hay más negocios que eso — sin paginar, el sitemap quedaba incompleto.
  const PAGE = 1000;
  const businesses: { slug: string }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await supabase
      .from("businesses")
      .select("slug")
      .eq("barrio_id", barrio.id)
      .eq("is_active", true)
      .order("id")
      .range(from, from + PAGE - 1);

    businesses.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }

  const urls = [
    ...staticPaths.map((p) => `${base}${p}`),
    ...businesses.map((b) => `${base}/negocios/${b.slug}`),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${url}</loc></url>`).join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
