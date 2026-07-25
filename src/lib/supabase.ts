import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

// Mismo corte de red que supabase/server.ts: sin esto, un bache de conexión
// a Supabase deja las páginas públicas colgadas ~21 s (undici reintenta con
// 10 s de timeout cada vez). A los 8 s es mejor renderizar sin datos.
const FETCH_TIMEOUT_MS = 8000;

const fetchConTimeout: typeof fetch = (input, init) =>
  fetch(input, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });

// Cliente anónimo de solo lectura para las páginas públicas SSR: nunca tiene
// sesión, así que se apagan la persistencia y el refresh automático (evita
// timers y estado de auth colgando dentro de la función de Vercel).
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchConTimeout },
  auth: { persistSession: false, autoRefreshToken: false },
});
