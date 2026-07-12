import { supabase } from "./supabase";

/**
 * Multi-barrio: una sola base y un solo deploy sirven N portales.
 * El middleware resuelve qué barrio corresponde al hostname del request
 * (tabla `barrios`) y lo deja en Astro.locals.barrio; todo lo demás
 * (queries, textos, SEO, mapa) sale de ahí.
 */
export type Barrio = {
  id: string;
  slug: string;
  name: string;
  partido: string;
  domain: string;
  url: string;
  lat: number;
  lng: number;
  radius_m: number;
};

/**
 * Fallback estático: build de páginas prerenderizadas (404), dev sin base
 * o la tabla `barrios` caída. Mantiene el branding aunque no haya datos.
 */
export const DEFAULT_BARRIO: Barrio = {
  id: "",
  slug: "el-talar",
  name: "El Talar",
  partido: "Tigre",
  domain: "eltalar.com.ar",
  url: "https://eltalar.com.ar",
  lat: -34.4716,
  lng: -58.655,
  radius_m: 6000,
};

// Cache en memoria por instancia: los barrios cambian casi nunca y esto
// evita un round-trip a Supabase en cada request.
const TTL_MS = 5 * 60_000;
let cache = new Map<string, Barrio>();
let cacheAt = 0;

async function refreshCache() {
  if (cache.size > 0 && Date.now() - cacheAt < TTL_MS) return;

  const { data, error } = await supabase
    .from("barrios")
    .select("id, slug, name, partido, domain, url, lat, lng, radius_m")
    .eq("is_active", true);

  // Si la consulta falla se conserva el cache viejo (o el fallback estático)
  if (error || !data || data.length === 0) return;

  const next = new Map<string, Barrio>();
  for (const b of data as Barrio[]) {
    next.set(b.domain, b);
    next.set(`slug:${b.slug}`, b);
  }
  cache = next;
  cacheAt = Date.now();
}

/**
 * Hostname → barrio. Hosts desconocidos (localhost, previews de Vercel)
 * caen al barrio default del deploy (PUBLIC_BARRIO_SLUG, default el-talar).
 */
export async function resolveBarrio(hostname: string): Promise<Barrio> {
  await refreshCache();

  const host = hostname.replace(/^www\./, "").toLowerCase();
  const defaultSlug = import.meta.env.PUBLIC_BARRIO_SLUG ?? DEFAULT_BARRIO.slug;

  return cache.get(host) ?? cache.get(`slug:${defaultSlug}`) ?? DEFAULT_BARRIO;
}

/** Para el selector del admin: barrio elegido por slug (cookie). */
export async function getBarrioBySlug(slug: string): Promise<Barrio | null> {
  await refreshCache();
  return cache.get(`slug:${slug}`) ?? null;
}

/** Todos los barrios activos (selector de barrio del superadmin). */
export async function listBarrios(): Promise<Barrio[]> {
  await refreshCache();
  const byId = new Map<string, Barrio>();
  for (const b of cache.values()) byId.set(b.id, b);
  const list = [...byId.values()];
  return list.length > 0 ? list : [DEFAULT_BARRIO];
}

export const ADMIN_BARRIO_COOKIE = "admin_barrio";

type BarrioContext = {
  cookies: { get(name: string): { value: string } | undefined };
  locals: App.Locals;
};

/**
 * Barrio sobre el que trabaja el panel admin: el elegido en el selector
 * (cookie, solo se honra para admins) o el del dominio del request.
 */
export async function getAdminBarrio(ctx: BarrioContext): Promise<Barrio> {
  if (ctx.locals.isAdmin) {
    const slug = ctx.cookies.get(ADMIN_BARRIO_COOKIE)?.value;
    if (slug) {
      const barrio = await getBarrioBySlug(slug);
      if (barrio) return barrio;
    }
  }
  return ctx.locals.barrio;
}
