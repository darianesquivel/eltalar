import { supabase } from "../supabase";
import type { Database } from "../database.types";
import {
  nowInArgentina,
  todayInArgentina,
  type BusinessHour,
} from "../hours";

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

/**
 * Versión liviana para listados: SOLO las columnas que pintan las cards
 * (guía, home, scroll infinito) y sin el array completo de fotos. Traer `*`
 * arrastraba services, SEO, owner_id, etc. en cada tanda de 24 negocios.
 */
export type BusinessSummary = Pick<
  BusinessRow,
  | "id"
  | "name"
  | "slug"
  | "address"
  | "phone"
  | "whatsapp"
  | "whatsapp_message"
  | "description"
  | "is_featured"
  | "by_appointment"
  | "rating_avg"
  | "rating_count"
> & {
  business_hours: BusinessHour[];
  categories: Category[];
  coverPhoto: BusinessPhoto | null;
  offers: BusinessOffer[];
};

/** Select liviano para listados (las columnas de BusinessSummary). */
const LIST_SELECT = `
  id, name, slug, address, phone, whatsapp, whatsapp_message, description,
  is_featured, priority, by_appointment, rating_avg, rating_count,
  business_categories ( categories ( id, name, slug, icon ) ),
  business_hours ( day_of_week, open_time, close_time, is_closed, is_open_24 ),
  business_photos ( id, url, is_cover, position ),
  business_offers ( id, title, description, expires_at )
`;

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

export type BusinessPage = {
  items: BusinessSummary[];
  total: number;
};

/** Orden del listado público. "destacados" = pagos, después reclamados,
 *  después el resto (default). */
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
  /** Puntaje mínimo (filtro "4★ o más" de la guía). */
  minRating?: number | null;
  /** Solo los que tienen alguna oferta vigente. */
  onlyOffers?: boolean;
  /** Solo los que están abiertos en este momento (hora de Argentina). */
  openNow?: boolean;
}

// Con el join normal PostgREST solo vacía el array embebido y devuelve el
// negocio igual: para que un filtro EXCLUYA filas, el join tiene que ser
// !inner. Se arma el select según qué filtros vengan.
function buildSelect(opciones: {
  categorySlug?: string | null;
  onlyOffers?: boolean;
  openNow?: boolean;
}) {
  let select = LIST_SELECT;

  if (opciones.categorySlug) {
    select = select.replace(
      "business_categories ( categories (",
      "business_categories!inner ( categories!inner (",
    );
  }

  if (opciones.onlyOffers) {
    select = select.replace("business_offers (", "business_offers!inner (");
  }

  if (opciones.openNow) {
    select = select.replace("business_hours (", "business_hours!inner (");
  }

  return select;
}

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
    minRating,
    onlyOffers,
    openNow,
  } = options;

  let query = supabase
    .from("businesses")
    .select(buildSelect({ categorySlug, onlyOffers, openNow }), {
      count: "exact",
    })
    .eq("barrio_id", barrioId)
    .eq("is_active", true);

  if (categorySlug) {
    query = query.eq("business_categories.categories.slug", categorySlug);
  }

  if (onlyOffers) {
    // Vigentes: la fecha de vencimiento todavía no pasó
    query = query.gte("business_offers.expires_at", todayInArgentina());
  }

  if (openNow) {
    // Abierto = un tramo de HOY que incluye la hora actual (o 24 hs), o un
    // tramo NOCTURNO de ayer que todavía no cerró (viernes 20:00–02:00 a la
    // 01:00 del sábado). `is_overnight` es una columna generada en la base
    // (close_time < open_time): PostgREST no puede comparar columna contra
    // columna en un filtro. Los que atienden con turno no cuentan.
    const { day, time } = nowInArgentina();
    const yesterday = (day + 6) % 7;
    query = query
      .eq("by_appointment", false)
      .eq("business_hours.is_closed", false)
      .or(
        `and(day_of_week.eq.${day},or(is_open_24.is.true,and(open_time.lte.${time},close_time.gte.${time}),and(is_overnight.is.true,open_time.lte.${time}))),` +
          `and(day_of_week.eq.${yesterday},is_overnight.is.true,close_time.gte.${time})`,
        { referencedTable: "business_hours" },
      );
  }

  if (minRating) {
    query = query.gte("rating_avg", minRating);
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
    // Pagos primero, después reclamados (has_owner: columna generada sobre
    // owner_id), después el resto; alfabético adentro de cada grupo.
    query = query
      .order("is_featured", { ascending: false })
      .order("has_owner", { ascending: false })
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

// Los contadores salen de la vista category_counts (un group by en la base,
// UNA consulta). Antes eran ~25 consultas HEAD en paralelo y le costaban más
// de un segundo de TTFB a la home y a la guía.
// Se cachean igual en memoria: cambian de a un negocio por vez.
const COUNTS_TTL_MS = 5 * 60 * 1000;
const countsCache = new Map<string, { at: number; value: CategoryCounts }>();

export async function getCategoryCounts(
  barrioId: string,
  // Solo lo usa el fallback (si la vista no existe); puede ir vacío y el
  // fallback busca los slugs solo. Así la consulta entra al Promise.all de
  // la página en vez de ser un round-trip en serie.
  slugs: string[] = [],
): Promise<CategoryCounts> {
  const cached = countsCache.get(barrioId);
  if (cached && Date.now() - cached.at < COUNTS_TTL_MS) return cached.value;

  const [countsRes, totalRes] = await Promise.all([
    supabase
      .from("category_counts")
      .select("slug, total")
      .eq("barrio_id", barrioId),
    supabase
      .from("businesses")
      .select("id", { count: "exact", head: true })
      .eq("barrio_id", barrioId)
      .eq("is_active", true),
  ]);

  // Si la vista todavía no existe en este entorno, se cae al método viejo
  // en vez de mostrar todos los rubros en cero.
  if (countsRes.error) {
    console.error("Error category_counts:", countsRes.error);
    return getCategoryCountsFallback(barrioId, slugs, totalRes.count ?? 0);
  }

  const bySlug: Record<string, number> = {};
  for (const row of countsRes.data ?? []) {
    bySlug[row.slug] = row.total;
  }

  const value: CategoryCounts = { bySlug, total: totalRes.count ?? 0 };
  countsCache.set(barrioId, { at: Date.now(), value });
  return value;
}

/** Conteo rubro por rubro (una consulta HEAD por rubro). Solo de respaldo. */
async function getCategoryCountsFallback(
  barrioId: string,
  slugs: string[],
  total: number,
): Promise<CategoryCounts> {
  if (slugs.length === 0) {
    const { data } = await supabase.from("categories").select("slug");
    slugs = (data ?? []).map((c) => c.slug);
  }

  const perSlug = await Promise.all(
    slugs.map((slug) =>
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
  );

  const bySlug: Record<string, number> = {};
  slugs.forEach((slug, i) => {
    bySlug[slug] = perSlug[i].count ?? 0;
  });

  const value: CategoryCounts = { bySlug, total };
  countsCache.set(barrioId, { at: Date.now(), value });
  return value;
}

/**
 * Negocios abiertos EN ESTE MOMENTO, para la home.
 *
 * Mismo camino que la guía con ?abierto=1: el "está abierto" se resuelve
 * EN LA BASE (filtro or() + is_overnight) y vuelven solo los `limit` que
 * se muestran, ya ordenados (pagos > reclamados > resto). El camino viejo
 * (traer los horarios y decidir en memoria) cortaba en 1000 filas por
 * orden de uuid y podía dejar un pago afuera de la home.
 */
export async function getOpenNowBusinesses(
  barrioId: string,
  limit = 4,
): Promise<BusinessSummary[]> {
  const { items } = await getBusinessesPage({ barrioId, limit, openNow: true });
  return items;
}

/**
 * ¿Ya hay algún negocio con reseñas publicadas en el barrio?
 * La guía lo usa para habilitar el filtro "4★ o más": mientras no haya
 * puntajes, el chip queda apagado en vez de devolver una lista vacía.
 * Devuelve false también si la migración de reseñas todavía no se corrió.
 */
export async function hasRatings(barrioId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("businesses")
    .select("id", { count: "exact", head: true })
    .eq("barrio_id", barrioId)
    .eq("is_active", true)
    .gt("rating_count", 0);

  if (error) return false;
  return (count ?? 0) > 0;
}

export async function getBusinessBySlug(
  slug: string,
  barrioId: string,
): Promise<Business | null> {
  // El slug es único POR BARRIO: dos barrios pueden tener "kiosco-central".
  // maybeSingle: un slug inexistente es un 404 normal, no un error para el log.
  const { data, error } = await supabase
    .from("businesses")
    .select(BUSINESS_SELECT)
    .eq("barrio_id", barrioId)
    .eq("is_active", true)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("Error getBusinessBySlug:", error);
    return null;
  }

  return data ? toBusiness(data) : null;
}
