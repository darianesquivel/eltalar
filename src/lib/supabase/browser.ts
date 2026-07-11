import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "../database.types";

/**
 * Cliente de Supabase para el NAVEGADOR (islas React, scripts de página).
 * Comparte la sesión con el servidor vía cookies.
 */
export const supabaseBrowser = createBrowserClient<Database>(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
);
