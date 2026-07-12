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
  pageSize: number;
};

// El listado se pagina EN EL SERVIDOR (/api/negocios): acá solo se acumulan
// las tandas (scroll infinito) y se re-consulta cuando cambian los filtros
// de la URL (?categoria= / ?buscar=, que maneja CategoryFilter).
export default function BusinessGrid({
  initialItems,
  initialTotal,
  initialCategory,
  initialSearch,
  pageSize,
}: BusinessGridProps) {
  const [items, setItems] = useState<BusinessSummary[]>(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);

  const filtersRef = useRef({
    categoria: initialCategory ?? "",
    buscar: initialSearch ?? "",
  });
  // Descarta respuestas viejas si el usuario cambió el filtro mientras cargaba
  const requestSeq = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchPage = async (offset: number, replace: boolean) => {
    const seq = ++requestSeq.current;
    setLoading(true);

    const params = new URLSearchParams();
    const { categoria, buscar } = filtersRef.current;
    if (categoria) params.set("categoria", categoria);
    if (buscar) params.set("buscar", buscar);
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
      const next = {
        categoria: params.get("categoria") ?? "",
        buscar: params.get("buscar") ?? "",
      };
      if (
        next.categoria === filtersRef.current.categoria &&
        next.buscar === filtersRef.current.buscar
      )
        return;

      filtersRef.current = next;
      setItems([]);
      fetchPage(0, true);
    };

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

  if (!loading && items.length === 0) {
    return (
      <div className="col-span-full py-12 text-center text-gray-500">
        No se encontraron comercios con esos filtros.
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-center items-center gap-5">
      <p className="font-bold bg-primary text-white py-1 px-10 rounded-full">
        Total: {total}
      </p>

      <div
        id="comercios"
        className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6"
      >
        {items.map((business) => (
          <BusinessCard key={business.id} business={business} />
        ))}

        {/* Placeholders mientras llega la próxima tanda */}
        {loading &&
          Array.from({ length: items.length === 0 ? 10 : 5 }, (_, i) => (
            <div
              key={`skeleton-${i}`}
              className="h-52 rounded-xl bg-gray-200/70 animate-pulse"
            />
          ))}
      </div>

      <div ref={sentinelRef} aria-hidden="true" />

      {!hasMore && items.length > 0 && (
        <p className="pb-4 text-sm text-gray-400">
          Eso es todo: {total} negocios.
        </p>
      )}
    </div>
  );
}
