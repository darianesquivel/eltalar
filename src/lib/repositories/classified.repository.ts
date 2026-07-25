import { supabase } from "../supabase";
import type { Database } from "../database.types";

export type Classified =
  Database["public"]["Tables"]["classifieds"]["Row"];

export type ClassifiedCategory =
  | "venta"
  | "servicios"
  | "pedidos"
  | "empleo"
  | "mascotas";

/** Rubro de los avisos: etiqueta y color del chip (uno por categoría). */
export const CLASSIFIED_CATEGORIES: {
  slug: ClassifiedCategory;
  label: string;
  bg: string;
  fg: string;
}[] = [
  { slug: "venta", label: "Venta", bg: "#e7f0f8", fg: "#2e6595" },
  { slug: "servicios", label: "Servicios", bg: "#e9f6ee", fg: "#0b7a3f" },
  { slug: "pedidos", label: "Pedidos", bg: "#fff2ee", fg: "#c0463a" },
  { slug: "empleo", label: "Empleo", bg: "#fff7e6", fg: "#a5761a" },
  { slug: "mascotas", label: "Mascotas", bg: "#f1ecfa", fg: "#67489e" },
];

export const classifiedCategory = (slug: string) =>
  CLASSIFIED_CATEGORIES.find((c) => c.slug === slug) ??
  CLASSIFIED_CATEGORIES[0];

export function isClassifiedCategory(
  value: unknown,
): value is ClassifiedCategory {
  return CLASSIFIED_CATEGORIES.some((c) => c.slug === value);
}

/**
 * Avisos publicados y vigentes del barrio, del más nuevo al más viejo.
 * La RLS ya filtra pendientes y vencidos; los filtros explícitos están
 * igual para que el admin (que los ve todos) no los mezcle.
 */
export async function getPublishedClassifieds(
  barrioId: string,
  options: { category?: string | null; limit?: number } = {},
): Promise<Classified[]> {
  const { category, limit = 60 } = options;

  let query = supabase
    .from("classifieds")
    .select("*")
    .eq("barrio_id", barrioId)
    .eq("status", "published")
    .gt("expires_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .limit(limit);

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error("Error getPublishedClassifieds:", error);
    return [];
  }

  return data;
}

/** Cuántos avisos vigentes hay por categoría (contadores de los chips). */
export async function getClassifiedCounts(
  barrioId: string,
): Promise<{ total: number; byCategory: Record<string, number> }> {
  const { data, error } = await supabase
    .from("classifieds")
    .select("category")
    .eq("barrio_id", barrioId)
    .eq("status", "published")
    .gt("expires_at", new Date().toISOString());

  if (error || !data) {
    if (error) console.error("Error getClassifiedCounts:", error);
    return { total: 0, byCategory: {} };
  }

  const byCategory: Record<string, number> = {};
  for (const { category } of data) {
    byCategory[category] = (byCategory[category] ?? 0) + 1;
  }

  return { total: data.length, byCategory };
}
