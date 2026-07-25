import { useEffect, useRef, useState } from "react";
import BusinessCard from "./BusinessCard";
import type { BusinessSummary } from "../../lib/repositories/business.repository";

type BusinessGridProps = {
  /** Primera tanda, renderizada en el servidor (SEO y primer paint). */
  initialItems: BusinessSummary[];
  initialTotal: number;
  /** Filtros con los que el servidor armó la primera tanda. */
  initialCategory: string | null;
  initialSearch: string | null;
  initialOrder: string;
  initialMinRating: number | null;
  initialOffers: boolean;
  initialOpenNow: boolean;
  pageSize: number;
};

type ServerFilters = {
  categoria: string;
  buscar: string;
  orden: string;
  minRating: string;
  ofertas: string;
  abierto: string;
};

// El listado se pagina EN EL SERVIDOR (/api/negocios): acá solo se acumulan
// las tandas (scroll infinito) y se re-consulta cuando cambian los filtros
// de la URL, que maneja CategoryFilter.
//
// TODOS los filtros son del servidor. Cuando "abierto" y "ofertas" se
// resolvían acá, sobre lo ya cargado, el centinela pedía tanda tras tanda
// buscando coincidencias: la pantalla parpadeaba decenas de veces antes de
// decir que no había resultados, y el contador nunca era exacto.
export default function BusinessGrid({
  initialItems,
  initialTotal,
  initialCategory,
  initialSearch,
  initialOrder,
  initialMinRating,
  initialOffers,
  initialOpenNow,
  pageSize,
}: BusinessGridProps) {
  const [items, setItems] = useState<BusinessSummary[]>(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);

  const filtersRef = useRef<ServerFilters>({
    categoria: initialCategory ?? "",
    buscar: initialSearch ?? "",
    orden: initialOrder,
    minRating: initialMinRating ? String(initialMinRating) : "",
    ofertas: initialOffers ? "1" : "",
    abierto: initialOpenNow ? "1" : "",
  });
  // Descarta respuestas viejas si el usuario cambió el filtro mientras cargaba
  const requestSeq = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchPage = async (offset: number, replace: boolean) => {
    const seq = ++requestSeq.current;
    setLoading(true);

    const params = new URLSearchParams();
    const { categoria, buscar, orden, minRating, ofertas, abierto } =
      filtersRef.current;
    if (categoria) params.set("categoria", categoria);
    if (buscar) params.set("buscar", buscar);
    if (orden && orden !== "destacados") params.set("orden", orden);
    if (minRating) params.set("min_rating", minRating);
    if (ofertas) params.set("ofertas", ofertas);
    if (abierto) params.set("abierto", abierto);
    params.set("offset", String(offset));
    params.set("limit", String(pageSize));

    try {
      const res = await fetch(`/api/negocios?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const page: { items: BusinessSummary[]; total: number } =
        await res.json();

      if (seq !== requestSeq.current) return;
      setTotal(page.total);
      setItems((prev) => (replace ? page.items : [...prev, ...page.items]));
    } catch (err) {
      console.error("Error cargando negocios:", err);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  };

  // Cambios de filtro: CategoryFilter actualiza la URL y avisa con "urlchange"
  useEffect(() => {
    const syncFromUrl = () => {
      const params = new URLSearchParams(window.location.search);

      const next: ServerFilters = {
        categoria: params.get("categoria") ?? "",
        buscar: params.get("buscar") ?? "",
        orden: params.get("orden") ?? "destacados",
        minRating: params.get("min_rating") ?? "",
        ofertas: params.get("ofertas") ?? "",
        abierto: params.get("abierto") ?? "",
      };
      const current = filtersRef.current;
      if (
        next.categoria === current.categoria &&
        next.buscar === current.buscar &&
        next.orden === current.orden &&
        next.minRating === current.minRating &&
        next.ofertas === current.ofertas &&
        next.abierto === current.abierto
      )
        return;

      filtersRef.current = next;
      setItems([]);
      fetchPage(0, true);
    };

    syncFromUrl();
    window.addEventListener("urlchange", syncFromUrl);
    window.addEventListener("popstate", syncFromUrl);
    return () => {
      window.removeEventListener("urlchange", syncFromUrl);
      window.removeEventListener("popstate", syncFromUrl);
    };
  }, []);

  // Scroll infinito: cuando el centinela entra en pantalla, pide la siguiente tanda
  const hasMore = items.length < total;
  useEffect(() => {
    if (!hasMore || loading) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          observer.disconnect();
          fetchPage(items.length, false);
        }
      },
      // Empieza a cargar una pantalla antes de llegar al final
      { rootMargin: "600px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [items.length, total, loading]);

  const countLabel = `${total} ${total === 1 ? "comercio" : "comercios"}`;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-muted">{countLabel}</p>

      {!loading && items.length === 0 ? (
        <p className="py-12 text-center text-[15px] text-text-muted">
          No se encontraron comercios con esos filtros.
        </p>
      ) : (
        <div
          id="comercios"
          className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3"
        >
          {items.map((business) => (
            <BusinessCard key={business.id} business={business} />
          ))}

          {/* Placeholders mientras llega la próxima tanda */}
          {loading &&
            Array.from({ length: items.length === 0 ? 6 : 3 }, (_, i) => (
              <div
                key={`skeleton-${i}`}
                className="h-[320px] animate-pulse rounded-[20px] bg-[#eef0ec]"
              />
            ))}
        </div>
      )}

      <div ref={sentinelRef} aria-hidden="true" />

      {!hasMore && items.length > 0 && (
        <p className="pb-4 text-center text-sm text-text-faint">
          Eso es todo: {total} negocios.
        </p>
      )}
    </div>
  );
}
