/**
 * Lee la sesión desde la cookie, SIN pegarle a la red.
 *
 * `supabase.auth.getSession()` puede quedarse colgado intentando refrescar
 * el token si Supabase no responde, y el header no puede depender de eso:
 * solo necesita el nombre y la foto para dibujar el avatar.
 *
 * Lo que se muestre acá no autoriza nada — cada página del panel valida la
 * sesión de verdad en el servidor. Si el token está vencido, el vecino
 * termina en la página de ingreso igual.
 */

export type SesionLocal = {
  nombre: string;
  email: string;
  avatar: string | null;
};

/** @supabase/ssr parte la cookie en .0, .1… cuando no entra en una sola. */
function leerCookieDeSesion(): string | null {
  const ref = new URL(import.meta.env.PUBLIC_SUPABASE_URL).hostname.split(
    ".",
  )[0];
  const base = `sb-${ref}-auth-token`;

  const partes = document.cookie
    .split(";")
    .map((c) => c.trim())
    .filter((c) => c.startsWith(base))
    // Orden por sufijo (.0, .1) para reconstruir el valor completo
    .sort((a, b) => a.split("=")[0].localeCompare(b.split("=")[0]));

  if (partes.length === 0) return null;

  return partes.map((c) => c.slice(c.indexOf("=") + 1)).join("");
}

export function leerSesionLocal(): SesionLocal | null {
  try {
    const crudo = leerCookieDeSesion();
    if (!crudo) return null;

    const valor = decodeURIComponent(crudo);
    const json = valor.startsWith("base64-")
      ? atob(valor.slice(7).replace(/-/g, "+").replace(/_/g, "/"))
      : valor;

    // El JSON puede traer acentos: atob devuelve bytes, no texto
    const texto = decodeURIComponent(escape(json));
    const sesion = JSON.parse(texto);
    const user = sesion?.user;
    if (!user) return null;

    const meta = user.user_metadata ?? {};

    return {
      nombre:
        meta.full_name ||
        meta.name ||
        user.email?.split("@")[0] ||
        "Mi cuenta",
      email: user.email ?? "",
      avatar: meta.avatar_url || meta.picture || null,
    };
  } catch {
    // Cookie de otra versión o rota: se trata como "sin sesión"
    return null;
  }
}
