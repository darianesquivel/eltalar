import { supabase } from "../supabase";
import type { Database } from "../database.types";
import { todayInArgentina } from "../hours";

export type EventRow = Database["public"]["Tables"]["events"]["Row"];

/**
 * Eventos vigentes para la página pública: activos y que todavía no pasaron.
 * Un evento se muestra hasta el final de su día (o de end_date si dura varios
 * días); al día siguiente desaparece solo.
 */
/** Un evento del barrio por id (lo usa el .ics de "Agendar"). */
export async function getEventById(
  id: string,
  barrioId: string,
): Promise<EventRow | null> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .eq("barrio_id", barrioId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("Error getEventById:", error);
    return null;
  }

  return data;
}

export async function getUpcomingEvents(barrioId: string): Promise<EventRow[]> {
  const today = todayInArgentina();

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("barrio_id", barrioId)
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
