import { createClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

/**
 * Cliente ADMIN de Supabase (service role): bypassa RLS.
 * SOLO para endpoints de servidor (webhooks). La key NUNCA es PUBLIC_.
 * Devuelve null si la env var no está configurada.
 */
export function createSupabaseAdmin() {
  const serviceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return null;

  return createClient<Database>(
    import.meta.env.PUBLIC_SUPABASE_URL,
    serviceKey,
    { auth: { persistSession: false } },
  );
}
