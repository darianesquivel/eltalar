import { supabaseBrowser } from "./supabase/browser";

export type TrackEvent =
  "view" | "whatsapp" | "phone" | "instagram" | "website";

/**
 * Registra un evento anónimo del negocio (vista de ficha, click a WhatsApp…).
 * Fire-and-forget: jamás bloquea ni rompe la UI si falla.
 */
export function track(businessId: string, event: TrackEvent) {
  supabaseBrowser
    .from("business_events")
    .insert({ business_id: businessId, event })
    .then(({ error }) => {
      if (error) console.debug("track:", error.message);
    });
}
