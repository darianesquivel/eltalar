import type { APIRoute } from "astro";
import { createSupabaseServer } from "../../../lib/supabase/server";

/**
 * Cierra la sesión y vuelve a donde corresponda: el panel manda a la
 * página de ingreso; el menú del sitio público manda a la home. El destino
 * viaja en el form como `next` y solo se aceptan rutas internas, para no
 * dejar un redirect abierto.
 */
export const POST: APIRoute = async (context) => {
  // El form viaja como x-www-form-urlencoded (sin preflight CORS): un sitio
  // ajeno podría desloguear al vecino con un POST cross-origin. Los
  // navegadores mandan Origin en todo POST; si viene de otro lado, afuera.
  const origin = context.request.headers.get("origin");
  if (origin && origin !== context.url.origin) {
    return new Response("forbidden", { status: 403 });
  }

  const supabase = createSupabaseServer(context);
  await supabase.auth.signOut();

  const form = await context.request.formData().catch(() => null);
  const next = form?.get("next");
  const destino =
    typeof next === "string" && next.startsWith("/") && !next.startsWith("//")
      ? next
      : "/app/login";

  return context.redirect(destino);
};
