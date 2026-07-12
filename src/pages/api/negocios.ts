import type { APIRoute } from "astro";
import { getBusinessesPage } from "../../lib/repositories/business.repository";

/**
 * Paginado del listado público de negocios.
 * GET /api/negocios?categoria=<slug>&buscar=<texto>&offset=0&limit=24
 * Responde { items, total }; lo consume BusinessGrid para el scroll infinito.
 */
export const GET: APIRoute = async ({ url, locals }) => {
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit")) || 24, 1),
    48,
  );
  const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);

  const page = await getBusinessesPage({
    barrioId: locals.barrio.id,
    limit,
    offset,
    categorySlug: url.searchParams.get("categoria"),
    search: url.searchParams.get("buscar"),
  });

  return new Response(JSON.stringify(page), {
    headers: {
      "Content-Type": "application/json",
      // Cache corto en el CDN de Vercel: absorbe ráfagas de scroll/búsqueda
      // sin que un cambio en la base tarde más de un minuto en verse.
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
};
