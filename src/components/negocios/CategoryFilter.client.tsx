import { useEffect, useState } from "react";
import { ChevronDown, Map, X } from "lucide-react";
import type { Category } from "../../lib/repositories/business.repository";

export type CategoryWithCount = Category & { count: number };

type CategoryFilterProps = {
  categories: CategoryWithCount[];
  /** Total de negocios activos del barrio (chip "Todos"). */
  total: number;
  /** Hay al menos un negocio con reseñas: habilita el filtro "4★ o más". */
  ratingsEnabled?: boolean;
};

// Filtros de la guía. Siguen viviendo en la URL para que una URL compartida
// cargue filtrada: ?categoria= y ?buscar= los consume el servidor, ?abierto=,
// ?ofertas= y ?orden= los aplica BusinessGrid al escuchar "urlchange".
/** Rubros visibles antes de "Ver los N rubros". */
const VISIBLE_CATEGORIES = 12;

export default function CategoryFilter({
  categories,
  total,
  ratingsEnabled = false,
}: CategoryFilterProps) {
  const [params, setParams] = useState(() => new URLSearchParams());
  const [showAll, setShowAll] = useState(false);

  const syncFromUrl = () =>
    setParams(new URLSearchParams(window.location.search));

  useEffect(() => {
    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  const activeCategory = params.get("categoria");
  const search = params.get("buscar");
  const onlyOpen = params.get("abierto") === "1";
  const onlyOffers = params.get("ofertas") === "1";
  const onlyWellRated = params.get("min_rating") === "4";
  const order = params.get("orden") ?? "destacados";

  const updateUrl = (mutate: (url: URL) => void) => {
    const url = new URL(window.location.href);
    mutate(url);
    window.history.pushState({}, "", url);
    setParams(new URLSearchParams(url.search));
    window.dispatchEvent(new Event("urlchange"));
  };

  const setCategory = (slug: string | null) =>
    updateUrl((url) => {
      if (slug) url.searchParams.set("categoria", slug);
      else url.searchParams.delete("categoria");
      url.searchParams.delete("buscar");
    });

  const toggle = (key: string) =>
    updateUrl((url) => {
      if (url.searchParams.get(key) === "1") url.searchParams.delete(key);
      else url.searchParams.set(key, "1");
    });

  const setOrder = (value: string) =>
    updateUrl((url) => {
      if (value === "destacados") url.searchParams.delete("orden");
      else url.searchParams.set("orden", value);
    });

  // La lista completa son 20+ rubros: se muestran los más cargados y el resto
  // queda detrás de un botón, para que la grilla no arranque tan abajo.
  const hidden = Math.max(categories.length - VISIBLE_CATEGORIES, 0);
  const shownCategories =
    showAll || hidden === 0
      ? categories
      : [
          ...categories.slice(0, VISIBLE_CATEGORIES),
          // El rubro activo siempre visible, aunque esté en la cola
          ...categories
            .slice(VISIBLE_CATEGORIES)
            .filter((c) => c.slug === activeCategory),
        ];

  const chip = (active: boolean) =>
    `rounded-full px-4 py-[9px] text-[13.5px] transition-colors ${
      active
        ? "bg-secondary font-semibold text-white"
        : "border border-border bg-bg-card font-medium text-text-main hover:border-[rgba(14,26,18,.2)]"
    }`;

  return (
    <div className="flex flex-col gap-[22px]">
      {/* Rubros */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setCategory(null)}
          className={chip(!activeCategory)}
        >
          Todos{" "}
          <span className={!activeCategory ? "text-white/55" : "text-text-faint"}>
            {total}
          </span>
        </button>

        {shownCategories.map((cat) => {
          const active = activeCategory === cat.slug;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(active ? null : cat.slug)}
              className={chip(active)}
            >
              {cat.name}{" "}
              <span className={active ? "text-white/55" : "text-text-faint"}>
                {cat.count}
              </span>
            </button>
          );
        })}

        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="px-3 py-[9px] text-[13.5px] font-semibold text-primary-strong"
          >
            {showAll ? "Ver menos" : `Ver los ${categories.length} rubros`}
          </button>
        )}
      </div>

      {/* Filtros y orden */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => toggle("abierto")}
            aria-pressed={onlyOpen}
            className={`inline-flex items-center gap-[7px] rounded-full px-[15px] py-[9px] text-[13px] font-semibold transition-colors ${
              onlyOpen
                ? "bg-primary-soft text-primary-strong"
                : "border border-border bg-bg-card font-medium text-text-body hover:border-[rgba(14,26,18,.2)]"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${onlyOpen ? "bg-primary" : "bg-text-faint"}`}
            />
            Abierto ahora
          </button>

          <button
            type="button"
            onClick={() => toggle("ofertas")}
            aria-pressed={onlyOffers}
            className={`rounded-full px-[15px] py-[9px] text-[13px] transition-colors ${
              onlyOffers
                ? "bg-offer-soft font-semibold text-offer"
                : "border border-border bg-bg-card font-medium text-text-body hover:border-[rgba(14,26,18,.2)]"
            }`}
          >
            Con ofertas
          </button>

          {/* Todavía no hay dato en la base: se muestran apagados, no falsos */}
          <button
            type="button"
            disabled
            title="Todavía no cargamos si el comercio hace delivery"
            className="cursor-not-allowed rounded-full border border-border bg-bg-card px-[15px] py-[9px] text-[13px] font-medium text-text-faint"
          >
            Delivery
          </button>
          <button
            type="button"
            disabled={!ratingsEnabled}
            aria-pressed={onlyWellRated}
            title={
              ratingsEnabled
                ? undefined
                : "Todavía no hay reseñas publicadas en el barrio"
            }
            onClick={() =>
              updateUrl((url) => {
                if (url.searchParams.get("min_rating") === "4")
                  url.searchParams.delete("min_rating");
                else url.searchParams.set("min_rating", "4");
              })
            }
            className={
              !ratingsEnabled
                ? "cursor-not-allowed rounded-full border border-border bg-bg-card px-[15px] py-[9px] text-[13px] font-medium text-text-faint"
                : `rounded-full px-[15px] py-[9px] text-[13px] transition-colors ${
                    onlyWellRated
                      ? "bg-rating-soft font-semibold text-[#a5761a]"
                      : "border border-border bg-bg-card font-medium text-text-body hover:border-[rgba(14,26,18,.2)]"
                  }`
            }
          >
            4★ o más
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="orden" className="text-[13px] text-text-muted">
            Ordenar por
          </label>
          <div className="relative">
            <select
              id="orden"
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              className="appearance-none rounded-xl border border-border bg-bg-card py-[9px] pl-[14px] pr-9 text-[13px] font-semibold text-text-main"
            >
              <option value="destacados">Destacados primero</option>
              <option value="nombre">Nombre A-Z</option>
              <option value="puntaje" disabled>
                Mejor puntuados (pronto)
              </option>
              <option value="cercania" disabled>
                Más cercanos (pronto)
              </option>
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-main"
            />
          </div>

          <a
            href="/mapa"
            className="inline-flex items-center gap-[7px] rounded-xl bg-secondary px-4 py-[9px] text-[13px] font-semibold text-white"
          >
            <Map size={14} />
            Mapa
          </a>
        </div>
      </div>

      {search && (
        <div className="flex items-center gap-2 text-[13px] text-text-body">
          Resultados para <strong className="font-semibold">“{search}”</strong>
          <button
            type="button"
            onClick={() =>
              updateUrl((url) => url.searchParams.delete("buscar"))
            }
            className="inline-flex items-center gap-1 rounded-full bg-primary-faint px-2.5 py-1 font-semibold text-text-main"
          >
            <X size={13} />
            Limpiar
          </button>
        </div>
      )}
    </div>
  );
}
