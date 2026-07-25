import { supabase } from "../supabase";
import type { Database } from "../database.types";

export type Review = Database["public"]["Tables"]["reviews"]["Row"];

/** Resumen de puntaje de un negocio, listo para pintar la ficha. */
export type RatingSummary = {
  average: number | null;
  total: number;
  /** Cuántas reseñas hay de cada puntaje: [1★, 2★, 3★, 4★, 5★]. */
  distribution: [number, number, number, number, number];
};

const EMPTY_SUMMARY: RatingSummary = {
  average: null,
  total: 0,
  distribution: [0, 0, 0, 0, 0],
};

/**
 * Reseñas publicadas de un negocio, de la más nueva a la más vieja.
 * La RLS ya filtra las pendientes y rechazadas para el público; el filtro
 * explícito está igual para que el admin (que las ve todas) no las mezcle.
 */
export async function getPublishedReviews(
  businessId: string,
  limit = 20,
): Promise<Review[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("business_id", businessId)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    console.error("Error getPublishedReviews:", error);
    return [];
  }

  return data;
}

/**
 * Promedio, total y distribución por estrella.
 * Se calcula sobre los puntajes traídos (una columna, filas chicas): el
 * promedio desnormalizado de businesses sirve para las cards, pero la
 * ficha necesita además las 5 barras.
 */
export async function getRatingSummary(
  businessId: string,
): Promise<RatingSummary> {
  const { data, error } = await supabase
    .from("reviews")
    .select("rating")
    .eq("business_id", businessId)
    .eq("status", "published");

  if (error || !data || data.length === 0) {
    if (error) console.error("Error getRatingSummary:", error);
    return EMPTY_SUMMARY;
  }

  const distribution: RatingSummary["distribution"] = [0, 0, 0, 0, 0];
  let sum = 0;

  for (const { rating } of data) {
    sum += rating;
    if (rating >= 1 && rating <= 5) distribution[rating - 1]++;
  }

  return {
    average: Math.round((sum / data.length) * 10) / 10,
    total: data.length,
    distribution,
  };
}
