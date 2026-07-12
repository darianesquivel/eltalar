import { defineMiddleware } from "astro:middleware";
import { createSupabaseServer } from "./lib/supabase/server";
import { resolveBarrio } from "./lib/barrio";

// Rutas de /app accesibles sin sesión
const PUBLIC_APP_PATHS = ["/app/login", "/app/auth"];

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  context.locals.user = null;
  context.locals.isAdmin = false;

  // Multi-barrio: el dominio del request define qué portal se sirve
  // (cacheado en memoria; localhost y previews caen al barrio default)
  context.locals.barrio = await resolveBarrio(context.url.hostname);

  // Canje del magic link en CUALQUIER página: si la config de Supabase manda
  // el ?code= a un destino inesperado (p.ej. la home), igual iniciamos sesión
  // acá en el servidor y seguimos al panel.
  const code = context.url.searchParams.get("code");
  if (code && !pathname.startsWith("/api")) {
    const supabase = createSupabaseServer(context);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return context.redirect("/app");
    }
    // código vencido/ya usado: seguimos sin sesión (el usuario pide otro link)
  }

  // Solo el panel (/app/*) requiere sesión; el resto del sitio es público.
  if (!pathname.startsWith("/app")) {
    return next();
  }

  const supabase = createSupabaseServer(context);

  // En paralelo: validar sesión y consultar rol admin (ahorra un round-trip
  // a Supabase en cada página del panel; is_admin sin sesión devuelve false)
  const [
    {
      data: { user },
    },
    { data: isAdmin },
  ] = await Promise.all([supabase.auth.getUser(), supabase.rpc("is_admin")]);

  context.locals.user = user;

  if (!user && !PUBLIC_APP_PATHS.includes(pathname)) {
    return context.redirect("/app/login");
  }

  if (user) {
    context.locals.isAdmin = isAdmin === true;

    if (pathname.startsWith("/app/admin") && !context.locals.isAdmin) {
      return context.redirect("/app");
    }

    // El admin vive en su panel de control, no en el panel de comercios
    if (
      context.locals.isAdmin &&
      (pathname === "/app" || pathname === "/app/")
    ) {
      return context.redirect("/app/admin");
    }
  }

  return next();
});
