/**
 * URL optimizada por el CDN de imágenes de Vercel (/_vercel/image).
 *
 * Las fotos viven en Supabase Storage a resolución original (una foto de
 * celular puede pesar varios MB si vino sin comprimir); las cards las
 * muestran a 130-400 px. El CDN las achica, convierte a WebP/AVIF y las
 * cachea — gratis en el plan hobby, ya habilitado en astro.config
 * (imageService) con los anchos de imagesConfig.
 *
 * En dev no existe el endpoint: se sirve la original.
 */

/** Anchos permitidos: tienen que existir en imagesConfig.sizes. */
export type ImageWidth = 320 | 640 | 960 | 1280;

export function cdnImage(
  url: string | null | undefined,
  width: ImageWidth,
): string | null {
  if (!url) return null;
  if (import.meta.env.DEV) return url;
  return `/_vercel/image?url=${encodeURIComponent(url)}&w=${width}&q=75`;
}
