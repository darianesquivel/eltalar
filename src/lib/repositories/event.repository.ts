import { supabase } from "../supabase";
import type { Database } from "../database.types";
import { todayInArgentina } from "../hours";

export type EventRow = Database["public"]["Tables"]["events"]["Row"];

/**
 * Eventos vigentes para la página pública: activos y que todavía no pasaron.
 * Un evento se muestra hasta el final de su día (o de end_date si dura varios
 * días); al día siguiente desaparece solo.
 */
export async function getUpcomingEvents(): Promise<EventRow[]> {
  const today = todayInArgentina();

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("is_active", true)
    .or(`end_date.gte.${today},and(end_date.is.null,date.gte.${today})`)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error || !data) {
    console.error("Error getUpcomingEvents:", error);
    return [];
  }

  return data;
}
