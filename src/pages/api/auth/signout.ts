import type { APIRoute } from "astro";
import { createSupabaseServer } from "../../../lib/supabase/server";

/**
 * Cierra la sesión y vuelve a donde corresponda: el panel manda a la
 * página de ingreso; el menú del sitio público manda a la home. El destino
 * viaja en el form como `next` y solo se aceptan rutas internas, para no
 * dejar un redirect abierto.
 */
export const POST: APIRoute = async (context) => {
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
