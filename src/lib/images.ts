/**
 * URL optimizada para imágenes remotas (Supabase Storage) desde componentes
 * React, donde no se puede usar <Image> de astro:assets.
 *
 * - En dev sirve el endpoint /_image de Astro.
 * - En producción (Vercel) el optimizador es /_vercel/image, que SOLO acepta
 *   anchos de su lista `sizes`; el ancho pedido se ajusta al permitido más
 *   cercano hacia arriba. Una foto de 300KB queda en ~20-30KB, con cache CDN.
 */

// Debe coincidir con images.sizes de .vercel/output/config.json
const VERCEL_SIZES = [640, 750, 828, 1080, 1200, 1920, 2048, 3840];

export function optimizedImage(url: string, width: number, quality = 75) {
  if (import.meta.env.DEV) {
    return `/_image?href=${encodeURIComponent(url)}&w=${width}&q=${quality}&f=webp`;
  }

  const w = VERCEL_SIZES.find((s) => s >= width) ?? VERCEL_SIZES.at(-1);
  return `/_vercel/image?url=${encodeURIComponent(url)}&w=${w}&q=${quality}`;
}
