/**
 * Normaliza el Instagram de un negocio a una URL absoluta.
 *
 * La gente carga cualquier formato: "miusuario", "@miusuario",
 * "instagram.com/miusuario" o la URL completa. Sin normalizar, un usuario
 * suelto se interpretaba como ruta relativa (eltalar.com.ar/miusuario).
 */
export function instagramUrl(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;

  if (/^https?:\/\//i.test(v)) return v;

  const handle = v
    .replace(/^@/, "")
    .replace(/^(www\.)?instagram\.com\//i, "")
    .split(/[/?#\s]/)[0];

  return handle ? `https://instagram.com/${handle}` : null;
}
