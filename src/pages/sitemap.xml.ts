import type { APIRoute } from "astro";
import { supabase } from "../lib/supabase";

// Sitemap dinámico: incluye las páginas fijas + una URL por negocio activo.
// Al ser un endpoint SSR, un negocio nuevo aparece acá sin re-deploy.
export const GET: APIRoute = async ({ site }) => {
  const base = (site ?? new URL("https://eltalar.com.ar"))
    .toString()
    .replace(/\/$/, "");

  const staticPaths = ["/", "/negocios", "/farmacias", "/telefonos"];

  const { data: businesses } = await supabase
    .from("businesses")
    .select("slug")
    .eq("is_active", true);

  const urls = [
    ...staticPaths.map((p) => `${base}${p}`),
    ...(businesses ?? []).map((b) => `${base}/negocios/${b.slug}`),
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
