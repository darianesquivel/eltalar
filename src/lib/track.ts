export type TrackEvent =
  | "view"
  | "whatsapp"
  | "phone"
  | "instagram"
  | "website";

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

/**
 * Registra un evento anónimo del negocio (vista de ficha, click a WhatsApp…).
 * Fire-and-forget: jamás bloquea ni rompe la UI si falla.
 *
 * fetch con keepalive en vez del cliente de Supabase: un click en "Llamar"
 * navega a tel: en la misma pestaña y mataba el insert en vuelo — el evento
 * se perdía justo en los clicks que más importan medir. keepalive deja que
 * el request sobreviva a la navegación (mismo mecanismo que sendBeacon,
 * pero permite mandar los headers de PostgREST).
 */
export function track(businessId: string, event: TrackEvent) {
  try {
    fetch(`${SUPABASE_URL}/rest/v1/business_events`, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ business_id: businessId, event }),
    }).catch((err) => console.debug("track:", err));
  } catch (err) {
    console.debug("track:", err);
  }
}
