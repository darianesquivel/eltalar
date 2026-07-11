/**
 * URL optimizada para imágenes remotas (Supabase Storage) desde componentes
 * React, donde no se puede usar <Image> de astro:assets.
 *
 * Pasa por el endpoint /_image (Vercel Image Optimization en producción):
 * redimensiona, convierte a webp y cachea en CDN. Una foto de 300KB queda
 * en ~15-30KB para una card.
 */
export function optimizedImage(url: string, width: number, quality = 75) {
  return `/_image?href=${encodeURIComponent(url)}&w=${width}&q=${quality}&f=webp`;
}
