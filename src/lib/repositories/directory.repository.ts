import { supabase } from "../supabase";
import type { Database } from "../database.types";

export type DirectoryEntry =
  Database["public"]["Tables"]["directory_entries"]["Row"];

/**
 * Teléfonos útiles del barrio, ordenados por posición.
 * `is_priority = true` son las cards grandes de Emergencias.
 */
export async function getDirectoryEntries(): Promise<DirectoryEntry[]> {
  const { data, error } = await supabase
    .from("directory_entries")
    .select("*")
    .eq("is_active", true)
    .order("position");

  if (error || !data) {
    console.error("Error getDirectoryEntries:", error);
    return [];
  }

  return data;
}
