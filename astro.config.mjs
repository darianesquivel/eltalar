// @ts-check
import { defineConfig } from "astro/config";

import react from "@astrojs/react";
import vercel from "@astrojs/vercel";

import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Dominio canónico: lo usan el sitemap, las URLs de compartir y las meta OG.
  // Por barrio: cada proyecto de Vercel define su PUBLIC_SITE_URL
  // (mismo default que src/config/site.ts).
  site: process.env.PUBLIC_SITE_URL ?? "https://eltalar.com.ar",

  // SSR por defecto: los cambios de contenido en Supabase se ven al instante,
  // sin necesidad de re-deployar. Las páginas realmente fijas (teléfonos, 404)
  // se marcan con `export const prerender = true` y salen estáticas.
  output: "server",
  // imageService: las <Image> se sirven optimizadas (webp/avif, resize) por
  // el CDN de imágenes de Vercel, con cache. Gratis en el plan hobby.
  adapter: vercel({ imageService: true }),

  // Prefetch al pasar el mouse por un link: la página siguiente ya está
  // descargada cuando el usuario hace click → navegación casi instantánea.
  prefetch: {
    prefetchAll: true,
    defaultStrategy: "hover",
  },

  image: {
    // Permite optimizar las fotos remotas alojadas en Supabase Storage.
    remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }],
  },

  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
    // Pre-compilar SIEMPRE las deps que usan las islas del cliente: sin esto,
    // el dev server las descubre a demanda y, si quedó corriendo a través de
    // muchos cambios, su cache queda viejo y las páginas con React mueren con
    // "504 Outdated Optimize Dep" / errores de hidratación hasta reiniciar.
    optimizeDeps: {
      include: [
        "react",
        "react-dom/client",
        "@supabase/ssr",
        "@supabase/supabase-js",
        "lucide-react",
        "leaflet",
      ],
    },
  },
});
