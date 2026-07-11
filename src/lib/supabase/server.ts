import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import type { AstroCookies } from "astro";
import type { Database } from "../database.types";

type ServerContext = {
  request: Request;
  cookies: AstroCookies;
};

/**
 * Cliente de Supabase para el SERVIDOR (middleware, páginas SSR, endpoints).
 * Lee y escribe la sesión en cookies, así el login persiste entre requests.
 */
export function createSupabaseServer({ request, cookies }: ServerContext) {
  return createServerClient<Database>(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    {
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
