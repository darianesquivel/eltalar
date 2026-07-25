import { defineMiddleware } from "astro:middleware";
import { createSupabaseServer } from "./lib/supabase/server";
import { resolveBarrio } from "./lib/barrio";

// Rutas de /app accesibles sin sesión
const PUBLIC_APP_PATHS = ["/app/login", "/app/auth"];

// Páginas públicas que puede cachear el CDN de Vercel. Son iguales para
// todos (lo único personalizado del header lo pone JavaScript en el
// navegador), así que la segunda visita se sirve desde el borde en vez de
// esperar a Supabase. 60 s de frescura + 5 min sirviendo lo viejo mientras
// se revalida en segundo plano.
const CACHEABLE_PAGES = [
  "/",
  "/negocios",
  "/ofertas",
  "/eventos",
  "/farmacias",
  "/telefonos",
  "/avisos",
  "/mapa",
  "/contacto",
  "/anunciate",
];

const isCacheablePage = (pathname: string) =>
  CACHEABLE_PAGES.includes(pathname) ||
  pathname.startsWith("/negocios/") ||
  pathname.startsWith("/telefonos/") ||
  pathname.startsWith("/farmacias/");

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
    const response = await next();

    // /avisos/nuevo depende de la sesión: nunca se cachea
    if (
      context.request.method === "GET" &&
      response.status === 200 &&
      isCacheablePage(pathname) &&
      !response.headers.has("Cache-Control")
    ) {
      response.headers.set(
        "Cache-Control",
        "public, s-maxage=60, stale-while-revalidate=300",
      );
    }

    return response;
  }

  // Ingresar y el callback no necesitan sesión resuelta en el servidor: son
  // justo las páginas que tienen que abrir siempre, aunque Supabase esté
  // lento o caído. Al que ya tiene sesión lo redirige la propia página, por
  // cookie, sin consultar nada.
  if (PUBLIC_APP_PATHS.includes(pathname)) {
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

  if (!user) {
    // `sesion=vencida` le avisa a la página de ingreso que la cookie que
    // tiene el navegador ya no sirve: si no, ella redirige de vuelta al
    // panel por ver esa cookie y quedan rebotando. `next` devuelve al
    // vecino a donde quería entrar.
    const params = new URLSearchParams({ next: pathname });
    if ((context.request.headers.get("cookie") ?? "").includes("-auth-token")) {
      params.set("sesion", "vencida");
    }
    return context.redirect(`/app/login?${params}`);
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
