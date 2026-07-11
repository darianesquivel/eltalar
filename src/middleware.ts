import { defineMiddleware } from "astro:middleware";
import { createSupabaseServer } from "./lib/supabase/server";

// Rutas de /app accesibles sin sesión
const PUBLIC_APP_PATHS = ["/app/login", "/app/auth"];

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  context.locals.user = null;
  context.locals.isAdmin = false;

  // Solo el panel (/app/*) requiere sesión; el resto del sitio es público.
  if (!pathname.startsWith("/app")) {
    return next();
  }

  const supabase = createSupabaseServer(context);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  context.locals.user = user;

  if (!user && !PUBLIC_APP_PATHS.includes(pathname)) {
    return context.redirect("/app/login");
  }

  if (user) {
    const { data: isAdmin } = await supabase.rpc("is_admin");
    context.locals.isAdmin = isAdmin === true;

    if (pathname.startsWith("/app/admin") && !context.locals.isAdmin) {
      return context.redirect("/app");
    }
  }

  return next();
});
