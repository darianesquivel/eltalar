import { supabase } from "../supabase";
import type { Database } from "../database.types";
import type { BusinessHour } from "../hours";

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

/** Negocio ya "aplanado" para consumo de la UI. */
export type Business = BusinessRow & {
  business_hours: BusinessHour[];
  categories: Category[];
  coverPhoto: BusinessPhoto | null;
  photos: BusinessPhoto[];
};

/** Versión liviana para listados: sin el array completo de fotos
 * (las cards solo usan coverPhoto; evita duplicar peso en el HTML). */
export type BusinessSummary = Omit<Business, "photos">;

interface GetBusinessesOptions {
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

  return {
    ...raw,
    categories: raw.business_categories?.map((bc: any) => bc.categories) ?? [],
    coverPhoto,
    photos,
  };
}

/* =======================
   QUERIES
======================= */

export async function getBusinesses(
  options: GetBusinessesOptions = {},
): Promise<Business[]> {
  const { featured, limit } = options;

  let query = supabase
    .from("businesses")
    .select(BUSINESS_SELECT)
    .eq("is_active", true)
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

export async function getBusinessBySlug(
  slug: string,
): Promise<Business | null> {
  const { data, error } = await supabase
    .from("businesses")
    .select(BUSINESS_SELECT)
    .eq("slug", slug)
    .single();

  if (error || !data) {
    console.error("Error getBusinessBySlug:", error);
    return null;
  }

  return toBusiness(data);
}
