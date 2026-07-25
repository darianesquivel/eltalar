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
 * Normaliza el precio que escribió el vecino.
 *
 * El campo es texto libre a propósito ("A convenir", "2x1", "Gratis"), pero
 * cuando cargan solo números hay que mostrarlos como plata: "85000" se ve
 * mal en la card. Si no es un número, se respeta tal cual lo escribió.
 */
export function formatPriceText(raw: unknown): string | null {
  // `unknown`: llega directo del JSON del request; un número u objeto
  // rompía el .trim() con un 500
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return null;

  // "$ 85.000", "85000", "85,50" → dígitos con separador decimal normalizado
  const numeric = value.replace(/[$\s.]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(numeric)) return value;

  const amount = Number(numeric);
  if (!Number.isFinite(amount)) return value;

  return `$${amount.toLocaleString("es-AR", {
    maximumFractionDigits: 2,
  })}`;
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

/**
 * Cuántos avisos vigentes hay por categoría (contadores de los chips).
 * Consultas HEAD con count: viaja solo el número. Antes se bajaba una fila
 * por aviso para contarlas en JS, y el corte de 1000 filas de PostgREST
 * hubiera dejado los contadores mentirosos al crecer la tabla.
 */
export async function getClassifiedCounts(
  barrioId: string,
): Promise<{ total: number; byCategory: Record<string, number> }> {
  const now = new Date().toISOString();

  const countWhere = (category?: string) => {
    let query = supabase
      .from("classifieds")
      .select("id", { count: "exact", head: true })
      .eq("barrio_id", barrioId)
      .eq("status", "published")
      .gt("expires_at", now);
    if (category) query = query.eq("category", category);
    return query;
  };

  const [totalRes, ...perCategory] = await Promise.all([
    countWhere(),
    ...CLASSIFIED_CATEGORIES.map((c) => countWhere(c.slug)),
  ]);

  if (totalRes.error) {
    console.error("Error getClassifiedCounts:", totalRes.error);
    return { total: 0, byCategory: {} };
  }

  const byCategory: Record<string, number> = {};
  CLASSIFIED_CATEGORIES.forEach((c, i) => {
    byCategory[c.slug] = perCategory[i].count ?? 0;
  });

  return { total: totalRes.count ?? 0, byCategory };
}
