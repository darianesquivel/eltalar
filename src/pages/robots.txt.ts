import type { APIRoute } from "astro";

// robots.txt dinámico: el Sitemap tiene que apuntar al dominio del barrio
// que atendió el request (un deploy sirve varios dominios). El archivo
// estático tenía eltalar.com.ar hardcodeado y era incorrecto para el resto.
export const GET: APIRoute = ({ locals }) => {
  const base = locals.barrio.url.replace(/\/$/, "");

  const body = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /app/

Sitemap: ${base}/sitemap.xml
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
};
