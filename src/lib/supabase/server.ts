import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import type { AstroCookies } from "astro";
import type { Database } from "../database.types";

type ServerContext = {
  request: Request;
  cookies: AstroCookies;
};

// Corte de red: sin esto, un bache de conexión a Supabase deja la página
// colgada ~21 s (undici reintenta con 10 s de timeout cada vez). Lo normal
// son 0,1 s, así que a los 8 s ya no vale la pena esperar: es mejor mostrar
// la página sin sesión que dejar al vecino mirando el navegador cargar.
const FETCH_TIMEOUT_MS = 8000;

const fetchConTimeout: typeof fetch = (input, init) =>
  fetch(input, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });

/**
 * Cliente de Supabase para el SERVIDOR (middleware, páginas SSR, endpoints).
 * Lee y escribe la sesión en cookies, así el login persiste entre requests.
 */
export function createSupabaseServer({ request, cookies }: ServerContext) {
  return createServerClient<Database>(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    {
      global: { fetch: fetchConTimeout },
      cookies: {
        getAll() {
          return parseCookieHeader(request.headers.get("cookie") ?? "").map(
            ({ name, value }) => ({ name, value: value ?? "" }),
          );
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookies.set(name, value, options),
          );
        },
      },
    },
  );
}
