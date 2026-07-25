import { supabase } from "../supabase";
import type { Database } from "../database.types";
import { todayInArgentina, type BusinessHour } from "../hours";

/* =======================
   TYPES
======================= */

type BusinessRow = Database["public"]["Tables"]["businesses"]["Row"];

export type Category = Pick<
  Database["public"]["Tables"]["categories"]["Row"],
  "id" | "name" | "slug" | "icon"
>;

export type BusinessPhoto = Pick<
  Database["public"]["Tables"]["business_photos"]["Row"],
  "id" | "url" | "is_cover" | "position"
>;

export type BusinessOffer = Pick<
  Database["public"]["Tables"]["business_offers"]["Row"],
  "id" | "title" | "description" | "expires_at"
>;

/** Negocio ya "aplanado" para consumo de la UI. */
export type Business = BusinessRow & {
  business_hours: BusinessHour[];
  categories: Category[];
  coverPhoto: BusinessPhoto | null;
  photos: BusinessPhoto[];
  /** Ofertas vigentes (la RLS ya filtra las vencidas para el público). */
  offers: BusinessOffer[];
};

/** Versión liviana para listados: sin el array completo de fotos
 * (las cards solo usan coverPhoto; evita duplicar peso en el HTML). */
export type BusinessSummary = Omit<Business, "photos">;

interface GetBusinessesOptions {
  /** Multi-barrio: cada portal solo lista los negocios de su barrio. */
  barrioId: string;
  featured?: boolean;
  limit?: number;
}

const BUSINESS_SELECT = `
  *,
  business_categories (
    categories (
      id,
      name,
      slug,
      icon
    )
  ),
  business_hours (
    day_of_week,
    open_time,
    close_time,
    is_closed,
    is_open_24
  ),
  business_photos (
    id,
    url,
    is_cover,
    position
  ),
  business_offers (
    id,
    title,
    description,
    expires_at
  )
`;

/** Aplana la respuesta cruda de Supabase al shape que usa la UI. */
function toBusiness(raw: any): Business {
  const photos: BusinessPhoto[] = Array.isArray(raw.business_photos)
    ? raw.business_photos
    : [];

  const coverPhoto =
    photos.find((p) => p.is_cover) ||
    photos.slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0] ||
    null;

  // La RLS ya oculta las ofertas vencidas al público, pero el dueño/admin
  // las ve todas: acá filtramos vigentes para que la UI pública sea uniforme.
  const today = todayInArgentina();
  const offers: BusinessOffer[] = (raw.business_offers ?? [])
    .filter((o: BusinessOffer) => o.expires_at >= today)
    .sort((a: BusinessOffer, b: BusinessOffer) =>
      a.expires_at.localeCompare(b.expires_at),
    );

  return {
    ...raw,
    categories: raw.business_categories?.map((bc: any) => bc.categories) ?? [],
    coverPhoto,
    photos,
    offers,
  };
}

/* =======================
   QUERIES
======================= */

export async function getBusinesses(
  options: GetBusinessesOptions,
): Promise<Business[]> {
  const { barrioId, featured, limit } = options;

  let query = supabase
    .from("businesses")
    .select(BUSINESS_SELECT)
    .eq("barrio_id", barrioId)
    .eq("is_active", true)
    // Los destacados (plan pago) van primero en todo listado
    .order("is_featured", { ascending: false })
    .order("priority", { ascending: false });

  if (featured === true) {
    query = query.eq("is_featured", true);
  }

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error("Error getBusinesses:", error);
    return [];
  }

  // El estado abierto/cerrado NO se calcula acá: depende de la hora del que mira,
  // así que lo calcula cada componente (getTodayStatus de lib/hours) al renderizar.
  return data.map(toBusiness);
}

export type BusinessPage = {
  items: BusinessSummary[];
  total: number;
};

/** Orden del listado público. "destacados" = los pagos primero (default). */
export type BusinessOrder = "destacados" | "nombre";

export function parseBusinessOrder(value: string | null): BusinessOrder {
  return value === "nombre" ? "nombre" : "destacados";
}

export interface GetBusinessesPageOptions {
  /** Multi-barrio: cada portal solo lista los negocios de su barrio. */
  barrioId: string;
  limit?: number;
  offset?: number;
  categorySlug?: string | null;
  search?: string | null;
  order?: BusinessOrder;
}

// Variante con joins !inner: al filtrar por categoría, el join tiene que ser
// inner para que el filtro excluya filas (con el join normal, PostgREST solo
// vacía el array embebido y devuelve el negocio igual).
const BUSINESS_SELECT_BY_CATEGORY = BUSINESS_SELECT.replace(
  "business_categories (\n    categories (",
  "business_categories!inner (\n    categories!inner (",
);

/**
 * Página de negocios para el listado público: filtra y pagina EN LA BASE.
 * Con ~1700 negocios, mandar todo al cliente era inviable; acá viaja solo
 * la tanda pedida y el total (para el contador y el corte del scroll).
 */
export async function getBusinessesPage(
  options: GetBusinessesPageOptions,
): Promise<BusinessPage> {
  const {
    barrioId,
    limit = 24,
    offset = 0,
    categorySlug,
    search,
    order = "destacados",
  } = options;

  let query = supabase
    .from("businesses")
    .select(categorySlug ? BUSINESS_SELECT_BY_CATEGORY : BUSINESS_SELECT, {
      count: "exact",
    })
    .eq("barrio_id", barrioId)
    .eq("is_active", true);

  if (categorySlug) {
    query = query.eq("business_categories.categories.slug", categorySlug);
  }

  if (search) {
    // Caracteres con significado en la sintaxis .or() de PostgREST
    const q = search.replace(/[,()%\\]/g, " ").trim();
    if (q) {
      query = query.or(
        `name.ilike.%${q}%,description.ilike.%${q}%,address.ilike.%${q}%`,
      );
    }
  }

  if (order === "destacados") {
    query = query
      .order("is_featured", { ascending: false })
      .order("priority", { ascending: false });
  }

  const { data, error, count } = await query
    // Desempates estables: sin esto el paginado puede duplicar/saltear filas
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error || !data) {
    console.error("Error getBusinessesPage:", error);
    return { items: [], total: 0 };
  }

  // Payload liviano para listados: las cards solo usan coverPhoto
  const items = data.map(toBusiness).map(({ photos, ...rest }) => rest);
  return { items, total: count ?? items.length };
}

/* =======================
   CONTEO POR RUBRO
======================= */

export type CategoryCounts = {
  /** Negocios activos del barrio por slug de categoría. */
  bySlug: Record<string, number>;
  /** Total de negocios activos del barrio. */
  total: number;
};

// PostgREST no agrupa, así que el conteo es una consulta HEAD por rubro
// (~22 en paralelo, sin traer filas). Se cachea en memoria porque cambia
// de a un negocio por vez y lo piden la guía y la home en cada request.
// Si algún día molesta, el reemplazo natural es una vista materializada.
const COUNTS_TTL_MS = 5 * 60 * 1000;
const countsCache = new Map<string, { at: number; value: CategoryCounts }>();

export async function getCategoryCounts(
  barrioId: string,
  slugs: string[],
): Promise<CategoryCounts> {
  const key = `${barrioId}|${slugs.join(",")}`;
  const cached = countsCache.get(key);
  if (cached && Date.now() - cached.at < COUNTS_TTL_MS) return cached.value;

  const countActive = () =>
    supabase
      .from("businesses")
      .select("id", { count: "exact", head: true })
      .eq("barrio_id", barrioId)
      .eq("is_active", true);

  const [totalRes, ...perSlug] = await Promise.all([
    countActive(),
    ...slugs.map((slug) =>
      supabase
        .from("businesses")
        .select("id, business_categories!inner(categories!inner(slug))", {
          count: "exact",
          head: true,
        })
        .eq("barrio_id", barrioId)
        .eq("is_active", true)
        .eq("business_categories.categories.slug", slug),
    ),
  ]);

  const bySlug: Record<string, number> = {};
  slugs.forEach((slug, i) => {
    bySlug[slug] = perSlug[i].count ?? 0;
  });

  const value: CategoryCounts = { bySlug, total: totalRes.count ?? 0 };
  countsCache.set(key, { at: Date.now(), value });
  return value;
}

export async function getBusinessBySlug(
  slug: string,
  barrioId: string,
): Promise<Business | null> {
  // El slug es único POR BARRIO: dos barrios pueden tener "kiosco-central"
  const { data, error } = await supabase
    .from("businesses")
    .select(BUSINESS_SELECT)
    .eq("barrio_id", barrioId)
    .eq("slug", slug)
    .single();

  if (error || !data) {
    console.error("Error getBusinessBySlug:", error);
    return null;
  }

  return toBusiness(data);
}
