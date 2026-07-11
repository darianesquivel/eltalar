# El Talar — Guía del barrio

Portal barrial de El Talar (Tigre, Buenos Aires): guía de negocios y servicios,
farmacias de turno y teléfonos útiles. Pensado para que cada comercio pueda
gestionar su propia ficha (fotos, horarios, contacto).

📄 **Hoja de ruta y arquitectura:** ver [`docs/REFACTOR.md`](docs/REFACTOR.md).

## Stack

- [Astro 7](https://astro.build) (SSR en Vercel) + islas de React 19
- [Tailwind CSS 4](https://tailwindcss.com)
- [Supabase](https://supabase.com) (Postgres + Storage; Auth en camino)

## Desarrollo

```sh
pnpm install
pnpm dev        # http://localhost:4321
pnpm build      # build de producción (genera .vercel/output)
pnpm preview    # previsualizar el build
```

### Variables de entorno

Crear un `.env` en la raíz (no se versiona):

```
PUBLIC_SUPABASE_URL=...
PUBLIC_SUPABASE_ANON_KEY=...
```

## Deploy

**`git push` a `main` = deploy automático en Vercel.** No hay ningún otro paso.

- Cada Pull Request genera un preview deploy con URL propia.
- Los cambios de **contenido** (negocios, alertas, turnos en Supabase) se ven al
  instante **sin deploy**: las páginas con datos son SSR.
- Las env vars de producción se cargan una sola vez en Vercel
  (Settings → Environment Variables).

## Estructura

```
src/
├── pages/           # rutas (/, /negocios, /negocios/[slug], /farmacias, /telefonos)
│   ├── api/         # endpoints (contact)
│   └── sitemap.xml.ts
├── components/      # por dominio: home/, negocios/, farmacias/, telefonos/
├── layouts/         # Layout.astro (head, SEO, header/footer)
├── lib/
│   ├── supabase.ts  # cliente único de Supabase
│   ├── hours.ts     # lógica de horarios (TZ Argentina)
│   └── repositories/  # acceso a datos por dominio
└── styles/          # global.css (tokens de diseño en @theme)
```
